import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Sparkles,
  Send,
  Link,
  Clock,
  Check,
  Mail,
  Info,
  Plug,
  Lightbulb,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
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
import { formatAsBulletPoints } from "@/lib/formatBulletPoints";

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
  const monthlyRate = rate / 100 / 12;
  if (monthlyRate === 0) return amount / termMonths;
  return (
    (amount * (monthlyRate * Math.pow(1 + monthlyRate, termMonths))) /
    (Math.pow(1 + monthlyRate, termMonths) - 1)
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface OpenBankingSectionProps {
  openBanking?: {
    status: "not_sent" | "invited" | "connected" | "expired" | "error";
    invitedAt?: string;
    connectedAt?: string;
    customerEmail?: string;
    linkId?: string;
  };
  existingUnderwriting: UnderwritingData;
  onSave: (data: Partial<DueDiligenceData>) => void;
  isSaving: boolean;
}

function OpenBankingSection({
  openBanking,
  existingUnderwriting,
  onSave,
  isSaving,
}: OpenBankingSectionProps) {
  const [email, setEmail] = useState(openBanking?.customerEmail || "");
  const [isSending, setIsSending] = useState(false);

  const status = openBanking?.status || "not_sent";

  const getStatusBadge = () => {
    switch (status) {
      case "connected":
        return (
          <Badge className="bg-green-500 text-white text-xs">
            <Check className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        );
      case "invited":
        return (
          <Badge className="bg-amber-500 text-white text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="destructive" className="text-xs">
            <AlertCircle className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive" className="text-xs">
            <XCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-xs">
            Not Sent
          </Badge>
        );
    }
  };

  const handleSendLink = async () => {
    if (!email) {
      toast.error("Please enter a customer email address");
      return;
    }

    setIsSending(true);
    try {
      onSave({
        underwriting: {
          ...existingUnderwriting,
          openBanking: {
            status: "invited",
            invitedAt: new Date().toISOString(),
            customerEmail: email,
            linkId: `ob_${Date.now()}`,
          },
        },
      });
      toast.success("Open Banking invitation sent");
    } catch (error) {
      toast.error("Failed to send invitation");
    } finally {
      setIsSending(false);
    }
  };

  if (status === "connected") {
    return (
      <div className="text-center space-y-2">
        <Link className="h-8 w-8 mx-auto text-green-500" />
        {getStatusBadge()}
        <p className="text-xs text-muted-foreground">
          {openBanking?.connectedAt
            ? `Connected ${new Date(openBanking.connectedAt).toLocaleDateString()}`
            : "Bank linked"}
        </p>
      </div>
    );
  }

  if (status === "invited") {
    return (
      <div className="text-center space-y-2">
        <Mail className="h-8 w-8 mx-auto text-amber-500" />
        {getStatusBadge()}
        <p className="text-xs text-muted-foreground truncate">{openBanking?.customerEmail}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSendLink}
          disabled={isSending || isSaving}
        >
          Resend
        </Button>
      </div>
    );
  }

  if (status === "expired" || status === "error") {
    return (
      <div className="text-center space-y-2">
        <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
        {getStatusBadge()}
        <p className="text-xs text-muted-foreground truncate">{openBanking?.customerEmail}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSendLink}
          disabled={isSending || isSaving}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-center">
      <Link className="h-8 w-8 mx-auto text-muted-foreground" />
      {getStatusBadge()}
      <Input
        type="email"
        placeholder="Customer email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-8 text-xs"
        data-testid="input-openbanking-email"
      />
      <Button
        size="sm"
        onClick={handleSendLink}
        disabled={isSending || isSaving || !email}
        className="w-full"
        data-testid="button-send-openbanking"
      >
        {isSending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <>
            <Send className="h-3 w-3 mr-1" />
            Send Link
          </>
        )}
      </Button>
    </div>
  );
}

export function CreditUnderwritingTool({
  prospect,
  data,
  onSave,
  isSaving,
}: CreditUnderwritingToolProps) {
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

  // PDF upload states for audited accounts
  interface AccountsPdf {
    year: string;
    fileName: string;
    text: string;
    pages?: number;
  }
  const [accountsPdfs, setAccountsPdfs] = useState<AccountsPdf[]>(underwriting.accountsPdfs || []);
  const pdfInputRef1 = useRef<HTMLInputElement>(null);
  const pdfInputRef2 = useRef<HTMLInputElement>(null);
  const pdfInputRef3 = useRef<HTMLInputElement>(null);
  const [parsingPdf, setParsingPdf] = useState<number | null>(null);

  // Bank statement PDF upload states (alternative to CSV)
  interface BankStatementPdf {
    fileName: string;
    text?: string;
    pages?: number;
  }
  const [bankStatementPdfs, setBankStatementPdfs] = useState<BankStatementPdf[]>(
    underwriting.bankPdfFiles || []
  );
  const bankPdfInputRef = useRef<HTMLInputElement>(null);
  const [parsingBankPdfs, setParsingBankPdfs] = useState(false);

  // Management accounts state
  interface ManagementAccountFile {
    fileName: string;
    text?: string;
    pages?: number;
  }
  interface ManagementAccountsAnalysis {
    summary?: string;
    keyMetrics?: {
      revenue?: number;
      grossProfit?: number;
      netProfit?: number;
      ebitda?: number;
      totalAssets?: number;
      totalLiabilities?: number;
      netAssets?: number;
      cashPosition?: number;
    };
    commentary?: string;
    strengths?: string[];
    concerns?: string[];
    recommendations?: string[];
    profitabilityAssessment?: string;
    liquidityAssessment?: string;
    overallRating?: "strong" | "satisfactory" | "weak" | "critical";
  }
  const [managementAccountFiles, setManagementAccountFiles] = useState<ManagementAccountFile[]>(
    underwriting.managementAccounts?.files || []
  );
  const [managementAccountsMonths, setManagementAccountsMonths] = useState(
    underwriting.managementAccounts?.months || 3
  );
  const [managementAccountsAnalysis, setManagementAccountsAnalysis] = useState<ManagementAccountsAnalysis | undefined>(
    underwriting.managementAccounts?.analysis
  );
  const [managementAccountsAnalysisStatus, setManagementAccountsAnalysisStatus] = useState<string | undefined>(
    underwriting.managementAccounts?.analysisStatus
  );
  const managementAccountsInputRef = useRef<HTMLInputElement>(null);
  const [parsingManagementAccounts, setParsingManagementAccounts] = useState(false);
  const [analyzingManagementAccounts, setAnalyzingManagementAccounts] = useState(false);

  // Accounting software state
  const [accountingSoftwareStatus, setAccountingSoftwareStatus] = useState<
    "not_linked" | "pending" | "connected" | "error"
  >(underwriting.accountingSoftware?.status || "not_linked");
  const [accountingSoftwarePackage, setAccountingSoftwarePackage] = useState(
    underwriting.accountingSoftware?.softwarePackage || ""
  );
  const [accountingSoftwareEmail, setAccountingSoftwareEmail] = useState(
    underwriting.accountingSoftware?.customerEmail || ""
  );

  // Sync management accounts state when underwriting data changes
  useEffect(() => {
    setManagementAccountFiles(underwriting.managementAccounts?.files || []);
    setManagementAccountsMonths(underwriting.managementAccounts?.months || 3);
    setManagementAccountsAnalysis(underwriting.managementAccounts?.analysis);
    setManagementAccountsAnalysisStatus(underwriting.managementAccounts?.analysisStatus);
  }, [underwriting.managementAccounts]);

  // Sync accounting software state when underwriting data changes
  useEffect(() => {
    setAccountingSoftwareStatus(underwriting.accountingSoftware?.status || "not_linked");
    setAccountingSoftwarePackage(underwriting.accountingSoftware?.softwarePackage || "");
    setAccountingSoftwareEmail(underwriting.accountingSoftware?.customerEmail || "");
  }, [underwriting.accountingSoftware]);

  const [adviserSummary, setAdviserSummary] = useState(
    underwriting.adviserSummary || {
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
    }
  );

  const [refinanceAddBack, setRefinanceAddBack] = useState(
    underwriting.financialAnalysis?.scenarioModeling?.refinanceAddBack?.toString() || "0"
  );
  const [projectedNewRevenue, setProjectedNewRevenue] = useState(
    underwriting.financialAnalysis?.scenarioModeling?.projectedNewRevenue?.toString() || "0"
  );

  const monthlyRepayment =
    loanAmount && termMonths && interestRate
      ? calculateMonthlyPayment(
          parseFloat(loanAmount),
          parseFloat(interestRate),
          parseInt(termMonths)
        )
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

      if (question.category === "eligibility" && answer !== question.requiredAnswer) {
        reasons.push(`Failed: ${question.text}`);
        isEligible = false;
      } else if (question.category === "exclusion" && answer === true) {
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
      const response = await apiRequest(
        `/api/prospects/${prospect.id}/underwriting/analyze-csv`,
        "POST",
        {
          csvData,
          loanAmount: parseFloat(loanAmount),
          monthlyRepayment,
          consentToAiProcessing: true,
        }
      );
      return response.json();
    },
    onSuccess: (result) => {
      // Update local state immediately with the result
      onSave({
        underwriting: {
          ...underwriting,
          financialAnalysis: result,
          csvFileName,
          analysisSource: "csv",
          analyzedAt: new Date().toISOString(),
        },
      });
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospect.id}/due-diligence`] });
      toast.success("Financial analysis complete");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to analyze CSV");
    },
  });

  const analyzeBankPdfsMutation = useMutation({
    mutationFn: async (pdfTexts: { fileName: string; text: string; pages?: number }[]) => {
      const response = await apiRequest(
        `/api/prospects/${prospect.id}/underwriting/analyze-bank-pdfs`,
        "POST",
        {
          pdfTexts,
          loanAmount: parseFloat(loanAmount),
          monthlyRepayment,
          consentToAiProcessing: true,
        }
      );
      return response.json();
    },
    onSuccess: (result) => {
      onSave({
        underwriting: {
          ...underwriting,
          financialAnalysis: result,
          bankPdfFiles: bankStatementPdfs.map((p) => ({ fileName: p.fileName, pages: p.pages })),
          analysisSource: "pdf",
          analyzedAt: new Date().toISOString(),
        },
      });
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospect.id}/due-diligence`] });
      toast.success("Bank statement PDF analysis complete");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to analyze bank statement PDFs");
    },
  });

  const adverseMediaMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        `/api/prospects/${prospect.id}/underwriting/adverse-media`,
        "POST",
        {
          companyName: prospect.company.companyName,
          companyNumber: prospect.company.companyNumber,
        }
      );
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

  const analyzeAccountsMutation = useMutation({
    mutationFn: async (pdfTexts: { year: string; text: string }[]) => {
      const response = await apiRequest(
        `/api/prospects/${prospect.id}/underwriting/analyze-accounts`,
        "POST",
        {
          pdfTexts,
          loanAmount: parseFloat(loanAmount),
          monthlyRepayment,
          consentToAiProcessing: true,
        }
      );
      return response.json();
    },
    onSuccess: (result) => {
      onSave({
        underwriting: {
          ...underwriting,
          accountsPdfs,
          accountsAnalysis: result,
          accountsAnalyzedAt: new Date().toISOString(),
        },
      });
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospect.id}/due-diligence`] });
      toast.success("Audited accounts analysis complete");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to analyze accounts");
    },
  });

  const swotMutation = useMutation({
    mutationFn: async () => {
      const financialAnalysis = underwriting.financialAnalysis;
      const accountsAnalysis = underwriting.accountsAnalysis;

      const financialSummary = financialAnalysis
        ? `Risk Score: ${financialAnalysis.riskScore}, DSCR: ${financialAnalysis.dscr?.toFixed(2) || "N/A"}, Monthly Revenue: £${financialAnalysis.averageMonthlyRevenue?.toLocaleString() || "0"}, Net Disposable Income: £${financialAnalysis.netDisposableIncome?.toLocaleString() || "0"}`
        : "";

      const bankAnalysisSummary = financialAnalysis?.summary || "";

      const companiesHouseData = prospect.company
        ? `Incorporated: ${prospect.company.incorporationDate || "Unknown"}, Status: ${prospect.company.companyStatus || "Unknown"}, Type: ${prospect.company.companyType || "Unknown"}`
        : "";

      const response = await apiRequest(
        `/api/prospects/${prospect.id}/underwriting/swot-analysis`,
        "POST",
        {
          companyName: prospect.company.companyName,
          sector: adviserSummary.sector,
          loanAmount: parseFloat(loanAmount),
          loanPurpose: adviserSummary.purpose,
          financialSummary,
          companiesHouseData,
          bankAnalysisSummary,
          consentToAiProcessing: true,
        }
      );
      return response.json();
    },
    onSuccess: (result) => {
      onSave({
        underwriting: {
          ...underwriting,
          swotAnalysis: result,
          swotAnalyzedAt: new Date().toISOString(),
        },
      });
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospect.id}/due-diligence`] });
      toast.success("SWOT analysis generated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to generate SWOT analysis");
    },
  });

  const [generatingSection, setGeneratingSection] = useState<string | null>(null);

  const campariSectionMutation = useMutation({
    mutationFn: async (sectionKey: string) => {
      setGeneratingSection(sectionKey);
      const financialAnalysis = underwriting.financialAnalysis;
      const accountsAnalysis = underwriting.accountsAnalysis;

      const financialSummary = financialAnalysis
        ? `Risk Score: ${financialAnalysis.riskScore}, DSCR: ${financialAnalysis.dscr?.toFixed(2) || "N/A"}, Monthly Revenue: £${financialAnalysis.averageMonthlyRevenue?.toLocaleString() || "0"}, Net Disposable Income: £${financialAnalysis.netDisposableIncome?.toLocaleString() || "0"}`
        : "";

      const bankAnalysisSummary = financialAnalysis?.summary || "";
      const accountsAnalysisSummary = accountsAnalysis?.summary || "";

      const companiesHouseData = prospect.company
        ? `Incorporated: ${prospect.company.incorporationDate || "Unknown"}, Status: ${prospect.company.companyStatus || "Unknown"}, Type: ${prospect.company.companyType || "Unknown"}`
        : "";

      const response = await apiRequest(
        `/api/prospects/${prospect.id}/underwriting/campari-section`,
        "POST",
        {
          sectionKey,
          companyName: prospect.company.companyName,
          sector: adviserSummary.sector,
          loanAmount: parseFloat(loanAmount),
          loanPurpose: adviserSummary.purpose,
          financialSummary,
          companiesHouseData,
          bankAnalysisSummary,
          accountsAnalysisSummary,
          consentToAiProcessing: true,
        }
      );
      return response.json();
    },
    onSuccess: (result) => {
      const updatedSections = {
        ...adviserSummary.sections,
        [result.sectionKey]: result.content,
      };
      const updatedAdviserSummary = {
        ...adviserSummary,
        sections: updatedSections,
      };
      setAdviserSummary(updatedAdviserSummary);
      onSave({
        underwriting: {
          ...underwriting,
          adviserSummary: updatedAdviserSummary,
        },
      });
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospect.id}/due-diligence`] });
      toast.success(
        `${result.sectionKey.charAt(0).toUpperCase() + result.sectionKey.slice(1)} section generated`
      );
      setGeneratingSection(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to generate section");
      setGeneratingSection(null);
    },
  });

  const handlePdfUpload = async (yearIndex: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please upload a PDF file");
      return;
    }

    setParsingPdf(yearIndex);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
        );

        try {
          const response = await apiRequest("/api/parse-pdf", "POST", { pdfBase64: base64 });
          const data = await response.json();

          const currentYear = new Date().getFullYear();
          const yearLabels = [`${currentYear - 1}`, `${currentYear - 2}`, `${currentYear - 3}`];

          const newPdf: AccountsPdf = {
            year: yearLabels[yearIndex] || `Year ${yearIndex + 1}`,
            fileName: file.name,
            text: data.text,
            pages: data.pages,
          };

          const updatedPdfs = [...accountsPdfs];
          updatedPdfs[yearIndex] = newPdf;
          setAccountsPdfs(updatedPdfs);

          onSave({
            underwriting: {
              ...underwriting,
              accountsPdfs: updatedPdfs,
            },
          });

          toast.success(`Parsed ${file.name} (${data.pages} pages)`);
        } catch (error: any) {
          toast.error(error.message || "Failed to parse PDF");
        } finally {
          setParsingPdf(null);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error: any) {
      toast.error("Failed to read file");
      setParsingPdf(null);
    }
  };

  const handleAnalyzeAccounts = () => {
    const validPdfs = accountsPdfs.filter((pdf) => pdf && pdf.text);
    if (validPdfs.length === 0) {
      toast.error("Please upload at least one year of accounts");
      return;
    }
    if (!loanAmount || parseFloat(loanAmount) <= 0) {
      toast.error("Please enter a valid loan amount");
      return;
    }
    analyzeAccountsMutation.mutate(validPdfs.map((pdf) => ({ year: pdf.year, text: pdf.text })));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
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

  const handleBankPdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (files.length > 6) {
      toast.error("Maximum 6 bank statement PDFs allowed");
      return;
    }

    setParsingBankPdfs(true);

    try {
      const parsedPdfs: BankStatementPdf[] = [];

      for (const file of Array.from(files)) {
        if (!file.name.toLowerCase().endsWith(".pdf")) {
          toast.error(`${file.name} is not a PDF file`);
          continue;
        }

        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
        );

        try {
          const response = await apiRequest("/api/parse-pdf", "POST", { pdfBase64: base64 });
          const data = await response.json();

          parsedPdfs.push({
            fileName: file.name,
            text: data.text,
            pages: data.pages,
          });
        } catch (error: any) {
          toast.error(`Failed to parse ${file.name}`);
        }
      }

      if (parsedPdfs.length > 0) {
        setBankStatementPdfs(parsedPdfs);
        onSave({
          underwriting: {
            ...underwriting,
            bankPdfFiles: parsedPdfs.map((p) => ({ fileName: p.fileName, pages: p.pages })),
          },
        });
        toast.success(
          `Parsed ${parsedPdfs.length} bank statement${parsedPdfs.length > 1 ? "s" : ""}`
        );
      }
    } catch (error: any) {
      toast.error("Failed to process PDF files");
    } finally {
      setParsingBankPdfs(false);
    }
  };

  const handleAnalyzeBankPdfs = () => {
    const pdfsWithText = bankStatementPdfs.filter(
      (pdf): pdf is BankStatementPdf & { text: string } => !!pdf.text
    );
    if (pdfsWithText.length === 0) {
      toast.error("Please upload at least one bank statement PDF");
      return;
    }
    if (!loanAmount || parseFloat(loanAmount) <= 0) {
      toast.error("Please enter a valid loan amount");
      return;
    }
    analyzeBankPdfsMutation.mutate(pdfsWithText);
  };

  const clearBankPdfs = () => {
    setBankStatementPdfs([]);
    if (bankPdfInputRef.current) {
      bankPdfInputRef.current.value = "";
    }
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
  const accountsAnalysis = underwriting.accountsAnalysis;
  const adverseMedia = underwriting.adverseMedia;
  const { isEligible, reasons } = checkEligibility();

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return (
          Object.keys(eligibilityAnswers).length === ELIGIBILITY_QUESTIONS.length && isEligible
        );
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
              <div key={step.id} className="flex items-center">
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
                    <span className="text-muted-foreground">
                      Arrangement Fee ({ARRANGEMENT_FEE_PERCENT}%):
                    </span>
                    <span className="font-semibold">
                      {formatCurrency(parseFloat(loanAmount) * (ARRANGEMENT_FEE_PERCENT / 100))}
                    </span>
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
                        {question.category === "eligibility" ? "Must be Yes" : "Must be No"}
                      </Badge>
                    </div>
                    <RadioGroup
                      value={
                        eligibilityAnswers[question.id] === true
                          ? "yes"
                          : eligibilityAnswers[question.id] === false
                            ? "no"
                            : ""
                      }
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
                        <Label htmlFor={`${question.id}-yes`} className="cursor-pointer">
                          Yes
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="no" id={`${question.id}-no`} />
                        <Label htmlFor={`${question.id}-no`} className="cursor-pointer">
                          No
                        </Label>
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
            <div>
              <h3 className="text-lg font-semibold">Bank Statement Data</h3>
              <p className="text-sm text-muted-foreground">
                Choose one method to provide bank statement data for AI-powered financial analysis.
              </p>
            </div>

            {financialAnalysis && (
              <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium text-sm">Bank Statement Analysis Complete</span>
                  {getRiskGradeBadge(financialAnalysis.riskScore)}
                </div>
                {financialAnalysis.summary && (
                  <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                    {formatAsBulletPoints(financialAnalysis.summary).map((point, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-2 border-dashed">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    CSV Upload
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    data-testid="input-csv-upload"
                  />
                  {csvFileName ? (
                    <div className="space-y-2 text-center">
                      <FileText className="h-8 w-8 mx-auto text-green-500" />
                      <p className="text-xs font-medium truncate">{csvFileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {csvText.split("\n").length} rows
                      </p>
                      <div className="flex gap-2 justify-center flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Replace
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleAnalyze}
                          disabled={analyzeCsvMutation.isPending}
                          data-testid="button-analyze-csv"
                        >
                          {analyzeCsvMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Analyze"
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-2">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                      <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                        Select CSV
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-2 border-dashed">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    PDF Upload
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <input
                    type="file"
                    ref={bankPdfInputRef}
                    accept=".pdf"
                    multiple
                    onChange={handleBankPdfUpload}
                    className="hidden"
                    data-testid="input-bank-pdf-upload"
                  />
                  {parsingBankPdfs ? (
                    <div className="text-center space-y-2">
                      <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
                      <p className="text-xs text-muted-foreground">Parsing...</p>
                    </div>
                  ) : bankStatementPdfs.length > 0 ? (
                    <div className="space-y-2 text-center">
                      <FileText className="h-8 w-8 mx-auto text-green-500" />
                      <p className="text-xs font-medium">
                        {bankStatementPdfs.length} PDF{bankStatementPdfs.length > 1 ? "s" : ""}
                      </p>
                      <div className="flex gap-2 justify-center flex-wrap">
                        <Button variant="outline" size="sm" onClick={clearBankPdfs}>
                          Clear
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleAnalyzeBankPdfs}
                          disabled={analyzeBankPdfsMutation.isPending}
                          data-testid="button-analyze-bank-pdfs"
                        >
                          {analyzeBankPdfsMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Analyze"
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-2">
                      <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
                      <Button size="sm" onClick={() => bankPdfInputRef.current?.click()}>
                        Select PDFs
                      </Button>
                      <p className="text-xs text-muted-foreground">Up to 6 months</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-2 border-dashed">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Open Banking
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <OpenBankingSection
                    openBanking={underwriting.openBanking}
                    existingUnderwriting={underwriting}
                    onSave={onSave}
                    isSaving={isSaving}
                  />
                </CardContent>
              </Card>
            </div>

            <Separator className="my-6" />

            {/* Section 1: Audited Accounts Upload */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold">
                    Last Three Years Financial Accounts
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm">
                        Upload the last 3 years of audited or filed accounts in PDF format.{" "}
                        <strong>Must include notes to the accounts</strong> for complete financial
                        analysis including depreciation, director loans, and related party
                        transactions.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <CardDescription>
                  Upload audited accounts with notes for trend analysis, credit ratios, and DSCR
                  calculation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[0, 1, 2].map((yearIndex) => {
                    const currentYear = new Date().getFullYear();
                    const yearLabels = [
                      `${currentYear - 1}`,
                      `${currentYear - 2}`,
                      `${currentYear - 3}`,
                    ];
                    const pdfRef =
                      yearIndex === 0
                        ? pdfInputRef1
                        : yearIndex === 1
                          ? pdfInputRef2
                          : pdfInputRef3;
                    const pdf = accountsPdfs[yearIndex];

                    return (
                      <div
                        key={yearIndex}
                        className="border-2 border-dashed rounded-lg p-4 text-center"
                      >
                        <input
                          type="file"
                          ref={pdfRef}
                          accept=".pdf"
                          onChange={(e) => handlePdfUpload(yearIndex, e)}
                          className="hidden"
                          data-testid={`input-pdf-upload-${yearIndex}`}
                        />
                        <p className="text-sm font-medium mb-2">
                          Year Ending {yearLabels[yearIndex]}
                        </p>
                        {parsingPdf === yearIndex ? (
                          <div className="space-y-2">
                            <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Parsing PDF...</p>
                          </div>
                        ) : pdf ? (
                          <div className="space-y-2">
                            <FileText className="h-8 w-8 mx-auto text-green-500" />
                            <p className="text-xs font-medium truncate">{pdf.fileName}</p>
                            <p className="text-xs text-muted-foreground">{pdf.pages} pages</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => pdfRef.current?.click()}
                            >
                              Replace
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Building2 className="h-8 w-8 mx-auto text-muted-foreground" />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => pdfRef.current?.click()}
                            >
                              Upload PDF
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {accountsPdfs.filter((p) => p?.text).length > 0 && (
                  <div className="flex justify-center mt-4">
                    <Button
                      onClick={handleAnalyzeAccounts}
                      disabled={analyzeAccountsMutation.isPending}
                      data-testid="button-analyze-accounts"
                    >
                      {analyzeAccountsMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing Accounts...
                        </>
                      ) : (
                        <>
                          <TrendingUp className="h-4 w-4 mr-2" />
                          Analyze {accountsPdfs.filter((p) => p?.text).length} Year
                          {accountsPdfs.filter((p) => p?.text).length > 1 ? "s" : ""} of Accounts
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {accountsAnalysis && (
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3">
                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">Accounts Analysis Complete</span>
                      {accountsAnalysis.riskAssessment && (
                        <Badge
                          className={
                            accountsAnalysis.riskAssessment === "low"
                              ? "bg-green-500 text-white"
                              : accountsAnalysis.riskAssessment === "medium"
                                ? "bg-yellow-500 text-white"
                                : "bg-red-500 text-white"
                          }
                        >
                          {accountsAnalysis.riskAssessment.toUpperCase()} Risk
                        </Badge>
                      )}
                    </div>
                    {accountsAnalysis.summary && (
                      <ul className="text-sm space-y-1">
                        {formatAsBulletPoints(accountsAnalysis.summary).map((point, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-blue-500 mt-0.5">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {accountsAnalysis.trends?.trend && (
                      <div className="text-sm">
                        <span className="font-medium">Trend: </span>
                        <Badge
                          variant={
                            accountsAnalysis.trends.trend === "improving"
                              ? "default"
                              : accountsAnalysis.trends.trend === "stable"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {accountsAnalysis.trends.trend.charAt(0).toUpperCase() +
                            accountsAnalysis.trends.trend.slice(1)}
                        </Badge>
                      </div>
                    )}

                    {accountsAnalysis.dscr?.average !== undefined &&
                      accountsAnalysis.dscr.average > 0 && (
                        <div className="text-sm">
                          <span className="font-medium">Avg Historical DSCR: </span>
                          <span
                            className={
                              accountsAnalysis.dscr.average >= 1.25
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {accountsAnalysis.dscr.average.toFixed(2)}x
                          </span>
                        </div>
                      )}

                    {accountsAnalysis.concerns && accountsAnalysis.concerns.length > 0 && (
                      <div className="text-sm">
                        <span className="font-medium text-amber-600 dark:text-amber-400">
                          {accountsAnalysis.concerns.length} Concern
                          {accountsAnalysis.concerns.length > 1 ? "s" : ""} Identified
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Section 2: Management Accounts */}
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold">
                    Latest Management Accounts
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm">
                        Upload the most recent management accounts showing Profit & Loss and Balance
                        Sheet. This provides up-to-date financial performance since the last filed
                        accounts.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <CardDescription>
                  Upload recent management accounts for current trading performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4 items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <Label
                        htmlFor="management-months"
                        className="text-sm font-medium whitespace-nowrap"
                      >
                        Number of months:
                      </Label>
                      <Select
                        value={managementAccountsMonths.toString()}
                        onValueChange={(val) => {
                          setManagementAccountsMonths(parseInt(val));
                          onSave({
                            underwriting: {
                              ...underwriting,
                              managementAccounts: {
                                ...underwriting.managementAccounts,
                                months: parseInt(val),
                              },
                            },
                          });
                        }}
                      >
                        <SelectTrigger className="w-24" data-testid="select-management-months">
                          <SelectValue placeholder="Months" />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                            <SelectItem key={m} value={m.toString()}>
                              {m} month{m > 1 ? "s" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <input
                      type="file"
                      ref={managementAccountsInputRef}
                      accept=".pdf"
                      multiple
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (!files || files.length === 0) return;
                        setParsingManagementAccounts(true);
                        setAnalyzingManagementAccounts(false);
                        try {
                          const parsedFiles: ManagementAccountFile[] = [];
                          for (const file of Array.from(files)) {
                            const arrayBuffer = await file.arrayBuffer();
                            const base64 = btoa(
                              new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
                            );
                            const response = await apiRequest("/api/parse-pdf", "POST", { pdfBase64: base64 });
                            const data = await response.json();
                            parsedFiles.push({
                              fileName: file.name,
                              text: data.text,
                              pages: data.pages,
                            });
                          }
                          setManagementAccountFiles(parsedFiles);
                          setParsingManagementAccounts(false);
                          
                          // Now analyze with AI
                          setAnalyzingManagementAccounts(true);
                          toast.info("Analyzing management accounts with AI...");
                          
                          try {
                            const analysisResponse = await apiRequest(
                              `/api/prospects/${prospect.id}/analyze-management-accounts`,
                              "POST",
                              {
                                files: parsedFiles,
                                months: managementAccountsMonths,
                                consentToAiProcessing: true,
                              }
                            );
                            const analysisData = await analysisResponse.json();
                            
                            if (analysisData.success && analysisData.analysis) {
                              setManagementAccountsAnalysis(analysisData.analysis);
                              setManagementAccountsAnalysisStatus("completed");
                              toast.success("Management accounts analyzed successfully");
                              
                              // Trigger refetch of due diligence data
                              onSave({
                                underwriting: {
                                  ...underwriting,
                                  managementAccounts: {
                                    files: parsedFiles.map((p) => ({
                                      fileName: p.fileName,
                                      pages: p.pages,
                                    })),
                                    months: managementAccountsMonths,
                                    uploadedAt: new Date().toISOString(),
                                    analysisStatus: "completed",
                                    analyzedAt: new Date().toISOString(),
                                    analysis: analysisData.analysis,
                                  },
                                },
                              });
                            } else {
                              throw new Error(analysisData.error || "Analysis failed");
                            }
                          } catch (analysisError: any) {
                            console.error("AI analysis error:", analysisError);
                            setManagementAccountsAnalysisStatus("error");
                            toast.error(analysisError.message || "Failed to analyze management accounts");
                            // Still save the parsed files even if analysis failed
                            onSave({
                              underwriting: {
                                ...underwriting,
                                managementAccounts: {
                                  files: parsedFiles.map((p) => ({
                                    fileName: p.fileName,
                                    pages: p.pages,
                                  })),
                                  months: managementAccountsMonths,
                                  uploadedAt: new Date().toISOString(),
                                  analysisStatus: "error",
                                },
                              },
                            });
                          }
                        } catch (error) {
                          toast.error("Failed to parse management accounts");
                        } finally {
                          setParsingManagementAccounts(false);
                          setAnalyzingManagementAccounts(false);
                        }
                      }}
                      className="hidden"
                      data-testid="input-management-accounts"
                    />
                    <div className="border-2 border-dashed rounded-lg p-4 text-center">
                      {parsingManagementAccounts || analyzingManagementAccounts ? (
                        <div className="space-y-2">
                          <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
                          <p className="text-sm text-muted-foreground">
                            {parsingManagementAccounts ? "Parsing files..." : "Analyzing with AI..."}
                          </p>
                        </div>
                      ) : managementAccountFiles.length > 0 ? (
                        <div className="space-y-2">
                          <FileText className="h-8 w-8 mx-auto text-green-500" />
                          <p className="text-sm font-medium">
                            {managementAccountFiles.length} file
                            {managementAccountFiles.length > 1 ? "s" : ""} uploaded
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {managementAccountFiles.map((f) => f.fileName).join(", ")}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => managementAccountsInputRef.current?.click()}
                          >
                            Replace Files
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => managementAccountsInputRef.current?.click()}
                          >
                            Upload Management Accounts
                          </Button>
                          <p className="text-xs text-muted-foreground">PDF format</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Management Accounts AI Analysis Display */}
                {managementAccountsAnalysis && managementAccountsAnalysisStatus === "completed" && (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <h4 className="font-semibold">AI Analysis Results</h4>
                      <Badge
                        variant={
                          managementAccountsAnalysis.overallRating === "strong"
                            ? "default"
                            : managementAccountsAnalysis.overallRating === "satisfactory"
                            ? "secondary"
                            : managementAccountsAnalysis.overallRating === "weak"
                            ? "outline"
                            : "destructive"
                        }
                        className="capitalize"
                        data-testid="badge-management-accounts-rating"
                      >
                        {managementAccountsAnalysis.overallRating || "N/A"}
                      </Badge>
                    </div>
                    
                    {/* Summary */}
                    {managementAccountsAnalysis.summary && (
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-sm font-medium mb-1">Summary</p>
                        <p className="text-sm text-muted-foreground">{managementAccountsAnalysis.summary}</p>
                      </div>
                    )}
                    
                    {/* Key Metrics */}
                    {managementAccountsAnalysis.keyMetrics && Object.keys(managementAccountsAnalysis.keyMetrics).some(k => (managementAccountsAnalysis.keyMetrics as any)[k] != null) && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {managementAccountsAnalysis.keyMetrics.revenue != null && (
                          <div className="bg-card border rounded-lg p-3" data-testid="metric-revenue">
                            <p className="text-xs text-muted-foreground">Revenue</p>
                            <p className="text-lg font-semibold">£{managementAccountsAnalysis.keyMetrics.revenue.toLocaleString()}</p>
                          </div>
                        )}
                        {managementAccountsAnalysis.keyMetrics.grossProfit != null && (
                          <div className="bg-card border rounded-lg p-3" data-testid="metric-gross-profit">
                            <p className="text-xs text-muted-foreground">Gross Profit</p>
                            <p className="text-lg font-semibold">£{managementAccountsAnalysis.keyMetrics.grossProfit.toLocaleString()}</p>
                          </div>
                        )}
                        {managementAccountsAnalysis.keyMetrics.netProfit != null && (
                          <div className="bg-card border rounded-lg p-3" data-testid="metric-net-profit">
                            <p className="text-xs text-muted-foreground">Net Profit</p>
                            <p className="text-lg font-semibold">£{managementAccountsAnalysis.keyMetrics.netProfit.toLocaleString()}</p>
                          </div>
                        )}
                        {managementAccountsAnalysis.keyMetrics.ebitda != null && (
                          <div className="bg-card border rounded-lg p-3" data-testid="metric-ebitda">
                            <p className="text-xs text-muted-foreground">EBITDA</p>
                            <p className="text-lg font-semibold">£{managementAccountsAnalysis.keyMetrics.ebitda.toLocaleString()}</p>
                          </div>
                        )}
                        {managementAccountsAnalysis.keyMetrics.totalAssets != null && (
                          <div className="bg-card border rounded-lg p-3" data-testid="metric-total-assets">
                            <p className="text-xs text-muted-foreground">Total Assets</p>
                            <p className="text-lg font-semibold">£{managementAccountsAnalysis.keyMetrics.totalAssets.toLocaleString()}</p>
                          </div>
                        )}
                        {managementAccountsAnalysis.keyMetrics.totalLiabilities != null && (
                          <div className="bg-card border rounded-lg p-3" data-testid="metric-total-liabilities">
                            <p className="text-xs text-muted-foreground">Total Liabilities</p>
                            <p className="text-lg font-semibold">£{managementAccountsAnalysis.keyMetrics.totalLiabilities.toLocaleString()}</p>
                          </div>
                        )}
                        {managementAccountsAnalysis.keyMetrics.netAssets != null && (
                          <div className="bg-card border rounded-lg p-3" data-testid="metric-net-assets">
                            <p className="text-xs text-muted-foreground">Net Assets</p>
                            <p className="text-lg font-semibold">£{managementAccountsAnalysis.keyMetrics.netAssets.toLocaleString()}</p>
                          </div>
                        )}
                        {managementAccountsAnalysis.keyMetrics.cashPosition != null && (
                          <div className="bg-card border rounded-lg p-3" data-testid="metric-cash-position">
                            <p className="text-xs text-muted-foreground">Cash Position</p>
                            <p className="text-lg font-semibold">£{managementAccountsAnalysis.keyMetrics.cashPosition.toLocaleString()}</p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Commentary */}
                    {managementAccountsAnalysis.commentary && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">AI Commentary</p>
                        <div className="bg-card border rounded-lg p-3">
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {formatAsBulletPoints(managementAccountsAnalysis.commentary).map((point, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-primary mt-0.5">•</span>
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                    
                    {/* Assessments */}
                    <div className="grid md:grid-cols-2 gap-3">
                      {managementAccountsAnalysis.profitabilityAssessment && (
                        <div className="bg-card border rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-1">Profitability Assessment</p>
                          <ul className="text-sm space-y-1">
                            {formatAsBulletPoints(managementAccountsAnalysis.profitabilityAssessment).map((point, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-primary mt-0.5">•</span>
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {managementAccountsAnalysis.liquidityAssessment && (
                        <div className="bg-card border rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-1">Liquidity Assessment</p>
                          <ul className="text-sm space-y-1">
                            {formatAsBulletPoints(managementAccountsAnalysis.liquidityAssessment).map((point, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-primary mt-0.5">•</span>
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    
                    {/* Strengths & Concerns */}
                    <div className="grid md:grid-cols-2 gap-3">
                      {managementAccountsAnalysis.strengths && managementAccountsAnalysis.strengths.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                            <CheckCircle2 className="h-4 w-4" /> Strengths
                          </p>
                          <ul className="text-sm space-y-1">
                            {managementAccountsAnalysis.strengths.map((s, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">+</span>
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {managementAccountsAnalysis.concerns && managementAccountsAnalysis.concerns.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4" /> Concerns
                          </p>
                          <ul className="text-sm space-y-1">
                            {managementAccountsAnalysis.concerns.map((c, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-amber-500 mt-0.5">!</span>
                                <span>{c}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    
                    {/* Recommendations */}
                    {managementAccountsAnalysis.recommendations && managementAccountsAnalysis.recommendations.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium flex items-center gap-1">
                          <Lightbulb className="h-4 w-4 text-primary" /> Recommendations
                        </p>
                        <ul className="text-sm space-y-1 bg-muted/30 rounded-lg p-3">
                          {managementAccountsAnalysis.recommendations.map((r, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-primary mt-0.5">{i + 1}.</span>
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Section 3: Link to Accounting Software */}
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold">
                    Link to Accounting Software
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm">
                        Connect directly to the customer's accounting software (Xero, QuickBooks,
                        Sage, FreeAgent, etc.) to automatically retrieve financial data. This
                        provides real-time access to the most current financial information.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <CardDescription>
                  Connect to accounting software for real-time financial data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Label
                      htmlFor="accounting-software"
                      className="text-sm font-medium whitespace-nowrap"
                    >
                      Software Package:
                    </Label>
                    <Select
                      value={accountingSoftwarePackage}
                      onValueChange={(val) => {
                        setAccountingSoftwarePackage(val);
                        onSave({
                          underwriting: {
                            ...underwriting,
                            accountingSoftware: {
                              ...underwriting.accountingSoftware,
                              softwarePackage: val,
                              status: underwriting.accountingSoftware?.status || "not_linked",
                            },
                          },
                        });
                      }}
                    >
                      <SelectTrigger className="w-48" data-testid="select-accounting-software">
                        <SelectValue placeholder="Select software" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="xero">Xero</SelectItem>
                        <SelectItem value="quickbooks">QuickBooks</SelectItem>
                        <SelectItem value="sage">Sage</SelectItem>
                        <SelectItem value="freeagent">FreeAgent</SelectItem>
                        <SelectItem value="freshbooks">FreshBooks</SelectItem>
                        <SelectItem value="wave">Wave</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {accountingSoftwarePackage && (
                    <div className="border rounded-lg p-4">
                      {accountingSoftwareStatus === "not_linked" && (
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                          <div className="flex-1">
                            <Input
                              type="email"
                              placeholder="Customer email address"
                              value={accountingSoftwareEmail}
                              onChange={(e) => setAccountingSoftwareEmail(e.target.value)}
                              className="max-w-xs"
                              data-testid="input-accounting-software-email"
                            />
                          </div>
                          <Button
                            onClick={() => {
                              if (!accountingSoftwareEmail) {
                                toast.error("Please enter a customer email");
                                return;
                              }
                              setAccountingSoftwareStatus("pending");
                              onSave({
                                underwriting: {
                                  ...underwriting,
                                  accountingSoftware: {
                                    status: "pending",
                                    softwarePackage: accountingSoftwarePackage,
                                    customerEmail: accountingSoftwareEmail,
                                    linkedAt: new Date().toISOString(),
                                  },
                                },
                              });
                              toast.success("Connection request sent to customer");
                            }}
                            disabled={!accountingSoftwareEmail}
                            data-testid="button-send-accounting-link"
                          >
                            <Plug className="h-4 w-4 mr-2" />
                            Send Connection Request
                          </Button>
                        </div>
                      )}

                      {accountingSoftwareStatus === "pending" && (
                        <div className="flex items-center gap-3">
                          <Clock className="h-5 w-5 text-amber-500" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">Awaiting customer connection</p>
                            <p className="text-xs text-muted-foreground">
                              Sent to {accountingSoftwareEmail}
                            </p>
                          </div>
                          <Badge variant="secondary">Pending</Badge>
                        </div>
                      )}

                      {accountingSoftwareStatus === "connected" && (
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              Connected to {accountingSoftwarePackage}
                            </p>
                            <p className="text-xs text-muted-foreground">Financial data synced</p>
                          </div>
                          <Badge className="bg-green-500 text-white">Connected</Badge>
                        </div>
                      )}

                      {accountingSoftwareStatus === "error" && (
                        <div className="flex items-center gap-3">
                          <XCircle className="h-5 w-5 text-red-500" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-red-600">Connection failed</p>
                            <p className="text-xs text-muted-foreground">Please try again</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAccountingSoftwareStatus("not_linked")}
                          >
                            Retry
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

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
                <Card className="overflow-hidden border-0 shadow-md">
                  <div className="bg-[#1e3a5f] text-white px-4 py-3">
                    <h4 className="font-semibold text-sm uppercase tracking-wide">
                      Base Affordability (Historic)
                    </h4>
                  </div>
                  <CardContent className="p-0">
                    <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
                      <div className="p-4 text-center">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                          Avg Monthly Rev
                        </div>
                        <div className="text-xl font-bold text-foreground">
                          {formatCurrency(financialAnalysis.averageMonthlyRevenue || 0)}
                        </div>
                      </div>
                      <div className="p-4 text-center">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                          Avg Monthly Exp
                        </div>
                        <div className="text-xl font-bold text-foreground">
                          {formatCurrency(financialAnalysis.averageMonthlyExpenses || 0)}
                        </div>
                      </div>
                      <div className="p-4 text-center">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                          Net Disposable
                        </div>
                        <div
                          className={`text-xl font-bold ${(financialAnalysis.netDisposableIncome || 0) >= 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          {formatCurrency(financialAnalysis.netDisposableIncome || 0)}
                        </div>
                      </div>
                      <div className="p-4 text-center">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                          Base DSCR
                        </div>
                        <div
                          className={`text-xl font-bold ${(financialAnalysis.dscr || 0) >= DSCR_THRESHOLD ? "text-green-600" : "text-red-600"}`}
                        >
                          {(financialAnalysis.dscr || 0).toFixed(2)}x
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden border-0 shadow-md">
                  <div className="bg-[#1e3a5f] text-white px-4 py-3">
                    <h4 className="font-semibold text-sm uppercase tracking-wide">AI Summary</h4>
                  </div>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground italic leading-relaxed">
                      "{financialAnalysis.summary}"
                    </p>
                  </CardContent>
                </Card>

                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="overflow-hidden border-0 shadow-md">
                    <div className="bg-[#1e3a5f] text-white px-4 py-3 flex items-center justify-between gap-2">
                      <h4 className="font-semibold text-sm uppercase tracking-wide">
                        Adjustments & Projections
                      </h4>
                    </div>
                    <CardContent className="p-4 space-y-4">
                      <div>
                        <Label htmlFor="refinance-addback" className="text-sm font-medium">
                          Refinance Add-Back (Monthly £)
                          <span className="text-xs text-muted-foreground ml-2">
                            - Debt being consolidated
                          </span>
                        </Label>
                        <Input
                          id="refinance-addback"
                          type="number"
                          value={refinanceAddBack}
                          onChange={(e) => setRefinanceAddBack(e.target.value)}
                          onBlur={() => {
                            onSave({
                              underwriting: {
                                ...underwriting,
                                financialAnalysis: {
                                  ...financialAnalysis,
                                  scenarioModeling: {
                                    ...financialAnalysis.scenarioModeling,
                                    refinanceAddBack: parseFloat(refinanceAddBack) || 0,
                                    projectedNewRevenue: parseFloat(projectedNewRevenue) || 0,
                                  },
                                },
                              },
                            });
                          }}
                          className="mt-1"
                          placeholder="0"
                          data-testid="input-refinance-addback"
                        />
                      </div>
                      <div>
                        <Label htmlFor="projected-revenue" className="text-sm font-medium">
                          Projected New Revenue (Monthly £)
                          <span className="text-xs text-muted-foreground ml-2">
                            - Conservative estimate
                          </span>
                        </Label>
                        <Input
                          id="projected-revenue"
                          type="number"
                          value={projectedNewRevenue}
                          onChange={(e) => setProjectedNewRevenue(e.target.value)}
                          onBlur={() => {
                            onSave({
                              underwriting: {
                                ...underwriting,
                                financialAnalysis: {
                                  ...financialAnalysis,
                                  scenarioModeling: {
                                    ...financialAnalysis.scenarioModeling,
                                    refinanceAddBack: parseFloat(refinanceAddBack) || 0,
                                    projectedNewRevenue: parseFloat(projectedNewRevenue) || 0,
                                  },
                                },
                              },
                            });
                          }}
                          className="mt-1"
                          placeholder="0"
                          data-testid="input-projected-revenue"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden border-0 shadow-md">
                    <div className="bg-[#1e3a5f] text-white px-4 py-3">
                      <h4 className="font-semibold text-sm uppercase tracking-wide">
                        Scenario Modeling
                      </h4>
                    </div>
                    <CardContent className="p-4 space-y-3">
                      {(() => {
                        const baseDisposable = financialAnalysis.netDisposableIncome || 0;
                        const refinance = parseFloat(refinanceAddBack) || 0;
                        const newRevenue = parseFloat(projectedNewRevenue) || 0;
                        const adjustedDisposable = baseDisposable + refinance + newRevenue;
                        const newLoanRepayment = monthlyRepayment;
                        const adjustedDscr =
                          newLoanRepayment > 0 ? adjustedDisposable / newLoanRepayment : 0;

                        return (
                          <>
                            <div className="flex justify-between items-center py-2 border-b">
                              <span className="text-sm text-muted-foreground">
                                Adjusted Disposable Income:
                              </span>
                              <span
                                className={`font-bold ${adjustedDisposable >= 0 ? "text-foreground" : "text-red-600"}`}
                                data-testid="text-adjusted-disposable"
                              >
                                {formatCurrency(adjustedDisposable)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b">
                              <span className="text-sm text-muted-foreground">
                                New Loan Repayment:
                              </span>
                              <span
                                className="font-bold text-foreground"
                                data-testid="text-new-loan-repayment"
                              >
                                {formatCurrency(newLoanRepayment)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                              <span className="text-sm font-medium">Adjusted DSCR:</span>
                              <div className="text-right">
                                <span
                                  className={`text-xl font-bold ${adjustedDscr >= DSCR_THRESHOLD ? "text-green-600" : "text-red-600"}`}
                                  data-testid="text-adjusted-dscr"
                                >
                                  {adjustedDscr.toFixed(2)}x
                                </span>
                                <div className="text-xs text-muted-foreground">
                                  Target: {DSCR_THRESHOLD}x
                                </div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
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
                              <span className="font-medium">
                                {formatCurrency(financialAnalysis.profitAndLoss.turnover || 0)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Cost of Sales</span>
                              <span className="font-medium">
                                {formatCurrency(financialAnalysis.profitAndLoss.costOfSales || 0)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Gross Profit</span>
                              <span className="font-medium">
                                {formatCurrency(financialAnalysis.profitAndLoss.grossProfit || 0)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Total Expenses</span>
                              <span className="font-medium">
                                {formatCurrency(financialAnalysis.profitAndLoss.totalExpenses || 0)}
                              </span>
                            </div>
                            <div className="flex justify-between col-span-2 pt-2 border-t">
                              <span className="font-medium">Net Profit</span>
                              <span
                                className={`font-bold ${(financialAnalysis.profitAndLoss.netProfit || 0) >= 0 ? "text-green-600" : "text-red-600"}`}
                              >
                                {formatCurrency(financialAnalysis.profitAndLoss.netProfit || 0)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="monthly">
                    {financialAnalysis.monthlyBreakdown &&
                    financialAnalysis.monthlyBreakdown.length > 0 ? (
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
                                <td className="py-2 px-3 text-right text-green-600">
                                  {formatCurrency(month.income)}
                                </td>
                                <td className="py-2 px-3 text-right text-red-600">
                                  {formatCurrency(month.expenses)}
                                </td>
                                <td
                                  className={`py-2 px-3 text-right font-medium ${month.net >= 0 ? "text-green-600" : "text-red-600"}`}
                                >
                                  {formatCurrency(month.net)}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  {formatCurrency(month.closingBalance)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">
                        No monthly breakdown available
                      </p>
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
                                  <div
                                    key={idx}
                                    className="flex justify-between items-center p-2 bg-muted rounded"
                                  >
                                    <div>
                                      <p className="font-medium text-sm">{loan.description}</p>
                                      <p className="text-xs text-muted-foreground">{loan.date}</p>
                                    </div>
                                    <span className="font-semibold text-red-600">
                                      {formatCurrency(loan.amount)}
                                    </span>
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
                                {financialAnalysis.preliminaryFindings.anomalies?.map(
                                  (item, idx) => (
                                    <div
                                      key={idx}
                                      className="p-2 bg-yellow-50 dark:bg-yellow-950/30 rounded border border-yellow-200 dark:border-yellow-800"
                                    >
                                      <p className="font-medium text-sm">{item.description}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {item.details}
                                      </p>
                                    </div>
                                  )
                                )}
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
                            <span
                              className={
                                flag.isActive
                                  ? "text-red-700 dark:text-red-400"
                                  : "text-muted-foreground"
                              }
                            >
                              {flag.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">
                        No risk flags detected
                      </p>
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
                      <Badge
                        variant={
                          prospect.company.companyStatus === "active" ? "default" : "secondary"
                        }
                      >
                        {prospect.company.companyStatus || "Active"}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      window.open(
                        `https://find-and-update.company-information.service.gov.uk/company/${prospect.company.companyNumber}`,
                        "_blank"
                      )
                    }
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
                        <Badge
                          variant={
                            adverseMedia.riskLevel === "HIGH"
                              ? "destructive"
                              : adverseMedia.riskLevel === "MEDIUM"
                                ? "secondary"
                                : "default"
                          }
                        >
                          {adverseMedia.riskLevel}
                        </Badge>
                      </div>
                      <p className="text-sm">{adverseMedia.summary}</p>
                      {adverseMedia.results && adverseMedia.results.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            {adverseMedia.results.length} sources found
                          </p>
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
                        <RefreshCw
                          className={`h-4 w-4 mr-2 ${adverseMediaMutation.isPending ? "animate-spin" : ""}`}
                        />
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
                    <span className="font-bold text-primary">
                      {formatCurrency(monthlyRepayment)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Arrangement Fee</span>
                    <span className="font-medium">
                      {formatCurrency(parseFloat(loanAmount) * (ARRANGEMENT_FEE_PERCENT / 100))}
                    </span>
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
                      <span
                        className={`font-bold ${(financialAnalysis?.dscr || 0) >= DSCR_THRESHOLD ? "text-green-600" : "text-red-600"}`}
                      >
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
                    <Badge variant={isEligible ? "default" : "destructive"}>
                      {isEligible ? "Eligible" : "Not Eligible"}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Adverse Media</span>
                    <Badge
                      variant={
                        adverseMedia?.riskLevel === "HIGH"
                          ? "destructive"
                          : adverseMedia?.riskLevel === "MEDIUM"
                            ? "secondary"
                            : "default"
                      }
                    >
                      {adverseMedia?.riskLevel || "Not Checked"}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Red Flags</span>
                    <span className="font-medium">
                      {financialAnalysis?.redFlags?.filter((f) => f.isActive).length || 0} active
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
                <p className="text-sm">
                  {financialAnalysis?.summary || "No analysis summary available."}
                </p>
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
                <Label htmlFor="product">Product</Label>
                <Select
                  value={adviserSummary.product}
                  onValueChange={(value) =>
                    setAdviserSummary({ ...adviserSummary, product: value })
                  }
                >
                  <SelectTrigger id="product">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RGF">RGF (Regional Growth Fund)</SelectItem>
                    <SelectItem value="ELEM2">ELEM2</SelectItem>
                    <SelectItem value="MEIFII">MEIFII</SelectItem>
                    <SelectItem value="CEF">CEF (Community Enable Fund)</SelectItem>
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
                      {section.title.split("–")[0]}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {SUMMARY_SECTIONS.slice(2, 9).map((section) => (
                  <TabsContent key={section.key} value={section.key}>
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-base">{section.title}</CardTitle>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => campariSectionMutation.mutate(section.key)}
                            disabled={generatingSection !== null || !loanAmount}
                            data-testid={`button-ai-${section.key}`}
                          >
                            {generatingSection === section.key ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Writing...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 mr-2" />
                                AI Auto Write
                              </>
                            )}
                          </Button>
                        </div>
                        {CAMPARI_QUESTIONS[section.key] && (
                          <CardDescription>
                            Consider: {CAMPARI_QUESTIONS[section.key].slice(0, 2).join(" ")}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <Textarea
                          value={adviserSummary.sections?.[section.key] || ""}
                          onChange={(e) =>
                            setAdviserSummary({
                              ...adviserSummary,
                              sections: {
                                ...adviserSummary.sections,
                                [section.key]: e.target.value,
                              },
                            })
                          }
                          placeholder={`Enter ${section.title.split("–")[1]?.trim() || section.key} assessment...`}
                          rows={5}
                          data-testid={`textarea-${section.key}`}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                ))}
              </Tabs>
            </div>

            <Separator />

            {/* SWOT Analysis Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">SWOT Analysis</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => swotMutation.mutate()}
                  disabled={swotMutation.isPending || !loanAmount}
                  data-testid="button-generate-swot"
                >
                  {swotMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      AI Auto Write
                    </>
                  )}
                </Button>
              </div>

              {underwriting.swotAnalysis && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">
                        Strengths
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {underwriting.swotAnalysis.strengths?.map((item: string, i: number) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        Weaknesses
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {underwriting.swotAnalysis.weaknesses?.map((item: string, i: number) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">
                        Opportunities
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {underwriting.swotAnalysis.opportunities?.map((item: string, i: number) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">
                        Threats
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {underwriting.swotAnalysis.threats?.map((item: string, i: number) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              )}

              {underwriting.swotAnalysis?.summary && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-1">Summary</p>
                  <p className="text-sm text-muted-foreground">
                    {underwriting.swotAnalysis.summary}
                  </p>
                </div>
              )}

              {!underwriting.swotAnalysis && (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    Click "AI Auto Write" to generate a SWOT analysis based on your application data
                  </p>
                </div>
              )}
            </div>

            <Separator />

            <div>
              <Label htmlFor="recommendation">Final Recommendation</Label>
              <Select
                value={adviserSummary.recommendation || ""}
                onValueChange={(value) =>
                  setAdviserSummary({ ...adviserSummary, recommendation: value })
                }
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
              <Button
                onClick={saveAdviserSummary}
                disabled={isSaving}
                data-testid="button-save-summary"
              >
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
