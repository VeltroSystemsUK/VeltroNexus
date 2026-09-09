import { calculateLoan } from "../client/src/lib/calculators";

export type Grade = "A" | "B" | "C" | "D" | "E";

export type ProposalConflict = {
  field: string;
  values: Array<{ origin: string; value: string }>;
};

export type ProposalMissing = { field: string; emptyState: string };

export type UseOfFundsLine = { label: string; amountPounds: number };

export type ProposalOverrides = {
  gradeNow: Grade | null;
  gradeAfter: Grade | null;
  by: string | null;
  at: string | null;
};

export type ProposalDerived = {
  monthlyRepayment: number | null;
  monthlySaving: number | null;
  dscrNow: number | null;
  dscrAfter: number | null;
  headroomNow: number | null;
  headroomAfter: number | null;
  gradeNow: Grade | null;
  gradeAfter: Grade | null;
  gradeNowComputed: Grade | null;
  gradeAfterComputed: Grade | null;
  adverseConduct: boolean;
};

export const GRADE_DSCR = [
  { min: 1.5, grade: "A" },
  { min: 1.25, grade: "B" },
  { min: 1.0, grade: "C" },
  { min: 0.75, grade: "D" },
  { min: 0, grade: "E" },
] as const;

export type ProposalFacts = {
  loanAmountPounds: number | null;
  termMonths: number | null;
  interestRatePct: number | null;
  stackedMonthly: number | null;
  avgCredits: number | null;
  avgDebits: number | null;
  cashForDebt: number | null;
  purposeShort: string | null;
  useOfFunds: UseOfFundsLine[];
  creditsafeScore: string | null;
  creditsafeLimitPounds: number | null;
};

export type ProposalSourceFile = {
  loanAmountPence?: number | null;
  termMonths?: number | null;
  interestRatePct?: number | string | null;
  requirement?: {
    loanAmountPounds?: number | null;
    termMonths?: number | null;
    totalRequestPounds?: number | null;
    useOfFunds?: UseOfFundsLine[];
    purpose?: string | null;
  };
  loanDetails?: {
    amountPounds?: number | null;
    termMonths?: number | null;
    interestRatePct?: number | null;
  };
  calculator?: {
    loanAmountPounds?: number | null;
    termMonths?: number | null;
    interestRatePct?: number | null;
  };
  sweep?: {
    financeMonthly?: number | null;
    avgCredits?: number | null;
    avgDebits?: number | null;
    cashForDebt?: number | null;
  };
  allocation?: UseOfFundsLine[];
  creditsafe?: { score?: string | null; limitPounds?: number | null };
  findings?: { bounced?: boolean; gambling?: boolean; unarrangedOd?: boolean };
  redFlags?: string[];
  overrides?: ProposalOverrides;
  slots?: Partial<ProposalSlots> | ProposalSlots;
  legacy?: {
    background?: string;
    theBusiness?: string;
    campari?: Partial<ProposalSlots["campari"]>;
    swot?: Partial<ProposalSlots["swot"]>;
    recommendation?: string;
  };
};

export type ProposalSlots = {
  background: string[];
  theBusiness: string[];
  campari: Record<
    "character" | "ability" | "means" | "purpose" | "amount" | "repayment" | "insurance",
    string[]
  >;
  swot: Record<"strengths" | "weaknesses" | "opportunities" | "threats", string[]>;
  bankFindings: string[];
  recommendation: string[];
};

export type BuiltProposal = {
  facts: ProposalFacts;
  derived: ProposalDerived;
  slots: ProposalSlots;
  overrides: ProposalOverrides;
  conflicts: ProposalConflict[];
  missing: ProposalMissing[];
  ready: boolean;
};

export function emptySlots(): ProposalSlots {
  return {
    background: [],
    theBusiness: [],
    campari: {
      character: [],
      ability: [],
      means: [],
      purpose: [],
      amount: [],
      repayment: [],
      insurance: [],
    },
    swot: {
      strengths: [],
      weaknesses: [],
      opportunities: [],
      threats: [],
    },
    bankFindings: [],
    recommendation: [],
  };
}

type Candidate = { origin: string; value: number };

const EMPTY_STATE = "—";

function isPresentNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseRate(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).trim().replace(/%$/, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function moneyKey(pounds: number): number {
  return Math.round(pounds);
}

function rateKey(pct: number): number {
  return Math.round(pct * 100) / 100;
}

function termKey(months: number): number {
  return months;
}

function reconcileNumeric(opts: {
  field: string;
  candidates: Candidate[];
  agreeKey: (value: number) => number;
  formatValue: (value: number) => string;
}): {
  value: number | null;
  conflict: ProposalConflict | null;
  missing: ProposalMissing | null;
} {
  const { field, candidates, agreeKey, formatValue } = opts;
  if (candidates.length === 0) {
    return {
      value: null,
      conflict: null,
      missing: { field, emptyState: EMPTY_STATE },
    };
  }

  const firstKey = agreeKey(candidates[0].value);
  const allAgree = candidates.every((c) => agreeKey(c.value) === firstKey);
  if (allAgree) {
    return { value: agreeKey(candidates[0].value), conflict: null, missing: null };
  }

  return {
    value: null,
    conflict: {
      field,
      values: candidates.map((c) => ({
        origin: c.origin,
        value: formatValue(agreeKey(c.value)),
      })),
    },
    missing: null,
  };
}

function useOfFundsEqual(a: UseOfFundsLine[], b: UseOfFundsLine[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (line, i) =>
      line.label === b[i].label && moneyKey(line.amountPounds) === moneyKey(b[i].amountPounds),
  );
}

function purposeShortFrom(purpose: string | null | undefined): string | null {
  if (purpose == null) return null;
  const trimmed = purpose.trim();
  if (!trimmed) return null;
  const sentence = trimmed.split(/[.!?]/)[0]?.trim() || trimmed;
  const words = sentence.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  return words.slice(0, 12).join(" ");
}

function pushMissing(
  missing: ProposalMissing[],
  field: string,
  empty: boolean,
): void {
  if (empty) missing.push({ field, emptyState: EMPTY_STATE });
}

export function reconcileFacts(source: ProposalSourceFile): {
  facts: ProposalFacts;
  conflicts: ProposalConflict[];
  missing: ProposalMissing[];
} {
  const conflicts: ProposalConflict[] = [];
  const missing: ProposalMissing[] = [];

  const loanCandidates: Candidate[] = [];
  if (isPresentNumber(source.requirement?.loanAmountPounds)) {
    loanCandidates.push({
      origin: "requirement.loan_amount",
      value: source.requirement.loanAmountPounds,
    });
  }
  if (isPresentNumber(source.requirement?.totalRequestPounds)) {
    loanCandidates.push({
      origin: "requirement.total_request",
      value: source.requirement.totalRequestPounds,
    });
  }
  if (isPresentNumber(source.loanDetails?.amountPounds)) {
    loanCandidates.push({
      origin: "loanDetails.amount",
      value: source.loanDetails.amountPounds,
    });
  }
  if (isPresentNumber(source.calculator?.loanAmountPounds)) {
    loanCandidates.push({
      origin: "calculator.loanAmount",
      value: source.calculator.loanAmountPounds,
    });
  }
  if (isPresentNumber(source.loanAmountPence)) {
    loanCandidates.push({
      origin: "prospect.loanAmount",
      value: source.loanAmountPence / 100,
    });
  }

  const loan = reconcileNumeric({
    field: "loanAmountPounds",
    candidates: loanCandidates,
    agreeKey: moneyKey,
    formatValue: (v) => String(v),
  });
  if (loan.conflict) conflicts.push(loan.conflict);
  if (loan.missing) missing.push(loan.missing);

  const termCandidates: Candidate[] = [];
  if (isPresentNumber(source.requirement?.termMonths)) {
    termCandidates.push({
      origin: "requirement.term_months",
      value: source.requirement.termMonths,
    });
  }
  if (isPresentNumber(source.loanDetails?.termMonths)) {
    termCandidates.push({
      origin: "loanDetails.termMonths",
      value: source.loanDetails.termMonths,
    });
  }
  if (isPresentNumber(source.calculator?.termMonths)) {
    termCandidates.push({
      origin: "calculator.termMonths",
      value: source.calculator.termMonths,
    });
  }
  if (isPresentNumber(source.termMonths)) {
    termCandidates.push({
      origin: "prospect.term",
      value: source.termMonths,
    });
  }

  const term = reconcileNumeric({
    field: "termMonths",
    candidates: termCandidates,
    agreeKey: termKey,
    formatValue: (v) => String(v),
  });
  if (term.conflict) conflicts.push(term.conflict);
  if (term.missing) missing.push(term.missing);

  const rateCandidates: Candidate[] = [];
  if (isPresentNumber(source.loanDetails?.interestRatePct)) {
    rateCandidates.push({
      origin: "loanDetails.interestRate",
      value: source.loanDetails.interestRatePct,
    });
  }
  if (isPresentNumber(source.calculator?.interestRatePct)) {
    rateCandidates.push({
      origin: "calculator.interestRate",
      value: source.calculator.interestRatePct,
    });
  }
  const prospectRate = parseRate(source.interestRatePct);
  if (prospectRate != null) {
    rateCandidates.push({
      origin: "prospect.interestRate",
      value: prospectRate,
    });
  }

  const rate = reconcileNumeric({
    field: "interestRatePct",
    candidates: rateCandidates,
    agreeKey: rateKey,
    formatValue: (v) => String(v),
  });
  if (rate.conflict) conflicts.push(rate.conflict);
  if (rate.missing) missing.push(rate.missing);

  const stackedMonthly = isPresentNumber(source.sweep?.financeMonthly)
    ? source.sweep.financeMonthly
    : null;
  const avgCredits = isPresentNumber(source.sweep?.avgCredits) ? source.sweep.avgCredits : null;
  const avgDebits = isPresentNumber(source.sweep?.avgDebits) ? source.sweep.avgDebits : null;
  const cashForDebt = isPresentNumber(source.sweep?.cashForDebt) ? source.sweep.cashForDebt : null;
  pushMissing(missing, "stackedMonthly", stackedMonthly == null);
  pushMissing(missing, "avgCredits", avgCredits == null);
  pushMissing(missing, "avgDebits", avgDebits == null);
  pushMissing(missing, "cashForDebt", cashForDebt == null);

  const allocation =
    Array.isArray(source.allocation) && source.allocation.length > 0 ? source.allocation : null;
  const requirementFunds =
    Array.isArray(source.requirement?.useOfFunds) && source.requirement.useOfFunds.length > 0
      ? source.requirement.useOfFunds
      : null;

  let useOfFunds: UseOfFundsLine[] = [];
  if (allocation && requirementFunds) {
    if (useOfFundsEqual(allocation, requirementFunds)) {
      useOfFunds = allocation;
    } else {
      conflicts.push({
        field: "useOfFunds",
        values: [
          { origin: "allocation", value: JSON.stringify(allocation) },
          { origin: "requirement.useOfFunds", value: JSON.stringify(requirementFunds) },
        ],
      });
      useOfFunds = [];
    }
  } else if (allocation) {
    useOfFunds = allocation;
  } else if (requirementFunds) {
    useOfFunds = requirementFunds;
  }
  pushMissing(missing, "useOfFunds", useOfFunds.length === 0 && !conflicts.some((c) => c.field === "useOfFunds"));

  const purposeShort = purposeShortFrom(source.requirement?.purpose);
  pushMissing(missing, "purposeShort", purposeShort == null);

  const creditsafeScore =
    source.creditsafe?.score != null && String(source.creditsafe.score).trim() !== ""
      ? String(source.creditsafe.score).trim()
      : null;
  const creditsafeLimitPounds = isPresentNumber(source.creditsafe?.limitPounds)
    ? source.creditsafe.limitPounds
    : null;
  pushMissing(missing, "creditsafeScore", creditsafeScore == null);
  pushMissing(missing, "creditsafeLimitPounds", creditsafeLimitPounds == null);

  return {
    facts: {
      loanAmountPounds: loan.value,
      termMonths: term.value,
      interestRatePct: rate.value,
      stackedMonthly,
      avgCredits,
      avgDebits,
      cashForDebt,
      purposeShort,
      useOfFunds,
      creditsafeScore,
      creditsafeLimitPounds,
    },
    conflicts,
    missing,
  };
}

const ADVERSE_NOTCH: Record<Grade, Grade> = {
  A: "B",
  B: "C",
  C: "D",
  D: "E",
  E: "E",
};

const RED_FLAG_ADVERSE = /bounce|unpaid|unarranged|overdraft charge|gambling/i;

export function gradeFromDscr(dscr: number | null, adverseConduct: boolean): Grade | null {
  if (dscr == null || !Number.isFinite(dscr)) return null;
  let grade: Grade | null = null;
  for (const row of GRADE_DSCR) {
    if (dscr >= row.min) {
      grade = row.grade;
      break;
    }
  }
  if (grade == null) return null;
  return adverseConduct ? ADVERSE_NOTCH[grade] : grade;
}

function detectAdverseConduct(
  source: Pick<ProposalSourceFile, "findings" | "redFlags">,
): boolean {
  const findings = source.findings;
  if (findings?.bounced || findings?.gambling || findings?.unarrangedOd) return true;
  const flags = source.redFlags ?? [];
  return flags.some((flag) => RED_FLAG_ADVERSE.test(flag));
}

export function deriveProposal(
  facts: ProposalFacts,
  source: Pick<ProposalSourceFile, "findings" | "redFlags"> & { overrides?: ProposalOverrides },
): ProposalDerived {
  const adverseConduct = detectAdverseConduct(source);

  let monthlyRepayment: number | null = null;
  const amount = facts.loanAmountPounds;
  const rate = facts.interestRatePct;
  const term = facts.termMonths;
  if (
    amount != null &&
    rate != null &&
    term != null &&
    term > 0 &&
    Number.isFinite(amount) &&
    Number.isFinite(rate) &&
    Number.isFinite(term)
  ) {
    monthlyRepayment = calculateLoan(amount, rate, term).monthlyPayment;
  }

  const stacked = facts.stackedMonthly;
  const cash = facts.cashForDebt;

  const dscrNow =
    cash != null && stacked != null && cash > 0 && stacked > 0 ? cash / stacked : null;
  const dscrAfter =
    cash != null &&
    monthlyRepayment != null &&
    cash > 0 &&
    monthlyRepayment > 0
      ? cash / monthlyRepayment
      : null;

  const headroomNow =
    facts.avgCredits != null && facts.avgDebits != null
      ? facts.avgCredits - facts.avgDebits
      : null;

  const monthlySaving =
    stacked != null && monthlyRepayment != null ? stacked - monthlyRepayment : null;

  const headroomAfter =
    headroomNow != null && monthlySaving != null ? headroomNow + monthlySaving : null;

  const gradeNowComputed = gradeFromDscr(dscrNow, adverseConduct);
  const gradeAfterComputed = gradeFromDscr(dscrAfter, adverseConduct);

  const overrides = source.overrides;
  const overrideActive = overrides?.by != null && String(overrides.by).trim() !== "";

  return {
    monthlyRepayment,
    monthlySaving,
    dscrNow,
    dscrAfter,
    headroomNow,
    headroomAfter,
    gradeNow: overrideActive ? overrides!.gradeNow : gradeNowComputed,
    gradeAfter: overrideActive ? overrides!.gradeAfter : gradeAfterComputed,
    gradeNowComputed,
    gradeAfterComputed,
    adverseConduct,
  };
}

export const SLOT_CAPS = {
  background: { cap: 5, maxWords: 25 },
  theBusiness: { cap: 6, maxWords: 25 },
  campari: { cap: 6, maxWords: 20 },
  swot: { cap: 5, maxWords: 20 },
  bankFindings: { cap: 8, maxWords: 20 },
  recommendation: { cap: 5, maxWords: 25 },
} as const;

export const BANNED_PHRASES = [
  "the document provided",
  "note on scope",
  "cannot currently be assessed",
  "this is not stated",
  "the evaluation below",
  "cannot currently be credit-assessed",
] as const;

export type SlotValidation =
  | { ok: true; text: string }
  | { ok: false; reason: string };

const FORBIDDEN_PATTERNS: Array<{ reason: string; re: RegExp }> = [
  { reason: "contains £", re: /£/ },
  { reason: "contains DSCR", re: /\bDSCR\b/i },
  { reason: "contains DSCR multiple", re: /\b\d+\.\d+x\b/i },
  { reason: "contains grade-as-rating", re: /\b(risk\s+)?(grade|score)\s+(?:of\s+)?[A-E]\b/i },
  {
    reason: "contains grade-as-rating",
    re: /\b[A-E]\s*\((very\s+)?(low|medium|high)\s+risk\)/i,
  },
  {
    reason: "contains facility term",
    re: /\b(loan|facility|term)\b[^.]{0,40}\b\d+\s*(months?|years?)\b/i,
  },
];

export function validateBullet(text: string, maxWords: number): SlotValidation {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, reason: "empty bullet" };
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > maxWords) {
    return { ok: false, reason: `exceeds ${maxWords} words` };
  }

  for (const { reason, re } of FORBIDDEN_PATTERNS) {
    if (re.test(trimmed)) {
      return { ok: false, reason };
    }
  }

  const lower = trimmed.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) {
      return { ok: false, reason: `banned phrase: ${phrase}` };
    }
  }

  return { ok: true, text: trimmed };
}

export function validateSlot(items: string[], cap: number, maxWords: number): string[] {
  return items
    .map((item) => validateBullet(item, maxWords))
    .filter((result): result is { ok: true; text: string } => result.ok)
    .map((result) => result.text)
    .slice(0, cap);
}

function stripMarkdownBullet(line: string): string {
  return line
    .replace(/[#*]/g, "")
    .replace(/^\s*-\s+/, "")
    .trim();
}

export function hydrateBulletsFromMarkdown(
  raw: string,
  cap: number,
  maxWords: number,
): string[] {
  const lines = raw.split("\n").map(stripMarkdownBullet).filter(Boolean);
  return validateSlot(lines, cap, maxWords);
}

const CAMPARI_KEYS = [
  "character",
  "ability",
  "means",
  "purpose",
  "amount",
  "repayment",
  "insurance",
] as const;

const SWOT_KEYS = ["strengths", "weaknesses", "opportunities", "threats"] as const;

function emptyOverrides(): ProposalOverrides {
  return { gradeNow: null, gradeAfter: null, by: null, at: null };
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function mapUseOfFundsLines(raw: unknown): UseOfFundsLine[] {
  if (!Array.isArray(raw)) return [];
  const lines: UseOfFundsLine[] = [];
  for (const item of raw) {
    const rec = asRecord(item);
    const label = String(rec.description ?? rec.label ?? "").trim();
    const amountPounds = asFiniteNumber(rec.amount ?? rec.amountPounds);
    if (!label && amountPounds == null) continue;
    if (amountPounds == null) continue;
    lines.push({ label: label || "Use of funds", amountPounds });
  }
  return lines;
}

function findingsFromPreliminary(raw: unknown): ProposalSourceFile["findings"] {
  const findings = asRecord(raw);
  const hasItems = (key: string) => Array.isArray(findings[key]) && findings[key].length > 0;
  return {
    bounced: hasItems("bouncedPayments"),
    gambling: hasItems("gambling"),
    unarrangedOd: hasItems("unarrangedOd") || hasItems("unarrangedOverdraft"),
  };
}

function hydrateMarkdownSlot(
  raw: string | string[] | undefined,
  cap: number,
  maxWords: number,
): string[] {
  if (raw == null) return [];
  const text = Array.isArray(raw) ? raw.join("\n") : raw;
  if (!String(text).trim()) return [];
  return hydrateBulletsFromMarkdown(String(text), cap, maxWords);
}

function resolveSlotBullets(
  provided: string[] | undefined,
  legacyMarkdown: string | string[] | undefined,
  cap: number,
  maxWords: number,
): string[] {
  const validated = validateSlot(Array.isArray(provided) ? provided : [], cap, maxWords);
  if (validated.length > 0) return validated;
  return hydrateMarkdownSlot(legacyMarkdown, cap, maxWords);
}

export function buildProposal(
  source: ProposalSourceFile & {
    slots?: Partial<ProposalSlots> | ProposalSlots;
    legacy?: ProposalSourceFile["legacy"];
  },
): BuiltProposal {
  const { facts, conflicts, missing } = reconcileFacts(source);
  const overrides: ProposalOverrides = source.overrides
    ? {
        gradeNow: source.overrides.gradeNow ?? null,
        gradeAfter: source.overrides.gradeAfter ?? null,
        by: source.overrides.by ?? null,
        at: source.overrides.at ?? null,
      }
    : emptyOverrides();
  const derived = deriveProposal(facts, {
    findings: source.findings,
    redFlags: source.redFlags,
    overrides,
  });

  const provided = source.slots ?? {};
  const legacy = source.legacy ?? {};
  const slots = emptySlots();

  slots.background = resolveSlotBullets(
    provided.background,
    legacy.background,
    SLOT_CAPS.background.cap,
    SLOT_CAPS.background.maxWords,
  );
  slots.theBusiness = resolveSlotBullets(
    provided.theBusiness,
    legacy.theBusiness,
    SLOT_CAPS.theBusiness.cap,
    SLOT_CAPS.theBusiness.maxWords,
  );
  slots.bankFindings = validateSlot(
    Array.isArray(provided.bankFindings) ? provided.bankFindings : [],
    SLOT_CAPS.bankFindings.cap,
    SLOT_CAPS.bankFindings.maxWords,
  );
  slots.recommendation = resolveSlotBullets(
    provided.recommendation,
    legacy.recommendation,
    SLOT_CAPS.recommendation.cap,
    SLOT_CAPS.recommendation.maxWords,
  );

  for (const key of CAMPARI_KEYS) {
    slots.campari[key] = resolveSlotBullets(
      provided.campari?.[key],
      legacy.campari?.[key],
      SLOT_CAPS.campari.cap,
      SLOT_CAPS.campari.maxWords,
    );
  }

  for (const key of SWOT_KEYS) {
    const providedQuadrant = provided.swot?.[key];
    const validated = validateSlot(
      Array.isArray(providedQuadrant) ? providedQuadrant : [],
      SLOT_CAPS.swot.cap,
      SLOT_CAPS.swot.maxWords,
    );
    if (validated.length > 0) {
      slots.swot[key] = validated;
      continue;
    }
    const legacyQuadrant = legacy.swot?.[key];
    slots.swot[key] = validateSlot(
      Array.isArray(legacyQuadrant) ? legacyQuadrant : [],
      SLOT_CAPS.swot.cap,
      SLOT_CAPS.swot.maxWords,
    );
  }

  return {
    facts,
    derived,
    slots,
    overrides,
    conflicts,
    missing,
    ready: conflicts.length === 0,
  };
}

export function proposalSourceFromFile(input: {
  prospect: {
    loanAmount?: number | null;
    term?: number | null;
    interestRate?: string | number | null;
    loanRequirementNotes?: string | null;
    loanRequirementData?: unknown;
    loanAllocation?: unknown;
    background?: string | null;
    notes?: string | null;
    company?: {
      creditsafeScore?: string | number | null;
      creditsafeRatingDescription?: string | null;
      creditsafeCreditLimit?: number | null;
    };
  };
  dueDiligence?: { data?: any } | null;
}): ProposalSourceFile {
  const prospect = input.prospect ?? ({} as typeof input.prospect);
  const data = asRecord(input.dueDiligence?.data);
  const underwriting = asRecord(data.underwriting);
  const req = asRecord(prospect.loanRequirementData);
  const product = asRecord(req.product_details);
  const useOfFunds = asRecord(req.use_of_funds);
  const loanDetailsRaw = asRecord(underwriting.loanDetails);
  const calculatorRaw = asRecord(data.loanCalculator);
  const sweepRaw = asRecord(underwriting.affordabilitySweep);
  const sweepTotals = asRecord(sweepRaw.totals);
  const financialAnalysis = asRecord(underwriting.financialAnalysis);
  const proposal = asRecord(data.proposal);
  const adviserSummary = asRecord(underwriting.adviserSummary);
  const sections = asRecord(adviserSummary.sections);
  const swotAnalysis = asRecord(underwriting.swotAnalysis);
  const company = asRecord(prospect.company);

  const purpose =
    (typeof req.notes === "string" && req.notes.trim()) ||
    (typeof prospect.loanRequirementNotes === "string" && prospect.loanRequirementNotes.trim()) ||
    null;

  const creditsafeLimitPence = asFiniteNumber(company.creditsafeCreditLimit);
  // company.creditsafeCreditLimit is pence — convert once to pounds for the ledger.
  const creditsafeLimitPounds =
    creditsafeLimitPence != null ? creditsafeLimitPence / 100 : null;

  const campariLegacy: Partial<ProposalSlots["campari"]> = {};
  for (const key of CAMPARI_KEYS) {
    const value = sections[key];
    if (typeof value === "string" && value.trim()) {
      campariLegacy[key] = [value];
    }
  }

  const swotLegacy: Partial<ProposalSlots["swot"]> = {};
  for (const key of SWOT_KEYS) {
    if (Array.isArray(swotAnalysis[key]) && swotAnalysis[key].length > 0) {
      swotLegacy[key] = swotAnalysis[key].filter((item: unknown) => typeof item === "string");
    }
  }

  const theBusinessLegacy =
    (typeof sections.overview === "string" && sections.overview.trim()
      ? sections.overview
      : null) ||
    (typeof sections.background === "string" && sections.background.trim()
      ? sections.background
      : null) ||
    undefined;

  const recommendationLegacy =
    typeof sections.recommendation === "string" && sections.recommendation.trim()
      ? sections.recommendation
      : undefined;

  const redFlags = Array.isArray(financialAnalysis.redFlags)
    ? financialAnalysis.redFlags.filter((flag: unknown): flag is string => typeof flag === "string")
    : undefined;

  const overridesRaw = asRecord(proposal.overrides);
  const hasOverrides = Object.keys(overridesRaw).length > 0;
  const overrides: ProposalOverrides | undefined = hasOverrides
    ? {
        gradeNow: (overridesRaw.gradeNow as ProposalOverrides["gradeNow"]) ?? null,
        gradeAfter: (overridesRaw.gradeAfter as ProposalOverrides["gradeAfter"]) ?? null,
        by: overridesRaw.by != null ? String(overridesRaw.by) : null,
        at: overridesRaw.at != null ? String(overridesRaw.at) : null,
      }
    : undefined;

  return {
    loanAmountPence: asFiniteNumber(prospect.loanAmount),
    termMonths: asFiniteNumber(prospect.term),
    interestRatePct: prospect.interestRate ?? null,
    requirement: {
      loanAmountPounds: asFiniteNumber(product.loan_amount),
      termMonths: asFiniteNumber(product.term_months),
      totalRequestPounds: asFiniteNumber(useOfFunds.total_request_amount),
      useOfFunds: mapUseOfFundsLines(useOfFunds.breakdown),
      purpose,
    },
    loanDetails: {
      amountPounds: asFiniteNumber(loanDetailsRaw.amount),
      termMonths: asFiniteNumber(loanDetailsRaw.termMonths),
      interestRatePct: asFiniteNumber(loanDetailsRaw.interestRate),
    },
    calculator: {
      loanAmountPounds: asFiniteNumber(calculatorRaw.loanAmount),
      termMonths: asFiniteNumber(calculatorRaw.term ?? calculatorRaw.termMonths),
      interestRatePct: asFiniteNumber(calculatorRaw.interestRate),
    },
    sweep: {
      financeMonthly: asFiniteNumber(sweepRaw.financeMonthly),
      avgCredits: asFiniteNumber(sweepTotals.avgIn ?? sweepRaw.avgCredits),
      avgDebits: asFiniteNumber(sweepTotals.avgOut ?? sweepRaw.avgDebits),
      cashForDebt: asFiniteNumber(sweepRaw.cashForDebt),
    },
    allocation: mapUseOfFundsLines(prospect.loanAllocation),
    creditsafe: {
      score:
        company.creditsafeScore != null && String(company.creditsafeScore).trim() !== ""
          ? String(company.creditsafeScore).trim()
          : null,
      limitPounds: creditsafeLimitPounds,
    },
    findings: findingsFromPreliminary(financialAnalysis.preliminaryFindings),
    redFlags,
    overrides,
    slots: proposal.slots,
    legacy: {
      background:
        typeof prospect.background === "string" && prospect.background.trim()
          ? prospect.background
          : undefined,
      theBusiness: theBusinessLegacy,
      campari: Object.keys(campariLegacy).length ? campariLegacy : undefined,
      swot: Object.keys(swotLegacy).length ? swotLegacy : undefined,
      recommendation: recommendationLegacy,
    },
  };
}
