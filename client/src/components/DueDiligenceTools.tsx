import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Slider } from "@/components/ui/slider";
import { CheckCircle2, AlertCircle, XCircle, Save } from "lucide-react";
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

export function DueDiligenceChecklist({ data, onSave, isSaving }: Omit<DueDiligenceToolsProps, "prospectId">) {
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

  const updateNotes = (itemId: string, notes: string) => {
    const updated = checklist.map((item) =>
      item.itemId === itemId ? { ...item, notes } : item
    );
    setChecklist(updated);
  };

  const saveNotes = () => {
    onSave({ checklist });
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
                    <Badge variant={progress === 100 ? "default" : "secondary"}>
                      {progress}%
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    {sectionItems.map((item) => (
                      <div key={item.itemId} className="space-y-2">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id={item.itemId}
                            checked={item.completed}
                            onCheckedChange={() => toggleItem(item.itemId)}
                            data-testid={`checkbox-${item.itemId}`}
                          />
                          <div className="flex-1">
                            <label
                              htmlFor={item.itemId}
                              className={`text-sm cursor-pointer ${
                                item.completed ? "line-through text-muted-foreground" : ""
                              }`}
                            >
                              {item.description}
                            </label>
                            <Textarea
                              placeholder="Add notes..."
                              value={item.notes}
                              onChange={(e) => updateNotes(item.itemId, e.target.value)}
                              className="mt-2 text-sm"
                              data-testid={`notes-${item.itemId}`}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
        <div className="mt-4">
          <Button onClick={saveNotes} disabled={isSaving} data-testid="button-save-checklist">
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save Notes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function LoanCalculatorTool({ data, onSave, isSaving }: Omit<DueDiligenceToolsProps, "prospectId">) {
  const [loanAmount, setLoanAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [term, setTerm] = useState("");

  useEffect(() => {
    setLoanAmount(data.loanCalculator?.loanAmount?.toString() || "");
    setInterestRate(data.loanCalculator?.interestRate?.toString() || "");
    setTerm(data.loanCalculator?.term?.toString() || "");
  }, [data.loanCalculator]);

  const calculation = loanAmount && interestRate && term
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
    <Card>
      <CardHeader>
        <CardTitle>Loan Calculator</CardTitle>
        <CardDescription>Calculate monthly payments and total costs</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="loan-amount">Loan Amount (£)</Label>
              <Input
                id="loan-amount"
                type="number"
                value={loanAmount}
                onChange={(e) => setLoanAmount(e.target.value)}
                placeholder="500000"
                data-testid="input-loan-amount"
              />
            </div>
            <div>
              <Label htmlFor="interest-rate">Interest Rate (%)</Label>
              <Input
                id="interest-rate"
                type="number"
                step="0.1"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="7.5"
                data-testid="input-interest-rate"
              />
            </div>
            <div>
              <Label htmlFor="term">Term (months)</Label>
              <Input
                id="term"
                type="number"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="36"
                data-testid="input-term"
              />
            </div>
            <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-loan-calc">
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Assessment"}
            </Button>
          </div>
          {calculation && (
            <div className="space-y-3">
              <div className="p-4 bg-muted rounded-md">
                <div className="text-sm text-muted-foreground">Monthly Payment</div>
                <div className="text-2xl font-bold" data-testid="text-monthly-payment">
                  {formatCurrency(calculation.monthlyPayment)}
                </div>
              </div>
              <div className="p-4 bg-muted rounded-md">
                <div className="text-sm text-muted-foreground">Total Interest</div>
                <div className="text-lg font-semibold">{formatCurrency(calculation.totalInterest)}</div>
              </div>
              <div className="p-4 bg-muted rounded-md">
                <div className="text-sm text-muted-foreground">Total Repayment</div>
                <div className="text-lg font-semibold">{formatCurrency(calculation.totalRepayment)}</div>
              </div>
              <div className="p-4 bg-muted rounded-md">
                <div className="text-sm text-muted-foreground">Facility Fee (3.5%)</div>
                <div className="text-lg font-semibold">{formatCurrency(calculation.facilityFee)}</div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function DSCRCalculatorTool({ data, onSave, isSaving }: Omit<DueDiligenceToolsProps, "prospectId">) {
  const [noi, setNoi] = useState("");
  const [debtService, setDebtService] = useState("");
  const [sensitivity, setSensitivity] = useState("-20");

  useEffect(() => {
    setNoi(data.dscr?.annualNetOperatingIncome?.toString() || "");
    setDebtService(data.dscr?.annualDebtService?.toString() || "");
    setSensitivity(data.dscr?.sensitivityRevenue?.toString() || "-20");
  }, [data.dscr]);

  const calculation = noi && debtService
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

  const getStatusIcon = (status: "pass" | "warning" | "fail") => {
    if (status === "pass") return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    if (status === "warning") return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    return <XCircle className="w-5 h-5 text-red-600" />;
  };

  const getStatusColor = (status: "pass" | "warning" | "fail") => {
    if (status === "pass") return "text-green-600";
    if (status === "warning") return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>DSCR Calculator</CardTitle>
        <CardDescription>Debt Service Coverage Ratio assessment</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="noi">Annual Net Operating Income (£)</Label>
              <Input
                id="noi"
                type="number"
                value={noi}
                onChange={(e) => setNoi(e.target.value)}
                placeholder="250000"
                data-testid="input-noi"
              />
            </div>
            <div>
              <Label htmlFor="debt-service">Annual Debt Service (£)</Label>
              <Input
                id="debt-service"
                type="number"
                value={debtService}
                onChange={(e) => setDebtService(e.target.value)}
                placeholder="150000"
                data-testid="input-debt-service"
              />
            </div>
            <div>
              <Label htmlFor="sensitivity">Sensitivity Revenue Change (%)</Label>
              <Input
                id="sensitivity"
                type="number"
                step="1"
                value={sensitivity}
                onChange={(e) => setSensitivity(e.target.value)}
                placeholder="-20"
                data-testid="input-sensitivity"
              />
            </div>
            <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-dscr">
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Assessment"}
            </Button>
          </div>
          {calculation && (
            <div className="space-y-3">
              <div className="p-4 bg-muted rounded-md">
                <div className="text-sm text-muted-foreground">Base DSCR</div>
                <div className={`text-2xl font-bold flex items-center gap-2 ${getStatusColor(calculation.status)}`} data-testid="text-dscr-ratio">
                  {getStatusIcon(calculation.status)}
                  {formatRatio(calculation.dscr)}×
                </div>
                <div className="text-xs mt-1">
                  {calculation.status === "pass" && "✓ Meets requirement (≥1.5×)"}
                  {calculation.status === "warning" && "⚠ Warning (1.0-1.5×)"}
                  {calculation.status === "fail" && "✗ Below minimum (< 1.0×)"}
                </div>
              </div>
              {calculation.sensitivityDSCR !== undefined && calculation.sensitivityStatus && (
                <div className="p-4 bg-muted rounded-md">
                  <div className="text-sm text-muted-foreground">
                    Sensitivity DSCR ({sensitivity}% revenue)
                  </div>
                  <div className={`text-xl font-bold flex items-center gap-2 ${getStatusColor(calculation.sensitivityStatus)}`}>
                    {getStatusIcon(calculation.sensitivityStatus)}
                    {formatRatio(calculation.sensitivityDSCR)}×
                  </div>
                  <div className="text-xs mt-1">
                    {calculation.sensitivityStatus === "pass" && "✓ Stress test passed"}
                    {calculation.sensitivityStatus === "warning" && "⚠ Marginal under stress"}
                    {calculation.sensitivityStatus === "fail" && "✗ Fails stress test"}
                  </div>
                </div>
              )}
              <div className="p-4 bg-muted rounded-md">
                <div className="text-sm font-medium">Requirements</div>
                <div className="text-xs text-muted-foreground mt-1 space-y-1">
                  <div>• Base DSCR ≥ 1.5× (Pass)</div>
                  <div>• Sensitivity ≥ 1.0× (Acceptable)</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AffordabilityEstimatorTool({ data, onSave, isSaving }: Omit<DueDiligenceToolsProps, "prospectId">) {
  const [income, setIncome] = useState("");
  const [commitments, setCommitments] = useState("");
  const [loanPayment, setLoanPayment] = useState("");

  useEffect(() => {
    setIncome(data.affordability?.personalIncome?.toString() || "");
    setCommitments(data.affordability?.monthlyCommitments?.toString() || "");
    setLoanPayment(data.affordability?.loanPayment?.toString() || "");
  }, [data.affordability]);

  const calculation = income && commitments && loanPayment
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
    <Card>
      <CardHeader>
        <CardTitle>Affordability Estimator</CardTitle>
        <CardDescription>Personal income vs commitments assessment</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="personal-income">Monthly Personal Income (£)</Label>
              <Input
                id="personal-income"
                type="number"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                placeholder="10000"
                data-testid="input-personal-income"
              />
            </div>
            <div>
              <Label htmlFor="monthly-commitments">Monthly Commitments (£)</Label>
              <Input
                id="monthly-commitments"
                type="number"
                value={commitments}
                onChange={(e) => setCommitments(e.target.value)}
                placeholder="3000"
                data-testid="input-monthly-commitments"
              />
            </div>
            <div>
              <Label htmlFor="loan-payment">Proposed Loan Payment (£)</Label>
              <Input
                id="loan-payment"
                type="number"
                value={loanPayment}
                onChange={(e) => setLoanPayment(e.target.value)}
                placeholder="5000"
                data-testid="input-loan-payment"
              />
            </div>
            <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-affordability">
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Assessment"}
            </Button>
          </div>
          {calculation && (
            <div className="space-y-3">
              <div className="p-4 bg-muted rounded-md">
                <div className="text-sm text-muted-foreground">Income vs Commitments Ratio</div>
                <div className={`text-2xl font-bold flex items-center gap-2 ${calculation.status === "pass" ? "text-green-600" : "text-red-600"}`} data-testid="text-affordability-ratio">
                  {calculation.status === "pass" ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                  {formatRatio(calculation.ratio)}×
                </div>
                <div className="text-xs mt-1">
                  {calculation.status === "pass" ? "✓ Meets requirement (≥1.25×)" : "✗ Below minimum (<1.25×)"}
                </div>
              </div>
              <div className="p-4 bg-muted rounded-md">
                <div className="text-sm text-muted-foreground">Disposable Income</div>
                <div className={`text-lg font-semibold ${calculation.disposableIncome >= 0 ? "" : "text-red-600"}`}>
                  {formatCurrency(calculation.disposableIncome)}
                </div>
              </div>
              <div className="p-4 bg-muted rounded-md">
                <div className="text-sm font-medium">Breakdown</div>
                <div className="text-xs text-muted-foreground mt-1 space-y-1">
                  <div>Income: {formatCurrency(parseFloat(income))}</div>
                  <div>Existing: {formatCurrency(parseFloat(commitments))}</div>
                  <div>Loan: {formatCurrency(parseFloat(loanPayment))}</div>
                  <div>Total: {formatCurrency(parseFloat(commitments) + parseFloat(loanPayment))}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function FinancialRatiosCalculatorTool({ data, onSave, isSaving }: Omit<DueDiligenceToolsProps, "prospectId">) {
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
    <Card>
      <CardHeader>
        <CardTitle>Financial Ratios Calculator</CardTitle>
        <CardDescription>Key business metrics analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="revenue">Annual Revenue (£)</Label>
              <Input id="revenue" type="number" value={revenue} onChange={(e) => setRevenue(e.target.value)} placeholder="1000000" data-testid="input-revenue" />
            </div>
            <div>
              <Label htmlFor="costs">Annual Costs (£)</Label>
              <Input id="costs" type="number" value={costs} onChange={(e) => setCosts(e.target.value)} placeholder="750000" data-testid="input-costs" />
            </div>
            <div>
              <Label htmlFor="current-assets">Current Assets (£)</Label>
              <Input id="current-assets" type="number" value={currentAssets} onChange={(e) => setCurrentAssets(e.target.value)} placeholder="200000" data-testid="input-current-assets" />
            </div>
            <div>
              <Label htmlFor="current-liabilities">Current Liabilities (£)</Label>
              <Input id="current-liabilities" type="number" value={currentLiabilities} onChange={(e) => setCurrentLiabilities(e.target.value)} placeholder="100000" data-testid="input-current-liabilities" />
            </div>
            <div>
              <Label htmlFor="total-assets">Total Assets (£)</Label>
              <Input id="total-assets" type="number" value={totalAssets} onChange={(e) => setTotalAssets(e.target.value)} placeholder="500000" data-testid="input-total-assets" />
            </div>
            <div>
              <Label htmlFor="total-liabilities">Total Liabilities (£)</Label>
              <Input id="total-liabilities" type="number" value={totalLiabilities} onChange={(e) => setTotalLiabilities(e.target.value)} placeholder="200000" data-testid="input-total-liabilities" />
            </div>
            <div>
              <Label htmlFor="equity">Equity (£)</Label>
              <Input id="equity" type="number" value={equity} onChange={(e) => setEquity(e.target.value)} placeholder="300000" data-testid="input-equity" />
            </div>
            <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-ratios">
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Assessment"}
            </Button>
          </div>
          <div className="space-y-3">
            {ratios.currentRatio !== undefined && (
              <div className="p-4 bg-muted rounded-md">
                <div className="text-sm text-muted-foreground">Current Ratio</div>
                <div className="text-xl font-bold" data-testid="text-current-ratio">{formatRatio(ratios.currentRatio)}</div>
                <div className="text-xs text-muted-foreground">Target: &gt; 1.5</div>
              </div>
            )}
            {ratios.debtToEquity !== undefined && (
              <div className="p-4 bg-muted rounded-md">
                <div className="text-sm text-muted-foreground">Debt-to-Equity</div>
                <div className="text-xl font-bold">{formatRatio(ratios.debtToEquity)}</div>
                <div className="text-xs text-muted-foreground">Lower is better</div>
              </div>
            )}
            {ratios.profitMargin !== undefined && (
              <div className="p-4 bg-muted rounded-md">
                <div className="text-sm text-muted-foreground">Profit Margin</div>
                <div className="text-xl font-bold">{formatPercent(ratios.profitMargin)}</div>
                <div className="text-xs text-muted-foreground">Higher is better</div>
              </div>
            )}
            {ratios.roe !== undefined && (
              <div className="p-4 bg-muted rounded-md">
                <div className="text-sm text-muted-foreground">Return on Equity (ROE)</div>
                <div className="text-xl font-bold">{formatPercent(ratios.roe)}</div>
                <div className="text-xs text-muted-foreground">Target: &gt; 15%</div>
              </div>
            )}
            {ratios.assetTurnover !== undefined && (
              <div className="p-4 bg-muted rounded-md">
                <div className="text-sm text-muted-foreground">Asset Turnover</div>
                <div className="text-xl font-bold">{formatRatio(ratios.assetTurnover)}</div>
                <div className="text-xs text-muted-foreground">Higher is better</div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CharacterAssessmentTool({ data, onSave, isSaving }: Omit<DueDiligenceToolsProps, "prospectId">) {
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
