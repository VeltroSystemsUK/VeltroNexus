import { Router } from "express";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { storage } from "../storage";
import { agenticWorkflow } from "../services/agenticWorkflow";
import { DelegateError, runDelegate } from "../services/delegate";
import { isNoiseDeal } from "@shared/agenticWorkflow";
import { dealChargeHolders } from "@shared/chargeClassifier";
import { lendersByCompanyNumber, lendersForCompany } from "../services/leadFinderPool";
import { cadenceFor, type SalesStream } from "@shared/salesOs";
import { mailboxForAgent } from "@shared/agentMailboxes";
import {
  applyOutreachTemplateOverride,
  EDITABLE_OUTREACH_TOUCHES,
  editableOutreachBody,
  renderOutreachEmail,
  type OutreachTemplateOverride,
} from "@shared/strataOutreach";

const router = Router();

const OUTREACH_TEMPLATES_KEY = "agent_outreach_templates";
const TEMPLATE_PREVIEW_DEAL = {
  companyName: "Example Engineering Ltd",
  contactName: "Alex Director",
  fitReasons: ["high-cost alternative debt"],
  fitSummary: "Example preview deal",
  uploadToken: "preview-token",
  loanAmount: 150000,
  stream: "sme" as const,
  source: "distress_scan" as const,
};

function templateStream(touchId: string): SalesStream {
  if (touchId.startsWith("inbound")) return "inbound";
  if (touchId.startsWith("intro")) return "introducer";
  return "sme";
}

function editablePreview(value: string): string {
  return value
    .replace(/https?:\/\/[^\s<]+\/pack\/preview-token/gi, "{{uploadUrl}}")
    .replace(/Example Engineering Ltd/g, "{{company}}")
    .replace(/Alex Director/g, "{{firstName}}")
    .replace(/Alex/g, "{{firstName}}");
}

router.get("/api/agentic/outreach-templates", isAuthenticated, async (_req, res) => {
  try {
    const overrides = (await storage.getSystemSetting(OUTREACH_TEMPLATES_KEY)) || {};
    const templates = EDITABLE_OUTREACH_TOUCHES.map((touchId) => {
      const stream = templateStream(touchId);
      const step = cadenceFor(stream).find((item) => item.touchId === touchId);
      const mailbox = mailboxForAgent(stream === "inbound" ? "inbound-intake" : "outreach-sales");
      const builtIn = renderOutreachEmail(TEMPLATE_PREVIEW_DEAL, touchId, mailbox);
      const candidate = overrides[touchId] as OutreachTemplateOverride | undefined;
      const override = candidate && !/preview-token|\/pack\/preview-token/i.test(`${candidate.subject || ""} ${candidate.body || ""}`)
        ? candidate
        : undefined;
      const effective = applyOutreachTemplateOverride(builtIn, override, TEMPLATE_PREVIEW_DEAL, mailbox);
      return {
        id: touchId,
        stream,
        day: touchId === "sme_followup" ? 2 : step?.day ?? 0,
        channel: step?.channel ?? "email",
        job: step?.job || builtIn.purpose,
        defaultTemplate: { subject: editablePreview(builtIn.subject), body: editablePreview(editableOutreachBody(builtIn, mailbox)), purpose: builtIn.purpose },
        override: override || null,
        effective: { subject: effective.subject, body: effective.text, purpose: effective.purpose },
      };
    });
    res.json({ templates, placeholders: ["{{firstName}}", "{{company}}", "{{facility}}", "{{uploadUrl}}"] });
  } catch (error) {
    handleApiError(res, error, "outreach-templates");
  }
});

router.put("/api/agentic/outreach-templates/:id", isAuthenticated, async (req, res) => {
  try {
    const id = req.params.id;
    if (!EDITABLE_OUTREACH_TOUCHES.includes(id as any)) return res.status(404).json({ error: "Unknown outreach template" });
    const body = req.body || {};
    if (typeof body.subject !== "string" || typeof body.body !== "string") {
      return res.status(400).json({ error: "subject and body are required" });
    }
    if (!body.subject.trim() || !body.body.trim()) return res.status(400).json({ error: "subject and body cannot be empty" });
    if (/preview-token|\/pack\/preview-token/i.test(`${body.subject} ${body.body}`)) {
      return res.status(400).json({ error: "Preview upload links cannot be saved. Use {{uploadUrl}} instead." });
    }
    if (body.subject.length > 240 || body.body.length > 20000 || String(body.purpose || "").length > 500) {
      return res.status(400).json({ error: "Template is too long" });
    }
    const current = (await storage.getSystemSetting(OUTREACH_TEMPLATES_KEY)) || {};
    const next = {
      ...current,
      [id]: {
        subject: body.subject.trim(),
        body: body.body.trim(),
        purpose: typeof body.purpose === "string" ? body.purpose.trim() : undefined,
      } satisfies OutreachTemplateOverride,
    };
    await storage.updateSystemSetting(OUTREACH_TEMPLATES_KEY, next, (req.user as any)?.id);
    res.json({ id, override: next[id] });
  } catch (error) {
    handleApiError(res, error, "outreach-template-update");
  }
});

router.delete("/api/agentic/outreach-templates/:id", isAuthenticated, async (req, res) => {
  try {
    const id = req.params.id;
    if (!EDITABLE_OUTREACH_TOUCHES.includes(id as any)) return res.status(404).json({ error: "Unknown outreach template" });
    const current = (await storage.getSystemSetting(OUTREACH_TEMPLATES_KEY)) || {};
    const { [id]: _removed, ...rest } = current;
    await storage.updateSystemSetting(OUTREACH_TEMPLATES_KEY, rest, (req.user as any)?.id);
    res.json({ ok: true });
  } catch (error) {
    handleApiError(res, error, "outreach-template-reset");
  }
});

router.get("/api/agentic/quality", isAuthenticated, async (_req, res) => {
  try {
    res.json(await agenticWorkflow.getHuntQuality());
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.post("/api/agentic/quarantine/:id/keep", isAuthenticated, async (req, res) => {
  try {
    res.json(await agenticWorkflow.keepQuarantine(parseInt(req.params.id), req.body || {}));
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.delete("/api/agentic/quarantine/:id", isAuthenticated, async (req, res) => {
  try {
    await agenticWorkflow.deleteQuarantine(parseInt(req.params.id));
    res.json({ ok: true });
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.post("/api/agentic/quarantine/purge", isAuthenticated, async (_req, res) => {
  try {
    res.json(await agenticWorkflow.purgeQuarantine());
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.post("/api/agentic/harvest/csv", isAuthenticated, async (req, res) => {
  try {
    const fileName = String(req.body?.fileName || "").trim();
    const csvData = String(req.body?.csvData || "");
    if (!fileName || !csvData) {
      return res.status(400).json({ error: "fileName and csvData are required" });
    }
    if (csvData.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: "CSV file too large. Maximum size is 5MB." });
    }
    res.json(await agenticWorkflow.ingestHarvestCsv(csvData, fileName));
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.post("/api/agentic/scan", isAuthenticated, async (_req, res) => {
  try {
    void agenticWorkflow.startFromDistressScan(undefined, "sme").catch((error) => {
      console.error("[Agentic] Background SME hunt failed:", error);
    });
    const result = await agenticWorkflow.startSmeOutreachBatch();
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

router.post("/api/agentic/outreach/approve-queue", isAuthenticated, async (_req, res) => {
  try {
    res.json(await agenticWorkflow.approveSmeQueue());
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.get("/api/agentic/deals", isAuthenticated, async (_req, res) => {
  try {
    const deals = (await storage.listAgenticDeals()).filter((deal) => !isNoiseDeal(deal));
    const holderIndex = lendersByCompanyNumber();
    res.json(
      deals.map((deal) => ({
        ...deal,
        chargeHolders: dealChargeHolders(deal, lendersForCompany(deal.companyNumber, holderIndex)),
      }))
    );
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
      | "retry_send"
      | "approve_send";
    if (!["call_done", "approve_sterling", "stop", "linkedin_posted", "retry_send", "approve_send"].includes(action)) {
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
      userId: (req.user as any)?.id,
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
