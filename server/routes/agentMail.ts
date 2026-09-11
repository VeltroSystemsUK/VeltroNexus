import fs from "fs";
import { Router } from "express";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { getAgentMail, listAgentMail, recordInbound, recordOpen, recordClick, recordDwell, trackingBaseUrl } from "../services/agentMailLog";
import { resolveMailAttachmentFile } from "../services/agentMailAttachments";
import { sendEmail } from "../services/email";
import { maybeSendSmeOpenFollowUp } from "../services/smeOpenFollowUp";
import { pollImapInbox } from "../services/imapInbox";
import { knownMailbox, mailboxList, resolveSendAsMailbox } from "@shared/agentMailboxes";
import { mailDwellScript, shouldRecordMailTracking, withMailDwellToken } from "@shared/mailTracking";
import { composeAgentMailHtml, composeAgentReplyHtml } from "@shared/strataOutreach";
import { sendTrackingPixel } from "../utils/trackingPixel";
import { encodeContentDisposition } from "../utils/security";

const router = Router();

router.get("/api/agent-mail", isAuthenticated, async (_req, res) => {
  try {
    const { processAgentInbox } = await import("../services/mailDesk");
    await processAgentInbox();
    res.json({ mailboxes: mailboxList(), messages: listAgentMail(5000) });
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

router.get("/api/agent-mail/:id/attachments/:index", isAuthenticated, async (req, res) => {
  try {
    const item = getAgentMail(req.params.id);
    if (!item) return res.status(404).json({ error: "Message not found" });
    const index = Number.parseInt(String(req.params.index), 10);
    if (!Number.isInteger(index) || index < 0) return res.status(400).json({ error: "Invalid attachment" });
    const file = (item.attachments || []).find((row) => row.index === index);
    if (!file) return res.status(404).json({ error: "Attachment not found" });
    const disk = resolveMailAttachmentFile(item.id, file.storedName);
    if (!disk || !fs.existsSync(disk)) return res.status(404).json({ error: "Attachment file missing" });
    res.setHeader("Content-Type", file.contentType || "application/octet-stream");
    res.setHeader("Content-Disposition", encodeContentDisposition(file.filename));
    res.sendFile(disk);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.post("/api/agent-mail/compose", isAuthenticated, async (req, res) => {
  try {
    const to = String(req.body?.to || "").trim();
    const subject = String(req.body?.subject || "").trim();
    const body = String(req.body?.text || "").trim();
    if (!to || !subject || !body) {
      return res.status(400).json({ error: "To, subject and message are required" });
    }
    const mailbox = resolveSendAsMailbox(req.body?.agentId, "mailbox-clerk");
    const html = composeAgentMailHtml(body, mailbox);
    const result = await sendEmail({ agentId: mailbox.agentId }, to, subject, html);
    if (result.blocked) {
      return res.status(400).json({ error: "That address is on the do-not-contact list." });
    }
    res.json(result);
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
    const fallback = knownMailbox(original.agentId) ? original.agentId! : "mailbox-clerk";
    const mailbox = resolveSendAsMailbox(req.body?.agentId, fallback);
    const html = composeAgentReplyHtml(body, mailbox, original);

    const result = await sendEmail(
      {
        agentId: mailbox.agentId,
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
    try {
      const { classifyInboundMail } = await import("@shared/mailDesk");
      const { convertReasonFromInboundKind } = await import("@shared/openers");
      const { stopConvertAndPromote } = await import("../services/openers");
      const reason = convertReasonFromInboundKind(
        classifyInboundMail({
          from: item.from,
          to: item.to,
          subject: item.subject,
          text: item.text,
          html: item.html,
        }).kind
      );
      if (reason) await stopConvertAndPromote(item.from, reason);
    } catch (error) {
      console.warn("[AgentMail] convert stop failed:", error);
    }
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
  res.redirect(302, safe ? withMailDwellToken(url, req.params.id) : "/");
});

router.get("/api/agent-mail/dwell.js", (_req, res) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(mailDwellScript(trackingBaseUrl()));
});

router.get("/api/agent-mail/dwell/:id.gif", (req, res) => {
  try {
    const staff = typeof req.isAuthenticated === "function" && req.isAuthenticated();
    if (shouldRecordMailTracking({ staffSession: staff, referer: req.get("referer") || req.get("referrer") })) {
      recordDwell(req.params.id, {
        path: String(req.query.p || ""),
        sf: String(req.query.sf || ""),
      });
    }
  } catch (error) {
    console.error("[AgentMail] Dwell tracking error:", error);
  }
  sendTrackingPixel(res);
});

export default router;
