import { Router } from "express";
import { storage } from "../storage";
import { requireGodMode } from "../utils/godModeAuth";
import { insertInternalLeadSchema, insertCommissionSchema } from "@shared/schema";

const router = Router();

// Protect all CRM routes with God Mode middleware
router.use(requireGodMode);

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
