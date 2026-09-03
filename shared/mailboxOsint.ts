import { companyDomainFromWebsite, emailsFromScrapedText } from "./companyMailbox";
import { emailMatchesCompany, isBlockedOutreachMailbox, isPersonalMailbox } from "./pecrSend";

export function companyEmailSearchQuery(companyName: string): string {
  const name = String(companyName || "").trim();
  return `"${name}" (email OR enquiries OR contact) -endole -companieshouse -yell -"find-and-update"`;
}

const URL_RE = /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi;

export function harvestFromSearchSnippets(opts: {
  companyName: string;
  snippets: string[];
}): { emails: string[]; websites: string[] } {
  const blob = (opts.snippets || []).join("\n");
  const emails = emailsFromScrapedText(blob).filter((email) => {
    if (isPersonalMailbox(email) || isBlockedOutreachMailbox(email)) return false;
    return emailMatchesCompany(email, opts.companyName);
  });
  const websites: string[] = [];
  const seen = new Set<string>();
  for (const raw of blob.match(URL_RE) || []) {
    const url = raw.startsWith("http") ? raw.replace(/[),.;]+$/, "") : `https://${raw.replace(/[),.;]+$/, "")}`;
    const domain = companyDomainFromWebsite(url);
    if (!domain || seen.has(domain)) continue;
    if (!emailMatchesCompany(`info@${domain}`, opts.companyName)) continue;
    seen.add(domain);
    websites.push(url);
  }
  return { emails, websites };
}
