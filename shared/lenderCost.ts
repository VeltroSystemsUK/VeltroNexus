import { isBankOrBuildingSocietyChargee } from "./chargeClassifier";

export type LenderBand = "mca" | "high_cost" | "specialist" | "high_street" | "property" | "unknown";

export type LenderCostRank = {
  band: LenderBand;
  typicalApr: number;
  at?: string;
};

export type LenderCostCache = Record<string, LenderCostRank>;

export type LenderCostCompany = {
  companyName?: string | null;
  companyType?: string | null;
};

const TOGETHER_TRADING_APR = 11;

const TOGETHER_VEHICLE =
  /\b(holdings?|propert(?:y|ies)|estates?|investments?|nominees?|developments?|\bspv\b|trust)\b/i;

const TOGETHER_CHARITY =
  /\b(diocesan|parish|board of finance|church army|church of|charit(?:y|able)|c\.?i\.?c\.?|community interest|nhs|council|university|government|ministry)\b/i;

function isTogetherTradingBorrower(company?: LenderCostCompany | null): boolean {
  const name = String(company?.companyName || "").trim();
  if (!name) return false;
  const type = String(company?.companyType || "").toLowerCase();
  if (/charit|cio|community.interest|industrial.and.provident/.test(type)) return false;
  const blob = `${name} ${company?.companyType || ""}`.replace(/[_-]+/g, " ");
  if (TOGETHER_CHARITY.test(blob) || TOGETHER_VEHICLE.test(blob)) return false;
  return true;
}

const CATALOG: Array<{ needle: string; band: LenderBand; typicalApr: number }> = [
  { needle: "YOULEND", band: "mca", typicalApr: 50 },
  { needle: "YOU LEND", band: "mca", typicalApr: 50 },
  { needle: "LIBERIS", band: "mca", typicalApr: 50 },
  { needle: "IWOCA", band: "mca", typicalApr: 49 },
  { needle: "365 BUSINESS", band: "mca", typicalApr: 45 },
  { needle: "BIZCAP", band: "mca", typicalApr: 40 },
  { needle: "NATIONWIDE FINANCE", band: "mca", typicalApr: 40 },
  { needle: "WAYFLYER", band: "mca", typicalApr: 40 },
  { needle: "REVENU", band: "mca", typicalApr: 40 },
  { needle: "CAPIFY", band: "high_cost", typicalApr: 40 },
  { needle: "UNCAPPED", band: "mca", typicalApr: 35 },
  { needle: "PAYPAL", band: "mca", typicalApr: 35 },
  { needle: "STRIPE CAPITAL", band: "mca", typicalApr: 30 },
  { needle: "REWARD FINANCE", band: "high_cost", typicalApr: 30 },
  { needle: "FLEXIMIZE", band: "high_cost", typicalApr: 25 },
  { needle: "ULTIMATE FINANCE", band: "high_cost", typicalApr: 25 },
  { needle: "BOOST CAPITAL", band: "high_cost", typicalApr: 22 },
  { needle: "LOVE FINANCE", band: "specialist", typicalApr: 18 },
  { needle: "FUNDING CIRCLE", band: "specialist", typicalApr: 15 },
  { needle: "NUCLEUS", band: "specialist", typicalApr: 15 },
  { needle: "MOMENTA", band: "specialist", typicalApr: 15 },
];

const PROPERTY_NEEDLES = [
  "TOGETHER",
  "MARKET FINANCIAL",
  "GLENHAWK",
  "ROMA FINANCE",
  "LENDINVEST",
  "LEND INVEST",
  "WEST ONE",
  "AUCTION FINANCE",
  "OCTANE",
  "LANDBAY",
  "KUFLINK",
  "HOPE CAPITAL",
  "CASTLE TRUST",
  "INTERBAY",
];

export function lenderKey(name: string): string {
  return String(name || "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitLenderNames(raw?: string | null): string[] {
  return String(raw || "")
    .split(/[,;/|]|\band\b/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function uniqueLenderNames(leads: Array<{ identifiedLender?: string | null }>): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const lead of leads) {
    for (const name of splitLenderNames(lead.identifiedLender)) {
      const key = lenderKey(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
  }
  return names;
}

function bandDefault(band: LenderBand): number {
  if (band === "mca") return 45;
  if (band === "high_cost") return 28;
  if (band === "specialist") return 14;
  if (band === "high_street") return 8;
  return 0;
}

export function classifyLender(name: string, cache?: LenderCostCache, company?: LenderCostCompany): LenderCostRank {
  const blob = lenderKey(name);
  if (!blob) return { band: "unknown", typicalApr: 0 };
  for (const row of CATALOG) {
    if (blob.includes(row.needle)) return { band: row.band, typicalApr: row.typicalApr };
  }
  if (PROPERTY_NEEDLES.some((needle) => blob.includes(needle))) {
    if (blob.includes("TOGETHER") && isTogetherTradingBorrower(company)) {
      return { band: "specialist", typicalApr: TOGETHER_TRADING_APR };
    }
    return { band: "property", typicalApr: 0 };
  }
  if (isBankOrBuildingSocietyChargee(name)) {
    return { band: "high_street", typicalApr: 8 };
  }
  const cached = cache?.[blob];
  if (cached) {
    const typicalApr = Number(cached.typicalApr);
    return {
      band: cached.band,
      typicalApr: Number.isFinite(typicalApr) && typicalApr > 0 ? typicalApr : bandDefault(cached.band),
      at: cached.at,
    };
  }
  return { band: "unknown", typicalApr: 0 };
}

export function lenderCostForLead(
  raw?: string | null,
  cache?: LenderCostCache,
  company?: LenderCostCompany,
): { lenderCost: number; lenderBand: LenderBand } {
  const names = splitLenderNames(raw);
  if (!names.length) return { lenderCost: 0, lenderBand: "unknown" };
  let best = classifyLender(names[0], cache, company);
  for (let i = 1; i < names.length; i++) {
    const row = classifyLender(names[i], cache, company);
    if (row.typicalApr > best.typicalApr) best = row;
  }
  return { lenderCost: best.typicalApr, lenderBand: best.band };
}

export function annotateLenderCost<T extends { identifiedLender?: string | null; companyName?: string | null; companyType?: string | null }>(
  leads: T[],
  cache?: LenderCostCache,
): Array<T & { lenderCost: number; lenderBand: LenderBand }> {
  return leads.map((lead) => {
    const { lenderCost, lenderBand } = lenderCostForLead(lead.identifiedLender, cache, lead);
    return { ...lead, lenderCost, lenderBand };
  });
}

export async function cacheLenderCosts(opts: {
  names: string[];
  store: LenderCostCache;
  rank: (name: string) => Promise<LenderCostRank>;
  limit?: number;
}): Promise<{ known: number; already: number; jev: number }> {
  const limit = opts.limit ?? Number.POSITIVE_INFINITY;
  let known = 0;
  let already = 0;
  let jev = 0;
  for (const name of opts.names) {
    const key = lenderKey(name);
    if (!key) continue;
    if (opts.store[key]) {
      already += 1;
      continue;
    }
    const catalogued = classifyLender(name);
    if (catalogued.band !== "unknown") {
      opts.store[key] = catalogued;
      known += 1;
      continue;
    }
    if (jev >= limit) continue;
    const ranked = await opts.rank(name);
    if (ranked.band === "unknown" && !ranked.at) continue;
    opts.store[key] = ranked;
    jev += 1;
  }
  return { known, already, jev };
}
