import { Router } from "express";
import { storage, MOCK_DEV_ADMIN_ID } from "../storage";
import { handleApiError } from "../utils/errorHandler";
import { requireGodMode } from "../utils/godModeAuth";
import { insertInternalLeadSchema, insertCommissionSchema } from "@shared/schema";
import { promoteInternalLeadToPipeline } from "../services/inboundPipeline";

const router = Router();

// Protect all CRM routes with God Mode middleware
router.use(requireGodMode);


// --- Agent A: Lead Collection (Dynamic Discovery) ---

router.post("/discover", async (req, res) => {
    try {
        const { town, sicCodes, autoEnrich } = req.body;

        if (!town && (!sicCodes || (Array.isArray(sicCodes) && sicCodes.length === 0))) {
            return res.status(400).json({ error: "Either town or sicCodes is required" });
        }

        console.log(`[CRM Agent A] Starting dynamic discovery. Town: ${town || 'Any'}, SIC: ${sicCodes || 'Any'}, Auto-Enrich: ${!!autoEnrich}`);
        const { databaseBuilderService } = await import("../services/databaseBuilder");

        // Prepare discovery target
        const target: any = {};
        if (town) target.location = town.trim();
        if (sicCodes) {
            target.sicCodes = Array.isArray(sicCodes) ? sicCodes : [sicCodes];
        }

        // Fire and forget - discovery runs in background
        const userId = (req.user as any)?.id;
        databaseBuilderService.runDiscoveryLoop([target], {
            autoEnrich: !!autoEnrich,
            userId: userId
        });

        res.json({
            success: true,
            message: `Lead collection started for ${town || target.sicCodes.join(",")}`
        });
    } catch (error) {
        handleApiError(res, error, "CRM Discovery error");
    }
});

router.delete("/leads/clear-all", async (req, res) => {
    try {
        await storage.clearAllInternalLeads();
        res.json({ success: true, message: "All leads cleared from database" });
    } catch (error) {
        console.error("[CRM] Clear all leads failed:", error);
        res.status(500).json({ error: "Failed to clear leads" });
    }
});

// --- Agent B: Lead Enrichment ---

// Enrich single lead
router.post("/enrich/:id", async (req, res) => {
    try {
        const leadId = parseInt(req.params.id);
        if (isNaN(leadId)) return res.status(400).json({ error: "Invalid lead ID" });

        const lead = await storage.getInternalLead(leadId);
        if (!lead) return res.status(404).json({ error: "Lead not found" });

        console.log(`[CRM Agent B] Starting enrichment for lead ${leadId}`);
        const { enrichLead } = await import("../services/leadEnrichmentService");

        const enrichmentResult = await enrichLead(lead);

        // Update lead with enriched data
        await storage.updateInternalLead(leadId, {
            email: enrichmentResult.emails[0],
            phone: enrichmentResult.phones[0],
            contacts: enrichmentResult.contacts.length > 0
                ? enrichmentResult.contacts
                : lead.contacts || [],
            chargeStatus: enrichmentResult.chargeStatus,
            totalChargesCount: enrichmentResult.totalChargesCount,
            satisfiedChargesCount: enrichmentResult.satisfiedChargesCount,
            identifiedLender: enrichmentResult.identifiedLender,
            chargeDate: enrichmentResult.chargeDate,
            notes: lead.notes
                ? `${lead.notes}\n\n[Agent B Enrichment]\nStatus: ${enrichmentResult.chargeStatus?.toUpperCase()} (${enrichmentResult.satisfiedChargesCount}/${enrichmentResult.totalChargesCount} satisfied)\n${enrichmentResult.businessOverview || 'No overview available'}`
                : `[Agent B Enrichment]\nStatus: ${enrichmentResult.chargeStatus?.toUpperCase()} (${enrichmentResult.satisfiedChargesCount}/${enrichmentResult.totalChargesCount} satisfied)\n${enrichmentResult.businessOverview || 'No overview available'}`
        });

        res.json({
            success: true,
            enrichmentResult,
            message: `Found ${enrichmentResult.emails.length} emails, ${enrichmentResult.phones.length} phones`
        });
    } catch (error) {
        handleApiError(res, error, "Lead enrichment error");
    }
});

// Bulk enrichment
router.post("/enrich-bulk", async (req, res) => {
    try {
        const { leadIds } = req.body;

        if (!Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({ error: "leadIds array is required" });
        }

        console.log(`[CRM Agent B] Starting bulk enrichment for ${leadIds.length} leads`);
        const { enrichLeadsInBackground } = await import("../services/leadEnrichmentService");

        // Fire and forget - enrichment runs in background
        const userId = (req.user as any)?.id;
        enrichLeadsInBackground(leadIds, userId);

        res.json({
            success: true,
            message: `Enrichment started for ${leadIds.length} leads`
        });
    } catch (error) {
        handleApiError(res, error, "Bulk enrichment error");
    }
});

// --- Contact Finder ---

// Find contacts for a single lead
router.post("/find-contacts/:id", async (req, res) => {
    try {
        const leadId = parseInt(req.params.id);
        if (isNaN(leadId)) return res.status(400).json({ error: "Invalid lead ID" });

        const lead = await storage.getInternalLead(leadId);
        if (!lead) return res.status(404).json({ error: "Lead not found" });

        console.log(`[CRM] Starting contact discovery for lead ${leadId} (${lead.companyName})`);
        const { findContacts } = await import("../services/contactFinderService");

        const contacts = await findContacts(lead);

        // Update lead with found contacts
        const contactsForSchema = contacts.map((c) => ({
            name: c.name,
            role: c.role,
            email: c.email,
            phone: c.phone,
            linkedinUrl: c.linkedinUrl,
        }));

        const bestContact = contacts.find((c) => c.email) || contacts[0];

        await storage.updateInternalLead(leadId, {
            contacts: contactsForSchema.length > 0 ? contactsForSchema : lead.contacts || [],
            contactName: bestContact?.name || lead.contactName,
            email: bestContact?.email || lead.email,
            phone: bestContact?.phone || lead.phone,
            linkedinUrl: bestContact?.linkedinUrl || lead.linkedinUrl,
        });

        res.json({
            success: true,
            contacts,
            message: `Found ${contacts.length} contacts (${contacts.filter((c) => c.email).length} with email)`,
        });
    } catch (error) {
        handleApiError(res, error, "Contact finder error");
    }
});

// Bulk contact discovery
router.post("/find-contacts-bulk", async (req, res) => {
    try {
        const { leadIds } = req.body;

        if (!Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({ error: "leadIds array is required" });
        }

        console.log(`[CRM] Starting bulk contact discovery for ${leadIds.length} leads`);
        const { findContactsBulk } = await import("../services/contactFinderService");

        const userId = (req.user as any)?.id;
        findContactsBulk(leadIds, userId);

        res.json({
            success: true,
            message: `Contact discovery started for ${leadIds.length} leads`,
        });
    } catch (error) {
        handleApiError(res, error, "Bulk contact finder error");
    }
});

// --- Leads ---

router.get("/leads", async (req, res) => {
    try {
        const leads = await storage.listInternalLeads();
        res.json(leads);
    } catch (error) {
        console.error("CRM: Failed to fetch leads", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post("/leads", async (req, res) => {
    try {
        const data = insertInternalLeadSchema.parse(req.body);
        const lead = await storage.createInternalLead(data);
        res.json(lead);
    } catch (error) {
        res.status(400).json({ error: "Invalid data" });
    }
});

router.put("/leads/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const lead = await storage.updateInternalLead(id, req.body);
        if (!lead) return res.status(404).json({ error: "Lead not found" });
        res.json(lead);
    } catch (error) {
        res.status(500).json({ error: "Update failed" });
    }
});

router.delete("/leads/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await storage.deleteInternalLead(id);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: "Delete failed" });
    }
});

router.post("/leads/:id/promote", async (req, res) => {
    try {
        const leadId = parseInt(req.params.id);
        const lead = await storage.getInternalLead(leadId);
        if (!lead) return res.status(404).json({ error: "Lead not found" });
        if (!lead.companyNumber) return res.status(400).json({ error: "Lead missing company number" });

        const ownerUserId = (req.user as any)?.id;
        const { prospectId } = await promoteInternalLeadToPipeline(lead, ownerUserId);
        res.json({ success: true, prospectId });
    } catch (error) {
        handleApiError(res, error, "Lead promotion failed");
    }
});

// --- Commissions ---

router.get("/commissions", async (req, res) => {
    try {
        const commissions = await storage.listCommissions();
        res.json(commissions);
    } catch (error) {
        res.status(500).json({ error: "Fetch failed" });
    }
});

router.get("/commissions/agent/:agentId", async (req, res) => {
    try {
        const commissions = await storage.getAgentCommissions(req.params.agentId);
        res.json(commissions);
    } catch (error) {
        res.status(500).json({ error: "Fetch failed" });
    }
});

router.post("/commissions", async (req, res) => {
    try {
        const data = insertCommissionSchema.parse(req.body);
        const commission = await storage.createCommission(data);
        res.json(commission);
    } catch (error) {
        res.status(400).json({ error: "Invalid data" });
    }
});

router.put("/commissions/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const commission = await storage.updateCommission(id, req.body);
        if (!commission) return res.status(404).json({ error: "Commission not found" });
        res.json(commission);
    } catch (error) {
        res.status(500).json({ error: "Update failed" });
    }
});

export default router;
