import {
  excludedSectorReason,
  isBrokerProspect,
  MIN_TRADING_MONTHS,
  scoreSignals,
  type SignalScore,
} from "./salesOs";
import {
  countLiveNonBankCharges,
  isBankOrBuildingSocietyChargee,
  isLiveCharge,
} from "./chargeClassifier";

export type SlfProduct = "hmrc_distress" | "stacked_debt" | "high_cost_refi" | "none";
export type SlfPriority = "hot" | "warm" | "watch" | "noise" | "unresolved" | "suppressed";
export type SlfGate = "queue" | "drop" | "suppress" | "unresolved" | "noise";

export type SlfCharge = {
  status?: string | null;
  createdOn?: string | null;
  satisfiedOn?: string | null;
  personsEntitled?: string[];
};

export type SlfSnapshot = {
  companyName: string;
  companyNumber?: string;
  companyStatus?: string;
  dateOfCreation?: string;
  sicCodes?: string[];
  charges?: SlfCharge[];
  hasPetition?: boolean;
  petitionAt?: string;
  hasInsolvencyCase?: boolean;
  resolutionConfidence?: number;
  operatorFlag?: boolean;
  distressedProduct?: boolean;
};

export type SlfSignal = {
  signalType: string;
  weight: number;
  freshness: number;
  eventAt?: string;
};

export type SlfScoreResult = {
  gate: SlfGate;
  dropReason?: string;
  salesOs: SignalScore;
  liveNonBankCount: number;
  primaryProduct: SlfProduct;
  secondaryProduct?: SlfProduct;
  rank: number;
  priority: SlfPriority;
  signals: SlfSignal[];
  breakdown: Record<string, number>;
};

export const SLF_WEIGHTS: Record<string, number> = {
  "gazette.winding_up_petition": 95,
  "ch.insolvency_case": 90,
  "charge.multiple_outstanding": 70,
  "charge.created": 50,
  "accounts.interest_spike": 40,
  "accounts.late": 25,
  "manual.operator_flag": 100,
  "charge.high_street": 0,
  "charge.just_refinanced": -40,
};

const DAY_MS = 24 * 60 * 60 * 1000;

function monthsOld(dateOfCreation: string | undefined, now: Date): number | null {
  if (!dateOfCreation) return null;
  const created = new Date(dateOfCreation);
  if (Number.isNaN(created.getTime())) return null;
  return (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}

function daysAgo(iso: string | undefined, now: Date): number | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return (now.getTime() - at.getTime()) / DAY_MS;
}

function calendarFreshness(eventAt: string | undefined, now: Date): number {
  const days = daysAgo(eventAt, now);
  if (days == null) return 1;
  if (days <= 7) return 1;
  if (days <= 30) return 0.7;
  if (days <= 90) return 0.4;
  if (days <= 365) return 0.15;
  return 0;
}

function liveHighStreetCount(charges: SlfCharge[]): number {
  let count = 0;
  for (const charge of charges) {
    if (!isLiveCharge(charge.status)) continue;
    const names = charge.personsEntitled || [];
    if (names.length === 0) continue;
    if (names.every((person) => isBankOrBuildingSocietyChargee(person))) count += 1;
  }
  return count;
}

export function isJustRefinanced(charges: SlfCharge[], hasPetition: boolean, now: Date): boolean {
  if (hasPetition) return false;
  if (countLiveNonBankCharges(charges) > 0) return false;
  const recentlySatisfiedNonBank = charges.some((charge) => {
    if (isLiveCharge(charge.status)) return false;
    const names = charge.personsEntitled || [];
    if (!names.some((person) => !isBankOrBuildingSocietyChargee(person))) return false;
    const days = daysAgo(charge.satisfiedOn || undefined, now);
    return days != null && days <= 60;
  });
  const recentHighStreet = charges.some((charge) => {
    if (!isLiveCharge(charge.status)) return false;
    const names = charge.personsEntitled || [];
    if (!names.some((person) => isBankOrBuildingSocietyChargee(person))) return false;
    const days = daysAgo(charge.createdOn || undefined, now);
    return days != null && days <= 60;
  });
  return recentlySatisfiedNonBank && recentHighStreet;
}

export function classifyStreamAProduct(input: {
  hasPetition?: boolean;
  hasInsolvencyCase?: boolean;
  liveNonBankCount: number;
  distressedProduct?: boolean;
}): { primary: SlfProduct; secondary?: SlfProduct } {
  const distressedOn = input.distressedProduct !== false;
  const distress = distressedOn && (input.hasPetition || input.hasInsolvencyCase);
  if (distress && input.liveNonBankCount >= 3) {
    return { primary: "hmrc_distress", secondary: "stacked_debt" };
  }
  if (distress) return { primary: "hmrc_distress" };
  if (input.liveNonBankCount >= 3) return { primary: "stacked_debt" };
  if (input.liveNonBankCount >= 1) return { primary: "high_cost_refi" };
  return { primary: "none" };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function scoreCompanySnapshot(input: SlfSnapshot, now = new Date()): SlfScoreResult {
  const charges = input.charges || [];
  const liveNonBankCount = countLiveNonBankCharges(charges);
  const resolution = input.resolutionConfidence ?? (input.companyNumber ? 1 : 0);
  const salesOs = scoreSignals({
    companyName: input.companyName,
    sicCodes: input.sicCodes,
    outstandingHighCostChargeCount: liveNonBankCount,
    hmrcTtp: !!input.hasPetition,
  });

  const empty = (gate: SlfGate, extra: Partial<SlfScoreResult> = {}): SlfScoreResult => ({
    gate,
    salesOs,
    liveNonBankCount,
    primaryProduct: "none",
    rank: 0,
    priority: gate === "unresolved" ? "unresolved" : gate === "suppress" ? "suppressed" : gate === "drop" ? "noise" : "noise",
    signals: [],
    breakdown: {},
    ...extra,
  });

  const status = (input.companyStatus || "").toLowerCase();
  if (status && status !== "active") {
    return empty("drop", { dropReason: `not trading (${input.companyStatus})`, priority: "noise" });
  }

  if (isBrokerProspect(input.companyName, input.sicCodes)) {
    return empty("drop", { dropReason: "commercial finance broker — excluded from origination" });
  }

  const excluded = excludedSectorReason(input.sicCodes || [], input.companyName);
  if (excluded) return empty("drop", { dropReason: excluded });

  const age = monthsOld(input.dateOfCreation, now);
  if (age != null && age < MIN_TRADING_MONTHS) {
    return empty("drop", { dropReason: `too new (${Math.floor(age)} months trading)` });
  }

  if (salesOs.disqualified) {
    return empty("drop", { dropReason: salesOs.signals[0]?.note || "SIG-06" });
  }

  if (resolution < 0.85) {
    return empty("unresolved", { priority: "unresolved" });
  }

  if (isJustRefinanced(charges, !!input.hasPetition, now)) {
    return empty("suppress", {
      priority: "suppressed",
      signals: [{ signalType: "charge.just_refinanced", weight: -40, freshness: 1 }],
    });
  }

  const product = classifyStreamAProduct({
    hasPetition: input.hasPetition,
    hasInsolvencyCase: input.hasInsolvencyCase,
    liveNonBankCount,
    distressedProduct: input.distressedProduct,
  });

  const signals: SlfSignal[] = [];
  if (input.hasPetition) {
    signals.push({
      signalType: "gazette.winding_up_petition",
      weight: SLF_WEIGHTS["gazette.winding_up_petition"],
      freshness: calendarFreshness(input.petitionAt, now),
      eventAt: input.petitionAt,
    });
  }
  if (input.hasInsolvencyCase) {
    signals.push({
      signalType: "ch.insolvency_case",
      weight: SLF_WEIGHTS["ch.insolvency_case"],
      freshness: 1,
    });
  }
  if (liveNonBankCount >= 3) {
    signals.push({
      signalType: "charge.multiple_outstanding",
      weight: SLF_WEIGHTS["charge.multiple_outstanding"],
      freshness: 1,
    });
  } else if (liveNonBankCount >= 1) {
    const newest = charges
      .filter((c) => isLiveCharge(c.status))
      .map((c) => c.createdOn)
      .filter(Boolean)
      .sort()
      .slice(-1)[0];
    signals.push({
      signalType: "charge.created",
      weight: SLF_WEIGHTS["charge.created"],
      freshness: 1,
      eventAt: newest || undefined,
    });
  }
  if (input.operatorFlag) {
    signals.push({
      signalType: "manual.operator_flag",
      weight: SLF_WEIGHTS["manual.operator_flag"],
      freshness: 1,
    });
  }

  const resolutionFactor = resolution >= 0.9 ? 1 : 0.5;
  const breakdown: Record<string, number> = {};
  let rank = 0;
  for (const signal of signals) {
    const part = signal.weight * signal.freshness * resolutionFactor;
    breakdown[signal.signalType] = part;
    rank += part;
  }
  rank = clamp(rank);

  let priority: SlfPriority = "noise";
  if (product.primary === "none") priority = "noise";
  else if (input.hasPetition || input.hasInsolvencyCase || liveNonBankCount >= 3 || rank >= 75) priority = "hot";
  else if (liveNonBankCount >= 1) priority = "warm";
  else priority = "watch";

  if (resolution < 0.9 && priority === "hot") priority = "watch";

  const gate: SlfGate = product.primary === "none" ? "noise" : "queue";

  return {
    gate,
    salesOs,
    liveNonBankCount,
    primaryProduct: product.primary,
    secondaryProduct: product.secondary,
    rank,
    priority: gate === "noise" ? "noise" : priority,
    signals,
    breakdown,
  };
}
