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

/** Cold (hunt) email only. Inbound already enquired — PECR soft opt-in. */
export function coldEmailBlockedReason(
  email?: string | null,
  stream?: string | null
): string | null {
  if (stream === "inbound") return null;
  if (!String(email || "").trim()) return "no email";
  if (isPersonalMailbox(email)) return "personal mailbox — PECR";
  return null;
}
