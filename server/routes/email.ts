import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { emailVerificationService } from "../services/emailVerification";

const router = Router();

// ── Email Verification ────────────────────────────────────────────────────────

router.post("/validate", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const { email, deepMode = false } = req.body;
        if (!email || typeof email !== "string") {
            return res.status(400).json({ error: "Email is required" });
        }
        const result = await emailVerificationService.verify(email, deepMode);
        res.json(result);
    } catch (err: any) {
        console.error("Email Validation Error:", err);
        res.status(500).json({ error: err.message || "Email validation failed" });
    }
});

// ── AgentMail Inbox ───────────────────────────────────────────────────────────

// Get or create user's email inbox
router.get("/inbox", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        let inbox = await storage.getEmailInbox(userId as any);

        if (!inbox) {
            try {
                const { getAgentMailClient } = await import("../agentmail");
                const client = await getAgentMailClient();

                const user = await storage.getUser(userId);
                const displayName = user?.firstName
                    ? `${user.firstName} ${user.lastName || ""}`.trim()
                    : "Veltro User";

                let agentMailInbox: any = null;

                try {
                    // @ts-ignore
                    const listResponse = await client.inboxes.list();
                    const listData = (listResponse as any).body || listResponse;
                    const inboxes =
                        listData.data || listData.items || (Array.isArray(listData) ? listData : []);
                    if (inboxes.length > 0) {
                        agentMailInbox = inboxes[0];
                        console.log(JSON.stringify({ type: "agentmail_inbox_reused", inboxId: agentMailInbox.id }));
                    }
                } catch (listError) {
                    console.log("Could not list inboxes, will try to create:", listError);
                }

                if (!agentMailInbox) {
                    try {
                        // @ts-ignore
                        const createResponse = await client.inboxes.create({ name: displayName } as any);
                        agentMailInbox = (createResponse as any).body || createResponse;
                        console.log(JSON.stringify({ type: "agentmail_inbox_created", inboxId: agentMailInbox?.id }));
                    } catch (createError: any) {
                        console.error("Error creating inbox:", createError);
                        return res.status(500).json({ error: "Failed to create email inbox. AgentMail inbox limit may be exceeded." });
                    }
                }

                if (!agentMailInbox?.id) {
                    console.error("AgentMail inbox missing id:", agentMailInbox);
                    return res.status(500).json({ error: "Failed to get inbox details from AgentMail." });
                }

                inbox = await storage.createEmailInbox({
                    userId,
                    inboxId: agentMailInbox.id,
                    emailAddress: agentMailInbox.emailAddress || agentMailInbox.email_address,
                    displayName,
                });
            } catch (error) {
                console.error("Error setting up AgentMail inbox:", error);
                return res.status(500).json({ error: "Failed to set up email inbox. Please ensure AgentMail is configured." });
            }
        }

        res.json(inbox);
    } catch (error) {
        handleApiError(res, error, "api-error");
    }
});

// Check if AgentMail is configured
router.get("/status", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const { isAgentMailConfigured } = await import("../agentmail");
        const configured = await isAgentMailConfigured();
        res.json({ configured });
    } catch (error: any) {
        res.json({ configured: false });
    }
});

// Sync messages from AgentMail to local database
router.post("/sync", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const inbox = await storage.getEmailInbox(userId as any);

        if (!inbox) {
            return res.status(404).json({ error: "No inbox found. Create one first." });
        }

        const { getAgentMailClient } = await import("../agentmail");
        const client = await getAgentMailClient();

        // @ts-ignore
        const messagesResponse = await client.inboxes.messages.list(inbox.inboxId);
        const messages = (messagesResponse as any).body || messagesResponse;

        let syncedCount = 0;
        for (const message of messages.data || []) {
            const existing = await storage.getEmailMessageByMessageId(message.id);
            if (!existing) {
                await storage.createEmailMessage({
                    inboxId: inbox.id,
                    messageId: message.id,
                    threadId: message.threadId || null,
                    fromAddress: message.from?.address || "unknown",
                    toAddresses: message.to?.map((t: any) => t.address) || [],
                    ccAddresses: message.cc?.map((c: any) => c.address) || [],
                    subject: message.subject || "",
                    textBody: message.bodyText || null,
                    htmlBody: message.bodyHtml || null,
                    direction: message.direction || "inbound",
                    isRead: 0,
                    attachments: message.attachments || [],
                    sentAt: new Date(message.createdAt),
                });
                syncedCount++;
            }
        }

        res.json({ synced: syncedCount, total: messages.data?.length || 0 });
    } catch (error) {
        handleApiError(res, error, "api-error");
    }
});

// ── Messages ──────────────────────────────────────────────────────────────────

router.get("/messages", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const inbox = await storage.getEmailInbox(userId as any);
        if (!inbox) return res.json([]);
        const messages = await storage.listEmailMessages(inbox.id as any);
        res.json(messages);
    } catch (error) {
        handleApiError(res, error, "api-error");
    }
});

router.get("/messages/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const messageId = parseInt(req.params.id);

        const inbox = await storage.getEmailInbox(userId as any);
        if (!inbox) return res.status(404).json({ error: "No inbox found" });

        const message = await storage.getEmailMessage(messageId as any);
        if (!message || message.inboxId !== (inbox.id as any)) {
            return res.status(404).json({ error: "Message not found" });
        }

        if (!message.isRead) {
            await storage.markEmailAsRead(messageId as any);
        }

        res.json(message);
    } catch (error) {
        handleApiError(res, error, "api-error");
    }
});

router.post("/send", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { to, cc, subject, body, contactId, prospectId, replyToMessageId } = req.body;

        if (!to || !subject) {
            return res.status(400).json({ error: "To address and subject are required" });
        }

        const inbox = await storage.getEmailInbox(userId as any);
        if (!inbox) return res.status(404).json({ error: "No inbox found. Create one first." });

        const { getAgentMailClient } = await import("../agentmail");
        const client = await getAgentMailClient();

        const toAddresses = Array.isArray(to) ? to : [to];
        const ccAddresses = cc ? (Array.isArray(cc) ? cc : [cc]) : [];

        // @ts-ignore
        const sendResponse = await client.inboxes.messages.create(inbox.inboxId, {
            to: toAddresses.map((addr: string) => ({ address: addr })),
            cc: ccAddresses.map((addr: string) => ({ address: addr })),
            subject,
            body: { text: body, html: null },
            replyToMessageId: replyToMessageId || undefined,
        });
        const sentMessage = (sendResponse as any).body || sendResponse;

        const savedMessage = await storage.createEmailMessage({
            inboxId: inbox.id,
            messageId: sentMessage.id,
            threadId: sentMessage.threadId || null,
            contactId: contactId ? parseInt(contactId) : null,
            prospectId: prospectId ? parseInt(prospectId) : null,
            fromAddress: inbox.emailAddress,
            toAddresses,
            ccAddresses,
            subject,
            textBody: body,
            htmlBody: null,
            direction: "outbound",
            isRead: 1,
            attachments: [],
            sentAt: new Date(),
        });

        res.status(201).json(savedMessage);
    } catch (error) {
        handleApiError(res, error, "api-error");
    }
});

router.patch("/messages/:id/link", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const messageId = parseInt(req.params.id);
        const { contactId, prospectId } = req.body;

        const inbox = await storage.getEmailInbox(userId as any);
        if (!inbox) return res.status(404).json({ error: "No inbox found" });

        const message = await storage.getEmailMessage(messageId as any);
        if (!message || message.inboxId !== (inbox.id as any)) {
            return res.status(404).json({ error: "Message not found" });
        }

        const updated = await storage.updateEmailMessageLink(
            messageId,
            prospectId ? parseInt(prospectId) : null,
            contactId ? parseInt(contactId) : null,
            userId
        );

        res.json(updated);
    } catch (error) {
        handleApiError(res, error, "api-error");
    }
});

router.get("/contact/:contactId/messages", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const contactId = parseInt(req.params.contactId);
        const inbox = await storage.getEmailInbox(userId as any);
        if (!inbox) return res.json([]);
        const messages = await storage.getEmailMessagesForContact(contactId, userId);
        res.json(messages);
    } catch (error) {
        handleApiError(res, error, "api-error");
    }
});

router.get("/prospect/:prospectId/messages", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const prospectId = parseInt(req.params.prospectId);
        const inbox = await storage.getEmailInbox(userId as any);
        if (!inbox) return res.json([]);
        const messages = await storage.getEmailMessagesForProspect(prospectId, userId);
        res.json(messages);
    } catch (error) {
        handleApiError(res, error, "api-error");
    }
});

export default router;
