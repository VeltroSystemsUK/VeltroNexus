import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import type { ProspectWithCompany } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { toast } from "sonner";

type CreditsafeCompanyResult = {
  id: string;
  name?: string;
  regNo?: string;
  status?: string;
};

type CreditsafeUsage = {
  configured: boolean;
  used: number;
  limit: number;
  remaining: number;
  trialEndsAt: string | null;
  expired: boolean;
};

// Manual-only, metered lookup (trial: 50 report pulls total). Shared between
// the Prospect page and the Underwriting Studio's Financials tab so there's
// one implementation of the search/pull flow, not two drifting copies.
export function CreditsafeCheck({ prospect }: { prospect: ProspectWithCompany }) {
  const [companies, setCompanies] = useState<CreditsafeCompanyResult[] | null>(null);

  const { data: usage, refetch: refetchUsage } = useQuery<CreditsafeUsage>({
    queryKey: ["/api/creditsafe/status"],
  });

  const searchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/creditsafe/search?name=${encodeURIComponent(prospect.company.companyName)}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Creditsafe search failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setCompanies(data.companies || []);
      refetchUsage();
      if (!data.companies?.length) toast.info("No matching companies found on Creditsafe");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Pulls the report AND writes the extracted score/rating/limit onto the
  // company record — not just a display fetch.
  const reportMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/companies/${prospect.company.id}/creditsafe-report/${encodeURIComponent(id)}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Creditsafe report failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospect.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospect.id}/due-diligence`] });
      refetchUsage();
      toast.success("Credit report pulled — company record updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Company search is unmetered per Creditsafe's confirmed sandbox terms — only
  // pulling a report (View Report) spends one of the 50.
  const outOfReports = usage ? usage.remaining <= 0 || usage.expired : false;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle>Creditsafe Credit Check</CardTitle>
            <CardDescription>
              Manual lookup only — search is free, viewing a report spends one of the trial's 50
              {usage?.trialEndsAt ? ` (trial ends ${new Date(usage.trialEndsAt).toLocaleDateString("en-GB")})` : ""}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {usage && (
              <Badge variant={outOfReports ? "destructive" : "secondary"} data-testid="badge-creditsafe-usage">
                {usage.remaining}/{usage.limit} reports left
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => searchMutation.mutate()}
              disabled={searchMutation.isPending || usage?.configured === false}
              data-testid="button-creditsafe-search"
            >
              <Search className={`h-4 w-4 mr-2 ${searchMutation.isPending ? "animate-spin" : ""}`} />
              {searchMutation.isPending ? "Searching..." : "Run Credit Check"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {usage?.configured === false && (
          <p className="text-sm text-muted-foreground">Creditsafe is not configured on this server.</p>
        )}
        {usage?.expired && (
          <p className="text-sm text-destructive">Trial contract has ended — reports can no longer be pulled.</p>
        )}
        {!usage?.expired && outOfReports && (
          <p className="text-sm text-destructive">Trial report quota exhausted — no reports remaining.</p>
        )}
        {companies && companies.length > 0 && (
          <div className="space-y-2">
            {companies.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between border rounded-md p-3"
              >
                <div>
                  <p className="text-sm font-medium">{c.name || c.id}</p>
                  <p className="text-xs text-muted-foreground">
                    {[c.regNo, c.status].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => reportMutation.mutate(c.id)}
                  disabled={reportMutation.isPending || outOfReports}
                  data-testid="button-creditsafe-report"
                >
                  {reportMutation.isPending ? "Loading..." : "View Report"}
                </Button>
              </div>
            ))}
          </div>
        )}
        {prospect.company.creditsafeCheckedAt && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border rounded-md p-4">
            <div>
              <p className="text-xs text-muted-foreground">Credit Score</p>
              <p className="text-lg font-semibold">{prospect.company.creditsafeScore || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rating</p>
              <p className="text-lg font-semibold">
                {prospect.company.creditsafeRatingDescription || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Credit Limit</p>
              <p className="text-lg font-semibold">
                {prospect.company.creditsafeCreditLimit != null
                  ? new Intl.NumberFormat("en-GB", {
                      style: "currency",
                      currency: "GBP",
                      minimumFractionDigits: 0,
                    }).format(prospect.company.creditsafeCreditLimit / 100)
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Checked</p>
              <p className="text-lg font-semibold">
                {new Date(prospect.company.creditsafeCheckedAt).toLocaleDateString("en-GB")}
              </p>
            </div>
          </div>
        )}
        {prospect.company.creditsafeReport && (
          <details>
            <summary className="text-sm text-muted-foreground cursor-pointer select-none">
              Full raw report (advanced)
            </summary>
            <pre className="text-xs overflow-auto max-h-96 bg-muted p-4 rounded-md mt-2">
              {JSON.stringify(JSON.parse(prospect.company.creditsafeReport), null, 2)}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

export default CreditsafeCheck;
