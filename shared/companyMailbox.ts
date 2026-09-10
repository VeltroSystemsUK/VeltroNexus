import { isBlockedOutreachHost, outreachHost } from "./pecrSend";

export function companyDomainFromWebsite(website?: string | null): string | null {
  const host = outreachHost(website);
  if (!host || isBlockedOutreachHost(host)) return null;
  return host.replace(/^www\./, "");
}

export function emailOnCompanyDomain(email?: string | null, domain?: string | null): boolean {
  const host = outreachHost(email);
  const root = String(domain || "")
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
  if (!host || !root) return false;
  return host === root || host.endsWith(`.${root}`);
}

export function emailsOnCompanyDomain(emails: string[], domain?: string | null): string[] {
  if (!domain) return [];
  return emails.filter((email) => emailOnCompanyDomain(email, domain));
}

const SCRAPE_EMAIL_RE = /(?:^|[^a-zA-Z0-9._%+\-])([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g;

export function emailsFromScrapedText(text?: string | null): string[] {
  const raw = String(text || "");
  if (!raw) return [];
  const found = new Set<string>();
  for (const match of raw.matchAll(SCRAPE_EMAIL_RE)) {
    const email = String(match[1] || "").toLowerCase();
    if (email) found.add(email);
  }
  return [...found];
}

const CORP_TOKENS = new Set([
  "ltd",
  "limited",
  "plc",
  "llp",
  "sarl",
  "gmbh",
  "inc",
  "llc",
  "holdings",
  "group",
  "trust",
  "company",
  "europe",
  "uk",
  "the",
]);

function personTokens(name: string): string[] {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((token) => token.length >= 2 && !CORP_TOKENS.has(token));
}

export type MailboxPattern = "first.last" | "flast" | "first" | "firstlast" | "f.last" | "firstl";

const ROLE_LOCALS = new Set([
  "info",
  "sales",
  "enquiry",
  "enquiries",
  "admin",
  "hello",
  "office",
  "accounts",
  "contact",
  "team",
  "mail",
  "support",
]);

function localsForPerson(first: string, last: string, pattern?: MailboxPattern | null): string[] {
  if (pattern === "first.last") return [`${first}.${last}`];
  if (pattern === "flast") return [`${first[0]}${last}`];
  if (pattern === "first") return [first];
  if (pattern === "firstlast") return [`${first}${last}`];
  if (pattern === "f.last") return [`${first[0]}.${last}`];
  if (pattern === "firstl") return [`${first}${last[0]}`];
  return [
    `${first}.${last}`,
    `${first[0]}${last}`,
    first,
    `${first}${last}`,
    `${first[0]}.${last}`,
    `${first}${last[0]}`,
  ];
}

export function inferMailboxPattern(emails: string[], directorNames: string[] = []): MailboxPattern | null {
  for (const email of emails) {
    const local = String(email || "")
      .split("@")[0]
      .toLowerCase();
    if (!local || ROLE_LOCALS.has(local)) continue;
    for (const name of directorNames) {
      const tokens = personTokens(name);
      if (tokens.length < 2) continue;
      const first = tokens[0];
      const last = tokens[tokens.length - 1];
      if (local === `${first}.${last}`) return "first.last";
      if (local === `${first[0]}${last}`) return "flast";
      if (local === first) return "first";
      if (local === `${first}${last}`) return "firstlast";
      if (local === `${first[0]}.${last}`) return "f.last";
      if (local === `${first}${last[0]}`) return "firstl";
    }
    if (/^[a-z]{2,}\.[a-z]{2,}$/.test(local)) return "first.last";
    if (/^[a-z]\.[a-z]{2,}$/.test(local)) return "f.last";
  }
  return null;
}

export function contactMailboxGuesses(
  domain: string,
  directorNames: string[],
  pattern?: MailboxPattern | null
): string[] {
  const root = String(domain || "")
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
  if (!root || isBlockedOutreachHost(root)) return [];
  const seen = new Set<string>();
  const guesses: string[] = [];
  for (const name of directorNames.slice(0, 1)) {
    const tokens = personTokens(name);
    if (tokens.length < 2) continue;
    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    if (CORP_TOKENS.has(first) || CORP_TOKENS.has(last)) continue;
    for (const local of localsForPerson(first, last, pattern)) {
      const email = `${local}@${root}`;
      if (seen.has(email)) continue;
      seen.add(email);
      guesses.push(email);
    }
  }
  return guesses;
}

export function domainCandidatesFromCompanyName(companyName: string): string[] {
  const tokens = String(companyName || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((token) => token.length >= 2 && !CORP_TOKENS.has(token));
  if (!tokens.length) return [];
  const joined = tokens.join("");
  const hyphen = tokens.join("-");
  const hosts = [`${joined}.co.uk`, `${hyphen}.co.uk`, `${joined}.com`];
  return [...new Set(hosts)];
}
