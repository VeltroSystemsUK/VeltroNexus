import { Router } from "express";
import { LeadFinderAgent } from "../Lead Agent/src/agent";
import { getRunStats, deleteBusiness, clearAllBusinesses, getBusinessesForExport, getBusinessByPlaceId, initDb, updateBusinessContact, markBusinessAsMigrated } from "../Lead Agent/src/database/db";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import automationRouter from "./leadFinderAutomation.js";

const router = Router();

initDb();
router.use(isAuthenticated);
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


// DELETE /all - Wipe all leads
router.delete("/all", (req, res) => {
    try {
        clearAllBusinesses();
        res.json({ success: true });
    } catch (error) {
        console.error("[LeadFinder] Failed to clear all businesses:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST /enrich/all - Bulk enrich all unenriched leads with a website
router.post("/enrich/all", async (req, res) => {
    try {
        const businesses = getBusinessesForExport({ minRating: 0, minReviews: 0, operationalOnly: false, requireWebsite: true, requireEmail: false });
        const unenriched = businesses.filter(b => !b.enrichedAt && b.website);

        res.json({ success: true, queued: unenriched.length, message: `Enrichment started for ${unenriched.length} leads` });

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
                    upsertBusiness(updated);
                } catch (e) {
                    console.error(`[LeadFinder] Bulk enrich failed for ${business.name}:`, e);
                }
            }
            console.log(`[LeadFinder] Bulk enrichment complete for ${unenriched.length} leads`);
        })();

    } catch (error) {
        console.error("[LeadFinder] Bulk enrich failed:", error);
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

        const business = getBusinessByPlaceId(placeId);
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

router.post("/migrate/:placeId", async (req, res) => {
    try {
        const { placeId } = req.params;
        if (!placeId) return res.status(400).json({ error: "Place ID required" });
        const userId = req.user!.id;

        const business = getBusinessByPlaceId(placeId);
        if (!business) {
            return res.status(404).json({ error: "Business not found" });
        }

        console.log(`[LeadFinder] Migrating business: ${business.name} -> Pipeline`);

        const companyNumber = business.companyNumber && business.companyNumber !== "unknown" ? business.companyNumber : null;
        let company = companyNumber ? await storage.getCompanyByNumber(companyNumber) : undefined;

        let existingProspect = null;
        if (company) {
            const userProspects = await storage.listProspects(userId);
            existingProspect = userProspects.find(p => p.companyId === company!.id) || null;
            if (existingProspect) {
                console.log(`[LeadFinder] Duplicate detected: ${business.name} matches existing prospect #${existingProspect.id}`);
            }
        }

        if (!company) {
            company = await storage.createCompany({
                companyName: toTitleCase(business.name),
                companyNumber: companyNumber || `unknown-${placeId}`,
                registeredAddress: business.address || null,
                incorporationDate: business.incorporationDate || null,
                companyStatus: null,
                companyType: null,
                sicCode: business.sicCode || null,
            });
        }

        let prospect: any = existingProspect;
        if (!prospect) {
            prospect = await storage.createProspect(
                {
                    companyId: company.id!,
                    stage: "lead",
                    queueOrder: 0,
                    directorsGuarantee: 0,
                    commercialProperty: 0,
                    homeEquity: 0,
                    propertyOther: 0,
                    debenture: 0,
                    parentCompanyGuarantee: 0,
                    collateral: 0,
                    crossCompanyGuarantee: 0,
                    referralSource: "Lead Finder Agent",
                    notes: `Imported from Lead Finder Agent.\nSource Query: ${business.searchQuery}\nContact: ${business.contactName ? toTitleCase(business.contactName) : "Unknown"}${business.contactRole ? ` (${toTitleCase(business.contactRole)})` : ""}\nEmail: ${business.email || "N/A"} (Confidence: ${business.emailConfidence || "N/A"})\nPhone: ${business.phone || "N/A"}\nActive Charges: ${business.activeChargeCount || 0}\nLenders: ${business.lenderNames?.join(', ') || 'N/A'}`,
                },
                userId
            );

            if (business.contactName || business.email || business.phone) {
                await storage.createContact({
                    prospectId: prospect.id,
                    name: toTitleCase(business.contactName || business.name),
                    email: business.email || null,
                    phone: business.phone || null,
                    role: business.contactRole ? toTitleCase(business.contactRole) : null,
                    isPrimary: 1,
                }, userId);
            }
        }

        markBusinessAsMigrated(placeId);

        res.json({ success: true, prospectId: prospect.id, migrated: true, duplicate: !!existingProspect, existingProspectId: existingProspect?.id });

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
