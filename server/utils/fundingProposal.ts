/**
 * Passan-format funding proposal.
 * Visual match to the authored A4 HTML (navy bands, fact table, risk-first,
 * historic financials, deal summary, forecasts, recommendation). Generate Report
 * prints this HTML to PDF — it does not use the old PDFKit credit pack.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ProspectDocument, ProspectWithCompany } from "@shared/schema";
import { resolveAttachmentsChecklist, type ResolvedAttachment } from "@shared/attachmentsChecklist";
import { calculateLoan } from "../../client/src/lib/calculators";
import { CAMPARI_SECTIONS } from "../../client/src/lib/creditUnderwriting/constants";
import { buildStrataPayload } from "../services/strataPayload";
import type { ProspectReportData } from "./pdfGenerator";

export type FundingProposalInput = ProspectReportData & {
  hideAdviserRecommendation?: boolean;
  sterlingRecommendation?: string;
  sterlingSignedBy?: string;
};

type Kv = { label: string; value: string };
type FinTable = { caption: string; headers: string[]; rows: string[][]; note?: string; className?: string };
type ChartSeries = { name: string; values: Array<number | null>; color: string };
type AccountsChart = { labels: string[]; series: ChartSeries[]; unit: string };
type GroupEntity = { name: string; status: string; inFacility: boolean };
type Owner = { name: string; role: string; status: string };

export type FundingProposalModel = {
  borrower: string;
  tradingAs: string;
  companyNumber: string;
  generated: string;
  generatedStamp: string;
  reference: string;
  logoDataUri: string;
  coverNote: string;
  facts: Kv[];
  profileRows: Kv[];
  riskGrade: string;
  loanPurpose: string;
  theBusiness: string;
  businessFacts: string;
  group: GroupEntity[];
  groupNote: string;
  ownership: Owner[];
  registerRows: Kv[];
  riskIndicatorRows: Kv[];
  chargesTable: FinTable | null;
  backgroundNotes: string;
  riskSummary: string;
  campariBlocks: { key: string; title: string; body: string }[];
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  fileFlags: string[];
  cashflowRows: Kv[];
  monthlyActivity: FinTable | null;
  cashTrend: string;
  bankCommentary: string;
  redFlagItems: string[];
  concernItems: string[];
  loanRepayments: FinTable | null;
  directDebits: FinTable | null;
  bouncedPayments: FinTable | null;
  gamblingSpend: FinTable | null;
  personalUse: FinTable | null;
  bankAnomalies: FinTable | null;
  historicPl: FinTable | null;
  historicBs: FinTable | null;
  accountsChart: AccountsChart | null;
  historicNote: string;
  dealIntro: string;
  sourcesUses: FinTable | null;
  ttp: FinTable | null;
  ttpNote: string;
  dealNotes: string;
  purposeCommentary: string;
  securityRows: Kv[];
  useOfFunds: FinTable | null;
  allocations: FinTable | null;
  researchSections: { title: string; rows: Kv[] }[];
  loanCalcRows: Kv[];
  forecastPl: FinTable | null;
  forecastStats: Kv[];
  forecastNote: string;
  futureStrategy: string;
  brokerRemarks: string;
  brokerSigned: string;
  recommendationOutcome: string;
  attachments: ResolvedAttachment[];
};

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.EDGE_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter((value): value is string => Boolean(value));

const LOGO_CANDIDATES = [
  join(process.cwd(), "client/public/images/sterling-commercial-finance-logo.png"),
  join(process.cwd(), "docs/brand/sterling-commercial-finance-logo-passan.png"),
  "F:\\Shaun\\Desktop\\Strata\\strata-main\\docs\\brand\\sterling-commercial-finance-logo-passan.png",
];

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function displayString(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(displayString).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    if (!Object.keys(rec).length) return "";
    for (const key of ["rating", "grade", "score", "label", "value", "name", "summary", "text", "description"]) {
      if (rec[key] == null || rec[key] === value) continue;
      const inner = displayString(rec[key]);
      if (inner) return inner;
    }
    return "";
  }
  return "";
}

function esc(value: unknown): string {
  return displayString(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function text(...parts: unknown[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    if (part == null) continue;
    const chunk = displayString(part);
    if (!chunk) continue;
    const key = chunk.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(chunk);
  }
  return out.join("\n\n");
}

function linesOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const rec = item as Record<string, unknown>;
        return String(rec.label || rec.text || rec.strength || rec.weakness || rec.threat || rec.risk || "").trim();
      }
      return "";
    })
    .filter(Boolean);
}

function numberish(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(/[,£\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function money(value: unknown): string {
  const n = numberish(value);
  if (n == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function gbp(value: unknown, pence = false): string {
  const n = numberish(value);
  if (n == null) return "—";
  const pounds = pence ? n / 100 : n;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(pounds);
}

function num(value: unknown): string {
  const n = numberish(value);
  if (n == null) return "—";
  const abs = Math.abs(n);
  const formatted = abs >= 100 || Number.isInteger(n) ? abs.toLocaleString("en-GB", { maximumFractionDigits: 0 }) : abs.toLocaleString("en-GB", { maximumFractionDigits: 1 });
  return n < 0 ? `(${formatted})` : formatted;
}

const CHART_COLORS = ["#1F3864", "#5B7BB2", "#2F6B3A", "#8A2E0D"];

function parseDisplayed(cell: string): number | null {
  const raw = String(cell || "").trim();
  if (!raw || raw === "—") return null;
  const negative = raw.startsWith("(") && raw.endsWith(")");
  const n = numberish(raw.replace(/[()]/g, ""));
  if (n == null) return null;
  return negative ? -n : n;
}

function linearTrend(values: Array<number | null>): Array<number | null> {
  const points: Array<[number, number]> = [];
  values.forEach((v, i) => {
    if (v != null) points.push([i, v]);
  });
  if (points.length < 2) return values.map(() => null);
  const n = points.length;
  const sumX = points.reduce((s, [x]) => s + x, 0);
  const sumY = points.reduce((s, [, y]) => s + y, 0);
  const sumXY = points.reduce((s, [x, y]) => s + x * y, 0);
  const sumXX = points.reduce((s, [x]) => s + x * x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return values.map(() => null);
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return values.map((_, i) => intercept + slope * i);
}

function chartFromFinTable(table: FinTable | null): AccountsChart | null {
  if (!table || table.headers.length < 2 || !table.rows.length) return null;
  const labels = table.headers.slice(1);
  const series = table.rows
    .map((row, i) => ({
      name: row[0] || `Series ${i + 1}`,
      values: row.slice(1).map((cell) => parseDisplayed(cell)),
      color: CHART_COLORS[i % CHART_COLORS.length],
    }))
    .filter((row) => row.values.some((v) => v != null));
  if (!labels.length || !series.length) return null;
  const unit = /\(£000\)/.test(table.caption) ? "£000" : "£";
  return { labels, series, unit };
}

function accountsChartSvg(chart: AccountsChart): string {
  const width = 640;
  const height = 228;
  const padL = 52;
  const padR = 16;
  const padT = 28;
  const padB = 36;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const all = chart.series.flatMap((s) => s.values.filter((v): v is number => v != null));
  if (!all.length) return "";
  const min = Math.min(0, ...all);
  const max = Math.max(0, ...all);
  const span = max - min || 1;
  const yOf = (v: number) => padT + ((max - v) / span) * plotH;
  const groups = chart.labels.length;
  const groupW = plotW / groups;
  const barGap = 3;
  const barW = Math.max(6, (groupW - 16 - (chart.series.length - 1) * barGap) / chart.series.length);
  const zeroY = yOf(0);
  const ticks = 4;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => min + (span * i) / ticks);
  const axisTicks = tickVals
    .map((v) => {
      const y = yOf(v);
      return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${width - padR}" y2="${y.toFixed(1)}" stroke="#E6E6E6" stroke-width="1"/>
        <text x="${padL - 6}" y="${y + 3}" text-anchor="end" font-size="9" fill="#595959" font-family="Segoe UI, Calibri, sans-serif">${esc(num(Math.round(v)))}</text>`;
    })
    .join("");
  const bars = chart.labels
    .map((label, i) => {
      const gx = padL + i * groupW + 8;
      const blocks = chart.series
        .map((series, j) => {
          const v = series.values[i];
          if (v == null) return "";
          const y = yOf(v);
          const top = Math.min(y, zeroY);
          const h = Math.max(1.5, Math.abs(zeroY - y));
          const x = gx + j * (barW + barGap);
          return `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="${series.color}"/>`;
        })
        .join("");
      const lx = gx + (chart.series.length * (barW + barGap) - barGap) / 2;
      return `${blocks}<text x="${lx.toFixed(1)}" y="${height - 12}" text-anchor="middle" font-size="9" fill="#1A1A1A" font-family="Segoe UI, Calibri, sans-serif">${esc(label)}</text>`;
    })
    .join("");
  const trendSource = chart.series[0];
  const trend = trendSource ? linearTrend(trendSource.values) : [];
  const trendPts = trend
    .map((v, i) => {
      if (v == null) return null;
      const gx = padL + i * groupW + 8;
      const x = gx + (chart.series.length * (barW + barGap) - barGap) / 2;
      return `${x.toFixed(1)},${yOf(v).toFixed(1)}`;
    })
    .filter((p): p is string => Boolean(p));
  const trendLine =
    trendPts.length >= 2
      ? `<polyline points="${trendPts.join(" ")}" fill="none" stroke="#C4A35A" stroke-width="2.2" />
         ${trendPts.map((p) => `<circle cx="${p.split(",")[0]}" cy="${p.split(",")[1]}" r="3" fill="#C4A35A" />`).join("")}`
      : "";
  const legend = [
    ...chart.series.map(
      (s, i) =>
        `<rect x="${padL + i * 118}" y="6" width="9" height="9" fill="${s.color}"/><text x="${padL + 13 + i * 118}" y="15" font-size="9" fill="#1A1A1A" font-family="Segoe UI, Calibri, sans-serif">${esc(s.name)}</text>`
    ),
    trendPts.length >= 2
      ? `<line x1="${padL + chart.series.length * 118}" y1="11" x2="${padL + chart.series.length * 118 + 14}" y2="11" stroke="#C4A35A" stroke-width="2"/><text x="${padL + chart.series.length * 118 + 18}" y="15" font-size="9" fill="#1A1A1A" font-family="Segoe UI, Calibri, sans-serif">Trend (${esc(trendSource.name)})</text>`
      : "",
  ].join("");
  return `<div class="chart-wrap">
    <div class="chart-caption">Accounts trend (${esc(chart.unit)})</div>
    <svg class="accounts-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Historic accounts block chart with trend line">
      ${axisTicks}
      <line x1="${padL}" y1="${zeroY.toFixed(1)}" x2="${width - padR}" y2="${zeroY.toFixed(1)}" stroke="#BFBFBF" stroke-width="1"/>
      ${bars}
      ${trendLine}
      ${legend}
    </svg>
  </div>`;
}

function thousands(values: Array<number | null>): { unit: "£000" | "£"; display: (n: number | null) => string } {
  const present = values.filter((v): v is number => v != null);
  const useThousands = present.length > 0 && present.every((v) => Math.abs(v) >= 1000 || v === 0);
  if (!useThousands) return { unit: "£", display: (n) => (n == null ? "—" : num(n)) };
  return {
    unit: "£000",
    display: (n) => (n == null ? "—" : num(Math.round(n / 1000))),
  };
}

function parseJson(raw?: string | null): any | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function formatDate(value?: string | Date | null): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatStamp(at: Date): string {
  return `${formatDate(at)}, ${pad2(at.getHours())}:${pad2(at.getMinutes())}`;
}

export function proposalReference(companyNumber: string, prospectId: number | undefined, at: Date): string {
  const id = (companyNumber || String(prospectId ?? "FILE")).replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "FILE";
  const ymd = `${at.getFullYear()}${pad2(at.getMonth() + 1)}${pad2(at.getDate())}`;
  const hm = `${pad2(at.getHours())}${pad2(at.getMinutes())}`;
  return `SCF-${id}-${ymd}-${hm}`;
}

function termLabel(term: unknown): string {
  const n = numberish(term);
  if (n == null) return "—";
  if (n % 12 === 0) {
    const years = n / 12;
    return years === 1 ? "1 year" : `${years} years`;
  }
  return `${n} months`;
}

function purposeShort(purpose: string): string {
  if (/^refinance$/i.test(purpose)) return "Repay short term loans";
  return purpose || "—";
}

function prettyControl(raw: unknown): string {
  return String(raw || "")
    .replace(/ownership-of-shares-(\d+)-to-(\d+)-percent/g, "Shares $1–$2%")
    .replace(/voting-rights-(\d+)-to-(\d+)-percent/g, "Voting $1–$2%")
    .replace(/right-to-appoint-and-remove-directors/g, "Appoint/remove directors")
    .replace(/significant-influence-or-control/g, "Significant influence")
    .replace(/[_-]+/g, " ")
    .trim();
}

function logoDataUri(): string {
  for (const path of LOGO_CANDIDATES) {
    if (!existsSync(path)) continue;
    try {
      const buf = readFileSync(path);
      return `data:image/png;base64,${buf.toString("base64")}`;
    } catch {
      continue;
    }
  }
  return "";
}

export function findChromium(): string | null {
  for (const candidate of CHROME_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function creditsafeStatements(company: ProspectWithCompany["company"]): any[] {
  const payload = parseJson(company.creditsafeReport);
  const statements = payload?.report?.financialStatements;
  return Array.isArray(statements) ? statements : [];
}

function chargeItems(charges: any): any[] {
  return Array.isArray(charges?.items) ? charges.items : [];
}

function prettyLabel(value: unknown): string {
  const raw = String(value || "").replace(/[_-]+/g, " ").trim();
  if (!raw) return "";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function yesNo(value: unknown): string {
  return value ? "Yes" : "No";
}

function chargeParticulars(particulars: any): string {
  const rec = asRecord(particulars);
  const bits = [
    rec.contains_fixed_charge ? "Fixed" : "",
    rec.contains_floating_charge ? "Floating" : "",
    rec.contains_negative_pledge ? "Negative pledge" : "",
    rec.floating_charge_covers_all ? "All assets" : "",
    rec.description ? String(rec.description) : "",
  ].filter(Boolean);
  return bits.join(", ");
}

function officerItems(officers: any): any[] {
  return Array.isArray(officers?.items) ? officers.items : Array.isArray(officers) ? officers : [];
}

function pscItems(psc: any): any[] {
  return Array.isArray(psc?.items) ? psc.items : Array.isArray(psc) ? psc : [];
}

function dscrValue(underwriting: Record<string, any>, diligence: Record<string, any>): string {
  const candidates = [
    underwriting.financialAnalysis?.dscr,
    underwriting.accountsAnalysis?.dscr?.average,
    underwriting.accountsAnalysis?.dscr,
    diligence.dscr?.average,
    diligence.dscr,
  ];
  for (const value of candidates) {
    const n = numberish(value);
    if (n != null) return `${n.toFixed(2).replace(/\.00$/, "")}x`;
  }
  return "";
}

function buildHistoricFromYears(years: any[]): FinTable | null {
  if (!Array.isArray(years) || !years.length) return null;
  const columns = years.map((year, i) => String(year.year || year.period || year.label || `Year ${i + 1}`));
  const pick = (keys: string[]) =>
    years.map((year) => {
      for (const key of keys) {
        const n = numberish(year[key]);
        if (n != null) return n;
      }
      return null;
    });
  const turnover = pick(["turnover", "revenue"]);
  const gross = pick(["grossProfit", "gross_profit"]);
  const ebitda = pick(["ebitda", "operatingProfit", "operating_profit"]);
  const net = pick(["netProfit", "net_profit", "profitBeforeTax"]);
  const scale = thousands([...turnover, ...gross, ...ebitda, ...net]);
  const rows = [
    ["Turnover", ...turnover.map(scale.display)],
    ["Gross profit", ...gross.map(scale.display)],
    ["Adj. EBITDA", ...ebitda.map(scale.display)],
    ["Net profit", ...net.map(scale.display)],
  ].filter((row) => row.slice(1).some((cell) => cell !== "—"));
  if (!rows.length) return null;
  return {
    caption: `Historic Profit & Loss (${scale.unit})`,
    headers: ["", ...columns],
    rows,
    note: "Taken from analysed statutory / management accounts on this file.",
  };
}

function buildHistoricFromCreditsafe(statements: any[]): { pl: FinTable | null; bs: FinTable | null } {
  const rows = statements.slice(0, 4);
  if (!rows.length) return { pl: null, bs: null };
  const columns = rows.map((fs) => (fs.yearEndDate ? formatDate(fs.yearEndDate) : "Period"));
  const turnover = rows.map((fs) => numberish(fs.profitAndLoss?.revenue));
  const op = rows.map((fs) => numberish(fs.profitAndLoss?.operatingProfit));
  const pbt = rows.map((fs) => numberish(fs.profitAndLoss?.profitBeforeTax));
  const plScale = thousands([...turnover, ...op, ...pbt]);
  const plRows = [
    ["Turnover", ...turnover.map(plScale.display)],
    ["Operating profit", ...op.map(plScale.display)],
    ["Profit before tax", ...pbt.map(plScale.display)],
  ].filter((row) => row.slice(1).some((cell) => cell !== "—"));
  const latest = rows[0];
  const bsLines: Array<[string, number | null, string]> = [
    ["Total assets", numberish(latest?.balanceSheet?.totalAssets), ""],
    ["Total liabilities", numberish(latest?.balanceSheet?.totalLiabilities), ""],
    ["Shareholders' equity", numberish(latest?.balanceSheet?.totalShareholdersEquity), ""],
  ];
  const bsScale = thousands(bsLines.map((line) => line[1]));
  return {
    pl: plRows.length
      ? {
          caption: `Creditsafe Profit & Loss (${plScale.unit})`,
          headers: ["", ...columns],
          rows: plRows,
          note: "Filed figures as reported by Creditsafe — not a formal consolidation.",
        }
      : null,
    bs: bsLines.some((line) => line[1] != null)
      ? {
          caption: `Balance Sheet — as at ${columns[0] || "latest"} (${bsScale.unit})`,
          headers: ["", bsScale.unit, "Note"],
          rows: bsLines.map(([label, value, note]) => [label, bsScale.display(value), note]),
        }
      : null,
  };
}

const SECURITY_LABELS: Array<{ key: string; label: string; prospect: keyof ProspectWithCompany }> = [
  { key: "directors_guarantee", label: "Director's Guarantee", prospect: "directorsGuarantee" },
  { key: "debenture", label: "Debenture", prospect: "debenture" },
  { key: "commercial_property", label: "Commercial Property", prospect: "commercialProperty" },
  { key: "parent_company_guarantee", label: "Parent Company Guarantee", prospect: "parentCompanyGuarantee" },
  { key: "home_equity", label: "Home Equity", prospect: "homeEquity" },
  { key: "collateral", label: "Collateral", prospect: "collateral" },
  { key: "other_property", label: "Property (Other)", prospect: "propertyOther" },
  { key: "cross_company_guarantee", label: "Cross Company Guarantee", prospect: "crossCompanyGuarantee" },
];

const PRODUCT_LABELS: Record<string, string> = {
  BUSINESS_LOAN: "Business Loan (Unsecured/Secured)",
  ASSET_FINANCE: "Asset Finance",
  EQUIPMENT_LEASING: "Equipment Leasing",
  INVOICE_FINANCE: "Invoice Financing",
  BRIDGING_LOAN: "Bridging Loan",
  COMMERCIAL_MORTGAGE: "Commercial Mortgage",
  BUY_TO_LET: "Buy To Let",
  SECURED_LOAN: "Secured Loan",
};

function offered(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function kvIf(label: string, value: unknown, pounds = false): Kv | null {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return { label, value: value ? "Yes" : "No" };
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value === 0) return null;
    return { label, value: pounds ? money(value) : String(value) };
  }
  const s = String(value).trim();
  if (!s) return null;
  return { label, value: s };
}

function breakdownTable(caption: string, items: unknown): FinTable | null {
  if (!Array.isArray(items) || !items.length) return null;
  const rows: string[][] = [];
  let total = 0;
  for (const item of items) {
    const rec = asRecord(item);
    const label = String(rec.description || rec.label || "").trim();
    const amount = numberish(rec.amount);
    if (!label && amount == null) continue;
    if (amount != null) total += amount;
    rows.push([label || "Item", amount != null ? num(amount) : "—"]);
  }
  if (!rows.length) return null;
  rows.push(["Total", num(total)]);
  return { caption, headers: ["Item", "£"], rows };
}

function securityRows(prospect: ProspectWithCompany, req: Record<string, any>): Kv[] {
  const offeredMap = asRecord(req.security_offered);
  return SECURITY_LABELS.map((item) => ({
    label: item.label,
    value: offered(offeredMap[item.key]) || offered(prospect[item.prospect]) ? "Offered" : "Not offered",
  }));
}

function researchSections(research: Record<string, any>): { title: string; rows: Kv[] }[] {
  const sections: { title: string; rows: Kv[] }[] = [];
  const asset = asRecord(research.asset_module);
  const assetRows = [
    kvIf("Make", asRecord(asset.identification).make),
    kvIf("Model", asRecord(asset.identification).model),
    kvIf("Year", asRecord(asset.identification).year),
    kvIf("Serial number", asRecord(asset.identification).serial_number),
    kvIf("Supplier verification", asRecord(asset.identification).supplier_verification),
    kvIf("Supplier quote", asRecord(asset.valuation).supplier_quote_price, true),
    kvIf("Market average", asRecord(asset.valuation).market_average_price, true),
    kvIf("Forced sale value", asRecord(asset.valuation).forced_sale_value, true),
    kvIf("Asset location", asRecord(asset.security).asset_location),
    kvIf("Title check", asRecord(asset.security).title_check_status),
  ].filter((row): row is Kv => Boolean(row));
  if (assetRows.length) sections.push({ title: "Research Hub — Asset", rows: assetRows });

  const ledger = asRecord(research.ledger_module);
  const ledgerRows = [
    kvIf("Total debtors", asRecord(ledger.book_summary).total_debtors),
    kvIf("Total outstanding", asRecord(ledger.book_summary).total_outstanding, true),
    kvIf("Concentration limit", asRecord(ledger.risk_factors).concentration_limit_percent),
    kvIf("Top debtor exposure", asRecord(ledger.risk_factors).top_debtor_exposure),
    kvIf("Foreign debt %", asRecord(ledger.risk_factors).foreign_debt_percentage),
    kvIf("Dilution rate %", asRecord(ledger.risk_factors).dilution_rate_percent),
    kvIf("Last audit", asRecord(ledger.audit).last_audit_date),
    kvIf("Verification method", asRecord(ledger.audit).verification_method),
  ].filter((row): row is Kv => Boolean(row));
  if (ledgerRows.length) sections.push({ title: "Research Hub — Ledger", rows: ledgerRows });

  const property = asRecord(research.property_module);
  const propertyRows = [
    kvIf("Address", asRecord(property.property_details).address),
    kvIf("Title number", asRecord(property.property_details).title_number),
    kvIf("Tenure", asRecord(property.property_details).tenure),
    kvIf("Property type", asRecord(property.property_details).property_type),
    kvIf("Purchase price", asRecord(property.valuation_metrics).purchase_price, true),
    kvIf("Red book valuation", asRecord(property.valuation_metrics).red_book_valuation, true),
    kvIf("Vacant possession", asRecord(property.valuation_metrics).vacant_possession_value, true),
    kvIf("90-day sale value", asRecord(property.valuation_metrics).ninety_day_sale_value, true),
    kvIf("Current LTV %", asRecord(property.valuation_metrics).current_ltv_percent),
    kvIf("Rental income", asRecord(property.income_yield).current_rental_income, true),
    kvIf("Gross yield %", asRecord(property.income_yield).gross_yield_percent),
    kvIf("Occupancy", asRecord(property.income_yield).occupancy_status),
  ].filter((row): row is Kv => Boolean(row));
  if (propertyRows.length) sections.push({ title: "Research Hub — Property", rows: propertyRows });

  return sections;
}

function loanCalcRows(
  calc: Record<string, any>,
  prospect: ProspectWithCompany,
  req: Record<string, any>
): Kv[] {
  const details = asRecord(req.product_details);
  const amount =
    numberish(calc.loanAmount) ??
    numberish(details.loan_amount) ??
    (numberish(prospect.loanAmount) != null ? Number(prospect.loanAmount) / 100 : null);
  const rate =
    numberish(calc.interestRate) ??
    numberish(details.target_interest_rate_percent) ??
    numberish(prospect.interestRate);
  const term =
    numberish(calc.term) ??
    numberish(details.term_months) ??
    numberish(prospect.term);
  if (amount == null && rate == null && term == null) return [];

  const rows: Kv[] = [];
  const product = String(req.product_type || "");
  if (product) rows.push({ label: "Product", value: PRODUCT_LABELS[product] || product });
  if (amount != null) rows.push({ label: "Loan amount", value: money(amount) });
  if (rate != null) rows.push({ label: "Interest rate", value: `${rate}%` });
  if (term != null) rows.push({ label: "Term", value: `${term} months` });
  const commission = numberish(calc.commissionRate);
  if (commission != null) rows.push({ label: "Commission", value: `${commission}%` });
  const docFee = numberish(calc.documentationFee) ?? 0;
  const legalFee = numberish(calc.legalFee) ?? 0;
  if (numberish(calc.documentationFee) != null) rows.push({ label: "Documentation fee", value: money(docFee) });
  if (numberish(calc.legalFee) != null) rows.push({ label: "Legal fees", value: money(legalFee) });
  if (calc.addDocFeeToLoan) rows.push({ label: "Documentation fee added to loan", value: "Yes" });

  if (amount != null && rate != null && term != null && term > 0) {
    const result = calculateLoan(
      amount,
      rate,
      term,
      commission ?? undefined,
      docFee,
      !!calc.addDocFeeToLoan,
      legalFee
    );
    rows.push({ label: "Monthly repayment", value: money(result.monthlyPayment) });
    rows.push({ label: "Facility fee (3.5%)", value: money(result.facilityFee) });
    if (result.commissionAmount) rows.push({ label: "Broker commission", value: money(result.commissionAmount) });
    rows.push({ label: "Total interest", value: money(result.totalInterest) });
    rows.push({ label: "Total capital borrowed", value: money(result.totalCapitalBorrowed) });
    rows.push({ label: "Total repayment", value: money(result.totalRepayment) });
  }
  return rows;
}

function buildSourcesUses(prospect: ProspectWithCompany, loanPounds: string): FinTable | null {
  const allocation = Array.isArray(prospect.loanAllocation) ? prospect.loanAllocation : [];
  const req = asRecord(prospect.loanRequirementData);
  const fundRows = Array.isArray(req.use_of_funds?.breakdown) ? req.use_of_funds.breakdown : [];
  const uses: Array<{ label: string; amount: string }> = [];
  if (allocation.length) {
    for (const item of allocation) {
      const label = String(item?.description || item?.label || "").trim();
      const amount = numberish(item?.amount);
      if (!label && amount == null) continue;
      uses.push({ label: label || "Use of funds", amount: amount != null ? num(amount) : "—" });
    }
  } else if (fundRows.length) {
    for (const item of fundRows) {
      const label = String(item?.description || "").trim();
      const amount = numberish(item?.amount);
      if (!label && amount == null) continue;
      uses.push({ label: label || "Use of funds", amount: amount != null ? num(amount) : "—" });
    }
  }
  const loanLabel = loanPounds ? gbp(loanPounds) : "";
  if (!uses.length && !loanLabel) return null;
  const n = Math.max(uses.length, 1);
  const rows: string[][] = [];
  for (let i = 0; i < n; i++) {
    const use = uses[i] || { label: i === 0 && !uses.length ? "Facility requested" : "", amount: i === 0 && !uses.length ? loanLabel.replace("£", "") : "" };
    rows.push([
      use.label,
      use.amount,
      i === 0 ? "Term loan requested" : "",
      i === 0 ? (loanLabel ? loanLabel.replace(/^£/, "") : "") : "",
    ]);
  }
  const useTotal = uses.reduce((sum, row) => sum + (numberish(row.amount.replace(/,/g, "")) || 0), 0);
  rows.push(["Total", useTotal ? num(useTotal) : loanLabel.replace(/^£/, ""), "Total", loanLabel.replace(/^£/, "")]);
  return {
    caption: "",
    headers: ["Application of Funds", "£", "Source of Funds", "£"],
    rows,
  };
}

function flagText(flag: unknown): string {
  if (typeof flag === "string") return flag.trim();
  const rec = asRecord(flag);
  if (rec.isActive === false) return "";
  return String(rec.label || rec.text || rec.message || "").trim();
}

function findingsTable(caption: string, items: unknown): FinTable | null {
  if (!Array.isArray(items) || !items.length) return null;
  const rows: string[][] = [];
  for (const item of items) {
    const rec = asRecord(item);
    const date = String(rec.date || "").trim();
    const description = String(rec.description || rec.label || rec.payee || "").trim();
    const details = String(rec.details || rec.type || "").trim();
    const amount = numberish(rec.amount);
    if (!date && !description && amount == null) continue;
    rows.push([date || "—", description || "—", amount != null ? money(amount) : "—", details || "—"]);
  }
  if (!rows.length) return null;
  return { caption, headers: ["Date", "Description", "£", "Detail"], rows };
}

function classifyFlags(flags: string[]) {
  const bounced: string[] = [];
  const gambling: string[] = [];
  const personal: string[] = [];
  const rest: string[] = [];
  for (const flag of flags) {
    if (/bounce|returned item|unpaid|refer to drawer|\bnsf\b|failed payment/i.test(flag)) bounced.push(flag);
    else if (/gambl|betfair|william hill|paddy power|ladbrokes|sky bet|casino|bookmaker/i.test(flag)) gambling.push(flag);
    else if (/personal use|personal spend|drawings|director.?s (draw|shop)/i.test(flag)) personal.push(flag);
    else rest.push(flag);
  }
  return { bounced, gambling, personal, rest };
}

function monthlyActivityTable(months: unknown): FinTable | null {
  if (!Array.isArray(months) || months.length < 1) return null;
  const rows: string[][] = [];
  for (const month of months) {
    const rec = asRecord(month);
    const label = String(rec.month || rec.period || "").trim();
    if (!label && numberish(rec.income) == null) continue;
    rows.push([
      label || "—",
      money(rec.income ?? rec.credits),
      money(rec.expenses ?? rec.debits),
      money(rec.net),
      money(rec.closingBalance ?? rec.balance),
    ]);
  }
  if (!rows.length) return null;
  return {
    caption: "Bank statement activity",
    headers: ["Month", "Credits", "Debits", "Net", "Closing"],
    rows,
  };
}

function cashTrendFromMonths(months: unknown): string {
  if (!Array.isArray(months) || months.length < 2) return "";
  const first = asRecord(months[0]);
  const last = asRecord(months[months.length - 1]);
  const bits: string[] = [];
  const incomeFirst = numberish(first.income ?? first.credits);
  const incomeLast = numberish(last.income ?? last.credits);
  if (incomeFirst != null && incomeLast != null && incomeFirst !== 0) {
    const change = ((incomeLast - incomeFirst) / Math.abs(incomeFirst)) * 100;
    bits.push(
      `Credits ${change > 5 ? "rising" : change < -5 ? "falling" : "broadly flat"} (${change > 0 ? "+" : ""}${change.toFixed(0)}% across the period)`
    );
  }
  const closeFirst = numberish(first.closingBalance ?? first.balance);
  const closeLast = numberish(last.closingBalance ?? last.balance);
  if (closeFirst != null && closeLast != null) {
    bits.push(
      closeLast > closeFirst
        ? "Closing balance improved towards the latest month"
        : closeLast < closeFirst
          ? "Closing balance weakened towards the latest month"
          : "Closing balance was stable"
    );
  }
  return bits.join(". ");
}

export function buildFundingProposal(data: FundingProposalInput): FundingProposalModel {
  const prospect = data.prospect;
  const company = prospect.company;
  const payload = buildStrataPayload({
    prospect,
    contacts: data.contacts || [],
    diligence: data.dueDiligence?.data,
    documents: (data.documents || []) as ProspectDocument[],
    exceptions: data.exceptions || [],
    notes: prospect.notes || "",
  }) as Record<string, any>;

  const borrower = String(payload.borrower?.legal_name || company.companyName || "Borrower");
  const trading = String(payload.borrower?.trading_name || "");
  const loan = asRecord(payload.loan);
  const assessment = asRecord(payload.assessment);
  const financials = asRecord(payload.financials);
  const diligence = asRecord(data.dueDiligence?.data);
  const underwriting = asRecord(diligence.underwriting);
  const accounts = asRecord(underwriting.accountsAnalysis);
  const generatedAt = new Date();
  const generated = formatDate(generatedAt);
  const generatedStamp = formatStamp(generatedAt);
  const reference = proposalReference(company.companyNumber || "", prospect.id, generatedAt);
  const riskGrade = displayString(assessment.rating) || displayString(underwriting.riskGrade);
  const creditsafeGrade =
    displayString(company.creditsafeRatingDescription) || displayString(company.creditsafeScore);
  const grade = riskGrade || creditsafeGrade || "—";

  const facts: Kv[] = [
    { label: "Loan amount required:", value: loan.amount ? gbp(loan.amount) : "—" },
    { label: "Purpose of loan:", value: purposeShort(String(loan.purpose || "")) },
    { label: "Prepared for:", value: borrower },
    { label: "Date:", value: generated },
    { label: "Term requested:", value: termLabel(loan.term_months || prospect.term) },
    { label: "Repayment type:", value: String(loan.repayment_type || "Capital & interest") },
    { label: "Risk grade:", value: grade },
  ];

  const statements = creditsafeStatements(company);
  const years = Array.isArray(accounts.years) ? accounts.years : [];
  const historicFromYears = buildHistoricFromYears(years);
  const fromCs = historicFromYears ? { pl: null, bs: null } : buildHistoricFromCreditsafe(statements);
  let historicPl = historicFromYears || fromCs.pl;
  if (!historicPl && accounts.profitAndLoss && (accounts.profitAndLoss.turnover || accounts.profitAndLoss.netProfit)) {
    const pl = accounts.profitAndLoss;
    const values = [numberish(pl.turnover), numberish(pl.grossProfit), numberish(pl.ebitda || pl.operatingProfit), numberish(pl.netProfit)];
    const scale = thousands(values);
    historicPl = {
      caption: `Historic Profit & Loss (${scale.unit})`,
      headers: ["", "Latest"],
      rows: [
        ["Turnover", scale.display(values[0])],
        ["Gross profit", scale.display(values[1])],
        ["Adj. EBITDA", scale.display(values[2])],
        ["Net profit", scale.display(values[3])],
      ].filter((row) => row[1] !== "—"),
      note: "Taken from the accounts analysis on this file.",
    };
  }

  const historicBs = fromCs.bs;
  const ch = data.companiesHouseData || {};
  const profile = asRecord(ch.profile);
  const accountsRegister = asRecord(profile.accounts);
  const lastAccounts = asRecord(accountsRegister.last_accounts);
  const nextAccounts = asRecord(accountsRegister.next_accounts);
  const confirmation = asRecord(profile.confirmation_statement);
  const officers = officerItems(ch.officers).filter((row) => !row.resigned_on);
  const pscs = pscItems(ch.psc).filter((row) => !row.ceased_on);
  const charges = chargeItems(ch.charges);
  const outstanding = charges.filter((row) => String(row.status || "").toLowerCase() === "outstanding");
  const incorporationDate = formatDate(company.incorporationDate || profile.date_of_creation);
  const latestAccounts = [
    lastAccounts.made_up_to ? formatDate(lastAccounts.made_up_to) : "",
    lastAccounts.type ? prettyLabel(lastAccounts.type) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const nextAccountsDue = [
    nextAccounts.due_on ? formatDate(nextAccounts.due_on) : accountsRegister.next_due ? formatDate(accountsRegister.next_due) : "",
    nextAccounts.overdue || accountsRegister.overdue ? "Overdue" : "",
  ]
    .filter(Boolean)
    .join(" — ");
  const registerRows: Kv[] = [
    { label: "Incorporation date", value: incorporationDate || "—" },
    { label: "Latest filed accounts", value: latestAccounts || "Not on register" },
    ...(nextAccountsDue ? [{ label: "Next accounts due", value: nextAccountsDue }] : []),
    ...(confirmation.last_made_up_to
      ? [{ label: "Confirmation statement", value: formatDate(confirmation.last_made_up_to) }]
      : []),
  ];
  const riskIndicatorRows: Kv[] = [
    { label: "Has charges", value: yesNo(profile.has_charges || outstanding.length > 0) },
    { label: "Insolvency history", value: yesNo(profile.has_insolvency_history) },
    { label: "Been liquidated", value: yesNo(profile.has_been_liquidated) },
    ...(profile.registered_office_is_in_dispute ? [{ label: "Registered office in dispute", value: "Yes" }] : []),
    ...(profile.undeliverable_registered_office_address ? [{ label: "Undeliverable registered office", value: "Yes" }] : []),
  ];
  const chargeRows = charges.slice(0, 8).map((charge) => [
    String(charge.classification?.description || (charge.charge_number ? `Charge #${charge.charge_number}` : "Charge")),
    prettyLabel(charge.status) || "—",
    charge.created_on ? formatDate(charge.created_on) : "—",
    Array.isArray(charge.persons_entitled)
      ? charge.persons_entitled.map((p: any) => p.name).filter(Boolean).join(", ") || "—"
      : "—",
    chargeParticulars(charge.particulars) || "—",
  ]);
  const chargesTable: FinTable | null = chargeRows.length
    ? {
        caption: `Charges (${ch.charges?.total_count ?? charges.length} on register)`,
        headers: ["Charge", "Status", "Created", "Persons entitled", "Security"],
        rows: chargeRows,
        className: "charges",
      }
    : null;
  const backgroundNotes = text(prospect.background, prospect.notes);

  const associations = Array.isArray(prospect.savedAssociations) ? prospect.savedAssociations : [];
  const group: GroupEntity[] = [
    {
      name: company.companyNumber ? `${borrower} (CN ${company.companyNumber})` : borrower,
      status: "This facility",
      inFacility: true,
    },
    ...associations.map((row: any) => {
      const name = String(row.company_name || row.companyName || row.name || "Associated company");
      const cn = String(row.company_number || row.companyNumber || "");
      const status = String(row.company_status || row.associationType || "Associated");
      const liquidated = /liquidat|dissolv|insolvent/i.test(status);
      return {
        name: cn ? `${name} (CN ${cn})` : name,
        status,
        inFacility: !liquidated,
      };
    }),
  ];

  const ownership: Owner[] = [];
  for (const psc of pscs.slice(0, 8)) {
    ownership.push({
      name: String(psc.name || "PSC"),
      role: Array.isArray(psc.natures_of_control)
        ? psc.natures_of_control.map(prettyControl).join(", ")
        : "Person with significant control",
      status: psc.ceased_on ? "Ceased" : "Active",
    });
  }
  if (!ownership.length) {
    for (const officer of officers.slice(0, 8)) {
      ownership.push({
        name: String(officer.name || "Officer"),
        role: String(officer.officer_role || "Director").replace(/_/g, " "),
        status: officer.resigned_on ? "Resigned" : "Active",
      });
    }
  }

  const swot = asRecord(underwriting.swotAnalysis);
  const strengths = linesOf(swot.strengths);
  const weaknesses = linesOf(swot.weaknesses);
  const opportunities = linesOf(swot.opportunities);
  const threats = linesOf(swot.threats);
  const fileFlags = Array.from(
    new Set([
      ...outstanding.map((row) => {
        const persons = Array.isArray(row.persons_entitled)
          ? row.persons_entitled.map((p: any) => p.name).filter(Boolean).join(", ")
          : "";
        return persons ? `Outstanding charge in favour of ${persons}` : "Outstanding Companies House charge";
      }),
      ...(data.exceptions || [])
        .filter((row) => row.status !== "resolved" && row.message)
        .map((row) => String(row.message)),
    ])
  );

  const sic = [company.sicCode, company.sicDescription].filter(Boolean).join(" — ");
  const businessFacts = [
    company.companyNumber ? `Company number ${company.companyNumber}` : "",
    company.companyStatus ? `Status: ${company.companyStatus}` : "",
    company.incorporationDate ? `Incorporated ${formatDate(company.incorporationDate)}` : "",
    company.registeredAddress ? `Registered office: ${[company.registeredAddress, company.postcode].filter(Boolean).join(", ")}` : "",
    sic ? `SIC: ${sic}` : "",
    company.website ? `Website: ${company.website}` : "",
    company.creditsafeScore ? `Creditsafe score ${company.creditsafeScore}${company.creditsafeRatingDescription ? ` (${company.creditsafeRatingDescription})` : ""}` : "",
    company.creditsafeCreditLimit != null ? `Creditsafe limit ${gbp(company.creditsafeCreditLimit, true)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const profileRows: Kv[] = [
    { label: "Legal name", value: borrower },
    ...(trading && trading.toLowerCase() !== borrower.toLowerCase() ? [{ label: "Trading as", value: trading }] : []),
    ...(company.companyNumber ? [{ label: "Company number", value: String(company.companyNumber) }] : []),
    ...(company.companyStatus ? [{ label: "Status", value: prettyLabel(company.companyStatus) }] : []),
    ...(company.companyType ? [{ label: "Type", value: prettyLabel(company.companyType) }] : []),
    ...(company.incorporationDate ? [{ label: "Incorporated", value: formatDate(company.incorporationDate) }] : []),
    ...((company.registeredAddress || company.postcode)
      ? [{ label: "Registered office", value: [company.registeredAddress, company.postcode].filter(Boolean).join(", ") }]
      : []),
    ...(sic ? [{ label: "SIC", value: sic }] : []),
    ...(company.website ? [{ label: "Website", value: String(company.website) }] : []),
    ...(company.creditsafeScore
      ? [{ label: "Creditsafe", value: `${company.creditsafeScore}${company.creditsafeRatingDescription ? ` (${company.creditsafeRatingDescription})` : ""}` }]
      : []),
    ...(company.creditsafeCreditLimit != null
      ? [{ label: "Creditsafe limit", value: gbp(company.creditsafeCreditLimit, true) }]
      : []),
  ];

  const coverNote =
    "Initial overview to establish lender interest ahead of formal underwriting.";

  const ttpStatus = diligence.hmrcTimeToPay && diligence.hmrcTimeToPay !== "none" ? String(diligence.hmrcTimeToPay) : "";
  const ttpRows = Array.isArray(financials.ttp) ? financials.ttp : [];
  const ttp: FinTable | null = ttpStatus
    ? {
        caption: "Time to Pay Agreement — HMRC",
        headers: ["Item", "Detail"],
        rows: [
          ["Status", ttpStatus === "active" ? "Active" : ttpStatus === "historic" ? "Historic" : ttpStatus],
          ...ttpRows.map((row: any) => [String(row.company || row.lender || "HMRC"), String(row.status || row.notes || ttpStatus)]),
        ],
        note: "Self-reported on this file — amounts are shown only where captured.",
      }
    : null;

  const dscr = dscrValue(underwriting, diligence);
  const forecastStats: Kv[] = [];
  if (dscr) forecastStats.push({ label: "Debt service cover", value: dscr });
  if (company.creditsafeScore) forecastStats.push({ label: "Creditsafe", value: String(company.creditsafeScore) });
  if (outstanding.length) forecastStats.push({ label: "Outstanding charges", value: String(outstanding.length) });

  const RECOMMENDATION_LABELS: Record<string, string> = {
    approve: "Recommend Approval",
    approve_conditions: "Approve with Conditions",
    refer: "Refer to Credit Committee",
    decline: "Recommend Decline",
  };
  const recommendationKey = String(asRecord(underwriting.adviserSummary).recommendation || "");
  let recommendationOutcome = RECOMMENDATION_LABELS[recommendationKey] || "";
  let brokerRemarks = text(
    asRecord(asRecord(underwriting.adviserSummary).sections).recommendation,
    prospect.adviserRecommendation,
    recommendationOutcome ? "" : recommendationKey
  );
  let signedBy =
    prospect.adviserRecommendationSignedBy ||
    [data.user?.firstName, data.user?.lastName].filter(Boolean).join(" ");
  if (data.hideAdviserRecommendation) {
    recommendationOutcome = "";
    brokerRemarks = "";
    signedBy = "";
  }
  if (data.sterlingRecommendation?.trim()) {
    recommendationOutcome = "Sterling recommendation";
    brokerRemarks = data.sterlingRecommendation.trim();
    signedBy = data.sterlingSignedBy?.trim() || signedBy;
  }
  const signedAt = prospect.adviserRecommendationSignedAt ? formatDate(prospect.adviserRecommendationSignedAt) : "";

  const loanPurpose =
    firstPlain(
      asRecord(underwriting.adviserSummary).purpose,
      prospect.loanRequirementNotes,
      asRecord(prospect.loanRequirementData).notes
    ) || "Loan purpose has not been written up on this file yet.";
  const overview = text(asRecord(asRecord(underwriting.adviserSummary).sections).overview);
  const theBusiness =
    businessNarrative(overview) ||
    text(asRecord(asRecord(underwriting.adviserSummary).sections).background, prospect.background) ||
    "Business narrative has not been written up on this file yet.";

  const historicFromPayload = asRecord(financials.historic_pl);
  if (!historicPl && Array.isArray(historicFromPayload.lines) && historicFromPayload.lines.length) {
    const headers = ["", ...((historicFromPayload.columns as string[]) || [])];
    historicPl = {
      caption: String(historicFromPayload.title || "Historic Profit & Loss"),
      headers,
      rows: historicFromPayload.lines.map((line: any) => [String(line.label || ""), ...((line.values || []) as string[]).map((v) => num(v))]),
      note: String(historicFromPayload.basis || ""),
    };
  }

  const bank = asRecord(underwriting.financialAnalysis);
  const findings = asRecord(bank.preliminaryFindings);
  const months = Array.isArray(bank.monthlyBreakdown) ? bank.monthlyBreakdown : [];
  const latestMonth = months.length ? asRecord(months[months.length - 1]) : {};
  const flagItems = (Array.isArray(bank.redFlags) ? bank.redFlags : []).map(flagText).filter(Boolean);
  const classified = classifyFlags(flagItems);
  const accountConcerns = (Array.isArray(accounts.concerns) ? accounts.concerns : [])
    .map((item: unknown) => (typeof item === "string" ? item.trim() : String(asRecord(item).label || asRecord(item).text || "").trim()))
    .filter(Boolean);
  const cashflowRows: Kv[] = [];
  if (numberish(bank.averageMonthlyRevenue)) cashflowRows.push({ label: "Average monthly credits", value: money(bank.averageMonthlyRevenue) });
  if (numberish(bank.averageMonthlyExpenses)) cashflowRows.push({ label: "Average monthly debits", value: money(bank.averageMonthlyExpenses) });
  if (numberish(bank.netDisposableIncome)) cashflowRows.push({ label: "Net disposable income", value: money(bank.netDisposableIncome) });
  if (numberish(bank.dscr)) cashflowRows.push({ label: "Bank-statement DSCR", value: `${Number(bank.dscr).toFixed(2)}x` });
  if (numberish(latestMonth.closingBalance ?? latestMonth.balance)) {
    cashflowRows.push({
      label: `Latest closing balance${latestMonth.month ? ` (${latestMonth.month})` : ""}`,
      value: money(latestMonth.closingBalance ?? latestMonth.balance),
    });
  }
  if (numberish(latestMonth.net)) cashflowRows.push({ label: "Latest month net", value: money(latestMonth.net) });
  if (numberish(bank.transactionCount)) cashflowRows.push({ label: "Transactions analysed", value: String(bank.transactionCount) });
  if (numberish(bank.excludedTransferCount)) {
    cashflowRows.push({
      label: "Excluded transfers",
      value: `${bank.excludedTransferCount} totalling ${money(bank.excludedTransferValue)}`,
    });
  }

  return {
    borrower,
    tradingAs: trading && trading.toLowerCase() !== borrower.toLowerCase() ? trading : "",
    companyNumber: company.companyNumber || "",
    generated,
    generatedStamp,
    reference,
    logoDataUri: logoDataUri(),
    coverNote,
    facts,
    profileRows,
    riskGrade: grade,
    loanPurpose,
    theBusiness,
    businessFacts,
    group,
    groupNote: "",
    ownership,
    registerRows,
    riskIndicatorRows,
    chargesTable,
    backgroundNotes,
    riskSummary:
      text(swot.summary) ||
      (grade !== "—" ? `Risk grade ${grade} as currently recorded on this file.` : "Risk assessment not yet completed."),
    campariBlocks: CAMPARI_SECTIONS.map((section) => ({
      key: section.key,
      title: section.title,
      body: displayString(asRecord(asRecord(underwriting.adviserSummary).sections)[section.key]),
    })).filter((block) => block.body),
    strengths,
    weaknesses,
    opportunities,
    threats,
    fileFlags,
    cashflowRows,
    monthlyActivity: monthlyActivityTable(months),
    cashTrend: cashTrendFromMonths(months),
    bankCommentary: text(bank.summary, asRecord(asRecord(underwriting.adviserSummary).sections).bank),
    redFlagItems: classified.rest,
    concernItems: accountConcerns,
    loanRepayments: findingsTable("Suspected loan / MCA repayments", findings.loans),
    directDebits: findingsTable("Regular direct debits", findings.directDebits),
    bouncedPayments: findingsTable(
      "Bounced / returned payments",
      Array.isArray(findings.bouncedPayments) && findings.bouncedPayments.length
        ? findings.bouncedPayments
        : classified.bounced.map((label) => ({ description: label }))
    ),
    gamblingSpend: findingsTable(
      "Gambling / betting",
      Array.isArray(findings.gambling) && findings.gambling.length
        ? findings.gambling
        : classified.gambling.map((label) => ({ description: label }))
    ),
    personalUse: findingsTable(
      "Personal use of business account",
      Array.isArray(findings.personalUse) && findings.personalUse.length
        ? findings.personalUse
        : classified.personal.map((label) => ({ description: label }))
    ),
    bankAnomalies: findingsTable("Anomalies", findings.anomalies),
    historicPl,
    historicBs,
    accountsChart: chartFromFinTable(historicPl),
    historicNote: text(accounts.summary),
    dealIntro: "",
    sourcesUses: buildSourcesUses(prospect, String(loan.amount || "")),
    ttp,
    ttpNote: ttp ? "HMRC Time to Pay as recorded on this file." : "",
    dealNotes: "",
    purposeCommentary: firstPlain(
      asRecord(prospect.loanRequirementData).notes,
      prospect.loanRequirementNotes,
      asRecord(underwriting.adviserSummary).purpose
    ),
    securityRows: securityRows(prospect, asRecord(prospect.loanRequirementData)),
    useOfFunds: breakdownTable(
      "Use of funds",
      asRecord(asRecord(prospect.loanRequirementData).use_of_funds).breakdown
    ),
    allocations: breakdownTable("Allocations", prospect.loanAllocation),
    researchSections: researchSections(asRecord(prospect.researchData)),
    loanCalcRows: loanCalcRows(
      asRecord(diligence.loanCalculator),
      prospect,
      asRecord(prospect.loanRequirementData)
    ),
    forecastPl: null,
    forecastStats,
    forecastNote: "",
    futureStrategy: "",
    brokerRemarks,
    brokerSigned: (brokerRemarks || recommendationOutcome) && signedBy ? `${signedBy}${signedAt ? ` — ${signedAt}` : ""}` : "",
    recommendationOutcome,
    attachments: resolveAttachmentsChecklist(diligence.attachmentsChecklist),
  };
}

function isMarkdownEssay(value: string): boolean {
  return /(?:^|\n)\s*#{1,6}\s/.test(value) || /(?:^|\n)\s*\*\*.+\*\*\s*$/m.test(value);
}

function firstPlain(...parts: unknown[]): string {
  for (const part of parts) {
    const chunk = displayString(part);
    if (!chunk || isMarkdownEssay(chunk)) continue;
    return chunk;
  }
  return "";
}

function inlineMarkdown(value: string): string {
  return esc(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/\*\*/g, "")
    .replace(/__+/g, "")
    .replace(/(^|\s)#{1,6}\s+/g, "$1")
    .replace(/##+/g, "");
}

const CAMPARI_CHROME_HEADING =
  /^(CAMPARI(\s+(analysis|assessment))?(\s*[-:–—].*)?|[CAMPRI]\s*[–—-]\s*(Character|Ability|Means|Purpose|Amount|Repayment|Insurance)|(Character|Ability|Means|Purpose|Amount|Repayment|Insurance)(\s+analysis)?)$/i;
const CAMPARI_PILLAR_HEADING =
  /(?:^|\n)[ \t]*(?:#{1,3}[ \t]+|\*\*)?(?:CAMPARI(?:\s+(?:Analysis|Assessment))?\s*[-:–—]\s*)?(?:[CAMPRI]\s*[–—-]\s*)?(Character|Ability|Means|Purpose|Amount|Repayment|Insurance)\b[^\n]*/gi;
const MAX_CAMPARI_POINTS = 6;
const PILLAR_LABEL: Record<string, string> = {
  character: "Character",
  ability: "Ability",
  means: "Means",
  purpose: "Purpose",
  amount: "Amount",
  repayment: "Repayment",
  insurance: "Insurance",
};

function isCampariChromeHeading(title: string): boolean {
  const t = title.replace(/\*+/g, "").trim();
  if (!t) return true;
  if (CAMPARI_CHROME_HEADING.test(t)) return true;
  if (/\b(LIMITED|LTD|PLC)\b/i.test(t) && t === t.toUpperCase()) return true;
  return false;
}

function extractPillarSlice(raw: string, key: string): string {
  const label = PILLAR_LABEL[key];
  if (!label) return raw;
  const matches = [...raw.matchAll(CAMPARI_PILLAR_HEADING)];
  if (matches.length < 2) return raw;
  const mine = matches.find((match) => (match[1] || "").toLowerCase() === label.toLowerCase());
  if (!mine || mine.index == null) return raw;
  const start = mine.index + (/^\n/.test(mine[0]) ? 1 : 0);
  const next = matches[matches.indexOf(mine) + 1];
  const slice = raw.slice(start, next?.index ?? raw.length).trim();
  return slice || raw;
}

function splitCampariPoints(text: string): string[] {
  const prepared = text
    .replace(/\b(No|Mr|Mrs|Ms|Dr|Ltd|Co|e\.g|i\.e)\./gi, "$1\u2024")
    .replace(/(\d),(\d{3})/g, "$1\u2025$2");
  return prepared
    .split(/(?<=[.!?])\s+(?=[A-Z“"'‘])/)
    .map((part) => part.replace(/\u2024/g, ".").replace(/\u2025/g, ",").replace(/\s+/g, " ").trim())
    .filter((part) => part.length > 1);
}

function campariToProposalHtml(raw: string, pillarKey = "", seen = new Set<string>()): string {
  const cleaned = extractPillarSlice(displayString(raw).replace(/\r\n/g, "\n").trim(), pillarKey);
  if (!cleaned) return "";
  const html: string[] = [];
  let list: string[] = [];
  let count = 0;
  const flushList = () => {
    if (!list.length) return;
    html.push(
      `<ul class="campari-points">${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`
    );
    list = [];
  };
  const pushPoints = (value: string) => {
    for (const point of splitCampariPoints(value)) {
      if (count >= MAX_CAMPARI_POINTS) return;
      const norm = point.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (norm.length < 8 || seen.has(norm)) continue;
      seen.add(norm);
      list.push(point);
      count += 1;
    }
  };

  for (const line of cleaned.split("\n")) {
    if (count >= MAX_CAMPARI_POINTS) break;
    const trimmed = line.trim();
    if (!trimmed) continue;
    const heading = trimmed.match(/^(#{1,6})\s*(.*)$/) || trimmed.match(/^\*\*(.+?)\*\*\s*$/);
    if (heading) {
      const title = (heading[2] || heading[1] || "").replace(/\*+/g, "").trim();
      if (isCampariChromeHeading(title)) continue;
      flushList();
      html.push(`<div class="subhead">${inlineMarkdown(title)}</div>`);
      continue;
    }
    const bullet = trimmed.match(/^[-*]\s+(.*)$/) || trimmed.match(/^\d+[.)]\s+(.*)$/);
    pushPoints(bullet ? bullet[1] : trimmed);
  }
  flushList();
  return html.join("");
}

function markdownToProposalHtml(raw: string): string {
  const cleaned = displayString(raw).replace(/\r\n/g, "\n").trim();
  if (!cleaned) return "";

  const html: string[] = [];
  let list: string[] = [];
  const flushList = () => {
    if (!list.length) return;
    html.push(`<ul class="strengths">${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
    list = [];
  };

  for (const line of cleaned.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }
    const heading = trimmed.match(/^(#{1,6})\s*(.*)$/) || trimmed.match(/^\*\*(.+?)\*\*\s*$/);
    if (heading && (heading[0].startsWith("#") || /^\*\*.+\*\*$/.test(trimmed))) {
      const title = (heading[2] || heading[1] || "").replace(/\*+/g, "").trim();
      if (!title) continue;
      flushList();
      html.push(`<div class="subhead">${inlineMarkdown(title)}</div>`);
      continue;
    }
    const bullet = trimmed.match(/^[-*•]\s+(.*)$/) || trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (bullet) {
      list.push(bullet[1]);
      continue;
    }
    flushList();
    html.push(`<p class="body-text">${inlineMarkdown(trimmed)}</p>`);
  }
  flushList();
  return html.join("");
}

function businessNarrative(overview: string): string {
  const cut = overview
    .split(/Key facts a credit officer needs before CAMPARI/i)[0]
    .split(/\n(?=#{1,6}\s*Key Facts)/i)[0]
    .split(/\n+#+\s*CAMPARI/i)[0]
    .split(/\n+\*\*CAMPARI/i)[0];
  return cut.replace(/^#{1,6}\s*/gm, "").replace(/^Overview\s*/i, "").trim();
}

function paragraphs(value: string): string {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p class="body-text">${esc(line)}</p>`)
    .join("");
}

function bullets(items: string[], className: string): string {
  if (!items.length) return "";
  return `<ul class="${className}">${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
}

function kvTableHtml(caption: string, rows: Kv[]): string {
  if (!rows.length) return "";
  const cap = caption ? `<caption>${esc(caption)}</caption>` : "";
  return `<table class="kv">${cap}<tbody>${rows
    .map((row) => `<tr><th>${esc(row.label)}</th><td>${esc(row.value)}</td></tr>`)
    .join("")}</tbody></table>`;
}

function finTableHtml(table: FinTable): string {
  const caption = table.caption ? `<caption>${esc(table.caption)}</caption>` : "";
  const head = `<thead><tr>${table.headers.map((h, i) => `<th${i === 0 ? "" : ""}>${esc(h)}</th>`).join("")}</tr></thead>`;
  const body = `<tbody>${table.rows
    .map((row) => {
      const strong = /total|net assets|fixed assets/i.test(row[0] || "");
      return `<tr>${row
        .map((cell, i) => {
          const v = esc(cell);
          return `<td>${strong || i === 0 ? `<strong>${v}</strong>` : v}</td>`;
        })
        .join("")}</tr>`;
    })
    .join("")}</tbody>`;
  const note = table.note ? `<p class="fin-basis">${esc(table.note)}</p>` : "";
  const cls = table.className ? `fin ${table.className}` : "fin";
  return `<table class="${cls}">${caption}${head}${body}</table>${note}`;
}

function factTableHtml(facts: Kv[]): string {
  const rows: string[] = [];
  for (let i = 0; i < facts.length; i += 2) {
    const left = facts[i];
    const right = facts[i + 1];
    if (!right) {
      rows.push(
        `<tr><th>${esc(left.label)}</th><td colspan="3">${esc(left.value)}</td></tr>`
      );
    } else {
      rows.push(
        `<tr><th>${esc(left.label)}</th><td>${esc(left.value)}</td><th>${esc(right.label)}</th><td>${esc(right.value)}</td></tr>`
      );
    }
  }
  return `<table class="fact-table">${rows.join("")}</table>`;
}

function paper(
  header: string,
  body: string,
  page: number,
  total: number,
  stamp: string,
  reference: string,
  tag = ""
): string {
  return `<div class="paper">
      ${tag ? `<span class="page-tag">${esc(tag)}</span>` : ""}
      <div class="paper-header">
        <div class="running-name">${esc(header)}</div>
        <div class="stamp">${esc(stamp)}&nbsp;&nbsp;Ref ${esc(reference)}</div>
      </div>
      <div class="paper-body">${body}</div>
      <div class="paper-footer">
        <span class="footer-note">CONFIDENTIAL - Written by David Griffiths from Sterling Commercial Finance Limited</span>
        <span class="footer-page">${page} / ${total}</span>
      </div>
    </div>`;
}

const PROPOSAL_CSS = `
  :root {
    --paper: #FFFFFF; --ink: #1A1A1A; --muted: #595959; --navy: #1F3864;
    --border: #BFBFBF; --border-light: #D0D0D0; --zebra: #F7F7F7; --tag-fill: #F2F2F2;
    --danger: #8A2E0D; --tag-bg: #E8EEFD; --tag-ink: #2563EB;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: var(--ink);
    font-family: "Source Sans 3", "Segoe UI", Calibri, sans-serif; }
  .doc { display: block; }
  .paper { background: var(--paper); color: var(--ink); width: 100%;
    padding: 0; display: flex; flex-direction: column; position: relative;
    min-height: 255mm; break-after: page; page-break-after: always; }
  .paper:last-child { break-after: auto; page-break-after: auto; }
  .paper-header { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding-bottom: 10px; }
  .running-name { font-size: 9pt; color: #8B98A8; font-weight: 500; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .stamp { font-size: 8pt; color: var(--muted); font-weight: 400; letter-spacing: 0.02em; margin-left: auto; text-align: right; white-space: nowrap; }
  .paper-body { flex: 1; }
  .paper-footer { display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
    font-size: 8pt; color: var(--muted); padding-top: 10px; margin-top: auto; }
  .footer-note { min-width: 0; flex: 1; }
  .footer-page { margin-left: auto; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .page-tag { position: absolute; top: 0; right: 0; background: var(--tag-bg); color: var(--tag-ink);
    font-size: 9px; font-weight: 700; letter-spacing: 0.04em; padding: 3px 8px; border-radius: 999px; text-transform: uppercase; }
  .cover-title { font-size: 27px; font-weight: 700; color: var(--navy); margin: 28px 0 4px; letter-spacing: 0.02em; }
  .cover-name { font-size: 18px; font-weight: 700; margin: 0 0 10px; }
  .cover-note { font-size: 10pt; font-style: italic; color: var(--ink); margin: 0 0 16px; }
  .cover-logo { height: 42px; margin-bottom: 8px; }
  .cover-logo-slot { width: 130px; height: 32px; border: 1px dashed var(--border); border-radius: 3px;
    display: flex; align-items: center; justify-content: center; font-size: 8pt; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--muted); }
  table.fact-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  table.fact-table th, table.fact-table td { border: 1px solid var(--border); padding: 7px 9px; font-size: 9pt; width: 25%; text-align: left; }
  table.fact-table th { background: var(--tag-fill); font-weight: 700; }
  table.fact-table td { font-weight: 700; font-size: 11pt; }
  .navy-band { background: var(--navy); color: #fff; font-weight: 700; font-size: 16px; letter-spacing: 0.02em;
    text-transform: uppercase; padding: 6px 10px; margin: 0 0 8px; break-after: avoid; page-break-after: avoid; }
  .subhead { color: var(--navy); font-weight: 700; font-size: 11pt; margin: 10px 0 5px; break-after: avoid; }
  .body-text { font-size: 11pt; line-height: 1.45; margin: 0 0 6px; color: var(--ink); }
  .group-box { background: #F2F2F2; border-left: 3px solid var(--navy); padding: 9px 11px; margin: 6px 0 10px;
    font-size: 10pt; line-height: 1.5; }
  .ownership-box { border: 1px solid var(--border-light); font-size: 10pt; margin: 4px 0 10px; break-inside: avoid; }
  .ownership-box .hd { display: grid; grid-template-columns: 1.6fr 1.4fr 1fr; background: var(--navy); color: #fff; font-weight: 700; padding: 5px 9px; }
  .ownership-box .rw { display: grid; grid-template-columns: 1.6fr 1.4fr 1fr; padding: 5px 9px; border-top: 1px solid var(--border-light); }
  .ownership-box .rw span, .ownership-box .hd span { overflow-wrap: anywhere; min-width: 0; }
  .ownership-box.group-box-table .hd, .ownership-box.group-box-table .rw { grid-template-columns: 2fr 1.2fr; }
  .ownership-box .rw:nth-child(even) { background: var(--zebra); }
  .risk-tag { display: inline-block; font-weight: 700; font-size: 11pt; margin-bottom: 6px; }
  .risk-tag .grade { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px;
    padding: 0 6px; border-radius: 10px; background: var(--navy); color: #fff; font-size: 10.5px; margin-right: 5px; }
  ul.strengths, ul.risks { margin: 0 0 8px; padding-left: 16px; }
  ul.strengths li { font-size: 10.5pt; line-height: 1.4; margin-bottom: 3px; }
  ul.risks li { font-size: 10.5pt; line-height: 1.4; margin-bottom: 3px; color: var(--danger); }
  .swot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 8px 0 10px; break-inside: avoid; }
  .swot-cell { border: 1px solid var(--border-light); padding: 8px 10px; min-height: 72px; }
  .swot-cell .t { font-weight: 700; font-size: 10pt; margin-bottom: 4px; color: var(--navy); }
  .swot-cell ul { margin: 0; padding-left: 16px; }
  .swot-cell li { font-size: 9.5pt; line-height: 1.35; margin-bottom: 2px; color: var(--ink); }
  .swot-s { background: #F4F8F4; border-top: 3px solid #2F6B3A; }
  .swot-w { background: #FBF6F1; border-top: 3px solid #8A2E0D; }
  .swot-o { background: #F4F6FA; border-top: 3px solid var(--navy); }
  .swot-t { background: #F8F2F0; border-top: 3px solid #8A2E0D; }
  .swot-t li { color: var(--danger); }
  table.kv { width: 100%; border-collapse: collapse; margin: 4px 0 10px; font-size: 10pt; }
  table.kv th, table.kv td { border: 1px solid var(--border); padding: 5px 8px; text-align: left; vertical-align: top; }
  table.kv th { width: 32%; background: var(--tag-fill); font-weight: 700; color: var(--ink); }
  table.kv td { font-weight: 600; }
  table.kv tr:nth-child(even) td, table.kv tr:nth-child(even) th { background: var(--zebra); }
  table.kv tr:nth-child(even) th { background: #EFEFEF; }
  .navy-band, table.fin caption, table.fin th, .ownership-box .hd, .chart-caption {
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  table.fin { width: 100%; border-collapse: collapse; margin: 3px 0 8px; font-size: 8pt; break-inside: avoid; }
  table.fin caption { text-align: left; background: #1A1A1A; color: #fff; font-weight: 700; font-size: 8pt; padding: 5px 7px; caption-side: top; }
  table.fin th, table.fin td { border: 1px solid var(--border); padding: 3px 5px; }
  table.fin th { background: #1A1A1A; color: #fff; font-weight: 700; text-align: right; }
  table.fin th:first-child, table.fin td:first-child { text-align: left; }
  table.fin td { text-align: right; font-variant-numeric: tabular-nums; }
  table.fin.charges th:nth-child(2), table.fin.charges td:nth-child(2),
  table.fin.charges th:nth-child(3), table.fin.charges td:nth-child(3) { text-align: center; }
  .remarks-page { display: flex; flex-direction: column; min-height: 210mm; }
  .remarks-copy { flex: 1; }
  .sign-off { margin-top: auto; padding-top: 16px; }
  .sign-row { display: flex; align-items: flex-end; gap: 10px; margin-bottom: 14px; }
  .sign-label { width: 52px; font-size: 10pt; font-weight: 700; color: var(--navy); }
  .sign-line { flex: 1; border-bottom: 1px solid var(--ink); min-height: 18px; font-size: 10pt; padding-bottom: 2px; }
  .sign-firm { font-size: 9pt; color: var(--muted); margin: 8px 0 0; }
  table.fin tr:nth-child(even) td { background: var(--zebra); }
  .fin-basis { font-size: 8pt; font-style: italic; color: var(--muted); margin: -4px 0 8px; }
  .chart-wrap { margin: 4px 0 10px; break-inside: avoid; border: 1px solid var(--border); }
  .chart-caption { text-align: left; background: #1A1A1A; color: #fff; font-weight: 700; font-size: 8pt; padding: 5px 7px; }
  .accounts-chart { width: 100%; height: auto; display: block; background: #fff; }
  .stat-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 4px 0 10px; break-inside: avoid; }
  .stat-cell { border: 1px solid var(--border-light); padding: 7px 9px; }
  .stat-cell .l { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); }
  .stat-cell .v { font-size: 13pt; font-weight: 700; color: var(--navy); margin-top: 2px; }
  .empty-state { border: 1.5px dashed var(--border); border-radius: 6px; padding: 20px 16px; text-align: center; margin-top: 10px; }
  .empty-state .t { font-size: 12pt; font-weight: 700; color: var(--muted); margin-bottom: 4px; }
  .empty-state .d { font-size: 10pt; color: var(--muted); line-height: 1.5; max-width: 46ch; margin: 0 auto; }
  .campari-block { margin: 0 0 10px; }
  .campari-block .subhead { margin: 8px 0 4px; font-size: 10.5pt; }
  ul.campari-points { margin: 0 0 6px; padding-left: 16px; }
  ul.campari-points li { font-size: 10.5pt; line-height: 1.35; margin-bottom: 2px; }
  .muted { color: var(--muted); font-size: 9pt; }
  table.attach-list { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.attach-list td { border-bottom: 1px solid var(--border-light); padding: 7px 8px; font-size: 10pt; vertical-align: top; }
  table.attach-list td.mark { width: 28px; font-size: 13pt; line-height: 1; color: var(--navy); }
  table.attach-list td.status { width: 92px; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); text-align: right; }
  @page { size: A4; margin: 14mm 16mm 14mm 16mm; }
  @media print {
    html, body { background: #fff; }
    .paper { box-shadow: none; padding: 0; }
  }
`;

export function renderFundingProposalHtml(model: FundingProposalModel): string {
  const title = model.tradingAs ? `${model.borrower} (trading as ${model.tradingAs})` : model.borrower;
  const attachedCount = model.attachments.filter((item) => item.attached).length;
  const attachmentsBody = `<p class="body-text">Supporting documents confirmed on this file before submission to Sterling / the lender. ${attachedCount} of ${model.attachments.length} attached.</p>
       <table class="attach-list">
         ${model.attachments
           .map(
             (item) =>
               `<tr><td class="mark">${item.attached ? "☑" : "☐"}</td><td>${esc(item.label)}</td><td class="status">${item.attached ? "Attached" : "Not on file"}</td></tr>`
           )
           .join("")}
       </table>`;
  const currentFinancialHasData =
    model.cashflowRows.length ||
    model.monthlyActivity ||
    model.cashTrend ||
    model.bankCommentary ||
    model.redFlagItems.length ||
    model.concernItems.length ||
    model.loanRepayments ||
    model.directDebits ||
    model.bouncedPayments ||
    model.gamblingSpend ||
    model.personalUse ||
    model.bankAnomalies;
  const currentFinancialBody = currentFinancialHasData
    ? [
        model.bankCommentary ? markdownToProposalHtml(model.bankCommentary) : "",
        model.cashflowRows.length ? kvTableHtml("Immediate cash flow", model.cashflowRows) : "",
        model.cashTrend ? `<p class="body-text"><strong>Trend:</strong> ${esc(model.cashTrend)}</p>` : "",
        model.monthlyActivity ? finTableHtml(model.monthlyActivity) : "",
        model.directDebits ? finTableHtml(model.directDebits) : "",
        model.loanRepayments ? finTableHtml(model.loanRepayments) : "",
        model.bouncedPayments ? finTableHtml(model.bouncedPayments) : "",
        model.gamblingSpend ? finTableHtml(model.gamblingSpend) : "",
        model.personalUse ? finTableHtml(model.personalUse) : "",
        model.bankAnomalies ? finTableHtml(model.bankAnomalies) : "",
        model.redFlagItems.length
          ? `<div class="subhead">Red flags</div>${bullets(model.redFlagItems, "risks")}`
          : "",
        model.concernItems.length
          ? `<div class="subhead">Concerns</div>${bullets(model.concernItems, "risks")}`
          : "",
      ].join("")
    : `<div class="empty-state"><div class="t">Bank statements not yet analysed</div><div class="d">Upload and analyse statements on the company file. Activity, trends, direct debits, bounced items, suspected loan repayments, gambling and personal spend will appear here. Nothing is invented.</div></div>`;
  const total = 9;
  const logo = model.logoDataUri
    ? `<img class="cover-logo" src="${model.logoDataUri}" alt="Sterling Commercial Finance">`
    : `<div class="cover-logo-slot">Sterling Commercial Finance</div>`;

  const groupHtml = model.group.length
    ? `<div class="subhead">Group structure</div>
       <div class="ownership-box group-box-table">
         <div class="hd"><span>Entity</span><span>Status</span></div>
         ${model.group
           .map((entity) => `<div class="rw"><span>${esc(entity.name)}</span><span>${esc(entity.status)}</span></div>`)
           .join("")}
       </div>`
    : "";

  const ownershipHtml = model.ownership.length
    ? `<div class="subhead">Ownership</div>
       <div class="ownership-box">
         <div class="hd"><span>Shareholder / officer</span><span>Role</span><span>Status</span></div>
         ${model.ownership
           .map((row) => `<div class="rw"><span>${esc(row.name)}</span><span>${esc(row.role)}</span><span>${esc(row.status)}</span></div>`)
           .join("")}
       </div>`
    : "";

  const hasSwot = model.strengths.length || model.weaknesses.length || model.opportunities.length || model.threats.length;
  const swotCell = (title: string, items: string[], cls: string) =>
    `<div class="swot-cell ${cls}"><div class="t">${esc(title)}</div>${
      items.length ? bullets(items, cls === "swot-t" ? "risks" : "strengths") : `<p class="muted">None recorded.</p>`
    }</div>`;
  const swotHtml = hasSwot
    ? `<div class="subhead">SWOT analysis</div>
       <div class="swot-grid">
         ${swotCell("Strengths", model.strengths, "swot-s")}
         ${swotCell("Weaknesses", model.weaknesses, "swot-w")}
         ${swotCell("Opportunities", model.opportunities, "swot-o")}
         ${swotCell("Threats", model.threats, "swot-t")}
       </div>`
    : `<div class="empty-state"><div class="t">SWOT not yet written in Credit Studio</div><div class="d">Generate the SWOT on the company file and it will copy onto this page. Nothing is invented to fill the quadrants.</div></div>`;
  const fileFlagsHtml = model.fileFlags.length
    ? `<div class="subhead">File flags</div>${bullets(model.fileFlags, "risks")}`
    : "";

  const historicBody = [
    model.accountsChart ? accountsChartSvg(model.accountsChart) : "",
    model.historicPl ? finTableHtml(model.historicPl) : "",
    model.historicBs ? finTableHtml(model.historicBs) : "",
    model.historicNote ? markdownToProposalHtml(model.historicNote) : "",
    !model.historicPl && !model.historicBs
      ? `<div class="empty-state"><div class="t">Historic financials not yet on file</div><div class="d">Upload or analyse statutory accounts on the company file and they will appear here. Nothing is invented to fill the table.</div></div>`
      : "",
  ].join("");

  const researchHtml = model.researchSections.length
    ? model.researchSections.map((section) => kvTableHtml(section.title, section.rows)).join("")
    : `<div class="empty-state"><div class="t">Research Hub not yet completed</div><div class="d">Asset, ledger or property research saved on the file will appear here. Nothing is invented.</div></div>`;
  const dealBody = [
    `<div class="subhead">Purpose of loan</div>`,
    model.purposeCommentary
      ? markdownToProposalHtml(model.purposeCommentary)
      : `<p class="muted">Purpose commentary has not been written up on this file yet.</p>`,
    `<div class="subhead">Security offered</div>`,
    model.securityRows.length
      ? kvTableHtml("", model.securityRows)
      : `<p class="muted">No security details captured.</p>`,
    `<div class="subhead">Use of funds</div>`,
    model.useOfFunds
      ? finTableHtml(model.useOfFunds)
      : `<p class="muted">Use of funds has not been allocated on this file yet.</p>`,
    `<div class="subhead">Allocations</div>`,
    model.allocations
      ? finTableHtml(model.allocations)
      : `<p class="muted">No loan allocations recorded.</p>`,
    `<div class="subhead">Research Hub</div>`,
    researchHtml,
    `<div class="subhead">Loan calculation</div>`,
    model.loanCalcRows.length
      ? kvTableHtml("", model.loanCalcRows)
      : `<p class="muted">Loan calculator has not been saved on this file yet.</p>`,
    model.sourcesUses ? finTableHtml(model.sourcesUses) : "",
    model.ttp ? finTableHtml(model.ttp) : "",
    model.dealNotes ? markdownToProposalHtml(model.dealNotes) : "",
  ].join("");

  const forecastBody = [
    model.forecastPl ? finTableHtml(model.forecastPl) : "",
    model.forecastStats.length
      ? `<div class="stat-row">${model.forecastStats
          .map((s) => `<div class="stat-cell"><div class="l">${esc(s.label)}</div><div class="v">${esc(s.value)}</div></div>`)
          .join("")}</div>`
      : "",
    model.forecastNote ? `<p class="fin-basis">${esc(model.forecastNote)}</p>` : "",
    model.futureStrategy
      ? `<div class="subhead">FUTURE STRATEGY</div>${markdownToProposalHtml(model.futureStrategy)}`
      : "",
    !model.forecastPl
      ? `<div class="empty-state"><div class="t">Forecasts not yet modelled</div><div class="d">A 24-month cash flow / CFADS model will sit here once it has been built on this file. Figures are not projected automatically.</div></div>`
      : "",
  ].join("");

  const remarksCopy =
    model.recommendationOutcome || model.brokerRemarks
      ? [
          model.recommendationOutcome
            ? `<p class="body-text"><strong>Recommendation:</strong> ${esc(model.recommendationOutcome)}</p>`
            : "",
          model.brokerRemarks ? markdownToProposalHtml(model.brokerRemarks) : "",
        ].join("")
      : `<div class="empty-state"><div class="t">Awaiting recommendation</div><div class="d">David writes the recommendation in the Sterling portal. It is not stored in Credit Studio.</div></div>`;
  const signName = model.brokerSigned ? esc(model.brokerSigned.split(" — ")[0] || model.brokerSigned) : "";
  const signDate = model.brokerSigned && model.brokerSigned.includes(" — ")
    ? esc(model.brokerSigned.split(" — ").slice(1).join(" — "))
    : "";
  const remarksBody = `<div class="remarks-page">
       <div class="remarks-copy">${remarksCopy}</div>
       <div class="sign-off">
         <div class="sign-row"><span class="sign-label">Signed</span><span class="sign-line">${signName || "&nbsp;"}</span></div>
         <div class="sign-row"><span class="sign-label">Date</span><span class="sign-line">${signDate || "&nbsp;"}</span></div>
         <p class="sign-firm">For and on behalf of Sterling Commercial Finance</p>
       </div>
     </div>`;

  const page = (body: string, n: number) =>
    paper(model.borrower, body, n, total, model.generatedStamp, model.reference);

  const pages = [
    page(
      `${logo}
       <div class="cover-title">FUNDING PROPOSAL</div>
       <div class="cover-name">${esc(title)}</div>
       ${factTableHtml(model.facts)}
       <div class="subhead">Company Profile</div>
       ${model.profileRows.length ? kvTableHtml("", model.profileRows) : `<p class="muted">Company profile has not been captured on this file yet.</p>`}
       <div class="subhead">Background</div>
       ${model.backgroundNotes ? markdownToProposalHtml(model.backgroundNotes) : `<p class="muted">Background has not been written up on this file yet.</p>`}`,
      1
    ),
    page(
      `<div class="navy-band">1.&nbsp;&nbsp;Loan amount and purpose</div>
       ${markdownToProposalHtml(model.loanPurpose)}
       <div class="navy-band">2.&nbsp;&nbsp;The business</div>
       ${markdownToProposalHtml(model.theBusiness)}
       ${model.businessFacts ? `<div class="group-box">${inlineMarkdown(model.businessFacts)}</div>` : ""}
       ${groupHtml}
       ${model.groupNote ? `<div class="group-box">${inlineMarkdown(model.groupNote)}</div>` : ""}
       ${ownershipHtml}
       ${kvTableHtml("Companies House", model.registerRows)}
       ${kvTableHtml("Risk indicators", model.riskIndicatorRows)}
       ${model.chargesTable ? finTableHtml(model.chargesTable) : `<p class="fin-basis">No charges registered.</p>`}
       <div class="subhead">Background &amp; Notes</div>
       ${model.backgroundNotes ? markdownToProposalHtml(model.backgroundNotes) : `<p class="body-text">None recorded on this file.</p>`}`,
      2
    ),
    page(
      `<div class="navy-band">3.&nbsp;&nbsp;Risk assessment</div>
       <div class="risk-tag"><span class="grade">${esc(model.riskGrade)}</span>Risk grade: ${esc(model.riskGrade)}</div>
       ${markdownToProposalHtml(model.riskSummary)}
       ${
         model.campariBlocks.length
           ? `<div class="subhead">CAMPARI</div>${(() => {
               const seen = new Set<string>();
               return model.campariBlocks
                 .map(
                   (block) =>
                     `<div class="campari-block"><div class="subhead">${esc(block.title)}</div>${campariToProposalHtml(block.body, block.key, seen)}</div>`
                 )
                 .join("");
             })()}`
           : `<div class="empty-state"><div class="t">CAMPARI not yet written in Credit Studio</div><div class="d">Auto Write Character through Insurance on the Summary page and it will copy onto this risk assessment. Nothing is invented to fill the pillars.</div></div>`
       }
       ${swotHtml}
       ${fileFlagsHtml}`,
      3
    ),
    page(
      `<div class="navy-band">4.&nbsp;&nbsp;Current financial situation</div>${currentFinancialBody}`,
      4
    ),
    page(
      `<div class="navy-band">5.&nbsp;&nbsp;Historic financial information</div>${historicBody}`,
      5
    ),
    page(
      `<div class="navy-band">6.&nbsp;&nbsp;Deal summary</div>${dealBody}`,
      6
    ),
    page(`<div class="navy-band">7.&nbsp;&nbsp;Financial forecasts</div>${forecastBody}`, 7),
    page(`<div class="navy-band">8.&nbsp;&nbsp;Recommendation</div>${remarksBody}`, 8),
    page(`<div class="navy-band">9.&nbsp;&nbsp;Attachments checklist</div>${attachmentsBody}`, 9),
  ];

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(model.borrower)} — Funding Proposal</title>
<style>${PROPOSAL_CSS}</style>
</head>
<body>
<div class="doc">
${pages.join("\n")}
</div>
</body>
</html>`;
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const chrome = findChromium();
  if (!chrome) {
    throw new Error("Chrome/Edge not found — cannot print the funding proposal to PDF");
  }
  const dir = await mkdtemp(join(tmpdir(), "nexus-proposal-"));
  const htmlPath = join(dir, "proposal.html");
  const pdfPath = join(dir, "proposal.pdf");
  const profileDir = join(dir, "profile");
  try {
    await writeFile(htmlPath, html, "utf8");
    const args = [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-background-networking",
      "--hide-scrollbars",
      "--no-pdf-header-footer",
      `--user-data-dir=${profileDir}`,
      `--print-to-pdf=${pdfPath}`,
      "--virtual-time-budget=8000",
      pathToFileURL(htmlPath).href,
    ];
    await new Promise<void>((resolve, reject) => {
      const child = spawn(chrome, args, { windowsHide: true, stdio: "pipe" });
      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error("PDF print timed out"));
      }, 45000);
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`Chrome print failed (${code}): ${stderr.slice(0, 400)}`));
      });
    });
    const pdf = await readFile(pdfPath);
    if (pdf.subarray(0, 4).toString() !== "%PDF") {
      throw new Error("Chrome did not produce a PDF");
    }
    return pdf;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function renderFundingProposalHtmlFromData(data: FundingProposalInput): string {
  return renderFundingProposalHtml(buildFundingProposal(data));
}

export async function renderFundingProposalPdf(data: FundingProposalInput): Promise<Buffer> {
  return htmlToPdf(renderFundingProposalHtmlFromData(data));
}
