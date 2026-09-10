export type ForecastColumn = {
  creditsAvg: number | null;
  opexAvg: number | null;
  debtServiceAvg: number | null;
  netAvg: number | null;
  dscr: number | null;
};

export type ForecastMonth = {
  label: string;
  credits: number | null;
  opex: number | null;
  debtService: number | null;
  net: number | null;
};

export type CashflowForecast = {
  source: { documentId: number; fileName: string } | null;
  confirmed: boolean;
  confirmedBy?: string;
  confirmedAt?: string;
  extractable?: boolean;
  flattenedText?: string;
  without: ForecastColumn;
  with: ForecastColumn;
  months?: ForecastMonth[];
  findings: string[];
  critique?: string[];
};

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const TAX_TOKEN = /vat|paye|hmrc|corporation tax|corp tax/i;
const DRAWINGS_TOKEN = /drawing|dividend|director/i;
const BANNED = /note on scope|the document provided|cannot currently be assessed/i;

function isNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function coerceNum(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function pctChange(withVal: number, withoutVal: number): number {
  return Math.round((withVal / withoutVal - 1) * 100);
}

export function emptyColumn(): ForecastColumn {
  return {
    creditsAvg: null,
    opexAvg: null,
    debtServiceAvg: null,
    netAvg: null,
    dscr: null,
  };
}

export function finishColumn(col: ForecastColumn): ForecastColumn {
  const credits = col.creditsAvg;
  const opex = col.opexAvg;
  const debt = col.debtServiceAvg;

  let netAvg = col.netAvg;
  if (isNumber(credits) && isNumber(opex) && isNumber(debt)) {
    netAvg = credits - opex - debt;
  } else if (!isNumber(netAvg)) {
    netAvg = null;
  }

  let dscr: number | null = null;
  if (isNumber(credits) && isNumber(opex) && isNumber(debt) && debt > 0) {
    dscr = (credits - opex) / debt;
  }

  return {
    creditsAvg: isNumber(credits) ? credits : null,
    opexAvg: isNumber(opex) ? opex : null,
    debtServiceAvg: isNumber(debt) ? debt : null,
    netAvg,
    dscr,
  };
}

export function withoutFromSweep(sweep: {
  totals?: { avgIn?: number; avgOut?: number; avgNet?: number };
  financeMonthly?: number;
  cashForDebt?: number;
}): ForecastColumn {
  const avgIn = sweep.totals?.avgIn;
  const avgOut = sweep.totals?.avgOut;
  const avgNet = sweep.totals?.avgNet;
  const financeMonthly = sweep.financeMonthly;
  const cashForDebt = sweep.cashForDebt;

  const creditsAvg = isNumber(avgIn) ? avgIn : null;
  const debtServiceAvg = isNumber(financeMonthly) ? financeMonthly : null;

  let opexAvg: number | null = null;
  if (isNumber(avgOut) && isNumber(financeMonthly)) {
    opexAvg = avgOut - financeMonthly;
  }

  let netAvg: number | null = null;
  if (isNumber(avgNet)) {
    netAvg = avgNet;
  } else if (isNumber(creditsAvg) && isNumber(opexAvg) && isNumber(debtServiceAvg)) {
    netAvg = creditsAvg - opexAvg - debtServiceAvg;
  }

  let dscr: number | null = null;
  if (isNumber(debtServiceAvg) && debtServiceAvg > 0) {
    const numerator = isNumber(cashForDebt)
      ? cashForDebt
      : isNumber(creditsAvg) && isNumber(opexAvg)
        ? creditsAvg - opexAvg
        : null;
    if (isNumber(numerator)) dscr = numerator / debtServiceAvg;
  }

  return { creditsAvg, opexAvg, debtServiceAvg, netAvg, dscr };
}

export function parseWithExtract(
  raw: unknown,
): { with: ForecastColumn; months?: ForecastMonth[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const creditsAvg = coerceNum(obj.creditsAvg);
  const opexAvg = coerceNum(obj.opexAvg);
  const debtServiceAvg = coerceNum(obj.debtServiceAvg);
  const netAvg = coerceNum(obj.netAvg);

  let months: ForecastMonth[] | undefined;
  if (Array.isArray(obj.months)) {
    months = obj.months.slice(0, 12).map((m) => {
      const row = m && typeof m === "object" ? (m as Record<string, unknown>) : {};
      return {
        label: typeof row.label === "string" ? row.label : "",
        credits: coerceNum(row.credits),
        opex: coerceNum(row.opex),
        debtService: coerceNum(row.debtService),
        net: coerceNum(row.net),
      };
    });
  }

  const monthHasNumber =
    months?.some(
      (m) => isNumber(m.credits) || isNumber(m.opex) || isNumber(m.debtService) || isNumber(m.net),
    ) ?? false;

  if (
    creditsAvg === null &&
    opexAvg === null &&
    debtServiceAvg === null &&
    netAvg === null &&
    !monthHasNumber
  ) {
    return null;
  }

  const finished = finishColumn({
    creditsAvg,
    opexAvg,
    debtServiceAvg,
    netAvg,
    dscr: null,
  });

  return months ? { with: finished, months } : { with: finished };
}

export function improvedFromStatements(
  without: ForecastColumn,
  proposedMonthly: number | null | undefined,
): ForecastColumn {
  return finishColumn({
    creditsAvg: without.creditsAvg,
    opexAvg: without.opexAvg,
    debtServiceAvg:
      typeof proposedMonthly === "number" && Number.isFinite(proposedMonthly) ? proposedMonthly : null,
    netAvg: null,
    dscr: null,
  });
}

export function statementAfterDscr(
  cashForDebt: number | null | undefined,
  proposedMonthly: number | null | undefined,
): number | null {
  if (
    typeof cashForDebt !== "number" ||
    typeof proposedMonthly !== "number" ||
    !Number.isFinite(cashForDebt) ||
    !Number.isFinite(proposedMonthly) ||
    proposedMonthly <= 0
  ) {
    return null;
  }
  return cashForDebt / proposedMonthly;
}

export function applyFindings(input: {
  without: ForecastColumn;
  with: ForecastColumn;
  ledgerMonthly: number | null;
  flattenedText: string;
  ledgerAfterDscr?: number | null;
}): string[] {
  const { without, with: withCol, ledgerMonthly, flattenedText, ledgerAfterDscr } = input;
  const findings: string[] = [];

  if (
    isNumber(withCol.creditsAvg) &&
    isNumber(without.creditsAvg) &&
    withCol.creditsAvg > without.creditsAvg * 1.15
  ) {
    const pct = pctChange(withCol.creditsAvg, without.creditsAvg);
    findings.push(`Credits in the forecast are ${pct}% above statement run-rate.`);
  }

  if (
    isNumber(withCol.opexAvg) &&
    isNumber(without.opexAvg) &&
    withCol.opexAvg < without.opexAvg * 0.85
  ) {
    const pct = pctChange(withCol.opexAvg, without.opexAvg);
    findings.push(`Operating costs fall ${Math.abs(pct)}% versus statements.`);
  }

  if (
    isNumber(withCol.debtServiceAvg) &&
    isNumber(ledgerMonthly) &&
    Math.abs(withCol.debtServiceAvg - ledgerMonthly) > 1
  ) {
    findings.push(
      `Forecast debt service ${gbp.format(withCol.debtServiceAvg)} versus ledger monthly ${gbp.format(ledgerMonthly)}.`,
    );
  }

  if (
    isNumber(withCol.dscr) &&
    isNumber(ledgerAfterDscr) &&
    Math.abs(withCol.dscr - ledgerAfterDscr) > 0.15
  ) {
    findings.push(
      `Sheet DSCR ${withCol.dscr.toFixed(2)}x versus statement-based after ${ledgerAfterDscr.toFixed(2)}x.`,
    );
  }

  if (isNumber(withCol.dscr) && withCol.dscr < 1.25) {
    findings.push(`DSCR after facility ${withCol.dscr.toFixed(2)}x — still below 1.25x.`);
  }

  if (isNumber(without.dscr) && without.dscr < 1.0) {
    findings.push(`Without the facility DSCR is ${without.dscr.toFixed(2)}x.`);
  }

  if (!TAX_TOKEN.test(flattenedText)) {
    findings.push("Forecast text does not mention VAT, PAYE or HMRC.");
  }

  if (!DRAWINGS_TOKEN.test(flattenedText)) {
    findings.push("Forecast text does not mention directors' drawings or dividends.");
  }

  return findings.slice(0, 8);
}

export function readyToPrint(forecast: CashflowForecast | null | undefined): boolean {
  if (!forecast || forecast.extractable === false) return false;
  return isNumber(forecast.with.creditsAvg) || isNumber(forecast.with.netAvg);
}

export function emptyForecast(): CashflowForecast {
  return {
    source: null,
    confirmed: false,
    without: emptyColumn(),
    with: emptyColumn(),
    findings: [],
    critique: [],
  };
}

export function pickCashflowDocument<T extends { id?: number; fileName?: string; category?: string }>(
  docs: T[],
): T | null {
  const matches = docs.filter((doc) =>
    /forecast|cash.?flow|cff/i.test(`${doc.category || ""} ${doc.fileName || ""}`),
  );
  if (!matches.length) return null;
  return [...matches].sort((a, b) => (b.id || 0) - (a.id || 0))[0];
}

export function sanitizeForecastBullets(items: string[]): string[] {
  const out: string[] = [];
  for (const raw of items) {
    const text = String(raw || "").replace(/\s+/g, " ").trim();
    if (!text || BANNED.test(text)) continue;
    const words = text.split(/\s+/);
    if (words.length > 35) continue;
    out.push(text);
    if (out.length >= 12) break;
  }
  return out;
}
