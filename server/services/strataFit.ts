import { isHighRateLender, type HighRateLender } from "../data/highRateCommercialLenders";
import {
  excludedSectorReason,
  isBrokerProspect,
  MIN_TRADING_MONTHS as OS_MIN_TRADING_MONTHS,
  scoreSignals,
} from "@shared/salesOs";

export const MIN_FIT_SCORE = 70;
export const MIN_TRADING_MONTHS = OS_MIN_TRADING_MONTHS;

export type ChargeInput = {
  status?: string;
  createdOn?: string;
  personsEntitled?: string[];
};

export type StrataFitInput = {
  companyName: string;
  companyNumber: string;
  companyStatus?: string;
  companyStatusDetail?: string;
  dateOfCreation?: string;
  sicCodes?: string[];
  alreadyOnBook?: boolean;
  charges: ChargeInput[];
  hmrcTtp?: boolean;
  ccjs?: { amountGbp?: number | null; registeredAt: string }[];
};

export type StrataFitResult = {
  pass: boolean;
  score: number;
  rejectReason?: string;
  reasons: string[];
  summary: string;
  lenders: string[];
};

const TRADING_SIC_PREFIXES = [
  "10", "11", "13", "14", "15", "16", "17", "18", "20", "22", "23", "24", "25",
  "27", "28", "29", "30", "31", "32", "33",
  "41", "42", "43",
  "45", "46", "47",
  "49", "52",
  "55", "56",
  "81", "86", "87", "88", "95", "96",
];

function digits(sic: string): string {
  return String(sic || "").replace(/\D/g, "");
}

function sicLooksTrading(sicCodes: string[]): boolean {
  return sicCodes.some((sic) => {
    const code = digits(sic);
    return TRADING_SIC_PREFIXES.some((prefix) => code.startsWith(prefix));
  });
}

function monthsOld(dateOfCreation?: string): number | null {
  if (!dateOfCreation) return null;
  const created = new Date(dateOfCreation);
  if (Number.isNaN(created.getTime())) return null;
  return (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}

function outstandingCharges(charges: ChargeInput[]): ChargeInput[] {
  return charges.filter((charge) => {
    const status = (charge.status || "").toLowerCase();
    return status !== "satisfied" && status !== "fully-satisfied";
  });
}

export function rejectBeforeCharges(input: Omit<StrataFitInput, "charges">): string | null {
  const status = (input.companyStatus || "").toLowerCase();
  if (status && status !== "active") return `not trading (${status})`;

  const detail = (input.companyStatusDetail || "").toLowerCase();
  if (detail.includes("strike-off") || detail.includes("liquidation") || detail.includes("admin")) {
    return `not a going concern (${input.companyStatusDetail})`;
  }

  if (input.alreadyOnBook) return "already on the book";

  if (isBrokerProspect(input.companyName, input.sicCodes)) {
    return "commercial finance broker — excluded from origination";
  }

  const age = monthsOld(input.dateOfCreation);
  if (age !== null && age < MIN_TRADING_MONTHS) {
    return `too new (${Math.floor(age)} months trading)`;
  }

  const excluded = excludedSectorReason(input.sicCodes || [], input.companyName);
  if (excluded) return excluded;

  const name = input.companyName || "";
  if (/\b(spv|nominee)s?\b/i.test(name)) return "looks like an SPV / nominee";

  return null;
}

export function assessStrataFit(input: StrataFitInput): StrataFitResult {
  const early = rejectBeforeCharges(input);
  if (early) {
    return {
      pass: false,
      score: 0,
      rejectReason: early,
      reasons: [],
      summary: early,
      lenders: [],
    };
  }

  const outstanding = outstandingCharges(input.charges);
  const hits: HighRateLender[] = [];
  for (const charge of outstanding) {
    for (const person of charge.personsEntitled || []) {
      const hit = isHighRateLender(person);
      if (hit) hits.push(hit);
    }
  }

  const unique = [...new Map(hits.map((hit) => [hit.name, hit])).values()];
  const lenders = unique.map((hit) => hit.name);
  const hasMca = unique.some((hit) => hit.category === "mca");
  const hasAlternative = unique.some((hit) => hit.category === "alternative");
  const hasBridging = unique.some((hit) => hit.category === "bridging");
  const reasons: string[] = [];
  let score = 0;

  if (!unique.length && !input.hmrcTtp) {
    return {
      pass: false,
      score: 0,
      rejectReason: "no high-cost short-term debt on the public file",
      reasons: [],
      summary: "no high-cost short-term debt on the public file",
      lenders: [],
    };
  }

  if (input.hmrcTtp) {
    score += 70;
    reasons.push("HMRC Time to Pay / winding-up petition pressure on the public file");
  }

  if (hasMca) {
    score += 65;
    reasons.push(`merchant cash advance / daily-repay facility (${unique.filter((h) => h.category === "mca").map((h) => h.name).join(", ")})`);
  }
  if (hasAlternative) {
    score += 50;
    reasons.push(`high-cost alternative lender (${unique.filter((h) => h.category === "alternative").map((h) => h.name).join(", ")})`);
  }
  if (hasBridging) {
    score += 10;
    reasons.push(`bridging / specialist facility (${unique.filter((h) => h.category === "bridging").map((h) => h.name).join(", ")})`);
  }

  if (unique.length >= 2) {
    score += 25;
    reasons.push(`stacked high-cost lenders (${lenders.join(" + ")})`);
  }
  if (outstanding.length >= 2) {
    score += 15;
    reasons.push(`${outstanding.length} outstanding facilities — stacked repayments`);
  }
  if (outstanding.length >= 3) {
    score += 10;
    reasons.push("three or more live facilities");
  }

  const recent = outstanding.some((charge) => {
    if (!charge.createdOn) return false;
    const year = new Date(charge.createdOn).getFullYear();
    return year >= 2023 && year <= 2026;
  });
  if (recent) {
    score += 10;
    reasons.push("recent high-cost facility still live (maturity / refinance window)");
  }

  if (sicLooksTrading(input.sicCodes || [])) {
    score += 10;
    reasons.push("trading SME sector (construction, hospitality, retail, manufacturing, or services)");
  }

  const age = monthsOld(input.dateOfCreation);
  if (age !== null && age >= 24) {
    score += 5;
    reasons.push("established trading history (2+ years)");
  }

  score = Math.min(100, score);

  // A lone property bridge is the main false positive. MCA or alternative
  // short-term debt, HMRC arrears, or a real stack, is what Strata exists for.
  if (!input.hmrcTtp && !hasMca && !hasAlternative && !(hasBridging && outstanding.length >= 2)) {
    return {
      pass: false,
      score,
      rejectReason: "single bridge / property-style charge — not a Strata stacked-loan case",
      reasons,
      summary: "single bridge / property-style charge — not a Strata stacked-loan case",
      lenders,
    };
  }

  const signals = scoreSignals({
    companyName: input.companyName,
    sicCodes: input.sicCodes,
    outstandingHighCostChargeCount: unique.length,
    hmrcTtp: input.hmrcTtp,
  });
  for (const fired of signals.signals) {
    reasons.push(`${fired.code} ${fired.note}`);
  }

  const pass = score >= MIN_FIT_SCORE && !signals.disqualified;
  const summary = pass
    ? `Strata fit ${score}/100 — ${reasons[0]}`
    : `below Strata gate (${score}/${MIN_FIT_SCORE})`;

  return {
    pass,
    score,
    rejectReason: pass ? undefined : summary,
    reasons,
    summary,
    lenders,
  };
}

export function incorporatedToCutoff(): string {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - MIN_TRADING_MONTHS);
  return cutoff.toISOString().slice(0, 10);
}
