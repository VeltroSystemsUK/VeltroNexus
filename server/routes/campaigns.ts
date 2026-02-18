import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { insertCampaignSchema } from "@shared/schema";

const router = Router();

// List Campaigns
router.get("/", isAuthenticated, async (req, res) => {
    try {
        const campaigns = await storage.listCampaigns();
        res.json(campaigns);
    } catch (error) {
        console.error("[API] Failed to list campaigns:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Create Campaign
router.post("/", isAuthenticated, async (req, res) => {
    try {
        const parsed = insertCampaignSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error });
        }

        const campaign = await storage.createCampaign(parsed.data);
        res.status(201).json(campaign);
    } catch (error) {
        console.error("[API] Failed to create campaign:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Update Campaign
router.patch("/:id", isAuthenticated, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

        // Validate partial update
        const campaign = await storage.updateCampaign(id, req.body);
        res.json(campaign);
    } catch (error) {
        console.error("[API] Failed to update campaign:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Delete Campaign
router.delete("/:id", isAuthenticated, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

        await storage.deleteCampaign(id);
        res.status(204).send();
    } catch (error) {
        console.error("[API] Failed to delete campaign:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;
