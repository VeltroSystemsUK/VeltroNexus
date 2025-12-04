export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface TavilySearchResponse {
  results: TavilyResult[];
  query: string;
}

const BASE_URL = 'https://api.tavily.com/search';

export async function searchAdverseMedia(
  companyName: string,
  registrationNumber?: string
): Promise<TavilySearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY not configured");
  }

  const cleanName = companyName.replace(/"/g, '');
  
  const query = `"${cleanName}" ${registrationNumber ? `"${registrationNumber}"` : ''} "United Kingdom" AND (court OR judgment OR insolvency OR fraud OR "winding up" OR tribunal OR "adverse media")`;
  
  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: "advanced",
        include_answer: false,
        max_results: 5,
        include_domains: [],
        exclude_domains: ["linkedin.com", "facebook.com", "instagram.com", "glassdoor.co.uk", "indeed.co.uk"]
      })
    });

    if (!response.ok) {
      throw new Error(`Tavily API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      results: data.results || [],
      query: query
    };
  } catch (error) {
    console.error("Tavily Search Failed:", error);
    return {
      results: [],
      query: query
    };
  }
}

export function assessAdverseMediaRisk(results: TavilyResult[]): {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  flags: string[];
  summary: string;
} {
  const flags: string[] = [];
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  
  const highRiskTerms = ['fraud', 'criminal', 'prison', 'jail', 'banned', 'disqualified', 'money laundering'];
  const mediumRiskTerms = ['insolvency', 'liquidation', 'winding up', 'county court', 'ccj', 'judgment', 'tribunal', 'investigation'];
  
  for (const result of results) {
    const content = (result.content + ' ' + result.title).toLowerCase();
    
    for (const term of highRiskTerms) {
      if (content.includes(term)) {
        flags.push(`High-risk term found: "${term}" in ${result.title}`);
        riskLevel = 'HIGH';
      }
    }
    
    for (const term of mediumRiskTerms) {
      if (content.includes(term) && riskLevel !== 'HIGH') {
        flags.push(`Concern found: "${term}" in ${result.title}`);
        if (riskLevel === 'LOW') riskLevel = 'MEDIUM';
      }
    }
  }
  
  let summary = '';
  if (riskLevel === 'HIGH') {
    summary = `Critical adverse media findings detected. ${flags.length} significant concerns identified requiring immediate attention.`;
  } else if (riskLevel === 'MEDIUM') {
    summary = `Some concerning findings in public records. ${flags.length} items require further investigation.`;
  } else if (results.length > 0) {
    summary = `No significant adverse findings. ${results.length} general mentions found in public records.`;
  } else {
    summary = 'No adverse media or public record concerns found.';
  }
  
  return { riskLevel, flags, summary };
}
