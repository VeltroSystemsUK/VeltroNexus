/**
 * Gmail API Routes
 * Proxy for Gmail integration using Super Admin's account
 */

import { Router } from "express";
import { isAuthenticated } from "../auth.js";
import { storage } from "../storage.js";
import { google } from "googleapis";

const router = Router();

/**
 * Get Gmail auth client for super admin
 */
async function getSuperAdminGmailAuth() {
    // Get super admin user (try shaun@veltro.co.uk first, then admin@veltro.com)
    let superAdmin = await storage.getUserByEmail("shaun@veltro.co.uk");

    if (!superAdmin) {
        superAdmin = await storage.getUserByEmail("admin@veltro.com");
    }

    if (!superAdmin || !superAdmin.googleAccessToken) {
        console.error("Super Admin Auth Error:", {
            found: !!superAdmin,
            hasToken: !!superAdmin?.googleAccessToken,
            email: superAdmin?.email || "neither shaun nor admin found"
        });
        throw new Error("Super admin Gmail not connected");
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${process.env.APP_URL || ""}/api/auth/google/callback`
    );

    oauth2Client.setCredentials({
        access_token: superAdmin.googleAccessToken || undefined,
        refresh_token: superAdmin.googleRefreshToken || undefined,
        expiry_date: superAdmin.googleTokenExpiry
            ? new Date(superAdmin.googleTokenExpiry).getTime()
            : undefined,
    });

    // Handle token refresh
    oauth2Client.on("tokens", async (tokens) => {
        if (tokens.refresh_token) {
            await storage.updateUser(superAdmin.id, {
                googleRefreshToken: tokens.refresh_token,
            });
        }
        if (tokens.access_token) {
            const expiryDate = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
            await storage.updateUser(superAdmin.id, {
                googleAccessToken: tokens.access_token,
                googleTokenExpiry: expiryDate,
            });
        }
    });

    return oauth2Client;
}

/**
 * GET /api/gmail/messages
 * List emails from inbox/sent/drafts/trash
 */
router.get("/messages", isAuthenticated, async (req, res) => {
    try {
        const { folder = "inbox", maxResults = 50, q: searchApp = "" } = req.query;
        const auth = await getSuperAdminGmailAuth();
        const gmail = google.gmail({ version: "v1", auth });

        const options: any = {
            userId: "me",
            maxResults: parseInt(maxResults as string),
            includeSpamTrash: folder === "trash" || folder === "spam" || !!searchApp,
        };

        // If searchApp is provided, we use q. Otherwise we use labelIds for folders.
        if (searchApp) {
            options.q = searchApp as string;
            // If we are in a specific folder, scope the search
            if (folder === "sent") options.q += " in:sent";
            else if (folder === "drafts") options.q += " in:drafts";
            else if (folder === "trash") options.q += " in:trash";
            else if (folder === "spam") options.q += " in:spam";
            else if (folder && folder !== "inbox") {
                // For custom labels, we might want to still restrict if possible, 
                // but Gmail 'q' doesn't always play nice with label IDs.
                // We'll leave it global for now if it's a search.
            }
        } else {
            if (folder === "sent") options.labelIds = ["SENT"];
            else if (folder === "drafts") options.labelIds = ["DRAFTS"];
            else if (folder === "trash") options.labelIds = ["TRASH"];
            else if (folder === "spam") options.labelIds = ["SPAM"];
            else if (folder === "inbox") options.labelIds = ["INBOX"];
            else if (folder) options.labelIds = [folder as string];
            else options.labelIds = ["INBOX"];
        }

        const response = await gmail.users.messages.list(options);

        const messages = response.data.messages || [];

        // Fetch details for each message
        const detailedMessages = await Promise.all(
            messages.map(async (msg) => {
                const detail = await gmail.users.messages.get({
                    userId: "me",
                    id: msg.id!,
                    format: "metadata",
                    metadataHeaders: ["From", "Subject", "Date"],
                });

                const headers = detail.data.payload?.headers || [];
                const from = headers.find((h) => h.name === "From")?.value || "";
                const subject = headers.find((h) => h.name === "Subject")?.value || "";
                const date = headers.find((h) => h.name === "Date")?.value || "";

                return {
                    id: msg.id,
                    threadId: msg.threadId,
                    snippet: detail.data.snippet || "",
                    from,
                    subject,
                    date,
                    unread: detail.data.labelIds?.includes("UNREAD") || false,
                    labelIds: detail.data.labelIds || [],
                };
            })
        );

        res.json({ messages: detailedMessages });
    } catch (error: any) {
        console.error("Gmail list error:", error);
        res.status(500).json({ error: error.message || "Failed to list messages" });
    }
});

/**
 * GET /api/gmail/message/:id
 * Get single email details
 */
router.get("/message/:id", isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const auth = await getSuperAdminGmailAuth();
        const gmail = google.gmail({ version: "v1", auth });

        const message = await gmail.users.messages.get({
            userId: "me",
            id,
            format: "full",
        });

        res.json({ message: message.data });
    } catch (error: any) {
        console.error("Gmail get message error:", error);
        res.status(500).json({ error: error.message || "Failed to get message" });
    }
});

/**
 * POST /api/gmail/send
 * Send email via Gmail
 */
router.post("/send", isAuthenticated, async (req, res) => {
    try {
        const { to, cc, bcc, subject, body, threadId } = req.body;

        if (!to || !subject || !body) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const auth = await getSuperAdminGmailAuth();
        const gmail = google.gmail({ version: "v1", auth });

        // Build email message
        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
        const messageParts = [
            `To: ${to}`,
            cc ? `Cc: ${cc}` : "",
            bcc ? `Bcc: ${bcc}` : "",
            "Content-Type: text/html; charset=utf-8",
            "MIME-Version: 1.0",
            `Subject: ${utf8Subject}`,
            "",
            body,
        ].filter(Boolean);

        const message = messageParts.join("\n");
        const encodedMessage = Buffer.from(message)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

        const result = await gmail.users.messages.send({
            userId: "me",
            requestBody: {
                raw: encodedMessage,
                threadId: threadId || undefined
            },
        });

        res.json({ success: true, messageId: result.data.id });
    } catch (error: any) {
        console.error("Gmail send error:", error);
        res.status(500).json({ error: error.message || "Failed to send email" });
    }
});

/**
 * POST /api/gmail/draft
 * Create draft
 */
router.post("/draft", isAuthenticated, async (req, res) => {
    try {
        const { to, cc, bcc, subject, body, threadId } = req.body;

        const auth = await getSuperAdminGmailAuth();
        const gmail = google.gmail({ version: "v1", auth });

        // Build email message
        const utf8Subject = `=?utf-8?B?${Buffer.from(subject || "").toString("base64")}?=`;
        const messageParts = [
            `To: ${to || ""}`,
            cc ? `Cc: ${cc}` : "",
            bcc ? `Bcc: ${bcc}` : "",
            "Content-Type: text/html; charset=utf-8",
            "MIME-Version: 1.0",
            `Subject: ${utf8Subject}`,
            "",
            body || "",
        ].filter(Boolean);

        const message = messageParts.join("\n");
        const encodedMessage = Buffer.from(message)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

        const result = await gmail.users.drafts.create({
            userId: "me",
            requestBody: {
                message: {
                    raw: encodedMessage,
                    threadId: threadId || undefined
                },
            },
        });

        res.json({ success: true, draftId: result.data.id });
    } catch (error: any) {
        console.error("Gmail draft error:", error);
        res.status(500).json({ error: error.message || "Failed to create draft" });
    }
});


/**
 * GET /api/gmail/labels
 * List all labels
 */
router.get("/labels", isAuthenticated, async (req, res) => {
    try {
        const auth = await getSuperAdminGmailAuth();
        const gmail = google.gmail({ version: "v1", auth });

        const response = await gmail.users.labels.list({
            userId: "me",
        });

        const labels = response.data.labels || [];
        res.json({ labels });
    } catch (error: any) {
        console.error("Gmail list labels error:", error);
        res.status(500).json({ error: error.message || "Failed to list labels" });
    }
});

/**
 * POST /api/gmail/labels
 * Create new label
 */
router.post("/labels", isAuthenticated, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: "Label name is required" });
        }

        const auth = await getSuperAdminGmailAuth();
        const gmail = google.gmail({ version: "v1", auth });

        const response = await gmail.users.labels.create({
            userId: "me",
            requestBody: {
                name,
                labelListVisibility: "labelShow",
                messageListVisibility: "show",
            },
        });

        res.json({ label: response.data });
    } catch (error: any) {
        console.error("Gmail create label error:", error);
        res.status(500).json({ error: error.message || "Failed to create label" });
    }
});

/**
 * DELETE /api/gmail/labels/:id
 * Delete label
 */
router.delete("/labels/:id", isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const auth = await getSuperAdminGmailAuth();
        const gmail = google.gmail({ version: "v1", auth });

        await gmail.users.labels.delete({
            userId: "me",
            id,
        });

        res.json({ success: true });
    } catch (error: any) {
        console.error("Gmail delete label error:", error);
        res.status(500).json({ error: error.message || "Failed to delete label" });
    }
});

/**
 * POST /api/gmail/message/:id/modify
 * Add/remove labels from a message
 */
router.post("/message/:id/modify", isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { addLabelIds = [], removeLabelIds = [] } = req.body;

        console.log(`[Gmail Server] Modifying message ${id}: add=${JSON.stringify(addLabelIds)}, remove=${JSON.stringify(removeLabelIds)}`);

        const auth = await getSuperAdminGmailAuth();
        const gmail = google.gmail({ version: "v1", auth });

        const result = await gmail.users.messages.modify({
            userId: "me",
            id,
            requestBody: {
                addLabelIds,
                removeLabelIds,
            },
        });

        console.log(`[Gmail Server] Modify successful for ${id}`);
        res.json({ success: true, message: result.data });
    } catch (error: any) {
        console.error("Gmail modify message error:", error);
        res.status(500).json({ error: error.message || "Failed to modify message" });
    }
});

/**
 * POST /api/gmail/messages/batch-trash
 * Bulk move messages to trash
 */
router.post("/messages/batch-trash", isAuthenticated, async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
        return res.status(400).json({ error: "Invalid IDs provided" });
    }

    console.log(`[Gmail Server] Batch trashing ${ids.length} messages`);
    try {
        const auth = await getSuperAdminGmailAuth();
        const gmail = google.gmail({ version: "v1", auth });

        // Use Promise.all for "batch" trash if the direct batchTrash method is not in this library version
        await Promise.all(ids.map(id =>
            gmail.users.messages.trash({
                userId: "me",
                id,
            })
        ));

        res.json({ success: true });
    } catch (error: any) {
        console.error("Gmail batch trash error:", error);
        res.status(500).json({ error: error.message || "Failed to batch trash" });
    }
});

/**
 * GET /api/gmail/settings
 * Fetch user settings (signature, vacation responder)
 */
router.get("/settings", isAuthenticated, async (req, res) => {
    try {
        const auth = await getSuperAdminGmailAuth();
        const gmail = google.gmail({ version: "v1", auth });

        // 1. Get primary sendAs alias for signature
        const sendAsRes = await gmail.users.settings.sendAs.list({ userId: "me" });
        const primaryAlias = sendAsRes.data.sendAs?.find(a => a.isPrimary) || sendAsRes.data.sendAs?.[0];

        // 2. Get vacation responder
        const vacationRes = await gmail.users.settings.getVacation({ userId: "me" });

        res.json({
            signature: primaryAlias?.signature || "",
            vacationResponder: vacationRes.data,
        });
    } catch (error: any) {
        console.error("Gmail settings fetch error:", error);
        res.status(500).json({ error: error.message || "Failed to fetch settings" });
    }
});

/**
 * POST /api/gmail/settings/signature
 * Update user signature
 */
router.post("/settings/signature", isAuthenticated, async (req, res) => {
    const { signature } = req.body;
    try {
        const auth = await getSuperAdminGmailAuth();
        const gmail = google.gmail({ version: "v1", auth });

        const sendAsRes = await gmail.users.settings.sendAs.list({ userId: "me" });
        const primaryAlias = sendAsRes.data.sendAs?.find(a => a.isPrimary) || sendAsRes.data.sendAs?.[0];

        if (!primaryAlias?.sendAsEmail) {
            throw new Error("Primary email alias not found");
        }

        await gmail.users.settings.sendAs.patch({
            userId: "me",
            sendAsEmail: primaryAlias.sendAsEmail,
            requestBody: { signature },
        });

        res.json({ success: true });
    } catch (error: any) {
        console.error("Gmail signature update error:", error);
        res.status(500).json({ error: error.message || "Failed to update signature" });
    }
});

/**
 * POST /api/gmail/settings/vacation
 * Update vacation responder
 */
router.post("/settings/vacation", isAuthenticated, async (req, res) => {
    const { enableVacationResponse, responseBodyHtml, responseSubject, startTime, endTime } = req.body;
    try {
        const auth = await getSuperAdminGmailAuth();
        const gmail = google.gmail({ version: "v1", auth });

        // The Gmail API use camelCase for these properties in the discovery doc
        await gmail.users.settings.updateVacation({
            userId: "me",
            requestBody: {
                enableVacationResponse: !!enableVacationResponse,
                responseBodyHtml,
                responseSubject,
                startTime: startTime ? startTime.toString() : undefined,
                endTime: endTime ? endTime.toString() : undefined,
            } as any, // Cast to any if linting is being stubborn about perfectly valid properties
        });

        res.json({ success: true });
    } catch (error: any) {
        console.error("Gmail vacation update error:", error);
        res.status(500).json({ error: error.message || "Failed to update vacation responder" });
    }
});

export default router;
