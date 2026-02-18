import { generateText } from "../utils/geminiClient";
import { capitalStrategistAgent } from "../agents/capitalStrategist";

/**
 * Capital Strategist Email Generator
 * 
 * Generates CFO-style refinancing outreach emails with objection handling
 */

interface ProspectData {
    name: string;
    company: string;
    turnover?: string;
    sector?: string;
    currentDebt?: {
        monthly: number;
        term: number;
        rate: number;
    };
}

interface RefinanceScenario {
    currentMonthly: number;
    newMonthly: number;
    cashFlowGap: number;
    annualSavings: number;
    setupFee: number;
    paybackMonths: number;
}

export class CapitalStrategistService {
    /**
     * Generate initial outreach email
     */
    async generateOutreachEmail(prospect: ProspectData): Promise<{ subject: string; body: string }> {
        const prompt = `${capitalStrategistAgent.systemPrompt}

${capitalStrategistAgent.emailGenerationGuidance}

PROSPECT DETAILS:
- Name: ${prospect.name}
- Company: ${prospect.company}
- Turnover: ${prospect.turnover || "Not specified"}
- Sector: ${prospect.sector || "Not specified"}

TASK: Generate an initial outreach email following The Capital Strategist framework.

REQUIREMENTS:
1. Use the Fractional CFO tone (peer-to-peer, analytical, empathetic)
2. Reference 2026 UK lending context
3. Quantify potential cash flow impact (estimate based on turnover)
4. Include one objection reframe naturally
5. End with low-pressure 15-minute call invitation
6. Sign as Capital Strategist, NOT a broker

Return ONLY valid JSON:
{
  "subject": "Email subject line",
  "body": "Email body (plain text, use \\n\\n for paragraphs)"
}`;

        try {
            const response = await generateText(prompt);
            const jsonMatch = response.match(/\{[\s\S]*\}/);

            if (!jsonMatch) {
                throw new Error("Failed to parse AI response");
            }

            return JSON.parse(jsonMatch[0]);
        } catch (error) {
            console.error("[Capital Strategist] Email generation failed:", error);

            // Fallback to template
            return {
                subject: `2026 Capital Health Check for ${prospect.company}`,
                body: capitalStrategistAgent.conversationTemplates.initialOutreach.body
                    .replace(/\[Name\]/g, prospect.name)
                    .replace(/\[Company Name\]/g, prospect.company)
                    .replace(/\[Sector\]/g, prospect.sector || "your sector"),
            };
        }
    }

    /**
     * Calculate refinance scenario
     */
    calculateRefinanceScenario(
        currentMonthly: number,
        currentRate: number,
        currentTermRemaining: number,
        loanAmount: number
    ): RefinanceScenario {
        // New 5-year terms (typical 2026 UK rates)
        const newRate = 6.5; // Typical SME refinance rate
        const newTermMonths = 60;

        // Calculate new monthly payment
        const monthlyRate = newRate / 100 / 12;
        const newMonthly =
            (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, newTermMonths)) /
            (Math.pow(1 + monthlyRate, newTermMonths) - 1);

        const cashFlowGap = currentMonthly - newMonthly;
        const annualSavings = cashFlowGap * 12;

        // Setup fee (typically 2% of loan)
        const setupFee = loanAmount * 0.02;
        const paybackMonths = Math.ceil(setupFee / cashFlowGap);

        return {
            currentMonthly,
            newMonthly,
            cashFlowGap,
            annualSavings,
            setupFee,
            paybackMonths,
        };
    }

    /**
     * Generate follow-up email with numbers
     */
    async generateFollowUpEmail(
        prospect: ProspectData,
        scenario: RefinanceScenario
    ): Promise<{ subject: string; body: string }> {
        const body = capitalStrategistAgent.conversationTemplates.followUp.body
            .replace(/\[Name\]/g, prospect.name)
            .replace(/\[Company Name\]/g, prospect.company)
            .replace(/\[Turnover\]/g, prospect.turnover || "your")
            .replace(/\[Current Monthly\]/g, `£${scenario.currentMonthly.toLocaleString()}`)
            .replace(/\[New Monthly\]/g, `£${scenario.newMonthly.toLocaleString()}`)
            .replace(/\[Gap\]/g, `${scenario.cashFlowGap.toLocaleString()}`)
            .replace(/\[Annual\]/g, `${scenario.annualSavings.toLocaleString()}`);

        return {
            subject: `Your Cash Flow Gap: £${scenario.cashFlowGap.toLocaleString()}/month`,
            body,
        };
    }

    /**
     * Handle objection with reframe
     */
    handleObjection(objectionText: string): string | null {
        const lowerText = objectionText.toLowerCase();

        // Match objection to framework
        for (const [key, obj] of Object.entries(capitalStrategistAgent.objectionHandling)) {
            const hasKeyword = obj.keywords.some(keyword => lowerText.includes(keyword));

            if (hasKeyword) {
                return obj.reframe;
            }
        }

        return null;
    }

    /**
     * Get workflow stage guidance
     */
    getWorkflowStage(stageName: string): any {
        const stages: Record<string, any> = {
            "debt-audit": capitalStrategistAgent.workflow.stage1,
            "opportunity-cost": capitalStrategistAgent.workflow.stage2,
            "documentation": capitalStrategistAgent.workflow.stage3,
            "closing": capitalStrategistAgent.workflow.stage4,
        };

        return stages[stageName] || null;
    }

    /**
     * Get 2026 benefit pitch
     */
    get2026BenefitPitch(benefit: "macro" | "equity" | "operational"): string {
        const benefits: Record<string, any> = {
            macro: capitalStrategistAgent.benefits2026.macroStability,
            equity: capitalStrategistAgent.benefits2026.equityRelease,
            operational: capitalStrategistAgent.benefits2026.operationalBreathing,
        };

        return benefits[benefit]?.pitch || "";
    }
}

export const capitalStrategist = new CapitalStrategistService();
