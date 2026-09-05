/**
 * Rate Limiting Middleware
 *
 * SECURITY: Rate limiting prevents abuse and denial-of-service attacks by limiting
 * how many requests a client can make within a time window.
 *
 * ARCHITECTURE: Uses Redis as the primary store for distributed rate limiting
 * across multiple instances. Falls back to in-memory storage in development.
 *
 * PRODUCTION REQUIREMENT: Redis is REQUIRED in production to ensure rate limits
 * work correctly across multiple application instances. Without Redis, each
 * instance would track limits independently, effectively multiplying the limit.
 */
import Redis from "ioredis";
import { Request, Response, NextFunction } from "express";

// Rate limit configuration constants with environment overrides
// SECURITY: These limits are intentionally conservative to prevent abuse
export const RATE_LIMIT_CONFIG = {
  // Webhooks: requests per minute per API key
  WEBHOOK_LIMIT: parseInt(process.env.RATE_LIMIT_WEBHOOK || "60"),
  WEBHOOK_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WEBHOOK_WINDOW_MS || "60000"),

  // PDF parsing: requests per minute per user
  PDF_PARSE_LIMIT: parseInt(process.env.RATE_LIMIT_PDF_PARSE || "30"),
  PDF_PARSE_WINDOW_MS: parseInt(process.env.RATE_LIMIT_PDF_PARSE_WINDOW_MS || "60000"),

  // AI endpoints: requests per minute per user
  AI_LIMIT: parseInt(process.env.RATE_LIMIT_AI || "20"),
  AI_WINDOW_MS: parseInt(process.env.RATE_LIMIT_AI_WINDOW_MS || "60000"),

  // Auth endpoints: requests per minute per IP
  AUTH_LIMIT: parseInt(process.env.RATE_LIMIT_AUTH || "10"),
  AUTH_WINDOW_MS: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || "60000"),

  // Upload endpoints: requests per minute per user
  UPLOAD_LIMIT: parseInt(process.env.RATE_LIMIT_UPLOAD || "30"),
  UPLOAD_WINDOW_MS: parseInt(process.env.RATE_LIMIT_UPLOAD_WINDOW_MS || "60000"),

  // Public Learn librarian: requests per minute per IP (under user-keyed AI_LIMIT)
  LEARN_ASK_LIMIT: parseInt(process.env.RATE_LIMIT_LEARN_ASK || "10"),
  LEARN_ASK_WINDOW_MS: parseInt(process.env.RATE_LIMIT_LEARN_ASK_WINDOW_MS || "60000"),

  // Public Learn "this helped": requests per minute per IP
  LEARN_HELPED_LIMIT: parseInt(process.env.RATE_LIMIT_LEARN_HELPED || "30"),
  LEARN_HELPED_WINDOW_MS: parseInt(process.env.RATE_LIMIT_LEARN_HELPED_WINDOW_MS || "60000"),

  // Public Learn Tools "email me this": requests per hour per IP (sends real email)
  LEARN_TOOLS_EMAIL_LIMIT: parseInt(process.env.RATE_LIMIT_LEARN_TOOLS_EMAIL || "5"),
  LEARN_TOOLS_EMAIL_WINDOW_MS: parseInt(process.env.RATE_LIMIT_LEARN_TOOLS_EMAIL_WINDOW_MS || "3600000"),
};

// Redis client singleton
let redisClient: Redis | null = null;
let redisAvailable = false;

// In-memory fallback store (used when Redis is unavailable)
const memoryStore = new Map<string, { count: number; resetAt: number }>();

// Cleanup old memory store entries periodically
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  memoryStore.forEach((record, key) => {
    if (now > record.resetAt) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach((key) => memoryStore.delete(key));
}, 60000);

// Initialize Redis connection
// Falls back to in-memory rate limiting if Redis is unavailable
export async function initializeRateLimitRedis(): Promise<boolean> {
  const redisUrl = process.env.REDIS_URL;
  const isProduction = process.env.NODE_ENV === "production";

  if (!redisUrl) {
    console.log(
      JSON.stringify({
        type: "rate_limit_init",
        timestamp: new Date().toISOString(),
        status: "memory_fallback",
        reason: "REDIS_URL not configured",
        warning: isProduction
          ? "In-memory rate limiting is per-instance only. For multi-instance deployments, configure REDIS_URL for shared rate limiting."
          : undefined,
      })
    );
    return false;
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    // Handle connection events
    redisClient.on("connect", () => {
      console.log(
        JSON.stringify({
          type: "rate_limit_redis",
          timestamp: new Date().toISOString(),
          status: "connected",
        })
      );
      redisAvailable = true;
    });

    redisClient.on("error", (err) => {
      console.log(
        JSON.stringify({
          type: "rate_limit_redis",
          timestamp: new Date().toISOString(),
          status: "error",
          error: err.message,
        })
      );
      redisAvailable = false;
    });

    redisClient.on("close", () => {
      console.log(
        JSON.stringify({
          type: "rate_limit_redis",
          timestamp: new Date().toISOString(),
          status: "disconnected",
        })
      );
      redisAvailable = false;
    });

    // Attempt connection
    await redisClient.connect();
    await redisClient.ping();
    redisAvailable = true;

    console.log(
      JSON.stringify({
        type: "rate_limit_init",
        timestamp: new Date().toISOString(),
        status: "redis_connected",
      })
    );

    return true;
  } catch (error: any) {
    console.log(
      JSON.stringify({
        type: "rate_limit_init",
        timestamp: new Date().toISOString(),
        status: "redis_failed",
        error: error.message,
        fallback: "memory",
        warning: isProduction
          ? "Falling back to in-memory rate limiting. For multi-instance deployments, ensure REDIS_URL is configured correctly."
          : undefined,
      })
    );
    redisClient = null;
    redisAvailable = false;

    return false;
  }
}

// Check rate limit using Redis with memory fallback
async function checkRateLimitRedis(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Try Redis if available
  if (redisClient && redisAvailable) {
    try {
      const redisKey = `ratelimit:${key}`;

      // Use Redis sorted set with timestamp scores for sliding window
      const multi = redisClient.multi();

      // Remove expired entries
      multi.zremrangebyscore(redisKey, 0, windowStart);

      // Count current entries
      multi.zcard(redisKey);

      // Add current request with timestamp
      multi.zadd(redisKey, now, `${now}:${Math.random()}`);

      // Set expiry on the key
      multi.pexpire(redisKey, windowMs);

      const results = await multi.exec();

      if (results) {
        const currentCount = (results[1]?.[1] as number) || 0;
        const resetAt = now + windowMs;

        if (currentCount >= limit) {
          // Remove the just-added entry since we're rejecting
          await redisClient.zremrangebyscore(redisKey, now, now + 1);
          return { allowed: false, remaining: 0, resetAt };
        }

        return {
          allowed: true,
          remaining: Math.max(0, limit - currentCount - 1),
          resetAt,
        };
      }
    } catch (error) {
      // Fall through to memory store on error
      console.log(
        JSON.stringify({
          type: "rate_limit_redis_error",
          timestamp: new Date().toISOString(),
          key,
          error: (error as Error).message,
        })
      );
    }
  }

  // Memory fallback
  return checkRateLimitMemory(key, limit, windowMs);
}

// In-memory rate limit check (fallback)
function checkRateLimitMemory(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = memoryStore.get(key);

  if (!record || now > record.resetAt) {
    const resetAt = now + windowMs;
    memoryStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count++;
  return { allowed: true, remaining: limit - record.count, resetAt: record.resetAt };
}

// Rate limit rule definition
interface RateLimitRule {
  pattern: RegExp;
  limit: number;
  windowMs: number;
  keyType: "ip" | "user" | "apiKey";
}

// Define rate limit rules
export const RATE_LIMIT_RULES: RateLimitRule[] = [
  // Webhook endpoints: by API key hash
  {
    pattern: /^\/api\/webhooks\//,
    limit: RATE_LIMIT_CONFIG.WEBHOOK_LIMIT,
    windowMs: RATE_LIMIT_CONFIG.WEBHOOK_WINDOW_MS,
    keyType: "apiKey",
  },
  // PDF parsing: by user
  {
    pattern: /^\/api\/parse-pdf/,
    limit: RATE_LIMIT_CONFIG.PDF_PARSE_LIMIT,
    windowMs: RATE_LIMIT_CONFIG.PDF_PARSE_WINDOW_MS,
    keyType: "user",
  },
  // AI endpoints: by user
  {
    pattern:
      /\/analyze-csv|\/analyze-bank-pdfs|\/analyze-accounts|\/ai-summary|\/ai-credit-underwriting/,
    limit: RATE_LIMIT_CONFIG.AI_LIMIT,
    windowMs: RATE_LIMIT_CONFIG.AI_WINDOW_MS,
    keyType: "user",
  },
  // Auth endpoints: by IP (brute force protection)
  {
    pattern: /^\/api\/login|^\/api\/register|^\/api\/auth\/callback/,
    limit: RATE_LIMIT_CONFIG.AUTH_LIMIT,
    windowMs: RATE_LIMIT_CONFIG.AUTH_WINDOW_MS,
    keyType: "ip",
  },
  // Upload endpoints: by user
  {
    pattern: /\/upload|\/documents\/upload|\/logo/,
    limit: RATE_LIMIT_CONFIG.UPLOAD_LIMIT,
    windowMs: RATE_LIMIT_CONFIG.UPLOAD_WINDOW_MS,
    keyType: "user",
  },
  // Customer pack upload: by IP
  {
    pattern: /^\/api\/pack\//,
    limit: RATE_LIMIT_CONFIG.UPLOAD_LIMIT,
    windowMs: RATE_LIMIT_CONFIG.UPLOAD_WINDOW_MS,
    keyType: "ip",
  },
  // Public Learn librarian: by IP (anonymous; tighter than user-keyed AI)
  {
    pattern: /^\/api\/learn\/ask\/?$/,
    limit: RATE_LIMIT_CONFIG.LEARN_ASK_LIMIT,
    windowMs: RATE_LIMIT_CONFIG.LEARN_ASK_WINDOW_MS,
    keyType: "ip",
  },
  // Public Learn "this helped": by IP
  {
    pattern: /^\/api\/learn\/piece\/[^/]+\/helped\/?$/,
    limit: RATE_LIMIT_CONFIG.LEARN_HELPED_LIMIT,
    windowMs: RATE_LIMIT_CONFIG.LEARN_HELPED_WINDOW_MS,
    keyType: "ip",
  },
  // Public Learn Tools "email me this": by IP (sends real email)
  {
    pattern: /^\/api\/learn\/tools\/email-me\/?$/,
    limit: RATE_LIMIT_CONFIG.LEARN_TOOLS_EMAIL_LIMIT,
    windowMs: RATE_LIMIT_CONFIG.LEARN_TOOLS_EMAIL_WINDOW_MS,
    keyType: "ip",
  },
];

// Rate limiting middleware
export function rateLimitMiddleware() {
  return async (req: any, res: Response, next: NextFunction) => {
    const path = req.path;

    // Find matching rate limit rule
    for (const rule of RATE_LIMIT_RULES) {
      if (rule.pattern.test(path)) {
        let key: string;

        if (rule.keyType === "apiKey") {
          const apiKey = req.headers["x-flowloan-api-key"];
          // SECURITY: Hash the API key before using as rate limit key
          // This prevents the raw API key from appearing in Redis keys or logs
          const keyHash = apiKey
            ? require("crypto").createHash("sha256").update(apiKey).digest("hex").substring(0, 16)
            : "none";
          key = `apikey:${keyHash}:${path.split("/").slice(0, 4).join("/")}`;
        } else if (rule.keyType === "user") {
          const authed = req.user as { id?: string; claims?: { sub?: string } } | undefined;
          const userId = authed?.id || authed?.claims?.sub;
          if (!userId) {
            // Fall back to IP if not authenticated
            key = `ip:${req.ip || "unknown"}:${path.split("/").slice(0, 4).join("/")}`;
          } else {
            key = `user:${userId}:${path.split("/").slice(0, 4).join("/")}`;
          }
        } else {
          key = `ip:${req.ip || "unknown"}:${path.split("/").slice(0, 4).join("/")}`;
        }

        const result = await checkRateLimitRedis(key, rule.limit, rule.windowMs);

        // Set rate limit headers
        res.setHeader("X-RateLimit-Limit", rule.limit.toString());
        res.setHeader("X-RateLimit-Remaining", result.remaining.toString());
        res.setHeader("X-RateLimit-Reset", Math.ceil(result.resetAt / 1000).toString());

        if (!result.allowed) {
          console.log(
            JSON.stringify({
              type: "rate_limit_exceeded",
              timestamp: new Date().toISOString(),
              requestId: req.requestId,
              path,
              keyType: rule.keyType,
              limit: rule.limit,
              backend: redisAvailable ? "redis" : "memory",
            })
          );

          return res.status(429).json({
            error: "Too many requests",
            retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
          });
        }

        break; // Only apply first matching rule
      }
    }

    next();
  };
}

// Health check for rate limiter
export function getRateLimitStatus(): {
  backend: "redis" | "memory";
  redisConnected: boolean;
  config: typeof RATE_LIMIT_CONFIG;
} {
  return {
    backend: redisAvailable ? "redis" : "memory",
    redisConnected: redisAvailable,
    config: RATE_LIMIT_CONFIG,
  };
}

// Cleanup function for graceful shutdown
export async function closeRateLimitRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    redisAvailable = false;
  }
}
