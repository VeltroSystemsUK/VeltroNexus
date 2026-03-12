import { Router } from "express";
import { storage } from "../storage";
import { getRateLimitStatus } from "../utils/rateLimit";
import { LocalStorageClient as ObjectStorageClient } from "../localStorage";

const router = Router();

// Simple health check endpoint for load balancers
router.get("/api/health", async (req, res) => {
  try {
    await storage.getUser("health-check-probe");
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch {
    res.status(503).json({
      status: "unhealthy",
      error: "Database unavailable",
    });
  }
});

// Detailed health check endpoint - checks DB, Redis, and object storage
router.get("/healthz", async (req, res) => {
  const checks: Record<string, { status: "ok" | "error"; latency?: number; error?: string }> = {};
  let allHealthy = true;

  // Check database
  const dbStart = Date.now();
  try {
    await storage.getUser("health-check-probe");
    checks.database = { status: "ok", latency: Date.now() - dbStart };
  } catch (error: any) {
    checks.database = { status: "error", error: error.message, latency: Date.now() - dbStart };
    allHealthy = false;
  }

  // Check Redis (if configured)
  const rateLimitStatus = getRateLimitStatus();
  if (rateLimitStatus.backend === "redis") {
    checks.redis = { status: "ok" };
  } else if (process.env.NODE_ENV === "production" && process.env.REDIS_URL) {
    checks.redis = { status: "error", error: "Redis configured but not connected" };
    allHealthy = false;
  } else {
    checks.redis = { status: "ok" }; // Memory fallback acceptable in dev
  }

  // Check object storage
  const storageStart = Date.now();
  try {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (bucketId) {
      const client = new ObjectStorageClient({ bucketId });
      await client.list({ prefix: "health-check/" });
      checks.objectStorage = { status: "ok", latency: Date.now() - storageStart };
    } else {
      checks.objectStorage = { status: "error", error: "Bucket not configured" };
      allHealthy = false;
    }
  } catch (error: any) {
    checks.objectStorage = {
      status: "error",
      error: error.message,
      latency: Date.now() - storageStart,
    };
    allHealthy = false;
  }

  const status = allHealthy ? 200 : 503;
  res.status(status).json({
    status: allHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    checks,
  });
});

export default router;
