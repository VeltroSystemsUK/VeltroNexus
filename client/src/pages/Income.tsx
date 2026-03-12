import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { PoundSterling, TrendingUp, Calendar, AlertCircle, Loader2 } from "lucide-react";
import { usePageTitle } from "@/context/LayoutContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getChartTheme } from "@/lib/chartTheme";

interface IncomeMonth {
  month: string;
  label: string;
  income: number;
  invoiceCount: number;
}

interface PaidInvoice {
  id: number;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  paidDate: string;
}

interface IncomeData {
  months: IncomeMonth[];
  thisMonth: number;
  lastMonth: number;
  yearToDate: number;
  outstanding: number;
  paidInvoices: PaidInvoice[];
}

const formatGBP = (amount: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

const formatGBPShort = (amount: number) => {
  if (amount >= 1_000_000) return `£${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `£${(amount / 1_000).toFixed(1)}K`;
  return formatGBP(amount);
};

export default function Income() {
  usePageTitle("Income", "Track revenue from paid invoices");
  const chartTheme = getChartTheme();

  const { data, isLoading, error } = useQuery<IncomeData>({
    queryKey: ["/api/income/summary"],
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Failed to load income data.</p>
      </div>
    );
  }

  const summaryCards = [
    {
      label: "This Month",
      value: formatGBP(data.thisMonth),
      icon: PoundSterling,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Last Month",
      value: formatGBP(data.lastMonth),
      icon: Calendar,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Year to Date",
      value: formatGBP(data.yearToDate),
      icon: TrendingUp,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      label: "Outstanding",
      value: formatGBP(data.outstanding),
      icon: AlertCircle,
      color: "text-red-400",
      bg: "bg-red-500/10",
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${card.bg}`}>
                    <Icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                  <p className="text-[12px] text-muted-foreground font-medium uppercase tracking-wide">
                    {card.label}
                  </p>
                </div>
                <p className="text-2xl font-bold text-foreground">{card.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Monthly Income Chart */}
      <Card className="">
        <CardContent className="p-6">
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground">Monthly Income</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Revenue from paid invoices — rolling 12 months
            </p>
          </div>

          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.months} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid.stroke} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={chartTheme.tick}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => formatGBPShort(v)}
                  tick={chartTheme.tick}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                />
                <Tooltip
                  contentStyle={chartTheme.tooltip}
                  formatter={(value: number) => [formatGBP(value), "Income"]}
                  labelStyle={chartTheme.labelStyle}
                />
                <Bar
                  dataKey="income"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Paid Invoices Table */}
      <Card className="">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Paid Invoices</h3>

          {data.paidInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No paid invoices yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-[11px] text-muted-foreground font-medium uppercase tracking-wide pb-3 pr-4">Invoice #</th>
                    <th className="text-left text-[11px] text-muted-foreground font-medium uppercase tracking-wide pb-3 px-4">Client</th>
                    <th className="text-right text-[11px] text-muted-foreground font-medium uppercase tracking-wide pb-3 px-4">Amount</th>
                    <th className="text-left text-[11px] text-muted-foreground font-medium uppercase tracking-wide pb-3 pl-4">Paid Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.paidInvoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-border/30 hover:bg-muted/50 transition-colors">
                      <td className="py-2.5 pr-4 text-foreground font-medium">{inv.invoiceNumber}</td>
                      <td className="py-2.5 px-4 text-foreground/70">{inv.clientName}</td>
                      <td className="py-2.5 px-4 text-right text-emerald-400 font-medium">{formatGBP(inv.amount)}</td>
                      <td className="py-2.5 pl-4 text-muted-foreground">
                        {inv.paidDate ? new Date(inv.paidDate).toLocaleDateString("en-GB") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
