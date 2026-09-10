/**
 * Nexus Sales Agent Operating System
 * Strata Finance lead identification & origination.
 *
 * This module is the executable source of truth. Agents, scoring, outreach
 * cadences, and qualification gates must read from here — do not fork copy
 * or weights in prompts.
 */

export const SALES_OS_VERSION = "2026.1";

export const FACILITY_MIN_GBP = 25_000;
export const FACILITY_MAX_GBP = 250_000;
export const TURNOVER_MIN_GBP = 250_000;
export const TURNOVER_MAX_GBP = 5_000_000;
export const TURNOVER_DISQUALIFY_GBP = 100_000;
export const MIN_TRADING_MONTHS = 12;

export const CDFI_PANEL = [
  "Finance For Enterprise (FFE)",
  "BCRS Business Loans",
  "Coventry & Warwickshire Reinvestment Trust (CWRT)",
  "SWIG Finance",
  "Let's Do Business Finance (LDBF)",
  "ART",
  "Business Enterprise Fund (BEF)",
  "Development Bank of Wales (DBW)",
] as const;

export const PACKAGING_FRAMEWORK = {
  name: "Passan-format",
  operator: "Sterling Capital Reserve Limited",
  sections: [1, 2, 3, 4, 5] as const,
  requires: [
    "24-month cash flow forecast",
    "Balance sheet",
    "Single-entity CFADS/DSCR model",
  ],
};

export type SalesStream = "sme" | "introducer" | "inbound";
export type SignalCode = "SIG-01" | "SIG-02" | "SIG-03" | "SIG-04" | "SIG-05" | "SIG-06";
export type SignalPriority = "P0" | "P1" | "disqualified";

export const SIGNAL_MATRIX: Record<
  SignalCode,
  { description: string; weight: number; priority: SignalPriority }
> = {
  "SIG-01": {
    description: "One live non-bank charge (HP, lease, invoice finance, MCA, or specialist)",
    weight: 40,
    priority: "P0",
  },
  "SIG-02": {
    description: "Gazette HMRC winding-up petition — primary buying signal (still trading, hearing pending)",
    weight: 50,
    priority: "P0",
  },
  "SIG-03": {
    description: "CCJs — not used for origination (too late; the file is already distressed)",
    weight: 0,
    priority: "P1",
  },
  "SIG-04": {
    description: "Tangible net worth erosion with sustained operational turnover (>£250k)",
    weight: 20,
    priority: "P1",
  },
  "SIG-05": {
    description: "Accountancy firm with 5+ staff lacking an in-house corporate finance / debt advisory desk",
    weight: 30,
    priority: "P1",
  },
  "SIG-06": {
    description: "Consumer debt, personal insolvency without a trading entity, or turnover <£100k",
    weight: -100,
    priority: "disqualified",
  },
};

export const DAILY_SCHEDULE = [
  { start: "08:30", end: "09:30", job: "Ingest Companies House charges and Gazette HMRC petitions" },
  { start: "09:30", end: "11:30", job: "Voice outreach to SME directors (opened / engaged emails)" },
  { start: "11:30", end: "12:30", job: "LinkedIn profile views and connection requests" },
  { start: "13:30", end: "15:30", job: "Voice outreach to accountancy partners and introducers" },
  { start: "15:30", end: "16:30", job: "Triage incoming debt schedules, CFF extraction, proposal queue" },
  { start: "16:30", end: "17:30", job: "Pipeline sync and next-day multi-touch staging" },
] as const;

export const OPERATING_KPIS = [
  { metric: "Direct lead volume", target: "250 verified directors / week", onMiss: "Expand Companies House query parameters" },
  { metric: "Introducer lead volume", target: "100 accountancy partners / week", onMiss: "Ingest regional ICAEW/ACCA directories" },
  { metric: "Outreach response rate", target: "≥ 6.0% positive", onMiss: "Refine subject lines and cash-flow savings hooks" },
  { metric: "Weekly debt reviews booked", target: "≥ 5 qualified reviews / week", onMiss: "Audit voice scripts and increase call density" },
  { metric: "File quality conversion", target: "≥ 70% to proposal stage", onMiss: "Require 3-year accounts and debt schedules at intake" },
] as const;

const BROKER_NAME_RE =
  /\b(nacfb|fiba|commercial finance brokers?|finance brokers?|loan brokers?|loan packagers?|money brokers?|finance brokerages?|brokerage ltd|brokerage limited)\b/i;

const BROKER_QUERY_RE =
  /\b(nacfb|fiba|loan packagers?|finance brokers?|commercial finance brokers?|broker lists?|introducer networks?|independent brokers?)\b/i;

const INTRODUCER_NAME_RE =
  /\b(chartered accountants?|accountants?|accountancy|insolvency|turnaround|restructuring|fractional cfo|tax advisers?)\b/i;

/** Development of building projects. Construction (412xx) remains eligible. */
const EXCLUDED_SIC_EXACT = new Set(["41100", "92000", "12000", "46350", "47260"]);

const EXCLUDED_SIC_PREFIXES = [
  "64", // financial services (includes 64921 brokers)
  "65", // insurance
  "66", // auxiliary finance
  "68", // real estate
  "92", // gambling
  "12", // tobacco manufacture
  "7010",
  "99999",
];

const INTRODUCER_SIC_PREFIXES = ["692", "7022"];

export function digits(sic: string): string {
  return String(sic || "").replace(/\D/g, "");
}

export function isBrokerSearchQuery(query: string): boolean {
  return BROKER_QUERY_RE.test(String(query || ""));
}

export function isBrokerProspect(companyName: string, sicCodes: string[] = []): boolean {
  if (BROKER_NAME_RE.test(companyName || "")) return true;
  return sicCodes.some((sic) => {
    const code = digits(sic);
    return code.startsWith("64921") || code.startsWith("64922");
  });
}

export function excludedSectorReason(sicCodes: string[] = [], companyName = ""): string | null {
  if (/\b(property\s+(investment|holdings?|developments?)|gambling|casino|bookmaker|tobacco)\b/i.test(companyName)) {
    return "excluded sector (property development, gambling, or tobacco)";
  }
  for (const sic of sicCodes) {
    const code = digits(sic);
    if (!code) continue;
    if (EXCLUDED_SIC_EXACT.has(code) || EXCLUDED_SIC_EXACT.has(code.padStart(5, "0"))) {
      return `wrong sector (SIC ${code})`;
    }
    if (EXCLUDED_SIC_PREFIXES.some((prefix) => code.startsWith(prefix))) {
      return `wrong sector (SIC ${code})`;
    }
  }
  return null;
}

export function looksLikeIntroducer(companyName: string, sicCodes: string[] = []): boolean {
  if (INTRODUCER_NAME_RE.test(companyName || "")) return true;
  return sicCodes.some((sic) => {
    const code = digits(sic);
    return INTRODUCER_SIC_PREFIXES.some((prefix) => code.startsWith(prefix));
  });
}

export function formatFacilityBand(loanAmountPence?: number | null): string {
  if (loanAmountPence && loanAmountPence >= FACILITY_MIN_GBP * 100 && loanAmountPence <= FACILITY_MAX_GBP * 100) {
    const gbp = Math.round(loanAmountPence / 100);
    return `£${gbp.toLocaleString("en-GB")}`;
  }
  return "£25,000 to £250,000";
}

export type SignalInput = {
  companyName: string;
  sicCodes?: string[];
  outstandingHighCostChargeCount?: number;
  hmrcTtp?: boolean;
  ccjs?: { amountGbp?: number | null; registeredAt: string }[];
  turnoverGbp?: number | null;
  netAssetsNow?: number | null;
  netAssetsPrior?: number | null;
  staffCount?: number | null;
  hasInHouseDebtAdvisory?: boolean;
  consumerDebtOnly?: boolean;
  personalInsolvencyNoTradingEntity?: boolean;
};

export type FiredSignal = {
  code: SignalCode;
  weight: number;
  priority: SignalPriority;
  note: string;
};

export type SignalScore = {
  score: number;
  priority: SignalPriority | "unscored";
  disqualified: boolean;
  signals: FiredSignal[];
};

export function scoreSignals(input: SignalInput, now = Date.now()): SignalScore {
  const signals: FiredSignal[] = [];

  if (input.consumerDebtOnly || input.personalInsolvencyNoTradingEntity || (input.turnoverGbp != null && input.turnoverGbp < TURNOVER_DISQUALIFY_GBP)) {
    const sig = SIGNAL_MATRIX["SIG-06"];
    signals.push({
      code: "SIG-06",
      weight: sig.weight,
      priority: sig.priority,
      note:
        input.turnoverGbp != null && input.turnoverGbp < TURNOVER_DISQUALIFY_GBP
          ? `turnover £${Math.round(input.turnoverGbp).toLocaleString("en-GB")} below £100k floor`
          : "consumer / non-trading insolvency profile",
    });
    return { score: sig.weight, priority: "disqualified", disqualified: true, signals };
  }

  const highCost = input.outstandingHighCostChargeCount || 0;
  if (highCost >= 1) {
    const sig = SIGNAL_MATRIX["SIG-01"];
    signals.push({
      code: "SIG-01",
      weight: sig.weight,
      priority: sig.priority,
      note: `${highCost} live non-bank charge${highCost === 1 ? "" : "s"}`,
    });
  }

  if (input.hmrcTtp) {
    const sig = SIGNAL_MATRIX["SIG-02"];
    signals.push({
      code: "SIG-02",
      weight: sig.weight,
      priority: sig.priority,
      note: "HMRC winding-up petition on the Gazette (buying signal)",
    });
  }

  if (
    input.turnoverGbp != null &&
    input.turnoverGbp >= TURNOVER_MIN_GBP &&
    input.netAssetsNow != null &&
    input.netAssetsPrior != null &&
    input.netAssetsNow < input.netAssetsPrior
  ) {
    const sig = SIGNAL_MATRIX["SIG-04"];
    signals.push({
      code: "SIG-04",
      weight: sig.weight,
      priority: sig.priority,
      note: "net worth erosion with turnover still above £250k",
    });
  }

  const introducer = looksLikeIntroducer(input.companyName, input.sicCodes);
  if (introducer && input.hasInHouseDebtAdvisory !== true) {
    const sig = SIGNAL_MATRIX["SIG-05"];
    const staffOk = input.staffCount == null || input.staffCount >= 5;
    if (staffOk) {
      signals.push({
        code: "SIG-05",
        weight: sig.weight,
        priority: sig.priority,
        note: input.staffCount == null ? "accountancy / advisory practice (staff count unconfirmed)" : `${input.staffCount} staff, no in-house debt desk`,
      });
    }
  }

  const score = signals.reduce((sum, item) => sum + item.weight, 0);
  const hasP0 = signals.some((item) => item.priority === "P0");
  const priority: SignalPriority | "unscored" = signals.length === 0 ? "unscored" : hasP0 ? "P0" : "P1";
  return { score, priority, disqualified: false, signals };
}

export type StreamDecision = {
  stream: SalesStream | null;
  reason: string;
};

export function classifyProspectStream(input: {
  source?: string;
  companyName: string;
  sicCodes?: string[];
  hasHighCostDebt?: boolean;
}): StreamDecision {
  if (input.source === "strata_inbound") {
    return { stream: "inbound", reason: "live Strata enquiry" };
  }
  if (isBrokerProspect(input.companyName, input.sicCodes)) {
    return { stream: null, reason: "commercial finance broker — excluded from origination" };
  }
  const sector = excludedSectorReason(input.sicCodes, input.companyName);
  if (sector) return { stream: null, reason: sector };

  if (input.hasHighCostDebt) {
    return { stream: "sme", reason: "direct SME with high-cost debt on the public file" };
  }
  if (looksLikeIntroducer(input.companyName, input.sicCodes)) {
    return { stream: "introducer", reason: "accountancy / CFO / turnaround introducer" };
  }
  return { stream: "sme", reason: "direct SME candidate" };
}

export type CadenceChannel = "email" | "linkedin" | "email+call" | "warm-call";

export type CadenceTouchId =
  | "inbound_ack"
  | "inbound_chase"
  | "sme_1"
  | "sme_linkedin"
  | "sme_2"
  | "sme_close"
  | "intro_1"
  | "intro_linkedin"
  | "intro_mid"
  | "intro_2";

export type CadenceStep = {
  index: number;
  day: number;
  delayDaysFromPrevious: number;
  touchId: CadenceTouchId;
  channel: CadenceChannel;
  autoSend: boolean;
  queueCall: boolean;
  job: string;
};

export const SME_CADENCE: CadenceStep[] = [
  { index: 1, day: 1, delayDaysFromPrevious: 0, touchId: "sme_1", channel: "email", autoSend: true, queueCall: false, job: "Debt service reduction — first email" },
  { index: 2, day: 4, delayDaysFromPrevious: 3, touchId: "sme_linkedin", channel: "linkedin", autoSend: false, queueCall: false, job: "LinkedIn profile review + connection request" },
  { index: 3, day: 8, delayDaysFromPrevious: 4, touchId: "sme_2", channel: "email", autoSend: true, queueCall: false, job: "Commercial case study email" },
  { index: 4, day: 14, delayDaysFromPrevious: 6, touchId: "sme_close", channel: "email+call", autoSend: true, queueCall: true, job: "Final review email + SME call queue" },
];

export const INTRODUCER_CADENCE: CadenceStep[] = [
  { index: 1, day: 1, delayDaysFromPrevious: 0, touchId: "intro_1", channel: "email", autoSend: true, queueCall: false, job: "Stream B open — packager, you keep the client" },
  { index: 2, day: 3, delayDaysFromPrevious: 2, touchId: "intro_linkedin", channel: "linkedin", autoSend: false, queueCall: false, job: "LinkedIn staged — director posts" },
  { index: 3, day: 5, delayDaysFromPrevious: 2, touchId: "intro_mid", channel: "email", autoSend: true, queueCall: false, job: "How a file moves" },
  { index: 4, day: 10, delayDaysFromPrevious: 5, touchId: "intro_2", channel: "email+call", autoSend: true, queueCall: true, job: "Last note — queue partner call" },
];

export const INBOUND_CADENCE: CadenceStep[] = [
  { index: 1, day: 0, delayDaysFromPrevious: 0, touchId: "inbound_ack", channel: "email", autoSend: true, queueCall: false, job: "Thank them and request the pack" },
  { index: 2, day: 3, delayDaysFromPrevious: 3, touchId: "inbound_chase", channel: "email", autoSend: true, queueCall: true, job: "Chase the pack, then warm inbound call" },
];

export function cadenceFor(stream: SalesStream): CadenceStep[] {
  if (stream === "introducer") return INTRODUCER_CADENCE;
  if (stream === "inbound") return INBOUND_CADENCE;
  return SME_CADENCE;
}

export function dealStream(source?: string, stream?: SalesStream | string | null): SalesStream {
  if (source === "strata_inbound") return "inbound";
  if (stream === "introducer" || stream === "sme" || stream === "inbound") return stream;
  return "sme";
}

export function nextCadenceStep(stream: SalesStream, completedTouches: number): CadenceStep | null {
  return cadenceFor(stream)[completedTouches] || null;
}

export function assessIntroducerFit(input: {
  companyName: string;
  sicCodes?: string[];
  companyStatus?: string;
  dateOfCreation?: string;
  alreadyOnBook?: boolean;
}): { pass: boolean; score: number; rejectReason?: string; reasons: string[]; summary: string } {
  const status = (input.companyStatus || "").toLowerCase();
  if (status && status !== "active") {
    return { pass: false, score: 0, rejectReason: `not trading (${status})`, reasons: [], summary: `not trading (${status})` };
  }
  if (input.alreadyOnBook) {
    return { pass: false, score: 0, rejectReason: "already on the book", reasons: [], summary: "already on the book" };
  }
  if (isBrokerProspect(input.companyName, input.sicCodes)) {
    return {
      pass: false,
      score: 0,
      rejectReason: "commercial finance broker — excluded from origination",
      reasons: [],
      summary: "commercial finance broker — excluded from origination",
    };
  }
  const sector = excludedSectorReason(input.sicCodes, input.companyName);
  if (sector) return { pass: false, score: 0, rejectReason: sector, reasons: [], summary: sector };

  if (input.dateOfCreation) {
    const created = new Date(input.dateOfCreation);
    if (!Number.isNaN(created.getTime())) {
      const months = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      if (months < MIN_TRADING_MONTHS) {
        const reason = `too new (${Math.floor(months)} months trading)`;
        return { pass: false, score: 0, rejectReason: reason, reasons: [], summary: reason };
      }
    }
  }

  if (!looksLikeIntroducer(input.companyName, input.sicCodes)) {
    return {
      pass: false,
      score: 0,
      rejectReason: "not an accountancy, CFO, or turnaround introducer",
      reasons: [],
      summary: "not an accountancy, CFO, or turnaround introducer",
    };
  }

  const scored = scoreSignals({ companyName: input.companyName, sicCodes: input.sicCodes });
  const reasons = scored.signals.map((item) => `${item.code}: ${item.note}`);
  return {
    pass: true,
    score: Math.max(scored.score, SIGNAL_MATRIX["SIG-05"].weight),
    reasons: reasons.length ? reasons : ["accountancy / advisory introducer"],
    summary: `Introducer fit — ${reasons[0] || "accountancy / advisory practice"}`,
  };
}
