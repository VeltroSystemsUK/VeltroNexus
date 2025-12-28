import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import crypto from "crypto";
import { storage } from "./storage";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtlMs = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds (for cookie)
  const sessionTtlSeconds = Math.floor(sessionTtlMs / 1000); // convert to seconds for pg-store
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtlSeconds, // connect-pg-simple expects seconds, not milliseconds
    tableName: "sessions",
  });
  const isProduction = process.env.NODE_ENV === "production";
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction, // Only require HTTPS in production
      maxAge: sessionTtlMs, // cookie.maxAge is in milliseconds
      // SECURITY: sameSite=lax prevents cookies from being sent on cross-site
      // requests (except top-level navigations). This is the first layer of
      // CSRF defense. Combined with Origin/Referer validation, it provides
      // robust protection against cross-site request forgery attacks.
      sameSite: "lax",
    },
  });
}

/**
 * CSRF (Cross-Site Request Forgery) protection middleware.
 *
 * SECURITY: Prevents malicious websites from making authenticated requests
 * on behalf of logged-in users. This works because:
 *
 * 1. Browsers automatically send cookies with every request to a domain
 * 2. A malicious site could create a form that POSTs to our API
 * 3. The browser would include the user's session cookie automatically
 * 4. Without CSRF protection, this would succeed as an authenticated request
 *
 * This middleware validates that the Origin/Referer header matches our host,
 * which browsers enforce and cannot be spoofed by JavaScript on other domains.
 * Combined with sameSite=lax cookies, this provides robust CSRF protection.
 */
export function csrfProtection(req: any, res: any, next: any) {
  const unsafeMethods = ["POST", "PUT", "PATCH", "DELETE"];

  // Skip CSRF check for safe methods and webhook endpoints (authenticated via API key)
  if (!unsafeMethods.includes(req.method) || req.path.startsWith("/api/webhooks/")) {
    return next();
  }

  // Get the origin or referer header - require at least one for all unsafe methods
  const origin = req.get("Origin");
  const referer = req.get("Referer");

  // Require Origin or Referer header for all unsafe methods (no exceptions)
  if (!origin && !referer) {
    console.warn(`CSRF blocked: missing Origin and Referer headers for ${req.method} ${req.path}`);
    return res.status(403).json({ error: "CSRF validation failed: missing origin header" });
  }

  // Parse the origin/referer and validate it matches the host
  const sourceHeader = origin || referer;
  try {
    const sourceUrl = new URL(sourceHeader);
    const host = req.get("Host");

    // Check if origin/referer matches the request host
    if (sourceUrl.host !== host) {
      console.warn(`CSRF blocked: source ${sourceUrl.host} != host ${host}`);
      return res.status(403).json({ error: "CSRF validation failed: origin mismatch" });
    }
  } catch (e) {
    return res.status(403).json({ error: "CSRF validation failed: invalid origin" });
  }

  next();
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

// Hash IP address for privacy
function hashIp(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  return crypto.createHash("sha256").update(ip).digest("hex");
}

// Extract device info from user agent
function extractDeviceInfo(userAgent: string | undefined): string {
  if (!userAgent) return "Unknown device";
  
  // Simple extraction of browser/OS info
  const browsers = ["Chrome", "Firefox", "Safari", "Edge", "Opera"];
  const os = ["Windows", "Mac", "Linux", "Android", "iOS"];
  
  let browser = "Unknown browser";
  let platform = "Unknown OS";
  
  for (const b of browsers) {
    if (userAgent.includes(b)) {
      browser = b;
      break;
    }
  }
  
  for (const o of os) {
    if (userAgent.includes(o)) {
      platform = o;
      break;
    }
  }
  
  return `${browser} on ${platform}`;
}

// Register a new session and enforce limits
async function registerSession(
  sessionId: string,
  userId: string,
  userAgent: string | undefined,
  ip: string | undefined
): Promise<{ kicked: boolean; kickedSession?: any }> {
  // Get user to check subscription tier
  const user = await storage.getUser(userId);
  const subscriptionTier = user?.subscriptionTier || "free";
  const sessionLimit = storage.getSessionLimit(subscriptionTier);
  
  // Get current active sessions
  const activeSessions = await storage.getUserActiveSessions(userId);
  
  let kicked = false;
  let kickedSession;
  
  // If at or over limit, revoke the oldest session
  if (activeSessions.length >= sessionLimit && sessionLimit !== Infinity) {
    kickedSession = await storage.revokeOldestSession(userId, "New device login - session limit exceeded");
    kicked = true;
    console.log(`[Session] Revoked oldest session for user ${userId} due to limit (${sessionLimit})`);
  }
  
  // Create the new session record
  await storage.createUserSession({
    sessionId,
    userId,
    userAgent: userAgent || null,
    ipHash: hashIp(ip) || null,
    deviceInfo: extractDeviceInfo(userAgent),
  });
  
  console.log(`[Session] Registered new session for user ${userId} (tier: ${subscriptionTier}, limit: ${sessionLimit})`);
  
  return { kicked, kickedSession };
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  // Keep track of registered strategies
  const registeredStrategies = new Set<string>();

  // Helper function to ensure strategy exists for a domain
  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, async (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.redirect("/api/login");
      
      req.logIn(user, async (loginErr) => {
        if (loginErr) return next(loginErr);
        
        // Register the session and enforce limits
        try {
          const sessionId = req.sessionID;
          const userId = user.claims?.sub;
          const userAgent = req.get("User-Agent");
          const ip = req.ip || req.socket?.remoteAddress;
          
          if (userId && sessionId) {
            await registerSession(sessionId, userId, userAgent, ip);
          }
        } catch (sessionErr) {
          console.error("[Session] Error registering session:", sessionErr);
          // Don't block login if session tracking fails
        }
        
        return res.redirect("/");
      });
    })(req, res, next);
  });

  app.get("/api/logout", async (req, res) => {
    const user = req.user as any;
    const sessionId = req.sessionID;
    
    // Revoke the session before logout
    if (sessionId) {
      try {
        await storage.revokeSession(sessionId, "User logged out");
        console.log(`[Session] Revoked session on logout: ${sessionId}`);
      } catch (err) {
        console.error("[Session] Error revoking session on logout:", err);
      }
    }
    
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Check if this session has been revoked (kicked by another login)
  const sessionId = req.sessionID;
  if (sessionId) {
    try {
      const userSession = await storage.getSessionBySessionId(sessionId);
      if (userSession?.revokedAt) {
        // Session was revoked - force logout
        return res.status(401).json({ 
          message: "Session ended", 
          reason: "session_revoked",
          details: userSession.revokedReason || "Your session was ended because another device logged in"
        });
      }
      
      // Update last seen timestamp (async, don't wait)
      storage.updateSessionLastSeen(sessionId).catch(err => {
        console.error("[Session] Error updating last seen:", err);
      });
    } catch (err) {
      console.error("[Session] Error checking session validity:", err);
      // Don't block if session check fails
    }
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
