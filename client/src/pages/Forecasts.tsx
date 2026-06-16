import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, PoundSterling, BarChart3, Target, Loader2 } from "lucide-react";
import { usePageTitle } from "@/context/LayoutContext";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { getChartTheme } from "@/lib/chartTheme";

interface ForecastMonth {
  month: string;
  label: string;
  forecast: number;
  approved: number;
  pipeline: number;
  dealCount: number;
}

interface ForecastData {
  months: ForecastMonth[];
  totalForecast: number;
  totalApproved: number;
  totalPipeline: number;
  summary: {
    avgDealSize: number;
    avgCommission: number;
    conversionRate: number;
    totalDeals: number;
    commissionRate: number;
  };
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

export default function Forecasts() {
  usePageTitle("Forecasts", "Rolling 12-month commission forecast");
  const chartTheme = getChartTheme();

  const { data, isLoading, error } = useQuery<ForecastData>({
    queryKey: ["/api/forecasts/revenue"],
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
        <p className="text-muted-foreground">Failed to load forecast data.</p>
      </div>
    );
  }

  const summaryCards = [
    {
      label: "12-Month Forecast",
      value: formatGBP(data.totalForecast),
      icon: TrendingUp,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Approved Revenue",
      value: formatGBP(data.totalApproved),
      icon: PoundSterling,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Pipeline Weighted",
      value: formatGBP(data.totalPipeline),
      icon: BarChart3,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      label: "Avg Deal Size",
      value: formatGBP(data.summary.avgDealSize),
      icon: Target,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
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

      {/* Chart */}
      <Card className="">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Commission Forecast</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Rolling 12-month view &middot; {data.summary.totalDeals} active deals &middot; {(data.summary.commissionRate * 100).toFixed(0)}% commission rate
              </p>
            </div>
          </div>

          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.months} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradApproved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradPipeline" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                  formatter={(value: number, name: string) => [
                    formatGBP(value),
                    name === "approved" ? "Approved" : "Pipeline (weighted)",
                  ]}
                  labelStyle={chartTheme.labelStyle}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={chartTheme.legend}
                  formatter={(value: string) =>
                    value === "approved" ? "Approved Revenue" : "Pipeline (weighted)"
                  }
                />
                <Area
                  type="monotone"
                  dataKey="approved"
                  stackId="1"
                  stroke="#3b82f6"
                  fill="url(#gradApproved)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="pipeline"
                  stackId="1"
                  stroke="#f59e0b"
                  fill="url(#gradPipeline)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Breakdown Table */}
      <Card className="">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Monthly Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-[11px] text-muted-foreground font-medium uppercase tracking-wide pb-3 pr-4">Month</th>
                  <th className="text-right text-[11px] text-muted-foreground font-medium uppercase tracking-wide pb-3 px-4">Deals</th>
                  <th className="text-right text-[11px] text-muted-foreground font-medium uppercase tracking-wide pb-3 px-4">Approved</th>
                  <th className="text-right text-[11px] text-muted-foreground font-medium uppercase tracking-wide pb-3 px-4">Pipeline</th>
                  <th className="text-right text-[11px] text-muted-foreground font-medium uppercase tracking-wide pb-3 pl-4">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((m) => (
                  <tr key={m.month} className="border-b border-border/30 hover:bg-muted/50 transition-colors">
                    <td className="py-2.5 pr-4 text-foreground/70 font-medium">{m.label}</td>
                    <td className="py-2.5 px-4 text-right text-muted-foreground">{m.dealCount}</td>
                    <td className="py-2.5 px-4 text-right text-blue-400">
                      {m.approved > 0 ? formatGBP(m.approved) : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-right text-amber-400">
                      {m.pipeline > 0 ? formatGBP(m.pipeline) : "—"}
                    </td>
                    <td className="py-2.5 pl-4 text-right text-foreground font-medium">
                      {m.forecast > 0 ? formatGBP(m.forecast) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border">
                  <td className="pt-3 pr-4 text-foreground font-semibold">Total</td>
                  <td className="pt-3 px-4 text-right text-muted-foreground">{data.summary.totalDeals}</td>
                  <td className="pt-3 px-4 text-right text-blue-400 font-semibold">{formatGBP(data.totalApproved)}</td>
                  <td className="pt-3 px-4 text-right text-amber-400 font-semibold">{formatGBP(data.totalPipeline)}</td>
                  <td className="pt-3 pl-4 text-right text-foreground font-bold">{formatGBP(data.totalForecast)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
