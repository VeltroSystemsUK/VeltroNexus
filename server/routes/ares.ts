import { Router } from "express";
import type { Request, Response } from "express";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";

interface AuthenticatedRequest extends Request {
  user?: any;
}

const router = Router();

/**
 * ARES Control Center API Routes
 *
 * Endpoints for autonomous orchestration and monitoring
 */

// Get agent performance metrics
router.get("/metrics", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { aresControlCenter } = await import("../services/aresControlCenter");
    const metrics = await aresControlCenter.getAgentMetrics(req.user.id);
    res.json(metrics);
  } catch (error) {
    handleApiError(res, error, "ares-error");
  }
});

// Trigger autonomous enrichment
router.post("/enrich", isAuthenticated, async (_req: AuthenticatedRequest, res: Response) => {
  res.status(410).json({ error: "ARES is hibernated. Use Deal files — the stage machine is ORC-1." });
});

router.post("/run", isAuthenticated, async (_req: AuthenticatedRequest, res: Response) => {
  res.status(410).json({ error: "ARES is hibernated. Use Deal files — the stage machine is ORC-1." });
});

// ARES Scheduler - Get Status
router.get("/schedule", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { aresScheduler } = await import("../services/aresScheduler");
    const status = aresScheduler.getStatus();
    res.json(status);
  } catch (error) {
    handleApiError(res, error, "ares-error");
  }
});

// ARES Scheduler - Update Config
router.post("/schedule", isAuthenticated, async (_req: AuthenticatedRequest, res: Response) => {
  res.status(410).json({ error: "ARES is hibernated. Use Deal files — the stage machine is ORC-1." });
});

export default router;
