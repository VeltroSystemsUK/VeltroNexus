import { Router } from "express";
import { LeadFinderAgent } from "../Lead Agent/src/agent";
import { getRunStats, deleteBusiness, clearAllBusinesses, getBusinessesForExport, initDb, updateBusinessContact, markBusinessAsMigrated } from "../Lead Agent/src/database/db";
import { resolve } from "path";

const BROKER_DB_PATH = process.env['BROKER_DATABASE_PATH'] ?? resolve("./broker_finder.db");
import { storage } from "../storage";
import { insertBrokerLeadSchema } from "@shared/schema";
import { isAuthenticated } from "../auth";

const router = Router();

// Ensure DB is initialized (its own file, isolated from lead_finder.db by path alone)
initDb(BROKER_DB_PATH);
router.use(isAuthenticated);

// GET /results - Fetch all broker prospects
router.get("/results", (req, res) => {
    try {
        const businesses = getBusinessesForExport({
            minRating: 0,
            minReviews: 0,
            operationalOnly: false,
            requireWebsite: false,
            requireEmail: false
        }, BROKER_DB_PATH);
        res.json(businesses);
    } catch (error) {
        console.error("[BrokerFinder] Failed to fetch results:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.get("/status", (req, res) => {
    try {
        const stats = getRunStats(undefined, BROKER_DB_PATH);
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

        const agent = new LeadFinderAgent(undefined, BROKER_DB_PATH);

        (async () => {
            try {
                console.log("[BrokerFinder] Starting background agent run (broker_finder.db)...");
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

// POST /enrich/all - Enrich all unenriched businesses with a website
let bulkEnrichRunning = false;

router.post("/enrich/all", async (req, res) => {
    try {
        if (bulkEnrichRunning) {
            return res.status(409).json({ error: "Bulk enrichment already running", queued: 0 });
        }

        const businesses = getBusinessesForExport({ minRating: 0, minReviews: 0, operationalOnly: false, requireWebsite: true, requireEmail: false }, BROKER_DB_PATH);
        const unenriched = businesses.filter(b => !b.enrichedAt && b.website);

        bulkEnrichRunning = true;
        res.json({ success: true, queued: unenriched.length, message: `Enrichment started for ${unenriched.length} brokers` });

        // Run in background — don't await
        (async () => {
            const { findEmail } = await import("../Lead Agent/src/scrapers/emailFinder");
            const { validateEmail, assessPecrEligibility } = await import("../Lead Agent/src/enrichers/emailValidator");
            const { upsertBusiness } = await import("../Lead Agent/src/database/db");
            const { computeLeadScore } = await import("../Lead Agent/src/models/business");

            for (const business of unenriched) {
                try {
                    const result = await findEmail(business.website!, business.contactName, true);
                    const updated = { ...business };
                    if (result) {
                        const { valid } = await validateEmail(result.email);
                        if (valid) {
                            updated.email = result.email;
                            updated.emailConfidence = result.confidence;
                            updated.emailValidated = true;
                        }
                    }
                    // @ts-ignore
                    updated.pecrStatus = assessPecrEligibility(updated);
                    updated.leadScore = computeLeadScore(updated);
                    updated.enrichedAt = new Date();
                    upsertBusiness(updated, BROKER_DB_PATH);
                } catch (e) {
                    console.error(`[BrokerFinder] Bulk enrich failed for ${business.name}:`, e);
                }
            }
            console.log(`[BrokerFinder] Bulk enrichment complete for ${unenriched.length} brokers`);
        })().finally(() => { bulkEnrichRunning = false; });

    } catch (error) {
        bulkEnrichRunning = false;
        console.error("[BrokerFinder] Bulk enrich failed:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST /enrich/:placeId - Scrape website for email + validate + rescore
router.post("/enrich/:placeId", async (req, res) => {
    try {
        const { placeId } = req.params;
        if (!placeId) return res.status(400).json({ error: "Place ID required" });

        const businesses = getBusinessesForExport({ minRating: 0, minReviews: 0, operationalOnly: false, requireWebsite: false, requireEmail: false }, BROKER_DB_PATH);
        const business = businesses.find(b => b.googlePlaceId === placeId);

        if (!business) return res.status(404).json({ error: "Business not found" });
        if (!business.website) return res.status(400).json({ error: "No website to scrape" });

        const { findEmail } = await import("../Lead Agent/src/scrapers/emailFinder");
        const { validateEmail, assessPecrEligibility } = await import("../Lead Agent/src/enrichers/emailValidator");
        const { upsertBusiness } = await import("../Lead Agent/src/database/db");
        const { computeLeadScore } = await import("../Lead Agent/src/models/business");

        const result = await findEmail(business.website, business.contactName, true);
        const updated = { ...business };

        if (result) {
            const { valid } = await validateEmail(result.email);
            if (valid) {
                updated.email = result.email;
                updated.emailConfidence = result.confidence;
                updated.emailValidated = true;
            }
        }

        // @ts-ignore
        updated.pecrStatus = assessPecrEligibility(updated);
        updated.leadScore = computeLeadScore(updated);
        updated.enrichedAt = new Date();

        upsertBusiness(updated, BROKER_DB_PATH);
        res.json({ success: true, business: updated });

    } catch (error) {
        console.error("[BrokerFinder] Enrich failed:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.delete("/all", (req, res) => {
    try {
        clearAllBusinesses(BROKER_DB_PATH);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.delete("/:placeId", (req, res) => {
    try {
        const { placeId } = req.params;
        if (!placeId) return res.status(400).json({ error: "Place ID required" });
        deleteBusiness(placeId, BROKER_DB_PATH);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post("/migrate/:placeId", async (req, res) => {
    try {
        const { placeId } = req.params;
        if (!placeId) return res.status(400).json({ error: "Place ID required" });

        const businesses = getBusinessesForExport({ minRating: 0, minReviews: 0, operationalOnly: false, requireWebsite: false, requireEmail: false }, BROKER_DB_PATH);
        const business = businesses.find(b => b.googlePlaceId === placeId);

        if (!business) {
            return res.status(404).json({ error: "Business not found" });
        }

        console.log(`[BrokerFinder] Migrating business: ${business.name} -> Broker CRM`);

        // Check for duplicates by company number
        let existingLead = null;
        if (business.companyNumber && business.companyNumber !== "unknown") {
            existingLead = await storage.getBrokerLeadByCompanyNumber(business.companyNumber);
            if (existingLead) {
                console.log(`[BrokerFinder] Duplicate detected: ${business.name} matches existing broker #${existingLead.id} (${existingLead.companyName})`);
            }
        }

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

            // Duplicate flagging
            possibleDuplicate: !!existingLead,
            duplicateOf: existingLead ? existingLead.id : null,
        };

        const saved = await storage.createBrokerLead(brokerLeadData);
        markBusinessAsMigrated(placeId, BROKER_DB_PATH);

        res.json({ success: true, leadId: saved.id, migrated: true, duplicate: !!existingLead, existingLeadId: existingLead?.id });

    } catch (error) {
        console.error("[BrokerFinder] Failed to migrate business:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;

function toTitleCase(str: string) {
    return str.replace(/\w\S*/g, text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase());
}
