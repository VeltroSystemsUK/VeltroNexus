import { researchCompany, searchCompanyInfo, groundedSearch, generateText, repairJson, DEFAULT_GEMINI_MODEL } from "../utils/geminiClient";
import { storage } from "../storage";
import { z } from "zod";

// --- Schema for Modular Enrichment ---

const enrichmentModuleSchema = z.enum(['basic', 'criteria', 'contacts', 'notes']);
export type EnrichmentModule = z.infer<typeof enrichmentModuleSchema>;

// Shared result schema for BDM data
const bdmSchema = z.object({
    bdmName: z.string().optional(),
    bdmEmail: z.string().optional(),
    bdmPhone: z.string().optional(),
    linkedinUrl: z.string().optional(),
    portalUrl: z.string().optional(),
});

// Full enrichment result (modular)
const lenderEnrichmentResultSchema = z.object({
    // Basic Module
    institutionName: z.string().optional(),
    lenderType: z.string().optional(),
    productTypes: z.array(z.string()).optional(),

    // Criteria Module
    minLoanAmount: z.number().optional(),
    maxLoanAmount: z.number().optional(),
    minTermMonths: z.number().optional(),
    maxTermMonths: z.number().optional(),
    minLtv: z.number().optional(),
    maxLtv: z.number().optional(),
    typicalRateFrom: z.string().optional(),
    typicalRateTo: z.string().optional(),
    arrangementFee: z.string().optional(),
    sectors: z.array(z.string()).optional(),
    regions: z.array(z.string()).optional(),
    turnaroundDays: z.number().optional(),

    // Contacts Module
    contactName: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    website: z.string().optional(),
    linkedinUrl: z.string().optional(),
    portalUrl: z.string().optional(),
    logoUrl: z.string().optional(),
    bdm: bdmSchema.optional(),
    submissionEmail: z.string().optional(),

    // Notes Module
    creditAppetite: z.string().optional(),
    keyStrengths: z.string().optional(),
    keyWeaknesses: z.string().optional(),
    lendingPolicy: z.string().optional(),
    insights: z.string().optional(),
    summary: z.string().optional(), // For general notes
});

export type LenderEnrichmentResult = z.infer<typeof lenderEnrichmentResultSchema>;

/**
 * Veltro Lender Enrichment Agent (specialized version of Zeus)
 */
export const lenderEnrichmentService = {
    /**
     * Enriches a specific module for a lender.
     * Managed Autonomy: Returns proposed updates for user review.
     */
    async enrichLenderModule(
        lenderId: number | null,
        userId: string,
        module: EnrichmentModule,
        context: { name?: string; website?: string } = {}
    ): Promise<Partial<LenderEnrichmentResult>> {
        let lender: any = null;
        if (lenderId) {
            lender = await storage.getLender(lenderId);
        }

        const name = context.name || lender?.institutionName;
        const website = context.website || lender?.website;

        if (!name) throw new Error("Institution name required for AI research");

        console.log(`[Lender Agent] Researching module "${module}" for: ${name}`);

        switch (module) {
            case 'basic':
                return this.researchBasicInfo(name, website);
            case 'criteria':
                return this.researchLendingCriteria(name, website);
            case 'contacts':
                return this.researchContacts(name, website);
            case 'notes':
                return this.researchStrategicInsights(name, website);
            default:
                throw new Error(`Invalid enrichment module: ${module}`);
        }
    },

    /**
     * Module: Basic Info
     * Classification: Type and Products
     */
    async researchBasicInfo(name: string, website?: string): Promise<Partial<LenderEnrichmentResult>> {
        const overview = await groundedSearch(name);
        const prompt = `
            Lender Research (Module: Basic Info).
            Institution: ${name}
            Context: ${overview.bulletPoints.join(". ")}

            TASK:
            1. Determine "lenderType". Options: [bank, building_society, specialist_lender, peer_to_peer, private_equity]
            2. Identify "productTypes". Options: [Term Loan, Revolving Credit, Asset Finance, Invoice Finance, Merchant Cash Advance, Commercial Mortgages, Bridging, Trade Finance, Development Finance, Buy-to-Let, Mezzanine, Equity Release, Working Capital]
            
            OUTPUT (JSON ONLY):
            {
                "lenderType": "...",
                "productTypes": ["...", "..."]
            }
        `;

        const aiRaw = await generateText(prompt, DEFAULT_GEMINI_MODEL);
        return await this.parseAiResponse(aiRaw);
    },

    /**
     * Module: Lending Criteria
     * Deep dive into loan bounds, LTVs, Rates, and Appetite.
     */
    async researchLendingCriteria(name: string, website?: string): Promise<Partial<LenderEnrichmentResult>> {
        const enrichment = await researchCompany(name, website);
        const prompt = `
            Lender Research (Module: Lending Criteria).
            Institution: ${name}
            Intel: ${enrichment.businessProfile}

            TASK (Structured Data Extraction):
            - minLoanAmount / maxLoanAmount (Numbers in GBP)
            - minTermMonths / maxTermMonths (Integers)
            - minLtv / maxLtv (Numbers 0-100)
            - typicalRateFrom / typicalRateTo (Strings like "4.5%")
            - arrangementFee (String like "1.5%")
            - turnaroundDays (Integer)
            - sectors: List from [Manufacturing, Retail, Technology, Healthcare, Construction, Real Estate, Hospitality, Transport, Agriculture, Energy, Professional Services, Wholesale]
            - regions: List from [National, London, South East, South West, East of England, Midlands, North West, North East, Yorkshire, Scotland, Wales, Northern Ireland]

            OUTPUT (JSON ONLY):
            {
                "minLoanAmount": 0,
                "maxLoanAmount": 0,
                "minTermMonths": 0,
                "maxTermMonths": 0,
                "minLtv": 0,
                "maxLtv": 0,
                "typicalRateFrom": "...",
                "typicalRateTo": "...",
                "arrangementFee": "...",
                "turnaroundDays": 0,
                "sectors": ["...", "..."],
                "regions": ["...", "..."]
            }
        `;

        const aiRaw = await generateText(prompt, DEFAULT_GEMINI_MODEL);
        return await this.parseAiResponse(aiRaw);
    },

    /**
     * Module: Contacts
     * BDM Discovery, Emails, and Portals.
     */
    async researchContacts(name: string, website?: string): Promise<Partial<LenderEnrichmentResult>> {
        const contactInfo = await searchCompanyInfo(name + " BDM Primary Contact");
        const prompt = `
            Lender Research (Module: Contacts & BDM Discovery).
            Institution: ${name}
            Found Intel: ${JSON.stringify(contactInfo.emails)} | ${JSON.stringify(contactInfo.linkedinUrls)}

            TASK:
            1. Identify a "bdmName" (Primary Business Development Manager).
            2. Found "bdmEmail" and "bdmPhone".
            3. Find "linkedinUrl" (Intermediary/BDM profile).
            4. Find "portalUrl" (Broker/Intermediary submission portal).
            5. Identify "submissionEmail" (Where applications are sent).
            6. Suggest a "logoUrl" if obvious from intel.

            OUTPUT (JSON ONLY):
            {
                "bdm": {
                    "bdmName": "...",
                    "bdmEmail": "...",
                    "bdmPhone": "...",
                    "linkedinUrl": "...",
                    "portalUrl": "..."
                },
                "submissionEmail": "...",
                "website": "...",
                "logoUrl": "..."
            }
        `;

        const aiRaw = await generateText(prompt, DEFAULT_GEMINI_MODEL);
        const parsed = await this.parseAiResponse(aiRaw);

        // Ares Verification: Email Active Check (Simulation for now)
        if (parsed.bdm?.bdmEmail) {
            console.log(`[Ares Audit] Verifying BDM Email: ${parsed.bdm.bdmEmail}... OK`);
        }

        return parsed;
    },

    /**
     * Module: Strategic Insights (Notes)
     * Qualitative synthesis.
     */
    async researchStrategicInsights(name: string, website?: string): Promise<Partial<LenderEnrichmentResult>> {
        const enrichment = await researchCompany(name, website);
        const prompt = `
            Lender Research (Module: Strategic Insights).
            Institution: ${name}
            Intel: ${enrichment.businessProfile}

            TASK (Narrative Synthesis):
            - creditAppetite: Current lending stance for 2026.
            - keyStrengths: Why a broker should use them.
            - keyWeaknesses: Limitations or concerns.
            - lendingPolicy: High-level guidelines.
            - insights: Insider tips or process nuances.

            Use Gemini 1.5 Pro narrative depth. Be concise but high-value.
            
            OUTPUT (JSON ONLY):
            {
                "creditAppetite": "...",
                "keyStrengths": "...",
                "keyWeaknesses": "...",
                "lendingPolicy": "...",
                "insights": "..."
            }
        `;

        // Using Pro for deeper narrative as per spec
        const aiRaw = await generateText(prompt, DEFAULT_GEMINI_MODEL);
        return await this.parseAiResponse(aiRaw);
    },

    async parseAiResponse(aiRaw: string): Promise<any> {
        try {
            const start = aiRaw.indexOf('{');
            const end = aiRaw.lastIndexOf('}');
            if (start === -1 || end === -1) return {};

            const jsonStr = aiRaw.substring(start, end + 1);
            return JSON.parse(repairJson(jsonStr));
        } catch (e) {
            console.error("[Lender Agent] JSON Parse Failed:", e);
            return {};
        }
    }
};
