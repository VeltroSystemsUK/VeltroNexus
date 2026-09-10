export type CreditsafeStatement = {
  yearEndDate?: string;
  profitAndLoss?: Record<string, number | null | undefined>;
  balanceSheet?: Record<string, number | null | undefined>;
  ratios?: Record<string, number | null | undefined>;
};

export type AccountYear = {
  yearEnding: string;
  turnover: number | null;
  grossProfit: number | null;
  netProfit: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  netAssets: number | null;
  shareholderFunds: number | null;
  cashAndEquivalents: number | null;
  debtors: number | null;
  creditors: number | null;
  bankLoans: number | null;
};

export type AccountRatioRow = {
  year: string;
  ratios: {
    grossProfitMargin: number | null;
    netProfitMargin: number | null;
    currentRatio: number | null;
    quickRatio: number | null;
    debtToEquity: number | null;
    interestCover: number | null;
    debtorDays: number | null;
    creditorDays: number | null;
    returnOnCapitalEmployed: number | null;
  };
};

export type NotesItem = {
  note: string;
  accountsEvidence: string;
  assessment: "confirmed" | "inconsistent" | "not_found" | "clarification_required";
  severity: "high" | "medium" | "low";
  action: string;
};

export type AccountsAnalysis = {
  years: AccountYear[];
  ratios: AccountRatioRow[];
  trends: {
    turnoverGrowth: number[];
    profitGrowth: number[];
    netAssetGrowth: number[];
    trend: "improving" | "stable" | "deteriorating" | "unknown";
    summary: string;
  };
  dscr: { historical: number[]; average: number; trend: string };
  concerns: { category: string; description: string; severity: string }[];
  notesToAccounts: NotesItem[];
  auditorOpinion: string;
  summary: string;
  riskAssessment: "low" | "medium" | "high";
  source: "creditsafe" | "pdf" | "mixed";
};

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function yearEnd(value?: string): string {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function gbp(n: number): string {
  return `£${Math.round(n).toLocaleString("en-GB")}`;
}

export function isPdfTextBlank(text: string): boolean {
  const stripped = String(text || "")
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length < 40;
}

export function yearsFromCreditsafe(statements: CreditsafeStatement[]): AccountYear[] {
  return [...statements]
    .map((row) => {
      const pl = row.profitAndLoss || {};
      const bs = row.balanceSheet || {};
      const bankLoans =
        (num(bs.bankLiabilities) || 0) +
        (num(bs.otherLoansOrFinance) || 0) +
        (num(bs.bankLiabilitiesDueAfter1Year) || 0) +
        (num(bs.otherLoansOrFinanceDueAfter1Year) || 0);
      return {
        yearEnding: yearEnd(row.yearEndDate),
        turnover: num(pl.revenue ?? pl.turnover),
        grossProfit: num(pl.grossProfit),
        netProfit: num(pl.profitAfterTax ?? pl.netProfit ?? pl.profitBeforeTax),
        totalAssets: num(bs.totalAssets),
        totalLiabilities: num(bs.totalLiabilities),
        netAssets: num(bs.totalShareholdersEquity),
        shareholderFunds: num(bs.totalShareholdersEquity),
        cashAndEquivalents: num(bs.cash),
        debtors: num(bs.totalReceivables ?? bs.tradeReceivables),
        creditors: num(bs.totalCurrentLiabilities ?? bs.tradePayables),
        bankLoans,
      };
    })
    .filter((year) => year.yearEnding)
    .sort((a, b) => b.yearEnding.localeCompare(a.yearEnding));
}

export function ratiosFromCreditsafe(statements: CreditsafeStatement[]): AccountRatioRow[] {
  return [...statements]
    .map((row) => {
      const ratios = row.ratios || {};
      const equity = num(row.balanceSheet?.totalShareholdersEquity);
      const liabilities = num(row.balanceSheet?.totalLiabilities);
      return {
        year: yearEnd(row.yearEndDate).slice(0, 4),
        ratios: {
          grossProfitMargin: num(ratios.grossProfitMargin),
          netProfitMargin: num(ratios.netProfitMargin),
          currentRatio: num(ratios.currentRatio),
          quickRatio: num(ratios.liquidityRatioOrAcidTest ?? ratios.quickRatio),
          debtToEquity:
            num(ratios.gearing) ??
            (equity && equity !== 0 && liabilities != null ? Math.round((liabilities / Math.abs(equity)) * 100) / 100 : null),
          interestCover: num(ratios.interestCover),
          debtorDays: num(ratios.debtorDays),
          creditorDays: num(ratios.creditorDays),
          returnOnCapitalEmployed: num(ratios.returnOnCapitalEmployed),
        },
      };
    })
    .filter((row) => row.year)
    .sort((a, b) => b.year.localeCompare(a.year));
}

function parseCaseFinance(caseNotes: string): { currentDebt?: number; monthlyPayment?: number } {
  const raw = String(caseNotes || "");
  const out: { currentDebt?: number; monthlyPayment?: number } = {};
  try {
    const jsonStart = raw.indexOf("{");
    if (jsonStart >= 0) {
      const parsed = JSON.parse(raw.slice(jsonStart));
      const calc = parsed?.calculatorData || parsed?.context || parsed;
      const debt = Number(calc?.currentDebt ?? calc?.outstanding);
      const monthly = Number(calc?.monthlyPayment ?? calc?.currentMonthly);
      if (debt > 0) out.currentDebt = debt;
      if (monthly > 0) out.monthlyPayment = monthly;
    }
  } catch {
    /* fall through to regex */
  }
  const debtMatch = raw.match(/currentDebt["\s:]*([0-9]+)/i);
  const monthlyMatch = raw.match(/monthlyPayment["\s:]*([0-9]+)/i);
  if (out.currentDebt == null && debtMatch) out.currentDebt = Number(debtMatch[1]);
  if (out.monthlyPayment == null && monthlyMatch) out.monthlyPayment = Number(monthlyMatch[1]);
  return out;
}

export function notesCommentary(opts: {
  caseNotes?: string;
  years: AccountYear[];
  financeMonthly?: number;
  loanPounds?: number;
}): NotesItem[] {
  const items: NotesItem[] = [];
  const latest = opts.years[0];
  const oldest = opts.years[opts.years.length - 1];
  const caseFinance = parseCaseFinance(opts.caseNotes || "");
  const filedBankDebt = latest?.bankLoans ?? 0;
  const cash = latest?.cashAndEquivalents;
  const debtors = latest?.debtors;
  const assets = latest?.totalAssets;

  if (latest && (caseFinance.currentDebt || 0) > 1000 && filedBankDebt < (caseFinance.currentDebt || 0) * 0.2) {
    items.push({
      note: `Case notes / calculator state current debt of ${gbp(caseFinance.currentDebt || 0)} to refinance.`,
      accountsEvidence: `Latest filed accounts (${latest.yearEnding}) show bank liabilities ${gbp(filedBankDebt)} and no other loans on the balance sheet.`,
      assessment: "inconsistent",
      severity: "high",
      action: "Raise with the adviser: where the stacked facilities sit if they are not on the statutory balance sheet (MCA / off-balance-sheet / director personal).",
    });
  }

  if ((caseFinance.monthlyPayment || 0) > 0 && (opts.financeMonthly || 0) > 0) {
    const stated = caseFinance.monthlyPayment || 0;
    const observed = opts.financeMonthly || 0;
    if (stated > observed * 1.5 || observed > stated * 1.5) {
      items.push({
        note: `Inbound calculator monthly payment ${gbp(stated)}.`,
        accountsEvidence: `Bank-statement stacked finance is about ${gbp(observed)} per month.`,
        assessment: "inconsistent",
        severity: "medium",
        action: "Use statement-derived service for DSCR, not the calculator headline.",
      });
    }
  }

  if (latest && cash === 0) {
    items.push({
      note: "Cash at bank is a going-concern indicator on micro-entity accounts.",
      accountsEvidence: `Cash is ${gbp(0)} in the latest year${opts.years.every((year) => year.cashAndEquivalents === 0) ? " and in every filed year on this extract" : ""}.`,
      assessment: "confirmed",
      severity: "high",
      action: "Tie to the bank statements (overdraft / nil cash). Do not treat the balance sheet as showing surplus cash.",
    });
  }

  if (latest && debtors != null && assets != null && assets > 0 && debtors / assets > 0.8) {
    items.push({
      note: "Asset quality is concentrated in receivables.",
      accountsEvidence: `Debtors ${gbp(debtors)} of total assets ${gbp(assets)} (${Math.round((debtors / assets) * 100)}%).`,
      assessment: "clarification_required",
      severity: "medium",
      action: "Ask for an aged debtor list and recoverability. Micro-entity accounts do not disclose this.",
    });
  }

  const anyTurnover = opts.years.some((year) => year.turnover != null);
  if (!anyTurnover) {
    items.push({
      note: "Turnover and profit are not in the case file's statutory extract.",
      accountsEvidence: "These are micro-entity filings: P&L is not on the public record. Creditsafe also has no revenue line.",
      assessment: "not_found",
      severity: "medium",
      action: "Use bank-statement credits as the income proxy. Do not underwrite on assumed turnover.",
    });
  }

  if (latest && oldest && (oldest.netAssets || 0) < 0 && (latest.netAssets || 0) > 0) {
    items.push({
      note: "Solvency has recovered from negative equity.",
      accountsEvidence: `Net assets ${gbp(oldest.netAssets || 0)} (${oldest.yearEnding}) to ${gbp(latest.netAssets || 0)} (${latest.yearEnding}).`,
      assessment: "confirmed",
      severity: "low",
      action: "Record the turnaround; still test cash and off-balance-sheet service.",
    });
  }

  if ((opts.loanPounds || 0) > 0 && latest?.netAssets != null && opts.loanPounds! > latest.netAssets * 2) {
    items.push({
      note: `Requested facility ${gbp(opts.loanPounds || 0)}.`,
      accountsEvidence: `Latest net assets ${gbp(latest.netAssets)}.`,
      assessment: "clarification_required",
      severity: "medium",
      action: "Facility is large versus net assets; rest the case on cashflow / refinance of stacked cost, not on the balance sheet.",
    });
  }

  return items;
}

function trendFromYears(years: AccountYear[]) {
  const chronological = [...years].sort((a, b) => a.yearEnding.localeCompare(b.yearEnding));
  const netAssetGrowth: number[] = [];
  for (let i = 1; i < chronological.length; i++) {
    const prev = chronological[i - 1].netAssets;
    const curr = chronological[i].netAssets;
    if (prev == null || curr == null || prev === 0) continue;
    netAssetGrowth.push(Math.round(((curr - prev) / Math.abs(prev)) * 1000) / 10);
  }
  const latest = years[0];
  const oldest = chronological[0];
  let trend: "improving" | "stable" | "deteriorating" | "unknown" = "unknown";
  if (latest && oldest && latest.netAssets != null && oldest.netAssets != null) {
    if (latest.netAssets > oldest.netAssets) trend = "improving";
    else if (latest.netAssets < oldest.netAssets) trend = "deteriorating";
    else trend = "stable";
  }
  const summaryParts: string[] = [];
  if (latest && oldest && latest.netAssets != null && oldest.netAssets != null) {
    summaryParts.push(
      `Net assets ${gbp(oldest.netAssets)} (${oldest.yearEnding}) to ${gbp(latest.netAssets)} (${latest.yearEnding}).`
    );
  }
  if (latest?.cashAndEquivalents === 0) summaryParts.push("Cash is nil on the latest balance sheet.");
  if (latest?.debtors != null && latest.totalAssets) {
    summaryParts.push(`Debtors ${gbp(latest.debtors)} of ${gbp(latest.totalAssets)} assets.`);
  }
  if (years.every((year) => year.turnover == null)) {
    summaryParts.push("Micro-entity accounts: no turnover or profit on the public record.");
  }
  return {
    turnoverGrowth: [] as number[],
    profitGrowth: [] as number[],
    netAssetGrowth,
    trend,
    summary: summaryParts.join(" "),
  };
}

function concernsFrom(years: AccountYear[], notes: NotesItem[]) {
  const out: { category: string; description: string; severity: string }[] = [];
  const latest = years[0];
  if (latest?.cashAndEquivalents === 0) {
    out.push({
      category: "liquidity",
      description: "Nil cash on the latest filed balance sheet.",
      severity: "high",
    });
  }
  if (latest && (latest.netAssets || 0) < 0) {
    out.push({
      category: "solvency",
      description: "Negative net assets on the latest accounts.",
      severity: "high",
    });
  }
  if (notes.some((item) => item.assessment === "inconsistent" && item.severity === "high")) {
    out.push({
      category: "disclosure",
      description: "Case-note debt is not visible on the statutory balance sheet.",
      severity: "high",
    });
  }
  return out;
}

function riskFrom(notes: NotesItem[], years: AccountYear[]): "low" | "medium" | "high" {
  if (notes.some((item) => item.severity === "high" && item.assessment === "inconsistent")) return "high";
  if ((years[0]?.netAssets || 0) < 0) return "high";
  if (years[0]?.cashAndEquivalents === 0) return "medium";
  return "medium";
}

export function parseCreditsafeStatements(raw: unknown): CreditsafeStatement[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const list = parsed?.report?.financialStatements || parsed?.financialStatements || parsed;
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

type AiSlice = {
  years?: AccountYear[];
  ratios?: AccountRatioRow[];
  notesToAccounts?: NotesItem[];
  summary?: string;
  auditorOpinion?: string;
  riskAssessment?: string;
  dscr?: { historical?: number[]; average?: number; trend?: string } | number;
};

function yearsAreBlank(years: AccountYear[] | undefined): boolean {
  if (!years?.length) return true;
  return years.every(
    (year) =>
      (year.turnover == null || year.turnover === 0) &&
      (year.netAssets == null || year.netAssets === 0) &&
      (year.totalAssets == null || year.totalAssets === 0)
  );
}

function yearKey(yearEnding: string): string {
  const match = String(yearEnding || "").match(/(\d{4})/);
  return match ? match[1] : "";
}

const YEAR_FIELDS: (keyof AccountYear)[] = [
  "turnover",
  "grossProfit",
  "netProfit",
  "totalAssets",
  "totalLiabilities",
  "netAssets",
  "shareholderFunds",
  "cashAndEquivalents",
  "debtors",
  "creditors",
  "bankLoans",
];

function emptyYear(yearEnding: string): AccountYear {
  return {
    yearEnding,
    turnover: null,
    grossProfit: null,
    netProfit: null,
    totalAssets: null,
    totalLiabilities: null,
    netAssets: null,
    shareholderFunds: null,
    cashAndEquivalents: null,
    debtors: null,
    creditors: null,
    bankLoans: null,
  };
}

function fillYear(base: AccountYear, extra: AccountYear): AccountYear {
  const out = { ...base };
  for (const key of YEAR_FIELDS) {
    if (out[key] == null && extra[key] != null) (out as AccountYear)[key] = extra[key];
  }
  return out;
}

export function mergeAccountYears(primary?: AccountYear[], extra?: AccountYear[]): AccountYear[] {
  const base = primary || [];
  const extras = (extra || []).filter((year) => year?.yearEnding && !yearsAreBlank([year]));
  if (!extras.length) return base;
  if (!base.length) return extras;
  const byYear = new Map<string, AccountYear>();
  for (const year of extras) {
    const key = yearKey(year.yearEnding);
    if (key) byYear.set(key, year);
  }
  const used = new Set<string>();
  const merged = base.map((year) => {
    const key = yearKey(year.yearEnding);
    const add = byYear.get(key);
    if (!add) return year;
    used.add(key);
    return fillYear(year, add);
  });
  const leftover = extras.filter((year) => {
    const key = yearKey(year.yearEnding);
    return key && !used.has(key);
  });
  return [...merged, ...leftover].sort((a, b) => b.yearEnding.localeCompare(a.yearEnding));
}

function moneyAfter(text: string, label: RegExp): number | null {
  const match = text.match(label);
  if (!match) return null;
  const raw = match[1].replace(/[£,\s]/g, "");
  const negative = /^-/.test(raw) || /^\(.*\)$/.test(match[1].trim());
  const n = Number(raw.replace(/[()]/g, ""));
  if (!Number.isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

function yearEndingFromAccounts(text: string, fileName: string): string {
  const name = String(fileName || "").replace(/_/g, " ");
  const range = name.match(/(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/i);
  if (range) return range[2];
  const dated = name.match(/(\d{4}-\d{2}-\d{2})/);
  if (dated) return dated[1];
  const fy = text.match(/Accounting Year\s+(\d{4})\s*\/\s*(\d{2})/i);
  if (fy) return `${fy[1].slice(0, 2)}${fy[2]}-02-28`;
  return "";
}

export function yearsFromAccountsText(text: string, fileName = ""): AccountYear[] {
  const raw = String(text || "");
  if (!/turnover|gross profit|profit\s*&\s*loss|profit and loss/i.test(raw)) return [];
  const yearEnding = yearEndingFromAccounts(raw, fileName);
  if (!yearEnding) return [];
  const turnover = moneyAfter(raw, /(?:^|\n)\s*Turnover\s+(-?£?[\d,().]+)/i);
  const grossProfit = moneyAfter(raw, /(?:^|\n)\s*Gross Profit\s+(-?£?[\d,().]+)/i);
  const netProfit =
    moneyAfter(raw, /(?:^|\n)\s*Operating Profit\s*:?\s*(-?£?[\d,().]+)/i) ??
    moneyAfter(raw, /(?:^|\n)\s*Retained Profit this period:\s*(-?£?[\d,().]+)/i) ??
    moneyAfter(raw, /(?:^|\n)\s*Net Profit\s*:?\s*(-?£?[\d,().]+)/i);
  const year = {
    ...emptyYear(yearEnding),
    turnover,
    grossProfit,
    netProfit,
  };
  if (yearsAreBlank([year]) && turnover == null) return [];
  return [year];
}

function fillRatiosFromYears(rows: AccountRatioRow[], years: AccountYear[]): AccountRatioRow[] {
  const byYear = new Map(years.map((year) => [yearKey(year.yearEnding), year]));
  const existing = rows.length
    ? rows
    : years.map((year) => ({
        year: yearKey(year.yearEnding),
        ratios: {
          grossProfitMargin: null,
          netProfitMargin: null,
          currentRatio: null,
          quickRatio: null,
          debtToEquity: null,
          interestCover: null,
          debtorDays: null,
          creditorDays: null,
          returnOnCapitalEmployed: null,
        },
      }));
  return existing.map((row) => {
    const year = byYear.get(row.year);
    const ratios = { ...row.ratios };
    if (ratios.grossProfitMargin == null && year?.turnover && year.grossProfit != null) {
      ratios.grossProfitMargin = Math.round((year.grossProfit / year.turnover) * 1000) / 10;
    }
    if (ratios.netProfitMargin == null && year?.turnover && year.netProfit != null) {
      ratios.netProfitMargin = Math.round((year.netProfit / year.turnover) * 1000) / 10;
    }
    return { ...row, ratios };
  });
}

export function buildAccountsAnalysis(opts: {
  statements: CreditsafeStatement[];
  caseNotes?: string;
  financeMonthly?: number;
  loanPounds?: number;
  pdfYears?: AccountYear[];
  ai?: AiSlice | null;
}): AccountsAnalysis {
  const creditsafeYears = yearsFromCreditsafe(opts.statements);
  const years = mergeAccountYears(creditsafeYears, mergeAccountYears(opts.pdfYears, opts.ai?.years));
  const creditsafeRatios = ratiosFromCreditsafe(opts.statements);
  const ratios = fillRatiosFromYears(
    creditsafeRatios.length ? creditsafeRatios : opts.ai?.ratios || [],
    years,
  );
  const trends = trendFromYears(years);
  const stubNote = /no accounts data|blank|OCR|8,500,000|8\.5m|could not be extracted|zero extractable/i;
  const notes = [
    ...notesCommentary({
      caseNotes: opts.caseNotes,
      years,
      financeMonthly: opts.financeMonthly,
      loanPounds: opts.loanPounds,
    }),
    ...((opts.ai?.notesToAccounts || []).filter(
      (item) => item?.note && !stubNote.test(`${item.note} ${item.accountsEvidence} ${item.action}`)
    )),
  ];
  const summary = trends.summary || opts.ai?.summary || "No structured accounts figures available.";
  const dscr =
    opts.ai?.dscr && typeof opts.ai.dscr === "object"
      ? {
          historical: opts.ai.dscr.historical || [],
          average: Number(opts.ai.dscr.average) || 0,
          trend: opts.ai.dscr.trend || trends.trend,
        }
      : { historical: [], average: 0, trend: trends.trend };
  const usedUpload = years.some((year) => year.turnover != null) && creditsafeYears.some((year) => year.turnover == null);

  return {
    years,
    ratios,
    trends,
    dscr,
    concerns: concernsFrom(years, notes),
    notesToAccounts: notes,
    auditorOpinion:
      opts.ai?.auditorOpinion && !/could not be extracted|blank|OCR|no auditor/i.test(opts.ai.auditorOpinion)
        ? opts.ai.auditorOpinion
        : "Micro-entity accounts — no auditor's report on the public filing.",
    summary,
    riskAssessment: riskFrom(notes, years),
    source: creditsafeYears.length && usedUpload ? "mixed" : creditsafeYears.length ? "creditsafe" : "pdf",
  };
}
