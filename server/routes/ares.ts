import { aresControlCenter } from "../services/aresControlCenter";
import { Router } from "express";

const router = Router();

/**
 * ARES Control Center API Routes
 * 
 * Endpoints for autonomous orchestration and monitoring
 */

// Get agent performance metrics
router.get("/metrics", async (req, res) => {
    try {
        const userId = req.user?.id || "system";
        const metrics = await aresControlCenter.getAgentMetrics(userId);
        res.json(metrics);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Trigger autonomous enrichment
router.post("/enrich", async (req, res) => {
    try {
        const userId = req.user?.id || "system";
        await aresControlCenter.scheduleDailyEnrichment(userId);
        res.json({ success: true, message: "Enrichment scheduled" });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Run autonomous loop manually
router.post("/run", async (req, res) => {
    try {
        const userId = req.user?.id || "system";
        await aresControlCenter.runAutonomousLoop(userId);
        res.json({ success: true, message: "Autonomous loop complete" });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
