import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Slider } from "@/components/ui/slider";
import { CheckCircle2, AlertCircle, XCircle, Save, Calculator, TrendingUp, Target, FileText, User, AlertTriangle, Search, ExternalLink, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";

import { CHECKLIST_SECTIONS } from "@shared/checklistData";
import { resolveHandoverPack, type HandoverAnswer } from "@shared/handoverPack";
import type { ChecklistItem, DueDiligenceData } from "@shared/schema";
import {
  calculateLoan,
  calculateHirePurchase,
  calculateDSCR,
  calculateAffordability,
  calculateFinancialRatios,
  calculateCharacterScore,
  formatCurrency,
  formatPercent,
  formatRatio,
} from "@/lib/calculators";

interface DueDiligenceToolsProps {
  prospectId: number;
  data: DueDiligenceData;
  onSave: (data: Partial<DueDiligenceData>) => void;
  isSaving: boolean;
}

function packToChecklist(saved: unknown): ChecklistItem[] {
  return resolveHandoverPack(saved).sections.flatMap((section) =>
    section.items.map((item) => ({
      sectionId: section.id,
      itemId: item.id,
      description: item.question,
      completed: item.answer === "yes",
      answer: item.answer,
      notes: item.notes,
    })),
  );
}

export function DueDiligenceChecklist({
  data,
  onSave,
  isSaving,
}: Omit<DueDiligenceToolsProps, "prospectId">) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => packToChecklist(data.checklist));

  useEffect(() => {
    setChecklist(packToChecklist(data.checklist));
  }, [data.checklist]);

  const persist = (updated: ChecklistItem[]) => {
    setChecklist(updated);
    onSave({ checklist: updated });
  };

  const setAnswer = (itemId: string, answer: HandoverAnswer) => {
    persist(
      checklist.map((item) =>
        item.itemId === itemId
          ? { ...item, answer, completed: answer === "yes" }
          : item,
      ),
    );
  };

  const setNotes = (itemId: string, notes: string) => {
    persist(checklist.map((item) => (item.itemId === itemId ? { ...item, notes } : item)));
  };

  const answeredItems = checklist.filter((item) => item.answer).length;
  const totalItems = checklist.length;
  const overallProgress = totalItems > 0 ? Math.round((answeredItems / totalItems) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Handover pack</CardTitle>
            <CardDescription>
              Answer every question. This pack goes to Sterling with the file — Yes, No, N/A and your notes.
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{overallProgress}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {answeredItems} of {totalItems} answered
            </p>
            <Progress value={overallProgress} className="w-24 mt-1" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" defaultValue={[CHECKLIST_SECTIONS[0].id]} className="space-y-2">
          {CHECKLIST_SECTIONS.map((section) => {
            const sectionItems = checklist.filter((item) => item.sectionId === section.id);
            const answered = sectionItems.filter((item) => item.answer).length;
            const progress = sectionItems.length
              ? Math.round((answered / sectionItems.length) * 100)
              : 0;
            return (
              <AccordionItem key={section.id} value={section.id} className="border rounded-md px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <span className="font-medium">{section.name}</span>
                    <Badge variant={progress === 100 ? "default" : "secondary"}>{progress}%</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    {sectionItems.map((item) => (
                      <div key={item.itemId} className="space-y-2 border-b pb-3 last:border-0">
                        <p className="text-sm">{item.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {(["yes", "no", "na"] as const).map((value) => (
                            <Button
                              key={value}
                              type="button"
                              size="sm"
                              variant={item.answer === value ? "default" : "outline"}
                              disabled={isSaving}
                              onClick={() => setAnswer(item.itemId, value)}
                              data-testid={`handover-answer-${item.itemId}-${value}`}
                            >
                              {value === "yes" ? "Yes" : value === "no" ? "No" : "N/A"}
                            </Button>
                          ))}
                        </div>
                        <Textarea
                          value={item.notes || ""}
                          placeholder="Note for Sterling (optional)"
                          className="min-h-[64px] text-sm"
                          onChange={(e) => {
                            const notes = e.target.value;
                            setChecklist((current) =>
                              current.map((row) =>
                                row.itemId === item.itemId ? { ...row, notes } : row,
                              ),
                            );
                          }}
                          onBlur={(e) => setNotes(item.itemId, e.target.value)}
                          data-testid={`handover-notes-${item.itemId}`}
                        />
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}

export function LoanCalculatorTool({
  data,
  onSave,
  isSaving,
}: Omit<DueDiligenceToolsProps, "prospectId">) {
  const [loanAmount, setLoanAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [term, setTerm] = useState("");
  const [commissionRate, setCommissionRate] = useState("");
  const [documentationFee, setDocumentationFee] = useState("");
  const [addDocFeeToLoan, setAddDocFeeToLoan] = useState(false);
  const [legalFee, setLegalFee] = useState("");

  useEffect(() => {
    setLoanAmount(data.loanCalculator?.loanAmount?.toString() || "");
    setInterestRate(data.loanCalculator?.interestRate?.toString() || "");
    setTerm(data.loanCalculator?.term?.toString() || "");
    setCommissionRate(data.loanCalculator?.commissionRate?.toString() || "");
    setDocumentationFee(data.loanCalculator?.documentationFee?.toString() || "");
    setAddDocFeeToLoan(data.loanCalculator?.addDocFeeToLoan || false);
    setLegalFee(data.loanCalculator?.legalFee?.toString() || "");
  }, [data.loanCalculator]);

  const calculation =
    loanAmount && interestRate && term
      ? calculateLoan(
        parseFloat(loanAmount),
        parseFloat(interestRate),
        parseInt(term),
        commissionRate ? parseFloat(commissionRate) : undefined,
        documentationFee ? parseFloat(documentationFee) : 0,
        addDocFeeToLoan,
        legalFee ? parseFloat(legalFee) : 0
      )
      : null;

  const handleSave = () => {
    onSave({
      loanCalculator: {
        loanAmount: loanAmount ? parseFloat(loanAmount) : undefined,
        interestRate: interestRate ? parseFloat(interestRate) : undefined,
        term: term ? parseInt(term) : undefined,
        commissionRate: commissionRate ? parseFloat(commissionRate) : undefined,
        documentationFee: documentationFee ? parseFloat(documentationFee) : undefined,
        addDocFeeToLoan,
        legalFee: legalFee ? parseFloat(legalFee) : undefined,
      },
    });
  };

  return (
    <Card className="h-full border-none shadow-none">
      <CardHeader className="px-0 pt-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Loan Calculator</CardTitle>
            <CardDescription>Calculate monthly payments and total costs</CardDescription>
          </div>
          {calculation && (
            <Button onClick={handleSave} disabled={isSaving} size="sm" className="gap-2">
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save Assessment"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="loan-amount">Loan Amount (£)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground">£</span>
                    <Input
                      id="loan-amount"
                      type="number"
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(e.target.value)}
                      className="pl-7"
                      placeholder="250000"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commission-rate">Commission (%)</Label>
                  <div className="relative">
                    <Input
                      id="commission-rate"
                      type="number"
                      step="0.1"
                      className="pr-8"
                      value={commissionRate}
                      onChange={(e) => setCommissionRate(e.target.value)}
                      placeholder="1.0"
                    />
                    <span className="absolute right-3 top-2.5 text-muted-foreground">%</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="interest-rate">Interest Rate (%)</Label>
                  <div className="relative">
                    <Input
                      id="interest-rate"
                      type="number"
                      step="0.1"
                      className="pr-8"
                      value={interestRate}
                      onChange={(e) => setInterestRate(e.target.value)}
                      placeholder="7.5"
                    />
                    <span className="absolute right-3 top-2.5 text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="term">Term (months)</Label>
                  <Input
                    id="term"
                    type="number"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="36"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-2 border-t mt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="doc-fee">Documentation Fee (£)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">£</span>
                      <Input
                        id="doc-fee"
                        type="number"
                        className="pl-7"
                        value={documentationFee}
                        onChange={(e) => setDocumentationFee(e.target.value)}
                        placeholder="500"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legal-fee">Legal Fees (£)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">£</span>
                      <Input
                        id="legal-fee"
                        type="number"
                        className="pl-7"
                        value={legalFee}
                        onChange={(e) => setLegalFee(e.target.value)}
                        placeholder="1000"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-dashed text-sm">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">Add Documentation Fee to Loan</span>
                    <span className="text-xs text-muted-foreground">Interest will be charged on this fee</span>
                  </div>
                  <Switch
                    checked={addDocFeeToLoan}
                    onCheckedChange={setAddDocFeeToLoan}
                  />
                </div>
              </div>
            </div>

            {!calculation && (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                <Calculator className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p>Enter loan details to see calculation</p>
              </div>
            )}
          </div>

          {calculation && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-xl bg-primary/5 p-6 border border-primary/10">
                <div className="text-sm font-medium text-muted-foreground mb-1">Monthly Payment</div>
                <div className="text-4xl font-bold text-primary tracking-tight">
                  {formatCurrency(calculation.monthlyPayment)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="text-sm text-muted-foreground mb-1">Total Interest</div>
                  <div className="font-semibold text-lg">{formatCurrency(calculation.totalInterest)}</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="text-sm text-muted-foreground mb-1">Facility Fee</div>
                  <div className="font-semibold text-lg">{formatCurrency(calculation.facilityFee)}</div>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  Schedule of Costs
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Facility Fee (3.5%)</span>
                    <span className="font-medium">{formatCurrency(calculation.facilityFee)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Documentation Fee</span>
                    <span className="font-medium">{formatCurrency(calculation.documentationFee || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Legal Fees (Est)</span>
                    <span className="font-medium">{formatCurrency(calculation.legalFee || 0)}</span>
                  </div>
                  {calculation.commissionAmount !== undefined && calculation.commissionAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Broker Commission</span>
                      <span className="font-medium">{formatCurrency(calculation.commissionAmount)}</span>
                    </div>
                  )}
                  {addDocFeeToLoan && (calculation.documentationFee || 0) > 0 && (
                    <div className="mt-2 p-2 rounded bg-amber-50 border border-amber-100 flex gap-2 text-[11px] text-amber-800">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Documentation fee capitalized to principal.
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t flex justify-between items-end">
                <span className="text-muted-foreground font-medium">Total Repayment</span>
                <span className="text-xl font-bold">{formatCurrency(calculation.totalRepayment)}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function HirePurchaseCalculatorTool({
  data,
  onSave,
  isSaving,
}: Omit<DueDiligenceToolsProps, "prospectId">) {
  const [assetPrice, setAssetPrice] = useState("");
  const [deposit, setDeposit] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [term, setTerm] = useState("");
  const [commissionRate, setCommissionRate] = useState("");

  useEffect(() => {
    setAssetPrice(data.hirePurchase?.assetPrice?.toString() || "");
    setDeposit(data.hirePurchase?.deposit?.toString() || "");
    setInterestRate(data.hirePurchase?.interestRate?.toString() || "");
    setTerm(data.hirePurchase?.term?.toString() || "");
    setCommissionRate(data.hirePurchase?.commissionRate?.toString() || "");
  }, [data.hirePurchase]);

  const calculation =
    assetPrice && interestRate && term
      ? calculateHirePurchase(
        parseFloat(assetPrice),
        deposit ? parseFloat(deposit) : 0,
        parseFloat(interestRate),
        parseInt(term),
        commissionRate ? parseFloat(commissionRate) : undefined
      )
      : null;

  const handleSave = () => {
    onSave({
      hirePurchase: {
        assetPrice: assetPrice ? parseFloat(assetPrice) : undefined,
        deposit: deposit ? parseFloat(deposit) : undefined,
        interestRate: interestRate ? parseFloat(interestRate) : undefined,
        term: term ? parseInt(term) : undefined,
        commissionRate: commissionRate ? parseFloat(commissionRate) : undefined,
      },
    });
  };

  return (
    <Card className="h-full border-none shadow-none">
      <CardHeader className="px-0 pt-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Hire Purchase Calculator</CardTitle>
            <CardDescription>Calculate HP monthly payments and total costs</CardDescription>
          </div>
          {calculation && (
            <Button onClick={handleSave} disabled={isSaving} size="sm" className="gap-2">
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save Assessment"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="asset-price">Asset Price (£)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">£</span>
                  <Input
                    id="asset-price"
                    type="number"
                    value={assetPrice}
                    onChange={(e) => setAssetPrice(e.target.value)}
                    className="pl-7"
                    placeholder="50000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deposit">Deposit (£)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">£</span>
                  <Input
                    id="deposit"
                    type="number"
                    value={deposit}
                    onChange={(e) => setDeposit(e.target.value)}
                    className="pl-7"
                    placeholder="10000"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hp-interest-rate">Interest Rate (%)</Label>
                  <div className="relative">
                    <Input
                      id="hp-interest-rate"
                      type="number"
                      step="0.1"
                      className="pr-8"
                      value={interestRate}
                      onChange={(e) => setInterestRate(e.target.value)}
                      placeholder="6.5"
                    />
                    <span className="absolute right-3 top-2.5 text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hp-term">Term (months)</Label>
                  <Input
                    id="hp-term"
                    type="number"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="36"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hp-commission-rate">Commission (%)</Label>
                <div className="relative">
                  <Input
                    id="hp-commission-rate"
                    type="number"
                    step="0.1"
                    className="pr-8"
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(e.target.value)}
                    placeholder="1.0"
                  />
                  <span className="absolute right-3 top-2.5 text-muted-foreground">%</span>
                </div>
              </div>
            </div>

            {!calculation && (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                <Calculator className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p>Enter HP details to see calculation</p>
              </div>
            )}
          </div>

          {calculation && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-xl bg-primary/5 p-6 border border-primary/10">
                <div className="text-sm font-medium text-muted-foreground mb-1">Monthly Payment</div>
                <div className="text-4xl font-bold text-primary tracking-tight">
                  {formatCurrency(calculation.monthlyPayment)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="text-sm text-muted-foreground mb-1">Total Interest</div>
                  <div className="font-semibold text-lg">{formatCurrency(calculation.totalInterest)}</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="text-sm text-muted-foreground mb-1">Option Fee</div>
                  <div className="font-semibold text-lg">{formatCurrency(calculation.optionToPurchaseFee)}</div>
                </div>
              </div>

              {calculation.commissionAmount !== undefined && (
                <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100">
                  <div className="text-sm text-emerald-600 mb-1 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> Commission
                  </div>
                  <div className="font-bold text-lg text-emerald-700">{formatCurrency(calculation.commissionAmount)}</div>
                </div>
              )}

              <div className="pt-4 border-t flex justify-between items-end">
                <span className="text-muted-foreground font-medium">Total Repayment</span>
                <span className="text-xl font-bold">{formatCurrency(calculation.totalRepayment)}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function DSCRCalculatorTool({
  data,
  onSave,
  isSaving,
}: Omit<DueDiligenceToolsProps, "prospectId">) {
  const [noi, setNoi] = useState("");
  const [debtService, setDebtService] = useState("");
  const [sensitivity, setSensitivity] = useState("-20");

  useEffect(() => {
    setNoi(data.dscr?.annualNetOperatingIncome?.toString() || "");
    setDebtService(data.dscr?.annualDebtService?.toString() || "");
    setSensitivity(data.dscr?.sensitivityRevenue?.toString() || "-20");
  }, [data.dscr]);

  const calculation =
    noi && debtService
      ? calculateDSCR(parseFloat(noi), parseFloat(debtService), parseFloat(sensitivity))
      : null;

  const handleSave = () => {
    onSave({
      dscr: {
        annualNetOperatingIncome: noi ? parseFloat(noi) : undefined,
        annualDebtService: debtService ? parseFloat(debtService) : undefined,
        sensitivityRevenue: sensitivity ? parseFloat(sensitivity) : undefined,
      },
    });
  };

  const getStatusColor = (status: "pass" | "warning" | "fail") => {
    if (status === "pass") return "bg-green-500/10 text-green-700 border-green-200";
    if (status === "warning") return "bg-amber-500/10 text-amber-700 border-amber-200";
    return "bg-red-500/10 text-red-700 border-red-200";
  };

  return (
    <Card className="h-full border-none shadow-none">
      <CardHeader className="px-0 pt-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>DSCR Calculator</CardTitle>
            <CardDescription>Debt Service Coverage Ratio assessment</CardDescription>
          </div>
          {calculation && (
            <Button onClick={handleSave} disabled={isSaving} size="sm" className="gap-2">
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save Assessment"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="noi">Annual Net Operating Income (£)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">£</span>
                  <Input
                    id="noi"
                    type="number"
                    className="pl-7"
                    value={noi}
                    onChange={(e) => setNoi(e.target.value)}
                    placeholder="250000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="debt-service">Annual Debt Service (£)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">£</span>
                  <Input
                    id="debt-service"
                    type="number"
                    className="pl-7"
                    value={debtService}
                    onChange={(e) => setDebtService(e.target.value)}
                    placeholder="150000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sensitivity">Sensitivity Revenue Change (%)</Label>
                <div className="relative">
                  <Input
                    id="sensitivity"
                    type="number"
                    step="1"
                    className="pr-8"
                    value={sensitivity}
                    onChange={(e) => setSensitivity(e.target.value)}
                    placeholder="-20"
                  />
                  <span className="absolute right-3 top-2.5 text-muted-foreground">%</span>
                </div>
              </div>
            </div>
            {!calculation && (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                <TrendingUp className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p>Enter income and debt details</p>
              </div>
            )}
          </div>

          {calculation && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className={`rounded-xl border p-6 ${getStatusColor(calculation.status)}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium opacity-80">Base DSCR</div>
                  {calculation.status === "pass" && <CheckCircle2 className="w-5 h-5" />}
                  {calculation.status === "warning" && <AlertCircle className="w-5 h-5" />}
                  {calculation.status === "fail" && <XCircle className="w-5 h-5" />}
                </div>
                <div className="text-4xl font-bold tracking-tight">
                  {formatRatio(calculation.dscr)}×
                </div>
                <div className="text-xs font-medium mt-2 opacity-90">
                  {calculation.status === "pass" && "✓ Meets requirement (≥1.5×)"}
                  {calculation.status === "warning" && "⚠ Warning (1.0-1.5×)"}
                  {calculation.status === "fail" && "✗ Below minimum (< 1.0×)"}
                </div>
              </div>

              {calculation.sensitivityDSCR !== undefined && calculation.sensitivityStatus && (
                <div className={`rounded-xl border p-6 ${getStatusColor(calculation.sensitivityStatus)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium opacity-80">Stress Test ({sensitivity}%)</div>
                    {calculation.sensitivityStatus === "pass" && <CheckCircle2 className="w-4 h-4" />}
                    {calculation.sensitivityStatus === "warning" && <AlertCircle className="w-4 h-4" />}
                    {calculation.sensitivityStatus === "fail" && <XCircle className="w-4 h-4" />}
                  </div>
                  <div className="text-3xl font-bold tracking-tight">
                    {formatRatio(calculation.sensitivityDSCR)}×
                  </div>
                  <div className="text-xs font-medium mt-2 opacity-90">
                    {calculation.sensitivityStatus === "pass" && "✓ Stress test passed"}
                    {calculation.sensitivityStatus === "warning" && "⚠ Marginal under stress"}
                    {calculation.sensitivityStatus === "fail" && "✗ Fails stress test"}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AffordabilityEstimatorTool({
  data,
  onSave,
  isSaving,
}: Omit<DueDiligenceToolsProps, "prospectId">) {
  const [revenue, setRevenue] = useState("");
  const [ebitda, setEbitda] = useState("");
  const [loanPayment, setLoanPayment] = useState("");
  const [existingDebt, setExistingDebt] = useState("");

  useEffect(() => {
    setRevenue(data.affordability?.annualRevenue?.toString() || "");
    setEbitda(data.affordability?.annualEbitda?.toString() || "");
    setLoanPayment(data.affordability?.monthlyLoanPayment?.toString() || "");
    setExistingDebt(data.affordability?.existingMonthlyDebt?.toString() || "");
  }, [data.affordability]);

  const calculation =
    revenue && ebitda && loanPayment && existingDebt
      ? calculateAffordability(
        parseFloat(revenue),
        parseFloat(ebitda),
        parseFloat(loanPayment),
        parseFloat(existingDebt)
      )
      : null;

  const handleSave = () => {
    onSave({
      affordability: {
        annualRevenue: revenue ? parseFloat(revenue) : undefined,
        annualEbitda: ebitda ? parseFloat(ebitda) : undefined,
        monthlyLoanPayment: loanPayment ? parseFloat(loanPayment) : undefined,
        existingMonthlyDebt: existingDebt ? parseFloat(existingDebt) : undefined,
      },
    });
  };

  return (
    <Card className="h-full border-none shadow-none">
      <CardHeader className="px-0 pt-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Business Affordability Estimator</CardTitle>
            <CardDescription>Assess repayment capacity based on EBITDA</CardDescription>
          </div>
          {calculation && (
            <Button
              onClick={handleSave}
              disabled={isSaving}
              size="sm"
              className="gap-2"
              data-testid="button-save-affordability"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save Assessment"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="revenue">Annual Revenue (£)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">£</span>
                  <Input
                    id="revenue"
                    type="number"
                    className="pl-7"
                    value={revenue}
                    onChange={(e) => setRevenue(e.target.value)}
                    placeholder="1000000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ebitda">Annual EBITDA (£)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">£</span>
                  <Input
                    id="ebitda"
                    type="number"
                    className="pl-7"
                    value={ebitda}
                    onChange={(e) => setEbitda(e.target.value)}
                    placeholder="200000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="loan-payment">Proposed Monthly Loan Payment (£)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">£</span>
                  <Input
                    id="loan-payment"
                    type="number"
                    className="pl-7"
                    value={loanPayment}
                    onChange={(e) => setLoanPayment(e.target.value)}
                    placeholder="5000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="existing-debt">Existing Monthly Debt Service (£)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">£</span>
                  <Input
                    id="existing-debt"
                    type="number"
                    className="pl-7"
                    value={existingDebt}
                    onChange={(e) => setExistingDebt(e.target.value)}
                    placeholder="2500"
                  />
                </div>
              </div>
            </div>
            {!calculation && (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                <Target className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p>Enter financial details to assess affordability</p>
              </div>
            )}
          </div>

          {calculation && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className={`rounded-xl border p-6 ${calculation.status === "pass" ? "bg-green-500/10 text-green-700 border-green-200" : "bg-red-500/10 text-red-700 border-red-200"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium opacity-80">Affordability Ratio</div>
                  {calculation.status === "pass" ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                </div>
                <div className="text-4xl font-bold tracking-tight">
                  {formatRatio(calculation.ratio)}×
                </div>
                <div className="text-xs font-medium mt-2 opacity-90">
                  {calculation.status === "pass"
                    ? "✓ Meets requirement (≥1.25×)"
                    : "✗ Below minimum (<1.25×)"}
                </div>
              </div>

              <div className={`rounded-xl border bg-card p-6 ${calculation.disposableIncome < 0 ? "border-red-200 bg-red-50" : ""}`}>
                <div className="text-sm font-medium text-muted-foreground mb-1">Disposable Income</div>
                <div className={`text-2xl font-bold tracking-tight ${calculation.disposableIncome < 0 ? "text-red-700" : "text-foreground"}`}>
                  {formatCurrency(calculation.disposableIncome)}
                </div>
                <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div>
                    <span className="block opacity-70">EBITDA</span>
                    <span className="font-medium text-foreground">{formatCurrency(parseFloat(ebitda))}</span>
                  </div>
                  <div>
                    <span className="block opacity-70">Debt Service</span>
                    <span className="font-medium text-foreground">{formatCurrency((parseFloat(existingDebt) + parseFloat(loanPayment)) * 12)}</span>
                  </div>
                  <div>
                    <span className="block opacity-70">DSCR</span>
                    <span className={`font-medium ${calculation.status === "fail" ? "text-red-600" : "text-green-600"}`}>
                      {calculation.ratio.toFixed(2)}x
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function FinancialRatiosCalculatorTool({
  data,
  onSave,
  isSaving,
}: Omit<DueDiligenceToolsProps, "prospectId">) {
  const [revenue, setRevenue] = useState("");
  const [costs, setCosts] = useState("");
  const [currentAssets, setCurrentAssets] = useState("");
  const [currentLiabilities, setCurrentLiabilities] = useState("");
  const [totalAssets, setTotalAssets] = useState("");
  const [totalLiabilities, setTotalLiabilities] = useState("");
  const [equity, setEquity] = useState("");

  useEffect(() => {
    setRevenue(data.financialRatios?.revenue?.toString() || "");
    setCosts(data.financialRatios?.costs?.toString() || "");
    setCurrentAssets(data.financialRatios?.currentAssets?.toString() || "");
    setCurrentLiabilities(data.financialRatios?.currentLiabilities?.toString() || "");
    setTotalAssets(data.financialRatios?.totalAssets?.toString() || "");
    setTotalLiabilities(data.financialRatios?.totalLiabilities?.toString() || "");
    setEquity(data.financialRatios?.equity?.toString() || "");
  }, [data.financialRatios]);

  const ratios = calculateFinancialRatios({
    revenue: revenue ? parseFloat(revenue) : undefined,
    costs: costs ? parseFloat(costs) : undefined,
    currentAssets: currentAssets ? parseFloat(currentAssets) : undefined,
    currentLiabilities: currentLiabilities ? parseFloat(currentLiabilities) : undefined,
    totalAssets: totalAssets ? parseFloat(totalAssets) : undefined,
    totalLiabilities: totalLiabilities ? parseFloat(totalLiabilities) : undefined,
    equity: equity ? parseFloat(equity) : undefined,
  });

  const handleSave = () => {
    onSave({
      financialRatios: {
        revenue: revenue ? parseFloat(revenue) : undefined,
        costs: costs ? parseFloat(costs) : undefined,
        currentAssets: currentAssets ? parseFloat(currentAssets) : undefined,
        currentLiabilities: currentLiabilities ? parseFloat(currentLiabilities) : undefined,
        totalAssets: totalAssets ? parseFloat(totalAssets) : undefined,
        totalLiabilities: totalLiabilities ? parseFloat(totalLiabilities) : undefined,
        equity: equity ? parseFloat(equity) : undefined,
      },
    });
  };

  return (
    <Card className="h-full border-none shadow-none">
      <CardHeader className="px-0 pt-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Financial Ratios Calculator</CardTitle>
            <CardDescription>Key business metrics analysis</CardDescription>
          </div>
          <Button onClick={handleSave} disabled={isSaving} size="sm" className="gap-2" data-testid="button-save-ratios">
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save Assessment"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Profit & Loss</h4>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="revenue">Annual Revenue</Label>
                  <Input id="revenue" type="number" value={revenue} onChange={(e) => setRevenue(e.target.value)} placeholder="1000000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="costs">Annual Costs</Label>
                  <Input id="costs" type="number" value={costs} onChange={(e) => setCosts(e.target.value)} placeholder="750000" />
                </div>
              </div>

              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-6">Balance Sheet</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="current-assets" className="text-xs">Current Assets</Label>
                  <Input id="current-assets" type="number" value={currentAssets} onChange={(e) => setCurrentAssets(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="current-liabilities" className="text-xs">Current Liab.</Label>
                  <Input id="current-liabilities" type="number" value={currentLiabilities} onChange={(e) => setCurrentLiabilities(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total-assets" className="text-xs">Total Assets</Label>
                  <Input id="total-assets" type="number" value={totalAssets} onChange={(e) => setTotalAssets(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total-liabilities" className="text-xs">Total Liab.</Label>
                  <Input id="total-liabilities" type="number" value={totalLiabilities} onChange={(e) => setTotalLiabilities(e.target.value)} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="equity">Equity</Label>
                  <Input id="equity" type="number" value={equity} onChange={(e) => setEquity(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Results</h4>
              <div className="grid grid-cols-1 gap-3">
                <div className="p-4 border rounded-xl bg-card flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Current Ratio</div>
                    <div className="text-xs text-muted-foreground">Target: &gt; 1.5</div>
                  </div>
                  <div className="text-xl font-bold">{ratios.currentRatio !== undefined ? formatRatio(ratios.currentRatio) : "-"}</div>
                </div>
                <div className="p-4 border rounded-xl bg-card flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Debt-to-Equity</div>
                    <div className="text-xs text-muted-foreground">Lower is better</div>
                  </div>
                  <div className="text-xl font-bold">{ratios.debtToEquity !== undefined ? formatRatio(ratios.debtToEquity) : "-"}</div>
                </div>
                <div className="p-4 border rounded-xl bg-card flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Profit Margin</div>
                    <div className="text-xs text-muted-foreground">Higher is better</div>
                  </div>
                  <div className="text-xl font-bold">{ratios.profitMargin !== undefined ? formatPercent(ratios.profitMargin) : "-"}</div>
                </div>
                <div className="p-4 border rounded-xl bg-card flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Return on Equity</div>
                    <div className="text-xs text-muted-foreground">Target: &gt; 15%</div>
                  </div>
                  <div className="text-xl font-bold">{ratios.roe !== undefined ? formatPercent(ratios.roe) : "-"}</div>
                </div>
                <div className="p-4 border rounded-xl bg-card flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Asset Turnover</div>
                    <div className="text-xs text-muted-foreground">Higher is better</div>
                  </div>
                  <div className="text-xl font-bold">{ratios.assetTurnover !== undefined ? formatRatio(ratios.assetTurnover) : "-"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CharacterAssessmentTool({
  data,
  onSave,
  isSaving,
}: Omit<DueDiligenceToolsProps, "prospectId">) {
  const [managementExp, setManagementExp] = useState(3);
  const [creditHistory, setCreditHistory] = useState(3);
  const [bankConduct, setBankConduct] = useState(3);
  const [contracts, setContracts] = useState(3);
  const [notes, setNotes] = useState("");
  const [hmrcTimeToPay, setHmrcTimeToPay] = useState<"none" | "active" | "historic">("none");
  const [personName, setPersonName] = useState("");
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [investigation, setInvestigation] = useState<{
    web: { answer: string; results: { title: string; url: string; content: string }[] };
    social: { answer: string; results: { title: string; url: string; content: string }[] };
  } | null>(null);

  useEffect(() => {
    setManagementExp(data.character?.managementExperience || 3);
    setCreditHistory(data.character?.creditHistory || 3);
    setBankConduct(data.character?.bankConduct || 3);
    setContracts(data.character?.contracts || 3);
    setNotes(data.character?.notes || "");
  }, [data.character]);

  useEffect(() => {
    setHmrcTimeToPay(data.hmrcTimeToPay || "none");
  }, [data.hmrcTimeToPay]);

  const score = calculateCharacterScore({
    managementExperience: managementExp,
    creditHistory,
    bankConduct,
    contracts,
  });

  const handleSave = () => {
    onSave({
      character: {
        managementExperience: managementExp,
        creditHistory,
        bankConduct,
        contracts,
        notes,
      },
      hmrcTimeToPay,
    });
  };

  const handleInvestigate = async () => {
    if (!personName.trim()) return;
    setIsInvestigating(true);
    setInvestigation(null);
    try {
      const res = await apiRequest("/api/character-search", "POST", { name: personName.trim() });
      setInvestigation(await res.json());
    } catch (error: any) {
      toast.error(error.message || "Investigation failed");
    } finally {
      setIsInvestigating(false);
    }
  };

  const getRatingLabel = (value: number) => {
    if (value === 5) return "Excellent";
    if (value === 4) return "Good";
    if (value === 3) return "Satisfactory";
    if (value === 2) return "Poor";
    return "Very Poor";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Character Assessment</CardTitle>
        <CardDescription>Structured borrower evaluation</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="p-4 bg-muted rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Overall Score</div>
                <div className="text-3xl font-bold" data-testid="text-character-score">
                  {score.score} / {score.maxScore}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{Math.round(score.percentage)}%</div>
                <Badge variant={score.percentage >= 60 ? "default" : "secondary"}>
                  {score.recommendation.split(" - ")[0]}
                </Badge>
              </div>
            </div>
            <Progress value={score.percentage} className="mt-3" />
            <div className="text-sm mt-2">{score.recommendation}</div>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">Background Investigation</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Searches the web and LinkedIn/social media for the named individual — director background, news, and public profile.
            </p>
            <div className="flex gap-2">
              <Input
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInvestigate()}
                placeholder="Full name of director / guarantor"
                data-testid="input-investigate-name"
              />
              <Button
                onClick={handleInvestigate}
                disabled={isInvestigating || !personName.trim()}
                data-testid="button-investigate"
              >
                {isInvestigating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 mr-2" />
                )}
                {isInvestigating ? "" : "Investigate"}
              </Button>
            </div>

            {investigation && (
              <div className="grid gap-4 md:grid-cols-2 pt-2">
                <div className="space-y-2">
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Web & News</h5>
                  {investigation.web.results.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nothing found.</p>
                  ) : (
                    investigation.web.results.map((r, i) => (
                      <a
                        key={i}
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-md border p-2.5 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium truncate">{r.title}</span>
                          <ExternalLink className="w-3 h-3 shrink-0 text-muted-foreground" />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{r.content}</p>
                      </a>
                    ))
                  )}
                </div>
                <div className="space-y-2">
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">LinkedIn & Social</h5>
                  {investigation.social.results.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nothing found.</p>
                  ) : (
                    investigation.social.results.map((r, i) => (
                      <a
                        key={i}
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-md border p-2.5 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium truncate">{r.title}</span>
                          <ExternalLink className="w-3 h-3 shrink-0 text-muted-foreground" />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{r.content}</p>
                      </a>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {[
              { label: "Management Experience", value: managementExp, setValue: setManagementExp, id: "management" },
              { label: "Credit History", value: creditHistory, setValue: setCreditHistory, id: "credit" },
              { label: "Bank Conduct", value: bankConduct, setValue: setBankConduct, id: "bank" },
              { label: "Contracts & Capacity", value: contracts, setValue: setContracts, id: "contracts" },
            ].map((item) => (
              <div key={item.id}>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base">{item.label}</Label>
                  <span className={`text-sm font-medium px-2 py-0.5 rounded ${item.value >= 4 ? "bg-green-100 text-green-700" :
                    item.value === 3 ? "bg-amber-100 text-amber-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                    {getRatingLabel(item.value)}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <Button
                      key={rating}
                      variant={item.value === rating ? "default" : "outline"}
                      onClick={() => item.setValue(rating)}
                      className={`h-12 text-lg font-semibold transition-all ${item.value === rating
                        ? "ring-2 ring-offset-2 ring-primary"
                        : "hover:bg-primary/5 hover:border-primary/50 text-muted-foreground"
                        }`}
                      data-testid={`btn-${item.id}-${rating}`}
                      title={getRatingLabel(rating)}
                    >
                      {rating}
                    </Button>
                  ))}
                </div>
                <div className="flex justify-between mt-1 px-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Very Poor</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Excellent</span>
                </div>
              </div>
            ))}

            <div className="pt-4 border-t">
              <Label className="mb-2 block">HMRC Time To Pay Arrangement</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Self-reported by the adviser or borrower — there is no public HMRC lookup for this.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(["none", "active", "historic"] as const).map((option) => (
                  <Button
                    key={option}
                    variant={hmrcTimeToPay === option ? "default" : "outline"}
                    onClick={() => setHmrcTimeToPay(option)}
                    className="capitalize"
                    data-testid={`btn-hmrc-ttp-${option}`}
                  >
                    {option}
                  </Button>
                ))}
              </div>
              {hmrcTimeToPay === "active" && (
                <p className="text-xs text-red-600 mt-2">
                  Active TTP will be flagged as an open exception on this prospect.
                </p>
              )}
            </div>

            <div className="pt-4 border-t">
              <Label htmlFor="character-notes" className="mb-2 block">Assessment Notes</Label>
              <Textarea
                id="character-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add detailed notes about the borrower's character..."
                rows={4}
                className="resize-none focus-visible:ring-primary"
                data-testid="textarea-character-notes"
              />
            </div>

            <Button onClick={handleSave} disabled={isSaving} className="w-full h-11 text-base" data-testid="button-save-character">
              <Save className="w-5 h-5 mr-2" />
              {isSaving ? "Saving..." : "Save Assessment"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
