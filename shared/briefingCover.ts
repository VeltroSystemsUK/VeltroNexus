import { CONVERT_STOP_LINE } from "./smeConvert";

const COVER_P = 'style="margin:0 0 16px 0;line-height:1.5;"';
const TITLE_TOKEN = /^(mr|mrs|ms|miss|mx|dr|sir|dame|lord|lady|prof|professor)$/i;
const CORPORATE_NAME = /\b(limited|ltd\.?|plc|llp|llc|inc\.?|company|co\.?)\b/i;
const BANNED_GREETING = /^(hi|there|sir|madam|team|director)$/i;

function titleCaseToken(token: string): string {
  if (!token) return "";
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

function forenameFromOfficerName(raw?: string): string {
  const text = String(raw || "").trim();
  if (!text || CORPORATE_NAME.test(text)) return "";
  const forenames = text.includes(",") ? text.split(",")[1]?.trim() || "" : text;
  const tokens = forenames.split(/\s+/).filter(Boolean);
  const withoutTitle = tokens.length > 1 && TITLE_TOKEN.test(tokens[0]) ? tokens.slice(1) : tokens;
  const token = withoutTitle[0] || "";
  if (!token || BANNED_GREETING.test(token)) return "";
  return titleCaseToken(token.replace(/[.,;:]+$/g, ""));
}

export function briefingGreetingName(directors?: { name?: string }[]): string | undefined {
  for (const director of directors || []) {
    const first = forenameFromOfficerName(director?.name);
    if (first) return first;
  }
  return undefined;
}

export function buildCoverEmail(opts: {
  companyName: string;
  firstName?: string;
  briefingUrl: string;
}): {
  subject: string;
  html: string;
} {
  const name = opts.companyName || "your company";
  const hi = opts.firstName ? `Hi ${opts.firstName},` : "Hi,";
  return {
    subject: `A private note for the directors of ${name}`,
    html: `<p ${COVER_P}>${hi}</p><p ${COVER_P}>I put together a short private briefing for ${name}. The link isn't published — it's for you.</p><p ${COVER_P}><a href="${opts.briefingUrl}" target="_blank" rel="noopener noreferrer">Open your briefing</a></p><p ${COVER_P}>If this is in the right area, reply and I'll put a file together.</p><p ${COVER_P}>${CONVERT_STOP_LINE}</p>`,
  };
}
