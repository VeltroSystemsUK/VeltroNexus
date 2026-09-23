import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { getChartTheme } from "@/lib/chartTheme";
import { cn } from "@/lib/utils";

type SiteTrafficDay = {
  day: string;
  clicks: number;
  uniqueClickThroughs: number;
  dwells: number;
};

function trafficDayLabel(day: string) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!parts) return day;
  return new Date(Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), 12)).toLocaleDateString(
    "en-GB",
    { day: "numeric", month: "short" }
  );
}

export function SiteTrafficChart({ className }: { className?: string }) {
  const chartTheme = getChartTheme();
  const { data, isLoading } = useQuery<{ days: SiteTrafficDay[] }>({
    queryKey: ["/api/openers/site-traffic"],
  });
  const days = data?.days || [];
  const chartData = days.map((row) => ({ ...row, label: trafficDayLabel(row.day) }));
  const clicks = days.reduce((sum, row) => sum + row.clicks, 0);
  const dwells = days.reduce((sum, row) => sum + row.dwells, 0);
  const throughs = days.reduce((sum, row) => sum + row.uniqueClickThroughs, 0);

  return (
    <Card data-testid="chart-site-traffic" className={cn(className)}>
      <CardContent className="p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Traffic sent to stratafinance.co.uk</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Last 30 London days from NEXUS mail</p>
          </div>
          <p className="text-xs tabular-nums text-muted-foreground">
            {clicks} clicks · {throughs} click-throughs · {dwells} dwells
          </p>
        </div>
        <div className="h-[220px] md:h-[260px]">
          {isLoading && days.length === 0 ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2 h-full">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading traffic…
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="sfClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="sfDwells" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="sfThroughs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid.stroke} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={chartTheme.tick}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={16}
                />
                <YAxis
                  allowDecimals={false}
                  tick={chartTheme.tick}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={chartTheme.tooltip}
                  labelStyle={chartTheme.labelStyle}
                  formatter={(value: number, name: string) => [
                    value,
                    name === "clicks" ? "Site clicks" : name === "uniqueClickThroughs" ? "Click-throughs" : "Dwells",
                  ]}
                />
                <Legend
                  wrapperStyle={chartTheme.legend}
                  formatter={(value: string) =>
                    value === "clicks" ? "Site clicks" : value === "uniqueClickThroughs" ? "Click-throughs" : "Dwells"
                  }
                />
                <Area type="monotone" dataKey="clicks" stroke="#10b981" strokeWidth={2} fill="url(#sfClicks)" />
                <Area type="monotone" dataKey="dwells" stroke="#f59e0b" strokeWidth={2} fill="url(#sfDwells)" />
                <Area
                  type="monotone"
                  dataKey="uniqueClickThroughs"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  fill="url(#sfThroughs)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
