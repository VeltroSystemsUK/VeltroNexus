import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertInternalLeadSchema } from "@shared/schema";
import { calculateMonthlyPayment, identifyOpportunity, MARKET_CONTEXT_2026 } from "../data/refinancingIntelligence";

const router = Router();

// Schema for Inbound Refinancing Lead
const inboundRefinanceSchema = z.object({
    // Contact Info
    companyName: z.string().min(1, "Company name is required"),
    contactName: z.string().min(1, "Contact name is required"),
    email: z.string().email("Invalid email address"),
    phone: z.string().optional(),

    // Calculator Inputs
    currentDebt: z.number().positive("Debt amount must be positive"),
    monthlyPayment: z.number().positive("Monthly payment must be positive"),
    estimatedRate: z.number().optional().default(15), // Fallback if not provided
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
            currentDebt, monthlyPayment, estimatedRate
        } = result.data;

        // 2. Run the "Delta" Calculation
        // Compare current high-rate debt vs 2026 Refinance Rate (e.g. 8.5%)
        const analysis = identifyOpportunity(
            { principal: currentDebt, monthlyPayment },
            8.5, // Target Rate
            60   // Term (Months)
        );

        // 3. Create Internal Lead
        // We use a predefined "System" user or keep assignedAgentId as the primary owner
        const notes = JSON.stringify({
            source: "Landing Page: Refinance 2026",
            calculatorData: {
                currentDebt,
                monthlyPayment,
                estimatedRate,
                analysis
            },
            campaign: "Inbound-Capital-Strategist"
        }, null, 2);

        const leadData = {
            companyName,
            contactName,
            email,
            phone: phone || "",
            status: "new", // Enters queue
            assignedAgentId: "capital-strategist", // Assign to our new agent
            notes,
            estimatedValue: Math.round(analysis.fiveYearSavings), // The "Value" is the savings unlock
            commissionRate: 0.1, // Default
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Use storage to create lead. 
        // Note: storage.createInternalLead might expect a logged-in user context in some implementations,
        // but looking at storage.ts, it just takes the data object.

        // We need to bypass the strict Zod schema of insertInternalLeadSchema which might omit ID.
        // Let's rely on storage.createInternalLead to handle ID generation.

        const lead = await storage.createInternalLead(leadData as any);

        // 4. Return the "Result" to the frontend (The Hook)
        // We give them the data immediately as the reward for signing up
        res.json({
            success: true,
            leadId: lead.id,
            analysis: {
                monthlySavings: analysis.monthlySavings,
                fiveYearSavings: analysis.fiveYearSavings,
                valuationBoost: analysis.valuationBoost,
                newMonthlyPayment: analysis.newMonthlyPayment
            },
            message: "Lead captured. Strategy Agent will analyze deeper."
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

        // 1. Construct Email Content
        const subject = `[PRIORITY] New Refinance Application: ${data.companyName}`;
        const content = `
            <h2>New Priority Application Received</h2>
            <p><strong>Company:</strong> ${data.companyName}</p>
            <p><strong>Director:</strong> ${data.directorName}</p>
            <p><strong>Email:</strong> ${data.email}</p>
            <p><strong>Phone:</strong> ${data.phone}</p>
            <hr />
            <h3>Financials</h3>
            <p><strong>Turnover:</strong> £${data.turnover.toLocaleString()}</p>
            <p><strong>Requested Loan:</strong> £${data.loanAmount.toLocaleString()}</p>
            <hr />
            <p><strong>Matched Lead ID:</strong> ${data.leadId || "N/A"}</p>
            <p><em>This lead was captured via the Refinance 2026 landing page.</em></p>
        `;

        // 2. Send Email to Super Admin
        try {
            await sendEmail({}, "admin@veltro.com", subject, content);
        } catch (emailError) {
            console.error("Failed to send admin email:", emailError);
        }

        // 3. Update existing Lead if ID exists
        if (data.leadId) {
            const existingLead = await storage.getInternalLead(data.leadId);
            if (existingLead) {
                const newNotes = existingLead.notes + "\n\n[APPLICATION SUBMITTED]\n" + JSON.stringify(data, null, 2);
                await storage.updateInternalLead(data.leadId, {
                    notes: newNotes,
                    status: "application_submitted"
                });
            }
        }

        res.json({ success: true, message: "Application forwarded to underwriting." });

    } catch (error) {
        console.error("[Inbound] Application submission failed:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;
