// import { browser_subagent } from "../tools/browser";
import { generateText } from "../utils/geminiClient";

/**
 * Contact Enrichment Service
 * 
 * Uses browser automation and AI to scrape company websites for contact information
 */

export interface ContactData {
    email?: string;
    name?: string;
    title?: string;
    phone?: string;
    linkedInUrl?: string;
    websiteUrl?: string;
    enrichmentScore: number;
    confidence: number;
    source: string;
}

export interface EnrichedProspect {
    companyNumber: string;
    companyName: string;
    contacts: ContactData[];
    primaryContact?: ContactData;
    websiteUrl?: string;
    enrichmentStatus: "success" | "partial" | "failed";
    failureReason?: string;
    enrichedAt: Date;
}

export class ContactEnrichmentService {
    /**
     * Main enrichment method - orchestrates the entire process
     */
    async enrichProspect(
        companyNumber: string,
        companyName: string,
        registeredAddress?: string
    ): Promise<EnrichedProspect> {
        console.log(`[Contact Enrichment] Starting advanced enrichment for ${companyName}`);
        const { findEmail } = await import("../utils/scraperUtils");

        try {
            // Step 1: Find company website and email using waterfall
            // We use the company name as a base for search if website is unknown
            const emailResult = await findEmail(companyName, null);

            // If we found an email, we likely found a website during crawling
            // We'll need to extract the website from the discovery process if possible, 
            // but for now let's use the found email's domain or original candidate logic.
            const websiteUrl = emailResult ? `https://www.${emailResult.email.split('@')[1]}` : await this.findCompanyWebsite(companyName);

            if (!websiteUrl) {
                return {
                    companyNumber,
                    companyName,
                    contacts: [],
                    enrichmentStatus: "failed",
                    failureReason: "Website not found",
                    enrichedAt: new Date(),
                };
            }

            console.log(`[Contact Enrichment] Found/Guessed website: ${websiteUrl}`);

            // Step 2: Scrape contact page
            const contactPageData = await this.scrapeContactPage(websiteUrl);

            // Step 3: Extract contacts using AI
            const contacts = await this.extractContacts(contactPageData, companyName);

            // If we have an email from findEmail, add it to contacts if not already there
            if (emailResult && !contacts.some(c => c.email === emailResult.email)) {
                contacts.push({
                    email: emailResult.email,
                    name: "Discovered Contact",
                    title: "Decision Maker",
                    confidence: 0.8,
                    source: "Waterfall Scraper",
                    enrichmentScore: 80
                });
            }

            // Step 4: Score and validate
            const scoredContacts = contacts.map(contact => ({
                ...contact,
                enrichmentScore: contact.enrichmentScore || this.scoreContactQuality(contact),
            }));

            // Sort by score and pick primary
            scoredContacts.sort((a, b) => b.enrichmentScore - a.enrichmentScore);
            const primaryContact = scoredContacts[0];

            return {
                companyNumber,
                companyName,
                contacts: scoredContacts,
                primaryContact,
                websiteUrl,
                enrichmentStatus: scoredContacts.length > 0 ? "success" : "partial",
                enrichedAt: new Date(),
            };

        } catch (error) {
            console.error(`[Contact Enrichment] Failed for ${companyName}:`, error);
            return {
                companyNumber,
                companyName,
                contacts: [],
                enrichmentStatus: "failed",
                failureReason: error instanceof Error ? error.message : "Unknown error",
                enrichedAt: new Date(),
            };
        }
    }

    /**
     * Find company website using search or convention
     */
    async findCompanyWebsite(companyName: string): Promise<string | null> {
        console.log(`[Contact Enrichment] Finding website for ${companyName}`);

        // Clean company name for URL construction
        const cleanName = companyName
            .toLowerCase()
            .replace(/\s+ltd$/i, "")
            .replace(/\s+limited$/i, "")
            .replace(/\s+plc$/i, "")
            .replace(/\s+&\s+/g, "-")
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "");

        // Try common patterns - in a real scenario we'd use a search API like Tavily or Google
        return `https://www.${cleanName}.co.uk`;
    }

    /**
     * Scrape contact page using browser automation
     */
    async scrapeContactPage(websiteUrl: string): Promise<string> {
        console.log(`[Contact Enrichment] Scraping ${websiteUrl}`);

        // Common contact page paths
        const contactPaths = [
            "/contact",
            "/contact-us",
            "/get-in-touch",
            "/about/contact",
            "/about/team",
            "/meet-the-team",
        ];

        let scrapedContent = "";

        try {
            // Try homepage first
            const homepageContent = await this.fetchPageContent(websiteUrl);
            scrapedContent += `\n--- HOMEPAGE ---\n${homepageContent}\n`;

            // Try contact pages
            for (const path of contactPaths) {
                try {
                    const url = new URL(path, websiteUrl).href;
                    const content = await this.fetchPageContent(url);
                    scrapedContent += `\n--- ${path.toUpperCase()} ---\n${content}\n`;
                } catch (e) {
                    // Skip if page doesn't exist
                    continue;
                }
            }

            return scrapedContent;
        } catch (error) {
            console.error(`[Contact Enrichment] Scraping failed:`, error);
            return "";
        }
    }

    /**
     * Fetch page content using shared fetch utility
     */
    private async fetchPageContent(url: string, useScrapingBee: boolean = false): Promise<string> {
        const apiKey = process.env.SCRAPINGBEE_API_KEY;
        try {
            if (useScrapingBee && apiKey) {
                const params = new URLSearchParams({
                    api_key: apiKey,
                    url,
                    render_js: 'false',
                    timeout: "30000"
                });
                const res = await fetch(`https://app.scrapingbee.com/api/v1/?${params.toString()}`);
                return res.ok ? await res.text() : "";
            } else {
                const res = await fetch(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
                    signal: AbortSignal.timeout(15000)
                });
                return res.ok ? await res.text() : "";
            }
        } catch (error) {
            console.error(`[Contact Enrichment] Fetch failed for ${url}:`, error);
            return "";
        }
    }

    /**
     * Extract contacts from scraped content using AI
     */
    async extractContacts(
        htmlContent: string,
        companyName: string
    ): Promise<ContactData[]> {
        console.log(`[Contact Enrichment] Extracting contacts with AI`);

        const prompt = `You are a contact information extraction specialist. Analyze this website content and extract all contact information.

COMPANY: ${companyName}

WEBSITE CONTENT:
${htmlContent.substring(0, 4000)} // Limit to avoid token overflow

EXTRACT THE FOLLOWING:
1. Email addresses (prioritize: CFO, Finance Director, Managing Director, CEO, or finance@/accounts@)
2. Contact names with titles
3. Phone numbers (UK format preferred)
4. LinkedIn profile URLs

RULES:
- Prioritize decision-makers (CFO, Finance Director, MD, CEO, Owner)
- Avoid generic emails like info@, hello@, support@ (unless nothing better exists)
- Match email addresses to names if possible
- Validate email format

Return ONLY valid JSON array:
[
  {
    "email": "name@company.co.uk",
    "name": "John Smith",
    "title": "Finance Director",
    "phone": "+44 20 1234 5678",
    "linkedInUrl": "https://linkedin.com/in/...",
    "confidence": 0.9,
    "source": "contact page"
  }
]

If no contacts found, return empty array: []`;

        try {
            const response = await generateText(prompt);

            // Extract JSON from response
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                console.log(`[Contact Enrichment] No JSON found in AI response`);
                return [];
            }

            const contacts = JSON.parse(jsonMatch[0]) as ContactData[];
            console.log(`[Contact Enrichment] Extracted ${contacts.length} contacts`);

            return contacts.map(contact => ({
                ...contact,
                websiteUrl: undefined, // Will be set by caller
                enrichmentScore: 0, // Will be calculated by caller
            }));

        } catch (error) {
            console.error(`[Contact Enrichment] AI extraction failed:`, error);
            return [];
        }
    }

    /**
     * Validate email format
     */
    validateEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Score contact quality (0-100)
     */
    scoreContactQuality(contact: ContactData): number {
        let score = 0;

        // Email validation and type
        if (contact.email) {
            if (!this.validateEmail(contact.email)) {
                return 0; // Invalid email = 0 score
            }

            // Named email (john.smith@) = 40 points
            // Role email (finance@, accounts@) = 25 points
            // Generic (info@, hello@) = 10 points
            if (contact.email.match(/^[a-z]+\.[a-z]+@/i)) {
                score += 40;
            } else if (contact.email.match(/^(finance|accounts|cfo|director)@/i)) {
                score += 25;
            } else {
                score += 10;
            }
        }

        // Has decision-maker title
        if (contact.title) {
            const importantTitles = /(cfo|finance director|managing director|md|ceo|owner|director)/i;
            if (importantTitles.test(contact.title)) {
                score += 30;
            } else {
                score += 15;
            }
        }

        // Has phone number
        if (contact.phone) {
            score += 10;
        }

        // Has LinkedIn
        if (contact.linkedInUrl) {
            score += 10;
        }

        // Has name
        if (contact.name) {
            score += 10;
        }

        return Math.min(score, 100);
    }

    /**
     * Batch enrich multiple prospects
     */
    async enrichMultiple(
        prospects: Array<{ companyNumber: string; companyName: string }>
    ): Promise<EnrichedProspect[]> {
        console.log(`[Contact Enrichment] Batch enriching ${prospects.length} prospects`);

        const results: EnrichedProspect[] = [];

        for (const prospect of prospects) {
            const enriched = await this.enrichProspect(
                prospect.companyNumber,
                prospect.companyName
            );
            results.push(enriched);

            // Rate limiting - 2 second delay between requests
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        return results;
    }
}

export const contactEnrichment = new ContactEnrichmentService();
