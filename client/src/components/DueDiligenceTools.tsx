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
import { CheckCircle2, AlertCircle, XCircle, Save, Calculator, TrendingUp, Target, FileText, User } from "lucide-react";

import { CHECKLIST_SECTIONS } from "@shared/checklistData";
import type { ChecklistItem, DueDiligenceData } from "@shared/schema";
import {
  calculateLoan,
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

export function DueDiligenceChecklist({
  data,
  onSave,
  isSaving,
}: Omit<DueDiligenceToolsProps, "prospectId">) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  useEffect(() => {
    if (data.checklist && data.checklist.length > 0) {
      setChecklist(data.checklist);
    } else {
      const initialChecklist: ChecklistItem[] = [];
      CHECKLIST_SECTIONS.forEach((section) => {
        section.items.forEach((item) => {
          initialChecklist.push({
            sectionId: section.id,
            itemId: item.id,
            description: item.description,
            completed: false,
            notes: "",
          });
        });
      });
      setChecklist(initialChecklist);
    }
  }, [data.checklist]);

  const toggleItem = (itemId: string) => {
    const updated = checklist.map((item) =>
      item.itemId === itemId ? { ...item, completed: !item.completed } : item
    );
    setChecklist(updated);
    onSave({ checklist: updated });
  };

  const getSectionProgress = (sectionId: string) => {
    const sectionItems = checklist.filter((item) => item.sectionId === sectionId);
    if (sectionItems.length === 0) return 0;
    const completed = sectionItems.filter((item) => item.completed).length;
    return Math.round((completed / sectionItems.length) * 100);
  };

  const totalItems = checklist.length;
  const completedItems = checklist.filter((item) => item.completed).length;
  const overallProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Due Diligence Checklist</CardTitle>
            <CardDescription>
              {completedItems} of {totalItems} items completed
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{overallProgress}%</div>
            <Progress value={overallProgress} className="w-24 mt-1" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" defaultValue={[CHECKLIST_SECTIONS[0].id]} className="space-y-2">
          {CHECKLIST_SECTIONS.map((section) => {
            const sectionItems = checklist.filter((item) => item.sectionId === section.id);
            const progress = getSectionProgress(section.id);
            return (
              <AccordionItem key={section.id} value={section.id} className="border rounded-md px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <span className="font-medium">{section.name}</span>
                    <Badge variant={progress === 100 ? "default" : "secondary"}>{progress}%</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
                    {sectionItems.map((item) => (
                      <div key={item.itemId} className="flex items-center gap-3">
                        <Checkbox
                          id={item.itemId}
                          checked={item.completed}
                          onCheckedChange={() => toggleItem(item.itemId)}
                          data-testid={`checkbox-${item.itemId}`}
                        />
                        <label
                          htmlFor={item.itemId}
                          className={`text-sm cursor-pointer ${item.completed ? "line-through text-muted-foreground" : ""
                            }`}
                        >
                          {item.description}
                        </label>
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

  useEffect(() => {
    setLoanAmount(data.loanCalculator?.loanAmount?.toString() || "");
    setInterestRate(data.loanCalculator?.interestRate?.toString() || "");
    setTerm(data.loanCalculator?.term?.toString() || "");
  }, [data.loanCalculator]);

  const calculation =
    loanAmount && interestRate && term
      ? calculateLoan(parseFloat(loanAmount), parseFloat(interestRate), parseInt(term))
      : null;

  const handleSave = () => {
    onSave({
      loanCalculator: {
        loanAmount: loanAmount ? parseFloat(loanAmount) : undefined,
        interestRate: interestRate ? parseFloat(interestRate) : undefined,
        term: term ? parseInt(term) : undefined,
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
              <div className="space-y-2">
                <Label htmlFor="loan-amount">Loan Amount (£)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">£</span>
                  <Input
                    id="loan-amount"
                    type="number"
                    className="pl-7"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    placeholder="500000"
                  />
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
                <div className="mt-4 pt-4 border-t border-primary/10 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Interest</div>
                    <div className="text-lg font-semibold mt-1">{formatCurrency(calculation.totalInterest)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Repayable</div>
                    <div className="text-lg font-semibold mt-1">{formatCurrency(calculation.totalRepayment)}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4 flex items-center justify-between">
                <span className="text-sm font-medium">Facility Fee (3.5%)</span>
                <span className="font-semibold">{formatCurrency(calculation.facilityFee)}</span>
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
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              <TrendingUp className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>Enter income and debt details</p>
            </div>
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
  const [income, setIncome] = useState("");
  const [commitments, setCommitments] = useState("");
  const [loanPayment, setLoanPayment] = useState("");

  useEffect(() => {
    setIncome(data.affordability?.personalIncome?.toString() || "");
    setCommitments(data.affordability?.monthlyCommitments?.toString() || "");
    setLoanPayment(data.affordability?.loanPayment?.toString() || "");
  }, [data.affordability]);

  const calculation =
    income && commitments && loanPayment
      ? calculateAffordability(parseFloat(income), parseFloat(commitments), parseFloat(loanPayment))
      : null;

  const handleSave = () => {
    onSave({
      affordability: {
        personalIncome: income ? parseFloat(income) : undefined,
        monthlyCommitments: commitments ? parseFloat(commitments) : undefined,
        loanPayment: loanPayment ? parseFloat(loanPayment) : undefined,
      },
    });
  };

  return (
    <Card className="h-full border-none shadow-none">
      <CardHeader className="px-0 pt-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Affordability Estimator</CardTitle>
            <CardDescription>Personal income and commitments check</CardDescription>
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
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="personal-income">Monthly Personal Income (£)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">£</span>
                  <Input
                    id="personal-income"
                    type="number"
                    className="pl-7"
                    value={income}
                    onChange={(e) => setIncome(e.target.value)}
                    placeholder="10000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthly-commitments">Monthly Commitments (£)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">£</span>
                  <Input
                    id="monthly-commitments"
                    type="number"
                    className="pl-7"
                    value={commitments}
                    onChange={(e) => setCommitments(e.target.value)}
                    placeholder="3000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="loan-payment">Proposed Loan Payment (£)</Label>
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
                    <span className="block opacity-70">Income</span>
                    <span className="font-medium text-foreground">{formatCurrency(parseFloat(income))}</span>
                  </div>
                  <div>
                    <span className="block opacity-70">Expenses</span>
                    <span className="font-medium text-foreground">{formatCurrency(parseFloat(commitments) + parseFloat(loanPayment))}</span>
                  </div>
                  <div>
                    <span className="block opacity-70">Surplus</span>
                    <span className={`font-medium ${calculation.disposableIncome < 0 ? "text-red-600" : "text-green-600"}`}>
                      {((calculation.disposableIncome / parseFloat(income)) * 100).toFixed(0)}%
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

  useEffect(() => {
    setManagementExp(data.character?.managementExperience || 3);
    setCreditHistory(data.character?.creditHistory || 3);
    setBankConduct(data.character?.bankConduct || 3);
    setContracts(data.character?.contracts || 3);
    setNotes(data.character?.notes || "");
  }, [data.character]);

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
    });
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

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Management Experience</Label>
                <span className="text-sm font-medium">{getRatingLabel(managementExp)}</span>
              </div>
              <Slider
                value={[managementExp]}
                onValueChange={(value) => setManagementExp(value[0])}
                min={1}
                max={5}
                step={1}
                data-testid="slider-management"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Credit History</Label>
                <span className="text-sm font-medium">{getRatingLabel(creditHistory)}</span>
              </div>
              <Slider
                value={[creditHistory]}
                onValueChange={(value) => setCreditHistory(value[0])}
                min={1}
                max={5}
                step={1}
                data-testid="slider-credit"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Bank Conduct</Label>
                <span className="text-sm font-medium">{getRatingLabel(bankConduct)}</span>
              </div>
              <Slider
                value={[bankConduct]}
                onValueChange={(value) => setBankConduct(value[0])}
                min={1}
                max={5}
                step={1}
                data-testid="slider-bank"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Contracts & Capacity</Label>
                <span className="text-sm font-medium">{getRatingLabel(contracts)}</span>
              </div>
              <Slider
                value={[contracts]}
                onValueChange={(value) => setContracts(value[0])}
                min={1}
                max={5}
                step={1}
                data-testid="slider-contracts"
              />
            </div>

            <div>
              <Label htmlFor="character-notes">Assessment Notes</Label>
              <Textarea
                id="character-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add detailed notes about the borrower's character..."
                rows={4}
                data-testid="textarea-character-notes"
              />
            </div>

            <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-character">
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Assessment"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
