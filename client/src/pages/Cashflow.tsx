import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Banknote,
} from "lucide-react";
import { usePageTitle } from "@/context/LayoutContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import { getChartTheme } from "@/lib/chartTheme";
import { useQueryClient } from "@tanstack/react-query";

interface AccountSummary {
  id: string;
  name: string;
  currency: string;
  balance: number;
  state: string;
}

interface MonthBucket {
  month: string;
  label: string;
  inflows: number;
  outflows: number;
}

interface Category {
  type: string;
  label: string;
  count: number;
  total: number;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: string;
  state: string;
  counterparty: string | null;
}

interface CashflowSummary {
  totalBalance: number;
  accounts: AccountSummary[];
  months: MonthBucket[];
  categories: Category[];
  recentTransactions: Transaction[];
}

interface ConnectionStatus {
  connected: boolean;
}

const CATEGORY_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

const formatGBP = (amount: number, currency = "GBP") =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

const formatGBPShort = (amount: number) => {
  if (amount >= 1_000_000) return `£${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `£${(amount / 1_000).toFixed(1)}K`;
  return formatGBP(amount);
};

function SetupGuide() {
  return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-lg w-full">
        <CardContent className="flex flex-col items-center gap-6 py-12 px-8">
          <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-blue-500/10">
            <Wallet className="h-7 w-7 text-blue-500" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Connect Revolut Business</h2>
          <p className="text-sm text-muted-foreground text-center">
            Connect your Revolut Business account to see live balances, transactions, and cash flow analytics.
          </p>

          <div className="w-full space-y-3 text-left">
            <h3 className="text-xs font-bold text-foreground/70 uppercase tracking-wide">Setup Steps</h3>
            <ol className="space-y-2 text-sm text-foreground/70 list-decimal list-inside">
              <li>Go to <span className="text-foreground font-medium">Revolut Business &gt; Settings &gt; API</span></li>
              <li>Generate an RSA key pair (or use an existing one)</li>
              <li>Create an API application and upload your public key</li>
              <li>Copy your <span className="text-foreground font-medium">client_id</span></li>
              <li>
                Add the following to your <code className="text-xs bg-muted px-1.5 py-0.5 rounded">.env</code> file:
              </li>
            </ol>

            <pre className="bg-muted border border-border rounded-lg p-4 text-xs text-emerald-400 overflow-x-auto">
{`REVOLUT_CLIENT_ID=your_client_id
REVOLUT_SECRET_KEY="-----BEGIN RSA PRIVATE KEY-----
...your private key...
-----END RSA PRIVATE KEY-----"
REVOLUT_SANDBOX=true`}
            </pre>

            <p className="text-xs text-muted-foreground mt-2">
              Start with <code className="bg-muted px-1 py-0.5 rounded">REVOLUT_SANDBOX=true</code> for testing.
              Switch to <code className="bg-muted px-1 py-0.5 rounded">false</code> for production.
            </p>
          </div>

          <Button
            variant="outline"
            className="gap-2 border-border text-foreground/70 hover:text-foreground"
            onClick={() => window.open("https://business.revolut.com/settings/api", "_blank")}
          >
            <ExternalLink className="h-4 w-4" />
            Open Revolut API Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Cashflow() {
  usePageTitle("Cashflow", "Live bank balance and cash flow analytics");
  const queryClient = useQueryClient();
  const chartTheme = getChartTheme();

  // Check connection status
  const { data: status, isLoading: statusLoading } = useQuery<ConnectionStatus>({
    queryKey: ["/api/cashflow/status"],
    staleTime: 1000 * 60 * 10,
  });

  // Fetch summary data (only if connected)
  const { data, isLoading, error, isFetching } = useQuery<CashflowSummary>({
    queryKey: ["/api/cashflow/summary"],
    enabled: !!status?.connected,
    staleTime: 1000 * 60 * 5, // 5 min auto-refresh
    refetchInterval: 1000 * 60 * 5,
  });

  if (statusLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!status?.connected) {
    return <SetupGuide />;
  }

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
        <Card className="max-w-md w-full border-red-500/20 bg-red-500/5">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className="text-sm text-foreground/70 text-center">
              Failed to load cashflow data. Please check your Revolut API credentials.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-border"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/cashflow/summary"] })}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Compute totals for summary cards
  const totalInflows = data.months.reduce((s, m) => s + m.inflows, 0);
  const totalOutflows = data.months.reduce((s, m) => s + m.outflows, 0);
  const netCashflow = totalInflows - totalOutflows;

  const summaryCards = [
    {
      label: "Total Balance",
      value: formatGBP(data.totalBalance),
      icon: Wallet,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "6M Inflows",
      value: formatGBP(totalInflows),
      icon: TrendingUp,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "6M Outflows",
      value: formatGBP(totalOutflows),
      icon: TrendingDown,
      color: "text-red-400",
      bg: "bg-red-500/10",
    },
    {
      label: "Net Cash Flow",
      value: formatGBP(netCashflow),
      icon: Banknote,
      color: netCashflow >= 0 ? "text-emerald-400" : "text-red-400",
      bg: netCashflow >= 0 ? "bg-emerald-500/10" : "bg-red-500/10",
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div />
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/cashflow/summary"] })}
          disabled={isFetching}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          {isFetching ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
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

      {/* Account Balances */}
      {data.accounts.length > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.accounts.map((acc) => (
            <Card key={acc.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{acc.name}</p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatGBP(acc.balance, acc.currency)}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                  {acc.currency}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inflows vs Outflows Chart */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-foreground">Inflows vs Outflows</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Rolling 6 months</p>
            </div>
            <div className="h-[300px]">
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
                    formatter={(value: number, name: string) => [
                      formatGBP(value),
                      name === "inflows" ? "Inflows" : "Outflows",
                    ]}
                    labelStyle={chartTheme.labelStyle}
                  />
                  <Legend
                    wrapperStyle={chartTheme.legend}
                    formatter={(value: string) =>
                      value === "inflows" ? "Inflows" : "Outflows"
                    }
                  />
                  <Bar dataKey="inflows" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="outflows" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground">By Category</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Transaction types</p>
            </div>
            {data.categories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
            ) : (
              <>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.categories}
                        dataKey="total"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        innerRadius={40}
                        paddingAngle={2}
                      >
                        {data.categories.map((_, idx) => (
                          <Cell
                            key={idx}
                            fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={chartTheme.tooltip}
                        formatter={(value: number) => formatGBP(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 mt-2">
                  {data.categories.slice(0, 6).map((cat, idx) => (
                    <div key={cat.type} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                        />
                        <span className="text-foreground/70">{cat.label}</span>
                      </div>
                      <span className="text-foreground font-medium">{formatGBP(cat.total)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Recent Transactions</h3>

          {data.recentTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No recent transactions.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-[11px] text-muted-foreground font-medium uppercase tracking-wide pb-3 pr-4">
                      Date
                    </th>
                    <th className="text-left text-[11px] text-muted-foreground font-medium uppercase tracking-wide pb-3 px-4">
                      Description
                    </th>
                    <th className="text-left text-[11px] text-muted-foreground font-medium uppercase tracking-wide pb-3 px-4">
                      Type
                    </th>
                    <th className="text-right text-[11px] text-muted-foreground font-medium uppercase tracking-wide pb-3 pl-4">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentTransactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-b border-border/30 hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">
                        {tx.date
                          ? new Date(tx.date).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="text-foreground font-medium truncate max-w-[300px]">
                          {tx.description}
                        </div>
                        {tx.counterparty && (
                          <div className="text-[11px] text-muted-foreground">{tx.counterparty}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                          {tx.type?.replace(/_/g, " ") || "—"}
                        </span>
                      </td>
                      <td
                        className={cn(
                          "py-2.5 pl-4 text-right font-medium whitespace-nowrap",
                          tx.amount > 0 ? "text-emerald-400" : "text-red-400"
                        )}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {tx.amount > 0 ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3" />
                          )}
                          {formatGBP(Math.abs(tx.amount), tx.currency)}
                        </div>
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
