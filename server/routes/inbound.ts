import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { calculateMonthlyPayment, identifyOpportunity, MARKET_CONTEXT_2026 } from "../data/refinancingIntelligence";
import { isInboundLead, promoteInternalLeadToPipeline } from "../services/inboundPipeline";
import { chFetch } from "../utils/companiesHouseClient";

const router = Router();

router.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
});

function escapeHtml(value: unknown): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function emailsMatch(left?: string | null, right?: string | null): boolean {
    return String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
}

async function stopConvertAfterInboundLead(email: string): Promise<void> {
    try {
        const { stopConvertAndPromote } = await import("../services/openers");
        await stopConvertAndPromote(email, "promoted");
    } catch (error) {
        console.error("[Inbound] convert auto-promote failed:", error);
    }
}

// Schema for Inbound Refinancing Lead.
// Shared by the site's per-tool calculator forms (which send currentDebt/monthlyPayment
// directly) and the unified "Start The Conversation" widget on the Refinance Calculator,
// HMRC TTP Calculator and BBB Eligibility Checker (which sends a free-form `context` object
// instead — e.g. context.outstanding/context.currentMonthly for the refinance tool).
const inboundRefinanceSchema = z.object({
    // Contact Info
    companyName: z.string().min(1, "Company name is required"),
    contactName: z.string().min(1, "Contact name is required"),
    email: z.string().email("Invalid email address"),
    phone: z.string().optional(),

    // Calculator Inputs (optional — the unified widget nests these under `context` instead)
    currentDebt: z.number().positive("Debt amount must be positive").optional(),
    monthlyPayment: z.number().positive("Monthly payment must be positive").optional(),
    estimatedRate: z.number().optional().default(15), // Fallback if not provided

    source: z.string().optional(),
    context: z.record(z.any()).optional(),
});

/**
 * POST /api/inbound/refinance
 * Public endpoint for "3-Question Delta" lead capture
 */
router.post("/refinance", async (req, res) => {
    try {
        // 1. Validate Input
        const result = inboundRefinanceSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        const {
            companyName, contactName, email, phone,
            estimatedRate, source, context
        } = result.data;

        // The unified widget (refinance calc, HMRC TTP calc, BBB checker) nests the
        // calculator figures under `context` instead of sending them at the top level.
        const currentDebt = result.data.currentDebt ?? (Number(context?.outstanding) || 0);
        const monthlyPayment = result.data.monthlyPayment ?? (Number(context?.currentMonthly) || 0);

        // 2. Run the "Delta" Calculation
        // Compare current high-rate debt vs 2026 Refinance Rate (e.g. 8.5%)
        const analysis = identifyOpportunity(
            { principal: currentDebt, monthlyPayment },
            8.5, // Target Rate
            60   // Term (Months)
        );

        // Public inbound leads land in the CRM inbox for review and promotion.
        const notes = JSON.stringify({
            source: source ? `Landing Page: ${source}` : "Landing Page: Refinance 2026",
            calculatorData: {
                currentDebt,
                monthlyPayment,
                estimatedRate,
                analysis
            },
            context,
            campaign: "Inbound-Capital-Strategist"
        }, null, 2);

        const lead = await storage.createInternalLead({
            companyName,
            companyNumber: `WEB-${Date.now()}`,
            contactName,
            email,
            phone: phone || "",
            status: "new",
            assignedAgentId: "capital-strategist",
            notes,
            estimatedValue: Math.round(analysis.fiveYearSavings),
            commissionRate: 0.1,
            hasCharges: false,
            totalChargesCount: 0,
            satisfiedChargesCount: 0,
            possibleDuplicate: false,
        });

        const pipeline = await promoteInternalLeadToPipeline(lead);

        await stopConvertAfterInboundLead(email);

        // 4. Return the "Result" to the frontend (The Hook)
        // We give them the data immediately as the reward for signing up
        res.json({
            success: true,
            leadId: lead.id,
            prospectId: pipeline.prospectId,
            analysis: {
                monthlySavings: analysis.monthlySavings,
                fiveYearSavings: analysis.fiveYearSavings,
                valuationBoost: analysis.valuationBoost,
                newMonthlyPayment: analysis.newMonthlyPayment
            },
            message: "Lead captured. Strategy Agent will analyze deeper."
        });

        import("../services/agenticWorkflow").then(({ agenticWorkflow }) => {
            agenticWorkflow.startFromInbound(lead.id, {
                loanAmount: Math.round(currentDebt * 100),
                prospectId: pipeline.prospectId,
            }).catch((error) => {
                console.error("[Inbound] Agentic workflow failed:", error);
            });
        });

    } catch (error) {
        console.error("[Inbound] Refinance lead capture failed:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Schema for Full Application
const applicationSchema = z.object({
    companyName: z.string(),
    companyNumber: z.string().optional(),
    address: z.string(),
    directorName: z.string(),
    dob: z.string().optional(),
    email: z.string().email(),
    phone: z.string(),
    turnover: z.number(),
    profit: z.number().optional(),
    loanAmount: z.number(),
    leadId: z.number().optional()
});

import { sendEmail } from "../services/email";

router.post("/application", async (req, res) => {
    try {
        const result = applicationSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        const data = result.data;

        const { assessBbbEligibility, bbbBlockMessage, BBB_TURNOVER_CAP_GBP, BBB_FACILITY_CAP_GBP } = await import("@shared/bbbEligibility");
        const bbb = assessBbbEligibility({
          address: data.address,
          turnoverGbp: data.turnover,
          loanAmountGbp: data.loanAmount,
        });
        if (data.turnover > BBB_TURNOVER_CAP_GBP || data.loanAmount > BBB_FACILITY_CAP_GBP || bbb.status === "fail") {
          return res.status(403).json({
            error: bbbBlockMessage(bbb) || "Not eligible for British Business Bank funding.",
            bbb,
          });
        }

        const existingLead = data.leadId ? await storage.getInternalLead(data.leadId) : undefined;
        const canAttachToLead = !!existingLead && isInboundLead(existingLead) && emailsMatch(existingLead.email, data.email);
        let workflowLeadId: number | undefined;
        let pipelineProspectId: number | undefined;
        if (canAttachToLead && existingLead) {
            const newNotes = (existingLead.notes || "") + "\n\n[APPLICATION SUBMITTED]\n" + JSON.stringify(data, null, 2);
            await storage.updateInternalLead(existingLead.id, {
                notes: newNotes,
                status: "application_submitted",
                estimatedValue: data.loanAmount,
            });
            workflowLeadId = existingLead.id;
            pipelineProspectId = (await promoteInternalLeadToPipeline(existingLead)).prospectId;
        } else {
            const created = await storage.createInternalLead({
                companyName: data.companyName,
                companyNumber: data.companyNumber || `WEB-${Date.now()}`,
                contactName: data.directorName,
                email: data.email,
                phone: data.phone,
                status: "application_submitted",
                assignedAgentId: "capital-strategist",
                notes: JSON.stringify({ source: "Refinance 2026 Application", application: data }, null, 2),
                estimatedValue: data.loanAmount,
                commissionRate: 0.1,
                hasCharges: false,
                totalChargesCount: 0,
                satisfiedChargesCount: 0,
                possibleDuplicate: false,
            });
            workflowLeadId = created.id;
            pipelineProspectId = (await promoteInternalLeadToPipeline(created)).prospectId;
        }

        await stopConvertAfterInboundLead(data.email);

        // 2. Send Email to Super Admin — best-effort notification only, never the only record.
        const subject = `[PRIORITY] New Refinance Application: ${data.companyName}`;
        const content = `
            <h2>New Priority Application Received</h2>
            <p><strong>Company:</strong> ${escapeHtml(data.companyName)}</p>
            <p><strong>Director:</strong> ${escapeHtml(data.directorName)}</p>
            <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
            <p><strong>Phone:</strong> ${escapeHtml(data.phone)}</p>
            <hr />
            <h3>Financials</h3>
            <p><strong>Turnover:</strong> £${data.turnover.toLocaleString()}</p>
            <p><strong>Requested Loan:</strong> £${data.loanAmount.toLocaleString()}</p>
            <hr />
            <p><strong>Matched Lead ID:</strong> ${canAttachToLead ? escapeHtml(data.leadId) : "N/A"}</p>
            <p><em>This lead was captured via the Refinance 2026 landing page.</em></p>
        `;
        try {
            await sendEmail({}, "admin@veltro.com", subject, content);
        } catch (emailError) {
            console.error("Failed to send admin email:", emailError);
        }

        res.json({ success: true, message: "Application forwarded to underwriting." });

        if (workflowLeadId) {
            import("../services/agenticWorkflow").then(({ agenticWorkflow }) => {
                agenticWorkflow.startFromInbound(workflowLeadId!, { loanAmount: data.loanAmount * 100, prospectId: pipelineProspectId }).catch((error) => {
                    console.error("[Inbound] Agentic workflow failed:", error);
                });
            });
        }

    } catch (error) {
        console.error("[Inbound] Application submission failed:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * GET /api/inbound/companies-house/search
 * Public, unauthenticated proxy for the Introduction Portal's company autocomplete.
 * (The authenticated /api/companies-house/search route is for logged-in staff use.)
 */
router.get("/companies-house/search", async (req, res) => {
    try {
        const query = req.query.q as string;
        const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);

        if (!query || query.trim().length === 0) {
            return res.status(400).json({ error: "Search query is required" });
        }

        const response = await chFetch(`/search/companies?q=${encodeURIComponent(query)}&items_per_page=${limit}`);
        if (!response.ok) {
            const errorText = await response.text();
            console.error("[Inbound] Companies House search failed:", response.status, errorText);
            return res.status(response.status).json({ error: "Companies House lookup failed" });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("[Inbound] Companies House search error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Schema for Introduction Portal submission
const portalSubmitSchema = z.object({
    contactName: z.string().min(1, "Contact name is required"),
    email: z.string().email("Invalid email address"),
    phone: z.string().nullable().optional(),

    companyName: z.string().min(1, "Company name is required"),
    companyNumber: z.string().optional(),
    registeredAddress: z.string().nullable().optional(),
    postcode: z.string().nullable().optional(),
    incorporationDate: z.string().nullable().optional(),
    companyStatus: z.string().nullable().optional(),
    companyType: z.string().nullable().optional(),

    gatewaySelection: z.object({ userType: z.string(), requestType: z.string() }).optional(),
    loanAmount: z.number().optional(),
    term: z.number().optional(),
    monthlyPayment: z.number().optional(),
    matchedLender: z.string().optional(),
    region: z.string().optional(),

    checklistAnswers: z.record(z.any()).optional(),
    bbbEligibility: z.record(z.any()).optional(),
    factfindData: z.record(z.any()).optional(),
    disclosuresAgreed: z.boolean().optional(),

    signatureName: z.string().min(1, "Signature is required"),
    signatureDate: z.string().optional(),

    source: z.string().optional(),
    stage: z.string().optional(),
});

/**
 * POST /api/inbound/portal-submit
 * Final submission from the public Introduction Portal wizard.
 */
router.post("/portal-submit", async (req, res) => {
    try {
        const result = portalSubmitSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        const data = result.data;

        const notes = JSON.stringify({
            source: "Introduction Portal",
            gatewaySelection: data.gatewaySelection,
            registeredAddress: data.registeredAddress,
            postcode: data.postcode,
            incorporationDate: data.incorporationDate,
            companyStatus: data.companyStatus,
            companyType: data.companyType,
            term: data.term,
            monthlyPayment: data.monthlyPayment,
            matchedLender: data.matchedLender,
            region: data.region,
            checklistAnswers: data.checklistAnswers,
            bbbEligibility: data.bbbEligibility,
            factfindData: data.factfindData,
            disclosuresAgreed: data.disclosuresAgreed,
            signatureName: data.signatureName,
            signatureDate: data.signatureDate,
        }, null, 2);

        // The wizard's first step asks the submitter whether they're the borrower or
        // an introducer — that answer must decide which pipeline this lands in, not
        // just get logged in the notes blob and ignored.
        if (data.gatewaySelection?.userType === "introducer") {
            const brokerLead = await storage.createBrokerLead({
                companyName: data.companyName,
                companyNumber: data.companyNumber || `WEB-${Date.now()}`,
                contactName: data.contactName,
                email: data.email,
                phone: data.phone || "",
                status: "new",
                address: data.registeredAddress || undefined,
                notes,
                commissionRate: 0.1,
                hasCharges: false,
                totalChargesCount: 0,
                satisfiedChargesCount: 0,
                contacts: [],
                possibleDuplicate: false,
            });

            return res.json({ success: true, brokerLeadId: brokerLead.id });
        }

        const lead = await storage.createInternalLead({
            companyName: data.companyName,
            companyNumber: data.companyNumber || `WEB-${Date.now()}`,
            contactName: data.contactName,
            email: data.email,
            phone: data.phone || "",
            status: "application_submitted",
            assignedAgentId: "capital-strategist",
            notes,
            estimatedValue: Math.round(data.loanAmount || 0),
            commissionRate: 0.1,
            hasCharges: false,
            totalChargesCount: 0,
            satisfiedChargesCount: 0,
            possibleDuplicate: false,
        });

        const pipeline = await promoteInternalLeadToPipeline(lead);

        await stopConvertAfterInboundLead(data.email);

        res.json({
            success: true,
            leadId: lead.id,
            prospectId: pipeline.prospectId,
        });

        import("../services/agenticWorkflow").then(({ agenticWorkflow }) => {
            agenticWorkflow.startFromInbound(lead.id, {
                loanAmount: Math.round((data.loanAmount || 0) * 100),
                prospectId: pipeline.prospectId,
            }).catch((error) => {
                console.error("[Inbound] Agentic workflow failed:", error);
            });
        });
    } catch (error) {
        console.error("[Inbound] Portal submission failed:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;
