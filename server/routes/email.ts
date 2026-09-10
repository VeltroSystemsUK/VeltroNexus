import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { emailVerificationService } from "../services/emailVerification";
import { sendEmail } from "../services/email";
import { sharedInbox } from "@shared/agentMailboxes";
import crypto from "crypto";

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

// ── Dummy Local Inbox ──────────────────────────────────────────────────────────

// Get or create user's local email inbox
router.get("/inbox", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        let inbox = await storage.getEmailInbox(userId as any);

        if (!inbox) {
            const user = await storage.getUser(userId);
            const displayName = user?.firstName
                ? `${user.firstName} ${user.lastName || ""}`.trim()
                : "Veltro User";
            const emailAddress = `${user?.email?.split('@')[0] || "user"}_inbox@veltro.local`;

            inbox = await storage.createEmailInbox({
                userId,
                inboxId: crypto.randomUUID(),
                emailAddress,
                displayName,
            });
            console.log(JSON.stringify({ type: "local_inbox_created", inboxId: inbox.inboxId }));
        }

        res.json({ ...inbox, emailAddress: sharedInbox() });
    } catch (error) {
        handleApiError(res, error, "api-error");
    }
});

// Check status (local inbox is always configured)
router.get("/status", isAuthenticated, async (req: Request, res: Response) => {
    res.json({ configured: true });
});

// Sync mock messages from local store
router.post("/sync", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const inbox = await storage.getEmailInbox(userId as any);

        if (!inbox) {
            return res.status(404).json({ error: "No inbox found. Create one first." });
        }

        const currentMessages = await storage.listEmailMessages(inbox.id);
        let syncedCount = 0;

        if (currentMessages.length === 0) {
            // Populate initial demo messages
            const mockEmails = [
                {
                    messageId: "mock-msg-1",
                    threadId: "mock-thread-1",
                    fromAddress: "erica.governance@fiducia.network",
                    toAddresses: [inbox.emailAddress],
                    ccAddresses: [],
                    subject: "Re: Pipedrive API Integration Data Schema",
                    textBody: "Hi Shaun, thanks for sending over the Veltro Pipedrive webhook specs. The schema looks perfect and matches our Pipedrive custom fields. Let's run a test submit tomorrow. Best, Erica.",
                    htmlBody: "<p>Hi Shaun,</p><p>Thanks for sending over the Veltro Pipedrive webhook specs. The schema looks perfect and matches our Pipedrive custom fields. Let's run a test submit tomorrow.</p><p>Best,<br>Erica</p>",
                    direction: "inbound",
                    isRead: 0,
                    attachments: [],
                    sentAt: new Date(Date.now() - 3600000 * 2), // 2 hours ago
                },
                {
                    messageId: "mock-msg-2",
                    threadId: "mock-thread-2",
                    fromAddress: "govind.operations@fiducia.network",
                    toAddresses: [inbox.emailAddress],
                    ccAddresses: [],
                    subject: "CDFI FCN-branded agreements update",
                    textBody: "Shaun, just completed signing the agreements with BCRS Business Loans and Finance For Enterprise. We're fully authorized to package and submit CDFI deals under the FCN umbrella now. Let's start importing candidates.",
                    htmlBody: "<p>Shaun,</p><p>Just completed signing the agreements with BCRS Business Loans and Finance For Enterprise. We're fully authorized to package and submit CDFI deals under the FCN umbrella now. Let's start importing candidates.</p><p>Best,<br>Govind</p>",
                    direction: "inbound",
                    isRead: 0,
                    attachments: [],
                    sentAt: new Date(Date.now() - 3600000 * 5), // 5 hours ago
                },
                {
                    messageId: "mock-msg-3",
                    threadId: "mock-thread-3",
                    fromAddress: "borrower-candidate@domain.com",
                    toAddresses: [inbox.emailAddress],
                    ccAddresses: [],
                    subject: "orbit-scraped prospect query: Commercial Refinancing Proposal",
                    textBody: "Hi, I saw your Veltro portal page and would like to explore options for refinancing our office space £150,000 CDFI loan. Please contact me at your earliest convenience.",
                    htmlBody: "<p>Hi,</p><p>I saw your Veltro portal page and would like to explore options for refinancing our office space £150,000 CDFI loan. Please contact me at your earliest convenience.</p>",
                    direction: "inbound",
                    isRead: 0,
                    attachments: [],
                    sentAt: new Date(Date.now() - 3600000 * 24), // 24 hours ago
                }
            ];

            for (const email of mockEmails) {
                await storage.createEmailMessage({
                    inboxId: inbox.id,
                    ...email
                } as any);
                syncedCount++;
            }
        } else {
            // Add a new random mock email to simulate a sync event receiving mail
            const randomMsgId = `mock-msg-${Date.now()}`;
            await storage.createEmailMessage({
                inboxId: inbox.id,
                messageId: randomMsgId,
                threadId: `mock-thread-${Date.now()}`,
                fromAddress: "info@bcrs.org.uk",
                toAddresses: [inbox.emailAddress],
                ccAddresses: [],
                subject: `New CDFI Update: BCRS Application Status`,
                textBody: "We have received the new submission payload from Veltro. The underwriter has been assigned and is reviewing the credit documents. We will update you in Pipedrive shortly.",
                htmlBody: "<p>We have received the new submission payload from Veltro. The underwriter has been assigned and is reviewing the credit documents. We will update you in Pipedrive shortly.</p>",
                direction: "inbound",
                isRead: 0,
                attachments: [],
                sentAt: new Date(),
            } as any);
            syncedCount = 1;
        }

        const allMessages = await storage.listEmailMessages(inbox.id);
        res.json({ synced: syncedCount, total: allMessages.length });
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

        const toAddresses = Array.isArray(to) ? to : [to];
        const ccAddresses = cc ? (Array.isArray(cc) ? cc : [cc]) : [];
        const messageId = `local-msg-${crypto.randomUUID()}`;

        // Send via SMTP if credentials are configured — this is the user's personal
        // work mailbox (shaun@stratafinance.co.uk), separate from the shared
        // enquiries@ account agents use for outreach.
        await sendEmail(
            {
                agentId: "inbound-intake",
                fromEmail: sharedInbox(),
                replyTo: sharedInbox(),
                prospectId,
            },
            toAddresses.join(", "),
            subject,
            body || "",
        );

        const savedMessage = await storage.createEmailMessage({
            inboxId: inbox.id,
            messageId,
            threadId: replyToMessageId || `thread-${crypto.randomUUID()}`,
            contactId: contactId ? parseInt(contactId) : null,
            prospectId: prospectId ? parseInt(prospectId) : null,
            fromAddress: sharedInbox(),
            toAddresses,
            ccAddresses,
            subject,
            textBody: body,
            htmlBody: null,
            direction: "outbound",
            isRead: 1,
            attachments: [],
            sentAt: new Date(),
        } as any);

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

        await storage.updateEmailMessageLink(
            messageId,
            prospectId ? parseInt(prospectId) : null,
            contactId ? parseInt(contactId) : null,
            userId
        );

        const updated = await storage.getEmailMessage(messageId);
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
