import { Router } from "express";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { listAgentMail, recordInbound, recordOpen, recordClick } from "../services/agentMailLog";
import { pollImapInbox } from "../services/imapInbox";
import { mailboxList } from "@shared/agentMailboxes";
import { shouldRecordMailTracking } from "@shared/mailTracking";
import { sendTrackingPixel } from "../utils/trackingPixel";

const router = Router();

router.get("/api/agent-mail", isAuthenticated, async (_req, res) => {
  try {
    res.json({ mailboxes: mailboxList(), messages: listAgentMail(300) });
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.post("/api/agent-mail/sync", isAuthenticated, async (_req, res) => {
  try {
    res.json(await pollImapInbox());
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.post("/api/agent-mail/inbound", async (req, res) => {
  try {
    const secret = process.env.MAIL_WEBHOOK_SECRET;
    const provided = String(req.header("x-mail-secret") || req.body?.secret || "");
    if (!secret || provided !== secret) {
      return res.status(401).json({ error: "Unauthorized inbound webhook" });
    }
    const from = String(req.body?.from || "");
    const to = String(req.body?.to || "");
    if (!from || !to) return res.status(400).json({ error: "from and to required" });
    const item = await recordInbound({
      from,
      to,
      subject: req.body?.subject,
      text: req.body?.text,
      html: req.body?.html,
      messageId: req.body?.messageId,
    });
    res.json(item);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

// --- Open/click tracking: hit directly by the recipient's mail client, no auth ---
// (the message id is an unguessable UUID, same trust model as the inbound webhook secret)

router.get("/api/agent-mail/track/:id.gif", (req, res) => {
  try {
    const staff = typeof req.isAuthenticated === "function" && req.isAuthenticated();
    if (shouldRecordMailTracking({ staffSession: staff, referer: req.get("referer") || req.get("referrer") })) {
      recordOpen(req.params.id);
    }
  } catch (error) {
    console.error("[AgentMail] Open tracking error:", error);
  }
  sendTrackingPixel(res);
});

router.get("/api/agent-mail/click/:id", (req, res) => {
  const url = String(req.query.url || "");
  const safe = /^https?:\/\//i.test(url);
  try {
    const staff = typeof req.isAuthenticated === "function" && req.isAuthenticated();
    if (
      safe &&
      shouldRecordMailTracking({ staffSession: staff, referer: req.get("referer") || req.get("referrer") })
    ) {
      recordClick(req.params.id, url);
    }
  } catch (error) {
    console.error("[AgentMail] Click tracking error:", error);
  }
  res.redirect(302, safe ? url : "/");
});

export default router;
