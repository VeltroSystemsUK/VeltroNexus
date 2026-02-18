import { researchCompany, generateText, repairJson } from "../utils/geminiClient";
import { storage } from "../storage";
import { z } from "zod";

const lenderResearchResultSchema = z.object({
    creditAppetite: z.string().optional(),
    keyStrengths: z.string().optional(),
    keyWeaknesses: z.string().optional(),
    sectors: z.array(z.string()).optional(),
    productTypes: z.array(z.string()).optional(),
    summary: z.string().optional(),
    lendingPolicy: z.string().optional(),
    insights: z.string().optional(),
});

type LenderResearchResult = z.infer<typeof lenderResearchResultSchema>;

export async function researchLender(
    lenderId: number | null,
    userId: string,
    params: { website?: string; name?: string; targetField?: string } = {}
): Promise<LenderResearchResult> {
    let lender: any = null;
    if (lenderId) {
        lender = await storage.getLender(lenderId);
        if (!lender && !params.name) throw new Error(`Lender with ID ${lenderId} not found`);
    }

    const institutionName = params.name || lender?.institutionName;
    const website = params.website || lender?.website;

    if (!institutionName) throw new Error("Lender name or ID required for research");

    console.log(`[Lender Research] Starting AI deep dive for: ${institutionName} (Target: ${params.targetField || 'All'})`);

    // Step 1: Get raw intelligence from Gemini grounded research
    const enrichment = await researchCompany(institutionName, website || undefined);

    // Step 2: Refine specifically for LENDER criteria
    const targetContext = params.targetField ? `Focus specifically on providing a detailed result for the field "${params.targetField}".` : "";
    const refinementPrompt = `
    You are a Senior Commercial Finance Broker. Analyze the following research about "${institutionName}" and extract specific lending criteria.
    ${targetContext}
    
    RESEARCH DATA:
    ${enrichment.businessProfile}
    
    TASK:
    Extract the following fields into a structured JSON object:
    1. creditAppetite: What type of businesses or situations do they like to fund? (e.g., "SMEs with £1m+ turnover", "Distressed property")
    2. keyStrengths: Why would a broker use them? (e.g., "Fast turnaround", "High LTV", "Direct access to underwriters")
    3. keyWeaknesses: What are the drawbacks? (e.g., "Expensive arrangement fees", "Slow legal process", "Restricted to London")
    4. sectors: List of industries they serve (e.g., ["Real Estate", "Manufacturing"])
    5. productTypes: List of loan products (e.g., ["Bridging", "Asset Finance", "Invoice Finance"])
    6. lendingPolicy: Specific rules or guidelines for lending (e.g., "Max term 24 months", "Minimum 2 years trading history required")
    7. insights: Any unique insights or "insider" knowledge about their process.
    8. summary: A 2-sentence professional overview of this lender for a broker directory.

    OUTPUT FORMAT (JSON ONLY):
    {
      "creditAppetite": "...",
      "keyStrengths": "...",
      "keyWeaknesses": "...",
      "sectors": ["...", "..."],
      "productTypes": ["...", "..."],
      "lendingPolicy": "...",
      "insights": "...",
      "summary": "..."
    }
  `;

    try {
        const response = await generateText(refinementPrompt);

        // Better JSON extraction: look for first { and last }
        const start = response.indexOf('{');
        const end = response.lastIndexOf('}');

        if (start === -1 || end === -1 || end < start) {
            console.error("[Lender Research] No JSON found in response:", response);
            throw new Error("No JSON in refinement output");
        }

        const jsonStr = response.substring(start, end + 1);
        let parsed;
        try {
            parsed = JSON.parse(repairJson(jsonStr));
        } catch (parseErr) {
            console.error("[Lender Research] JSON parse failed:", jsonStr);
            throw parseErr;
        }

        const result = lenderResearchResultSchema.parse(parsed);

        // Step 3: Update the lender in storage
        const updateData: any = {
            creditAppetite: result.creditAppetite || lender?.creditAppetite,
            keyStrengths: result.keyStrengths || lender?.keyStrengths,
            keyWeaknesses: result.keyWeaknesses || lender?.keyWeaknesses,
            lendingPolicy: result.lendingPolicy || lender?.lendingPolicy,
            insights: result.insights || lender?.insights,
            notes: (result.summary && result.summary.length > 10) ? result.summary : lender?.notes,
            updatedAt: new Date().toISOString()
        };

        // Only update array fields if we found something useful
        if (result.productTypes && result.productTypes.length > 0) updateData.productTypes = result.productTypes;
        if (result.sectors && result.sectors.length > 0) updateData.sectors = result.sectors;

        if (lenderId) {
            await storage.updateLender(lenderId, userId, updateData);
        }

        return result;
    } catch (err: any) {
        console.error(`[Lender Research] Refinement failed for ${institutionName}:`, err);
        throw new Error(`Failed to synthesize research: ${err.message}`);
    }
}
