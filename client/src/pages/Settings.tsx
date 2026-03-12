import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useState, useEffect } from "react";
import {
  Save,
  Loader2,
  Settings as SettingsIcon,
  Palette,
  Globe,
  Calendar as CalendarIcon,
  FileText,
  GripVertical,
  Upload,
  Check,
  AlertCircle,
  X,
  ExternalLink,
  FileDown,
  FileSpreadsheet,
  ArrowLeft,
  Key,
  Copy,
  RefreshCw,
  Link2,
  Shield,
  Brain,
  GraduationCap,
  PlayCircle,
  RotateCcw,
  Plus,
  Trash2,
  Mail,
  Zap,
  Users,
  Menu, // Added
  MessageSquare,
  Bell,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useLocation } from "wouter";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/PageHeader";
import { useOnboarding, OnboardingTooltip } from "@/components/onboarding";
import { usePageTitle, usePageActions } from "@/context/LayoutContext";

const WA_URL = import.meta.env.VITE_WA_SERVICE_URL || "";
import { applyTheme } from "@/components/ThemeToggle";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"; // Added

const CURRENCIES = [
  { value: "GBP", label: "£ GBP - British Pound", symbol: "£" },
  { value: "USD", label: "$ USD - US Dollar", symbol: "$" },
  { value: "EUR", label: "€ EUR - Euro", symbol: "€" },
  { value: "JPY", label: "¥ JPY - Japanese Yen", symbol: "¥" },
  { value: "CHF", label: "CHF - Swiss Franc", symbol: "CHF" },
  { value: "CAD", label: "$ CAD - Canadian Dollar", symbol: "C$" },
  { value: "AUD", label: "$ AUD - Australian Dollar", symbol: "A$" },
];

const TIMEZONES = [
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "America/New_York", label: "New York (EST)" },
  { value: "America/Chicago", label: "Chicago (CST)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Hong_Kong", label: "Hong Kong (HKT)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Australia/Sydney", label: "Sydney (AEDT)" },
];

const DATE_FORMATS = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (31/12/2024)" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (12/31/2024)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2024-12-31)" },
  { value: "DD MMM YYYY", label: "DD MMM YYYY (31 Dec 2024)" },
];

const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

const FONTS = [
  { value: "Inter", label: "Inter (Default)" },
  { value: "Roboto", label: "Roboto" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Lato", label: "Lato" },
  { value: "Montserrat", label: "Montserrat" },
];

import PdfLayoutBuilder, { type PdfSection, type ReportHeaderConfig } from "@/components/PdfLayoutBuilder";

export interface PipelineStage {
  id: string;
  label: string;
  color: string;
}

export const DEFAULT_STAGES: PipelineStage[] = [
  { id: "lead", label: "Lead", color: "#3B82F6" },
  { id: "contacted", label: "Contacted", color: "#6366F1" },
  { id: "qualified", label: "Qualified", color: "#8B5CF6" },
  { id: "proposal", label: "Proposal", color: "#EC4899" },
  { id: "due-diligence", label: "Due Diligence", color: "#F43F5E" },
  { id: "approval", label: "Approval", color: "#F59E0B" },
  { id: "approved", label: "Approved", color: "#10B981" },
  { id: "declined", label: "Declined", color: "#6B7280" },
  { id: "withdrawn", label: "Withdrawn", color: "#9CA3AF" },
];

const DEFAULT_PDF_SECTIONS: PdfSection[] = [
  { id: "companyInfo", label: "Company Information", enabled: true, type: "module" },
  { id: "officers", label: "Officers", enabled: true, type: "module" },
  { id: "psc", label: "Persons with Significant Control", enabled: true, type: "module" },
  { id: "charges", label: "Charges", enabled: true, type: "module" },
  { id: "savedAssociations", label: "Saved Associated Companies", enabled: true, type: "module" },
  { id: "loanDetails", label: "Loan Details", enabled: true, type: "module" },
  { id: "security", label: "Security & Collateral", enabled: true, type: "module" },
  { id: "notes", label: "Notes", enabled: true, type: "module" },
  { id: "contacts", label: "Key Contacts", enabled: true, type: "module" },
  { id: "activities", label: "Activities & Tasks", enabled: true, type: "module" },
  { id: "dueDiligence", label: "Due Diligence", enabled: true, type: "module" },
  { id: "campari", label: "CAMPARI Analysis", enabled: true, type: "module" },
  { id: "swotAnalysis", label: "SWOT Analysis", enabled: true, type: "module" },
];

const OnboardingSettingsCard = () => {
  const {
    enabled,
    toggleOnboarding,
    resetOnboarding,
    progressPercentage
  } = useOnboarding();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Onboarding & Tutorials
            </CardTitle>
            <CardDescription>
              Manage your guided walkthroughs and onboarding progress
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor="onboarding-toggle" className="cursor-pointer">
              {enabled ? "Enabled" : "Disabled"}
            </Label>
            <Switch
              id="onboarding-toggle"
              checked={enabled}
              onCheckedChange={toggleOnboarding}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
            <div className="space-y-1">
              <div className="font-medium flex items-center gap-2">
                Onboarding Progress
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                  {progressPercentage}%
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                Resetting will restart the welcome tour and all checklists.
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={resetOnboarding}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Onboarding
            </Button>
          </div>

          <div className="text-sm text-muted-foreground flex items-start gap-2">
            <PlayCircle className="h-4 w-4 mt-0.5 text-primary" />
            <span>
              Tip: You can re-enable the "First Run" experience by clicking Reset above if you skipped it.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function Settings() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const {
    currentWalkthrough,
    walkthroughStep,
    skipWalkthrough
  } = useOnboarding();
  const [fontFamily, setFontFamily] = useState<string>("Inter");
  const [fontSize, setFontSize] = useState<number>(16);

  const [pdfHeaderConfig, setPdfHeaderConfig] = useState<ReportHeaderConfig>({
    title: "Commercial Lending Report",
    showDate: true,
    showUser: true,
  });

  // Load saved config on mount
  useEffect(() => {
    const savedPdfConfig = localStorage.getItem("veltro_pdf_header_config");
    if (savedPdfConfig) {
      try {
        setPdfHeaderConfig(JSON.parse(savedPdfConfig));
      } catch (e) {
        console.error("Failed to parse saved PDF header config", e);
      }
    }
  }, []);

  // Save config on change
  useEffect(() => {
    localStorage.setItem("veltro_pdf_header_config", JSON.stringify(pdfHeaderConfig));
  }, [pdfHeaderConfig]);


  useEffect(() => {
    const savedFont = localStorage.getItem("fontFamily");
    const savedSize = localStorage.getItem("fontSize");

    if (savedFont) setFontFamily(savedFont);
    if (savedSize) setFontSize(parseInt(savedSize));
  }, []);

  useEffect(() => {
    localStorage.setItem("fontFamily", fontFamily);
    localStorage.setItem("fontSize", fontSize.toString());
    document.documentElement.style.setProperty("--font-sans", `${fontFamily}, system-ui, sans-serif`);
    document.documentElement.style.fontSize = `${fontSize}px`;
  }, [fontFamily, fontSize]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "google_connected") {
      toast({ title: "Connected", description: "Google account successfully linked!" });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get("error") === "google_auth_failed") {
      toast({ title: "Error", description: "Failed to connect Google account.", variant: "destructive" });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const [currency, setCurrency] = useState("GBP");
  const [timezone, setTimezone] = useState("Europe/London");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [theme, setTheme] = useState("light");
  const [stages, setStages] = useState<PipelineStage[]>(DEFAULT_STAGES);
  const [pdfSections, setPdfSections] = useState<PdfSection[]>(DEFAULT_PDF_SECTIONS);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [brandingPrimaryColor, setBrandingPrimaryColor] = useState<string>("");
  const [brandingAccentColor, setBrandingAccentColor] = useState<string>("");
  const [brandingSidebarColor, setBrandingSidebarColor] = useState<string>("");
  const [brandingBackgroundColor, setBrandingBackgroundColor] = useState<string>("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [aiDataConsent, setAiDataConsent] = useState<boolean>(false);
  const [emailApiKey, setEmailApiKey] = useState("");
  const [emailIntegrationEnabled, setEmailIntegrationEnabled] = useState(false);
  const [waStatus, setWaStatus] = useState<{ status: string; jid: string | null; qr: string | null }>({ status: "disconnected", jid: null, qr: null });
  const [showWaQR, setShowWaQR] = useState(false);

  // Fetch Integrations
  const { data: integrations, refetch: refetchIntegrations } = useQuery<any[]>({
    queryKey: ["/api/communications/settings"],
  });

  // Fetch WhatsApp status
  const { data: waData, refetch: refetchWaStatus } = useQuery<{ status: string; jid: string | null; qr: string | null }>({
    queryKey: ["wa-status"],
    queryFn: async () => {
      const res = await fetch(`${WA_URL}/api/wa/status`);
      if (!res.ok) throw new Error("Failed to fetch WA status");
      return res.json();
    },
    refetchInterval: waStatus.status === "qr" || waStatus.status === "connecting" ? 3000 : false,
  });

  useEffect(() => {
    if (waData) setWaStatus(waData);
  }, [waData]);

  useEffect(() => {
    if (integrations) {
      const sendgrid = integrations.find(i => i.provider === 'sendgrid');
      if (sendgrid) {
        setEmailIntegrationEnabled(sendgrid.isEnabled === 1);
        // We don't populate API key back for security, unless we want to show a masked version? 
        // For now, leave empty to indicate "unchanged" or placeholder.
        setEmailApiKey("");
      }
    }
  }, [integrations]);

  const saveIntegrationMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("/api/communications/settings", "POST", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Integration Saved", description: "Email settings updated." });
      refetchIntegrations();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save integration.", variant: "destructive" });
    }
  });

  const handleSaveEmailIntegration = () => {
    // Only send API key if user typed something
    const payload: any = {
      provider: 'sendgrid',
      isEnabled: emailIntegrationEnabled ? 1 : 0
    };
    if (emailApiKey) {
      payload.credentials = { apiKey: emailApiKey };
    }
    // If we are enabling but no key provided and no previous key exists... edge case.
    // But assuming 'credentials' is optional in update if we just toggle enabled? 
    // The schema says keys are in 'credentials' JSON. 
    // Let's assume if key is empty, we just update 'isEnabled'.
    // However, for initial setup, key is needed. 
    // Backend updates merge? Our backend implementation replaces logged data or merge?
    // Storage implementation: `await doc.ref.update({ ...integration })` -> this overrides top level fields.
    // If credentials not passed, it might clear it if we passed `credentials: undefined`? No, `...integration` spreads it.
    // If we don't include credentials in payload, it won't overwrite existing credentials in Firestore update (partial update behavior of spread? No, we need to be careful).
    // Let's check storage logic:
    // `const newIntegration = { ...integration, ... }` <- This is for CREATE.
    // For update: `await doc.ref.update({ ...integration, ... })`.
    // If payload doesn't have credentials, it won't update credentials field. Good.

    saveIntegrationMutation.mutate(payload);
  };

  const { data: user, isLoading: userLoading } = useQuery<any>({
    queryKey: ["/api/auth/user"],
  });

  const { data: uploads, isLoading: uploadsLoading } = useQuery<any[]>({
    queryKey: ["/api/leads/uploads"],
  });

  const { data: webhookKeyStatus } = useQuery<{
    hasApiKey: boolean;
    createdAt: string | null;
    lastUsedAt: string | null;
  }>({
    queryKey: ["/api/user/webhook-key"],
  });

  const generateApiKeyMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/user/webhook-key", "POST");
      return response.json();
    },
    onSuccess: (data: any) => {
      setNewApiKey(data.apiKey);
      queryClient.invalidateQueries({ queryKey: ["/api/user/webhook-key"] });
      toast({
        title: "API Key Generated",
        description: "Your new API key has been created. Copy it now - it won't be shown again.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate API key",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "API key copied to clipboard",
    });
  };

  useEffect(() => {
    if (user) {
      setCurrency(user.currency || "GBP");
      setTimezone(user.timezone || "Europe/London");
      setDateFormat(user.dateFormat || "DD/MM/YYYY");
      setTheme(user.theme || "light");
      if (Array.isArray(user.pipelineStageNames)) {
        setStages(user.pipelineStageNames);
      } else if (user.pipelineStageNames) {
        // Migration from legacy object to array
        const newStages = DEFAULT_STAGES.map(stage => ({
          ...stage,
          label: user.pipelineStageNames[stage.id] || stage.label
        }));
        setStages(newStages);
      } else {
        setStages(DEFAULT_STAGES);
      }

      // Merge saved sections with defaults to include any new sections
      const savedSections = user.pdfLayoutPreferences?.sections || [];
      const savedIds = new Set(savedSections.map((s: any) => s.id));
      const newSections = DEFAULT_PDF_SECTIONS.filter((s) => !savedIds.has(s.id));
      const mergedSections =
        savedSections.length > 0 ? [...savedSections, ...newSections] : DEFAULT_PDF_SECTIONS;
      setPdfSections(mergedSections);

      if (user.pdfLayoutPreferences?.header) {
        setPdfHeaderConfig(user.pdfLayoutPreferences.header);
      }

      setBrandingPrimaryColor(user.brandingPrimaryColor || "");
      setBrandingAccentColor(user.brandingAccentColor || "");
      setBrandingSidebarColor(user.brandingSidebarColor || "");
      setBrandingBackgroundColor(user.brandingBackgroundColor || "");
      setLogoPreview(user.brandingLogoUrl || null);
      setAiDataConsent(user.aiDataConsent === 1);
    }
  }, [user]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      await apiRequest("/api/user/settings", "PATCH", settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Settings Saved",
        description: "Your preferences have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateSettingsMutation.mutate({
      currency,
      timezone,
      dateFormat,
      theme,
      pipelineStageNames: stages,
      pdfLayoutPreferences: {
        sections: pdfSections,
        header: pdfHeaderConfig
      },
      brandingPrimaryColor: brandingPrimaryColor || null,
      brandingAccentColor: brandingAccentColor || null,
      brandingSidebarColor: brandingSidebarColor || null,
      brandingBackgroundColor: brandingBackgroundColor || null,
    });
  };

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("logo", file);

      const response = await fetch("/api/user/branding/logo", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload logo");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLogoPreview(data.logoUrl);
      setLogoFile(null);
      toast({
        title: "Logo Uploaded",
        description: "Your corporate logo has been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload logo",
        variant: "destructive",
      });
    },
  });

  const deleteLogoMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/user/branding/logo", {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove logo");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLogoPreview(null);
      toast({
        title: "Logo Removed",
        description: "Your corporate logo has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove logo",
        variant: "destructive",
      });
    },
  });

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid File",
          description: "Please select an image file (PNG, JPG, etc.)",
          variant: "destructive",
        });
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Logo must be under 2MB",
          variant: "destructive",
        });
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoUpload = () => {
    if (logoFile) {
      uploadLogoMutation.mutate(logoFile);
    }
  };

  const handleLogoRemove = () => {
    deleteLogoMutation.mutate();
  };

  const handleStageChange = (index: number, field: keyof PipelineStage, value: string) => {
    const newStages = [...stages];
    newStages[index] = { ...newStages[index], [field]: value };
    setStages(newStages);
  };

  const handleAddStage = () => {
    const newStage: PipelineStage = {
      id: `stage-${Date.now()}`,
      label: "New Stage",
      color: "#94A3B8", // Default slate-400
    };
    setStages([...stages, newStage]);
  };

  const handleRemoveStage = (index: number) => {
    if (stages.length <= 1) {
      toast({
        title: "Action cannot be performed",
        description: "You must have at least one pipeline stage",
        variant: "destructive",
      });
      return;
    }
    const newStages = stages.filter((_, i) => i !== index);
    setStages(newStages);
  };

  const handleResetStageNames = () => {
    setStages(DEFAULT_STAGES);
  };

  const handlePdfSectionToggle = (id: string) => {
    setPdfSections((prev) =>
      prev.map((section) =>
        section.id === id ? { ...section, enabled: !section.enabled } : section
      )
    );
  };

  const handlePdfSectionsReorder = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(pdfSections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setPdfSections(items);
  };

  const handleResetPdfLayout = () => {
    setPdfSections(DEFAULT_PDF_SECTIONS);
  };

  const uploadCsvMutation = useMutation({
    mutationFn: async (csvData: string) => {
      const response = await apiRequest("/api/leads/uploads", "POST", {
        fileName: csvFile?.name || "upload.csv",
        csvData,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setUploadResult(data);
      setCsvFile(null);
      queryClient.invalidateQueries({ queryKey: ["/api/leads/uploads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: "CSV Uploaded",
        description: `Successfully imported ${data.successRows} leads${data.errorRows > 0 ? ` (${data.errorRows} errors)` : ""}.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload CSV",
        variant: "destructive",
      });
    },
  });

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      setUploadResult(null);
    }
  };

  const handleCsvUpload = () => {
    if (!csvFile) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      uploadCsvMutation.mutate(content);
    };
    reader.readAsText(csvFile);
  };

  const [activeTab, setActiveTab] = useState("general");

  const tabOptions = [
    { id: "general", label: "General", icon: SettingsIcon, color: "bg-primary" },
    { id: "integrations", label: "Integrations", icon: Zap, color: "bg-blue-600" },
    { id: "crm", label: "CRM", icon: Users, color: "bg-emerald-600" },
    { id: "reports", label: "Reports", icon: FileText, color: "bg-purple-600" },
    { id: "data", label: "Data", icon: FileSpreadsheet, color: "bg-amber-600" },
  ];

  usePageTitle("Settings", "Customise your Veltro experience");

  usePageActions(
    <Button
      onClick={handleSave}
      disabled={updateSettingsMutation.isPending}
      data-testid="button-save-settings"
      className="bg-primary hover:bg-primary/90 text-primary-foreground"
    >
      {updateSettingsMutation.isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Save className="mr-2 h-4 w-4" />
      )}
      Save Changes
    </Button>
  );

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" data-testid="loader-settings" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">

      <div className="w-full mx-auto p-6 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">

          {/* Mobile View: Hamburger Menu */}
          <div className="md:hidden flex items-center justify-between bg-muted/50 p-2 rounded-lg mb-4">
            <div className="flex items-center gap-2 pl-2">
              {(() => {
                const current = tabOptions.find(t => t.id === activeTab);
                const Icon = current?.icon || SettingsIcon;
                return (
                  <>
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{current?.label}</span>
                  </>
                );
              })()}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                {tabOptions.map((tab) => (
                  <DropdownMenuItem key={tab.id} onClick={() => setActiveTab(tab.id)}>
                    <tab.icon className="mr-2 h-4 w-4" />
                    {tab.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Desktop View: Single Row Grid */}
          <TabsList className="hidden md:grid w-full grid-cols-5 h-auto p-1 gap-1 bg-muted/50">
            {tabOptions.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={`data-[state=active]:${tab.color} data-[state=active]:text-white ${tab.id === 'general' ? 'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground' : ''}`}
              >
                <tab.icon className="h-4 w-4 mr-2" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="integrations" className="space-y-6 mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Integration (SendGrid)
                </CardTitle>
                <CardDescription>
                  Connect your SendGrid account to send emails directly from Veltro.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="email-enabled">Enable Email Sending</Label>
                  <Switch
                    id="email-enabled"
                    checked={emailIntegrationEnabled}
                    onCheckedChange={setEmailIntegrationEnabled}
                  />
                </div>
                {emailIntegrationEnabled && (
                  <div className="space-y-2">
                    <Label htmlFor="sendgrid-key">SendGrid API Key</Label>
                    <div className="flex gap-2">
                      <Input
                        id="sendgrid-key"
                        type="password"
                        placeholder={integrations?.find(i => i.provider === 'sendgrid') ? "••••••••••••••••" : "SG.xxxxxxxx..."}
                        value={emailApiKey}
                        onChange={(e) => setEmailApiKey(e.target.value)}
                      />
                      <Button onClick={handleSaveEmailIntegration} disabled={saveIntegrationMutation.isPending}>
                        {saveIntegrationMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your API key is stored securely. Leave blank to keep existing key.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-blue-500" />
                  Google Workspace Integration
                </CardTitle>
                <CardDescription>
                  Connect for Gmail outreach, Drive storage, and Google Docs/Sheets generation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${user?.googleConnected ? "bg-green-100" : "bg-muted"}`}>
                      {user?.googleConnected ? <Check className="h-5 w-5 text-green-600" /> : <Globe className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="space-y-0.5">
                      <div className="font-medium">
                        {user?.googleConnected ? "Google Account Connected" : "Not Connected"}
                      </div>
                      {user?.googleConnected && (
                        <div className="text-sm text-muted-foreground">
                          Account: {user.googleConnectedEmail || user.googleEmail || "Connected"}
                        </div>
                      )}
                    </div>
                  </div>
                  {user?.googleConnected ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (confirm("Disconnect Google Workspace?")) {
                          await apiRequest("/api/auth/google/disconnect", "POST");
                          queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
                          toast({ title: "Disconnected", description: "Google Workspace access removed." });
                        }
                      }}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                      onClick={() => window.location.href = "/api/auth/google"}
                    >
                      Connect Google
                    </Button>
                  )}
                </div>

                {user?.googleConnected && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 p-2 rounded bg-primary/5">
                      <Mail className="h-4 w-4 text-primary" />
                      <span>Gmail Enabled</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded bg-primary/5">
                      <FileText className="h-4 w-4 text-primary" />
                      <span>Drive & Docs Enabled</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* WhatsApp Integration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-green-500" />
                  WhatsApp Integration
                </CardTitle>
                <CardDescription>
                  Connect your personal WhatsApp to send messages and notifications directly from Veltro.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${waStatus.status === "connected" ? "bg-green-100" : "bg-muted"}`}>
                      {waStatus.status === "connected" ? <Check className="h-5 w-5 text-green-600" /> : <MessageSquare className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {waStatus.status === "connected" ? "WhatsApp Connected" : waStatus.status === "qr" ? "Scan QR to Connect" : waStatus.status === "connecting" ? "Connecting..." : "Not Connected"}
                      </p>
                      {waStatus.jid && (
                        <p className="text-xs text-muted-foreground">
                          Linked: {waStatus.jid.split(":")[0]}
                        </p>
                      )}
                    </div>
                  </div>
                  {waStatus.status === "connected" ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={async () => {
                        if (confirm("Disconnect WhatsApp? You'll need to scan the QR code again to reconnect.")) {
                          await fetch(`${WA_URL}/api/wa/logout`, { method: "POST" });
                          refetchWaStatus();
                          toast({ title: "Disconnected", description: "WhatsApp has been disconnected." });
                        }
                      }}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        setShowWaQR(true);
                        refetchWaStatus();
                      }}
                    >
                      Connect WhatsApp
                    </Button>
                  )}
                </div>
                {waStatus.status === "connected" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 p-2 rounded bg-green-500/10">
                      <MessageSquare className="h-4 w-4 text-green-500" />
                      <span>Direct Messaging</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded bg-green-500/10">
                      <Bell className="h-4 w-4 text-green-500" />
                      <span>Workflow Notifications</span>
                    </div>
                  </div>
                )}

                {/* QR Dialog */}
                {showWaQR && (
                  <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onClick={() => setShowWaQR(false)}>
                    <div className="bg-card border rounded-xl p-6 max-w-sm w-[90%]" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold">Connect WhatsApp</h3>
                        <Button variant="ghost" size="sm" onClick={() => setShowWaQR(false)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Open WhatsApp → Linked Devices → Link a Device
                      </p>
                      {waStatus.qr ? (
                        <img src={waStatus.qr} alt="WhatsApp QR Code" className="w-full rounded-lg bg-white p-2" />
                      ) : waStatus.status === "connected" ? (
                        <div className="w-full aspect-square rounded-lg bg-muted flex items-center justify-center text-green-500 font-medium">
                          Connected!
                        </div>
                      ) : (
                        <div className="w-full aspect-square rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Generating QR...
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-3">
                        Your phone must stay online. Uses one of your 4 linked device slots.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="general" className="space-y-6 mt-0">
            <OnboardingTooltip
              isActive={currentWalkthrough === "settings" && walkthroughStep === 0}
              title="Customize Your Workspace"
              message="Make Veltro your own. Choose a theme or upload your company logo for a white-label experience."
              step={1}
              totalSteps={1}
              onNext={skipWalkthrough}
              onSkip={skipWalkthrough}
              position="right"
            >
              <Card data-testid="card-appearance">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Appearance
                  </CardTitle>
                  <CardDescription>Customise the look and feel of your workspace</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="theme">Theme</Label>
                    <Select value={theme} onValueChange={(val) => {
                      setTheme(val);
                      // Apply immediately without waiting for save
                      localStorage.setItem("theme", val);
                      applyTheme(val as any);
                    }}>
                      <SelectTrigger id="theme" data-testid="select-theme">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {THEMES.map((t) => (
                          <SelectItem key={t.value} value={t.value} data-testid={`option-theme-${t.value}`}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Choose how Veltro looks on your device
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fontFamily">Font Family</Label>
                    <Select value={fontFamily} onValueChange={setFontFamily}>
                      <SelectTrigger id="fontFamily">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FONTS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Select the primary typeface for the application
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="fontSize">Font Size ({fontSize}px)</Label>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium">A</span>
                      <Slider
                        id="fontSize"
                        name="fontSize"
                        value={[fontSize]}
                        min={12}
                        max={24}
                        step={1}
                        onValueChange={([val]) => setFontSize(val)}
                        className="flex-1"
                      />
                      <span className="text-xl font-medium">A</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Adjust the text size for better readability
                    </p>
                  </div>

                </CardContent>
              </Card>
            </OnboardingTooltip>

            <Card data-testid="card-branding">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  White Label Branding
                </CardTitle>
                <CardDescription>
                  Add your corporate logo and customise colours for a branded experience
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Logo Upload */}
                <div className="space-y-4">
                  <Label htmlFor="logo-upload">Corporate Logo</Label>
                  <div className="flex flex-col md:flex-row items-start gap-6">
                    <div className="flex-shrink-0">
                      {logoPreview ? (
                        <div className="space-y-2 text-center">
                          <div className="border rounded-lg p-4 bg-muted/30">
                            <img
                              src={logoPreview}
                              alt="Corporate logo preview"
                              className="max-h-20 max-w-48 object-contain"
                              data-testid="img-logo-preview"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">Powered by Veltro</p>
                        </div>
                      ) : (
                        <div
                          className="border-2 border-dashed rounded-lg p-8 text-center bg-muted/20"
                          data-testid="logo-placeholder"
                        >
                          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">No logo uploaded</p>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <Input
                          id="logo-upload"
                          name="logo-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleLogoFileChange}
                          className="max-w-xs"
                          data-testid="input-logo-file"
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {logoFile && (
                          <Button
                            size="sm"
                            onClick={handleLogoUpload}
                            disabled={uploadLogoMutation.isPending}
                            data-testid="button-upload-logo"
                          >
                            {uploadLogoMutation.isPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="mr-2 h-4 w-4" />
                            )}
                            Upload Logo
                          </Button>
                        )}
                        {user?.brandingLogoUrl && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleLogoRemove}
                            disabled={deleteLogoMutation.isPending}
                            data-testid="button-remove-logo"
                          >
                            {deleteLogoMutation.isPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <X className="mr-2 h-4 w-4" />
                            )}
                            Remove Logo
                          </Button>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Upload your company logo (PNG, JPG, SVG). Max 2MB. Your logo will appear in the
                        header.
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Theme Colors */}
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="primaryColor">Button & Primary Color</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="color"
                        id="primaryColor"
                        value={brandingPrimaryColor || "#0f766e"}
                        onChange={(e) => setBrandingPrimaryColor(e.target.value)}
                        className="w-16 h-10 p-1 cursor-pointer"
                        data-testid="input-primary-color"
                      />
                      <Input
                        type="text"
                        value={brandingPrimaryColor}
                        onChange={(e) => setBrandingPrimaryColor(e.target.value)}
                        placeholder="#0f766e"
                        className="flex-1 max-w-32"
                        data-testid="input-primary-color-hex"
                      />
                      {brandingPrimaryColor && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setBrandingPrimaryColor("")}
                          data-testid="button-reset-primary"
                        >
                          Reset
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Main brand color, used for buttons and active states
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accentColor">Accent Color</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="color"
                        id="accentColor"
                        value={brandingAccentColor || "#0d9488"}
                        onChange={(e) => setBrandingAccentColor(e.target.value)}
                        className="w-16 h-10 p-1 cursor-pointer"
                        data-testid="input-accent-color"
                      />
                      <Input
                        type="text"
                        value={brandingAccentColor}
                        onChange={(e) => setBrandingAccentColor(e.target.value)}
                        placeholder="#0d9488"
                        className="flex-1 max-w-32"
                        data-testid="input-accent-color-hex"
                      />
                      {brandingAccentColor && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setBrandingAccentColor("")}
                          data-testid="button-reset-accent"
                        >
                          Reset
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Secondary color for highlights and links
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sidebarColor">Sidebar Background</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="color"
                        id="sidebarColor"
                        value={brandingSidebarColor || "#0f172a"}
                        onChange={(e) => setBrandingSidebarColor(e.target.value)}
                        className="w-16 h-10 p-1 cursor-pointer"
                        data-testid="input-sidebar-color"
                      />
                      <Input
                        type="text"
                        value={brandingSidebarColor}
                        onChange={(e) => setBrandingSidebarColor(e.target.value)}
                        placeholder="#0f172a"
                        className="flex-1 max-w-32"
                        data-testid="input-sidebar-color-hex"
                      />
                      {brandingSidebarColor && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setBrandingSidebarColor("")}
                          data-testid="button-reset-sidebar"
                        >
                          Reset
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Background color for the navigation sidebar
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="backgroundColor">Page Background</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="color"
                        id="backgroundColor"
                        value={brandingBackgroundColor || "#ffffff"}
                        onChange={(e) => setBrandingBackgroundColor(e.target.value)}
                        className="w-16 h-10 p-1 cursor-pointer"
                        data-testid="input-background-color"
                      />
                      <Input
                        type="text"
                        value={brandingBackgroundColor}
                        onChange={(e) => setBrandingBackgroundColor(e.target.value)}
                        placeholder="#ffffff"
                        className="flex-1 max-w-32"
                        data-testid="input-background-color-hex"
                      />
                      {brandingBackgroundColor && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setBrandingBackgroundColor("")}
                          data-testid="button-reset-background"
                        >
                          Reset
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Resulting page background color
                    </p>
                  </div>
                </div>

                {(brandingPrimaryColor || brandingAccentColor) && (
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-sm font-medium mb-2">Color Preview</p>
                    <div className="flex items-center gap-4">
                      <div
                        className="w-24 h-10 rounded flex items-center justify-center text-white text-sm font-medium"
                        style={{ backgroundColor: brandingPrimaryColor || "#0f766e" }}
                      >
                        Primary
                      </div>
                      <div
                        className="w-24 h-10 rounded flex items-center justify-center text-white text-sm font-medium"
                        style={{ backgroundColor: brandingAccentColor || "#0d9488" }}
                      >
                        Accent
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Onboarding Settings */}
            <OnboardingSettingsCard />

            <Card data-testid="card-regional">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Regional Settings
                </CardTitle>
                <CardDescription>Customise currency, timezone, and date formats</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="currency" data-testid="select-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem
                          key={c.value}
                          value={c.value}
                          data-testid={`option-currency-${c.value}`}
                        >
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">Default currency for financial values</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger id="timezone" data-testid="select-timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem
                          key={tz.value}
                          value={tz.value}
                          data-testid={`option-timezone-${tz.value}`}
                        >
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">Your local timezone for dates and times</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateFormat">Date Format</Label>
                  <Select value={dateFormat} onValueChange={setDateFormat}>
                    <SelectTrigger id="dateFormat" data-testid="select-date-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_FORMATS.map((df) => (
                        <SelectItem
                          key={df.value}
                          value={df.value}
                          data-testid={`option-date-format-${df.value}`}
                        >
                          {df.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    How dates are displayed throughout the app
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="crm" className="space-y-6 mt-0">

            <Card data-testid="card-pipeline">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <SettingsIcon className="h-5 w-5" />
                      Pipeline Stage Names
                    </CardTitle>
                    <CardDescription>Customise the names of your pipeline stages</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetStageNames}
                    data-testid="button-reset-stages"
                  >
                    Reset to Default
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  {stages.map((stage, index) => (
                    <div key={stage.id} className="grid gap-4 sm:grid-cols-[1fr_auto_auto] items-end">
                      <div className="space-y-2">
                        <Label htmlFor={`stage-${stage.id}`}>Stage {index + 1}</Label>
                        <Input
                          id={`stage-${stage.id}`}
                          value={stage.label}
                          onChange={(e) => handleStageChange(index, "label", e.target.value)}
                          data-testid={`input-stage-${stage.id}`}
                          placeholder="Stage Name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`color-${stage.id}`}>Color</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="color"
                            id={`color-${stage.id}`}
                            value={stage.color}
                            onChange={(e) => handleStageChange(index, "color", e.target.value)}
                            className="w-12 h-10 p-1 cursor-pointer"
                            data-testid={`input-color-${stage.id}`}
                          />
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveStage(index)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={stages.length <= 1}
                        title="Remove Stage"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddStage}
                    className="w-full mt-2"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Stage
                  </Button>
                </div>
                <Separator />
                <p className="text-sm text-muted-foreground">
                  Customise stage names and colors to match your workflow. These names will appear throughout the
                  application including the pipeline view, prospect details, and reports.
                </p>
              </CardContent>
            </Card>


          </TabsContent>

          <TabsContent value="reports" className="space-y-6 mt-0">
            <Card data-testid="card-pdf-layout">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      PDF Report Layout
                    </CardTitle>
                    <CardDescription>
                      Design your report structure using the drag-and-drop builder
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetPdfLayout}
                    data-testid="button-reset-pdf-layout"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset to Default
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Drag elements from the Toolbox or Available Modules to the Blueprint.
                </p>
                <PdfLayoutBuilder
                  sections={pdfSections}
                  onReorder={setPdfSections}
                  headerConfig={pdfHeaderConfig}
                  onHeaderConfigChange={setPdfHeaderConfig}
                />
                <div className="flex justify-end mt-4 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetPdfLayout}
                    data-testid="button-reset-pdf-layout"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset Layout
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      updateSettingsMutation.mutate({
                        pdfLayoutPreferences: {
                          sections: pdfSections,
                          header: pdfHeaderConfig
                        }
                      });
                    }}
                    disabled={updateSettingsMutation.isPending}
                    data-testid="button-save-pdf-layout"
                  >
                    {updateSettingsMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Layout
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-pipeline-report">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Pipeline Report
                </CardTitle>
                <CardDescription>Export your entire pipeline as a comprehensive report</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Download a complete Excel report of all your prospects including company details, loan
                  information, pipeline stage, priority, and key dates.
                </p>
                <div className="flex items-center gap-4">
                  <Button
                    onClick={() => window.open("/api/prospects/export/excel", "_blank")}
                    data-testid="button-download-pipeline-report"
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Download Pipeline Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data" className="space-y-6 mt-0">

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Data Import
                </CardTitle>
                <CardDescription>
                  Upload CSV files to bulk import company leads for prospecting
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border-2 border-dashed p-6 text-center">
                  <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
                  <Label htmlFor="csv-upload" className="text-sm font-medium mb-2 block">Upload a CSV file with company data</Label>
                  <p className="text-xs text-muted-foreground mb-4">
                    Required column: Company Name. Optional: Company Number, Contact Name, Email, Phone,
                    Address, Postcode, SIC Code
                  </p>
                  <div className="flex flex-col items-center gap-2">
                    <Input
                      id="csv-upload"
                      name="csv-upload"
                      type="file"
                      accept=".csv"
                      onChange={handleCsvFileChange}
                      className="max-w-xs"
                      data-testid="input-csv-file"
                    />
                    {csvFile && (
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4" />
                        <span>{csvFile.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setCsvFile(null)}
                          data-testid="button-clear-csv"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <Button
                      onClick={handleCsvUpload}
                      disabled={!csvFile || uploadCsvMutation.isPending}
                      data-testid="button-upload-csv"
                    >
                      {uploadCsvMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload CSV
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {uploadResult && (
                  <div
                    className={`p-4 rounded-lg ${uploadResult.status === "failed" ? "bg-destructive/10" : "bg-green-500/10"}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {uploadResult.status === "failed" ? (
                        <AlertCircle className="h-5 w-5 text-destructive" />
                      ) : (
                        <Check className="h-5 w-5 text-green-600" />
                      )}
                      <span className="font-medium">
                        {uploadResult.status === "failed" ? "Upload Failed" : "Upload Complete"}
                      </span>
                    </div>
                    <div className="text-sm space-y-1">
                      <p>Total rows: {uploadResult.totalRows}</p>
                      <p className="text-green-600">Successful: {uploadResult.successRows}</p>
                      {uploadResult.errorRows > 0 && (
                        <p className="text-destructive">Errors: {uploadResult.errorRows}</p>
                      )}
                    </div>
                  </div>
                )}

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">Recent Uploads</h4>
                  {uploadsLoading ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : uploads && uploads.length > 0 ? (
                    <div className="space-y-2">
                      {uploads.slice(0, 5).map((upload: any) => (
                        <div
                          key={upload.id}
                          className="flex items-center justify-between p-3 rounded-md border bg-card"
                          data-testid={`upload-${upload.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{upload.fileName}</p>
                              <p className="text-xs text-muted-foreground">
                                {upload.successRows} leads imported •{" "}
                                {new Date(upload.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {upload.status === "completed" ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : upload.status === "failed" ? (
                              <AlertCircle className="h-4 w-4 text-destructive" />
                            ) : (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No uploads yet. Upload a CSV file to import leads.
                    </p>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" asChild data-testid="button-view-leads">
                    <a href="/leads">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View All Leads
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-api-integration">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  API Integration
                </CardTitle>
                <CardDescription>
                  Connect external applications to Veltro using the webhook API
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Webhook API Key</Label>
                      <p className="text-sm text-muted-foreground">
                        Use this key to authenticate requests from your other applications
                      </p>
                    </div>
                    <Button
                      onClick={() => generateApiKeyMutation.mutate()}
                      disabled={generateApiKeyMutation.isPending}
                      variant={webhookKeyStatus?.hasApiKey ? "outline" : "default"}
                      data-testid="button-generate-api-key"
                    >
                      {generateApiKeyMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : webhookKeyStatus?.hasApiKey ? (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      ) : (
                        <Key className="mr-2 h-4 w-4" />
                      )}
                      {webhookKeyStatus?.hasApiKey ? "Regenerate Key" : "Generate API Key"}
                    </Button>
                  </div>

                  {newApiKey && (
                    <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800 dark:text-green-200">
                          New API Key Generated
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={newApiKey}
                          readOnly
                          className="font-mono text-sm"
                          data-testid="input-api-key"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => copyToClipboard(newApiKey)}
                          data-testid="button-copy-api-key"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Copy this key now. It won't be shown again for security reasons.
                      </p>
                    </div>
                  )}

                  {webhookKeyStatus?.hasApiKey && !newApiKey && (
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">API Key Active</span>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {webhookKeyStatus.createdAt && (
                          <p>Created: {new Date(webhookKeyStatus.createdAt).toLocaleDateString()}</p>
                        )}
                        {webhookKeyStatus.lastUsedAt && (
                          <p>Last used: {new Date(webhookKeyStatus.lastUsedAt).toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-4">
                  <div>
                    <Label className="text-base">Webhook Endpoint</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Send POST requests to create prospects from your other applications
                    </p>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Endpoint URL</p>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="flex-1 bg-background px-3 py-2 rounded text-sm font-mono border">
                          POST {window.location.origin}/api/webhooks/prospects
                        </code>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() =>
                            copyToClipboard(`${window.location.origin}/api/webhooks/prospects`)
                          }
                          data-testid="button-copy-endpoint"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Required Header</p>
                      <code className="block bg-background px-3 py-2 rounded text-sm font-mono border mt-1">
                        x-veltro-api-key: YOUR_API_KEY
                      </code>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Example Request Body</p>
                      <pre className="bg-background px-3 py-2 rounded text-xs font-mono border mt-1 overflow-x-auto">
                        {`{
  "company": {
    "companyName": "Example Ltd",
    "companyNumber": "12345678"
  },
  "prospect": {
    "stage": "lead",
    "loanAmount": 50000
  },
  "contacts": [{
    "name": "John Smith",
    "email": "john@example.com",
    "isPrimary": true
  }]
}`}
                      </pre>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-ai-privacy">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  AI Data Processing
                </CardTitle>
                <CardDescription>
                  Manage how your financial data is processed by AI features
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="ai-consent-switch" className="text-base">Enable AI-Powered Analysis</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow Veltro to use AI to analyse financial documents (bank statements, accounts)
                      for credit underwriting, SWOT analysis, and CAMPARI assessments.
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      <Shield className="h-3 w-3 inline mr-1" />
                      Your data is processed securely and never stored by our AI provider.
                    </p>
                  </div>
                  <Switch
                    id="ai-consent-switch"
                    checked={aiDataConsent}
                    onCheckedChange={(checked) => {
                      setAiDataConsent(checked);
                      updateSettingsMutation.mutate({
                        aiDataConsent: checked ? 1 : 0,
                      });
                    }}
                    data-testid="switch-ai-consent"
                  />
                </div>

                {user?.aiDataConsentAt && aiDataConsent && (
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="text-sm">
                        AI processing enabled since {new Date(user.aiDataConsentAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}

                {!aiDataConsent && (
                  <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      AI features are currently disabled. Enable this setting to use AI-powered financial
                      analysis, SWOT generation, and CAMPARI report auto-completion.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

          </TabsContent>
        </Tabs >
      </div >
    </div >
  );
}
