import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";

const router = Router();

// List Scraped Leads
router.get("/", isAuthenticated, async (req, res) => {
    try {
        const status = req.query.status as string | undefined;
        const leads = await storage.listScrapedLeads(status);
        res.json(leads);
    } catch (error) {
        console.error("[API] Failed to list scraped leads:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Get Scraped Lead
router.get("/:id", isAuthenticated, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

        const lead = await storage.getScrapedLead(id);
        if (!lead) return res.status(404).json({ error: "Lead not found" });

        res.json(lead);
    } catch (error) {
        console.error(`[API] Failed to get scraped lead ${req.params.id}:`, error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST /search — Trigger Google Maps Scraper
router.post("/search", isAuthenticated, async (req, res) => {
    try {
        const { query, maxResults = 50, filters = {}, enrich = true } = req.body;

        if (!query) {
            return res.status(400).json({ error: "Query is required" });
        }

        // Dynamic import — path contains spaces; TS can't resolve statically but Node.js handles it.
        // @ts-ignore
        const { LeadFinderAPI } = await import("../Lead Agent/src/api");
        const api = new LeadFinderAPI();

        console.log(`[API] Triggering Lead Agent Search: ${query}`);

        // Run the scraper (this might take a while, consider background processing for large n)
        const result = await api.search({
            query,
            maxResults,
            filters,
            enrich
        });

        // Save results to Firestore
        const savedLeads = [];
        for (const business of result.leads) {
            const leadData = {
                companyName: business.name,
                companyNumber: "Unknown", // Maps doesn't give this

                // New Fields
                email: business.email ?? null,
                website: business.website ?? null,
                phone: business.phone ?? null,
                address: business.address ?? null,
                rating: business.rating ?? null,
                reviewCount: business.reviewCount ?? null,
                googlePlaceId: business.googlePlaceId ?? null,

                // Scoring & status
                score: business.leadScore ?? 0,
                status: "new",
                priority: (business.leadScore ?? 0) > 0.7 ? "high" : "low",
                identifiedLender: null,

                // Mapped fields for schema compliance
                chargeDate: null,
                chargeAmount: null,
                incorporationDate: null,
                sicCode: null,

                createdAt: new Date(),
                updatedAt: new Date()
            };

            // @ts-ignore - bypassing strict schema check for rapid prototype
            const saved = await storage.createScrapedLead(leadData);
            savedLeads.push(saved);
        }

        res.json({
            success: true,
            summary: result.summary,
            savedCount: savedLeads.length,
            leads: savedLeads
        });

    } catch (error: any) {
        console.error("[API] Lead Agent Search Failed:", error);
        res.status(500).json({ error: error.message || "Search failed" });
    }
});

export default router;
