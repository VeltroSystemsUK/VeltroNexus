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
  profileImages: string[];
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
  
  // Step 1: Search for the person at the company (general contact info)
  const generalQuery = cleanCompany 
    ? `"${cleanName}" AND "${cleanCompany}" (email OR contact OR phone OR mobile OR director)`
    : `"${cleanName}" (email OR contact OR phone OR mobile OR director)`;
  
  // Step 2: LinkedIn searches - find company page and people
  // Search for the specific person at the company
  const linkedinPersonQuery = cleanCompany
    ? `site:linkedin.com/in "${cleanName}" "${cleanCompany}"`
    : `site:linkedin.com/in "${cleanName}"`;
  
  // Search for company page and associated people/employees
  const linkedinCompanyQuery = cleanCompany
    ? `site:linkedin.com "${cleanCompany}" (people OR employees OR team OR staff)`
    : null;
  
  try {
    // Run all searches in parallel
    const searchPromises = [
      // General contact info search
      fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: generalQuery,
          search_depth: "advanced",
          include_answer: false,
          max_results: 8,
          include_domains: ["companieshouse.gov.uk", "endole.co.uk", "duedil.com", "companycheck.co.uk"],
          exclude_domains: ["linkedin.com"]
        })
      }),
      // LinkedIn person search
      fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: linkedinPersonQuery,
          search_depth: "advanced",
          include_answer: false,
          max_results: 5,
          include_domains: ["linkedin.com"],
          exclude_domains: []
        })
      })
    ];
    
    // Add company LinkedIn search if we have a company name
    if (linkedinCompanyQuery) {
      searchPromises.push(
        fetch(BASE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: apiKey,
            query: linkedinCompanyQuery,
            search_depth: "advanced",
            include_answer: false,
            max_results: 5,
            include_domains: ["linkedin.com"],
            exclude_domains: []
          })
        })
      );
    }
    
    const responses = await Promise.all(searchPromises);

    for (const response of responses) {
      if (!response.ok) {
        throw new Error(`Tavily API Error`);
      }
    }

    const dataResults = await Promise.all(responses.map(r => r.json()));
    
    // Combine results from all searches
    const results: TavilyResult[] = [];
    for (const data of dataResults) {
      if (data.results) {
        results.push(...data.results);
      }
    }
    
    // Extract emails, phones, and LinkedIn URLs from results
    const emails = new Set<string>();
    const phones = new Set<string>();
    const linkedinUrls = new Set<string>();
    const profileImages = new Set<string>();
    const sources: { url: string; title: string; snippet: string }[] = [];
    
    // Email regex pattern
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    // LinkedIn URL pattern - match personal profile URLs
    // Format: linkedin.com/in/username or linkedin.com/pub/name/etc
    const linkedinPattern = /linkedin\.com\/in\/[a-zA-Z0-9_-]+/gi;
    
    // UK phone patterns - recognize common UK phone formats
    // UK mobiles: 07xxx xxxxxx, +44 7xxx xxxxxx
    // UK landlines: 01234 567890, 0121 234 5678, 020 1234 5678, etc.
    // Allow various separators: spaces, hyphens, dots
    const phonePattern = /(?:\+44[\s.-]?|0)(?:7[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{3}|[1-3]\d{2,3}[\s.-]?\d{3}[\s.-]?\d{3,4})/g;
    
    // Function to validate phone number format
    const isValidPhoneNumber = (phone: string): boolean => {
      // Remove all non-digit characters except leading +
      const cleaned = phone.replace(/[^\d+]/g, '');
      
      // Must start with +44 or 0
      if (cleaned.startsWith('+44')) {
        // +44 followed by 10 digits
        const digitsOnly = cleaned.replace('+44', '');
        return digitsOnly.length >= 9 && digitsOnly.length <= 11;
      }
      if (cleaned.startsWith('0')) {
        // UK local format: 10-11 digits starting with 0
        return cleaned.length >= 10 && cleaned.length <= 11;
      }
      return false;
    };
    
    for (const result of results) {
      const content = result.content + ' ' + result.title + ' ' + result.url;
      
      // Extract emails
      const foundEmails = content.match(emailPattern) || [];
      foundEmails.forEach((e: string) => emails.add(e.toLowerCase()));
      
      // Extract UK phones
      const foundPhones = content.match(phonePattern) || [];
      foundPhones.forEach((p: string) => {
        // Clean up: remove separators but keep +
        const cleaned = p.replace(/[\s.-]/g, '');
        if (isValidPhoneNumber(cleaned)) {
          // Format nicely for display
          phones.add(cleaned);
        }
      });
      
      // Extract LinkedIn URLs
      const foundLinkedin = content.match(linkedinPattern) || [];
      foundLinkedin.forEach((l: string) => {
        // Ensure URL starts with https://
        const url = 'https://' + l.toLowerCase();
        linkedinUrls.add(url);
      });
      
      // Also check if the URL itself is a LinkedIn profile
      if (result.url.includes('linkedin.com/in/')) {
        linkedinUrls.add(result.url);
      }
      
      // Extract profile images from common image URL patterns
      const imagePattern = /https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|webp)(\?[^\s"'<>]*)?/gi;
      const foundImages = content.match(imagePattern) || [];
      foundImages.forEach((img: string) => {
        // Filter to likely profile pictures (exclude small icons, logos, etc.)
        const lowerImg = img.toLowerCase();
        if (
          (lowerImg.includes('profile') || 
           lowerImg.includes('avatar') || 
           lowerImg.includes('photo') ||
           lowerImg.includes('headshot') ||
           lowerImg.includes('portrait') ||
           lowerImg.includes('linkedin') ||
           lowerImg.includes('media.licdn')) &&
          !lowerImg.includes('icon') &&
          !lowerImg.includes('logo') &&
          !lowerImg.includes('banner') &&
          !lowerImg.includes('thumbnail')
        ) {
          profileImages.add(img);
        }
      });
      
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
      profileImages: Array.from(profileImages),
      sources
    };
  } catch (error) {
    console.error("Contact Info Search Failed:", error);
    return {
      emails: [],
      phones: [],
      linkedinUrls: [],
      profileImages: [],
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
