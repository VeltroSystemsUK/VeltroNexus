export function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(
    Math.round(value || 0),
  );
}

export type TtpInput = {
  arrears: number;
  periodMonths: number;
  includeInterest: boolean;
  annualRatePercent: number;
};

export type TtpResult = {
  monthlyInstalment: number;
  totalRepayable: number;
  totalInterest: number;
};

export function calculateTtp(input: TtpInput): TtpResult {
  const arrears = Math.max(0, input.arrears || 0);
  const months = Math.min(12, Math.max(1, Math.round(input.periodMonths || 12)));
  const rate = input.includeInterest ? Math.max(0, input.annualRatePercent || 0) / 100 : 0;
  const totalInterest = arrears * rate * (months / 12);
  const totalRepayable = arrears + totalInterest;
  const monthlyInstalment = totalRepayable / months;
  return { monthlyInstalment, totalRepayable, totalInterest };
}

export const DEBT_FREQUENCIES = ["daily", "weekly", "monthly"] as const;
export type DebtFrequency = (typeof DEBT_FREQUENCIES)[number];

export type DebtRow = {
  id: string;
  label: string;
  balance: number;
  repaymentAmount: number;
  frequency: DebtFrequency;
};

export type Outgoings = {
  payroll: number;
  rent: number;
  hmrcVat: number;
  suppliers: number;
  other: number;
};

export type DebtStressInput = {
  monthlyIncome: number;
  outgoings: Outgoings;
  debts: DebtRow[];
  cashOnHand?: number;
};

export type DebtStressResult = {
  totalOutstandingDebt: number;
  totalMonthlyDebtService: number;
  totalMonthlyOutgoings: number;
  netMonthlyPosition: number;
  debtServiceRatio: number;
  costPerTradingDay: number;
  stackedFacilityCount: number;
  isStacking: boolean;
  runwayMonths: number | null;
};

const DAYS_PER_MONTH = 30;
const WEEKS_PER_MONTH = 52 / 12;

export function monthlyFromFrequency(amount: number, frequency: DebtFrequency): number {
  const value = Math.max(0, amount || 0);
  if (frequency === "daily") return value * DAYS_PER_MONTH;
  if (frequency === "weekly") return value * WEEKS_PER_MONTH;
  return value;
}

export function emptyOutgoings(): Outgoings {
  return { payroll: 0, rent: 0, hmrcVat: 0, suppliers: 0, other: 0 };
}

export function calculateDebtStress(input: DebtStressInput): DebtStressResult {
  const income = Math.max(0, input.monthlyIncome || 0);
  const o = input.outgoings;
  const outgoingsTotal =
    Math.max(0, o.payroll || 0) +
    Math.max(0, o.rent || 0) +
    Math.max(0, o.hmrcVat || 0) +
    Math.max(0, o.suppliers || 0) +
    Math.max(0, o.other || 0);
  const debts = input.debts || [];
  const totalOutstandingDebt = debts.reduce((sum, d) => sum + Math.max(0, d.balance || 0), 0);
  const totalMonthlyDebtService = debts.reduce(
    (sum, d) => sum + monthlyFromFrequency(d.repaymentAmount, d.frequency),
    0,
  );
  const totalMonthlyOutgoings = outgoingsTotal + totalMonthlyDebtService;
  const netMonthlyPosition = income - totalMonthlyOutgoings;
  const debtServiceRatio = income > 0 ? totalMonthlyDebtService / income : 0;
  const costPerTradingDay = totalMonthlyDebtService / DAYS_PER_MONTH;
  const stackedFacilityCount = debts.filter((d) => d.frequency === "daily" || d.frequency === "weekly").length;
  const isStacking = stackedFacilityCount >= 2;
  const cashOnHand = Math.max(0, input.cashOnHand || 0);
  const runwayMonths = netMonthlyPosition < 0 && cashOnHand > 0 ? cashOnHand / Math.abs(netMonthlyPosition) : null;
  return {
    totalOutstandingDebt,
    totalMonthlyDebtService,
    totalMonthlyOutgoings,
    netMonthlyPosition,
    debtServiceRatio,
    costPerTradingDay,
    stackedFacilityCount,
    isStacking,
    runwayMonths,
  };
}

export const TOOL_IDS = ["ttp-calculator", "debt-stress-check"] as const;
export type ToolId = (typeof TOOL_IDS)[number];

export const TOOL_LABELS: Record<ToolId, string> = {
  "ttp-calculator": "Time to Pay Calculator",
  "debt-stress-check": "Debt Stress Check",
};

export type ToolEmailRequestInput = {
  name?: string;
  email?: string;
  tool?: string;
  marketingOptIn?: boolean;
};

export function isToolId(value: unknown): value is ToolId {
  return typeof value === "string" && (TOOL_IDS as readonly string[]).includes(value);
}

export function validateToolEmailRequest(
  input: ToolEmailRequestInput,
):
  | { ok: true; name: string; email: string; tool: ToolId; marketingOptIn: boolean }
  | { ok: false; error: string } {
  const name = String(input.name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  if (name.length < 2 || name.length > 80) return { ok: false, error: "Name must be 2 to 80 characters." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "A real email is required." };
  if (!isToolId(input.tool)) return { ok: false, error: "Unknown tool." };
  return { ok: true, name, email, tool: input.tool, marketingOptIn: input.marketingOptIn === true };
}

export function ttpEmailHtml(name: string, input: TtpInput, result: TtpResult): string {
  return `<p>Hi ${name},</p>
<p>Here is the estimate from the Time to Pay Calculator on Strata Learn.</p>
<ul>
<li>Arrears: ${formatGBP(input.arrears)}</li>
<li>Period: ${Math.round(input.periodMonths)} months</li>
<li>Estimated monthly instalment: ${formatGBP(result.monthlyInstalment)}</li>
<li>Total repayable: ${formatGBP(result.totalRepayable)}</li>
${input.includeInterest ? `<li>Estimated interest included: ${formatGBP(result.totalInterest)}</li>` : ""}
</ul>
<p>This is an indicative estimate only, not a Time to Pay offer or a lending decision. Confirm the actual arrangement with HMRC's Business Payment Support Service. Strata Finance packages Time to Pay applications; we do not lend.</p>`;
}

export function debtStressEmailHtml(name: string, result: DebtStressResult): string {
  return `<p>Hi ${name},</p>
<p>Here is the breakdown from the Debt Stress Check on Strata Learn.</p>
<ul>
<li>Total outstanding debt: ${formatGBP(result.totalOutstandingDebt)}</li>
<li>Combined monthly debt repayments: ${formatGBP(result.totalMonthlyDebtService)}</li>
<li>Cost per trading day: ${formatGBP(result.costPerTradingDay)}</li>
<li>Net monthly position: ${formatGBP(result.netMonthlyPosition)}</li>
${result.runwayMonths != null ? `<li>Cash runway at this rate: ${result.runwayMonths.toFixed(1)} months</li>` : ""}
</ul>
<p>${result.isStacking ? "You have two or more facilities pulling from the same daily or weekly cash — this is what we mean by stacking." : "This is an indicative snapshot of your current position."} This is not financial advice. Strata Finance packages UK SME distress-refinance files; we do not lend.</p>`;
}
