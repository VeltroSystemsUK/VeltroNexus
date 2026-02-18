import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { fromZodError } from "zod-validation-error";
import { sendEmail } from "../services/email";
import {
    insertCommunicationIntegrationSchema,
    insertCommunicationTemplateSchema,
} from "@shared/schema";

const router = Router();

// ── Communication Settings (Integrations) ────────────────────────────────────

router.get("/communications/settings", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const integrations = await storage.getCommunicationIntegrations(req.user!.id);
        res.json(integrations);
    } catch (error) {
        handleApiError(res, error, "communication-error");
    }
});

router.post("/communications/settings", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const result = insertCommunicationIntegrationSchema.safeParse({
            ...req.body,
            userId: req.user!.id,
        });
        if (!result.success) {
            return res.status(400).json({ error: fromZodError(result.error).toString() });
        }
        const integration = await storage.saveCommunicationIntegration(result.data);
        res.json(integration);
    } catch (error) {
        handleApiError(res, error, "communication-error");
    }
});

// ── Communication Templates ──────────────────────────────────────────────────

router.get("/communications/templates", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const templates = await storage.getCommunicationTemplates(req.user!.id);
        res.json(templates);
    } catch (error) {
        handleApiError(res, error, "communication-error");
    }
});

router.post("/communications/templates", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const result = insertCommunicationTemplateSchema.safeParse({
            ...req.body,
            userId: req.user!.id,
        });
        if (!result.success) {
            return res.status(400).json({ error: fromZodError(result.error).toString() });
        }
        const template = await storage.createCommunicationTemplate(result.data);
        res.json(template);
    } catch (error) {
        handleApiError(res, error, "communication-error");
    }
});

router.put("/communications/templates/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        const result = insertCommunicationTemplateSchema.partial().safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({ error: fromZodError(result.error).toString() });
        }
        // Verify ownership
        const templates = await storage.getCommunicationTemplates(req.user!.id);
        if (!templates.find((t) => t.id === id)) {
            return res.status(404).json({ error: "Template not found" });
        }
        const updated = await storage.updateCommunicationTemplate(id, result.data);
        res.json(updated);
    } catch (error) {
        handleApiError(res, error, "communication-error");
    }
});

// ── Send ─────────────────────────────────────────────────────────────────────

router.post("/communications/send", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const { prospectId, channel, templateId, content, subject, contactId } = req.body;
        const userId = req.user!.id;

        const integrations = await storage.getCommunicationIntegrations(userId);
        const integration = integrations.find((i) => i.provider === "sendgrid" && i.isEnabled);

        if (!integration) {
            return res.status(400).json({
                error: "No active email integration found. Please configure SendGrid in Settings.",
            });
        }

        const prospect = await storage.getProspect(prospectId, userId);
        if (!prospect) return res.status(404).json({ error: "Prospect not found" });

        let recipientEmail: string;
        let recipientName: string;
        let recipientVariables = {};

        if (contactId) {
            const contacts = await storage.listContacts(prospectId, userId);
            const contact = contacts.find((c) => c.id === contactId);
            if (!contact || !contact.email)
                return res.status(400).json({ error: "Contact has no email" });
            recipientEmail = contact.email;
            recipientName = contact.name;
            recipientVariables = {
                firstName: contact.name.split(" ")[0],
                name: contact.name,
                company: prospect.company.companyName,
            };
        } else {
            return res.status(400).json({ error: "Contact ID required" });
        }

        await sendEmail(integration.credentials, recipientEmail, subject, content, recipientVariables);

        const log = await storage.logCommunication({
            userId,
            prospectId,
            contactId: contactId || null,
            channel: "email",
            direction: "outbound",
            status: "sent",
            subject,
            content,
            metadata: { provider: "sendgrid" },
        });

        res.json(log);
    } catch (error: any) {
        console.error("Send Error:", error);
        res.status(500).json({ error: error.message || "Failed to send message" });
    }
});

// ── Communication Logs ───────────────────────────────────────────────────────

router.get("/prospects/:id/communications", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const prospectId = parseInt(req.params.id);
        const prospect = await storage.getProspect(prospectId, req.user!.id);
        if (!prospect) return res.status(404).json({ error: "Prospect not found" });
        const logs = await storage.getCommunicationHistory(prospectId);
        res.json(logs);
    } catch (error) {
        handleApiError(res, error, "communication-error");
    }
});

// ── Chat Routes ───────────────────────────────────────────────────────────────

router.get("/chat/channels", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const channels = await storage.getChannelsForUser(req.user!.id);
        res.json(channels);
    } catch (error) {
        handleApiError(res, error, "chat-error");
    }
});

router.post("/chat/channels", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const { type, name, contextId, targetUserId, memberIds } = req.body;
        const myId = req.user!.id;

        if (type === "direct" && targetUserId) {
            const myChannels = await storage.getChannelsForUser(myId);
            const directChannels = myChannels.filter((c) => c.type === "direct");
            for (const c of directChannels) {
                const members = await storage.listChannelMembers(c.id!);
                if (members.length === 2 && members.some((m) => m.userId === targetUserId)) {
                    return res.json(c);
                }
            }

            const channel = await storage.createChannel({ type: "direct", name: null, contextId: null });
            await storage.addChannelMember({ channelId: channel.id!, userId: myId, lastReadAt: new Date() });
            await storage.addChannelMember({ channelId: channel.id!, userId: targetUserId, lastReadAt: new Date() });
            return res.json(channel);
        }

        const channel = await storage.createChannel({
            type: type || "group",
            name: name || (type === "prospect" ? `Prospect ${contextId}` : "New Group"),
            contextId: contextId || null,
        });

        await storage.addChannelMember({ channelId: channel.id!, userId: myId, lastReadAt: new Date() });

        if (Array.isArray(memberIds)) {
            for (const uid of memberIds) {
                await storage.addChannelMember({ channelId: channel.id!, userId: uid, lastReadAt: new Date() });
            }
        }

        res.json(channel);
    } catch (error) {
        handleApiError(res, error, "chat-error");
    }
});

router.get("/chat/channels/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const channelId = parseInt(req.params.id);
        const channel = await storage.getChannel(channelId);
        if (!channel) return res.status(404).json({ error: "Channel not found" });

        const members = await storage.listChannelMembers(channelId);
        if (!members.some((m) => m.userId === req.user!.id)) {
            return res.status(403).json({ error: "Access denied" });
        }

        res.json({ ...channel, members });
    } catch (error) {
        handleApiError(res, error, "chat-error");
    }
});

router.get("/chat/channels/:id/messages", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const channelId = parseInt(req.params.id);
        const members = await storage.listChannelMembers(channelId);
        if (!members.some((m) => m.userId === req.user!.id)) {
            return res.status(403).json({ error: "Access denied" });
        }
        const messages = await storage.getMessages(channelId);
        res.json(messages);
    } catch (error) {
        handleApiError(res, error, "chat-error");
    }
});

router.post("/chat/channels/:id/messages", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const channelId = parseInt(req.params.id);
        const { content, attachments } = req.body;

        const members = await storage.listChannelMembers(channelId);
        if (!members.some((m) => m.userId === req.user!.id)) {
            return res.status(403).json({ error: "Access denied" });
        }

        const message = await storage.createMessage({
            channelId,
            senderId: req.user!.id,
            content,
            attachments: attachments || [],
        });

        res.json(message);
    } catch (error) {
        handleApiError(res, error, "chat-error");
    }
});

router.get("/chat/users", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const users = await storage.getAllUsers();
        const safeUsers = users.map((u) => ({
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            role: u.role,
            profileImageUrl: u.profileImageUrl,
        }));
        res.json(safeUsers);
    } catch (error) {
        handleApiError(res, error, "chat-error");
    }
});

export default router;
