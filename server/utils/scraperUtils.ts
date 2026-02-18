import * as cheerio from 'cheerio';
import { promises as dns } from 'dns';

/**
 * Shared scraper utilities for email discovery and website scraping.
 * Adopted from the Lead Finder Agent.
 */

// ─────────────────────────────────────────────
// Enums & Types
// ─────────────────────────────────────────────

export enum EmailConfidence {
    HIGH = 'HIGH',       // Direct mailto: link on homepage
    MEDIUM = 'MEDIUM',   // Contact page or regex extraction
    LOW = 'LOW',         // Pattern-guessed, MX validated only
    UNVERIFIED = 'UNVERIFIED',
}

export interface EmailResult {
    email: string;
    confidence: EmailConfidence;
}

interface ScrapeResult extends EmailResult {
    score: number;
    source: string;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const GENERIC_PREFIXES = new Set([
    "info", "hello", "contact", "enquiries", "enquiry",
    "admin", "support", "office", "mail", "team",
    "accounts", "sales", "help", "general", "post",
    "noreply", "no-reply", "donotreply", "webmaster"
]);

const TARGET_PATHS = [
    "/",
    "/contact",
    "/contact-us",
    "/get-in-touch",
    "/about",
    "/about-us",
    "/our-team",
    "/meet-the-team",
    "/people",
    "/staff",
    "/team"
];

const TIMEOUT_MS = 15_000;
const SCRAPINGBEE_TIMEOUT_MS = 30_000;

// ─────────────────────────────────────────────
// Core Scraper Logic
// ─────────────────────────────────────────────

/**
 * 3-Stage Waterfall Email Discovery:
 * 1. Direct Search (Crawl core pages)
 * 2. Permutations (Guess based on contact name)
 * 3. ScrapingBee (Fallback if API key present)
 */
export async function findEmail(
    website: string,
    contactName?: string | null,
    forceScrapingBee: boolean = false
): Promise<EmailResult | null> {
    const url = normaliseUrl(website);
    if (!url) return null;
    const domain = new URL(url).hostname.replace(/^www\./, "");

    console.log(`[ScraperUtils] Starting Discovery for ${domain}`);

    const results: ScrapeResult[] = [];
    const seenEmails = new Set<string>();

    const addResult = (email: string, confidence: EmailConfidence, source: string) => {
        const normalized = email.toLowerCase().trim();
        if (seenEmails.has(normalized)) return;
        if (!isValidEmailSyntax(normalized)) return;

        seenEmails.add(normalized);

        if (normalized.endsWith(".png") || normalized.endsWith(".jpg")) return;
        if (normalized.includes("sentry.io") || normalized.includes("example.com")) return;

        let score = 0;
        if (confidence === EmailConfidence.HIGH) score += 30;
        if (confidence === EmailConfidence.MEDIUM) score += 20;
        if (confidence === EmailConfidence.LOW) score += 10;

        const prefix = normalized.split("@")[0];
        if (GENERIC_PREFIXES.has(prefix)) score -= 5;

        if (contactName) {
            const parts = contactName.toLowerCase().split(" ");
            if (parts.some(p => p.length > 3 && normalized.includes(p))) {
                score += 10;
            }
        }

        results.push({ email: normalized, confidence, score, source });
    };

    // STAGE 1: Direct Crawl
    try {
        await crawlSite(url, false, addResult);
    } catch (e) {
        console.warn(`[ScraperUtils] Stage 1 failed: ${e}`);
    }

    // STAGE 2: Permutations
    const hasPersonal = results.some(r => !GENERIC_PREFIXES.has(r.email.split("@")[0]));
    if (!hasPersonal && contactName) {
        const permutations = generatePermutations(contactName, domain);
        for (const p of permutations) {
            addResult(p, EmailConfidence.LOW, "Permutation");
        }
    }

    // STAGE 3: ScrapingBee Fallback
    const apiKey = process.env.SCRAPINGBEE_API_KEY;
    if (apiKey && (results.length === 0 || forceScrapingBee)) {
        try {
            await crawlSite(url, true, addResult, apiKey);
        } catch (e) {
            console.warn(`[ScraperUtils] Stage 3 failed: ${e}`);
        }
    }

    if (results.length === 0) return null;

    results.sort((a, b) => b.score - a.score);
    return { email: results[0].email, confidence: results[0].confidence };
}

// ─────────────────────────────────────────────
// Crawling Logic
// ─────────────────────────────────────────────

async function crawlSite(
    baseUrl: string,
    useScrapingBee: boolean,
    onResult: (email: string, confidence: EmailConfidence, source: string) => void,
    apiKey?: string
) {
    const rootHtml = await fetchPage(baseUrl, useScrapingBee, apiKey);
    if (!rootHtml) return;

    extractEmailsFromHtml(rootHtml, baseUrl, onResult);

    const $ = cheerio.load(rootHtml);
    const internalLinks: string[] = [];
    $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        try {
            const resolved = new URL(href, baseUrl);
            if (resolved.hostname === new URL(baseUrl).hostname) {
                internalLinks.push(resolved.pathname);
            }
        } catch { /* ignore */ }
    });

    const linksToVisit = Array.from(new Set(internalLinks)).filter(link => {
        const lower = link.toLowerCase();
        return TARGET_PATHS.some(target => lower.includes(target.replace("/", ""))) && link !== "/";
    }).slice(0, 5);

    for (const link of linksToVisit) {
        const fullUrl = new URL(link, baseUrl).toString();
        const html = await fetchPage(fullUrl, useScrapingBee, apiKey);
        if (html) extractEmailsFromHtml(html, fullUrl, onResult);
    }
}

function extractEmailsFromHtml(
    html: string,
    sourceUrl: string,
    onResult: (email: string, confidence: EmailConfidence, source: string) => void
) {
    const $ = cheerio.load(html);
    const text = $('body').text();

    $('a[href^="mailto:"]').each((_, el) => {
        const href = $(el).attr('href') ?? '';
        const email = href.replace('mailto:', '').split('?')[0]?.trim();
        if (email && isValidEmailSyntax(email)) {
            onResult(email, EmailConfidence.HIGH, `Mailto on ${sourceUrl}`);
        }
    });

    const matches = text.match(EMAIL_REGEX) || [];
    for (const email of matches) {
        onResult(email, EmailConfidence.MEDIUM, `Text on ${sourceUrl}`);
    }
}

// ─────────────────────────────────────────────
// Fetching & Utils
// ─────────────────────────────────────────────

async function fetchPage(url: string, useScrapingBee: boolean, apiKey?: string): Promise<string | null> {
    try {
        if (useScrapingBee && apiKey) {
            const params = new URLSearchParams({ api_key: apiKey, url, render_js: 'false', timeout: String(SCRAPINGBEE_TIMEOUT_MS) });
            const res = await fetch(`https://app.scrapingbee.com/api/v1/?${params.toString()}`);
            return res.ok ? await res.text() : null;
        } else {
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
                signal: AbortSignal.timeout(TIMEOUT_MS)
            });
            return res.ok ? await res.text() : null;
        }
    } catch { return null; }
}

export async function checkMxRecord(domain: string): Promise<boolean> {
    try {
        const records = await dns.resolveMx(domain);
        return records.length > 0;
    } catch { return false; }
}

function generatePermutations(fullName: string, domain: string): string[] {
    const name = fullName.toLowerCase().replace(/[^a-z\s]/g, "");
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return [`info@${domain}`, `contact@${domain}`];
    const f = parts[0], l = parts[parts.length - 1], fi = f[0], li = l[0];
    return [
        `${f}.${l}@${domain}`, `${f}${l}@${domain}`, `${fi}${l}@${domain}`,
        `${f}@${domain}`, `${l}@${domain}`, `${f}_${l}@${domain}`, `${f}-${l}@${domain}`
    ];
}

function normaliseUrl(url: string): string | null {
    try {
        if (!url.startsWith('http')) url = 'https://' + url;
        return new URL(url).toString();
    } catch { return null; }
}

function isValidEmailSyntax(email: string): boolean {
    return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email);
}
