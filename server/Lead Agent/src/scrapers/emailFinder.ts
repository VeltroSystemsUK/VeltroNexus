/**
 * scrapers/emailFinder.ts
 * Multi-strategy email extraction with 3-Stage Waterfall:
 * 1. Direct Search (Crawl core pages)
 * 2. Permutations (Guess based on contact name)
 * 3. ScrapingBee (Fallback if API key present)
 */

import * as cheerio from 'cheerio';
import { EmailConfidence } from '../models/business.js';
import { checkMxRecord } from '../enrichers/emailValidator.js';

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
// Types
// ─────────────────────────────────────────────

interface ScrapeResult {
  email: string;
  confidence: EmailConfidence;
  score: number; // Internal scoring for sorting
  source: string;
}

// ─────────────────────────────────────────────
// Core Function
// ─────────────────────────────────────────────

export async function findEmail(
  website: string,
  contactName?: string | null,
  forceScrapingBee: boolean = false
): Promise<{ email: string; confidence: EmailConfidence } | null> {
  const url = normaliseUrl(website);
  if (!url) return null;
  const domain = new URL(url).hostname.replace(/^www\./, "");

  console.log(`[EmailFinder] Starting 3-Stage Discovery for ${domain}`);
  if (contactName) console.log(`[EmailFinder] Contact Hint: "${contactName}"`);

  const results: ScrapeResult[] = [];
  const seenEmails = new Set<string>();

  // Helper to add results
  const addResult = (email: string, confidence: EmailConfidence, source: string) => {
    const normalized = email.toLowerCase().trim();
    if (seenEmails.has(normalized)) return;
    if (!isValidEmailSyntax(normalized)) return;

    seenEmails.add(normalized);

    // Validation basics
    if (normalized.endsWith(".png") || normalized.endsWith(".jpg")) return;
    if (normalized.includes("sentry.io") || normalized.includes("example.com")) return;

    let score = 0;
    if (confidence === EmailConfidence.HIGH) score += 30;
    if (confidence === EmailConfidence.MEDIUM) score += 20;
    if (confidence === EmailConfidence.LOW) score += 10;

    // Penalty for generic emails if we want personal ones
    const prefix = normalized.split("@")[0];
    if (GENERIC_PREFIXES.has(prefix)) score -= 5;

    // Bonus for matching contact name parts
    if (contactName) {
      const parts = contactName.toLowerCase().split(" ");
      if (parts.some(p => p.length > 3 && normalized.includes(p))) {
        score += 10;
      }
    }

    results.push({ email: normalized, confidence, score, source });
  };

  // ─── STAGE 1: DIRECT SEARCH ────────────────────────────────────────────────
  console.log(`[EmailFinder] Stage 1: Direct Website Search (${url})...`);
  try {
    await crawlSite(url, false, addResult);
  } catch (e) {
    console.warn(`[EmailFinder] Stage 1 failed: ${e}`);
  }

  // ─── STAGE 2: PERMUTATIONS ─────────────────────────────────────────────────
  // Run if no emails found OR only generics found (and we have a name)
  const hasPersonal = results.some(r => {
    const prefix = r.email.split("@")[0];
    return !GENERIC_PREFIXES.has(prefix);
  });

  if (!hasPersonal && contactName) {
    console.log(`[EmailFinder] Stage 2: Generating Permutations for "${contactName}"...`);
    const permutations = generatePermutations(contactName, domain);

    // If we could validate them (SMTP), we would here. 
    // For now, add them as LOW confidence unless we can verify.
    // We will assume standard format guessing is "Medium" confidence if it looks standard.
    for (const p of permutations) {
      addResult(p, EmailConfidence.LOW, "Permutation");
    }
  }

  // ─── STAGE 3: SCRAPINGBEE ──────────────────────────────────────────────────
  // Run if NO emails found OR if forced
  const apiKey = process.env.SCRAPINGBEE_API_KEY;

  const shouldRunStage3 = apiKey && (results.length === 0 || forceScrapingBee);

  if (shouldRunStage3) {
    console.log(`[EmailFinder] Stage 3: ScrapingBee Fallback... (Forced: ${forceScrapingBee})`);
    try {
      await crawlSite(url, true, addResult, apiKey);
    } catch (e) {
      console.warn(`[EmailFinder] Stage 3 failed: ${e}`);
    }
  } else if (!apiKey) {
    console.log(`[EmailFinder] Stage 3 Skipped (No API Key)`);
  } else {
    console.log(`[EmailFinder] Stage 3 Skipped (Emails already found)`);
  }

  // ─── FINAL SELECTION ───────────────────────────────────────────────────────
  if (results.length === 0) {
    console.log(`[EmailFinder] No emails found for ${domain}`);
    return null;
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  const best = results[0];
  console.log(`[EmailFinder] Best Match: ${best.email} (${best.confidence}) via ${best.source}`);

  return { email: best.email, confidence: best.confidence };
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
  // 1. Fetch Root
  const rootHtml = await fetchPage(baseUrl, useScrapingBee, apiKey);
  if (!rootHtml) return;

  extractEmailsFromHtml(rootHtml, baseUrl, onResult);

  // 2. Discover Internal Links
  const internalLinks = extractInternalLinks(rootHtml, baseUrl);

  // 3. Filter for Target Paths
  const linksToVisit = internalLinks.filter(link => {
    const lower = link.toLowerCase();
    return TARGET_PATHS.some(target => lower.includes(target.replace("/", ""))) && link !== "/";
  });

  // Limit to 5 extra pages to speed up
  const uniqueLinks = [...new Set(linksToVisit)].slice(0, 5);

  // 4. Crawl pages
  for (const link of uniqueLinks) {
    const fullUrl = new URL(link, baseUrl).toString();
    const html = await fetchPage(fullUrl, useScrapingBee, apiKey);
    if (html) {
      extractEmailsFromHtml(html, fullUrl, onResult);
    }
  }
}

function extractInternalLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.hostname === new URL(baseUrl).hostname) {
        links.push(resolved.pathname);
      }
    } catch { /* ignore */ }
  });
  return links;
}

function extractEmailsFromHtml(
  html: string,
  sourceUrl: string,
  onResult: (email: string, confidence: EmailConfidence, source: string) => void
) {
  const $ = cheerio.load(html);
  const text = $('body').text();

  // 1. Mailto links (High Confidence)
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const email = href.replace('mailto:', '').split('?')[0]?.trim();
    if (email && isValidEmailSyntax(email)) {
      onResult(email, EmailConfidence.HIGH, `Mailto on ${sourceUrl}`);
    }
  });

  // 2. Text Regex (Medium Confidence)
  const matches = text.match(EMAIL_REGEX) || [];
  for (const email of matches) {
    onResult(email, EmailConfidence.MEDIUM, `Text on ${sourceUrl}`);
  }
}

// ─────────────────────────────────────────────
// Fetching Logic
// ─────────────────────────────────────────────

async function fetchPage(url: string, useScrapingBee: boolean, apiKey?: string): Promise<string | null> {
  try {
    if (useScrapingBee && apiKey) {
      const params = new URLSearchParams({
        api_key: apiKey,
        url: url,
        render_js: 'false', // Try fast first
        timeout: String(SCRAPINGBEE_TIMEOUT_MS)
      });
      const res = await fetch(`https://app.scrapingbee.com/api/v1/?${params.toString()}`);
      if (!res.ok) throw new Error(`ScrapingBee status ${res.status}`);
      return await res.text();
    } else {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      if (!res.ok) return null;
      return await res.text();
    }
  } catch (e) {
    // console.warn(`Fetch failed for ${url}: ${e}`);
    return null;
  }
}

// ─────────────────────────────────────────────
// Permutation Logic
// ─────────────────────────────────────────────

function generatePermutations(fullName: string, domain: string): string[] {
  const name = fullName.toLowerCase().replace(/[^a-z\s]/g, "");
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return [`info@${domain}`, `contact@${domain}`]; // fallback

  // STRICT: Only use first and last name, ignoring middle names
  const f = parts[0];
  const l = parts[parts.length - 1];
  const fi = f[0];
  const li = l[0];

  return [
    `${f}.${l}@${domain}`,
    `${f}${l}@${domain}`,
    `${fi}${l}@${domain}`,
    `${f}@${domain}`,
    `${l}@${domain}`,
    `${f}_${l}@${domain}`,
    `${f}-${l}@${domain}`
  ];
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function normaliseUrl(url: string): string | null {
  try {
    if (!url.startsWith('http')) url = 'https://' + url;
    return new URL(url).toString();
  } catch {
    return null;
  }
}

function isValidEmailSyntax(email: string): boolean {
  return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email);
}

// ─────────────────────────────────────────────
// Exports (Legacy Support)
// ───────────────────────────────────────────── 
// checkRobots etc removed as we are being aggressive with user consent assumption for these specific target leads

