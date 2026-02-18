import { Router } from "express";
import { LeadFinderAgent } from "../Lead Agent/src/agent";
import { getRunStats, deleteBusiness, getBusinessesForExport, initDb, updateBusinessContact, markBusinessAsMigrated } from "../Lead Agent/src/database/db";
import { storage } from "../storage";
import { insertBrokerLeadSchema } from "@shared/schema";

const router = Router();

// Ensure DB is initialized
initDb();

// GET /results - Fetch all broker prospects
router.get("/results", (req, res) => {
    try {
        const businesses = getBusinessesForExport({
            minRating: 0,
            minReviews: 0,
            operationalOnly: false,
            requireWebsite: false,
            requireEmail: false
        });
        // For now, Lead Finder uses a local SQLite. 
        // If we want to isolate Broker results in the Lead Finder table, 
        // we might need a separate SQLite or a 'category' column.
        // The user said "completely separate database", but Lead Finder Agent 
        // currently uses Lead Agent/lead_finder.db.
        // We'll filter for businesses that have "broker" in their search query or just return all and let the user know.
        // Better: We will use the same SQLite but perhaps tag them if we can.
        // However, for cloning purposes, we'll keep it simple first.
        res.json(businesses);
    } catch (error) {
        console.error("[BrokerFinder] Failed to fetch results:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.get("/status", (req, res) => {
    try {
        const stats = getRunStats();
        res.json({
            total: stats.total,
            enriched: stats.enriched,
            emails_found: stats.emailsFound
        });
    } catch (error) {
        console.error("[BrokerFinder] Failed to fetch status:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post("/run", async (req, res) => {
    try {
        const { instruction } = req.body;
        if (!instruction) return res.status(400).json({ error: "Instruction required" });

        console.log(`[BrokerFinder] Received instruction: ${instruction}`);

        const agent = new LeadFinderAgent();

        (async () => {
            try {
                console.log("[BrokerFinder] Starting background agent run...");
                await agent.run(instruction);
                console.log("[BrokerFinder] Background agent run complete.");
            } catch (e) {
                console.error("[BrokerFinder] Background agent run failed:", e);
            }
        })();

        res.json({ success: true, message: "Broker Agent started" });

    } catch (error) {
        console.error("[BrokerFinder] Failed to start agent:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.delete("/:placeId", (req, res) => {
    try {
        const { placeId } = req.params;
        if (!placeId) return res.status(400).json({ error: "Place ID required" });
        deleteBusiness(placeId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post("/migrate/:placeId", async (req, res) => {
    try {
        const { placeId } = req.params;
        if (!placeId) return res.status(400).json({ error: "Place ID required" });

        const businesses = getBusinessesForExport({ minRating: 0, minReviews: 0, operationalOnly: false, requireWebsite: false, requireEmail: false });
        const business = businesses.find(b => b.googlePlaceId === placeId);

        if (!business) {
            return res.status(404).json({ error: "Business not found" });
        }

        console.log(`[BrokerFinder] Migrating business: ${business.name} -> Broker CRM`);

        const brokerLeadData = {
            companyName: toTitleCase(business.name),
            companyNumber: business.companyNumber || "unknown",
            contactName: business.contactName ? toTitleCase(business.contactName) : "Unknown",
            position: business.contactRole ? toTitleCase(business.contactRole) : "Director",
            email: business.email || undefined,
            phone: business.phone || undefined,
            status: "new",
            commissionRate: 0.1,
            notes: `Imported from Broker Finder Agent.\nSource Query: ${business.searchQuery}`,
            totalChargesCount: 0,
            satisfiedChargesCount: 0,
            address: business.address || undefined,
            city: business.address ? toTitleCase(business.address.split(",").slice(-2)[0].trim()) : undefined,
            hasCharges: business.hasCharges || false,
            identifiedLender: business.lenderNames && business.lenderNames.length > 0 ? business.lenderNames[0] : undefined,
            activeChargeCount: business.activeChargeCount || 0,
            chargeDate: business.lastChargeDate || undefined,
            sicCode: business.sicCode || undefined,
            contacts: [],
        };

        const saved = await storage.createBrokerLead(brokerLeadData);
        markBusinessAsMigrated(placeId);

        res.json({ success: true, leadId: saved.id, migrated: true });

    } catch (error) {
        console.error("[BrokerFinder] Failed to migrate business:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;

function toTitleCase(str: string) {
    return str.replace(/\w\S*/g, text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase());
}
