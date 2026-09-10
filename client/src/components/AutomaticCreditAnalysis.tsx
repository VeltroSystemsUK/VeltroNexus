import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Calculator,
  PieChart,
  BarChart3,
  DollarSign,
  Percent,
  FileText,
  AlertCircle,
} from "lucide-react";
import type { DueDiligenceData } from "@shared/schema";
import { formatAsBulletPoints } from "@/lib/formatBulletPoints";

interface AutomaticCreditAnalysisProps {
  data: DueDiligenceData;
}

export function formatCreditRatio(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "N/A";
  return value.toFixed(2);
}

export function formatCreditPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "N/A";
  const pct = value <= 0 ? 0 : value < 1 ? value * 100 : value;
  return `${pct.toFixed(1)}%`;
}

export function AutomaticCreditAnalysis({ data }: AutomaticCreditAnalysisProps) {
  const underwriting = data.underwriting;
  const financialAnalysis = underwriting?.financialAnalysis;
  const accountsAnalysis = underwriting?.accountsAnalysis;

  const hasFinancialData = financialAnalysis && (
    financialAnalysis.dscr !== undefined ||
    financialAnalysis.averageMonthlyRevenue !== undefined ||
    financialAnalysis.netDisposableIncome !== undefined
  );

  const hasAccountsData = accountsAnalysis && (
    (accountsAnalysis.years?.length ?? 0) > 0 ||
    (accountsAnalysis.ratios?.length ?? 0) > 0
  );

  if (!hasFinancialData && !hasAccountsData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Automatic Credit Analysis
          </CardTitle>
          <CardDescription>
            Credit ratios calculated automatically from uploaded financial documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Financial Data Available</h3>
            <p className="text-muted-foreground max-w-md">
              Upload bank statements (CSV or PDF) or audited accounts in the Pre-Underwriting section
              to automatically calculate DSCR and credit ratios.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined) return "N/A";
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const normalizePercent = (value: number | undefined): number => {
    if (value === undefined) return 0;
    if (value <= 0) return 0;
    if (value < 1) return value * 100;
    return value;
  };

  const formatPercent = formatCreditPercent;
  const formatRatio = formatCreditRatio;

  const getDscrStatus = (dscr: number | undefined) => {
    if (dscr === undefined) return { status: "unknown", color: "secondary", icon: AlertCircle };
    if (dscr >= 1.5) return { status: "Strong", color: "success", icon: CheckCircle2 };
    if (dscr >= 1.25) return { status: "Acceptable", color: "success", icon: CheckCircle2 };
    if (dscr >= 1.0) return { status: "Marginal", color: "warning", icon: AlertTriangle };
    return { status: "Weak", color: "destructive", icon: XCircle };
  };

  const getRiskBadgeVariant = (risk: string | undefined) => {
    switch (risk) {
      case "A": return "default";
      case "B": return "secondary";
      case "C": return "outline";
      case "D": return "destructive";
      case "E": return "destructive";
      default: return "outline";
    }
  };

  const dscrInfo = getDscrStatus(financialAnalysis?.dscr);
  const DscrIcon = dscrInfo.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Automatic Credit Analysis
            </CardTitle>
            <CardDescription>
              Credit ratios calculated automatically from uploaded financial documents
            </CardDescription>
          </div>
          {financialAnalysis?.riskScore && (
            <Badge variant={getRiskBadgeVariant(financialAnalysis.riskScore)} className="text-lg px-4 py-1">
              Risk Grade: {financialAnalysis.riskScore}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {hasFinancialData && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                icon={TrendingUp}
                label="DSCR"
                value={formatRatio(financialAnalysis?.dscr)}
                subValue={dscrInfo.status}
                variant={dscrInfo.color as "success" | "warning" | "destructive" | "secondary"}
                data-testid="metric-dscr"
              />
              <MetricCard
                icon={DollarSign}
                label="Avg Monthly Revenue"
                value={formatCurrency(financialAnalysis?.averageMonthlyRevenue)}
                data-testid="metric-monthly-revenue"
              />
              <MetricCard
                icon={BarChart3}
                label="Avg Monthly Expenses"
                value={formatCurrency(financialAnalysis?.averageMonthlyExpenses)}
                data-testid="metric-monthly-expenses"
              />
              <MetricCard
                icon={PieChart}
                label="Net Disposable Income"
                value={formatCurrency(financialAnalysis?.netDisposableIncome)}
                variant={financialAnalysis?.netDisposableIncome && financialAnalysis.netDisposableIncome > 0 ? "success" : "warning"}
                data-testid="metric-net-disposable"
              />
            </div>

            {financialAnalysis?.profitAndLoss && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Profit & Loss Summary
                    {financialAnalysis.profitAndLoss.periodMonths && (
                      <Badge variant="outline" className="ml-2">
                        {financialAnalysis.profitAndLoss.periodMonths} months
                      </Badge>
                    )}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <PnLItem label="Turnover" value={formatCurrency(financialAnalysis.profitAndLoss.turnover)} />
                    <PnLItem label="Cost of Sales" value={formatCurrency(financialAnalysis.profitAndLoss.costOfSales)} />
                    <PnLItem
                      label="Gross Profit"
                      value={formatCurrency(financialAnalysis.profitAndLoss.grossProfit)}
                      isPositive={(financialAnalysis.profitAndLoss.grossProfit ?? 0) > 0}
                    />
                    <PnLItem label="Total Expenses" value={formatCurrency(financialAnalysis.profitAndLoss.totalExpenses)} />
                    <PnLItem
                      label="Net Profit"
                      value={formatCurrency(financialAnalysis.profitAndLoss.netProfit)}
                      isPositive={(financialAnalysis.profitAndLoss.netProfit ?? 0) > 0}
                      highlight
                    />
                    {financialAnalysis.profitAndLoss.grossProfit && financialAnalysis.profitAndLoss.turnover && (
                      <PnLItem
                        label="Gross Margin"
                        value={formatPercent((financialAnalysis.profitAndLoss.grossProfit / financialAnalysis.profitAndLoss.turnover) * 100)}
                      />
                    )}
                  </div>
                </div>
              </>
            )}

            {financialAnalysis?.redFlags && financialAnalysis.redFlags.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    Risk Flags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {financialAnalysis.redFlags.map((flag: any, index: number) => (
                      <Badge
                        key={index}
                        variant={flag.isActive ? "destructive" : "outline"}
                        className="flex items-center gap-1"
                      >
                        {flag.isActive ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                        {flag.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {hasAccountsData && accountsAnalysis?.ratios && accountsAnalysis.ratios.length > 0 && (
          <>
            {hasFinancialData && <Separator />}
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Audited Accounts Ratios
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-2 px-3 font-medium">Metric</th>
                      <th className="text-left py-2 px-3 font-medium">Benchmark</th>
                      {accountsAnalysis.ratios.map((r, idx) => (
                        <th key={idx} className="text-right py-2 px-3 font-medium">{r.year}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <RatioTableRow
                      label="Current Ratio"
                      benchmark="≥ 1.5"
                      values={accountsAnalysis.ratios.map(r => r.ratios.currentRatio)}
                      formatFn={formatRatio}
                      isGood={(v) => (v ?? 0) >= 1.5}
                    />
                    <RatioTableRow
                      label="Quick Ratio"
                      benchmark="≥ 1.0"
                      values={accountsAnalysis.ratios.map(r => r.ratios.quickRatio)}
                      formatFn={formatRatio}
                      isGood={(v) => (v ?? 0) >= 1.0}
                    />
                    <RatioTableRow
                      label="Debt to Equity"
                      benchmark="≤ 2.0"
                      values={accountsAnalysis.ratios.map(r => r.ratios.debtToEquity)}
                      formatFn={formatRatio}
                      isGood={(v) => (v ?? 0) <= 2.0}
                    />
                    <RatioTableRow
                      label="Gross Profit Margin"
                      benchmark="≥ 20%"
                      values={accountsAnalysis.ratios.map(r => r.ratios.grossProfitMargin)}
                      formatFn={formatPercent}
                      isGood={(v) => normalizePercent(v) >= 20}
                    />
                    <RatioTableRow
                      label="Net Profit Margin"
                      benchmark="≥ 5%"
                      values={accountsAnalysis.ratios.map(r => r.ratios.netProfitMargin)}
                      formatFn={formatPercent}
                      isGood={(v) => normalizePercent(v) >= 5}
                    />
                    <RatioTableRow
                      label="Interest Cover"
                      benchmark="≥ 2.0"
                      values={accountsAnalysis.ratios.map(r => r.ratios.interestCover)}
                      formatFn={formatRatio}
                      isGood={(v) => (v ?? 0) >= 2.0}
                    />
                    <RatioTableRow
                      label="ROCE"
                      benchmark="≥ 15%"
                      values={accountsAnalysis.ratios.map(r => r.ratios.returnOnCapitalEmployed)}
                      formatFn={formatPercent}
                      isGood={(v) => normalizePercent(v) >= 15}
                    />
                    <RatioTableRow
                      label="Debtor Days"
                      benchmark="≤ 60"
                      values={accountsAnalysis.ratios.map(r => r.ratios.debtorDays)}
                      formatFn={(v) => v?.toFixed(0) ?? "N/A"}
                      isGood={(v) => (v ?? 0) <= 60}
                    />
                    <RatioTableRow
                      label="Creditor Days"
                      benchmark="≤ 45"
                      values={accountsAnalysis.ratios.map(r => r.ratios.creditorDays)}
                      formatFn={(v) => v?.toFixed(0) ?? "N/A"}
                      isGood={(v) => (v ?? 0) <= 45}
                    />
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {hasAccountsData && accountsAnalysis?.years && accountsAnalysis.years.length > 0 && (
          <>
            <Separator />
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Year-on-Year Comparison
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">Year Ending</th>
                      <th className="text-right py-2 px-3 font-medium">Turnover</th>
                      <th className="text-right py-2 px-3 font-medium">Gross Profit</th>
                      <th className="text-right py-2 px-3 font-medium">Net Profit</th>
                      <th className="text-right py-2 px-3 font-medium">Net Assets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountsAnalysis.years.map((year: any, index: number) => (
                      <tr key={index} className="border-b last:border-0">
                        <td className="py-2 px-3 font-medium">{year.yearEnding}</td>
                        <td className="text-right py-2 px-3">{formatCurrency(year.turnover)}</td>
                        <td className="text-right py-2 px-3">{formatCurrency(year.grossProfit)}</td>
                        <td className={`text-right py-2 px-3 ${(year.netProfit ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(year.netProfit)}
                        </td>
                        <td className="text-right py-2 px-3">{formatCurrency(year.netAssets)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {financialAnalysis?.summary && (
          <>
            <Separator />
            <div>
              <h3 className="font-semibold mb-2">Analysis Summary</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                {formatAsBulletPoints(financialAnalysis.summary).map((point, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subValue,
  variant = "secondary",
  ...props
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  subValue?: string;
  variant?: "success" | "warning" | "destructive" | "secondary";
} & Record<string, unknown>) {
  const colorClasses = {
    success: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800",
    warning: "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800",
    destructive: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800",
    secondary: "bg-muted/50 border-border",
  };

  const iconColors = {
    success: "text-green-600 dark:text-green-400",
    warning: "text-amber-600 dark:text-amber-400",
    destructive: "text-red-600 dark:text-red-400",
    secondary: "text-muted-foreground",
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[variant]}`} {...props}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${iconColors[variant]}`} />
        <span className="text-xs font-medium text-muted-foreground uppercase">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {subValue && <div className="text-xs text-muted-foreground mt-1">{subValue}</div>}
    </div>
  );
}

function PnLItem({
  label,
  value,
  isPositive,
  highlight
}: {
  label: string;
  value: string;
  isPositive?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`p-3 rounded-lg ${highlight ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'}`}>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`font-semibold ${isPositive !== undefined
          ? isPositive
            ? 'text-green-600 dark:text-green-400'
            : 'text-red-600 dark:text-red-400'
          : ''
        }`}>
        {value}
      </div>
    </div>
  );
}

function RatioCard({
  label,
  value,
  benchmark,
  isGood,
}: {
  label: string;
  value: string;
  benchmark: string;
  isGood?: boolean;
}) {
  return (
    <div className="p-3 rounded-lg bg-muted/50 border">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        {isGood !== undefined && (
          isGood ? (
            <CheckCircle2 className="h-3 w-3 text-green-500" />
          ) : (
            <AlertTriangle className="h-3 w-3 text-amber-500" />
          )
        )}
      </div>
      <div className="font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">Benchmark: {benchmark}</div>
    </div>
  );
}

function RatioTableRow({
  label,
  benchmark,
  values,
  formatFn,
  isGood,
}: {
  label: string;
  benchmark: string;
  values: (number | null | undefined)[];
  formatFn: (v: number | null | undefined) => string;
  isGood: (v: number | null | undefined) => boolean;
}) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 px-3 font-medium">{label}</td>
      <td className="py-2 px-3 text-muted-foreground text-xs">{benchmark}</td>
      {values.map((value, idx) => {
        const good = isGood(value);
        return (
          <td
            key={idx}
            className={`text-right py-2 px-3 font-medium ${good ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}
          >
            <div className="flex items-center justify-end gap-1">
              {formatFn(value)}
              {good ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <AlertTriangle className="h-3 w-3" />
              )}
            </div>
          </td>
        );
      })}
    </tr>
  );
}
