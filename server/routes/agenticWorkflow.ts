import { Router } from "express";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { storage } from "../storage";
import { agenticWorkflow } from "../services/agenticWorkflow";
import { DelegateError, runDelegate } from "../services/delegate";
import { isNoiseDeal } from "@shared/agenticWorkflow";

const router = Router();

router.post("/api/agentic/scan", isAuthenticated, async (_req, res) => {
  try {
    const result = await agenticWorkflow.startFromDistressScan();
    const rejectedTotal = Object.values(result.rejected).reduce((sum, count) => sum + count, 0);
    res.json({
      opened: result.deals.length,
      deals: result.deals,
      scanned: result.scanned,
      rejected: result.rejected,
      rejectedTotal,
    });
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.get("/api/agentic/deals", isAuthenticated, async (_req, res) => {
  try {
    const deals = (await storage.listAgenticDeals()).filter((deal) => !isNoiseDeal(deal));
    res.json(deals);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

// User edits to the Strategy tab's live blueprint (renamed/moved/added/deleted
// nodes and edges) — opaque to the server, just a JSON blob keyed per-install.
const FACTORY_GRAPH_OVERRIDES_KEY = "factory_graph_overrides";

router.get("/api/agentic/factory-graph-overrides", isAuthenticated, async (_req, res) => {
  try {
    const overrides = await storage.getSystemSetting(FACTORY_GRAPH_OVERRIDES_KEY);
    res.json(overrides || null);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.put("/api/agentic/factory-graph-overrides", isAuthenticated, async (req, res) => {
  try {
    const saved = await storage.updateSystemSetting(FACTORY_GRAPH_OVERRIDES_KEY, req.body, (req.user as any)?.id);
    res.json(saved);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.delete("/api/agentic/deals/:id", isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deal = await storage.getAgenticDeal(id);
    if (!deal) return res.status(404).json({ error: "Deal file not found" });
    await storage.deleteAgenticDeal(id);
    res.json({ ok: true });
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.get("/api/agentic/deals/:id", isAuthenticated, async (req, res) => {
  try {
    const deal = await storage.getAgenticDeal(parseInt(req.params.id));
    if (!deal) return res.status(404).json({ error: "Deal file not found" });
    res.json(deal);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.post("/api/agentic/deals/:id/select-company", isAuthenticated, async (req, res) => {
  try {
    const companyNumber = String(req.body?.companyNumber || "");
    if (!companyNumber) return res.status(400).json({ error: "companyNumber required" });
    res.json(await agenticWorkflow.selectCompany(parseInt(req.params.id), companyNumber));
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.post("/api/agentic/deals/:id/human", isAuthenticated, async (req, res) => {
  try {
    const action = req.body?.action as
      | "call_done"
      | "approve_sterling"
      | "stop"
      | "linkedin_posted"
      | "retry_send";
    if (!["call_done", "approve_sterling", "stop", "linkedin_posted", "retry_send"].includes(action)) {
      return res.status(400).json({ error: "Invalid action" });
    }
    res.json(await agenticWorkflow.resolveHuman(parseInt(req.params.id), action, req.body?.note));
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.post("/api/agentic/delegate", isAuthenticated, async (req, res) => {
  try {
    const result = await runDelegate({
      agentId: req.body?.agentId,
      jobId: req.body?.jobId,
      dealId: req.body?.dealId == null ? undefined : Number(req.body.dealId),
      note: req.body?.note,
    });
    res.json(result);
  } catch (error) {
    if (error instanceof DelegateError) {
      return res.status(error.status).json({ error: error.message });
    }
    handleApiError(res, error, "api-error");
  }
});

router.post("/api/agentic/deals/:id/find-contact", isAuthenticated, async (req, res) => {
  try {
    const deal = await storage.getAgenticDeal(parseInt(req.params.id));
    if (!deal) return res.status(404).json({ error: "Deal file not found" });
    res.json(await agenticWorkflow.completeContactAndSync(deal));
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.post("/api/agentic/deals/:id/bbb", isAuthenticated, async (req, res) => {
  try {
    const answers = req.body?.answers;
    if (!answers || typeof answers !== "object") {
      return res.status(400).json({ error: "answers required" });
    }
    res.json(await agenticWorkflow.confirmBbb(parseInt(req.params.id), answers));
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.post("/api/agentic/deals/:id/tick", isAuthenticated, async (req, res) => {
  try {
    const deal = await storage.getAgenticDeal(parseInt(req.params.id));
    if (!deal) return res.status(404).json({ error: "Deal file not found" });
    if (deal.stage === "fulfilment") {
      return res.json(await agenticWorkflow.runFulfilment(deal));
    }
    res.json(deal);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

export default router;
