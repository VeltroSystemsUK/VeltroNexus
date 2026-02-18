import { searchCompanies, CompaniesHouseSearchResult } from "../utils/companiesHouseClient";
import { searchExa } from "../utils/exaClient";
import { generateText, repairJson, groundedSearch } from "../utils/geminiClient";
import { z } from "zod";

export const discoveryResultSchema = z.object({
  institutionName: z.string(),
  website: z.string().optional(),
  description: z.string().optional(),
  lenderType: z.string().optional(),
  productTypes: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(100),
  source: z.string(),
  reason: z.string().optional(), // Why it was found / why it's a good match
});

export type DiscoveryResult = z.infer<typeof discoveryResultSchema>;

export async function discoverNewLenders(query: string): Promise<DiscoveryResult[]> {
  console.log(`[Discovery Service] Starting search for: ${query}`);

  // 1. Concurrent searches across both source APIs
  const [chResults, exaResults, groundedResults] = await Promise.allSettled([
    searchCompanies(query, 5),
    searchExa(`${query} UK business lender funding company`, 5),
    groundedSearch(query)
  ]);

  const rawData = {
    companiesHouse: chResults.status === 'fulfilled' ? chResults.value : [],
    exa: exaResults.status === 'fulfilled' ? exaResults.value : [],
    grounded: groundedResults.status === 'fulfilled' ? groundedResults.value : { bulletPoints: [], sources: [] }
  };

  console.log(`[Discovery Service] Raw results count - CH: ${rawData.companiesHouse.length}, Exa: ${rawData.exa.length}, Grounded Bullets: ${rawData.grounded.bulletPoints?.length || 0}`);

  // 2. Synthesize with Gemini
  const synthesisPrompt = `
    You are an expert FinTech Analyst. Your task is to find NEW or RECENTLY LAUNCHED commercial lenders based on the provided search data.
    
    SEARCH QUERY: "${query}"
    
    RAW DATA FROM MULTIPLE SOURCES:
    --- COMPANIES HOUSE (Official Entities) ---
    ${JSON.stringify(rawData.companiesHouse, null, 2)}
    
    --- EXA (Neural Web Search) ---
    ${JSON.stringify(rawData.exa, null, 2)}
    
    --- GROUNDED DATA (Business Intelligence) ---
    ${JSON.stringify(rawData.grounded, null, 2)}
    
    TASK:
    1. Identify the most likely "Commercial Lenders" from this aggregate data.
    2. Ignore generic businesses that are NOT lenders. 
    3. For each valid candidate, provide:
       - institutionName
       - website (if found)
       - description (1-2 sentences overview)
       - lenderType (one of: "bank", "tier1.0", "tier1.5", "tier2.0", "tier2.5", "tier3.0")
       - productTypes (e.g. ["Term Loan", "Asset Finance"])
       - confidence (Score 0-100 on how sure you are this is a relevant lender for the query)
       - reason (Briefly explain why this lender matched the search query)
    
    OUTPUT FORMAT (JSON ONLY):
    {
      "results": [
        {
          "institutionName": "...",
          "website": "...",
          "description": "...",
          "lenderType": "...",
          "productTypes": ["...", "..."],
          "confidence": 85,
          "source": "AI Synthesis",
          "reason": "..."
        }
      ]
    }
  `;

  try {
    console.log(`[Discovery Service] Sending synthesis request to Gemini...`);
    const response = await generateText(synthesisPrompt);
    const start = response.indexOf('{');
    const end = response.lastIndexOf('}');

    if (start === -1 || end === -1) {
      console.error("[Discovery Service] No JSON found in Gemini response");
      console.debug("[Discovery Service] Raw Gemini Response:", response);
      return [];
    }

    const jsonStr = response.substring(start, end + 1);
    const repairedJsonStr = repairJson(jsonStr);
    const parsed = JSON.parse(repairedJsonStr);

    console.log(`[Discovery Service] Synthesis complete. Found ${parsed.results?.length || 0} candidates.`);

    return (parsed.results || []).map((r: any) => {
      try {
        const data = { ...r, source: r.source || "AI Synthesis" };
        return discoveryResultSchema.parse(data);
      } catch (err: any) {
        console.warn(`[Discovery Service] Skipping malformed result for "${r.institutionName}":`, err.message);
        return null;
      }
    }).filter(Boolean) as DiscoveryResult[];
  } catch (error: any) {
    console.error("[Discovery Service] Critical Synthesis Error:", error.message || error);
    throw new Error("Failed to synthesize discovery results.");
  }
}
