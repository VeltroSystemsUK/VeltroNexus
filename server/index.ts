import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createErrorResponse } from "./utils/errorResponse";
import {
  initializeRateLimitRedis,
  closeRateLimitRedis,
  getRateLimitStatus,
} from "./utils/rateLimit";
import crypto from "crypto";

const app = express();

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Reduced default body limits for security
// Individual routes enforce their own limits for high-cost operations (AI, PDF parsing)
app.use(
  express.json({
    limit: "5mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false, limit: "5mb" }));

// Security headers middleware
const isProduction = process.env.NODE_ENV === "production";
app.use((req, res, next) => {
  // Prevent clickjacking attacks
  res.setHeader("X-Frame-Options", "DENY");
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Enable browser XSS filter (legacy but still useful)
  res.setHeader("X-XSS-Protection", "1; mode=block");
  // Control referrer information
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // Enforce HTTPS in production
  if (isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  // Permissions Policy (formerly Feature-Policy)
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");

  // Content Security Policy
  // Only applied to HTML pages in production (not API routes or static assets)
  // In development, Vite injects inline scripts for HMR which CSP would block
  if (
    isProduction &&
    !req.path.startsWith("/api") &&
    !req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)
  ) {
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://api.resend.com https://*.replit.dev wss://*.replit.dev",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ];
    res.setHeader("Content-Security-Policy", cspDirectives.join("; "));
  }

  next();
});

// Request ID and structured logging middleware
app.use((req: any, res, next) => {
  const start = Date.now();
  const path = req.path;

  // Generate unique request ID
  req.requestId = crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Structured JSON logging for API requests
      console.log(
        JSON.stringify({
          type: "request",
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          method: req.method,
          path,
          status: res.statusCode,
          durationMs: duration,
          userAgent: req.headers["user-agent"]?.substring(0, 100),
          ip: req.ip || req.connection?.remoteAddress,
        })
      );
    }
  });

  next();
});

// Rate limiting middleware is applied in routes.ts after authentication
// so that req.user is available for user-keyed rate limits

(async () => {
  // Initialize Redis for rate limiting (falls back to memory if unavailable)
  await initializeRateLimitRedis();

  // Log rate limit status on startup
  const rateLimitStatus = getRateLimitStatus();
  console.log(
    JSON.stringify({
      type: "rate_limit_status",
      timestamp: new Date().toISOString(),
      backend: rateLimitStatus.backend,
      config: rateLimitStatus.config,
    })
  );

  const server = await registerRoutes(app);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const requestId = (req as any).requestId;

    // Log error with context but don't crash the process
    // Never log error.message in production as it may contain sensitive info
    console.error(
      JSON.stringify({
        type: "error",
        timestamp: new Date().toISOString(),
        requestId,
        method: req.method,
        path: req.path,
        status,
        errorType: err.name || "Error",
        stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
      })
    );

    // Use sanitized error response
    res.status(status).json(createErrorResponse(err, status, requestId));
    // Don't throw - just return to keep the process alive
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    }
  );

  // Graceful shutdown handling
  const gracefulShutdown = async (signal: string) => {
    console.log(
      JSON.stringify({
        type: "shutdown",
        timestamp: new Date().toISOString(),
        signal,
      })
    );

    // Close Redis connection
    await closeRateLimitRedis();

    // Close HTTP server
    server.close(() => {
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
})();
