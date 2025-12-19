import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import crypto from "crypto";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

// Rate limiting stores (in-memory, resets on restart)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Rate limit check helper
function checkRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetAt) {
    const resetAt = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }
  
  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }
  
  record.count++;
  return { allowed: true, remaining: limit - record.count, resetAt: record.resetAt };
}

// Cleanup old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean every minute

// Reduced default body limits for security
// Individual routes enforce their own limits for high-cost operations (AI, PDF parsing)
app.use(express.json({
  limit: '5mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '5mb' }));

// Request ID and structured logging middleware
app.use((req: any, res, next) => {
  const start = Date.now();
  const path = req.path;
  
  // Generate unique request ID
  req.requestId = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Structured JSON logging for API requests
      console.log(JSON.stringify({
        type: 'request',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        method: req.method,
        path,
        status: res.statusCode,
        durationMs: duration,
        userAgent: req.headers['user-agent']?.substring(0, 100),
        ip: req.ip || req.connection?.remoteAddress,
      }));
    }
  });

  next();
});

// Rate limiting middleware for high-cost endpoints
app.use((req: any, res, next) => {
  const path = req.path;
  
  // Define rate limits per endpoint category
  const rateLimits: { pattern: RegExp; limit: number; windowMs: number; keyType: 'ip' | 'user' | 'apiKey' }[] = [
    // Webhook endpoints: 60 requests per minute per API key
    { pattern: /^\/api\/webhooks\//, limit: 60, windowMs: 60000, keyType: 'apiKey' },
    // PDF parsing: 30 requests per minute per user
    { pattern: /^\/api\/parse-pdf/, limit: 30, windowMs: 60000, keyType: 'user' },
    // AI endpoints: 20 requests per minute per user
    { pattern: /\/analyze-csv|\/analyze-bank-pdfs|\/analyze-accounts|\/ai-summary/, limit: 20, windowMs: 60000, keyType: 'user' },
    // Auth endpoints: 10 requests per minute per IP (brute force protection)
    { pattern: /^\/api\/login|^\/api\/register/, limit: 10, windowMs: 60000, keyType: 'ip' },
  ];
  
  for (const rule of rateLimits) {
    if (rule.pattern.test(path)) {
      let key: string;
      
      if (rule.keyType === 'apiKey') {
        const apiKey = req.headers['x-flowloan-api-key'];
        key = `ratelimit:apikey:${apiKey || 'none'}:${path}`;
      } else if (rule.keyType === 'user') {
        const userId = req.user?.claims?.sub;
        if (!userId) {
          // For user-keyed limits, fall back to IP if not authenticated
          key = `ratelimit:ip:${req.ip || 'unknown'}:${path}`;
        } else {
          key = `ratelimit:user:${userId}:${path}`;
        }
      } else {
        key = `ratelimit:ip:${req.ip || 'unknown'}:${path}`;
      }
      
      const result = checkRateLimit(key, rule.limit, rule.windowMs);
      
      res.setHeader('X-RateLimit-Limit', rule.limit.toString());
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString());
      
      if (!result.allowed) {
        console.log(JSON.stringify({
          type: 'rate_limit',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          path,
          key,
          limit: rule.limit,
        }));
        return res.status(429).json({ 
          error: 'Too many requests',
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000)
        });
      }
      
      break; // Only apply first matching rule
    }
  }
  
  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    // Log error with context but don't crash the process
    console.error(JSON.stringify({
      type: 'error',
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId,
      method: req.method,
      path: req.path,
      status,
      error: message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    }));

    res.status(status).json({ message });
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
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
