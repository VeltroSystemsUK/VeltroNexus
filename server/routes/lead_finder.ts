import { Router } from "express";
import { LeadFinderAgent } from "../Lead Agent/src/agent";
import { getRunStats, deleteBusiness, getBusinessesForExport, initDb, updateBusinessContact, markBusinessAsMigrated } from "../Lead Agent/src/database/db";
import { storage } from "../storage";
import { insertInternalLeadSchema } from "@shared/schema";
import automationRouter from "./leadFinderAutomation.js";

const router = Router();

// Ensure DB is initialized (and migrations run)
initDb();

// Mount automation routes
router.use(automationRouter);

// GET /results - Fetch all businesses
router.get("/results", (req, res) => {
    try {
        // Return all businesses sorted by score
        // Return all businesses sorted by score
        const businesses = getBusinessesForExport({
            minRating: 0,
            minReviews: 0,
            operationalOnly: false,
            requireWebsite: false,
            requireEmail: false
        });
        res.json(businesses);
    } catch (error) {
        console.error("[LeadFinder] Failed to fetch results:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET /status - Fetch agent stats
router.get("/status", (req, res) => {
    try {
        const stats = getRunStats();
        res.json({
            total: stats.total,
            enriched: stats.enriched,
            emails_found: stats.emailsFound
        });
    } catch (error) {
        console.error("[LeadFinder] Failed to fetch status:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST /run - Trigger the agent
router.post("/run", async (req, res) => {
    try {
        const { instruction } = req.body;
        if (!instruction) return res.status(400).json({ error: "Instruction required" });

        console.log(`[LeadFinder] Received instruction: ${instruction}`);

        // Initialize agent
        const agent = new LeadFinderAgent();

        // Run in background so request doesn't timeout
        (async () => {
            try {
                console.log("[LeadFinder] Starting background agent run...");
                await agent.run(instruction);
                console.log("[LeadFinder] Background agent run complete.");
            } catch (e) {
                console.error("[LeadFinder] Background agent run failed:", e);
            }
        })();

        res.json({ success: true, message: "Agent started" });

    } catch (error) {
        console.error("[LeadFinder] Failed to start agent:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


// DELETE /:placeId - Delete a lead
router.delete("/:placeId", (req, res) => {
    try {
        const { placeId } = req.params;
        if (!placeId) return res.status(400).json({ error: "Place ID required" });

        console.log(`[LeadFinder] Deleting business: ${placeId}`);
        deleteBusiness(placeId);
        res.json({ success: true });
    } catch (error) {
        console.error("[LeadFinder] Failed to delete business:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// PUT /:placeId/contact - Update contact info
router.put("/:placeId/contact", (req, res) => {
    try {
        const { placeId } = req.params;
        const { email, context } = req.body;

        if (!placeId) return res.status(400).json({ error: "Place ID required" });
        if (!email) return res.status(400).json({ error: "Email required" });

        // Lazy import to avoid circular dependency issues if any, though unlikely here
        // We need to import updateBusinessContact. 
        // Since I can't easily change imports at the top without reading the whole file again and potentially messing line numbers if I am not careful, 
        // I will rely on the fact that I will add the import at the top in a separate step or just use require if needed, 
        // but cleaner to add import.
        // Actually, I should add the import at the top first. 
        // But I'm in a replace_file_content.
        // I'll assume I can add the import in a separate call or just chain them.
        // Let's use the tool properly. I'll add the route here, then add the import.

        // Imported at top level
        // const { updateBusinessContact, markBusinessAsMigrated } = require("../Lead Agent/src/database/db");

        console.log(`[LeadFinder] Updating contact for ${placeId}: ${email}`);
        updateBusinessContact(placeId, { email, context });

        res.json({ success: true });
    } catch (error) {
        console.error("[LeadFinder] Failed to update contact:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST /:placeId/deep-search - Force Stage 3 (ScrapingBee)
router.post("/:placeId/deep-search", async (req, res) => {
    try {
        const { placeId } = req.params;
        if (!placeId) return res.status(400).json({ error: "Place ID required" });

        // 1. Get business from SQLite
        const businesses = getBusinessesForExport({
            minRating: 0,
            minReviews: 0,
            operationalOnly: false,
            requireWebsite: false,
            requireEmail: false
        });
        const business = businesses.find(b => b.googlePlaceId === placeId);

        if (!business) {
            return res.status(404).json({ error: "Business not found" });
        }

        if (!business.website) {
            return res.status(400).json({ error: "Business has no website to scrape" });
        }

        console.log(`[LeadFinder] Deep Search (Forced) for: ${business.name}`);

        // 2. Import findEmail dynamically to ensure it's available
        const { findEmail } = await import("../Lead Agent/src/scrapers/emailFinder");
        const { validateEmail, assessPecrEligibility } = await import("../Lead Agent/src/enrichers/emailValidator");
        const { upsertBusiness } = await import("../Lead Agent/src/database/db");
        const { computeLeadScore, PECRStatus } = await import("../Lead Agent/src/models/business");


        // 3. Run Scraper with Force Flag = true
        const result = await findEmail(business.website, business.contactName, true);

        if (result) {
            const { valid } = await validateEmail(result.email);

            // Upsert the new email
            const updated = { ...business };
            if (valid) {
                updated.email = result.email;
                updated.emailConfidence = result.confidence;
                updated.emailValidated = true;
            }
            // Re-assess PECR and Score
            // @ts-ignore
            updated.pecrStatus = assessPecrEligibility(updated);
            updated.leadScore = computeLeadScore(updated);
            updated.enrichedAt = new Date();

            upsertBusiness(updated);

            res.json({ success: true, business: updated });
        } else {
            res.json({ success: false, message: "No email found even with Deep Search" });
        }

    } catch (error) {
        console.error("[LeadFinder] Deep Search failed:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST /migrate/:placeId - Migrate to God Mode CRM
router.post("/migrate/:placeId", async (req, res) => {
    try {
        const { placeId } = req.params;
        if (!placeId) return res.status(400).json({ error: "Place ID required" });

        // 1. Get business from SQLite
        const businesses = getBusinessesForExport({
            minRating: 0,
            minReviews: 0,
            operationalOnly: false,
            requireWebsite: false,
            requireEmail: false
        });
        const business = businesses.find(b => b.googlePlaceId === placeId);

        if (!business) {
            return res.status(404).json({ error: "Business not found" });
        }

        console.log(`[LeadFinder] Migrating business: ${business.name} -> CRM`);

        // 2. Map to InternalLead schema
        const internalLeadData = {
            companyName: toTitleCase(business.name),
            companyNumber: business.companyNumber || "unknown",
            contactName: business.contactName ? toTitleCase(business.contactName) : "Unknown",
            position: business.contactRole ? toTitleCase(business.contactRole) : "Director",
            email: business.email || undefined,
            phone: business.phone || undefined,
            status: "new",
            commissionRate: 0.1,
            notes: `Imported from Lead Finder Agent.\nSource Query: ${business.searchQuery}\nConfidence: ${business.emailConfidence}\nActive Charges: ${business.activeChargeCount}\nLenders: ${business.lenderNames?.join(', ') || 'N/A'}`,

            // Rich Data
            address: business.address || undefined,
            city: business.address ? toTitleCase(business.address.split(",").slice(-2)[0].trim()) : undefined,
            hasCharges: business.hasCharges || false,
            identifiedLender: business.lenderNames && business.lenderNames.length > 0 ? business.lenderNames[0] : undefined,
            activeChargeCount: business.activeChargeCount || 0,
            chargeDate: business.lastChargeDate || undefined,
            incorporationDate: business.incorporationDate ? new Date(business.incorporationDate) : undefined,
            sicCode: business.sicCode || undefined,
            linkedinUrl: business.website || undefined,
            createdFrom: "lead_finder_agent",

            contacts: [],

            createdAt: new Date(),
            updatedAt: new Date()
        };

        // 3. Create in Firestore
        // @ts-ignore
        const saved = await storage.createInternalLead(internalLeadData);

        // 4. Mark as migrated
        markBusinessAsMigrated(placeId);

        res.json({ success: true, leadId: saved.id, migrated: true });

    } catch (error) {
        console.error("[LeadFinder] Failed to migrate business:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;

// Helper to Title Case strings
function toTitleCase(str: string) {
    return str.replace(
        /\w\S*/g,
        text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
    );
}
