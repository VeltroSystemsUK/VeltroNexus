"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeDomainContactsEU = void 0;
exports.generateEmailPermutations = generateEmailPermutations;
const functions = require("firebase-functions");
const https = require("https");
const http = require("http");
const url_1 = require("url");
// ─── Constants ────────────────────────────────────────────────────────────────
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
    "/directors",
    "/team",
    "/blog",
    "/press",
    "/media",
    "/news",
    "/privacy-policy",
    "/privacy",
    "/cookie-policy",
    "/legal"
];
const GENERIC_EMAIL_PREFIXES = [
    "info", "hello", "contact", "enquiries", "enquiry",
    "admin", "support", "office", "mail", "team",
    "accounts", "sales", "help", "general", "post",
    "noreply", "no-reply", "donotreply", "webmaster",
];
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:(?:\+44|0044|0)[\s\-.]?(?:\d[\s\-.]?){9,10}|\b07\d{3}[\s\-.]?\d{6}\b)/g;
const NAME_PATTERNS = [
    /(?:director|founder|ceo|owner|manager|partner|md|principal)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/gi,
    /([A-Z][a-z]+ [A-Z][a-z]+)[\s,]+(?:director|founder|ceo|owner|manager|partner|md)/gi,
    /<(?:h[1-6]|strong|b)[^>]*>([A-Z][a-z]+ [A-Z][a-z]+)<\/(?:h[1-6]|strong|b)>/g,
];
const LINKEDIN_REGEX = /https?:\/\/(?:www\.)?linkedin\.com\/company\/[a-zA-Z0-9\-_]+/g;
const FETCH_TIMEOUT_MS = 15000;
const SCRAPINGBEE_TIMEOUT_MS = 30000;
const MAX_PAGES = 15;
// Store your ScrapingBee key in Firebase config:
//   firebase functions:config:set scrapingbee.key="YOUR_KEY_HERE"
const getScrapingBeeKey = () => {
    var _a;
    try {
        return ((_a = functions.config().scrapingbee) === null || _a === void 0 ? void 0 : _a.key) || process.env.SCRAPINGBEE_API_KEY || "";
    }
    catch (_b) {
        return process.env.SCRAPINGBEE_API_KEY || "";
    }
};
// ─── Email Permutation Generator ─────────────────────────────────────────────
function sanitiseName(name) {
    return name
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // strip accents
        .replace(/'/g, "") // O'Brien → obrien
        .replace(/[^a-z\s\-]/g, "") // only letters, spaces, hyphens
        .replace(/\s+/g, " ")
        .trim();
}
function extractEmailDomain(origin) {
    try {
        return new url_1.URL(origin).hostname.replace(/^www\./, "");
    }
    catch (_a) {
        return origin.replace(/^(https?:\/\/)?(www\.)?/, "");
    }
}
function generateEmailPermutations(fullName, domainOrOrigin) {
    if (!(fullName === null || fullName === void 0 ? void 0 : fullName.trim()))
        return [];
    const clean = sanitiseName(fullName);
    const parts = clean.split(" ").filter(Boolean);
    if (parts.length < 2)
        return [];
    const emailDomain = extractEmailDomain(domainOrOrigin);
    const results = [];
    const seen = new Set();
    const add = (local, pattern, confidence) => {
        const sanitised = local.replace(/[^a-z0-9._\-]/g, "");
        if (!sanitised || sanitised.length < 2)
            return;
        const email = `${sanitised}@${emailDomain}`;
        if (!seen.has(email)) {
            seen.add(email);
            results.push({ email, pattern, confidence });
        }
    };
    const first = parts[0];
    const last = parts[parts.length - 1];
    const fi = first[0]; // first initial
    const li = last[0]; // last initial
    // ── High confidence ──────────────────────────────────────────────
    add(`${first}.${last}`, "firstname.lastname", "high");
    add(`${first}${last}`, "firstnamelastname", "high");
    add(`${fi}${last}`, "flastname", "high");
    add(`${fi}.${last}`, "f.lastname", "high");
    add(`${first}`, "firstname only", "high");
    // ── Medium confidence ────────────────────────────────────────────
    add(`${first}.${li}`, "firstname.l", "medium");
    add(`${first}${li}`, "firstnamel", "medium");
    add(`${fi}${li}`, "fl initials", "medium");
    add(`${last}.${first}`, "lastname.firstname", "medium");
    add(`${last}${first}`, "lastnamefirstname", "medium");
    add(`${last}`, "lastname only", "medium");
    // ── Low confidence ───────────────────────────────────────────────
    add(`${fi}-${last}`, "f-lastname", "low");
    add(`${first}-${last}`, "firstname-lastname", "low");
    add(`${last}.${fi}`, "lastname.f", "low");
    add(`${fi}_${last}`, "f_lastname", "low");
    add(`${first}_${last}`, "firstname_lastname", "low");
    // Hyphenated surnames
    if (last.includes("-")) {
        const [firstPart, secondPart] = last.split("-");
        add(`${first}.${firstPart}`, "firstname.firstpart", "low");
        add(`${fi}${firstPart}`, "f+firstpart", "low");
        add(`${first}${firstPart}${secondPart}`, "firstnamefullhyphen", "low");
    }
    // Three-part names
    if (parts.length >= 3) {
        const middle = parts[1];
        const mi = middle[0];
        add(`${first}${mi}${last}`, "firstmiddlelast", "low");
        add(`${fi}${mi}${last}`, "fmlastname", "low");
        add(`${first}.${mi}.${last}`, "f.m.lastname", "low");
    }
    return results;
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
function normaliseEmail(email) {
    return email.toLowerCase().trim();
}
function isGenericEmail(email) {
    const prefix = email.split("@")[0].toLowerCase();
    return GENERIC_EMAIL_PREFIXES.includes(prefix);
}
function cleanPhone(raw) {
    return raw
        .replace(/[\s\-.()]/g, "")
        .replace(/^0044/, "+44")
        .replace(/^00(\d)/, "+$1");
}
function getEmailContext(text, email) {
    const idx = text.indexOf(email);
    if (idx === -1)
        return "";
    const start = Math.max(0, idx - 80);
    const end = Math.min(text.length, idx + email.length + 80);
    return text
        .slice(start, end)
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
// ─── Fetch Layer ──────────────────────────────────────────────────────────────
async function fetchDirect(url) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new url_1.URL(url);
        const lib = parsedUrl.protocol === "https:" ? https : http;
        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: "GET",
            timeout: FETCH_TIMEOUT_MS,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-GB,en;q=0.9",
                Connection: "keep-alive",
            },
        };
        const req = lib.request(options, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchDirect(res.headers.location).then(resolve).catch(reject);
                return;
            }
            if (res.statusCode && res.statusCode >= 400) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            let data = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => {
                data += chunk;
                if (data.length > 500000) {
                    req.destroy();
                    resolve(data);
                }
            });
            res.on("end", () => resolve(data));
        });
        req.on("timeout", () => { req.destroy(); reject(new Error("Direct fetch timeout")); });
        req.on("error", reject);
        req.end();
    });
}
async function fetchViaScrapingBee(url, apiKey, renderJs = false, premiumProxy = false) {
    const params = new URLSearchParams({
        api_key: apiKey,
        url,
        render_js: String(renderJs),
        premium_proxy: String(premiumProxy),
        country_code: "gb",
        block_ads: "true",
        timeout: String(SCRAPINGBEE_TIMEOUT_MS),
    });
    return new Promise((resolve, reject) => {
        const req = https.get(`https://app.scrapingbee.com/api/v1/?${params.toString()}`, (res) => {
            const sbCode = res.headers["x-scrapingbee-response-code"];
            if (sbCode && parseInt(String(sbCode)) >= 400) {
                reject(new Error(`Target returned ${sbCode}`));
                return;
            }
            if (res.statusCode && res.statusCode === 401) {
                reject(new Error("ScrapingBee API key invalid"));
                return;
            }
            if (res.statusCode && res.statusCode >= 400) {
                reject(new Error(`ScrapingBee error ${res.statusCode}`));
                return;
            }
            let data = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => {
                data += chunk;
                if (data.length > 500000) {
                    req.destroy();
                    resolve(data);
                }
            });
            res.on("end", () => resolve(data));
        });
        req.on("timeout", () => { req.destroy(); reject(new Error("ScrapingBee timeout")); });
        req.on("error", reject);
        req.setTimeout(SCRAPINGBEE_TIMEOUT_MS);
    });
}
// fetchPage removed as it is superseded by crawlDomain logic
// ─── Link Discovery ───────────────────────────────────────────────────────────
// ─── Link Discovery ───────────────────────────────────────────────────────────
function extractInternalLinks(html, baseUrl) {
    const base = new url_1.URL(baseUrl);
    const linkRegex = /href=["']([^"'#?]+)["']/gi;
    const found = [];
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
        try {
            const resolved = new url_1.URL(match[1], baseUrl);
            if (resolved.hostname === base.hostname) {
                found.push(resolved.pathname);
            }
        }
        catch (_a) {
            // skip malformed hrefs
        }
    }
    return [...new Set(found)];
}
function scorePathRelevance(path) {
    const lower = path.toLowerCase();
    if (lower.includes("contact"))
        return 10;
    if (lower.includes("about") || lower.includes("team") || lower.includes("people"))
        return 9;
    if (lower.includes("privacy") || lower.includes("cookie") || lower.includes("gdpr"))
        return 8;
    if (lower.includes("director") || lower.includes("staff") || lower.includes("management"))
        return 8;
    if (lower.includes("press") || lower.includes("media") || lower.includes("news"))
        return 6;
    if (lower.includes("blog") || lower.includes("author"))
        return 4;
    return 1;
}
// ─── Core Scraper Logic ───────────────────────────────────────────────────────
/**
 * Orchestrates the crawling of a domain using a specific fetch strategy (Direct or ScrapingBee).
 */
async function crawlDomain(rawDomain, useScrapingBee, apiKey) {
    let domain = rawDomain.trim().toLowerCase();
    if (!domain.startsWith("http"))
        domain = "https://" + domain;
    const baseUrl = new url_1.URL(domain);
    const origin = baseUrl.origin;
    const allEmails = new Map();
    const allPhones = new Set();
    const allNames = new Set();
    let linkedInUrl = null;
    const pageResults = [];
    const scrapedUrls = new Set();
    // Step 1: Fetch root, discover internal links
    let discoveredPaths = [];
    try {
        // For root page, we might want to be more robust, but sticking to the requested strategy
        // If useScrapingBee is true, we ONLY use ScrapingBee.
        // If false, we ONLY use direct.
        const { html: rootHtml } = useScrapingBee
            ? await fetchViaScrapingBee(origin + "/", apiKey).then(html => ({ html, method: "scrapingbee" }))
            : await fetchDirect(origin + "/").then(html => ({ html, method: "direct" }));
        discoveredPaths = extractInternalLinks(rootHtml, origin);
    }
    catch (err) {
        console.warn(`[${useScrapingBee ? 'Bee' : 'Direct'}] Failed to fetch root: ${err}`);
        // If root fails, we can't do much, but we might have some paths in TARGET_PATHS to try anyway
    }
    // Step 2: Build prioritised path list
    const targetSet = new Set(TARGET_PATHS);
    const scoredDiscovered = discoveredPaths
        .filter((p) => !targetSet.has(p))
        .map((p) => ({ path: p, score: scorePathRelevance(p) }))
        .filter((p) => p.score >= 4)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((p) => p.path);
    const pathsToScrape = [...TARGET_PATHS, ...scoredDiscovered].slice(0, MAX_PAGES);
    // Step 3: Scrape each page
    for (const path of pathsToScrape) {
        const url = origin + path;
        if (scrapedUrls.has(url))
            continue;
        scrapedUrls.add(url);
        const pageResult = {
            url,
            status: "ok",
            emailsFound: 0,
            phonesFound: 0,
            fetchMethod: useScrapingBee ? "scrapingbee" : "direct",
        };
        try {
            let html = "";
            // let method ... removed
            if (useScrapingBee) {
                // Try standard Bee first, then JS render if needed (logic simplified here for clarity/speed)
                // We can re-use the logic from original fetchPage but forced to Bee
                try {
                    html = await fetchViaScrapingBee(url, apiKey, false, false);
                }
                catch (_a) {
                    // Retry with JS if simple fail
                    html = await fetchViaScrapingBee(url, apiKey, true, true);
                }
            }
            else {
                html = await fetchDirect(url);
            }
            const plainText = html.replace(/<[^>]+>/g, " ");
            // Emails
            const emailMatches = plainText.match(EMAIL_REGEX) || [];
            for (const raw of [...new Set(emailMatches.map(normaliseEmail))]) {
                if (/\.(png|jpg|gif|svg|webp|css|js)$/i.test(raw))
                    continue;
                if (/example\.com|sentry\.io|schema\.org|w3\.org/i.test(raw))
                    continue;
                if (!allEmails.has(raw)) {
                    allEmails.set(raw, {
                        email: raw,
                        source: path,
                        context: getEmailContext(plainText, raw),
                        isGeneric: isGenericEmail(raw),
                        isPermutation: false
                    });
                    pageResult.emailsFound++;
                }
            }
            // Phones
            const phoneMatches = plainText.match(PHONE_REGEX) || [];
            for (const raw of phoneMatches) {
                const cleaned = cleanPhone(raw);
                if (cleaned.replace(/\D/g, "").length >= 10) {
                    allPhones.add(cleaned);
                    pageResult.phonesFound++;
                }
            }
            // Named individuals
            for (const pattern of NAME_PATTERNS) {
                pattern.lastIndex = 0;
                let m;
                while ((m = pattern.exec(html)) !== null) {
                    if (m[1])
                        allNames.add(m[1].trim());
                }
            }
            // LinkedIn
            if (!linkedInUrl) {
                const liMatch = html.match(LINKEDIN_REGEX);
                if (liMatch)
                    linkedInUrl = liMatch[0];
            }
        }
        catch (_b) {
            pageResult.status = "error";
        }
        pageResults.push(pageResult);
    }
    return { emails: allEmails, phones: allPhones, names: allNames, linkedInUrl, pageResults, scrapedUrls };
}
async function scrapeDomain(rawDomain, directorName) {
    const apiKey = getScrapingBeeKey();
    let domain = rawDomain.trim().toLowerCase();
    if (!domain.startsWith("http"))
        domain = "https://" + domain;
    console.log(`Starting 3-Stage Scrape for ${domain} (Director: ${directorName || "None"})`);
    // ─── STAGE 1: DIRECT SEARCH ───────────────────────────────────────────────
    console.log("Stage 1: Direct Website Search...");
    let crawlResult = await crawlDomain(domain, false, "");
    let allEmails = crawlResult.emails;
    let allPhones = crawlResult.phones;
    let allNames = crawlResult.names;
    let pageResults = crawlResult.pageResults;
    let scrapedUrls = crawlResult.scrapedUrls;
    let linkedInUrl = crawlResult.linkedInUrl;
    // ─── STAGE 2: PERMUTATIONS (If needed) ────────────────────────────────────
    // Run if:
    // 1. We have a contact name
    // 2. We found ZERO emails OR only generic ones (optional rule, but user asked for "if fail")
    //    User said "first search website, second check contact name permutations"
    //    We'll treat "fail" as "no emails found" or "only generic emails found" to be safe? 
    //    For now, adhering to strict "found no emails" helps justification, but usually permutations 
    //    are valuable even if we found generic ones. Let's add them if we have a name.
    let permutations = [];
    const nameForPermutations = (directorName === null || directorName === void 0 ? void 0 : directorName.trim()) || [...allNames][0] || "";
    if (nameForPermutations) {
        console.log("Stage 2: Generating Permutations...");
        const perms = generateEmailPermutations(nameForPermutations, domain);
        permutations = perms;
        // Add permutations to the master list
        perms.forEach(p => {
            // Only add if we don't already have this email 
            if (!allEmails.has(p.email)) {
                allEmails.set(p.email, {
                    email: p.email,
                    source: `Permutation (${p.confidence})`,
                    context: `Guessed from: ${nameForPermutations}`,
                    isGeneric: false,
                    isPermutation: true
                });
            }
        });
    }
    // ─── STAGE 3: SCRAPINGBEE (Fallback) ──────────────────────────────────────
    // Run if:
    // 1. We have an API key
    // 2. We have found NO emails (direct or permutations)
    //    OR maybe we want to run it if we only found generic? 
    //    User: "final stage scraping bee? ... if the system is confused"
    //    Let's run it if we have 0 emails total.
    if (allEmails.size === 0 && apiKey) {
        console.log("Stage 3: ScrapingBee Fallback (No emails found yet)...");
        const beeResult = await crawlDomain(domain, true, apiKey);
        // Merge results
        beeResult.emails.forEach((v, k) => { if (!allEmails.has(k))
            allEmails.set(k, v); });
        beeResult.phones.forEach(p => allPhones.add(p));
        beeResult.names.forEach(n => allNames.add(n));
        if (!linkedInUrl)
            linkedInUrl = beeResult.linkedInUrl;
        // Append page results
        pageResults = [...pageResults, ...beeResult.pageResults];
        beeResult.scrapedUrls.forEach(u => scrapedUrls.add(u));
    }
    else {
        console.log("Skipping Stage 3 (Emails found or no API Key)");
    }
    // ─── FINAL RESULT ASSEMBLY ────────────────────────────────────────────────
    // Sort: personal > generic, scraped > permutation
    // Wait, typically Verified Scraped > Permutations > Generic?
    // User priority: Scraped Personal > Scraped Generic > Permutation? 
    // Or Scraped Personal > Permutation > Scraped Generic?
    // Let's stick to: Scraped (Real) > Permutation (Guess) unless Permutation is verified (which we can't do easily here)
    const sortedEmails = [...allEmails.values()].sort((a, b) => {
        // 1. Real over Permutation
        if (!a.isPermutation && b.isPermutation)
            return -1;
        if (a.isPermutation && !b.isPermutation)
            return 1;
        // 2. Personal over Generic
        if (!a.isGeneric && b.isGeneric)
            return -1;
        if (a.isGeneric && !b.isGeneric)
            return 1;
        return 0;
    });
    const totalFound = sortedEmails.length + allPhones.size;
    return {
        domain: new url_1.URL(domain).origin,
        scrapedAt: new Date().toISOString(),
        emails: sortedEmails,
        phones: [...allPhones],
        names: [...allNames].slice(0, 10),
        linkedInUrl,
        pagesScraped: [...scrapedUrls],
        pageResults,
        permutations,
        status: totalFound > 0
            ? "success"
            : pageResults.some((p) => p.status === "ok")
                ? "partial"
                : "failed",
    };
}
// ─── Firebase Function ────────────────────────────────────────────────────────
exports.scrapeDomainContactsEU = functions
    .region("europe-west2")
    .runWith({ timeoutSeconds: 300, memory: "1GB" })
    .https.onCall(async (data, _context) => {
    // We accept both 'contactName' (frontend) and 'directorName' (internal legacy)
    const { domain, directorName, contactName } = data;
    if (!domain || typeof domain !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "A valid domain is required");
    }
    const nameToUse = contactName || directorName;
    try {
        return await scrapeDomain(domain, nameToUse);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Scrape Error:", message);
        throw new functions.https.HttpsError("internal", message);
    }
});
//# sourceMappingURL=domainScraper.js.map