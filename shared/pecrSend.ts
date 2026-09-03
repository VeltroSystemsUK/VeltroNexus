const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.co.uk",
  "outlook.com",
  "yahoo.com",
  "yahoo.co.uk",
  "icloud.com",
  "live.com",
  "msn.com",
  "aol.com",
  "btinternet.com",
  "sky.com",
  "talktalk.net",
  "virginmedia.com",
]);

export function isPersonalMailbox(email?: string | null): boolean {
  const domain = String(email || "")
    .trim()
    .toLowerCase()
    .split("@")[1];
  return !!domain && PERSONAL_DOMAINS.has(domain);
}

export function outreachHost(value?: string | null): string {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw.includes("@")) return raw.split("@").pop() || "";
  try {
    const url = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return raw.replace(/^www\./, "").split("/")[0] || "";
  }
}

const REGISTRY_HOSTS = [
  "companieshouse.gov.uk",
  "company-information.service.gov.uk",
  "endole.co.uk",
  "companycheck.co.uk",
  "duedil.com",
  "opencorporates.com",
  "northdata.com",
  "creditsafe.com",
  "creditgate.com",
  "dnb.com",
  "globaldatabase.com",
  "companiesintheuk.co.uk",
  "uk.companydir.com",
  "bymetric.com",
];

const DIRECTORY_HOSTS = [
  "daynurseries.co.uk",
  "childcare.co.uk",
  "yell.com",
  "thomsonlocal.com",
  "cylex-uk.co.uk",
  "freeindex.co.uk",
  "scoot.co.uk",
  "192.com",
  "checkatrade.com",
  "bark.com",
  "trustpilot.com",
  "facebook.com",
  "linkedin.com",
  "instagram.com",
  "google.com",
  "google.co.uk",
  "wikipedia.org",
  "houzz.com",
  "ip-online.biz",
];

export function isBlockedOutreachHost(host?: string | null): boolean {
  const h = String(host || "")
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
  if (!h) return false;
  if (h === "gov.uk" || h.endsWith(".gov.uk")) return true;
  if (h.includes("companieshouse")) return true;
  if (REGISTRY_HOSTS.some((blocked) => h === blocked || h.endsWith(`.${blocked}`))) return true;
  return DIRECTORY_HOSTS.some((blocked) => h === blocked || h.endsWith(`.${blocked}`));
}

export function isBlockedOutreachMailbox(email?: string | null): boolean {
  return isBlockedOutreachHost(outreachHost(email));
}

const LEGAL_STOP = new Set([
  "ltd",
  "limited",
  "plc",
  "llp",
  "cic",
  "cio",
  "inc",
  "llc",
  "co",
  "the",
  "and",
  "of",
  "uk",
  "company",
  "companies",
  "head",
  "office",
  "nottingham",
  "manchester",
  "london",
  "birmingham",
  "derby",
]);

const WEAK_STOP = new Set([
  ...LEGAL_STOP,
  "group",
  "holdings",
  "holding",
  "engineering",
  "services",
  "service",
  "solutions",
  "solution",
  "consulting",
  "consultancy",
  "community",
  "care",
  "foods",
  "food",
  "investments",
  "investment",
  "estates",
  "estate",
  "east",
  "west",
  "north",
  "south",
  "head",
  "office",
  "nottingham",
]);

function companyTokens(name: string | null | undefined, stop: Set<string>): string[] {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token && !stop.has(token));
}

function domainLabel(host: string): string {
  const parts = host.replace(/^www\./, "").split(".");
  const withoutTld =
    parts.length >= 3 && ["co", "org", "ac", "gov", "com", "net"].includes(parts[parts.length - 2])
      ? parts.slice(0, -2)
      : parts.slice(0, -1);
  return withoutTld.join("").replace(/-/g, "");
}

function matchWords(tokens: string[]): string[] {
  const words: string[] = [];
  let singles = "";
  for (const token of tokens) {
    if (token.length === 1) {
      singles += token;
      continue;
    }
    if (singles) {
      words.push(singles);
      singles = "";
    }
    words.push(token);
  }
  if (singles) words.push(singles);
  return words;
}

const OTHER_ORG_SUFFIXES = [
  "group",
  "school",
  "solutions",
  "consulting",
  "engineering",
  "services",
  "associates",
  "holdings",
  "estates",
  "trust",
  "partners",
  "capital",
];

function companyFold(name?: string | null): string {
  return matchWords(companyTokens(name, LEGAL_STOP)).join("");
}

function prefixBelongsToCompany(prefix: string, companyName?: string | null): boolean {
  if (prefix.length < 3) return false;
  const folded = companyFold(companyName);
  if (folded.includes(prefix) || (folded.length >= 4 && prefix.includes(folded))) return true;
  return matchWords(companyTokens(companyName, WEAK_STOP)).some(
    (word) => word.length >= 3 && (prefix.includes(word) || word.includes(prefix))
  );
}

export function isClearCompanyMismatch(email?: string | null, companyName?: string | null): boolean {
  if (!String(email || "").trim() || !String(companyName || "").trim()) return false;
  if (isBlockedOutreachMailbox(email)) return true;
  if (emailMatchesCompany(email, companyName)) return false;
  const domain = domainLabel(outreachHost(email));
  if (!domain) return false;
  for (const suffix of OTHER_ORG_SUFFIXES) {
    if (!domain.endsWith(suffix) || domain.length < suffix.length + 3) continue;
    const prefix = domain.slice(0, -suffix.length);
    if (prefix.length >= 3 && !prefixBelongsToCompany(prefix, companyName)) return true;
  }
  return false;
}

export function emailMatchesCompany(email?: string | null, companyName?: string | null): boolean {
  const host = outreachHost(email);
  if (!host || isBlockedOutreachHost(host)) return false;
  const domain = domainLabel(host);
  if (!domain) return false;
  const legalWords = matchWords(companyTokens(companyName, LEGAL_STOP));
  const distinctive = matchWords(companyTokens(companyName, WEAK_STOP));
  if (!legalWords.length && !distinctive.length) return false;
  const foldedName = legalWords.join("");
  if (foldedName.length >= 4 && (domain.includes(foldedName) || foldedName.includes(domain))) return true;
  const acronym = legalWords.map((word) => word[0]).join("");
  if (acronym.length >= 3 && (domain.startsWith(acronym) || domain.endsWith(acronym) || domain.includes(acronym))) {
    return true;
  }
  if (acronym.length === 2 && domain.startsWith(acronym) && domain.length <= 6) return true;
  if (distinctive.some((word) => word.length >= 2 && word === domain)) return true;
  return distinctive.some((word) => {
    if (word.length >= 4 && domain.includes(word)) return true;
    if (word.length >= 3 && domain.startsWith(word)) return true;
    return false;
  });
}

/** Cold (hunt) email only. Inbound already enquired — PECR soft opt-in. */
export function coldEmailBlockedReason(
  email?: string | null,
  stream?: string | null,
  companyName?: string | null
): string | null {
  if (stream === "inbound") return null;
  if (!String(email || "").trim()) return "no email";
  if (isPersonalMailbox(email)) return "personal mailbox — PECR";
  if (isBlockedOutreachMailbox(email)) return "government / registry mailbox";
  if (companyName && isClearCompanyMismatch(email, companyName)) return "mailbox is not this company";
  return null;
}
