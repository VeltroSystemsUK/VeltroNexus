export type BriefingHypothesis = {
  id: "stacked_debt" | "sector_late_pay" | "working_capital" | "return_visits";
  headline: string;
  body: string;
  mechanism: string;
};

const CONSTRUCTION_SIC_PREFIXES = ["41", "42", "43"] as const;

const TOOLS_PATH_RE = /\/tools|#tools|calculator|cashflow/i;

const BANNED_COPY_RE = [
  /we lend/i,
  /you have late payers/i,
  /\d+(\.\d+)?%/,
  /learn\.stratanexus/i,
] as const;

function isConstructionSic(sicCodes: string[]): boolean {
  return sicCodes.some((code) => CONSTRUCTION_SIC_PREFIXES.some((prefix) => String(code).startsWith(prefix)));
}

function isToolsPath(path?: string): boolean {
  return Boolean(path && TOOLS_PATH_RE.test(path));
}

const HYPOTHESES: Record<BriefingHypothesis["id"], Omit<BriefingHypothesis, "id">> = {
  stacked_debt: {
    headline: "The cost of stacked facilities",
    body: "Businesses with two or more live non-bank charges often have a cost-of-debt problem. That is a pattern in the filings, not a claim about your invoices.",
    mechanism:
      "Strata is a packager, not a lender. We would line up a facility that can replace expensive stacked debt where a lender will actually take it.",
  },
  sector_late_pay: {
    headline: "Late-pay culture in this trade",
    body: "Late payment is common culture in the construction sector and related trades. That is a sector pattern, not a claim about your invoices.",
    mechanism:
      "Strata is a packager, not a lender. We would line up working capital that fits how this trade actually gets paid.",
  },
  working_capital: {
    headline: "Cash timing and working capital",
    body: "You spent time on the tools. Firms that dig into cashflow tools often have a working-capital timing problem.",
    mechanism:
      "Strata is a packager, not a lender. We would line up a facility that smooths cash timing where a lender will take it.",
  },
  return_visits: {
    headline: "Cashflow timing on return visits",
    body: "Firms that keep returning to the site often have a cashflow timing problem.",
    mechanism:
      "Strata is a packager, not a lender. We would line up a facility that addresses cash timing where a lender will take it.",
  },
};

function hypothesis(id: BriefingHypothesis["id"]): BriefingHypothesis {
  return { id, ...HYPOTHESES[id] };
}

export function pickBriefingHypothesis(input: {
  nonBankChargeCount: number;
  sicCodes: string[];
  lastDwellPath?: string;
  dwellCount: number;
}): BriefingHypothesis {
  if (input.nonBankChargeCount >= 2) return hypothesis("stacked_debt");
  if (isConstructionSic(input.sicCodes)) return hypothesis("sector_late_pay");
  if (isToolsPath(input.lastDwellPath)) return hypothesis("working_capital");
  return hypothesis("return_visits");
}

export function dwellLine(input: { dwellCount: number; lastDwellPath?: string }): string {
  if (isToolsPath(input.lastDwellPath)) return "You spent time on the tools.";
  if (input.dwellCount >= 5) return "You've been back on the site several times.";
  return "You spent time on the site.";
}

function tradingYears(dateOfCreation?: string): number {
  if (!dateOfCreation) return 0;
  const start = Date.parse(dateOfCreation);
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / (365.25 * 24 * 60 * 60 * 1000)));
}

function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

export function filingsLine(input: {
  dateOfCreation?: string;
  sicCodes: string[];
  liveCharges: unknown[];
  nonBankChargeCount: number;
}): string {
  const years = tradingYears(input.dateOfCreation);
  const code = input.sicCodes[0] || "—";
  const n = Array.isArray(input.liveCharges) ? input.liveCharges.length : 0;
  const nonBank = input.nonBankChargeCount;
  return `${plural(years, "year", "years")} trading · SIC ${code} · ${plural(n, "live charge", "live charges")} · ${nonBank} non-bank`;
}

export function briefingCopyOk(text: string): { ok: true } | { ok: false; reason: string } {
  for (const re of BANNED_COPY_RE) {
    if (re.test(text)) {
      return { ok: false, reason: "banned_copy" };
    }
  }
  return { ok: true };
}
