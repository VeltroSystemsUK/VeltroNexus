import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { storeProspectFile } from "@/lib/storeProspectFile";
import type { ProspectWithCompany, DueDiligenceData } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload, Loader2, AlertTriangle, FileText } from "lucide-react";
import { toast } from "sonner";

const gbp = (n: number | undefined | null) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0 }).format(n || 0);

// Company Accounts — two independent sources of the same underlying data:
// Creditsafe's structured financial statements (already pulled, free to read),
// and an uploaded statutory-accounts PDF (parsed + AI-analyzed on demand, since
// that hits the same AI governance/consent path as the rest of underwriting).
export function AccountsAnalysis({ prospect }: { prospect: ProspectWithCompany }) {
  const prospectId = prospect.id!;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: dueDiligenceData } = useQuery<DueDiligenceData>({
    queryKey: [`/api/prospects/${prospectId}/due-diligence`],
  });
  const underwriting = dueDiligenceData?.underwriting || {};
  const accountsAnalysis = underwriting.accountsAnalysis as any;
  const auditedYears: any[] = Array.isArray(accountsAnalysis?.years) ? accountsAnalysis.years : [];
  const riskLabel = accountsAnalysis?.riskAssessment || accountsAnalysis?.riskScore;
  const dscrValue =
    typeof accountsAnalysis?.dscr === "number"
      ? accountsAnalysis.dscr
      : Number(accountsAnalysis?.dscr?.average || 0);

  const [loanAmount, setLoanAmount] = useState(
    String((underwriting.loanDetails?.amount ?? prospect.loanAmount ?? 0) / 100)
  );
  const [monthlyRepayment, setMonthlyRepayment] = useState(
    String((underwriting.loanDetails?.monthlyRepayment ?? 0) / 100)
  );
  const [isParsing, setIsParsing] = useState(false);

  const analyzeMutation = useMutation({
    mutationFn: async (pdfTexts: { year: string; text: string }[]) => {
      const res = await apiRequest(`/api/prospects/${prospectId}/underwriting/analyze-accounts`, "POST", {
        pdfTexts,
        loanAmount: Math.round(parseFloat(loanAmount || "0") * 100),
        monthlyRepayment: Math.round(parseFloat(monthlyRepayment || "0") * 100),
        consentToAiProcessing: true,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to analyze accounts");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospectId}/due-diligence`] });
      toast.success("Accounts analyzed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleFiles = async (files: FileList) => {
    if (!loanAmount || !monthlyRepayment) {
      toast.error("Enter loan amount and monthly repayment first — needed to calculate DSCR");
      return;
    }
    setIsParsing(true);
    try {
      const pdfTexts: { year: string; text: string }[] = [];
      for (const file of Array.from(files)) {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(new Uint8Array(arrayBuffer).reduce((s, b) => s + String.fromCharCode(b), ""));
        const res = await apiRequest("/api/parse-pdf", "POST", { pdfBase64: base64 });
        const data = await res.json();
        pdfTexts.push({ year: file.name, text: data.text || "" });
        storeProspectFile(prospectId, file, "accounts").catch((err) =>
          console.warn("Could not keep accounts PDF on the file:", err),
        );
      }
      setIsParsing(false);
      analyzeMutation.mutate(pdfTexts);
    } catch (error: any) {
      setIsParsing(false);
      toast.error(error.message || "Failed to parse PDF");
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
          <CardTitle>Statutory Accounts (PDF)</CardTitle>
          <CardDescription>Upload accounts PDFs for AI-assisted DSCR and risk analysis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <Label htmlFor="accounts_upload">Upload Accounts (PDF)</Label>
            <Input
              id="accounts_upload"
              type="file"
              accept=".pdf"
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

          {accountsAnalysis && (
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
                <span className="text-sm text-muted-foreground">DSCR: {dscrValue.toFixed(2)}x</span>
              </div>
              {accountsAnalysis.auditorOpinion && (
                <p className="text-sm text-muted-foreground">Auditor: {accountsAnalysis.auditorOpinion}</p>
              )}
              <p className="text-sm">{accountsAnalysis.summary}</p>
              {auditedYears.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-1 pr-4">Year</th>
                        <th className="py-1 pr-4">Turnover</th>
                        <th className="py-1 pr-4">Gross Profit</th>
                        <th className="py-1 pr-4">Net Profit</th>
                        <th className="py-1 pr-4">Net Assets</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditedYears.map((year: any, i: number) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-1 pr-4">{year.yearEnding || year.year || "—"}</td>
                          <td className="py-1 pr-4">{gbp(year.turnover)}</td>
                          <td className="py-1 pr-4">{gbp(year.grossProfit)}</td>
                          <td className="py-1 pr-4">{gbp(year.netProfit)}</td>
                          <td className="py-1 pr-4">{gbp(year.netAssets ?? year.shareholderFunds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {accountsAnalysis.profitAndLoss && (
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground">Turnover</span>
                    <p className="font-medium">{gbp(accountsAnalysis.profitAndLoss.turnover)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Gross Profit</span>
                    <p className="font-medium">{gbp(accountsAnalysis.profitAndLoss.grossProfit)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Net Profit</span>
                    <p className="font-medium">{gbp(accountsAnalysis.profitAndLoss.netProfit)}</p>
                  </div>
                </div>
              )}
              {(accountsAnalysis.concerns?.length > 0 || accountsAnalysis.redFlags?.some((f: any) => typeof f === "string" || f.isActive)) && (
                <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <ul className="list-disc list-inside">
                    {(accountsAnalysis.concerns || []).map((c: any, i: number) => (
                      <li key={`c-${i}`}>{typeof c === "string" ? c : c.description}</li>
                    ))}
                    {(accountsAnalysis.redFlags || [])
                      .filter((f: any) => typeof f === "string" || f.isActive)
                      .map((f: any, i: number) => (
                        <li key={`f-${i}`}>{typeof f === "string" ? f : f.label}</li>
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
