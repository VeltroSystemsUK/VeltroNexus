import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";
import { Save, Loader2, Settings as SettingsIcon, Palette, Globe, Calendar as CalendarIcon } from "lucide-react";
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

export default function Settings() {
  const { toast } = useToast();
  const [currency, setCurrency] = useState("GBP");
  const [timezone, setTimezone] = useState("Europe/London");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [theme, setTheme] = useState("light");
  const [stageNames, setStageNames] = useState<Record<string, string>>(DEFAULT_STAGE_NAMES);

  const { data: user, isLoading: userLoading } = useQuery<any>({
    queryKey: ["/api/auth/user"],
  });

  useEffect(() => {
    if (user) {
      setCurrency(user.currency || "GBP");
      setTimezone(user.timezone || "Europe/London");
      setDateFormat(user.dateFormat || "DD/MM/YYYY");
      setTheme(user.theme || "light");
      setStageNames(user.pipelineStageNames || DEFAULT_STAGE_NAMES);
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
    });
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

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" data-testid="loader-settings" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-settings">Settings</h1>
          <p className="text-muted-foreground">Customize your FlowLoan experience</p>
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
    </div>
  );
}
