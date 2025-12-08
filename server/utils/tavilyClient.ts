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

export interface ContactEnrichmentResult {
  emails: string[];
  phones: string[];
  linkedinUrls: string[];
  sources: { url: string; title: string; snippet: string }[];
}

export async function searchContactInfo(
  personName: string,
  companyName?: string
): Promise<ContactEnrichmentResult> {
  const apiKey = process.env.TAVILY_API_KEY;
  
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY not configured");
  }

  const cleanName = personName.replace(/"/g, '');
  const cleanCompany = companyName?.replace(/"/g, '') || '';
  
  // Build search query for contact information
  const query = `"${cleanName}" ${cleanCompany ? `"${cleanCompany}"` : ''} (email OR "contact" OR phone OR mobile OR linkedin OR "director")`;
  
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
        max_results: 10,
        include_domains: ["linkedin.com", "companieshouse.gov.uk", "endole.co.uk", "duedil.com", "companycheck.co.uk"],
        exclude_domains: []
      })
    });

    if (!response.ok) {
      throw new Error(`Tavily API Error: ${response.statusText}`);
    }

    const data = await response.json();
    const results = data.results || [];
    
    // Extract emails, phones, and LinkedIn URLs from results
    const emails = new Set<string>();
    const phones = new Set<string>();
    const linkedinUrls = new Set<string>();
    const sources: { url: string; title: string; snippet: string }[] = [];
    
    // Email regex pattern
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    // UK phone pattern (various formats)
    const phonePattern = /(?:\+44|0)(?:\s?[0-9]{2,4}){2,4}[0-9]{2,4}/g;
    // LinkedIn URL pattern
    const linkedinPattern = /linkedin\.com\/in\/[a-zA-Z0-9-]+/g;
    
    for (const result of results) {
      const content = result.content + ' ' + result.title + ' ' + result.url;
      
      // Extract emails
      const foundEmails = content.match(emailPattern) || [];
      foundEmails.forEach((e: string) => emails.add(e.toLowerCase()));
      
      // Extract phones
      const foundPhones = content.match(phonePattern) || [];
      foundPhones.forEach((p: string) => phones.add(p.replace(/\s/g, '')));
      
      // Extract LinkedIn URLs
      const foundLinkedin = content.match(linkedinPattern) || [];
      foundLinkedin.forEach((l: string) => linkedinUrls.add('https://' + l));
      
      // Also check if the URL itself is a LinkedIn profile
      if (result.url.includes('linkedin.com/in/')) {
        linkedinUrls.add(result.url);
      }
      
      sources.push({
        url: result.url,
        title: result.title,
        snippet: result.content.substring(0, 200)
      });
    }
    
    return {
      emails: Array.from(emails),
      phones: Array.from(phones),
      linkedinUrls: Array.from(linkedinUrls),
      sources
    };
  } catch (error) {
    console.error("Contact Info Search Failed:", error);
    return {
      emails: [],
      phones: [],
      linkedinUrls: [],
      sources: []
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
