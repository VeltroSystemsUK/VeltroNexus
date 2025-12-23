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

const BASE_URL = "https://api.tavily.com/search";

export async function searchAdverseMedia(
  companyName: string,
  registrationNumber?: string
): Promise<TavilySearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error("TAVILY_API_KEY not configured");
  }

  const cleanName = companyName.replace(/"/g, "");

  const query = `"${cleanName}" ${registrationNumber ? `"${registrationNumber}"` : ""} "United Kingdom" AND (court OR judgment OR insolvency OR fraud OR "winding up" OR tribunal OR "adverse media")`;

  try {
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: "advanced",
        include_answer: false,
        max_results: 5,
        include_domains: [],
        exclude_domains: [
          "linkedin.com",
          "facebook.com",
          "instagram.com",
          "glassdoor.co.uk",
          "indeed.co.uk",
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      results: data.results || [],
      query: query,
    };
  } catch (error) {
    console.error("Tavily Search Failed:", error);
    return {
      results: [],
      query: query,
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

  const cleanName = personName.replace(/"/g, "");
  const cleanCompany = companyName?.replace(/"/g, "") || "";

  // Build search query for general contact info
  const generalQuery = cleanCompany
    ? `"${cleanName}" AND "${cleanCompany}" (email OR contact OR phone OR mobile OR director)`
    : `"${cleanName}" (email OR contact OR phone OR mobile OR director)`;

  try {
    // Single search for contact info - LinkedIn search removed (user uses manual workflow)
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: generalQuery,
        search_depth: "advanced",
        include_answer: false,
        max_results: 10,
        include_domains: [
          "companieshouse.gov.uk",
          "endole.co.uk",
          "duedil.com",
          "companycheck.co.uk",
        ],
        exclude_domains: ["linkedin.com"],
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API Error: ${response.statusText}`);
    }

    const data = await response.json();
    const results: TavilyResult[] = data.results || [];

    // Extract emails, phones, and LinkedIn URLs from results
    const emails = new Set<string>();
    const phones = new Set<string>();
    const linkedinUrls = new Set<string>();
    const profileImages = new Set<string>();
    const sources: { url: string; title: string; snippet: string }[] = [];

    // Email regex pattern
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    // LinkedIn URL pattern - match company pages and profile pages
    const linkedinCompanyPattern = /linkedin\.com\/company\/[a-zA-Z0-9_-]+/gi;
    const linkedinProfilePattern = /linkedin\.com\/in\/[a-zA-Z0-9_-]+/gi;

    // UK phone patterns - recognize common UK phone formats
    // UK mobiles: 07xxx xxxxxx, +44 7xxx xxxxxx
    // UK landlines: 01234 567890, 0121 234 5678, 020 1234 5678, etc.
    // Allow various separators: spaces, hyphens, dots
    const phonePattern =
      /(?:\+44[\s.-]?|0)(?:7[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{3}|[1-3]\d{2,3}[\s.-]?\d{3}[\s.-]?\d{3,4})/g;

    // Function to validate phone number format
    const isValidPhoneNumber = (phone: string): boolean => {
      // Remove all non-digit characters except leading +
      const cleaned = phone.replace(/[^\d+]/g, "");

      // Must start with +44 or 0
      if (cleaned.startsWith("+44")) {
        // +44 followed by 10 digits
        const digitsOnly = cleaned.replace("+44", "");
        return digitsOnly.length >= 9 && digitsOnly.length <= 11;
      }
      if (cleaned.startsWith("0")) {
        // UK local format: 10-11 digits starting with 0
        return cleaned.length >= 10 && cleaned.length <= 11;
      }
      return false;
    };

    for (const result of results) {
      const content = result.content + " " + result.title + " " + result.url;

      // Extract emails
      const foundEmails = content.match(emailPattern) || [];
      foundEmails.forEach((e: string) => emails.add(e.toLowerCase()));

      // Extract UK phones
      const foundPhones = content.match(phonePattern) || [];
      foundPhones.forEach((p: string) => {
        // Clean up: remove separators but keep +
        const cleaned = p.replace(/[\s.-]/g, "");
        if (isValidPhoneNumber(cleaned)) {
          // Format nicely for display
          phones.add(cleaned);
        }
      });

      // Extract LinkedIn company URLs
      const foundCompanyUrls = content.match(linkedinCompanyPattern) || [];
      foundCompanyUrls.forEach((l: string) => {
        const url = "https://" + l.toLowerCase();
        linkedinUrls.add(url);
      });

      // Extract LinkedIn profile URLs
      const foundProfileUrls = content.match(linkedinProfilePattern) || [];
      foundProfileUrls.forEach((l: string) => {
        const url = "https://" + l.toLowerCase();
        linkedinUrls.add(url);
      });

      // Also check if the URL itself is a LinkedIn page
      if (result.url.includes("linkedin.com/company/") || result.url.includes("linkedin.com/in/")) {
        linkedinUrls.add(result.url);
      }

      // Extract profile images from common image URL patterns
      const imagePattern = /https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|webp)(\?[^\s"'<>]*)?/gi;
      const foundImages = content.match(imagePattern) || [];
      foundImages.forEach((img: string) => {
        // Filter to likely profile pictures (exclude small icons, logos, etc.)
        const lowerImg = img.toLowerCase();
        if (
          (lowerImg.includes("profile") ||
            lowerImg.includes("avatar") ||
            lowerImg.includes("photo") ||
            lowerImg.includes("headshot") ||
            lowerImg.includes("portrait") ||
            lowerImg.includes("linkedin") ||
            lowerImg.includes("media.licdn")) &&
          !lowerImg.includes("icon") &&
          !lowerImg.includes("logo") &&
          !lowerImg.includes("banner") &&
          !lowerImg.includes("thumbnail")
        ) {
          profileImages.add(img);
        }
      });

      sources.push({
        url: result.url,
        title: result.title,
        snippet: result.content.substring(0, 200),
      });
    }

    return {
      emails: Array.from(emails),
      phones: Array.from(phones),
      linkedinUrls: Array.from(linkedinUrls),
      profileImages: Array.from(profileImages),
      sources,
    };
  } catch (error) {
    console.error("Contact Info Search Failed:", error);
    return {
      emails: [],
      phones: [],
      linkedinUrls: [],
      profileImages: [],
      sources: [],
    };
  }
}

export interface BusinessOverviewResult {
  bulletPoints: string[];
  sources: { url: string; title: string }[];
}

export async function searchBusinessOverview(
  companyName: string,
  industry?: string
): Promise<BusinessOverviewResult> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error("TAVILY_API_KEY not configured");
  }

  const cleanName = companyName.replace(/"/g, "");
  const industryContext = industry ? ` ${industry}` : "";

  const query = `"${cleanName}" UK company${industryContext} business overview products services history`;

  try {
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: "advanced",
        include_answer: true,
        max_results: 8,
        include_domains: [],
        exclude_domains: [
          "linkedin.com",
          "facebook.com",
          "instagram.com",
          "glassdoor.co.uk",
          "indeed.co.uk",
          "twitter.com",
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API Error: ${response.statusText}`);
    }

    const data = await response.json();
    const results: TavilyResult[] = data.results || [];
    
    // Extract key information and convert to bullet points
    const bulletPoints: string[] = [];
    const sources: { url: string; title: string }[] = [];

    // If Tavily provides an answer, add it as the first bullet point
    if (data.answer) {
      // Split answer into sentences and add as bullet points
      const sentences = data.answer
        .split(/[.!?]+/)
        .filter((s: string) => s.trim().length > 20)
        .map((s: string) => s.trim())
        .slice(0, 5);
      bulletPoints.push(...sentences);
    }

    // Extract key information from each result
    for (const result of results) {
      sources.push({ url: result.url, title: result.title });
      
      // Extract meaningful sentences from content
      const sentences = result.content
        .split(/[.!?]+/)
        .filter((s: string) => s.trim().length > 30 && s.trim().length < 200)
        .filter((s: string) => {
          const lower = s.toLowerCase();
          // Focus on business-relevant content
          return (
            lower.includes(cleanName.toLowerCase()) ||
            lower.includes("company") ||
            lower.includes("business") ||
            lower.includes("service") ||
            lower.includes("product") ||
            lower.includes("founded") ||
            lower.includes("established") ||
            lower.includes("specializ") ||
            lower.includes("provid") ||
            lower.includes("offer")
          );
        })
        .map((s: string) => s.trim())
        .slice(0, 2);
      
      bulletPoints.push(...sentences);
    }

    // Remove duplicates and limit to reasonable number
    const uniqueBullets = [...new Set(bulletPoints)].slice(0, 12);

    return {
      bulletPoints: uniqueBullets,
      sources: sources.slice(0, 5),
    };
  } catch (error) {
    console.error("Business Overview Search Failed:", error);
    return {
      bulletPoints: [],
      sources: [],
    };
  }
}

export function assessAdverseMediaRisk(results: TavilyResult[]): {
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  flags: string[];
  summary: string;
} {
  const flags: string[] = [];
  let riskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW";

  const highRiskTerms = [
    "fraud",
    "criminal",
    "prison",
    "jail",
    "banned",
    "disqualified",
    "money laundering",
  ];
  const mediumRiskTerms = [
    "insolvency",
    "liquidation",
    "winding up",
    "county court",
    "ccj",
    "judgment",
    "tribunal",
    "investigation",
  ];

  for (const result of results) {
    const content = (result.content + " " + result.title).toLowerCase();

    for (const term of highRiskTerms) {
      if (content.includes(term)) {
        flags.push(`High-risk term found: "${term}" in ${result.title}`);
        riskLevel = "HIGH";
      }
    }

    for (const term of mediumRiskTerms) {
      if (content.includes(term) && riskLevel !== "HIGH") {
        flags.push(`Concern found: "${term}" in ${result.title}`);
        if (riskLevel === "LOW") riskLevel = "MEDIUM";
      }
    }
  }

  let summary = "";
  if (riskLevel === "HIGH") {
    summary = `Critical adverse media findings detected. ${flags.length} significant concerns identified requiring immediate attention.`;
  } else if (riskLevel === "MEDIUM") {
    summary = `Some concerning findings in public records. ${flags.length} items require further investigation.`;
  } else if (results.length > 0) {
    summary = `No significant adverse findings. ${results.length} general mentions found in public records.`;
  } else {
    summary = "No adverse media or public record concerns found.";
  }

  return { riskLevel, flags, summary };
}
