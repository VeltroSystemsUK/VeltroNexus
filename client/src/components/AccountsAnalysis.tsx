import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { storeProspectFile } from "@/lib/storeProspectFile";
import type { ProspectWithCompany } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload, Loader2, AlertTriangle, FileText } from "lucide-react";
import { toast } from "sonner";
import { unwrapDueDiligence } from "@shared/dueDiligence";
import { buildAccountsAnalysis, parseCreditsafeStatements } from "@shared/accountsAnalysisBuild";

const gbp = (n: number | undefined | null) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0 }).format(n);

// Company Accounts — two independent sources of the same underlying data:
// Creditsafe's structured financial statements (already pulled, free to read),
// and an uploaded statutory-accounts PDF (parsed + AI-analyzed on demand, since
// that hits the same AI governance/consent path as the rest of underwriting).
export function AccountsAnalysis({ prospect }: { prospect: ProspectWithCompany }) {
  const prospectId = prospect.id!;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: dueDiligenceRaw } = useQuery<unknown>({
    queryKey: [`/api/prospects/${prospectId}/due-diligence`],
  });
  const dueDiligenceData = unwrapDueDiligence(dueDiligenceRaw);
  const underwriting = dueDiligenceData.underwriting || {};
  const statements = parseCreditsafeStatements(prospect.company?.creditsafeReport);
  const loanPounds = (prospect.loanAmount || 0) > 1000 ? (prospect.loanAmount || 0) / 100 : Number(prospect.loanAmount || 0);
  const accountsAnalysis = buildAccountsAnalysis({
    statements,
    caseNotes: prospect.notes || "",
    financeMonthly: Number((underwriting as any).affordabilitySweep?.financeMonthly || 0),
    loanPounds,
    ai: (underwriting as any).accountsAnalysis,
  });
  const auditedYears = accountsAnalysis.years;
  const accountRatios = accountsAnalysis.ratios;
  const notesToAccounts = accountsAnalysis.notesToAccounts;
  const riskLabel = accountsAnalysis.riskAssessment;
  const dscrValue =
    Number(accountsAnalysis.dscr?.average || 0) ||
    Number((underwriting as any).affordabilitySweep?.dscrCurrent || 0);

  const [loanAmount, setLoanAmount] = useState(
    String((underwriting.loanDetails?.amount ?? prospect.loanAmount ?? 0) / 100)
  );
  const [monthlyRepayment, setMonthlyRepayment] = useState(
    String((underwriting.loanDetails?.monthlyRepayment ?? 0) / 100)
  );
  const [isParsing, setIsParsing] = useState(false);

  const { data: documents = [] } = useQuery<{ id: number; fileName: string; category?: string | null }[]>({
    queryKey: [`/api/prospects/${prospectId}/documents`],
  });
  const accountDocs = documents.filter((doc) => {
    const cat = String(doc.category || "");
    const name = doc.fileName || "";
    return (
      /account|cashflow|forecast|management/i.test(`${cat} ${name}`) ||
      /\.(xlsx|xlsm|csv)$/i.test(name)
    );
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        `/api/prospects/${prospectId}/underwriting/analyze-accounts-documents`,
        "POST",
        {
          loanAmount: Number(loanAmount) || undefined,
          monthlyRepayment: Number(monthlyRepayment) || undefined,
          consentToAiProcessing: true,
        }
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospectId}/due-diligence`] });
      toast.success("Accounts analyzed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleFiles = async (files: FileList) => {
    setIsParsing(true);
    try {
      for (const file of Array.from(files)) {
        await storeProspectFile(prospectId, file, "accounts");
      }
      setIsParsing(false);
      analyzeMutation.mutate();
    } catch (error: any) {
      setIsParsing(false);
      toast.error(error.message || "Failed to upload accounts PDF");
    }
  };

  const financialStatements: any[] = (() => {
    if (!prospect.company.creditsafeReport) return [];
    try {
      return JSON.parse(prospect.company.creditsafeReport)?.report?.financialStatements || [];
    } catch {
      return [];
    }
  })();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Creditsafe Financial Statements</CardTitle>
          <CardDescription>Structured accounts data — no upload needed if already pulled</CardDescription>
        </CardHeader>
        <CardContent>
          {financialStatements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Not available yet — pull a credit report from the Integrations tab above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">Year End</th>
                    <th className="py-2 pr-4">Turnover</th>
                    <th className="py-2 pr-4">Operating Profit</th>
                    <th className="py-2 pr-4">Profit Before Tax</th>
                    <th className="py-2 pr-4">Total Assets</th>
                    <th className="py-2 pr-4">Total Liabilities</th>
                    <th className="py-2 pr-4">Shareholders Equity</th>
                    <th className="py-2 pr-4">Current Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {financialStatements.map((fs: any, i: number) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">
                        {fs.yearEndDate ? new Date(fs.yearEndDate).toLocaleDateString("en-GB") : "—"}
                      </td>
                      <td className="py-2 pr-4">{fs.profitAndLoss?.revenue != null ? gbp(fs.profitAndLoss.revenue) : "—"}</td>
                      <td className="py-2 pr-4">{fs.profitAndLoss?.operatingProfit != null ? gbp(fs.profitAndLoss.operatingProfit) : "—"}</td>
                      <td className="py-2 pr-4">{fs.profitAndLoss?.profitBeforeTax != null ? gbp(fs.profitAndLoss.profitBeforeTax) : "—"}</td>
                      <td className="py-2 pr-4">{fs.balanceSheet?.totalAssets != null ? gbp(fs.balanceSheet.totalAssets) : "—"}</td>
                      <td className="py-2 pr-4">{fs.balanceSheet?.totalLiabilities != null ? gbp(fs.balanceSheet.totalLiabilities) : "—"}</td>
                      <td className="py-2 pr-4">{fs.balanceSheet?.totalShareholdersEquity != null ? gbp(fs.balanceSheet.totalShareholdersEquity) : "—"}</td>
                      <td className="py-2 pr-4">{fs.ratios?.currentRatio ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company accounts analysis</CardTitle>
          <CardDescription>
            Balance sheet from Creditsafe (micro-entity filings have no public P&L). Notes commentary is the case file against those figures. Analyse PDFs to pull statutory notes from the scans.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {accountDocs.length > 0 && (
            <ul className="text-sm space-y-1">
              {accountDocs.map((doc) => (
                <li key={doc.id}>
                  <a
                    href={`/api/prospects/${prospectId}/documents/${doc.id}/download`}
                    className="text-primary underline-offset-2 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {doc.fileName}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {accountDocs.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => analyzeMutation.mutate()}
              disabled={isParsing || analyzeMutation.isPending}
            >
              Analyse accounts on file
            </Button>
          )}
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div>
              <Label htmlFor="loan-amount">Loan Amount (£)</Label>
              <Input id="loan-amount" type="number" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="monthly-repayment">Monthly Repayment (£)</Label>
              <Input id="monthly-repayment" type="number" value={monthlyRepayment} onChange={(e) => setMonthlyRepayment(e.target.value)} />
            </div>
          </div>

          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="accounts_upload">Upload accounts (PDF, Excel, CSV)</Label>
            <Input
              id="accounts_upload"
              type="file"
              accept=".pdf,.xlsx,.xlsm,.csv"
              multiple
              ref={fileInputRef}
              disabled={isParsing || analyzeMutation.isPending}
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </div>

          {(isParsing || analyzeMutation.isPending) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isParsing ? "Extracting PDF text..." : "Analyzing with AI..."}
            </div>
          )}

          {(auditedYears.length > 0 || notesToAccounts.length > 0) && (
            <div className="rounded-md border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <Badge
                  variant={
                    String(riskLabel).toLowerCase() === "low" || String(riskLabel).toLowerCase() === "a" || String(riskLabel).toLowerCase() === "b"
                      ? "default"
                      : String(riskLabel).toLowerCase() === "high" || String(riskLabel).toLowerCase() === "d" || String(riskLabel).toLowerCase() === "e"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {riskLabel || "Unknown"} risk
                </Badge>
                {dscrValue > 0 && <span className="text-sm text-muted-foreground">DSCR (bank): {dscrValue.toFixed(2)}x</span>}
              </div>
              {accountsAnalysis.auditorOpinion && (
                <p className="text-sm text-muted-foreground">{accountsAnalysis.auditorOpinion}</p>
              )}
              {accountsAnalysis.summary && (
                <p className="text-sm font-medium">{accountsAnalysis.summary}</p>
              )}
              {auditedYears.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-1 pr-4">Year</th>
                        <th className="py-1 pr-4">Turnover</th>
                        <th className="py-1 pr-4">Net profit</th>
                        <th className="py-1 pr-4">Cash</th>
                        <th className="py-1 pr-4">Debtors</th>
                        <th className="py-1 pr-4">Creditors</th>
                        <th className="py-1 pr-4">Bank loans</th>
                        <th className="py-1 pr-4">Net assets</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditedYears.map((year: any, i: number) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-1 pr-4">{year.yearEnding || year.year || "—"}</td>
                          <td className="py-1 pr-4">{gbp(year.turnover)}</td>
                          <td className="py-1 pr-4">{gbp(year.netProfit)}</td>
                          <td className="py-1 pr-4">{gbp(year.cashAndEquivalents)}</td>
                          <td className="py-1 pr-4">{gbp(year.debtors)}</td>
                          <td className="py-1 pr-4">{gbp(year.creditors)}</td>
                          <td className="py-1 pr-4">{gbp(year.bankLoans)}</td>
                          <td className="py-1 pr-4">{gbp(year.netAssets ?? year.shareholderFunds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {accountRatios.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Key credit ratios</h4>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                          <th className="p-2">Year</th>
                          <th className="p-2">Gross margin</th>
                          <th className="p-2">Net margin</th>
                          <th className="p-2">Current ratio</th>
                          <th className="p-2">Quick ratio</th>
                          <th className="p-2">Debt / equity</th>
                          <th className="p-2">Interest cover</th>
                          <th className="p-2">Debtor days</th>
                          <th className="p-2">Creditor days</th>
                          <th className="p-2">ROCE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accountRatios.map((entry: any, index: number) => {
                          const ratios = entry?.ratios || entry;
                          const display = (key: string, suffix = "x") => {
                            const value = ratios?.[key];
                            return value === null || value === undefined || value === "" ? "—" : `${value}${suffix}`;
                          };
                          return (
                            <tr key={index} className="border-b last:border-0">
                              <td className="p-2 font-medium">{entry?.year || entry?.yearEnding || "—"}</td>
                              <td className="p-2">{display("grossProfitMargin", "%")}</td>
                              <td className="p-2">{display("netProfitMargin", "%")}</td>
                              <td className="p-2">{display("currentRatio")}</td>
                              <td className="p-2">{display("quickRatio")}</td>
                              <td className="p-2">{display("debtToEquity")}</td>
                              <td className="p-2">{display("interestCover")}</td>
                              <td className="p-2">{display("debtorDays", " days")}</td>
                              <td className="p-2">{display("creditorDays", " days")}</td>
                              <td className="p-2">{display("returnOnCapitalEmployed", "%")}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {notesToAccounts.length > 0 && (
                <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/20">
                  <h4 className="font-medium text-amber-900 dark:text-amber-300">Commentary on Notes</h4>
                  <ul className="space-y-2 text-sm">
                    {notesToAccounts.map((item: any, index: number) => {
                      const assessment = String(item?.assessment || "clarification_required").replaceAll("_", " ");
                      return (
                        <li key={index} className="border-t border-amber-200 pt-2 first:border-0 first:pt-0 dark:border-amber-900">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={assessment === "inconsistent" ? "destructive" : "secondary"}>{assessment}</Badge>
                            {item?.severity && <span className="text-xs uppercase text-muted-foreground">{item.severity}</span>}
                          </div>
                          {item?.note && <p className="mt-1"><span className="font-medium">Note:</span> {item.note}</p>}
                          {item?.accountsEvidence && <p><span className="font-medium">Accounts evidence:</span> {item.accountsEvidence}</p>}
                          {item?.action && <p><span className="font-medium">Raise:</span> {item.action}</p>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {accountsAnalysis.concerns?.length > 0 && (
                <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <ul className="list-disc list-inside">
                    {accountsAnalysis.concerns.map((c, i) => (
                      <li key={`c-${i}`}>{c.description}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AccountsAnalysis;
