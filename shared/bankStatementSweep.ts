import {
  isInstalmentFinance,
  mcaProductFor,
  minMonthly,
  parseMcaMinsFromText,
  parseMcaRatesFromText,
  resolveMcaMin,
  resolveMcaRate,
  salesSplitTake,
  splitHoldback,
  MCA_PRODUCTS,
  type McaMin,
} from "./mcaSplit";

export type SweepKind =
  | "bounced"
  | "loan"
  | "mca"
  | "hmrc"
  | "gambling"
  | "cash"
  | "overdraft"
  | "personal"
  | "anomaly";

export type SweepSeverity = "high" | "medium" | "low";

export type SweepFinding = {
  kind: SweepKind;
  severity: SweepSeverity;
  description: string;
  amount?: number;
  evidence: string;
};

const MCA =
  /iwoca|youlend|capify|liberis|1plus1|365 finance|merchant cash|mca\b|fleximize|funding circle|boost capital|shopify capital|paypal funding|paypal payment|wayflyer|uncapped|\brevenu\b|stripe capital|square capital|amazon (?:lending|capital)|rapid finance|merchant money|bizcap|headway capital|kriya|everline|capalona/i;
const LOAN = /\b(loan|finance repay|hp repayment|lease repay|amortisation|amortization)\b|personal loans|nbs personal|capital on tap|\bmbna\b|barclaycard|american express|\bamex\b/i;
const HMRC = /\bhmrc\b|\bvat\b|\bpaye\b|\bnic\b|time to pay|corporation tax/i;
const GAMBLING = /william hill|betfair|sky bet|paddy power|ladbrokes|bet365|coral|gambling|betting/i;
const CASH = /\b(atm|cash (out|withdrawal)|counter cash)\b/i;
const OVERDRAFT = /\b(od int|overdraft|unauthorised|unauthorized|excess overdraft)\b/i;
const BOUNCED = /unpaid|refer to payer|returned item|insufficient funds|bounced|dd unpaid|payment returned/i;
const PERSONAL = /\b(tfr|transfer).{0,40}\b(bevan|director|personal|drawings)\b/i;

function parseAmount(line: string): number | undefined {
  const matches = [...line.matchAll(/£?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+\.[0-9]{2})/g)];
  if (!matches.length) return undefined;
  const last = matches[matches.length - 1][1].replace(/,/g, "");
  const value = Number(last);
  return Number.isFinite(value) ? value : undefined;
}

function push(
  out: SweepFinding[],
  seen: Set<string>,
  finding: SweepFinding
) {
  const key = `${finding.kind}|${finding.evidence.slice(0, 80)}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push(finding);
}

export function sweepBankStatementText(text: string): SweepFinding[] {
  const findings: SweepFinding[] = [];
  const seen = new Set<string>();
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const amount = parseAmount(line);
    const evidence = line.slice(0, 180);

    if (BOUNCED.test(line)) {
      push(findings, seen, {
        kind: "bounced",
        severity: "high",
        description: "Bounced or returned payment",
        amount,
        evidence,
      });
    }
    if (MCA.test(line)) {
      push(findings, seen, {
        kind: "mca",
        severity: "high",
        description: "Short-term / MCA-style repayment",
        amount,
        evidence,
      });
    } else if (LOAN.test(line)) {
      push(findings, seen, {
        kind: "loan",
        severity: "medium",
        description: "Loan or finance repayment",
        amount,
        evidence,
      });
    }
    if (HMRC.test(line) && !/vat number/i.test(line)) {
      push(findings, seen, {
        kind: "hmrc",
        severity: /time to pay|unpaid/i.test(line) ? "high" : "medium",
        description: "HMRC / tax payment",
        amount,
        evidence,
      });
    }
    if (GAMBLING.test(line)) {
      push(findings, seen, {
        kind: "gambling",
        severity: "high",
        description: "Gambling or betting spend on the business account",
        amount,
        evidence,
      });
    }
    if (CASH.test(line)) {
      push(findings, seen, {
        kind: "cash",
        severity: "medium",
        description: "Cash withdrawal",
        amount,
        evidence,
      });
    }
    if (OVERDRAFT.test(line)) {
      push(findings, seen, {
        kind: "overdraft",
        severity: /unauthori[sz]ed|excess/i.test(line) ? "high" : "medium",
        description: "Overdraft interest or excess",
        amount,
        evidence,
      });
    }
    if (PERSONAL.test(line)) {
      push(findings, seen, {
        kind: "personal",
        severity: "medium",
        description: "Possible personal drawing / director transfer",
        amount,
        evidence,
      });
    }
  }

  return findings;
}

export function summariseSweep(findings: SweepFinding[]): string {
  if (!findings.length) return "No bounced items, stacked short-term finance, gambling, or overdraft excess spotted in the statement text.";
  const high = findings.filter((f) => f.severity === "high").length;
  const kinds = [...new Set(findings.map((f) => f.kind))];
  return `${findings.length} affordability flags (${high} high). Categories: ${kinds.join(", ")}.`;
}

export type StatementMonth = {
  label: string;
  from: string;
  to: string;
  moneyIn: number;
  moneyOut: number;
  opening: number;
  closing: number;
  net: number;
};

export type StatementLender = {
  name: string;
  kind: "mca" | "loan";
  moneyOut: number;
  moneyIn: number;
  count: number;
  monthly: number;
  splitRate?: number;
  minMonthly?: number;
};

export type BankStatementAnalysis = {
  months: StatementMonth[];
  totals: {
    moneyIn: number;
    moneyOut: number;
    net: number;
    months: number;
    avgIn: number;
    avgOut: number;
    avgNet: number;
  };
  lenders: StatementLender[];
  financeMonthly: number;
  operatingOutMonthly: number;
  cashForDebt: number;
  proposedMonthly: number;
  dscrCurrent: number;
  dscrRefinance: number;
  monthlySaving: number;
  headroomNow: number;
  headroomAfter: number;
  findings: SweepFinding[];
  summary: string;
};

function parseSignedMoney(raw: string | undefined): number {
  const value = String(raw || "").trim();
  if (!value || /^blank\.?$/i.test(value)) return 0;
  const negative = /^-|-\s*£/.test(value);
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d{1,2})?/);
  const n = match ? Number(match[0].replace("-", "")) : NaN;
  if (!Number.isFinite(n)) return 0;
  return negative ? -n : n;
}

function classifyLender(description: string): "mca" | "loan" | null {
  if (MCA.test(description)) return "mca";
  if (LOAN.test(description)) return "loan";
  return null;
}

function monthKeyFromDate(date: string): string {
  const match = String(date || "").match(/(\d{1,2})\s+([A-Z][a-z]{2})\s+(\d{2})/);
  if (!match) return "";
  const months: Record<string, string> = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };
  const mm = months[match[2]];
  if (!mm) return "";
  return `20${match[3]}-${mm}`;
}

function periodDays(month: StatementMonth): number {
  const from = Date.parse(month.from);
  const to = Date.parse(month.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 0;
  return Math.round((to - from) / 86400000) + 1;
}

function isCompleteMonth(month: StatementMonth): boolean {
  return periodDays(month) >= 27;
}

function kpiMonths(months: StatementMonth[]): StatementMonth[] {
  const complete = months.filter(isCompleteMonth);
  return complete.length ? complete : months;
}

function latestMonthKey(months: StatementMonth[]): string {
  const pool = kpiMonths(months);
  if (!pool.length) return "";
  const from = Date.parse(pool[pool.length - 1].from);
  if (!Number.isFinite(from)) return "";
  const dt = new Date(from);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function monthlyFromPayments(payments: { monthKey: string; moneyOut: number }[], latestKey: string): number {
  const byMonth = new Map<string, number>();
  for (const payment of payments) {
    if (!payment.monthKey) continue;
    byMonth.set(payment.monthKey, Math.round(((byMonth.get(payment.monthKey) || 0) + payment.moneyOut) * 100) / 100);
  }
  if (latestKey) return byMonth.get(latestKey) || 0;
  const keys = [...byMonth.keys()].sort();
  if (!keys.length) return 0;
  return byMonth.get(keys[keys.length - 1]) || 0;
}

function tidyName(description: string): string {
  return description
    .split("\n")[0]
    .replace(/\s+/g, " ")
    .replace(/\.$/, "")
    .trim()
    .slice(0, 48);
}

function brandName(name: string): string {
  const product = mcaProductFor(name);
  if (product) return product.brand;
  if (/funding circle/i.test(name)) return "Funding Circle";
  if (/iwoca/i.test(name)) return "Iwoca";
  if (/nbs personal/i.test(name)) return "NBS Personal Loans";
  if (/capital on tap/i.test(name)) return "Capital on Tap";
  if (/paypal payment/i.test(name)) return "PayPal Credit";
  if (/\bmbna\b/i.test(name)) return "MBNA";
  if (/barclaycard/i.test(name)) return "Barclaycard";
  if (/american express|\bamex\b/i.test(name)) return "American Express";
  if (/^loan -/i.test(name)) return name.replace(/\s+/g, " ").slice(0, 28);
  return name;
}

function isWebsiteSale(description: string): boolean {
  if (/shopify capital/i.test(description)) return false;
  return /stripe payments uk shopify|\bshopify\b/i.test(description);
}

function isEbaySale(description: string): boolean {
  return /\bebay\b/i.test(description);
}

function isPaypalSale(description: string): boolean {
  if (/paypal payment|paypal funding|paypal \*/i.test(description)) return false;
  return /\bpaypal\b/i.test(description);
}

type LenderPayment = { monthKey: string; moneyOut: number; moneyIn: number };
type LenderAcc = StatementLender & { payments: LenderPayment[] };

function channelTake(
  channel: "own-remittance" | "website-ebay" | "paypal" | undefined,
  rate: number | null,
  sales: { website: number; ebay: number; paypal: number },
  remittance: number,
): number {
  if (rate == null) return 0;
  if (channel === "website-ebay") return salesSplitTake(sales.website + sales.ebay, rate);
  if (channel === "paypal") return salesSplitTake(sales.paypal, rate);
  return splitHoldback(remittance, rate);
}

function collapseLenders(
  list: LenderAcc[],
  latestKey: string,
  rates: Record<string, number>,
  mins: Record<string, McaMin>,
  sales: { website: number; ebay: number; paypal: number },
): StatementLender[] {
  const grouped = new Map<string, LenderAcc>();
  for (const lender of list) {
    const name = brandName(lender.name);
    const current = grouped.get(name) || {
      name,
      kind: lender.kind,
      moneyOut: 0,
      moneyIn: 0,
      count: 0,
      monthly: 0,
      payments: [],
    };
    current.moneyOut = Math.round((current.moneyOut + lender.moneyOut) * 100) / 100;
    current.moneyIn = Math.round((current.moneyIn + lender.moneyIn) * 100) / 100;
    current.count += lender.count;
    current.payments.push(...lender.payments);
    grouped.set(name, current);
  }
  const lenders = [...grouped.values()].map((lender) =>
    finaliseMcaLender(lender, latestKey, rates, mins, sales),
  );
  for (const product of MCA_PRODUCTS) {
    if (lenders.some((lender) => product.match.test(lender.name))) continue;
    const rate = rates[product.brand];
    const min = resolveMcaMin(product.brand, mins, rate != null);
    const floor = minMonthly(min);
    const take = channelTake(product.channel, rate ?? null, sales, 0);
    const monthly = Math.max(take, floor);
    if (!(monthly > 0)) continue;
    lenders.push({
      name: product.brand,
      kind: "mca",
      moneyOut: 0,
      moneyIn: 0,
      count: 0,
      monthly,
      ...(rate != null ? { splitRate: rate } : {}),
      ...(floor > 0 ? { minMonthly: floor } : {}),
    });
  }
  return lenders;
}

function finaliseMcaLender(
  lender: LenderAcc,
  latestKey: string,
  rates: Record<string, number>,
  mins: Record<string, McaMin>,
  sales: { website: number; ebay: number; paypal: number },
): StatementLender {
  const debit = monthlyFromPayments(lender.payments, latestKey);
  if (isInstalmentFinance(lender.name)) {
    return {
      name: lender.name,
      kind: lender.kind,
      moneyOut: lender.moneyOut,
      moneyIn: lender.moneyIn,
      count: lender.count,
      monthly: debit,
    };
  }
  const product = mcaProductFor(lender.name);
  const rate = resolveMcaRate(lender.name, rates);
  const onSchedule = Boolean(product && (rates[product.brand] != null || mins[product.brand] != null));
  const floor = minMonthly(resolveMcaMin(lender.name, mins, onSchedule));
  const take = channelTake(
    product?.channel,
    rate,
    sales,
    monthlyInFromPayments(lender.payments, latestKey),
  );
  const monthly = Math.max(debit, take, floor);
  return {
    name: lender.name,
    kind: lender.kind,
    moneyOut: lender.moneyOut,
    moneyIn: lender.moneyIn,
    count: lender.count,
    monthly,
    ...(rate != null && (take > 0 || floor > 0) ? { splitRate: rate } : {}),
    ...(floor > 0 ? { minMonthly: floor } : {}),
  };
}

function monthlyInFromPayments(payments: LenderPayment[], latestKey: string): number {
  const byMonth = new Map<string, number>();
  for (const payment of payments) {
    if (!payment.monthKey || !(payment.moneyIn > 0)) continue;
    byMonth.set(payment.monthKey, Math.round(((byMonth.get(payment.monthKey) || 0) + payment.moneyIn) * 100) / 100);
  }
  if (latestKey) return byMonth.get(latestKey) || 0;
  const keys = [...byMonth.keys()].sort();
  if (!keys.length) return 0;
  return byMonth.get(keys[keys.length - 1]) || 0;
}

function ratio(cash: number, debt: number): number {
  if (!(debt > 0)) return cash > 0 ? 99 : 0;
  return cash / debt;
}

export function analyseBankStatements(
  text: string,
  opts: { proposedMonthly?: number; rateText?: string } = {}
): BankStatementAnalysis {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const months: StatementMonth[] = [];
  for (let i = 0; i < lines.length; i++) {
    const period = lines[i].match(
      /BUSINESS ACCOUNT\.\s*(\d{1,2} \w+ \d{4})\s+to\s+(\d{1,2} \w+ \d{4})/i
    );
    if (!period) continue;
    const inLine = lines[i + 1] || "";
    const outLine = lines[i + 2] || "";
    const inMatch = inLine.match(/Money In\.\s*(-?£?[\d,]+\.\d{2}).*Balance on.*?(-?£?[\d,]+\.\d{2})/i);
    const outMatch = outLine.match(/Money Out\.\s*(-?£?[\d,]+\.\d{2}).*Balance on.*?(-?£?[\d,]+\.\d{2})/i);
    if (!inMatch || !outMatch) continue;
    const moneyIn = parseSignedMoney(inMatch[1]);
    const opening = parseSignedMoney(inMatch[2]);
    const moneyOut = parseSignedMoney(outMatch[1]);
    const closing = parseSignedMoney(outMatch[2]);
    months.push({
      label: period[1].replace(/^\d{1,2} /, ""),
      from: period[1],
      to: period[2],
      moneyIn,
      moneyOut,
      opening,
      closing,
      net: Math.round((moneyIn - moneyOut) * 100) / 100,
    });
  }
  const seenMonth = new Set<string>();
  for (let m = months.length - 1; m >= 0; m--) {
    const key = `${months[m].from}|${months[m].to}`;
    if (seenMonth.has(key)) months.splice(m, 1);
    else seenMonth.add(key);
  }

  const lenders = new Map<string, LenderAcc>();
  const seenPayment = new Set<string>();
  const channelSales = new Map<string, { website: number; ebay: number; paypal: number }>();
  function addChannelSale(monthKey: string, kind: "website" | "ebay" | "paypal", amount: number) {
    if (!monthKey || !(amount > 0)) return;
    const row = channelSales.get(monthKey) || { website: 0, ebay: 0, paypal: 0 };
    row[kind] = Math.round((row[kind] + amount) * 100) / 100;
    channelSales.set(monthKey, row);
  }
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] !== "Date" || !/^\d{1,2} [A-Z][a-z]{2} \d{2}\.?$/.test(lines[i + 1] || "")) continue;
    i += 1;
    const date = lines[i];
    i += 1;
    if (lines[i] === "Description") i += 1;
    const descParts: string[] = [];
    while (i < lines.length && lines[i] !== "Type") {
      descParts.push(lines[i]);
      i += 1;
    }
    if (lines[i] === "Type") i += 1;
    const type = lines[i] || "";
    i += 1;
    if (/^Money In/i.test(lines[i] || "")) i += 1;
    const moneyIn = parseSignedMoney(lines[i]);
    i += 1;
    if (/^Money Out/i.test(lines[i] || "")) i += 1;
    const moneyOut = parseSignedMoney(lines[i]);
    const description = descParts.join(" ");
    const monthKey = monthKeyFromDate(date);
    if (moneyIn > 0 && isWebsiteSale(description)) addChannelSale(monthKey, "website", moneyIn);
    if (moneyIn > 0 && isEbaySale(description)) addChannelSale(monthKey, "ebay", moneyIn);
    if (moneyIn > 0 && isPaypalSale(description)) addChannelSale(monthKey, "paypal", moneyIn);
    const kind = classifyLender(description);
    const name = tidyName(description);
    const splitRemit =
      kind === "mca" && moneyIn > 0 && !isInstalmentFinance(description) && !isInstalmentFinance(name);
    if (!kind || (!(moneyOut > 0) && !splitRemit)) continue;
    const paymentKey = `${date}|${name}|${moneyOut.toFixed(2)}|${moneyIn.toFixed(2)}`;
    if (seenPayment.has(paymentKey)) continue;
    seenPayment.add(paymentKey);
    const current = lenders.get(name) || {
      name,
      kind,
      moneyOut: 0,
      moneyIn: 0,
      count: 0,
      monthly: 0,
      payments: [],
    };
    current.moneyOut = Math.round((current.moneyOut + moneyOut) * 100) / 100;
    current.moneyIn = Math.round((current.moneyIn + moneyIn) * 100) / 100;
    current.count += 1;
    current.payments.push({ monthKey, moneyOut, moneyIn });
    lenders.set(name, current);
    void type;
  }

  months.sort((a, b) => Date.parse(a.from) - Date.parse(b.from));
  const latestKey = latestMonthKey(months);
  const extraNames = [...lenders.keys(), ...[...lenders.values()].map((lender) => brandName(lender.name))];
  const rates = {
    ...parseMcaRatesFromText(text, extraNames),
    ...parseMcaRatesFromText(opts.rateText || "", extraNames),
  };
  const mins = {
    ...parseMcaMinsFromText(text),
    ...parseMcaMinsFromText(opts.rateText || ""),
  };
  const sales = channelSales.get(latestKey) || { website: 0, ebay: 0, paypal: 0 };
  const lenderList = collapseLenders([...lenders.values()], latestKey, rates, mins, sales).sort(
    (a, b) => b.monthly - a.monthly || b.moneyOut - a.moneyOut,
  );
  const scored = kpiMonths(months);
  const monthCount = Math.max(scored.length, 1);
  const moneyIn = scored.reduce((sum, month) => sum + month.moneyIn, 0);
  const moneyOut = scored.reduce((sum, month) => sum + month.moneyOut, 0);
  const avgIn = moneyIn / monthCount;
  const avgOut = moneyOut / monthCount;
  const financeMonthly = Math.round(lenderList.reduce((sum, lender) => sum + lender.monthly, 0) * 100) / 100;
  const operatingOutMonthly = Math.max(0, avgOut - financeMonthly);
  const cashForDebt = avgIn - operatingOutMonthly;
  const proposedMonthly = Number(opts.proposedMonthly) > 0 ? Number(opts.proposedMonthly) : 0;
  const dscrCurrent = ratio(cashForDebt, financeMonthly);
  const dscrRefinance = proposedMonthly > 0 ? ratio(cashForDebt, proposedMonthly) : 0;
  const findings = sweepBankStatementText(text);
  const splitCount = lenderList.filter((lender) => lender.splitRate).length;
  const summary = [
    `${monthCount} month${monthCount === 1 ? "" : "s"}: income in £${avgIn.toFixed(0)}/mo, expenses out £${avgOut.toFixed(0)}/mo.`,
    `Stacked finance £${financeMonthly.toFixed(0)}/mo across ${lenderList.length} facilities.`,
    splitCount
      ? `${splitCount} MCA sales-split${splitCount === 1 ? "" : "s"} counted as withheld cuts, not just visible direct debits.`
      : "",
    proposedMonthly
      ? `Refinance at £${proposedMonthly.toFixed(0)}/mo lifts DSCR from ${dscrCurrent.toFixed(2)}x to ${dscrRefinance.toFixed(2)}x.`
      : summariseSweep(findings),
  ]
    .filter(Boolean)
    .join(" ");

  return {
    months,
    totals: {
      moneyIn,
      moneyOut,
      net: moneyIn - moneyOut,
      months: monthCount,
      avgIn,
      avgOut,
      avgNet: avgIn - avgOut,
    },
    lenders: lenderList,
    financeMonthly,
    operatingOutMonthly,
    cashForDebt,
    proposedMonthly,
    dscrCurrent,
    dscrRefinance,
    monthlySaving: financeMonthly - proposedMonthly,
    headroomNow: avgIn - avgOut,
    headroomAfter: avgIn - avgOut + (financeMonthly - proposedMonthly),
    findings,
    summary,
  };
}
