import { Router } from "express";
import crypto from "crypto";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { storage } from "../storage";
import { gmailHeader, gmailListQuery } from "@shared/gmail";
import {
  GmailConfigError,
  GmailNotConnectedError,
  createOAuthClient,
  disconnectGmail,
  gmailAuthUrl,
  gmailClientForUser,
  gmailOAuthConfigured,
  gmailRedirectUri,
  saveGmailTokens,
} from "../services/gmailAuth";

const router = Router();

function userId(req: { user?: { id?: string } }): string {
  const id = req.user?.id;
  if (!id) throw new Error("Not authenticated");
  return id;
}

function summarize(message: { id?: string | null; threadId?: string | null; snippet?: string | null; labelIds?: string[] | null; payload?: { headers?: Array<{ name?: string | null; value?: string | null }> } }) {
  const headers = message.payload?.headers;
  return {
    id: message.id,
    threadId: message.threadId,
    snippet: message.snippet || "",
    from: gmailHeader(headers, "From"),
    subject: gmailHeader(headers, "Subject"),
    date: gmailHeader(headers, "Date"),
    unread: (message.labelIds || []).includes("UNREAD"),
    labelIds: message.labelIds || [],
  };
}

router.get("/api/gmail/status", isAuthenticated, async (req, res) => {
  try {
    const user = await storage.getUser(userId(req));
    res.json({
      configured: gmailOAuthConfigured(),
      connected: Boolean(user?.googleConnected && user.googleAccessToken),
      email: user?.googleEmail || null,
      redirectUri: gmailRedirectUri(req),
    });
  } catch (error) {
    handleApiError(res, error, "gmail-status");
  }
});

router.get("/api/gmail/connect", isAuthenticated, (req, res) => {
  try {
    const state = crypto.randomBytes(16).toString("hex");
    (req.session as any).gmailOAuthState = state;
    (req.session as any).gmailOAuthUserId = userId(req);
    res.redirect(gmailAuthUrl(state, req));
  } catch (error) {
    if (error instanceof GmailConfigError) {
      return res.status(503).json({ error: error.message });
    }
    handleApiError(res, error, "gmail-connect");
  }
});

router.get("/api/gmail/callback", async (req, res) => {
  try {
    const expected = (req.session as any)?.gmailOAuthState;
    const owner = (req.session as any)?.gmailOAuthUserId || (req.user as { id?: string } | undefined)?.id;
    if (!owner) return res.redirect("/gmail?error=not_logged_in");
    if (!expected || req.query.state !== expected) return res.redirect("/gmail?error=oauth_state");
    const code = String(req.query.code || "");
    if (!code) return res.redirect("/gmail?error=missing_code");
    const client = createOAuthClient(req);
    await saveGmailTokens(owner, client, code);
    delete (req.session as any).gmailOAuthState;
    res.redirect("/gmail?connected=1");
  } catch (error) {
    console.error("[Gmail] OAuth callback failed:", error);
    res.redirect("/gmail?error=oauth_failed");
  }
});

router.post("/api/gmail/disconnect", isAuthenticated, async (req, res) => {
  try {
    await disconnectGmail(userId(req));
    res.json({ ok: true });
  } catch (error) {
    handleApiError(res, error, "gmail-disconnect");
  }
});

router.get("/api/gmail/labels", isAuthenticated, async (req, res) => {
  try {
    const gmail = await gmailClientForUser(userId(req));
    const response = await gmail.users.labels.list({ userId: "me" });
    res.json({ labels: response.data.labels || [] });
  } catch (error) {
    if (error instanceof GmailNotConnectedError) return res.status(401).json({ error: error.message });
    handleApiError(res, error, "gmail-labels");
  }
});

router.post("/api/gmail/labels", isAuthenticated, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "name required" });
    const gmail = await gmailClientForUser(userId(req));
    const response = await gmail.users.labels.create({
      userId: "me",
      requestBody: { name },
    });
    res.json(response.data);
  } catch (error) {
    if (error instanceof GmailNotConnectedError) return res.status(401).json({ error: error.message });
    handleApiError(res, error, "gmail-label-create");
  }
});

router.delete("/api/gmail/labels/:id", isAuthenticated, async (req, res) => {
  try {
    const gmail = await gmailClientForUser(userId(req));
    await gmail.users.labels.delete({ userId: "me", id: req.params.id });
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof GmailNotConnectedError) return res.status(401).json({ error: error.message });
    handleApiError(res, error, "gmail-label-delete");
  }
});

router.get("/api/gmail/messages", isAuthenticated, async (req, res) => {
  try {
    const gmail = await gmailClientForUser(userId(req));
    const q = gmailListQuery(String(req.query.folder || "inbox"), String(req.query.q || ""));
    const listed = await gmail.users.messages.list({
      userId: "me",
      q,
      maxResults: 40,
    });
    const ids = listed.data.messages || [];
    const messages = [];
    for (const item of ids) {
      if (!item.id) continue;
      const full = await gmail.users.messages.get({
        userId: "me",
        id: item.id,
        format: "metadata",
        metadataHeaders: ["From", "To", "Subject", "Date"],
      });
      messages.push(summarize(full.data));
    }
    res.json({ messages });
  } catch (error) {
    if (error instanceof GmailNotConnectedError) return res.status(401).json({ error: error.message });
    handleApiError(res, error, "gmail-messages");
  }
});

router.get("/api/gmail/message/:id", isAuthenticated, async (req, res) => {
  try {
    const gmail = await gmailClientForUser(userId(req));
    const full = await gmail.users.messages.get({ userId: "me", id: req.params.id, format: "full" });
    res.json({ message: full.data });
  } catch (error) {
    if (error instanceof GmailNotConnectedError) return res.status(401).json({ error: error.message });
    handleApiError(res, error, "gmail-message");
  }
});

router.get("/api/gmail/message/:id/attachment/:attachmentId", isAuthenticated, async (req, res) => {
  try {
    const gmail = await gmailClientForUser(userId(req));
    const file = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId: req.params.id,
      id: req.params.attachmentId,
    });
    const raw = String(file.data.data || "").replace(/-/g, "+").replace(/_/g, "/");
    const buffer = Buffer.from(raw, "base64");
    const filename = String(req.query.filename || "attachment").replace(/["\r\n]/g, "");
    const mime = String(req.query.mimeType || "application/octet-stream");
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    if (error instanceof GmailNotConnectedError) return res.status(401).json({ error: error.message });
    handleApiError(res, error, "gmail-attachment");
  }
});

router.post("/api/gmail/message/:id/modify", isAuthenticated, async (req, res) => {
  try {
    const gmail = await gmailClientForUser(userId(req));
    const response = await gmail.users.messages.modify({
      userId: "me",
      id: req.params.id,
      requestBody: {
        addLabelIds: req.body?.addLabelIds || [],
        removeLabelIds: req.body?.removeLabelIds || [],
      },
    });
    res.json(response.data);
  } catch (error) {
    if (error instanceof GmailNotConnectedError) return res.status(401).json({ error: error.message });
    handleApiError(res, error, "gmail-modify");
  }
});

router.post("/api/gmail/message/:id/trash", isAuthenticated, async (req, res) => {
  try {
    const gmail = await gmailClientForUser(userId(req));
    await gmail.users.messages.trash({ userId: "me", id: req.params.id });
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof GmailNotConnectedError) return res.status(401).json({ error: error.message });
    handleApiError(res, error, "gmail-trash");
  }
});

router.post("/api/gmail/message/:id/untrash", isAuthenticated, async (req, res) => {
  try {
    const gmail = await gmailClientForUser(userId(req));
    await gmail.users.messages.untrash({ userId: "me", id: req.params.id });
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof GmailNotConnectedError) return res.status(401).json({ error: error.message });
    handleApiError(res, error, "gmail-untrash");
  }
});

router.post("/api/gmail/messages/batch-trash", isAuthenticated, async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    const gmail = await gmailClientForUser(userId(req));
    for (const id of ids) {
      await gmail.users.messages.trash({ userId: "me", id });
    }
    res.json({ ok: true, count: ids.length });
  } catch (error) {
    if (error instanceof GmailNotConnectedError) return res.status(401).json({ error: error.message });
    handleApiError(res, error, "gmail-batch-trash");
  }
});

router.get("/api/gmail/settings", isAuthenticated, async (req, res) => {
  try {
    const gmail = await gmailClientForUser(userId(req));
    const profile = await gmail.users.getProfile({ userId: "me" });
    const email = profile.data.emailAddress || "";
    const [sendAs, vacation] = await Promise.all([
      email
        ? gmail.users.settings.sendAs.get({ userId: "me", sendAsEmail: email })
        : Promise.resolve({ data: { signature: "" } }),
      gmail.users.settings.getVacation({ userId: "me" }),
    ]);
    res.json({
      signature: sendAs.data.signature || "",
      vacationResponder: {
        enableVacationResponse: Boolean(vacation.data.enableAutoReply),
        responseSubject: vacation.data.responseSubject || "",
        responseBodyHtml: vacation.data.responseBodyHtml || "",
      },
    });
  } catch (error) {
    if (error instanceof GmailNotConnectedError) return res.status(401).json({ error: error.message });
    handleApiError(res, error, "gmail-settings");
  }
});

router.post("/api/gmail/settings/signature", isAuthenticated, async (req, res) => {
  try {
    const gmail = await gmailClientForUser(userId(req));
    const profile = await gmail.users.getProfile({ userId: "me" });
    const email = profile.data.emailAddress;
    if (!email) return res.status(400).json({ error: "No Gmail address on profile" });
    await gmail.users.settings.sendAs.patch({
      userId: "me",
      sendAsEmail: email,
      requestBody: { signature: String(req.body?.signature || "") },
    });
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof GmailNotConnectedError) return res.status(401).json({ error: error.message });
    handleApiError(res, error, "gmail-signature");
  }
});

router.post("/api/gmail/settings/vacation", isAuthenticated, async (req, res) => {
  try {
    const gmail = await gmailClientForUser(userId(req));
    await gmail.users.settings.updateVacation({
      userId: "me",
      requestBody: {
        enableAutoReply: Boolean(req.body?.enableVacationResponse),
        responseSubject: String(req.body?.responseSubject || ""),
        responseBodyHtml: String(req.body?.responseBodyHtml || ""),
      },
    });
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof GmailNotConnectedError) return res.status(401).json({ error: error.message });
    handleApiError(res, error, "gmail-vacation");
  }
});

function encodeRawMessage(input: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  attachments?: Array<{ filename: string; content: string; contentType?: string }>;
}): string {
  const boundary = `nexus_${crypto.randomBytes(8).toString("hex")}`;
  const headers = [
    `To: ${input.to}`,
    input.cc ? `Cc: ${input.cc}` : "",
    input.bcc ? `Bcc: ${input.bcc}` : "",
    `Subject: ${input.subject || ""}`,
    "MIME-Version: 1.0",
  ].filter(Boolean);
  const html = String(input.body || "");
  const attachments = input.attachments || [];
  if (!attachments.length) {
    const raw = [...headers, "Content-Type: text/html; charset=utf-8", "", html].join("\r\n");
    return Buffer.from(raw).toString("base64url");
  }
  const parts = [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "",
    html,
  ];
  for (const file of attachments) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${file.contentType || "application/octet-stream"}; name="${file.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${file.filename}"`,
      "",
      file.content
    );
  }
  parts.push(`--${boundary}--`);
  return Buffer.from(parts.join("\r\n")).toString("base64url");
}

router.post("/api/gmail/send", isAuthenticated, async (req, res) => {
  try {
    const to = String(req.body?.to || "").trim();
    if (!to) return res.status(400).json({ error: "to required" });
    const gmail = await gmailClientForUser(userId(req));
    const raw = encodeRawMessage({
      to,
      cc: req.body?.cc,
      bcc: req.body?.bcc,
      subject: String(req.body?.subject || ""),
      body: String(req.body?.body || ""),
      attachments: req.body?.attachments,
    });
    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw, threadId: req.body?.threadId || undefined },
    });
    res.json({ id: response.data.id });
  } catch (error) {
    if (error instanceof GmailNotConnectedError) return res.status(401).json({ error: error.message });
    handleApiError(res, error, "gmail-send");
  }
});

router.post("/api/gmail/draft", isAuthenticated, async (req, res) => {
  try {
    const gmail = await gmailClientForUser(userId(req));
    const raw = encodeRawMessage({
      to: String(req.body?.to || ""),
      cc: req.body?.cc,
      bcc: req.body?.bcc,
      subject: String(req.body?.subject || ""),
      body: String(req.body?.body || ""),
    });
    const response = await gmail.users.drafts.create({
      userId: "me",
      requestBody: { message: { raw, threadId: req.body?.threadId || undefined } },
    });
    res.json({ id: response.data.id });
  } catch (error) {
    if (error instanceof GmailNotConnectedError) return res.status(401).json({ error: error.message });
    handleApiError(res, error, "gmail-draft");
  }
});

export default router;
