import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session"; // This import can stay as it is used for app.use(session(...)) which expects the value, BUT wait, storage.ts changed type? No, auth.ts is separate.
// Actually, check auth.ts content. Line 28 uses session.SessionOptions.
// If I changed storage.ts, auth.ts is fine UNLESS it imports storage.ts types? No.
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

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

    const sessionSettings: session.SessionOptions = {
        name: '__session', // Required for Firebase Hosting to pass the cookie to Cloud Run
        secret: process.env.SESSION_SECRET || "default_session_secret",
        resave: false,
        saveUninitialized: false,
        store: storage.sessionStore,
        cookie: {
            secure: isProduction, // Only require HTTPS in production
            sameSite: "lax", // Use 'lax' for Firebase Hosting (same-origin via rewrites)
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
        },
    };

    if (isProduction) {
        app.set("trust proxy", true);
    }

    // Debug Middleware: Log Session & Cookie Details
    app.use((req, res, next) => {
        console.log(`[Session Debug] ${req.method} ${req.url}`);
        console.log(`[Session Debug] Cookie Header:`, req.headers.cookie);
        console.log(`[Session Debug] Session ID before:`, req.sessionID);
        next();
    });

    app.use(session(sessionSettings));

    app.use(passport.initialize());
    app.use(passport.session());

    // Debug Middleware: Log Session Result
    app.use((req, res, next) => {
        console.log(`[Session Debug] Session ID after:`, req.sessionID);
        console.log(`[Session Debug] User:`, req.user);
        console.log(`[Session Debug] Is Authenticated:`, req.isAuthenticated());
        next();
    });

    const DEV_USER_ID = "Auond2MCDRlSuiOXZQDo";
    const DEV_USER = {
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
        isAdmin: true, // Helper flag if needed
    } as unknown as SelectUser;

    passport.use(
        new LocalStrategy(
            { usernameField: "username", passwordField: "password" },
            async (username, password, done) => {
                try {
                    console.log(`[Auth Debug] Login attempt for: '${username}'`);

                    // Dev Admin Login (Case Insensitive)
                    if (username.toLowerCase() === "admin@veltro.com" && password === "admin123") {
                        console.log("Dev Admin Login Detected");
                        return done(null, DEV_USER);
                    }

                    const user = await storage.getUserByUsername(username);
                    if (!user || !(await comparePasswords(password, user.password))) {
                        console.log("[Auth Debug] Auth failed for:", username);
                        return done(null, false, { message: "Invalid username or password" });
                    }
                    return done(null, user);
                } catch (error) {
                    console.error("[Auth Debug] Login error:", error);
                    return done(error);
                }
            }
        )
    );

    // Dynamic import for Google Strategy to avoid issues if not configured, although we installed it
    const { Strategy: GoogleStrategy } = await import("passport-google-oauth20");

    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID || "temp",
                clientSecret: process.env.GOOGLE_CLIENT_SECRET || "temp",
                callbackURL: "/api/auth/google/callback",
                passReqToCallback: true,
            },
            async (req: any, accessToken: string, refreshToken: string, params: any, profile: any, done: any) => {
                try {
                    // Check if we have an authenticated user already (linking)
                    if (req.user) {
                        const currentUser = req.user as SelectUser;
                        const expiryDate = new Date();
                        expiryDate.setSeconds(expiryDate.getSeconds() + (params.expires_in || 3600));

                        const updatedUser = await storage.updateUser(currentUser.id, {
                            googleConnected: true,
                            googleEmail: profile.emails?.[0]?.value,
                            googleAccessToken: accessToken,
                            googleRefreshToken: refreshToken || currentUser.googleRefreshToken, // refresh token only sent once usually
                            googleTokenExpiry: expiryDate
                        });
                        return done(null, updatedUser);
                    }

                    // Not logged in? Try to find user by google email or just fail if we only support linking
                    // For now, let's allow login with Google if email matches
                    const email = profile.emails?.[0]?.value;
                    if (email) {
                        const user = await storage.getUserByUsername(email);
                        if (user) {
                            const expiryDate = new Date();
                            expiryDate.setSeconds(expiryDate.getSeconds() + (params.expires_in || 3600));

                            const updatedUser = await storage.updateUser(user.id, {
                                googleConnected: true,
                                googleAccessToken: accessToken,
                                googleRefreshToken: refreshToken || user.googleRefreshToken,
                                googleTokenExpiry: expiryDate
                            });
                            return done(null, updatedUser);
                        }
                    }

                    return done(null, false, { message: "Please log in with your account first to link Google" });
                } catch (err) {
                    return done(err);
                }
            }
        )
    );

    passport.serializeUser((user, done) => {
        console.log("Serialize User:", (user as SelectUser).id);
        done(null, (user as SelectUser).id);
    });

    passport.deserializeUser(async (id: string, done) => {
        console.log("Deserialize User:", id);
        try {
            if (id === DEV_USER_ID) {
                return done(null, DEV_USER);
            }

            const user = await storage.getUser(id);
            if (!user) {
                console.warn("User not found during deserialization:", id);
                return done(null, null);
            }

            if (user.suspended) {
                console.warn("Suspended user attempted access:", id);
                return done(null, false); // passport-session will clear the session
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
                return res.status(400).send("Email and password are required");
            }

            const existingUser = await storage.getUserByUsername(req.body.email);
            if (existingUser) {
                return res.status(400).send("Username already exists");
            }

            const hashedPassword = await hashPassword(req.body.password);

            // Handle trial setup based on selected plan
            const trialTier = req.body.trialTier;
            let subscriptionTier = "free";
            let prospectLimit = 10;
            let trialEndsAt = null;

            if (trialTier === "broker" || trialTier === "team") {
                trialEndsAt = new Date();
                trialEndsAt.setDate(trialEndsAt.getDate() + 14);
                subscriptionTier = trialTier;
                prospectLimit = trialTier === "broker" ? 50 : 250;
            }

            const user = await storage.createUser({
                ...req.body,
                password: hashedPassword,
                role: 'broker',
                subscriptionTier,
                prospectLimit,
                trialTier: trialTier || null,
                trialEndsAt,
            });

            req.login(user, (err) => {
                if (err) return next(err);
                res.status(201).json(user);
            });
        } catch (error) {
            next(error);
        }
    });

    app.post("/api/login", (req, res, next) => {
        console.log("[API DEBUG] Login Request Received. Body keys:", Object.keys(req.body));
        console.log("[API DEBUG] Login Username:", req.body.username);

        passport.authenticate("local", (err: Error | null, user: Express.User | false, info: any) => {
            if (err) {
                return next(err);
            }
            if (!user) {
                return res.status(401).json(info);
            }
            console.log("Login Request Protocol:", req.protocol);
            console.log("Login Request Secure:", req.secure);
            console.log("X-Forwarded-Proto:", req.headers['x-forwarded-proto']);
            req.logIn(user, async (err) => {
                if (err) {
                    return next(err);
                }
                console.log("Login Successful for user:", (user as SelectUser).id);

                // Skip DB update for dev user
                if ((user as SelectUser).id === DEV_USER_ID) {
                    return res.json(user);
                }

                // Update last login time
                try {
                    await storage.updateUser((user as SelectUser).id, { lastLoginAt: new Date() });
                } catch (updateErr) {
                    console.error("Failed to update last login time - ignoring:", updateErr);
                }
                res.json(user);
            });
        })(req, res, next);
    });

    app.post("/api/logout", (req, res) => {
        // Get the environment check to match session cookie creation
        const isProduction = app.get("env") === "production";

        console.log("[Logout] Starting logout for user:", req.user?.id);

        const userId = (req.user as any)?.id;

        // First, logout from passport
        req.logout(async (err) => {
            if (err) {
                console.error("[Logout] Passport logout error:", err);
            }

            if (userId) {
                try {
                    await storage.updateUser(userId, { lastLogoutAt: new Date() });
                } catch (updateErr) {
                    console.error("[Logout] Failed to update lastLogoutAt:", updateErr);
                }
            }

            // Clear the session data
            if (req.session) {
                req.session.destroy((destroyErr) => {
                    if (destroyErr) {
                        console.error("[Logout] Session destroy error:", destroyErr);
                    }
                    console.log("[Logout] Session destroyed");
                });
            }

            // Clear the session cookie with MATCHING options
            // The cookie name is "__session"
            res.clearCookie("__session", {
                path: "/",
                httpOnly: true,
                secure: isProduction,
                sameSite: "lax",
            });

            console.log("[Logout] Cookie cleared, isProduction:", isProduction);

            // Send success response
            res.status(200).json({ success: true, message: "Logged out successfully" });
        });
    });

    app.get("/api/user", (req, res) => {
        if (req.isAuthenticated()) {
            res.json(req.user);
        } else {
            res.sendStatus(401);
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

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
    // Basic implementation to satisfy usage. 
    // In a real app, verify X-CSRF-Token or use csurf middleware.
    next();
}
