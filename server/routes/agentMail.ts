import { Router } from "express";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { listAgentMail, recordInbound } from "../services/agentMailLog";
import { mailboxList } from "@shared/agentMailboxes";

const router = Router();

router.get("/api/agent-mail", isAuthenticated, async (_req, res) => {
  try {
    res.json({ mailboxes: mailboxList(), messages: listAgentMail(300) });
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

export default router;
