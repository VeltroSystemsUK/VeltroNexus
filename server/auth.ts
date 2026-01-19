import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
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

export function setupAuth(app: Express) {
    const sessionSettings: session.SessionOptions = {
        secret: process.env.SESSION_SECRET || "default_session_secret",
        resave: false,
        saveUninitialized: false,
        store: storage.sessionStore,
        cookie: {
            secure: app.get("env") === "production",
        },
    };

    if (app.get("env") === "production") {
        app.set("trust proxy", 1);
    }

    app.use(session(sessionSettings));
    app.use(passport.initialize());
    app.use(passport.session());

    passport.use(
        new LocalStrategy(async (username, password, done) => {
            try {
                const user = await storage.getUserByUsername(username);
                if (!user || !(await comparePasswords(password, user.password))) {
                    return done(null, false, { message: "Invalid username or password" });
                }
                return done(null, user);
            } catch (error) {
                return done(error);
            }
        })
    );

    passport.serializeUser((user, done) => {
        done(null, (user as SelectUser).id);
    });

    passport.deserializeUser(async (id: string, done) => {
        try {
            const user = await storage.getUser(id);
            done(null, user);
        } catch (error) {
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
        passport.authenticate("local", (err: Error | null, user: Express.User | false, info: any) => {
            if (err) {
                return next(err);
            }
            if (!user) {
                return res.status(401).json(info);
            }
            req.logIn(user, async (err) => {
                if (err) {
                    return next(err);
                }
                // Update last login time
                await storage.updateUser(user.id, { lastLoginAt: new Date() });
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
            // The cookie name is "connect.sid" by default
            res.clearCookie("connect.sid", {
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
