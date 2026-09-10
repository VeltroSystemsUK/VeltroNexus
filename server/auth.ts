import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { rateLimitMiddleware } from "./utils/rateLimit";
import { toPublicUser } from "./utils/publicUser";
import { buildRegistrationUser } from "./utils/registrationFields";

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const MemoryStore = require('memorystore')(session);

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
}

export async function setupAuth(app: Express) {
    const isProduction = app.get("env") === "production";

    if (isProduction && !process.env.SESSION_SECRET) {
        throw new Error("SESSION_SECRET must be set when running in production — refusing to start with a guessable default.");
    }
    // ponytail: dev-only random secret so a restart still doesn't run on a hardcoded guessable default
    const sessionSecret = process.env.SESSION_SECRET || randomBytes(32).toString("hex");

    const sessionSettings: session.SessionOptions = {
        name: '__session',
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
        store: storage.sessionStore,
        cookie: {
            secure: "auto", // Secure whenever the request is actually HTTPS (via trust proxy), regardless of NODE_ENV
            sameSite: "lax",
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
        },
    };

    // Cloudflare Tunnel is one hop. Trust only that hop so clients cannot spoof X-Forwarded-*.
    app.set("trust proxy", 1);

    app.use(session(sessionSettings));

    app.use(passport.initialize());
    app.use(passport.session());

    // Apply rate limiting to auth endpoints (must be after session but before route handlers)
    app.use(rateLimitMiddleware());

    const isDev = process.env.NODE_ENV !== "production";
    const DEV_USER_ID = "Auond2MCDRlSuiOXZQDo";
    const DEV_USER = isDev ? {
        id: DEV_USER_ID,
        email: "admin@veltro.com",
        username: "admin@veltro.com",
        password: "placeholder",
        role: "super_admin",
        subscriptionTier: "lender",
        prospectLimit: 1000000,
        hasUnderwritingAccess: 1,
        onboardingEnabled: 0,
        firstName: "Dev",
        lastName: "Admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        isAdmin: true,
    } as unknown as SelectUser : null;

    passport.use(
        new LocalStrategy(
            { usernameField: "username", passwordField: "password" },
            async (username, password, done) => {
                try {
                    const normalizedUsername = username.toLowerCase();

                    // Dev Admin Login — only available outside production
                    if (isDev && DEV_USER && normalizedUsername === "admin@veltro.com" && password === "admin123") {
                        return done(null, DEV_USER);
                    }

                    const user = await storage.getUserByUsername(normalizedUsername);
                    if (!user || !(await comparePasswords(password, user.password))) {
                        return done(null, false, { message: "Invalid username or password" });
                    }
                    return done(null, user);
                } catch (error) {
                    console.error("[Auth] Login error:", error);
                    return done(error);
                }
            }
        )
    );

    passport.serializeUser((user, done) => {
        done(null, (user as SelectUser).id);
    });

    passport.deserializeUser(async (id: string, done) => {
        try {
            if (isDev && DEV_USER && id === DEV_USER_ID) {
                return done(null, DEV_USER);
            }

            const user = await storage.getUser(id);
            if (!user) {
                return done(null, null);
            }

            if (user.suspended) {
                return done(null, false);
            }

            done(null, user);
        } catch (error) {
            console.error("Deserialize Error:", error);
            done(error);
        }
    });

    app.post("/api/register", async (req, res, next) => {
        try {
            if (!req.body.email || !req.body.password) {
                return res.status(400).json({ message: "Email and password are required" });
            }

            const { password } = req.body;
            if (password.length < 8) {
                return res.status(400).json({ message: "Password must be at least 8 characters" });
            }
            if (!/[A-Z]/.test(password)) {
                return res.status(400).json({ message: "Password must contain at least one uppercase letter" });
            }
            if (!/[0-9]/.test(password)) {
                return res.status(400).json({ message: "Password must contain at least one number" });
            }

            const normalizedEmail = req.body.email.toLowerCase();
            const existingUser = await storage.getUserByUsername(normalizedEmail);
            if (existingUser) {
                return res.status(400).json({ message: "An account with this email already exists" });
            }

            const hashedPassword = await hashPassword(req.body.password);
            const user = await storage.createUser(
                buildRegistrationUser({ ...req.body, email: normalizedEmail }, hashedPassword)
            );

            req.login(user, (err) => {
                if (err) return next(err);
                res.status(201).json(toPublicUser(user as any));
            });
        } catch (error) {
            next(error);
        }
    });

    app.post("/api/login", (req, res, next) => {
        passport.authenticate("local", (err: Error | null, user: Express.User | false, info: any) => {
            if (err) {
                return next(err);
            }
            if (!user) {
                return res.status(401).json(info);
            }
            // Regenerate session before login to prevent session fixation attacks
            req.session.regenerate((regenerateErr) => {
                if (regenerateErr) {
                    return next(regenerateErr);
                }
                req.logIn(user, async (loginErr) => {
                    if (loginErr) {
                        return next(loginErr);
                    }

                    // Skip DB update for dev user
                    if ((user as SelectUser).id === DEV_USER_ID) {
                        return req.session.save((saveErr) => {
                            if (saveErr) return next(saveErr);
                            res.json(toPublicUser(user as any));
                        });
                    }

                    // Update last login time
                    try {
                        await storage.updateUser((user as SelectUser).id, { lastLoginAt: new Date() });
                    } catch (updateErr) {
                        console.error("[Auth] Failed to update last login time:", updateErr);
                    }

                    // Explicitly save session before responding — ensures Firestore persistence
                    // completes before the client receives the user object and redirects
                    req.session.save((saveErr) => {
                        if (saveErr) return next(saveErr);
                        res.json(toPublicUser(user as any));
                    });
                });
            });
        })(req, res, next);
    });

    app.post("/api/logout", (req, res) => {
        const isProduction = app.get("env") === "production";
        const userId = (req.user as any)?.id;

        req.logout(async (err) => {
            if (err) {
                console.error("[Auth] Logout error:", err);
            }

            if (userId) {
                try {
                    await storage.updateUser(userId, { lastLogoutAt: new Date() });
                } catch (updateErr) {
                    console.error("[Auth] Failed to update lastLogoutAt:", updateErr);
                }
            }

            if (req.session) {
                req.session.destroy((destroyErr) => {
                    if (destroyErr) {
                        console.error("[Auth] Session destroy error:", destroyErr);
                    }
                });
            }

            res.clearCookie("__session", {
                path: "/",
                httpOnly: true,
                secure: req.secure,
                sameSite: "lax",
            });

            res.status(200).json({ success: true, message: "Logged out successfully" });
        });
    });

    app.get("/api/user", (req, res) => {
        if (req.isAuthenticated()) {
            res.json(toPublicUser(req.user as any));
        } else {
            res.sendStatus(401);
        }
    });

    // Combined auth session endpoint - returns user + role in single request
    app.get("/api/auth/session", async (req, res) => {
        if (req.isAuthenticated()) {
            try {
                const user = req.user as SelectUser;
                const fullUser = await storage.getUser(user.id);
                res.setHeader("Cache-Control", "no-store");
                res.json({
                    user: toPublicUser(user as any),
                    role: fullUser?.role || "broker",
                    isAuthenticated: true
                });
            } catch (error) {
                console.error("[Auth] Session fetch error:", error);
                res.status(500).json({ error: "Failed to fetch session" });
            }
        } else {
            res.json({
                user: null,
                role: null,
                isAuthenticated: false
            });
        }
    });
}

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
    if (typeof req.isAuthenticated !== 'function') {
        console.error("[Auth Error] req.isAuthenticated is missing! Passport may not be initialized correctly.");
        return res.status(500).json({
            error: "Authentication system error",
            details: "req.isAuthenticated is not a function. Middleware ordering issue?"
        });
    }
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).send("Not authenticated");
}

function isCsrfExemptPath(requestPath: string): boolean {
    const path = requestPath.split("?")[0] || "";
    if (path === "/api/agent-mail/inbound" || path.startsWith("/api/agent-mail/inbound/")) return true;
    return ["/api/webhooks", "/api/pack", "/api/sign", "/api/inbound", "/api/telnyx"].some(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`)
    );
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
    // Safe methods carry no state changes — skip check
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (isCsrfExemptPath(req.path || req.originalUrl || "")) return next();

    // In production, enforce Origin-header verification.
    // Same-origin requests from the SPA always include an Origin matching the Host.
    // Cross-origin CSRF attempts will either have a mismatched Origin or none at all.
    if (process.env.NODE_ENV === 'production') {
        const origin = req.get('Origin') || req.get('Referer');
        // Use X-Forwarded-Host when behind a reverse proxy. A state-changing
        // browser request without either header is not distinguishable from a
        // cross-site form post, so fail closed.
        const host = req.get('X-Forwarded-Host') || req.get('Host');
        if (!origin) {
            return res.status(403).json({ error: 'CSRF check failed: missing origin' });
        }
        if (!host) {
            return res.status(403).json({ error: 'CSRF check failed: missing host' });
        }
        try {
            const originHost = new URL(origin).host;
            if (originHost !== host) {
                return res.status(403).json({ error: 'CSRF check failed: origin mismatch' });
            }
        } catch {
            return res.status(403).json({ error: 'CSRF check failed: invalid origin' });
        }
    }

    next();
}
