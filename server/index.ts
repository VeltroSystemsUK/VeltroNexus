import "./types";
import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createErrorResponse } from "./utils/errorResponse";
import {
  initializeRateLimitRedis,
  closeRateLimitRedis,
  getRateLimitStatus,
} from "./utils/rateLimit";
import crypto from "crypto";

// import { getStripeSync } from "./stripeClient"; // REMOVED
import { WebhookHandlers } from "./webhookHandlers";
import { setupAuth } from "./auth";
import { agentService } from "./services/agentService";
import { validateEnv } from "./config";
import { isStrataEmbedPath, mountStrataEmbed } from "./strataEmbed";
import { sqliteConnection } from "./db/schema";

const app = express();

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// CRITICAL: Stripe webhook route REMOVED

// Reduced default body limits for security
// Individual routes enforce their own limits for high-cost operations (AI, PDF parsing)
app.use((req, res, next) => {
  if (isStrataEmbedPath(req.path)) return next();
  express.json({
    limit: "5mb",
    verify: (incoming, _res, buf) => {
      incoming.rawBody = buf;
    },
  })(req, res, next);
});
app.use((req, res, next) => {
  if (isStrataEmbedPath(req.path)) return next();
  express.urlencoded({ extended: false, limit: "5mb" })(req, res, next);
});
// Never expose the uploads root: it also contains private customer documents,
// local stores and job state. Only the explicitly public media namespaces
// are served here; prospect documents must use authenticated download routes.
const uploadsRoot = path.resolve(process.cwd(), "uploads");
app.use("/uploads/media", express.static(path.join(uploadsRoot, "media"), {
  dotfiles: "deny",
  index: false,
  redirect: false,
}));
app.use("/uploads/curator", express.static(path.join(uploadsRoot, "curator"), {
  dotfiles: "deny",
  index: false,
  redirect: false,
}));
app.use("/uploads/learn/videos", express.static(path.join(uploadsRoot, "learn", "videos"), {
  dotfiles: "deny",
  index: false,
  redirect: false,
}));

// Security headers middleware
const isProduction = process.env.NODE_ENV === "production";
app.use((req, res, next) => {
  // Same-origin only so the Strata workspace can render inside Nexus.
  if (isStrataEmbedPath(req.path)) {
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
  } else {
    res.setHeader("X-Frame-Options", "DENY");
  }

  // Relax Cross-Origin policies to allow external images (like Google Favicons)
  // that don't have CORP headers.
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

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
    !req.path.startsWith("/api") &&
    !req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)
  ) {
    if (res.getHeader("Content-Security-Policy")) {
      console.log("WARNING: CSP Header already set:", res.getHeader("Content-Security-Policy"));
    }
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' 'unsafe-inline' blob: https://editor.unlayer.com",
      "worker-src 'self' blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://editor.unlayer.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com https://editor.unlayer.com",
      "connect-src 'self' wss: ws: https://*.run.app https://corsproxy.io https://api.company-information.service.gov.uk https://europe-west2-veltro-prod.cloudfunctions.net ws://localhost:* http://localhost:* https://editor.unlayer.com https://*.unlayer.com",
      "frame-src 'self' https://editor.unlayer.com",
      isStrataEmbedPath(req.path) ? "frame-ancestors 'self'" : "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ];

    // In development, we must allow more lenient policies for Vite HMR and other tools
    if (!isProduction) {
      // Remove upgrade-insecure-requests for localhost
      const index = cspDirectives.indexOf("upgrade-insecure-requests");
      if (index > -1) cspDirectives.splice(index, 1);

      // Force unsafe-eval in script-src if not present
      const scriptSrcIndex = cspDirectives.findIndex(d => d.startsWith("script-src"));
      if (scriptSrcIndex > -1) {
        if (!cspDirectives[scriptSrcIndex].includes("'unsafe-eval'")) {
          cspDirectives[scriptSrcIndex] += " 'unsafe-eval'";
        }
      }

      // Allow any connection in development (fixes 192.168.* errors)
      const connectSrcIndex = cspDirectives.findIndex(d => d.startsWith("connect-src"));
      if (connectSrcIndex > -1) {
        cspDirectives[connectSrcIndex] += " ws: http:";
      }
    }

    const cspString = cspDirectives.join("; ");
    res.setHeader("Content-Security-Policy", cspString);
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
  try {
    validateEnv();

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

    // Setup authentication - MUST be before registerRoutes
    await setupAuth(app as any);

    const server = await registerRoutes(app);
    mountStrataEmbed(app);

    // Unmatched /api calls must not fall through to the HTML SPA.
    app.use("/api", (req, res) => {
      res.status(404).json({ error: `No API route for ${req.method} ${req.originalUrl}` });
    });

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
    if (process.env.NODE_ENV !== "production") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || "5000", 10);

    let retriesLeft = 3;

    server.on("error", (e: any) => {
      if (e.code === "EADDRINUSE") {
        if (retriesLeft > 0) {
          retriesLeft--;
          log(`Port ${port} in use, retrying in 1s... (${retriesLeft} retries left)`);
          setTimeout(() => {
            server.close();
            server.listen({ port, host: "0.0.0.0" }, onListening);
          }, 1000);
        } else {
          console.error(`Error: Port ${port} is already in use after retries.`);
          process.exit(1);
        }
      } else {
        console.error("Server error:", e);
      }
    });

    const onListening = () => {
      log(`serving on port ${port}`);

      // Non-blocking: Initialize agent workforce after server is ready
      (async () => {
        try {
          await agentService.initializeWorkforce();
          console.log("[AgentService] Workforce initialized");

          const { aresScheduler } = await import("./services/aresScheduler");
          aresScheduler.stop();
          console.log("[ARES] Hibernated — Deal files (ORC-1) is the factory. ARES loop will not run.");

          // Start Companies House monitoring
          const { companiesHouseMonitor } = await import("./services/companiesHouseMonitor");
          companiesHouseMonitor.start();

          // Start weekly reporting (worksheet Mon, progress report Fri)
          const { reportingService } = await import("./services/reportingService");
          reportingService.start();

          // Start Lead Finder autonomous agent
          const { getScheduler } = await import("./Lead Agent/src/scheduler.js");
          const leadFinderScheduler = getScheduler();
          leadFinderScheduler.start();
          console.log("[Lead Finder] Autonomous scheduler started");

          const { agenticWorkflow } = await import("./services/agenticWorkflow");
          let lastDistressScanDate: string | null = null;
          setInterval(() => {
            agenticWorkflow.tick().catch((error) => {
              console.error("[Agentic] Timer tick failed:", error);
            });
            const today = new Date().toISOString().slice(0, 10);
            if (lastDistressScanDate !== today && new Date().getHours() >= 8) {
              lastDistressScanDate = today;
              void (async () => {
                try {
                  await agenticWorkflow.startFromDistressScan(undefined, "sme");
                } catch (error) {
                  console.error("[Agentic] Client Agent distress scan failed:", error);
                }
                try {
                  await agenticWorkflow.startSmeOutreachBatch();
                } catch (error) {
                  console.error("[Agentic] SME first-touch queue failed:", error);
                }
              })();
            }
          }, 60 * 1000);
          console.log("[Agentic] Deal-file timer and daily hunt started");

          const { startImapInboxPoll } = await import("./services/imapInbox");
          startImapInboxPoll();

        } catch (error) {
          console.error("[Startup] Failed to initialize agents/schedulers:", error);
        }
      })();
    };

    const startServer = () => {
      server.listen({ port, host: "0.0.0.0" }, onListening);
    }

    startServer();

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

      // Checkpoint and close the SQLite connection so a killed process can't
      // leave the WAL tail unflushed (observed to drop recent writes on restart).
      try {
        sqliteConnection.pragma("wal_checkpoint(TRUNCATE)");
        sqliteConnection.close();
      } catch (err) {
        console.error("Error closing SQLite connection during shutdown:", err);
      }

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
  } catch (error) {
    console.error("FATAL ERROR DURING STARTUP:", error);
    process.exit(1);
  }
})();
