/**
 * Public-file parsers for SIG-02 (HMRC pressure).
 * HMRC Time to Pay is not a public register — Gazette winding-up petitions
 * with HMRC as petitioner are the live proxy. CCJs are not used for origination.
 */

export type HarvestedCcj = {
  amountGbp: number | null;
  registeredAt: string;
  source: string;
  excerpt: string;
};

export type HmrcMarker = {
  kind: "petition" | "arrears" | "ttp";
  publishedAt: string;
  source: string;
  note: string;
  companyNumber?: string;
  companyName?: string;
  hearingAt?: string;
  presentedAt?: string;
  caseNumber?: string;
};

export function toDealPetition(marker: HmrcMarker): {
  kind: "hmrc_winding_up";
  publishedAt: string;
  hearingAt?: string;
  presentedAt?: string;
  gazetteUrl?: string;
  caseNumber?: string;
} {
  return {
    kind: "hmrc_winding_up",
    publishedAt: marker.publishedAt,
    hearingAt: marker.hearingAt,
    presentedAt: marker.presentedAt,
    gazetteUrl: marker.source.startsWith("http") ? marker.source : undefined,
    caseNumber: marker.caseNumber,
  };
}

const HMRC_PETITIONER_RE =
  /\b(commissioners?\s+for\s+(his|her)\s+majesty'?s\s+revenue(?:\s+and\s+customs)?|hm\s+revenue\s+and\s+customs|\bhmrc\b)\b/i;

const COMPANY_NUMBER_RE = /\b(?:company\s+number|co(?:mpany)?\s*no\.?|registered\s+number)[:\s#]*([0-9A-Z]{6,8})\b/i;
const BARE_COMPANY_NUMBER_RE = /\b([0-9]{8}|[A-Z]{2}[0-9]{6})\b/;
const CCJ_RE = /\b(county\s+court\s+judg(?:e)?ments?|\bCCJs?)\b/i;
const GBP_RE = /£\s?([\d,]+(?:\.\d{1,2})?)/;

export function isHmrcPetitioner(text: string): boolean {
  return HMRC_PETITIONER_RE.test(String(text || ""));
}

export function extractCompanyNumber(text: string): string | undefined {
  const labelled = String(text || "").match(COMPANY_NUMBER_RE);
  if (labelled?.[1]) return labelled[1].toUpperCase();
  const bare = String(text || "").match(BARE_COMPANY_NUMBER_RE);
  return bare?.[1]?.toUpperCase();
}

export function parseGbpAmount(text: string): number | null {
  const match = String(text || "").match(GBP_RE);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

export function parseCcjMention(text: string, registeredAt: string, source: string): HarvestedCcj | null {
  const blob = String(text || "");
  if (!CCJ_RE.test(blob)) return null;
  return {
    amountGbp: parseGbpAmount(blob),
    registeredAt,
    source,
    excerpt: blob.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240),
  };
}

export function mentionsHmrcPressure(text: string): boolean {
  const blob = String(text || "");
  if (isHmrcPetitioner(blob) && /wind(?:ing)?[\s-]*up|petition|time\s+to\s+pay|\bTTP\b|tax\s+arrears|PAYE|VAT/i.test(blob)) {
    return true;
  }
  return /hmrc.{0,40}(time\s+to\s+pay|\bTTP\b|arrears|petition)/i.test(blob);
}

export function toScoreCcjs(ccjs: HarvestedCcj[]): { amountGbp?: number | null; registeredAt: string }[] {
  return ccjs
    .filter((ccj) => ccj.amountGbp == null || ccj.amountGbp <= 15_000)
    .map((ccj) => ({ amountGbp: ccj.amountGbp, registeredAt: ccj.registeredAt }));
}
