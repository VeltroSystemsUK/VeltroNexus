import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
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
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
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
      maxAge: sessionTtl,
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

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
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
        verify,
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
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
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
