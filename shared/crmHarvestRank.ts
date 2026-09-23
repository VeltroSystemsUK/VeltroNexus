import { lenderCostForLead, type LenderCostCache } from "./lenderCost";

export type HarvestSkipClass = "charge_sme" | "ok_sme" | "charity_public" | "holding_spv" | "unsure";

export type HarvestRank = {
  harvestNow: boolean;
  smeBorrower: number;
  skipClass: HarvestSkipClass;
  at?: string;
};

export type HarvestRankLead = {
  id?: number;
  companyName?: string | null;
  companyType?: string | null;
  sicCode?: string | null;
  hasCharges?: boolean | null;
  identifiedLender?: string | null;
};

const CHARITY_PUBLIC =
  /\b(diocesan|parish|board of finance|church army|church of|charit(?:y|able)|c\.?i\.?c\.?|community interest|nhs|council|university|government|ministry)\b/i;

const HOLDING_SPV = /\b(holdings?|propert(?:y|ies)|estates?|investments?|nominees?|\bspv\b)\b/i;

function nameBlob(lead: HarvestRankLead): string {
  return `${lead.companyName || ""} ${lead.companyType || ""}`.replace(/[_-]+/g, " ");
}

export function obviousSkipClass(lead: HarvestRankLead): "charity_public" | "holding_spv" | null {
  const blob = nameBlob(lead);
  const type = String(lead.companyType || "").toLowerCase();
  if (/charit|cio|community.interest|industrial.and.provident/.test(type)) return "charity_public";
  if (CHARITY_PUBLIC.test(blob) || /\btrust\b/i.test(lead.companyName || "")) return "charity_public";
  if (HOLDING_SPV.test(blob)) return "holding_spv";
  return null;
}

const PROPERTY_CHARGE_NEEDLES = [
  "TOGETHER",
  "MARKET FINANCIAL",
  "GLENHAWK",
  "ROMA FINANCE",
  "LENDINVEST",
  "WEST ONE",
  "AUCTION FINANCE",
];

const BUSINESS_LOAN_NEEDLES = [
  "IWOCA",
  "YOULEND",
  "YOU LEND",
  "LIBERIS",
  "CAPIFY",
  "FLEXIMIZE",
  "FUNDING CIRCLE",
  "BOOST CAPITAL",
  "NUCLEUS",
  "MOMENTA",
  "365 BUSINESS",
  "UNCAPPED",
  "WAYFLYER",
  "PAYPAL",
  "STRIPE CAPITAL",
  "LOVE FINANCE",
  "NATIONWIDE FINANCE",
];

function lenderNames(raw?: string | null): string[] {
  return String(raw || "")
    .split(/[,;/|]|\band\b/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function lenderBlob(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function matchesNeedle(name: string, needles: string[]): boolean {
  const blob = lenderBlob(name);
  return needles.some((needle) => blob.includes(needle));
}

export function chargeHarvestSignal(lead: HarvestRankLead): "business" | "property_only" | "none" {
  const names = lenderNames(lead.identifiedLender);
  const business = names.some((name) => matchesNeedle(name, BUSINESS_LOAN_NEEDLES));
  if (business) return "business";
  const property = names.some((name) => matchesNeedle(name, PROPERTY_CHARGE_NEEDLES));
  if (property) return "property_only";
  return "none";
}

export function harvestPriority(
  lead: HarvestRankLead,
  rank?: HarvestRank | null,
  cache?: LenderCostCache,
): number {
  const skip = rank?.skipClass || obviousSkipClass(lead);
  if (skip === "charity_public" || skip === "holding_spv") return -1;
  const cost = lenderCostForLead(lead.identifiedLender, cache, lead);
  if (cost.lenderBand === "property") return 0;
  let score = 0;
  if (rank?.harvestNow) score += 100;
  score += Math.max(0, Number(rank?.smeBorrower) || 0) * 10;
  if (lead.hasCharges) score += 25;
  if (rank?.skipClass === "charge_sme") score += 40;
  score += cost.lenderCost;
  return score;
}

export function compareHarvestRank(
  a: { lead: HarvestRankLead; rank?: HarvestRank | null },
  b: { lead: HarvestRankLead; rank?: HarvestRank | null },
  cache?: LenderCostCache,
): number {
  const delta = harvestPriority(b.lead, b.rank, cache) - harvestPriority(a.lead, a.rank, cache);
  if (delta !== 0) return delta;
  return (Number(a.lead.id) || 0) - (Number(b.lead.id) || 0);
}

export function isHarvestSkipClass(skip?: string | null): boolean {
  return skip === "charity_public" || skip === "holding_spv";
}
