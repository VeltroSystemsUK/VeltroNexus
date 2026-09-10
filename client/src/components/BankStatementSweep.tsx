import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { storeProspectFile } from "@/lib/storeProspectFile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FileText, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { unwrapDueDiligence } from "@shared/dueDiligence";

type ProspectDoc = {
  id: number;
  fileName: string;
  category?: string | null;
  fileType?: string | null;
};

type SweepFinding = {
  kind: string;
  severity: string;
  description: string;
  amount?: number;
  evidence: string;
};

type SweepMonth = {
  label: string;
  moneyIn: number;
  moneyOut: number;
  net: number;
  opening: number;
  closing: number;
};

type SweepLender = {
  name: string;
  kind: string;
  moneyOut: number;
  count: number;
  monthly?: number;
  splitRate?: number;
  minMonthly?: number;
};

type AffordabilitySweep = {
  summary?: string;
  findings?: SweepFinding[];
  files?: { fileName: string }[];
  months?: SweepMonth[];
  totals?: { avgIn: number; avgOut: number; avgNet: number; months: number; moneyIn: number; moneyOut: number };
  lenders?: SweepLender[];
  financeMonthly?: number;
  cashForDebt?: number;
  proposedMonthly?: number;
  dscrCurrent?: number;
  dscrRefinance?: number;
  monthlySaving?: number;
  headroomNow?: number;
  headroomAfter?: number;
};

const KIND_LABEL: Record<string, string> = {
  bounced: "Bounced / returned",
  mca: "Short-term / MCA",
  loan: "Loan repayments",
  hmrc: "HMRC / tax",
  gambling: "Gambling",
  cash: "Cash withdrawals",
  overdraft: "Overdraft",
  personal: "Personal drawings",
  anomaly: "Anomaly",
};

function isBankDoc(doc: ProspectDoc) {
  const name = doc.fileName || "";
  const cat = String(doc.category || "");
  if (/bank.?statement|bank_statements/i.test(cat)) return true;
  if (/statement/i.test(name) && !/assets|liabilit/i.test(name)) return true;
  return /\.pdf$/i.test(name) && /bank/i.test(name);
}

const gbp = (n?: number) =>
  typeof n === "number" && Number.isFinite(n)
    ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n)
    : "";

export function BankStatementSweep({ prospectId }: { prospectId: number }) {
  const [proposedMonthly, setProposedMonthly] = useState("");
  const { data: documents = [] } = useQuery<ProspectDoc[]>({
    queryKey: [`/api/prospects/${prospectId}/documents`],
    enabled: prospectId > 0,
  });
  const { data: dueDiligenceRaw } = useQuery<unknown>({
    queryKey: [`/api/prospects/${prospectId}/due-diligence`],
    enabled: prospectId > 0,
  });
  const underwriting = unwrapDueDiligence(dueDiligenceRaw).underwriting || {};
  const sweep = (underwriting as { affordabilitySweep?: AffordabilitySweep }).affordabilitySweep;
  const stackedMonthly =
    sweep?.lenders?.some((lender) => typeof lender.monthly === "number")
      ? sweep.lenders.reduce((sum, lender) => sum + (Number(lender.monthly) || 0), 0)
      : sweep?.financeMonthly;
  const typedProposed = Number(proposedMonthly);
  const proposedNow =
    typedProposed > 0 ? typedProposed : Number(sweep?.proposedMonthly) > 0 ? Number(sweep?.proposedMonthly) : 0;
  const cashReleasedMonthly =
    typeof stackedMonthly === "number" && proposedNow > 0 ? stackedMonthly - proposedNow : undefined;
  const bankDocs = documents.filter(isBankDoc);

  const sweepMutation = useMutation({
    mutationFn: async () => {
      const proposed = Number(proposedMonthly);
      const res = await apiRequest(`/api/prospects/${prospectId}/underwriting/sweep-statements`, "POST", {
        documentIds: bankDocs.map((doc) => doc.id),
        ...(proposed > 0 ? { proposedMonthly: proposed } : {}),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospectId}/due-diligence`] });
      toast.success("Affordability sweep complete");
    },
    onError: (error: Error) => toast.error(error.message || "Sweep failed"),
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        await storeProspectFile(prospectId, file, "bank-statements");
      }
    },
    onSuccess: () => toast.success("Statement added to the record"),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bank analysis</CardTitle>
        <CardDescription>
          Reads Money In / Money Out from the statements on file, totals stacked loan and MCA service
          (including withheld sales splits), and shows how refinance would change DSCR.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {bankDocs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bank statement PDFs on the file yet.</p>
        ) : (
          <ul className="space-y-2">
            {bankDocs.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">{doc.fileName}</span>
                </span>
                <a
                  href={`/api/prospects/${prospectId}/documents/${doc.id}/download`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary text-xs inline-flex items-center gap-1 shrink-0"
                >
                  Open PDF <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="proposed-monthly" className="text-xs text-muted-foreground block mb-1">
              Proposed new monthly (£)
            </label>
            <Input
              id="proposed-monthly"
              type="number"
              className="w-36"
              value={proposedMonthly}
              onChange={(event) => setProposedMonthly(event.target.value)}
              placeholder="e.g. 1417"
            />
          </div>
          <Button
            onClick={() => sweepMutation.mutate()}
            disabled={sweepMutation.isPending || bankDocs.length === 0}
          >
            {sweepMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
            Run bank analysis
          </Button>
          <Input
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="max-w-xs"
            disabled={uploadMutation.isPending}
            onChange={(event) => {
              const files = event.target.files ? Array.from(event.target.files) : [];
              if (files.length) uploadMutation.mutate(files);
              event.target.value = "";
            }}
          />
        </div>

        {sweep?.totals && (
          <div className="space-y-4" data-testid="card-affordability-sweep">
            <p className="text-sm">{sweep.summary}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Income in / month" value={gbp(sweep.totals.avgIn)} />
              <Kpi label="Expenses out / month" value={gbp(sweep.totals.avgOut)} />
              <Kpi label="Net cashflow / month" value={gbp(sweep.totals.avgNet)} warn={(sweep.totals.avgNet || 0) < 0} />
              <Kpi label="Full months" value={String(sweep.totals.months || 0)} />
              <Kpi label="Stacked finance / month" value={gbp(stackedMonthly)} warn />
              <Kpi
                label="Cash before existing debt service"
                value={gbp(sweep.cashForDebt)}
                warn={(sweep.totals.avgNet || 0) < 0 || (sweep.cashForDebt || 0) < (stackedMonthly || 0)}
              />
              <Kpi label="DSCR now" value={`${(sweep.dscrCurrent || 0).toFixed(2)}x`} warn={(sweep.dscrCurrent || 0) < 1.25} />
              <Kpi
                label="DSCR after refinance"
                value={`${(sweep.dscrRefinance || 0).toFixed(2)}x`}
                warn={(sweep.dscrRefinance || 0) < 1.25}
              />
            </div>
            {cashReleasedMonthly != null && (
              <div
                className="rounded-md border-2 border-emerald-700 bg-emerald-50 p-4 dark:border-emerald-500 dark:bg-emerald-950/40"
                data-testid="box-cashflow-released"
              >
                <p className="text-xs uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                  Cashflow released back to the business every month
                </p>
                <p className="text-3xl font-semibold tabular-nums text-emerald-900 dark:text-emerald-200">
                  {gbp(cashReleasedMonthly)}
                </p>
                <p className="mt-1 text-sm text-emerald-900/80 dark:text-emerald-200/80">
                  Stacked finance now {gbp(stackedMonthly)} − new facility {gbp(proposedNow)} ={" "}
                  <span className="font-medium">{gbp(cashReleasedMonthly)}</span> extra cash in the account each month
                  after refinance.
                </p>
              </div>
            )}
            <p className="text-sm">
              New facility at {gbp(proposedNow || sweep.proposedMonthly)} / month. Headroom {gbp(sweep.headroomNow)} now
              → {gbp(sweep.headroomAfter)} after refinance.
            </p>
            {sweep.months && sweep.months.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-1 pr-3">Month</th>
                      <th className="py-1 pr-3">Money in</th>
                      <th className="py-1 pr-3">Money out</th>
                      <th className="py-1 pr-3">Net</th>
                      <th className="py-1">Closing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sweep.months.map((month) => (
                      <tr key={month.label} className="border-b last:border-0">
                        <td className="py-1 pr-3">{month.label}</td>
                        <td className="py-1 pr-3">{gbp(month.moneyIn)}</td>
                        <td className="py-1 pr-3">{gbp(month.moneyOut)}</td>
                        <td className={`py-1 pr-3 ${month.net < 0 ? "text-destructive" : ""}`}>{gbp(month.net)}</td>
                        <td className={`py-1 ${month.closing < 0 ? "text-destructive" : ""}`}>{gbp(month.closing)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {sweep.lenders && sweep.lenders.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Loan / MCA / card service — monthly now is the last full statement month</h4>
                {(sweep.lenders || []).some(
                  (lender) => typeof lender.splitRate === "number" && (lender.monthly || 0) > 0,
                ) && (
                  <p className="text-xs text-muted-foreground mb-2">
                    Merchant cash advances take a cut of daily sales before the business is paid. Monthly for those
                    facilities is the withheld percentage — or the greater of that cut, visible direct debits, and
                    any contractual minimum. Quiet sales months still cost the minimum. That hidden drag is a major
                    reason businesses get into trouble.
                  </p>
                )}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-1 pr-3">Lender</th>
                      <th className="py-1 pr-3">Type</th>
                      <th className="py-1 pr-3">Payments</th>
                      <th className="py-1 pr-3">Paid in period</th>
                      <th className="py-1">Monthly now</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sweep.lenders.map((lender) => (
                      <tr key={lender.name} className="border-b last:border-0">
                        <td className="py-1 pr-3">{lender.name}</td>
                        <td className="py-1 pr-3 uppercase text-xs">
                          {lender.kind}
                          {typeof lender.splitRate === "number"
                            ? ` ${Math.round(lender.splitRate * 100)}% withheld`
                            : ""}
                          {typeof lender.minMonthly === "number"
                            ? ` min ${gbp(lender.minMonthly)}/mo`
                            : ""}
                        </td>
                        <td className="py-1 pr-3">{lender.count}</td>
                        <td className="py-1 pr-3">{gbp(lender.moneyOut)}</td>
                        <td className="py-1">{gbp(lender.monthly)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="space-y-2">
              {(sweep.findings || []).slice(0, 20).map((finding, index) => (
                <div key={index} className="text-sm border-t pt-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={finding.severity === "high" ? "destructive" : "secondary"}>
                      {KIND_LABEL[finding.kind] || finding.kind}
                    </Badge>
                    <span>{finding.description}</span>
                    {finding.amount ? <span className="text-muted-foreground">{gbp(finding.amount)}</span> : null}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">{finding.evidence}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Kpi({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-semibold ${warn ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}
