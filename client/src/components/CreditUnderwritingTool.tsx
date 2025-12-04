import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Upload,
  FileText,
  Search,
  Shield,
  Building2,
  TrendingUp,
  FileCheck,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Save,
  RefreshCw,
  ExternalLink,
  DollarSign,
  Calculator,
  ClipboardList,
} from "lucide-react";
import type { DueDiligenceData, ProspectWithCompany, UnderwritingData } from "@shared/schema";
import {
  ELIGIBILITY_QUESTIONS,
  DEFAULT_INTEREST_RATE,
  DEFAULT_TERM_MONTHS,
  ARRANGEMENT_FEE_PERCENT,
  DSCR_THRESHOLD,
  SUMMARY_SECTIONS,
  CAMPARI_QUESTIONS,
} from "@/lib/creditUnderwriting/constants";

interface CreditUnderwritingToolProps {
  prospect: ProspectWithCompany;
  data: DueDiligenceData;
  onSave: (data: Partial<DueDiligenceData>) => void;
  isSaving: boolean;
}

const STEPS = [
  { id: 1, label: "Eligibility", icon: ClipboardList },
  { id: 2, label: "Financial Upload", icon: Upload },
  { id: 3, label: "Analysis", icon: TrendingUp },
  { id: 4, label: "Due Diligence", icon: Search },
  { id: 5, label: "Results", icon: Shield },
  { id: 6, label: "Summary", icon: FileCheck },
];

function calculateMonthlyPayment(amount: number, rate: number, termMonths: number): number {
  const monthlyRate = (rate / 100) / 12;
  if (monthlyRate === 0) return amount / termMonths;
  return amount * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function CreditUnderwritingTool({ prospect, data, onSave, isSaving }: CreditUnderwritingToolProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const underwriting = (data.underwriting || {}) as UnderwritingData;

  const [eligibilityAnswers, setEligibilityAnswers] = useState<Record<string, boolean>>(
    underwriting.eligibility?.answers || {}
  );
  const [loanAmount, setLoanAmount] = useState(
    underwriting.loanDetails?.amount?.toString() || 
    (prospect.loanAmount ? (prospect.loanAmount / 100).toString() : "")
  );
  const [termMonths, setTermMonths] = useState(
    underwriting.loanDetails?.termMonths?.toString() || DEFAULT_TERM_MONTHS.toString()
  );
  const [interestRate, setInterestRate] = useState(
    underwriting.loanDetails?.interestRate?.toString() || DEFAULT_INTEREST_RATE.toString()
  );

  const [csvText, setCsvText] = useState("");
  const [csvFileName, setCsvFileName] = useState(underwriting.csvFileName || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [adviserSummary, setAdviserSummary] = useState(underwriting.adviserSummary || {
    soarRef: "",
    businessName: prospect.company.companyName || "",
    product: "RGF",
    amount: parseFloat(loanAmount) || 0,
    term: parseInt(termMonths) || DEFAULT_TERM_MONTHS,
    region: "England",
    legalStructure: prospect.company.companyType || "ltd",
    sector: "Professional Services",
    purpose: "",
    sections: {},
    questionnaire: {},
    recommendation: "",
    nextActions: [],
  });

  const monthlyRepayment = loanAmount && termMonths && interestRate
    ? calculateMonthlyPayment(parseFloat(loanAmount), parseFloat(interestRate), parseInt(termMonths))
    : 0;

  const checkEligibility = (): { isEligible: boolean; reasons: string[] } => {
    const reasons: string[] = [];
    let isEligible = true;

    for (const question of ELIGIBILITY_QUESTIONS) {
      const answer = eligibilityAnswers[question.id];
      if (answer === undefined) {
        reasons.push(`Missing answer: ${question.text}`);
        isEligible = false;
        continue;
      }

      if (question.category === 'eligibility' && answer !== question.requiredAnswer) {
        reasons.push(`Failed: ${question.text}`);
        isEligible = false;
      } else if (question.category === 'exclusion' && answer === true) {
        reasons.push(`Exclusion: ${question.text}`);
        isEligible = false;
      }
    }

    return { isEligible, reasons };
  };

  const saveEligibility = () => {
    const { isEligible, reasons } = checkEligibility();
    onSave({
      underwriting: {
        ...underwriting,
        eligibility: {
          answers: eligibilityAnswers,
          isEligible,
          ineligibilityReasons: reasons,
        },
      },
    });
  };

  const saveLoanDetails = () => {
    onSave({
      underwriting: {
        ...underwriting,
        loanDetails: {
          amount: parseFloat(loanAmount) || 0,
          termMonths: parseInt(termMonths) || DEFAULT_TERM_MONTHS,
          interestRate: parseFloat(interestRate) || DEFAULT_INTEREST_RATE,
          monthlyRepayment,
        },
      },
    });
  };

  const analyzeCsvMutation = useMutation({
    mutationFn: async (csvData: string) => {
      const response = await apiRequest("POST", `/api/prospects/${prospect.id}/underwriting/analyze-csv`, {
        csvData,
        loanAmount: parseFloat(loanAmount),
        monthlyRepayment,
      });
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospect.id}/due-diligence`] });
      toast.success("Financial analysis complete");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to analyze CSV");
    },
  });

  const adverseMediaMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/prospects/${prospect.id}/underwriting/adverse-media`, {
        companyName: prospect.company.companyName,
        companyNumber: prospect.company.companyNumber,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospect.id}/due-diligence`] });
      toast.success("Adverse media search complete");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to search adverse media");
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error("Please upload a CSV file");
      return;
    }

    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);
      onSave({
        underwriting: {
          ...underwriting,
          csvFileName: file.name,
        },
      });
    };
    reader.readAsText(file);
  };

  const handleAnalyze = () => {
    if (!csvText) {
      toast.error("Please upload a CSV file first");
      return;
    }
    if (!loanAmount || parseFloat(loanAmount) <= 0) {
      toast.error("Please enter a valid loan amount");
      return;
    }
    analyzeCsvMutation.mutate(csvText);
  };

  const saveAdviserSummary = () => {
    onSave({
      underwriting: {
        ...underwriting,
        adviserSummary,
        completedAt: new Date().toISOString(),
      },
    });
  };

  const getRiskGradeBadge = (grade?: string) => {
    const colors: Record<string, string> = {
      A: "bg-green-500 text-white",
      B: "bg-green-400 text-white",
      C: "bg-yellow-500 text-white",
      D: "bg-orange-500 text-white",
      E: "bg-red-500 text-white",
    };
    return (
      <Badge className={colors[grade || ""] || "bg-gray-400 text-white"}>
        Grade {grade || "N/A"}
      </Badge>
    );
  };

  const financialAnalysis = underwriting.financialAnalysis;
  const adverseMedia = underwriting.adverseMedia;
  const { isEligible, reasons } = checkEligibility();

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return Object.keys(eligibilityAnswers).length === ELIGIBILITY_QUESTIONS.length && isEligible;
      case 2:
        return csvText.length > 0 || !!financialAnalysis;
      case 3:
        return !!financialAnalysis;
      case 4:
        return true;
      case 5:
        return !!financialAnalysis;
      default:
        return true;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Credit Underwriting
            </CardTitle>
            <CardDescription className="mt-1">
              AI-powered comprehensive credit assessment and risk analysis
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            Premium Feature
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className="flex items-center"
              >
                <button
                  onClick={() => setCurrentStep(step.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    currentStep === step.id
                      ? "bg-primary text-primary-foreground"
                      : currentStep > step.id
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                  data-testid={`button-step-${step.id}`}
                >
                  <step.icon className="h-4 w-4" />
                  <span className="hidden md:inline">{step.label}</span>
                </button>
                {index < STEPS.length - 1 && (
                  <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
          <Progress value={(currentStep / STEPS.length) * 100} className="h-1" />
        </div>

        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-lg font-semibold">Eligibility Check</h3>
              {Object.keys(eligibilityAnswers).length === ELIGIBILITY_QUESTIONS.length && (
                <Badge variant={isEligible ? "default" : "destructive"}>
                  {isEligible ? "Eligible" : "Not Eligible"}
                </Badge>
              )}
            </div>

            <div className="grid gap-4">
              <div className="p-4 border rounded-lg space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Loan Parameters
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="loan-amount">Loan Amount (£)</Label>
                    <Input
                      id="loan-amount"
                      type="number"
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(e.target.value)}
                      placeholder="50000"
                      data-testid="input-uw-loan-amount"
                    />
                  </div>
                  <div>
                    <Label htmlFor="term-months">Term (months)</Label>
                    <Input
                      id="term-months"
                      type="number"
                      value={termMonths}
                      onChange={(e) => setTermMonths(e.target.value)}
                      placeholder="60"
                      data-testid="input-uw-term"
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
                      placeholder="17"
                      data-testid="input-uw-rate"
                    />
                  </div>
                </div>
                {loanAmount && (
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">Monthly Repayment:</span>
                    <span className="font-semibold">{formatCurrency(monthlyRepayment)}</span>
                    <span className="text-muted-foreground">Arrangement Fee ({ARRANGEMENT_FEE_PERCENT}%):</span>
                    <span className="font-semibold">{formatCurrency(parseFloat(loanAmount) * (ARRANGEMENT_FEE_PERCENT / 100))}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">Policy Questions</h4>
                {ELIGIBILITY_QUESTIONS.map((question) => (
                  <div
                    key={question.id}
                    className="flex items-start justify-between gap-4 p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{question.text}</p>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {question.category === 'eligibility' ? 'Must be Yes' : 'Must be No'}
                      </Badge>
                    </div>
                    <RadioGroup
                      value={eligibilityAnswers[question.id] === true ? "yes" : eligibilityAnswers[question.id] === false ? "no" : ""}
                      onValueChange={(value) => {
                        setEligibilityAnswers((prev) => ({
                          ...prev,
                          [question.id]: value === "yes",
                        }));
                      }}
                      className="flex gap-4"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="yes" id={`${question.id}-yes`} />
                        <Label htmlFor={`${question.id}-yes`} className="cursor-pointer">Yes</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="no" id={`${question.id}-no`} />
                        <Label htmlFor={`${question.id}-no`} className="cursor-pointer">No</Label>
                      </div>
                    </RadioGroup>
                  </div>
                ))}
              </div>

              {reasons.length > 0 && !isEligible && (
                <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                  <h4 className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Ineligibility Reasons
                  </h4>
                  <ul className="mt-2 text-sm text-red-600 dark:text-red-400 list-disc list-inside">
                    {reasons.map((reason, index) => (
                      <li key={index}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={saveEligibility} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                Save Progress
              </Button>
              <Button
                onClick={() => {
                  saveLoanDetails();
                  saveEligibility();
                  setCurrentStep(2);
                }}
                disabled={!canProceed()}
                data-testid="button-next-step"
              >
                Continue
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Bank Statement Upload</h3>
            <p className="text-sm text-muted-foreground">
              Upload the applicant's bank statement CSV file for AI-powered financial analysis.
            </p>

            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                data-testid="input-csv-upload"
              />
              {csvFileName ? (
                <div className="space-y-4">
                  <FileText className="h-12 w-12 mx-auto text-green-500" />
                  <div>
                    <p className="font-medium">{csvFileName}</p>
                    <p className="text-sm text-muted-foreground">
                      {csvText.split("\n").length} rows detected
                    </p>
                  </div>
                  <div className="flex gap-3 justify-center">
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Replace File
                    </Button>
                    <Button
                      onClick={handleAnalyze}
                      disabled={analyzeCsvMutation.isPending}
                      data-testid="button-analyze-csv"
                    >
                      {analyzeCsvMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <TrendingUp className="h-4 w-4 mr-2" />
                          Analyze Financials
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div>
                    <Button onClick={() => fileInputRef.current?.click()}>
                      Select CSV File
                    </Button>
                    <p className="mt-2 text-sm text-muted-foreground">
                      or drag and drop here
                    </p>
                  </div>
                </div>
              )}
            </div>

            {financialAnalysis && (
              <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Analysis Complete</span>
                  {getRiskGradeBadge(financialAnalysis.riskScore)}
                </div>
                <p className="mt-2 text-sm">{financialAnalysis.summary}</p>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={() => setCurrentStep(3)}
                disabled={!financialAnalysis}
                data-testid="button-next-step"
              >
                Continue
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Financial Analysis Results</h3>

            {financialAnalysis ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-muted/30">
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Avg Monthly Revenue</div>
                      <div className="text-xl font-bold">
                        {formatCurrency(financialAnalysis.averageMonthlyRevenue || 0)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/30">
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Avg Monthly Expenses</div>
                      <div className="text-xl font-bold">
                        {formatCurrency(financialAnalysis.averageMonthlyExpenses || 0)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/30">
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Net Disposable</div>
                      <div className="text-xl font-bold">
                        {formatCurrency(financialAnalysis.netDisposableIncome || 0)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/30">
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">DSCR</div>
                      <div className={`text-xl font-bold flex items-center gap-2 ${
                        (financialAnalysis.dscr || 0) >= DSCR_THRESHOLD ? "text-green-600" : "text-red-600"
                      }`}>
                        {(financialAnalysis.dscr || 0).toFixed(2)}x
                        {(financialAnalysis.dscr || 0) >= DSCR_THRESHOLD ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Tabs defaultValue="overview">
                  <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="monthly">Monthly Breakdown</TabsTrigger>
                    <TabsTrigger value="findings">Preliminary Findings</TabsTrigger>
                    <TabsTrigger value="flags">Risk Flags</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Risk Assessment</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span>Risk Grade</span>
                          {getRiskGradeBadge(financialAnalysis.riskScore)}
                        </div>
                        <div className="text-sm">{financialAnalysis.summary}</div>
                      </CardContent>
                    </Card>

                    {financialAnalysis.profitAndLoss && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Profit & Loss Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Turnover</span>
                              <span className="font-medium">{formatCurrency(financialAnalysis.profitAndLoss.turnover || 0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Cost of Sales</span>
                              <span className="font-medium">{formatCurrency(financialAnalysis.profitAndLoss.costOfSales || 0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Gross Profit</span>
                              <span className="font-medium">{formatCurrency(financialAnalysis.profitAndLoss.grossProfit || 0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Total Expenses</span>
                              <span className="font-medium">{formatCurrency(financialAnalysis.profitAndLoss.totalExpenses || 0)}</span>
                            </div>
                            <div className="flex justify-between col-span-2 pt-2 border-t">
                              <span className="font-medium">Net Profit</span>
                              <span className={`font-bold ${(financialAnalysis.profitAndLoss.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(financialAnalysis.profitAndLoss.netProfit || 0)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="monthly">
                    {financialAnalysis.monthlyBreakdown && financialAnalysis.monthlyBreakdown.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-3">Month</th>
                              <th className="text-right py-2 px-3">Income</th>
                              <th className="text-right py-2 px-3">Expenses</th>
                              <th className="text-right py-2 px-3">Net</th>
                              <th className="text-right py-2 px-3">Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {financialAnalysis.monthlyBreakdown.map((month, idx) => (
                              <tr key={idx} className="border-b">
                                <td className="py-2 px-3 font-medium">{month.month}</td>
                                <td className="py-2 px-3 text-right text-green-600">{formatCurrency(month.income)}</td>
                                <td className="py-2 px-3 text-right text-red-600">{formatCurrency(month.expenses)}</td>
                                <td className={`py-2 px-3 text-right font-medium ${month.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {formatCurrency(month.net)}
                                </td>
                                <td className="py-2 px-3 text-right">{formatCurrency(month.closingBalance)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">No monthly breakdown available</p>
                    )}
                  </TabsContent>

                  <TabsContent value="findings" className="space-y-4">
                    {financialAnalysis.preliminaryFindings && (
                      <>
                        {(financialAnalysis.preliminaryFindings.loans?.length || 0) > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <DollarSign className="h-4 w-4" />
                                Existing Loan Repayments
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                {financialAnalysis.preliminaryFindings.loans?.map((loan, idx) => (
                                  <div key={idx} className="flex justify-between items-center p-2 bg-muted rounded">
                                    <div>
                                      <p className="font-medium text-sm">{loan.description}</p>
                                      <p className="text-xs text-muted-foreground">{loan.date}</p>
                                    </div>
                                    <span className="font-semibold text-red-600">{formatCurrency(loan.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {(financialAnalysis.preliminaryFindings.anomalies?.length || 0) > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                Anomalies Detected
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                {financialAnalysis.preliminaryFindings.anomalies?.map((item, idx) => (
                                  <div key={idx} className="p-2 bg-yellow-50 dark:bg-yellow-950/30 rounded border border-yellow-200 dark:border-yellow-800">
                                    <p className="font-medium text-sm">{item.description}</p>
                                    <p className="text-xs text-muted-foreground">{item.details}</p>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="flags">
                    {financialAnalysis.redFlags && financialAnalysis.redFlags.length > 0 ? (
                      <div className="space-y-2">
                        {financialAnalysis.redFlags.map((flag, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center gap-3 p-3 rounded-lg ${
                              flag.isActive
                                ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
                                : "bg-muted"
                            }`}
                          >
                            {flag.isActive ? (
                              <AlertCircle className="h-5 w-5 text-red-500" />
                            ) : (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            )}
                            <span className={flag.isActive ? "text-red-700 dark:text-red-400" : "text-muted-foreground"}>
                              {flag.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">No risk flags detected</p>
                    )}
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <div className="text-center py-12">
                <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No financial analysis available</p>
                <Button variant="outline" className="mt-4" onClick={() => setCurrentStep(2)}>
                  Upload Bank Statement
                </Button>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={() => setCurrentStep(4)} data-testid="button-next-step">
                Continue
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Due Diligence Checks</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Companies House Data
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Company</span>
                      <span className="font-medium">{prospect.company.companyName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Number</span>
                      <span className="font-mono">{prospect.company.companyNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={prospect.company.companyStatus === 'active' ? 'default' : 'secondary'}>
                        {prospect.company.companyStatus || 'Active'}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => window.open(`https://find-and-update.company-information.service.gov.uk/company/${prospect.company.companyNumber}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View on Companies House
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Adverse Media Search
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {adverseMedia ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Risk Level</span>
                        <Badge variant={
                          adverseMedia.riskLevel === 'HIGH' ? 'destructive' :
                          adverseMedia.riskLevel === 'MEDIUM' ? 'secondary' : 'default'
                        }>
                          {adverseMedia.riskLevel}
                        </Badge>
                      </div>
                      <p className="text-sm">{adverseMedia.summary}</p>
                      {adverseMedia.results && adverseMedia.results.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">{adverseMedia.results.length} sources found</p>
                          {adverseMedia.results.slice(0, 3).map((result, idx) => (
                            <a
                              key={idx}
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs text-primary hover:underline truncate"
                            >
                              {result.title}
                            </a>
                          ))}
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => adverseMediaMutation.mutate()}
                        disabled={adverseMediaMutation.isPending}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${adverseMediaMutation.isPending ? 'animate-spin' : ''}`} />
                        Refresh Search
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <Button
                        onClick={() => adverseMediaMutation.mutate()}
                        disabled={adverseMediaMutation.isPending}
                        data-testid="button-adverse-media"
                      >
                        {adverseMediaMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Searching...
                          </>
                        ) : (
                          <>
                            <Search className="h-4 w-4 mr-2" />
                            Run Adverse Media Search
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {adverseMedia?.flags && adverseMedia.flags.length > 0 && (
              <Card className="border-amber-200 dark:border-amber-800">
                <CardHeader>
                  <CardTitle className="text-base text-amber-600 dark:text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Concerns Identified
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {adverseMedia.flags.map((flag, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <AlertCircle className="h-4 w-4 mt-0.5 text-amber-500" />
                        {flag}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(3)}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={() => setCurrentStep(5)} data-testid="button-next-step">
                Continue
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-lg font-semibold">Credit Decision Summary</h3>
              {financialAnalysis && getRiskGradeBadge(financialAnalysis.riskScore)}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Loan Parameters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Loan Amount</span>
                    <span className="font-bold">{formatCurrency(parseFloat(loanAmount) || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Term</span>
                    <span className="font-medium">{termMonths} months</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Interest Rate</span>
                    <span className="font-medium">{interestRate}%</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly Repayment</span>
                    <span className="font-bold text-primary">{formatCurrency(monthlyRepayment)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Arrangement Fee</span>
                    <span className="font-medium">{formatCurrency(parseFloat(loanAmount) * (ARRANGEMENT_FEE_PERCENT / 100))}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Risk Assessment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">DSCR</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${(financialAnalysis?.dscr || 0) >= DSCR_THRESHOLD ? 'text-green-600' : 'text-red-600'}`}>
                        {(financialAnalysis?.dscr || 0).toFixed(2)}x
                      </span>
                      {(financialAnalysis?.dscr || 0) >= DSCR_THRESHOLD ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Threshold</span>
                    <span className="font-medium">{DSCR_THRESHOLD}x</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Eligibility</span>
                    <Badge variant={isEligible ? 'default' : 'destructive'}>
                      {isEligible ? 'Eligible' : 'Not Eligible'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Adverse Media</span>
                    <Badge variant={
                      adverseMedia?.riskLevel === 'HIGH' ? 'destructive' :
                      adverseMedia?.riskLevel === 'MEDIUM' ? 'secondary' : 'default'
                    }>
                      {adverseMedia?.riskLevel || 'Not Checked'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Red Flags</span>
                    <span className="font-medium">
                      {financialAnalysis?.redFlags?.filter(f => f.isActive).length || 0} active
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Decision Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{financialAnalysis?.summary || 'No analysis summary available.'}</p>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(4)}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={() => setCurrentStep(6)} data-testid="button-next-step">
                Continue to Summary
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 6 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Adviser Summary (CAMPARI)</h3>
            <p className="text-sm text-muted-foreground">
              Complete the adviser summary using the CAMPARI framework for final submission.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="soar-ref">SOAR Reference</Label>
                <Input
                  id="soar-ref"
                  value={adviserSummary.soarRef}
                  onChange={(e) => setAdviserSummary({ ...adviserSummary, soarRef: e.target.value })}
                  placeholder="Enter reference number"
                  data-testid="input-soar-ref"
                />
              </div>
              <div>
                <Label htmlFor="product">Product</Label>
                <Select
                  value={adviserSummary.product}
                  onValueChange={(value) => setAdviserSummary({ ...adviserSummary, product: value })}
                >
                  <SelectTrigger id="product">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RGF">RGF (Regional Growth Fund)</SelectItem>
                    <SelectItem value="ELEM2">ELEM2</SelectItem>
                    <SelectItem value="MEIFII">MEIFII</SelectItem>
                    <SelectItem value="STARTUP">Start Up Loan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="region">Region</Label>
                <Select
                  value={adviserSummary.region}
                  onValueChange={(value) => setAdviserSummary({ ...adviserSummary, region: value })}
                >
                  <SelectTrigger id="region">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="England">England</SelectItem>
                    <SelectItem value="Scotland">Scotland</SelectItem>
                    <SelectItem value="Wales">Wales</SelectItem>
                    <SelectItem value="Northern Ireland">Northern Ireland</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="sector">Sector</Label>
                <Input
                  id="sector"
                  value={adviserSummary.sector}
                  onChange={(e) => setAdviserSummary({ ...adviserSummary, sector: e.target.value })}
                  placeholder="e.g., Professional Services"
                  data-testid="input-sector"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="purpose">Purpose of Finance</Label>
              <Textarea
                id="purpose"
                value={adviserSummary.purpose}
                onChange={(e) => setAdviserSummary({ ...adviserSummary, purpose: e.target.value })}
                placeholder="Describe the purpose of the loan..."
                rows={3}
                data-testid="textarea-purpose"
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium">CAMPARI Sections</h4>
              <Tabs defaultValue="character">
                <TabsList className="flex-wrap gap-1 h-auto">
                  {SUMMARY_SECTIONS.slice(2, 9).map((section) => (
                    <TabsTrigger key={section.key} value={section.key} className="text-xs">
                      {section.title.split('–')[0]}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {SUMMARY_SECTIONS.slice(2, 9).map((section) => (
                  <TabsContent key={section.key} value={section.key}>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">{section.title}</CardTitle>
                        {CAMPARI_QUESTIONS[section.key] && (
                          <CardDescription>
                            Consider: {CAMPARI_QUESTIONS[section.key].slice(0, 2).join(' ')}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <Textarea
                          value={adviserSummary.sections?.[section.key] || ''}
                          onChange={(e) => setAdviserSummary({
                            ...adviserSummary,
                            sections: {
                              ...adviserSummary.sections,
                              [section.key]: e.target.value
                            }
                          })}
                          placeholder={`Enter ${section.title.split('–')[1]?.trim() || section.key} assessment...`}
                          rows={5}
                          data-testid={`textarea-${section.key}`}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                ))}
              </Tabs>
            </div>

            <div>
              <Label htmlFor="recommendation">Final Recommendation</Label>
              <Select
                value={adviserSummary.recommendation || ''}
                onValueChange={(value) => setAdviserSummary({ ...adviserSummary, recommendation: value })}
              >
                <SelectTrigger id="recommendation">
                  <SelectValue placeholder="Select recommendation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approve">Recommend Approval</SelectItem>
                  <SelectItem value="approve_conditions">Approve with Conditions</SelectItem>
                  <SelectItem value="refer">Refer to Credit Committee</SelectItem>
                  <SelectItem value="decline">Recommend Decline</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(5)}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={saveAdviserSummary} disabled={isSaving} data-testid="button-save-summary">
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Saving..." : "Save Underwriting Assessment"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
