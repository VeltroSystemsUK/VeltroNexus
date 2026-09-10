import { attachmentsFromDocuments, type SterlingSourceDoc } from "./sterlingPortal";

const SHORT_LABEL: Record<string, string> = {
  accounts: "filed accounts",
  "management-accounts": "management accounts",
  "bank-statements": "bank statements",
  cashflow: "cashflow forecast",
  "debt-schedule": "debt schedule",
  id: "photo ID",
  "proof-of-address": "proof of address",
  "application-form": "signed application",
  sal: "personal SAL",
  "use-of-funds": "use of funds",
  hmrc: "HMRC correspondence",
  insurance: "insurance",
  "business-plan": "business plan",
};

function listOf(ids: string[]): string {
  return ids.map((id) => SHORT_LABEL[id] || id).join(", ");
}

function gbp(n: number): string {
  return `£${Math.round(n).toLocaleString("en-GB")}`;
}

function yearLabel(value: string): string {
  const match = String(value || "").match(/^(\d{4})/);
  return match ? match[1] : value;
}

export function fileResearchBullets(input: {
  documents?: SterlingSourceDoc[];
  accountsType?: string | null;
  creditsafeScore?: string | null;
  hasCharges?: boolean;
  insolvency?: boolean;
  companyNumber?: string | null;
  companyStatus?: string | null;
  hasAuditedAccounts?: boolean;
}): string[] {
  const items = attachmentsFromDocuments(input.documents || []);
  const present = items.filter((item) => item.attached).map((item) => item.id);
  const missing = items.filter((item) => !item.attached).map((item) => item.id);
  const lines: string[] = [];
  const accountsType = String(input.accountsType || "").replace(/-/g, " ").trim();
  const abbreviated = /micro|abbreviated|filleted/i.test(accountsType);

  if (abbreviated) {
    lines.push(`Filed accounts on the register are ${accountsType} (abbreviated), not a full audited set.`);
  }
  if (!input.hasAuditedAccounts) {
    lines.push("No full audited accounts have been presented.");
  }
  if (present.length) {
    lines.push(`On file: ${listOf(present)}.`);
  }
  if (missing.length) {
    lines.push(`Missing: ${listOf(missing)}.`);
  }
  const flags: string[] = [];
  if (input.creditsafeScore) flags.push(`Creditsafe ${input.creditsafeScore}`);
  if (input.hasCharges === false) flags.push("no charges");
  if (input.insolvency === false) flags.push("no insolvency history");
  if (input.companyNumber) flags.push(`CN ${input.companyNumber}`);
  if (input.companyStatus) flags.push(String(input.companyStatus));
  if (flags.length) lines.push(flags.join("; ") + ".");

  return lines.slice(0, 10);
}

export type HistoricYear = {
  yearEnding: string;
  turnover: number | null;
  grossProfit?: number | null;
  netProfit: number | null;
  netAssets: number | null;
  cashAndEquivalents?: number | null;
  debtors?: number | null;
  totalAssets?: number | null;
};

function hasNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function blankPl(row: HistoricYear): boolean {
  return (row.turnover == null || row.turnover === 0) && (row.netProfit == null || row.netProfit === 0);
}

export function historicYearKey(value: string): string {
  const iso = String(value || "").match(/(\d{4})-\d{2}-\d{2}/);
  if (iso) return iso[1];
  const fy = String(value || "").match(/FY\s*(\d{2,4})/i);
  if (fy) return fy[1].length === 2 ? `20${fy[1]}` : fy[1];
  const year = String(value || "").match(/(\d{4})/);
  return year ? year[1] : "";
}

function fillHistoricYear(base: HistoricYear, extra: HistoricYear): HistoricYear {
  const pl = (value: number | null | undefined, fallback: number | null | undefined) =>
    value == null || value === 0 ? fallback ?? value : value;
  return {
    yearEnding: base.yearEnding || extra.yearEnding,
    turnover: pl(base.turnover, extra.turnover) ?? null,
    grossProfit: pl(base.grossProfit, extra.grossProfit),
    netProfit: pl(base.netProfit, extra.netProfit) ?? null,
    netAssets: base.netAssets ?? extra.netAssets,
    cashAndEquivalents: base.cashAndEquivalents ?? extra.cashAndEquivalents,
    debtors: base.debtors ?? extra.debtors,
    totalAssets: base.totalAssets ?? extra.totalAssets,
  };
}

export function mergeHistoricYears(primary: HistoricYear[], extra?: HistoricYear[]): HistoricYear[] {
  const extras = extra || [];
  if (!extras.length) return primary || [];
  if (!(primary || []).length) return extras;
  const byYear = new Map<string, HistoricYear>();
  for (const row of extras) {
    const key = historicYearKey(row.yearEnding);
    if (key) byYear.set(key, row);
  }
  return primary.map((row) => {
    const add = byYear.get(historicYearKey(row.yearEnding));
    return add ? fillHistoricYear(row, add) : row;
  });
}

function seriesPhrase(
  years: HistoricYear[],
  pick: (row: HistoricYear) => number | null | undefined,
  lostAs?: "loss",
): string {
  const points = years
    .map((row) => {
      const value = pick(row);
      return hasNumber(value) ? `${gbp(value)} (${yearLabel(row.yearEnding)})` : "";
    })
    .filter(Boolean);
  if (!points.length) return "";
  if (lostAs === "loss") {
    return years
      .map((row) => {
        const value = pick(row);
        if (!hasNumber(value)) return "";
        const label = yearLabel(row.yearEnding);
        return value < 0 ? `a loss of ${gbp(Math.abs(value))} (${label})` : `${gbp(value)} (${label})`;
      })
      .filter(Boolean)
      .join(" to ");
  }
  return points.join(" to ");
}

export function historicAccountsCommentary(input: {
  years: HistoricYear[];
  accountsType?: string | null;
  hasAuditedAccounts?: boolean;
  pnlFromUpload?: boolean;
}): string[] {
  const years = [...(input.years || [])].sort((a, b) =>
    historicYearKey(a.yearEnding).localeCompare(historicYearKey(b.yearEnding)),
  );
  const lines: string[] = [];
  const withAssets = years.filter((row) => hasNumber(row.netAssets));
  if (withAssets.length === 1) {
    lines.push(`Net assets ${gbp(withAssets[0].netAssets as number)} in ${yearLabel(withAssets[0].yearEnding)}.`);
  } else if (withAssets.length > 1) {
    const first = withAssets[0];
    const last = withAssets[withAssets.length - 1];
    lines.push(
      `Net assets ${gbp(first.netAssets as number)} (${yearLabel(first.yearEnding)}) to ${gbp(last.netAssets as number)} (${yearLabel(last.yearEnding)}).`,
    );
  }

  const withTurnover = years.filter((row) => hasNumber(row.turnover) && row.turnover !== 0);
  const turnoverLine = seriesPhrase(withTurnover, (row) => row.turnover);
  if (turnoverLine) lines.push(`Turnover ${turnoverLine}.`);

  const withProfit = years.filter((row) => hasNumber(row.netProfit));
  const profitLine = seriesPhrase(withProfit, (row) => row.netProfit, "loss");
  if (profitLine) lines.push(`Profit ${profitLine}.`);

  const withMargin = years.filter(
    (row) => hasNumber(row.turnover) && row.turnover !== 0 && hasNumber(row.grossProfit),
  );
  if (withMargin.length) {
    const bits = withMargin.map((row) => {
      const margin = Math.round(((row.grossProfit as number) / (row.turnover as number)) * 1000) / 10;
      return `${margin}% (${yearLabel(row.yearEnding)})`;
    });
    lines.push(`Gross margin ${bits.join(" to ")}.`);
  }

  const missingPl = years.filter(blankPl).map((row) => yearLabel(row.yearEnding));
  if (years.length > 0 && missingPl.length === years.length) {
    lines.push("Filed accounts do not state a P&L or turnover — typical of micro-entity filings.");
  } else if (missingPl.length) {
    lines.push(`No P&L on file for ${missingPl.join(", ")}.`);
  }
  if (input.pnlFromUpload && withTurnover.length) {
    lines.push("Turnover and profit are from uploaded P&L accounts, not the public micro-entity extract.");
  }

  const latest = [...years].reverse().find((row) => hasNumber(row.netAssets) || hasNumber(row.totalAssets)) || years[years.length - 1];
  if (latest && latest.cashAndEquivalents === 0) {
    lines.push(`Cash is nil on the ${yearLabel(latest.yearEnding)} balance sheet.`);
  }
  if (latest && hasNumber(latest.debtors) && hasNumber(latest.totalAssets) && latest.totalAssets > 0 && latest.debtors / latest.totalAssets > 0.5) {
    const pct = Math.round((latest.debtors / latest.totalAssets) * 100);
    lines.push(`Debtors ${gbp(latest.debtors)} of ${gbp(latest.totalAssets)} assets (${pct}%).`);
  }

  if (!input.hasAuditedAccounts) {
    lines.push(
      "No full audited accounts have been presented. Credit view rests on statements, Creditsafe and the forecast.",
    );
  }
  return lines.slice(0, 12);
}

export function isAssetLedgerOrPropertyProduct(productType?: string | null): boolean {
  return /asset|invoice|ledger|factor|property|bridg/i.test(String(productType || ""));
}
