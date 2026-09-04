import { Router } from "express";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { getAgentMail, listAgentMail, recordInbound, recordOpen, recordClick } from "../services/agentMailLog";
import { sendEmail } from "../services/email";
import { maybeSendSmeOpenFollowUp } from "../services/smeOpenFollowUp";
import { pollImapInbox } from "../services/imapInbox";
import { mailboxForAgent, mailboxList } from "@shared/agentMailboxes";
import { shouldRecordMailTracking } from "@shared/mailTracking";
import { escapeHtml, htmlEmail, signatureHtml } from "@shared/strataOutreach";
import { sendTrackingPixel } from "../utils/trackingPixel";

function replyHtml(bodyText: string, agentId: string | undefined, original: { from: string; text: string; createdAt: string }): string {
  const mailbox = mailboxForAgent(agentId);
  const bodyLines = bodyText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const quoteLines = (original.text || "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const quoteDate = new Date(original.createdAt).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" });
  const quoteHtml = quoteLines.length
    ? `<p style="margin:24px 0 8px 0;font-size:13px;color:#6B7280;font-family:Arial,Helvetica,sans-serif;">On ${quoteDate}, ${escapeHtml(original.from)} wrote:</p>
<blockquote style="margin:0;padding:2px 0 2px 14px;border-left:3px solid #D1D5DB;color:#4B5563;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;">
${htmlEmail(quoteLines)}
</blockquote>`
    : "";
  return `${htmlEmail(bodyLines)}\n${signatureHtml(mailbox)}\n${quoteHtml}`.trim();
}

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

router.post("/api/agent-mail/:id/reply", isAuthenticated, async (req, res) => {
  try {
    const original = getAgentMail(req.params.id);
    if (!original) return res.status(404).json({ error: "Message not found" });

    const body = String(req.body?.text || "").trim();
    if (!body) return res.status(400).json({ error: "Reply text is required" });

    const to = original.direction === "inbound" ? original.from : original.to;
    const subject = /^re:/i.test(original.subject) ? original.subject : `Re: ${original.subject}`;
    const agentId = original.agentId || "mailbox-clerk";
    const html = replyHtml(body, agentId, original);

    const result = await sendEmail(
      {
        agentId,
        dealId: original.dealId,
        prospectId: original.prospectId,
        inReplyTo: original.messageId,
      },
      to,
      subject,
      html,
    );
    res.json(result);
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
    const { processAgentInbox } = await import("../services/mailDesk");
    await processAgentInbox();
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
      const item = recordOpen(req.params.id);
      if (item) {
        void maybeSendSmeOpenFollowUp(item).catch((error) => {
          console.error("[AgentMail] sme_open follow-up error:", error);
        });
      }
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
