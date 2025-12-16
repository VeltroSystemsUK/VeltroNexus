import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useState, useEffect } from "react";
import { Save, Loader2, Settings as SettingsIcon, Palette, Globe, Calendar as CalendarIcon, FileText, GripVertical, Upload, Check, AlertCircle, X, ExternalLink, FileDown, FileSpreadsheet, ArrowLeft, Key, Copy, RefreshCw, Link2 } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

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

const DEFAULT_STAGE_NAMES = {
  lead: "Lead",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal",
  dueDiligence: "Due Diligence",
  approval: "Approval",
  approved: "Approved",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

const DEFAULT_PDF_SECTIONS = [
  { id: "companyInfo", label: "Company Information", enabled: true },
  { id: "officers", label: "Officers", enabled: true },
  { id: "psc", label: "Persons with Significant Control", enabled: true },
  { id: "charges", label: "Charges", enabled: true },
  { id: "savedAssociations", label: "Saved Associated Companies", enabled: true },
  { id: "loanDetails", label: "Loan Details", enabled: true },
  { id: "security", label: "Security & Collateral", enabled: true },
  { id: "notes", label: "Notes", enabled: true },
  { id: "contacts", label: "Key Contacts", enabled: true },
  { id: "activities", label: "Activities & Tasks", enabled: true },
  { id: "dueDiligence", label: "Due Diligence", enabled: true },
];

export default function Settings() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currency, setCurrency] = useState("GBP");
  const [timezone, setTimezone] = useState("Europe/London");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [theme, setTheme] = useState("light");
  const [stageNames, setStageNames] = useState<Record<string, string>>(DEFAULT_STAGE_NAMES);
  const [pdfSections, setPdfSections] = useState<Array<{ id: string; label: string; enabled: boolean }>>(DEFAULT_PDF_SECTIONS);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [brandingPrimaryColor, setBrandingPrimaryColor] = useState<string>("");
  const [brandingAccentColor, setBrandingAccentColor] = useState<string>("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

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
      setStageNames(user.pipelineStageNames || DEFAULT_STAGE_NAMES);
      setPdfSections(user.pdfLayoutPreferences?.sections || DEFAULT_PDF_SECTIONS);
      setBrandingPrimaryColor(user.brandingPrimaryColor || "");
      setBrandingAccentColor(user.brandingAccentColor || "");
      setLogoPreview(user.brandingLogoUrl || null);
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
      pipelineStageNames: stageNames,
      pdfLayoutPreferences: { sections: pdfSections },
      brandingPrimaryColor: brandingPrimaryColor || null,
      brandingAccentColor: brandingAccentColor || null,
    });
  };

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('logo', file);
      
      const response = await fetch('/api/user/branding/logo', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload logo');
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
      const response = await fetch('/api/user/branding/logo', {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove logo');
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
      if (!file.type.startsWith('image/')) {
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

  const handleStageNameChange = (key: string, value: string) => {
    setStageNames((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleResetStageNames = () => {
    setStageNames(DEFAULT_STAGE_NAMES);
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
      return response;
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

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" data-testid="loader-settings" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6 pb-24">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold" data-testid="heading-settings">Settings</h1>
            <p className="text-muted-foreground">Customize your FlowLoan experience</p>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={updateSettingsMutation.isPending}
          data-testid="button-save-settings"
        >
          {updateSettingsMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      <Card data-testid="card-appearance">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Appearance
          </CardTitle>
          <CardDescription>Customize the look and feel of your workspace</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="theme">Theme</Label>
            <Select value={theme} onValueChange={setTheme}>
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
              Choose how FlowLoan looks on your device
            </p>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-branding">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            White Label Branding
          </CardTitle>
          <CardDescription>Add your corporate logo and customize colors for a branded experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo Upload */}
          <div className="space-y-4">
            <Label>Corporate Logo</Label>
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
                    <p className="text-xs text-muted-foreground">Powered by FlowLoan</p>
                  </div>
                ) : (
                  <div className="border-2 border-dashed rounded-lg p-8 text-center bg-muted/20" data-testid="logo-placeholder">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No logo uploaded</p>
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <Input
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
                  Upload your company logo (PNG, JPG, SVG). Max 2MB. Your logo will appear in the header.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Theme Colors */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary Color</Label>
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
                Main brand color used for buttons and accents
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

      <Card data-testid="card-regional">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Regional Settings
          </CardTitle>
          <CardDescription>Customize currency, timezone, and date formats</CardDescription>
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
                  <SelectItem key={c.value} value={c.value} data-testid={`option-currency-${c.value}`}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Default currency for financial values
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="timezone" data-testid="select-timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value} data-testid={`option-timezone-${tz.value}`}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Your local timezone for dates and times
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateFormat">Date Format</Label>
            <Select value={dateFormat} onValueChange={setDateFormat}>
              <SelectTrigger id="dateFormat" data-testid="select-date-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((df) => (
                  <SelectItem key={df.value} value={df.value} data-testid={`option-date-format-${df.value}`}>
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

      <Card data-testid="card-pipeline">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                Pipeline Stage Names
              </CardTitle>
              <CardDescription>Customize the names of your pipeline stages</CardDescription>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="stage-lead">Lead</Label>
              <Input
                id="stage-lead"
                value={stageNames.lead}
                onChange={(e) => handleStageNameChange("lead", e.target.value)}
                data-testid="input-stage-lead"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stage-contacted">Contacted</Label>
              <Input
                id="stage-contacted"
                value={stageNames.contacted}
                onChange={(e) => handleStageNameChange("contacted", e.target.value)}
                data-testid="input-stage-contacted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stage-qualified">Qualified</Label>
              <Input
                id="stage-qualified"
                value={stageNames.qualified}
                onChange={(e) => handleStageNameChange("qualified", e.target.value)}
                data-testid="input-stage-qualified"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stage-proposal">Proposal</Label>
              <Input
                id="stage-proposal"
                value={stageNames.proposal}
                onChange={(e) => handleStageNameChange("proposal", e.target.value)}
                data-testid="input-stage-proposal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stage-dueDiligence">Due Diligence</Label>
              <Input
                id="stage-dueDiligence"
                value={stageNames.dueDiligence}
                onChange={(e) => handleStageNameChange("dueDiligence", e.target.value)}
                data-testid="input-stage-dueDiligence"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stage-approval">Approval</Label>
              <Input
                id="stage-approval"
                value={stageNames.approval}
                onChange={(e) => handleStageNameChange("approval", e.target.value)}
                data-testid="input-stage-approval"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stage-approved">Approved</Label>
              <Input
                id="stage-approved"
                value={stageNames.approved}
                onChange={(e) => handleStageNameChange("approved", e.target.value)}
                data-testid="input-stage-approved"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stage-declined">Declined</Label>
              <Input
                id="stage-declined"
                value={stageNames.declined}
                onChange={(e) => handleStageNameChange("declined", e.target.value)}
                data-testid="input-stage-declined"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stage-withdrawn">Withdrawn</Label>
              <Input
                id="stage-withdrawn"
                value={stageNames.withdrawn}
                onChange={(e) => handleStageNameChange("withdrawn", e.target.value)}
                data-testid="input-stage-withdrawn"
              />
            </div>
          </div>
          <Separator />
          <p className="text-sm text-muted-foreground">
            Customize stage names to match your workflow. These names will appear throughout the application
            including the pipeline view, prospect details, and reports.
          </p>
        </CardContent>
      </Card>

      <Card data-testid="card-pdf-layout">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                PDF Report Layout
              </CardTitle>
              <CardDescription>Customize which sections appear in your PDF reports and their order</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetPdfLayout}
              data-testid="button-reset-pdf-layout"
            >
              Reset to Default
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Drag and drop to reorder sections. Uncheck sections to exclude them from generated PDFs.
          </p>
          <DragDropContext onDragEnd={handlePdfSectionsReorder}>
            <Droppable droppableId="pdf-sections">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-2"
                >
                  {pdfSections.map((section, index) => (
                    <Draggable key={section.id} draggableId={section.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`flex items-center gap-3 p-3 rounded-md border bg-card ${
                            snapshot.isDragging ? "shadow-lg" : ""
                          }`}
                          data-testid={`pdf-section-${section.id}`}
                        >
                          <div
                            {...provided.dragHandleProps}
                            className="flex-shrink-0 cursor-grab active:cursor-grabbing"
                            data-testid={`drag-pdf-section-${section.id}`}
                          >
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <Checkbox
                            checked={section.enabled}
                            onCheckedChange={() => handlePdfSectionToggle(section.id)}
                            data-testid={`checkbox-pdf-section-${section.id}`}
                          />
                          <Label
                            className={`flex-1 cursor-pointer ${
                              !section.enabled ? "text-muted-foreground line-through" : ""
                            }`}
                            onClick={() => handlePdfSectionToggle(section.id)}
                            data-testid={`label-pdf-section-${section.id}`}
                          >
                            {section.label}
                          </Label>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          <Separator />
          <p className="text-sm text-muted-foreground">
            Changes will apply to all future PDF reports generated from prospect details.
          </p>
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
            Download a complete Excel report of all your prospects including company details, loan information, 
            pipeline stage, priority, and key dates.
          </p>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => window.open('/api/prospects/export/excel', '_blank')}
              data-testid="button-download-pipeline-report"
            >
              <FileDown className="h-4 w-4 mr-2" />
              Download Pipeline Report
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            The report includes all prospects visible to you based on your role and team membership.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Data Import
          </CardTitle>
          <CardDescription>Upload CSV files to bulk import company leads for prospecting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border-2 border-dashed p-6 text-center">
            <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-sm font-medium mb-2">Upload a CSV file with company data</p>
            <p className="text-xs text-muted-foreground mb-4">
              Required column: Company Name. Optional: Company Number, Contact Name, Email, Phone, Address, Postcode, SIC Code
            </p>
            <div className="flex flex-col items-center gap-2">
              <Input
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
            <div className={`p-4 rounded-lg ${uploadResult.status === 'failed' ? 'bg-destructive/10' : 'bg-green-500/10'}`}>
              <div className="flex items-center gap-2 mb-2">
                {uploadResult.status === 'failed' ? (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <Check className="h-5 w-5 text-green-600" />
                )}
                <span className="font-medium">
                  {uploadResult.status === 'failed' ? 'Upload Failed' : 'Upload Complete'}
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
                          {upload.successRows} leads imported • {new Date(upload.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {upload.status === 'completed' ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : upload.status === 'failed' ? (
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
          <CardDescription>Connect external applications to FlowLoan using the webhook API</CardDescription>
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
                <Label className="text-xs text-muted-foreground">Endpoint URL</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-background px-3 py-2 rounded text-sm font-mono border">
                    POST {window.location.origin}/api/webhooks/prospects
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(`${window.location.origin}/api/webhooks/prospects`)}
                    data-testid="button-copy-endpoint"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Required Header</Label>
                <code className="block bg-background px-3 py-2 rounded text-sm font-mono border mt-1">
                  x-flowloan-api-key: YOUR_API_KEY
                </code>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Example Request Body</Label>
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
    </div>
  );
}
