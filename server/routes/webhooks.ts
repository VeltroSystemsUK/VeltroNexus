import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { fromZodError } from "zod-validation-error";
import {
    webhookProspectPayloadSchema,
    type DueDiligenceData,
    type WebhookProspect,
} from "@shared/schema";

const router = Router();

// ── Webhook API Key Management (session-authenticated) ───────────────────────

// Generate or regenerate webhook API key
router.post("/user/webhook-key", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const apiKey = await storage.generateWebhookApiKey(userId);
        res.json({
            apiKey,
            message: "API key generated successfully. Store this securely - it won't be shown again.",
        });
    } catch (error) {
        handleApiError(res, error, "api-error");
    }
});

// Get webhook API key status (not the actual key, only suffix for identification)
router.get("/user/webhook-key", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const user = await storage.getUser(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json({
            hasApiKey: !!user.webhookApiKeyHash,
            suffix: user.webhookApiKeySuffix || null,
            createdAt: user.webhookApiKeyCreatedAt,
            lastUsedAt: user.webhookApiKeyLastUsedAt,
        });
    } catch (error) {
        handleApiError(res, error, "api-error");
    }
});

// ── Webhook Endpoints (API key authenticated) ────────────────────────────────

// Receive prospects from external applications via API key
router.post("/webhooks/prospects", async (req: Request, res: Response) => {
    try {
        const apiKey = req.headers["x-flowloan-api-key"];
        if (!apiKey || typeof apiKey !== "string") {
            return res.status(401).json({ error: "Missing API key" });
        }

        const { hashWebhookApiKey } = await import("../utils/webhookKeyHash");
        const keyHash = hashWebhookApiKey(apiKey);
        const webhookUser = await storage.getUserByWebhookApiKeyHash(keyHash);
        if (!webhookUser) {
            return res.status(401).json({ error: "Invalid API key" });
        }

        await storage.updateWebhookApiKeyLastUsed(webhookUser.id);

        const validationResult = webhookProspectPayloadSchema.safeParse(req.body);
        if (!validationResult.success) {
            const humanError = fromZodError(validationResult.error);
            return res.status(422).json({
                error: "Validation failed",
                details: humanError.message,
            });
        }

        const payload = validationResult.data;

        const prospectCount = await storage.countProspects(webhookUser.id);
        const prospectCredits = await storage.getUserProspectCredits(webhookUser.id);
        const totalAllowedProspects = webhookUser.prospectLimit + prospectCredits;

        if (prospectCount >= totalAllowedProspects) {
            return res.status(403).json({
                error: "Prospect limit reached",
                message: "Upgrade your plan or purchase additional prospect credits.",
            });
        }

        let company;
        if (payload.company.companyNumber) {
            company = await storage.getCompanyByNumber(payload.company.companyNumber);
        }

        if (!company) {
            company = await storage.createCompany({
                companyName: payload.company.companyName,
                companyNumber: payload.company.companyNumber || `WEBHOOK-${Date.now()}`,
                registeredAddress: payload.company.registeredAddress || null,
                incorporationDate: payload.company.incorporationDate || null,
                companyStatus: payload.company.companyStatus || null,
                companyType: payload.company.companyType || null,
            });
        }

        const prospectData: Partial<WebhookProspect> = payload.prospect || {};
        const prospect = await storage.createProspect(
            {
                companyId: company.id!,
                stage: (prospectData.stage as string) || "lead",
                loanAmount: prospectData.loanAmount || null,
                term: prospectData.term || null,
                interestRate: prospectData.interestRate || null,
                priority: (prospectData.priority as any) || null,
                notes: prospectData.notes || null,
                directorsGuarantee: prospectData.directorsGuarantee || 0,
                commercialProperty: prospectData.commercialProperty || 0,
                homeEquity: prospectData.homeEquity || 0,
                propertyOther: prospectData.propertyOther || 0,
                debenture: prospectData.debenture || 0,
                parentCompanyGuarantee: prospectData.parentCompanyGuarantee || 0,
                collateral: prospectData.collateral || 0,
                crossCompanyGuarantee: prospectData.crossCompanyGuarantee || 0,
                loanRequirementNotes: prospectData.loanRequirementNotes || null,
                queueOrder: 0,
            },
            webhookUser.id
        );

        if (payload.contacts && payload.contacts.length > 0) {
            for (const contact of payload.contacts) {
                await storage.createContact(
                    {
                        prospectId: prospect.id!,
                        name: contact.name,
                        email: contact.email || null,
                        phone: contact.phone || null,
                        role: contact.role || null,
                        isPrimary: contact.isPrimary ? 1 : 0,
                        notes: contact.notes || null,
                    },
                    webhookUser.id
                );
            }
        }

        if (payload.dueDiligence) {
            const dueDiligenceData: DueDiligenceData = {
                checklist: payload.dueDiligence.checklist || [],
                loanCalculator: payload.dueDiligence.loanCalculator,
                dscr: payload.dueDiligence.dscr,
                affordability: payload.dueDiligence.affordability,
                financialRatios: payload.dueDiligence.financialRatios,
                character: payload.dueDiligence.character,
            };
            await storage.upsertDueDiligence(prospect.id!, webhookUser.id, dueDiligenceData);
        }

        await storage.createActivity(
            {
                prospectId: prospect.id!,
                title: "Prospect created via webhook",
                description: payload.metadata?.sourceApp
                    ? `Created from external app: ${payload.metadata.sourceApp}${payload.metadata.externalId ? ` (ID: ${payload.metadata.externalId})` : ""}`
                    : "Created via webhook API",
                activityType: "note",
                priority: "low",
                completed: 0,
            },
            webhookUser.id
        );

        res.status(201).json({
            success: true,
            prospectId: prospect.id,
            companyId: company.id,
            message: "Prospect created successfully",
        });
    } catch (error: any) {
        console.error("Webhook error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── Lender Enquiry (public — no auth required) ───────────────────────────────

router.post("/lender-enquiry", async (req: Request, res: Response) => {
    try {
        const data = req.body;

        if (!data.entity_name || !data.contact_name || !data.contact_email) {
            return res.status(400).json({
                error: "Missing required fields: entity_name, contact_name, contact_email",
            });
        }

        const enquiry = await storage.createLenderEnquiry({
            entityName: data.entity_name,
            sponsor: data.sponsor || "",
            goLiveDate: data.go_live_date,
            objective: data.objective,
            loanTypes: data.loan_types,
            stages: data.stages,
            internalRoles: data.internal_roles || [],
            externalRoles: data.external_roles || [],
            userCount: data.user_count ? parseInt(data.user_count) : null,
            creditIntegration: data.credit_integration,
            openBanking: data.open_banking ? "true" : "false",
            decisioning: data.decisioning,
            documents: data.documents || [],
            dataSubjects: data.data_subjects || [],
            dataResidency: data.data_residency,
            dataResidencyDetails: data.data_residency_details,
            contactName: data.contact_name,
            contactEmail: data.contact_email,
            contactPhone: data.contact_phone,
            additionalNotes: data.additional_notes,
            formData: data,
            status: "new",
        });

        console.log(
            `[Lender Enquiry] New enquiry from ${data.contact_email} for ${data.entity_name}`
        );

        res.status(201).json({
            success: true,
            message: "Enquiry submitted successfully",
            id: enquiry.id,
        });
    } catch (error) {
        console.error("[Lender Enquiry] Error:", error);
        res.status(500).json({ error: "Failed to submit enquiry" });
    }
});

export default router;
