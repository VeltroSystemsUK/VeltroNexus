export type Grade = "A" | "B" | "C" | "D" | "E";

export type ProposalConflict = {
  field: string;
  values: Array<{ origin: string; value: string }>;
};

export type ProposalMissing = { field: string; emptyState: string };

export type UseOfFundsLine = { label: string; amountPounds: number };

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
};

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
