import { Router } from "express";
import { storage } from "../storage";
import { handleApiError } from "../utils/errorHandler";
import { requireGodMode } from "../utils/godModeAuth";
import { insertBrokerLeadSchema, insertBrokerCommissionSchema } from "@shared/schema";
import { emailVerificationService } from "../services/emailVerificationService";
import { enrichLead } from "../services/leadEnrichmentService";
import { classifyProspectStream } from "@shared/salesOs";

const router = Router();

// Protect all Broker routes with God Mode middleware
router.use(requireGodMode);

// --- Broker Discovery ---
router.post("/discover", async (req, res) => {
    try {
        const { town, sicCodes, autoEnrich } = req.body;

        if (!town && (!sicCodes || (Array.isArray(sicCodes) && sicCodes.length === 0))) {
            return res.status(400).json({ error: "Either town or sicCodes is required" });
        }

        console.log(`[Broker Agent] Starting dynamic discovery. Town: ${town || 'Any'}, SIC: ${sicCodes || 'Any'}, Auto-Enrich: ${!!autoEnrich}`);
        const { databaseBuilderService } = await import("../services/databaseBuilder");

        // Prepare discovery target
        const target: any = {};
        if (town) target.location = town.trim();
        if (sicCodes) {
            target.sicCodes = Array.isArray(sicCodes) ? sicCodes : [sicCodes];
        }

        // Fire and forget - discovery runs in background
        // Passing 'broker' as the type to databaseBuilderService (will update service next)
        const userId = (req.user as any)?.id;
        databaseBuilderService.runDiscoveryLoop([target], {
            autoEnrich: !!autoEnrich,
            userId: userId,
            leadType: 'broker'
        });

        res.json({
            success: true,
            message: `Broker lead collection started for ${town || target.sicCodes.join(",")}`
        });
    } catch (error) {
        handleApiError(res, error, "Broker Discovery error");
    }
});

// --- Sweep: pull introducer-shaped companies out of the main pipeline ---
// Catches whatever was already misrouted before the classifier was wired into
// discovery — a one-off cleanup, not something run on a schedule.
router.post("/sweep-introducers", async (req, res) => {
    try {
        const userId = (req.user as any)?.id;
        let movedFromLeads = 0;
        let movedFromPipeline = 0;

        const internalLeads = await storage.listInternalLeads();
        for (const lead of internalLeads) {
            const decision = classifyProspectStream({
                companyName: lead.companyName,
                sicCodes: lead.sicCode ? [lead.sicCode] : [],
            });
            if (decision.stream !== "introducer") continue;

            const existing = lead.companyNumber
                ? await storage.getBrokerLeadByCompanyNumber(lead.companyNumber)
                : undefined;
            if (!existing) {
                await storage.createBrokerLead({
                    companyName: lead.companyName,
                    companyNumber: lead.companyNumber,
                    contactName: lead.contactName,
                    email: lead.email,
                    phone: lead.phone,
                    status: "new",
                    address: lead.address,
                    city: lead.city,
                    hasCharges: lead.hasCharges,
                    totalChargesCount: lead.totalChargesCount,
                    satisfiedChargesCount: lead.satisfiedChargesCount,
                    sicCode: lead.sicCode,
                    contacts: lead.contacts,
                    commissionRate: lead.commissionRate,
                    possibleDuplicate: false,
                    notes: `${lead.notes || ""}\n\nSwept from the main leads pipeline — reclassified as an introducer (${decision.reason}).`.trim(),
                });
            }
            await storage.deleteInternalLead(lead.id);
            movedFromLeads++;
        }

        // Only sweep prospects still at the bare "lead" stage — anything further
        // along already has a human working the file, so leave it alone.
        if (userId) {
            const prospects = await storage.listProspects(userId, "lead");
            for (const prospect of prospects) {
                if (!prospect.id) continue;
                const decision = classifyProspectStream({
                    companyName: prospect.company.companyName,
                    sicCodes: prospect.company.sicCode ? [prospect.company.sicCode] : [],
                });
                if (decision.stream !== "introducer") continue;

                const existing = prospect.company.companyNumber
                    ? await storage.getBrokerLeadByCompanyNumber(prospect.company.companyNumber)
                    : undefined;
                if (!existing) {
                    await storage.createBrokerLead({
                        companyName: prospect.company.companyName,
                        companyNumber: prospect.company.companyNumber,
                        status: "new",
                        address: prospect.company.registeredAddress || undefined,
                        sicCode: prospect.company.sicCode || undefined,
                        contacts: [],
                        commissionRate: 0.1,
                        hasCharges: false,
                        totalChargesCount: 0,
                        satisfiedChargesCount: 0,
                        possibleDuplicate: false,
                        notes: `Swept from the main pipeline (prospect #${prospect.id}) — reclassified as an introducer (${decision.reason}).`,
                    });
                }
                await storage.deleteProspect(prospect.id, userId);
                movedFromPipeline++;
            }
        }

        res.json({ success: true, movedFromLeads, movedFromPipeline });
    } catch (error) {
        handleApiError(res, error, "Sweep introducers failed");
    }
});

router.delete("/leads/clear-all", async (req, res) => {
    try {
        await storage.clearAllBrokerLeads();
        res.json({ success: true, message: "All broker leads cleared from database" });
    } catch (error) {
        console.error("[Brokers] Clear all leads failed:", error);
        res.status(500).json({ error: "Failed to clear broker leads" });
    }
});

// --- Leads ---
router.get("/leads", async (req, res) => {
    try {
        const leads = await storage.listBrokerLeads();
        res.json(leads);
    } catch (error) {
        console.error("Brokers: Failed to fetch leads", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post("/leads", async (req, res) => {
    try {
        const data = insertBrokerLeadSchema.parse(req.body);
        const lead = await storage.createBrokerLead(data);
        res.json(lead);
    } catch (error) {
        res.status(400).json({ error: "Invalid data" });
    }
});

router.put("/leads/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const lead = await storage.updateBrokerLead(id, req.body);
        if (!lead) return res.status(404).json({ error: "Lead not found" });
        res.json(lead);
    } catch (error) {
        res.status(500).json({ error: "Update failed" });
    }
});

router.delete("/leads/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await storage.deleteBrokerLead(id);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: "Delete failed" });
    }
});

router.post("/leads/:id/verify-email", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const lead = await storage.getBrokerLead(id);
        if (!lead) return res.status(404).json({ error: "Lead not found" });

        const email = lead.email;
        if (!email) {
            // If no email, try enrichment immediately
            console.log(`[Broker CRM] No email for ${lead.companyName}, triggering enrichment...`);
            const enrichment = await enrichLead(lead as any);
            if (enrichment.emails && enrichment.emails.length > 0) {
                const newEmail = enrichment.emails[0];
                const updatedLead = await storage.updateBrokerLead(id, { email: newEmail });
                return res.json({ 
                    status: "enriched", 
                    email: newEmail,
                    lead: updatedLead,
                    message: "New email found through research" 
                });
            }
            return res.status(400).json({ error: "No email address found to verify" });
        }

        console.log(`[Broker CRM] Verifying email for ${lead.companyName}: ${email}`);
        const verification = await emailVerificationService.verifyEmail(email);

        if (!verification) {
            return res.status(500).json({ error: "Email verification service unavailable" });
        }

        if (verification.status === "valid") {
            return res.json({ status: "valid", verification });
        }

        // If invalid or catch-all/unknown, try enrichment fallback
        console.log(`[Broker CRM] Verification ${verification.status} for ${email}, triggering enrichment fallback...`);
        const enrichment = await enrichLead(lead as any);
        
        if (enrichment.emails && enrichment.emails.length > 0) {
            const newEmail = enrichment.emails[0];
            if (newEmail !== email) {
                const updatedLead = await storage.updateBrokerLead(id, { email: newEmail });
                return res.json({ 
                    status: "enriched", 
                    email: newEmail,
                    lead: updatedLead,
                    originalVerification: verification,
                    message: `Verification failed (${verification.status}), found alternative: ${newEmail}` 
                });
            }
        }

        res.json({ 
            status: verification.status, 
            verification,
            message: `Verification ${verification.status}. No alternative found.` 
        });

    } catch (error) {
        handleApiError(res, error, "Email verification failed");
    }
});

// --- Commissions ---
router.get("/commissions", async (req, res) => {
    try {
        const commissions = await storage.listBrokerCommissions();
        res.json(commissions);
    } catch (error) {
        res.status(500).json({ error: "Fetch failed" });
    }
});

router.get("/commissions/agent/:agentId", async (req, res) => {
    try {
        const commissions = await storage.getBrokerAgentCommissions(req.params.agentId);
        res.json(commissions);
    } catch (error) {
        res.status(500).json({ error: "Fetch failed" });
    }
});

router.post("/commissions", async (req, res) => {
    try {
        const data = insertBrokerCommissionSchema.parse(req.body);
        const commission = await storage.createBrokerCommission(data);
        res.json(commission);
    } catch (error) {
        res.status(400).json({ error: "Invalid data" });
    }
});

router.put("/commissions/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const commission = await storage.updateBrokerCommission(id, req.body);
        if (!commission) return res.status(404).json({ error: "Commission not found" });
        res.json(commission);
    } catch (error) {
        res.status(500).json({ error: "Update failed" });
    }
});

export default router;
