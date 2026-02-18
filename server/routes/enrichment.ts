import express, { Request, Response } from "express";
import { contactEnrichment } from "../services/contactEnrichment";
import { isAuthenticated } from "../auth";

const router = express.Router();

/**
 * Test endpoint: Enrich a single company
 */
router.post("/test", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const { companyName, companyNumber } = req.body;

        if (!companyName) {
            return res.status(400).json({ error: "companyName is required" });
        }

        const result = await contactEnrichment.enrichProspect(
            companyNumber || "TEST123",
            companyName
        );

        res.json(result);
    } catch (error) {
        console.error("[Enrichment API] Error:", error);
        res.status(500).json({ error: "Enrichment failed" });
    }
});

/**
 * Batch enrich prospects
 */
router.post("/batch", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const { prospects } = req.body;

        if (!Array.isArray(prospects)) {
            return res.status(400).json({ error: "prospects must be an array" });
        }

        const results = await contactEnrichment.enrichMultiple(prospects);

        res.json({
            success: true,
            total: results.length,
            successful: results.filter(r => r.enrichmentStatus === "success").length,
            results,
        });
    } catch (error) {
        console.error("[Enrichment API] Batch error:", error);
        res.status(500).json({ error: "Batch enrichment failed" });
    }
});

export default router;
