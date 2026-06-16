import React, { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { usePageTitle } from "@/context/LayoutContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  Send,
  Pause,
  Trash2,
  Loader2,
  BarChart3,
  Users,
  Mail,
  MousePointerClick,
  AlertTriangle,
  Eye,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  CheckCircle,
  XCircle,
  Rocket,
  Target,
  Type,
  Palette,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ShieldQuestion,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { UnlayerEmailEditor, type UnlayerEditorHandle } from "@/components/email/UnlayerEmailEditor";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import type {
  EmailCampaign,
  EmailTemplate,
  CampaignRecipient,
  MarketingContact,
} from "@shared/schema";
import { verificationService } from "./marketing/services/verificationService";
import type { EmailValidationResult } from "./marketing/types";

const campaignStatusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Draft", color: "bg-gray-500/20 text-muted-foreground", icon: Mail },
  scheduled: { label: "Scheduled", color: "bg-blue-500/20 text-blue-400", icon: Target },
  sending: { label: "Sending", color: "bg-amber-500/20 text-amber-400", icon: Loader2 },
  sent: { label: "Sent", color: "bg-emerald-500/20 text-emerald-400", icon: CheckCircle },
  paused: { label: "Paused", color: "bg-orange-500/20 text-orange-400", icon: Pause },
  cancelled: { label: "Cancelled", color: "bg-red-500/20 text-red-400", icon: XCircle },
};

const recipientStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-gray-500/20 text-muted-foreground" },
  sent: { label: "Sent", color: "bg-blue-500/20 text-blue-400" },
  delivered: { label: "Delivered", color: "bg-emerald-500/20 text-emerald-400" },
  opened: { label: "Opened", color: "bg-emerald-500/20 text-emerald-400" },
  clicked: { label: "Clicked", color: "bg-primary/20 text-primary" },
  bounced: { label: "Bounced", color: "bg-red-500/20 text-red-400" },
  failed: { label: "Failed", color: "bg-red-500/20 text-red-400" },
  unsubscribed: { label: "Unsubscribed", color: "bg-orange-500/20 text-orange-400" },
};

const DONUT_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#6b7280"];

const verificationGradeConfig: Record<string, { color: string; icon: any }> = {
  A: { color: "bg-emerald-500/20 text-emerald-400", icon: ShieldCheck },
  B: { color: "bg-emerald-500/20 text-emerald-400", icon: ShieldCheck },
  C: { color: "bg-amber-500/20 text-amber-400", icon: ShieldAlert },
  D: { color: "bg-red-500/20 text-red-400", icon: ShieldX },
  F: { color: "bg-red-500/20 text-red-400", icon: ShieldX },
};

export default function EmailCampaigns() {
  usePageTitle("Email Campaigns", "Create, send, and track email marketing campaigns");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [sendConfirmId, setSendConfirmId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Wizard form state
  const [formName, setFormName] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formTemplateId, setFormTemplateId] = useState<string>("");
  const [formContent, setFormContent] = useState("<p>Start writing your campaign content...</p>");
  const [recipientSource, setRecipientSource] = useState<string>("marketing_contacts");
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const [manualEmails, setManualEmails] = useState("");
  const [crmSubSource, setCrmSubSource] = useState<"client" | "broker">("client");
  const [formDesignJson, setFormDesignJson] = useState<any>(null);
  const [editorMode, setEditorMode] = useState<"visual" | "plaintext">("visual");
  const editorRef = useRef<UnlayerEditorHandle>(null);

  // Email verification state
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationProgress, setVerificationProgress] = useState({ current: 0, total: 0 });
  const [wizardVerificationResults, setWizardVerificationResults] = useState<Map<string, EmailValidationResult>>(new Map());
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [verifyDialogResults, setVerifyDialogResults] = useState<any>(null);
  const [pendingSendCampaignId, setPendingSendCampaignId] = useState<number | null>(null);

  // Data queries
  const { data: campaigns = [], isLoading } = useQuery<EmailCampaign[]>({
    queryKey: ["/api/email-campaigns"],
  });

  const { data: templates = [] } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/email-templates"],
  });

  const { data: marketingContacts = [] } = useQuery<MarketingContact[]>({
    queryKey: ["/api/marketing/contacts"],
  });

  const { data: prospects = [] } = useQuery<any[]>({
    queryKey: ["/api/prospects"],
  });

  const { data: clientCrmLeads = [] } = useQuery<any[]>({
    queryKey: ["/api/god/crm/leads"],
  });

  const { data: brokerCrmLeads = [] } = useQuery<any[]>({
    queryKey: ["/api/brokers/leads"],
  });

  const { data: expandedRecipients = [] } = useQuery<CampaignRecipient[]>({
    queryKey: ["/api/email-campaigns", expandedId, "recipients"],
    enabled: !!expandedId,
  });

  const { data: expandedAnalytics } = useQuery<any>({
    queryKey: ["/api/email-campaigns", expandedId, "analytics"],
    enabled: !!expandedId,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("/api/email-campaigns", "POST", data);
      return res.json();
    },
    onSuccess: async (campaign: EmailCampaign) => {
      // Add recipients
      const recipientList = getSelectedRecipientList();
      if (recipientList.length > 0) {
        await apiRequest(`/api/email-campaigns/${campaign.id}/recipients`, "POST", {
          recipients: recipientList,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/email-campaigns"] });
      toast.success(`Campaign "${campaign.name}" created with ${recipientList.length} recipients`);
      closeWizard();
    },
    onError: () => toast.error("Failed to create campaign"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/email-campaigns/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-campaigns"] });
      toast.success("Campaign deleted");
      setDeleteId(null);
      if (expandedId === deleteId) setExpandedId(null);
    },
    onError: () => toast.error("Failed to delete campaign"),
  });

  const sendMutation = useMutation({
    mutationFn: async ({ id, force }: { id: number; force?: boolean }) => {
      const res = await fetch(`/api/email-campaigns/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.error === "unverified_recipients") {
          throw { isVerificationGate: true, ...data };
        }
        throw new Error(data.error || "Failed to send campaign");
      }
      return data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-campaigns"] });
      toast.success(result.message);
      setSendConfirmId(null);
      setShowVerificationDialog(false);
      setPendingSendCampaignId(null);
    },
    onError: (err: any) => {
      if (err.isVerificationGate) {
        // Open verification dialog instead of sending
        setSendConfirmId(null);
        setPendingSendCampaignId(err.campaignId || sendConfirmId);
        setShowVerificationDialog(true);
        setVerifyDialogResults({
          unverifiedCount: err.unverifiedCount,
          totalCount: err.totalCount,
          phase: "prompt", // prompt | verifying | results
        });
      } else {
        toast.error(err.message || "Failed to send campaign");
      }
    },
  });

  const verifyRecipientsMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      const res = await apiRequest(`/api/email-campaigns/${campaignId}/verify-recipients`, "POST", {
        deepMode: false,
      });
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-campaigns"] });
      setVerifyDialogResults({
        ...result,
        phase: "results",
      });
    },
    onError: () => toast.error("Verification failed"),
  });

  const pauseMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest(`/api/email-campaigns/${id}/pause`, "POST");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-campaigns"] });
      toast.success("Campaign paused");
    },
  });

  const closeWizard = () => {
    setWizardOpen(false);
    setWizardStep(0);
    setFormName("");
    setFormSubject("");
    setFormTemplateId("");
    setFormContent("<p>Start writing your campaign content...</p>");
    setRecipientSource("marketing_contacts");
    setSelectedRecipients(new Set());
    setManualEmails("");
    setFormDesignJson(null);
    setEditorMode("visual");
    setWizardVerificationResults(new Map());
  };

  // Handle prefill from CRM pages (e.g. /email-campaigns?prefill=crm&source=client&ids=1,2,3)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("prefill") === "crm") {
      const source = params.get("source") || "client";
      const idsStr = params.get("ids") || "";
      const ids = idsStr.split(",").filter(Boolean).map(Number);

      if (ids.length > 0) {
        const prefix = source === "broker" ? "bl" : "cl";
        setRecipientSource("leads");
        setCrmSubSource(source === "broker" ? "broker" : "client");
        setSelectedRecipients(new Set(ids.map((id) => `${prefix}-${id}`)));
        setWizardOpen(true);
        setWizardStep(2); // Jump to recipients step
      }

      // Clean URL without reloading
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleTemplateSelect = (templateId: string) => {
    setFormTemplateId(templateId);
    if (templateId) {
      const template = templates.find((t) => t.id?.toString() === templateId);
      if (template) {
        setFormContent(template.content);
        const dj = (template as any).designJson;
        if (dj === "plaintext") {
          setEditorMode("plaintext");
          setFormDesignJson(null);
        } else {
          setEditorMode("visual");
          setFormDesignJson(dj || null);
        }
        if (!formSubject) setFormSubject(template.subject);
      }
    }
  };

  const getSelectedRecipientList = () => {
    const list: any[] = [];

    const addVerificationData = (item: any) => {
      const vResult = wizardVerificationResults.get(item.email);
      if (vResult) {
        item.verificationStatus = vResult.status;
        item.verificationGrade = vResult.qualityGrade;
        item.verificationScore = vResult.deliverabilityScore;
      }
      return item;
    };

    if (recipientSource === "marketing_contacts" || recipientSource === "mixed") {
      marketingContacts
        .filter((c) => selectedRecipients.has(`mc-${c.id}`))
        .forEach((c) =>
          list.push(addVerificationData({
            email: c.email,
            firstName: c.firstName || null,
            lastName: c.lastName || null,
            companyName: c.companyName || null,
            sourceType: "marketing_contact",
            sourceId: c.id,
          }))
        );
    }

    if (recipientSource === "prospects" || recipientSource === "mixed") {
      prospects
        .filter((p) => selectedRecipients.has(`pr-${p.id}`))
        .forEach((p) => {
          const contact = p.contacts?.[0];
          if (contact?.email) {
            list.push(addVerificationData({
              email: contact.email,
              firstName: contact.name?.split(" ")[0] || null,
              lastName: contact.name?.split(" ").slice(1).join(" ") || null,
              companyName: p.company?.name || p.companyName || null,
              sourceType: "prospect",
              sourceId: p.id,
            }));
          }
        });
    }

    if (recipientSource === "leads") {
      clientCrmLeads
        .filter((l: any) => selectedRecipients.has(`cl-${l.id}`))
        .forEach((l: any) => {
          const email = l.email || l.contacts?.[0]?.email;
          if (email) {
            const contactName = l.contactName || l.contacts?.[0]?.name || "";
            list.push(addVerificationData({
              email,
              firstName: contactName.split(" ")[0] || null,
              lastName: contactName.split(" ").slice(1).join(" ") || null,
              companyName: l.companyName || null,
              sourceType: "lead",
              sourceId: l.id,
            }));
          }
        });
      brokerCrmLeads
        .filter((l: any) => selectedRecipients.has(`bl-${l.id}`))
        .forEach((l: any) => {
          const email = l.email || l.contacts?.[0]?.email;
          if (email) {
            const contactName = l.contactName || l.contacts?.[0]?.name || "";
            list.push(addVerificationData({
              email,
              firstName: contactName.split(" ")[0] || null,
              lastName: contactName.split(" ").slice(1).join(" ") || null,
              companyName: l.companyName || null,
              sourceType: "lead",
              sourceId: l.id,
            }));
          }
        });
    }

    if (recipientSource === "manual") {
      manualEmails
        .split(/[,\n]/)
        .map((e) => e.trim())
        .filter((e) => e.includes("@"))
        .forEach((email) =>
          list.push(addVerificationData({
            email,
            firstName: null,
            lastName: null,
            companyName: null,
            sourceType: "manual",
            sourceId: null,
          }))
        );
    }

    return list;
  };

  // Wizard: verify selected recipients
  const handleWizardVerify = async () => {
    const recipientList = getSelectedRecipientList();
    if (recipientList.length === 0) {
      toast.error("No recipients to verify");
      return;
    }

    setIsVerifying(true);
    setVerificationProgress({ current: 0, total: recipientList.length });
    const results = new Map<string, EmailValidationResult>();

    for (let i = 0; i < recipientList.length; i++) {
      const email = recipientList[i].email;
      try {
        const result = await verificationService.verifyEmail(email, false);
        results.set(email, result);
      } catch {
        results.set(email, {
          email,
          syntaxValid: false,
          domainValid: false,
          isFreeMail: false,
          isRoleBased: false,
          isDisposable: false,
          deliverabilityScore: 0,
          qualityGrade: "F",
          status: "invalid",
          explanation: "Verification failed",
        } as EmailValidationResult);
      }
      setVerificationProgress({ current: i + 1, total: recipientList.length });
    }

    setWizardVerificationResults(results);
    setIsVerifying(false);

    const valid = [...results.values()].filter((r) => r.status === "valid").length;
    const risky = [...results.values()].filter((r) => r.status === "risky").length;
    const invalid = [...results.values()].filter((r) => r.status === "invalid").length;
    toast.success(`Verification complete: ${valid} valid, ${risky} risky, ${invalid} invalid`);
  };

  const handleCreate = () => {
    if (!formName.trim() || !formSubject.trim()) {
      toast.error("Campaign name and subject are required");
      return;
    }
    createMutation.mutate({
      name: formName,
      subject: formSubject,
      templateId: formTemplateId ? parseInt(formTemplateId) : null,
      content: formContent,
      designJson: formDesignJson,
      status: "draft",
      recipientSource,
      recipientCount: getSelectedRecipientList().length,
    });
  };

  const toggleRecipient = (key: string) => {
    setSelectedRecipients((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = (items: { key: string }[]) => {
    const allSelected = items.every((i) => selectedRecipients.has(i.key));
    setSelectedRecipients((prev) => {
      const next = new Set(prev);
      items.forEach((i) => {
        if (allSelected) next.delete(i.key);
        else next.add(i.key);
      });
      return next;
    });
  };

  // Filter campaigns
  const filtered = campaigns.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    return true;
  });

  // Stats
  const totalRecipients = campaigns.reduce((sum, c) => sum + (c.totalSent || 0), 0);
  const activeCampaigns = campaigns.filter((c) => ["sending", "scheduled"].includes(c.status)).length;
  const avgOpenRate = useMemo(() => {
    const sentCampaigns = campaigns.filter((c) => c.totalSent > 0);
    if (sentCampaigns.length === 0) return 0;
    const total = sentCampaigns.reduce(
      (sum, c) => sum + (c.totalSent > 0 ? (c.totalOpened / c.totalSent) * 100 : 0),
      0
    );
    return Math.round(total / sentCampaigns.length);
  }, [campaigns]);

  // Donut chart data for analytics
  const donutData = expandedAnalytics
    ? [
        { name: "Opened", value: expandedAnalytics.totalOpened },
        { name: "Clicked", value: expandedAnalytics.totalClicked },
        { name: "Delivered", value: Math.max(0, expandedAnalytics.totalDelivered - expandedAnalytics.totalOpened - expandedAnalytics.totalClicked) },
        { name: "Bounced", value: expandedAnalytics.totalBounced },
        { name: "Pending", value: Math.max(0, expandedAnalytics.totalRecipients - expandedAnalytics.totalSent) },
      ].filter((d) => d.value > 0)
    : [];

  const recipientItems = useMemo(() => {
    if (recipientSource === "marketing_contacts") {
      return marketingContacts
        .filter((c) => !c.unsubscribed && c.status === "valid")
        .map((c) => ({
          key: `mc-${c.id}`,
          email: c.email,
          name: [c.firstName, c.lastName].filter(Boolean).join(" ") || "-",
          company: c.companyName || "-",
        }));
    }
    if (recipientSource === "prospects") {
      return prospects
        .filter((p) => p.contacts?.[0]?.email)
        .map((p) => ({
          key: `pr-${p.id}`,
          email: p.contacts[0].email,
          name: p.contacts[0].name || "-",
          company: p.company?.name || p.companyName || "-",
        }));
    }
    if (recipientSource === "leads") {
      const leads = crmSubSource === "client" ? clientCrmLeads : brokerCrmLeads;
      const prefix = crmSubSource === "client" ? "cl" : "bl";
      return leads
        .filter((l: any) => {
          // Use the lead's email or the first contact's email
          const email = l.email || l.contacts?.[0]?.email;
          return !!email;
        })
        .map((l: any) => {
          const contactEmail = l.email || l.contacts?.[0]?.email || "";
          const contactName = l.contactName || l.contacts?.[0]?.name || "-";
          return {
            key: `${prefix}-${l.id}`,
            email: contactEmail,
            name: contactName,
            company: l.companyName || "-",
          };
        });
    }
    return [];
  }, [recipientSource, marketingContacts, prospects, clientCrmLeads, brokerCrmLeads, crmSubSource]);

  const [recipientSearch, setRecipientSearch] = useState("");
  const filteredRecipientItems = recipientItems.filter(
    (r) =>
      !recipientSearch ||
      r.email.toLowerCase().includes(recipientSearch.toLowerCase()) ||
      r.name.toLowerCase().includes(recipientSearch.toLowerCase()) ||
      r.company.toLowerCase().includes(recipientSearch.toLowerCase())
  );

  const wizardSteps = ["Details", "Content", "Recipients", "Review"];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Send className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{campaigns.length}</p>
                <p className="text-xs text-muted-foreground">Total Campaigns</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Rocket className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCampaigns}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalRecipients.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Recipients Reached</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Eye className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgOpenRate}%</p>
                <p className="text-xs text-muted-foreground">Avg Open Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filter + Create */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="draft" className="text-xs">Draft</TabsTrigger>
            <TabsTrigger value="sent" className="text-xs">Sent</TabsTrigger>
            <TabsTrigger value="scheduled" className="text-xs">Scheduled</TabsTrigger>
            <TabsTrigger value="paused" className="text-xs">Paused</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={() => setWizardOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {/* Campaign Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Send className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No campaigns yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first email campaign to start reaching out
            </p>
            <Button onClick={() => setWizardOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Create Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Recipients</TableHead>
                <TableHead className="text-center">Open Rate</TableHead>
                <TableHead className="text-center">Click Rate</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((campaign) => {
                const status = campaignStatusConfig[campaign.status] || campaignStatusConfig.draft;
                const openRate = campaign.totalSent > 0 ? Math.round((campaign.totalOpened / campaign.totalSent) * 100) : 0;
                const clickRate = campaign.totalSent > 0 ? Math.round((campaign.totalClicked / campaign.totalSent) * 100) : 0;
                const isExpanded = expandedId === campaign.id;

                return (
                  <React.Fragment key={campaign.id}>
                    <TableRow
                      className={cn(
                        "cursor-pointer hover:bg-muted/50 transition-colors",
                        isExpanded && "bg-muted/30"
                      )}
                      onClick={() => setExpandedId(isExpanded ? null : campaign.id!)}
                    >
                      <TableCell>
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform",
                            isExpanded && "rotate-90"
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{campaign.name}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                            {campaign.subject}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn("text-[10px]", status.color)}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{campaign.recipientCount || 0}</TableCell>
                      <TableCell className="text-center">
                        <span className={cn(openRate > 20 ? "text-emerald-500" : "text-muted-foreground")}>
                          {campaign.totalSent > 0 ? `${openRate}%` : "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn(clickRate > 5 ? "text-primary" : "text-muted-foreground")}>
                          {campaign.totalSent > 0 ? `${clickRate}%` : "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {campaign.sentAt
                          ? new Date(campaign.sentAt).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {campaign.status === "draft" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                setSendConfirmId(campaign.id!);
                                setPendingSendCampaignId(campaign.id!);
                              }}
                              title="Send Campaign"
                            >
                              <Send className="h-3.5 w-3.5 text-emerald-500" />
                            </Button>
                          )}
                          {campaign.status === "sending" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => pauseMutation.mutate(campaign.id!)}
                              title="Pause Campaign"
                            >
                              <Pause className="h-3.5 w-3.5 text-amber-500" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => setDeleteId(campaign.id!)}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expanded Analytics Panel */}
                    {isExpanded && (
                      <TableRow key={`${campaign.id}-expanded`}>
                        <TableCell colSpan={8} className="p-0">
                          <div className="bg-muted/20 border-t p-6 space-y-6">
                            {/* Analytics Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                              {[
                                { label: "Sent", value: expandedAnalytics?.totalSent ?? campaign.totalSent, icon: Send, color: "text-blue-500" },
                                { label: "Delivered", value: expandedAnalytics?.totalDelivered ?? campaign.totalDelivered, icon: CheckCircle, color: "text-emerald-500" },
                                { label: "Opened", value: expandedAnalytics?.totalOpened ?? campaign.totalOpened, icon: Eye, color: "text-emerald-500" },
                                { label: "Clicked", value: expandedAnalytics?.totalClicked ?? campaign.totalClicked, icon: MousePointerClick, color: "text-primary" },
                                { label: "Bounced", value: expandedAnalytics?.totalBounced ?? campaign.totalBounced, icon: AlertTriangle, color: "text-red-500" },
                                { label: "Failed", value: expandedAnalytics?.totalFailed ?? campaign.totalFailed, icon: XCircle, color: "text-red-400" },
                                { label: "Unsub'd", value: expandedAnalytics?.totalUnsubscribed ?? campaign.totalUnsubscribed, icon: XCircle, color: "text-orange-500" },
                              ].map((metric) => (
                                <Card key={metric.label} className="bg-background">
                                  <CardContent className="p-3 text-center">
                                    <metric.icon className={cn("h-4 w-4 mx-auto mb-1", metric.color)} />
                                    <p className="text-xl font-bold">{metric.value}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase">{metric.label}</p>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                              {/* Donut Chart */}
                              {donutData.length > 0 && (
                                <Card className="bg-background">
                                  <CardContent className="p-4">
                                    <p className="text-sm font-semibold mb-3">Engagement Breakdown</p>
                                    <div className="h-[200px]">
                                      <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                          <Pie
                                            data={donutData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={80}
                                            paddingAngle={3}
                                            dataKey="value"
                                          >
                                            {donutData.map((_, idx) => (
                                              <Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                                            ))}
                                          </Pie>
                                          <RechartsTooltip
                                            contentStyle={{
                                              background: "hsl(var(--card))",
                                              border: "1px solid hsl(var(--border))",
                                              borderRadius: "6px",
                                              fontSize: "12px",
                                            }}
                                          />
                                        </PieChart>
                                      </ResponsiveContainer>
                                    </div>
                                    <div className="flex flex-wrap gap-3 justify-center mt-2">
                                      {donutData.map((d, idx) => (
                                        <div key={d.name} className="flex items-center gap-1.5">
                                          <div
                                            className="w-2.5 h-2.5 rounded-full"
                                            style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }}
                                          />
                                          <span className="text-xs text-muted-foreground">{d.name}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </CardContent>
                                </Card>
                              )}

                              {/* Recipients Table */}
                              <Card className={cn("bg-background", donutData.length > 0 ? "lg:col-span-2" : "lg:col-span-3")}>
                                <CardContent className="p-4">
                                  <p className="text-sm font-semibold mb-3">
                                    Recipients ({expandedRecipients.length})
                                  </p>
                                  <div className="max-h-[300px] overflow-y-auto">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Email</TableHead>
                                          <TableHead>Verified</TableHead>
                                          <TableHead>Name</TableHead>
                                          <TableHead>Company</TableHead>
                                          <TableHead>Status</TableHead>
                                          <TableHead>Sent At</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {expandedRecipients.length === 0 ? (
                                          <TableRow>
                                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                              No recipients added yet
                                            </TableCell>
                                          </TableRow>
                                        ) : (
                                          expandedRecipients.slice(0, 50).map((r) => {
                                            const rStatus = recipientStatusConfig[r.status] || recipientStatusConfig.pending;
                                            const vGrade = (r as any).verificationGrade;
                                            const vStatus = (r as any).verificationStatus;
                                            const gradeConf = vGrade ? verificationGradeConfig[vGrade] : null;
                                            return (
                                              <TableRow key={r.id}>
                                                <TableCell className="font-mono text-xs">{r.email}</TableCell>
                                                <TableCell>
                                                  {gradeConf ? (
                                                    <Badge variant="secondary" className={cn("text-[10px]", gradeConf.color)}>
                                                      {vGrade}
                                                    </Badge>
                                                  ) : (
                                                    <Badge variant="secondary" className="text-[10px] bg-gray-500/20 text-muted-foreground">
                                                      {vStatus === "unverified" || !vStatus ? "?" : vStatus}
                                                    </Badge>
                                                  )}
                                                </TableCell>
                                                <TableCell>
                                                  {[r.firstName, r.lastName].filter(Boolean).join(" ") || "-"}
                                                </TableCell>
                                                <TableCell>{r.companyName || "-"}</TableCell>
                                                <TableCell>
                                                  <Badge variant="secondary" className={cn("text-[10px]", rStatus.color)}>
                                                    {rStatus.label}
                                                  </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                  {r.sentAt
                                                    ? new Date(r.sentAt).toLocaleString("en-GB", {
                                                        day: "numeric",
                                                        month: "short",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                      })
                                                    : "-"}
                                                </TableCell>
                                              </TableRow>
                                            );
                                          })
                                        )}
                                      </TableBody>
                                    </Table>
                                    {expandedRecipients.length > 50 && (
                                      <p className="text-xs text-muted-foreground text-center py-2">
                                        Showing 50 of {expandedRecipients.length} recipients
                                      </p>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Step 2: Content — Full Screen Editor */}
      {wizardOpen && wizardStep === 1 && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30 shrink-0">
            <div className="flex items-center gap-3">
              <Send className="h-5 w-5 text-primary" />
              <span className="font-semibold">Campaign Content</span>
              <span className="text-sm text-muted-foreground">— {formName || "Untitled"}</span>
              {/* Editor Mode Toggle */}
              <div className="flex items-center border rounded-md overflow-hidden ml-2">
                <button
                  type="button"
                  onClick={() => setEditorMode("visual")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                    editorMode === "visual"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Palette className="h-3.5 w-3.5" />
                  Visual
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode("plaintext")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-l",
                    editorMode === "plaintext"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Type className="h-3.5 w-3.5" />
                  Plain Text
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWizardStep(0)}
                className="gap-1.5"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  if (editorMode === "visual" && editorRef.current) {
                    try {
                      const { design, html } = await editorRef.current.exportHtml();
                      setFormContent(html);
                      setFormDesignJson(design);
                    } catch {
                      toast.error("Failed to export email content");
                      return;
                    }
                  } else if (editorMode === "plaintext") {
                    // Convert plain text to HTML for sending
                    const html = formContent
                      .split("\n")
                      .map((line: string) => `<p>${line || "&nbsp;"}</p>`)
                      .join("\n");
                    setFormContent(html);
                    setFormDesignJson("plaintext");
                  }
                  setWizardStep(2);
                }}
                className="gap-1.5"
              >
                Next: Recipients
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Editor Area */}
          {editorMode === "visual" ? (
            <div className="flex-1 min-h-0 relative">
              <UnlayerEmailEditor
                ref={editorRef}
                designJson={formDesignJson}
              />
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col p-4 gap-3 overflow-hidden">
              <div className="flex items-center justify-between">
                <Label>Plain Text Content</Label>
                <span className="text-xs text-muted-foreground">
                  Use merge tags: {"{{firstName}}"}, {"{{companyName}}"}, {"{{senderName}}"}
                </span>
              </div>
              <textarea
                className="flex-1 w-full rounded-md border border-input bg-background px-4 py-3 text-sm font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                placeholder={"Hi {{firstName}},\n\nI hope this message finds you well...\n\nBest regards,\n{{senderName}}"}
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {/* Campaign Creation Wizard (Steps 1, 3, 4) */}
      <Dialog open={wizardOpen && wizardStep !== 1} onOpenChange={(open) => !open && closeWizard()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Create Campaign
            </DialogTitle>
            <DialogDescription>Set up and configure your email campaign.</DialogDescription>
          </DialogHeader>

          {/* Step Indicator */}
          <div className="flex items-center gap-2 py-2">
            {wizardSteps.map((step, idx) => (
              <div key={step} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-colors",
                    idx === wizardStep
                      ? "bg-primary text-primary-foreground"
                      : idx < wizardStep
                      ? "bg-emerald-500 text-white"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {idx < wizardStep ? <CheckCircle className="h-4 w-4" /> : idx + 1}
                </div>
                <span
                  className={cn(
                    "text-sm hidden sm:inline",
                    idx === wizardStep ? "font-medium" : "text-muted-foreground"
                  )}
                >
                  {step}
                </span>
                {idx < wizardSteps.length - 1 && (
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                )}
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2 min-h-[350px]">
            {/* Step 1: Details */}
            {wizardStep === 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Campaign Name</Label>
                  <Input
                    placeholder="e.g. Q1 SME Outreach"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subject Line</Label>
                  <Input
                    placeholder="e.g. {{firstName}}, exclusive funding options for {{companyName}}"
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Start from Template <span className="text-muted-foreground">(optional)</span></Label>
                  <Select value={formTemplateId} onValueChange={handleTemplateSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates
                        .filter((t) => !t.isArchived)
                        .map((t) => (
                          <SelectItem key={t.id} value={t.id!.toString()}>
                            {t.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 3: Recipients */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <Tabs value={recipientSource} onValueChange={(v) => { setRecipientSource(v); setSelectedRecipients(new Set()); }}>
                  <TabsList>
                    <TabsTrigger value="marketing_contacts">Marketing Contacts</TabsTrigger>
                    <TabsTrigger value="prospects">Prospects</TabsTrigger>
                    <TabsTrigger value="leads">CRM Leads</TabsTrigger>
                    <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                  </TabsList>

                  <TabsContent value="marketing_contacts" className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search contacts..."
                          value={recipientSearch}
                          onChange={(e) => setRecipientSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{selectedRecipients.size} selected</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleAll(filteredRecipientItems)}
                        >
                          {filteredRecipientItems.every((i) => selectedRecipients.has(i.key))
                            ? "Deselect All"
                            : "Select All"}
                        </Button>
                      </div>
                    </div>
                    <div className="max-h-[350px] overflow-y-auto border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10"></TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Company</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRecipientItems.map((item) => (
                            <TableRow
                              key={item.key}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => toggleRecipient(item.key)}
                            >
                              <TableCell>
                                <Checkbox checked={selectedRecipients.has(item.key)} />
                              </TableCell>
                              <TableCell className="font-mono text-xs">{item.email}</TableCell>
                              <TableCell>{item.name}</TableCell>
                              <TableCell>{item.company}</TableCell>
                            </TableRow>
                          ))}
                          {filteredRecipientItems.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                No contacts available
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="prospects" className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search prospects..."
                          value={recipientSearch}
                          onChange={(e) => setRecipientSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{selectedRecipients.size} selected</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleAll(filteredRecipientItems)}
                        >
                          {filteredRecipientItems.every((i) => selectedRecipients.has(i.key))
                            ? "Deselect All"
                            : "Select All"}
                        </Button>
                      </div>
                    </div>
                    <div className="max-h-[350px] overflow-y-auto border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10"></TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Company</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRecipientItems.map((item) => (
                            <TableRow
                              key={item.key}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => toggleRecipient(item.key)}
                            >
                              <TableCell>
                                <Checkbox checked={selectedRecipients.has(item.key)} />
                              </TableCell>
                              <TableCell className="font-mono text-xs">{item.email}</TableCell>
                              <TableCell>{item.name}</TableCell>
                              <TableCell>{item.company}</TableCell>
                            </TableRow>
                          ))}
                          {filteredRecipientItems.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                No prospects with email contacts
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="leads" className="space-y-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Button
                        variant={crmSubSource === "client" ? "default" : "outline"}
                        size="sm"
                        onClick={() => { setCrmSubSource("client"); setSelectedRecipients(new Set()); }}
                      >
                        Prospects
                      </Button>
                      <Button
                        variant={crmSubSource === "broker" ? "default" : "outline"}
                        size="sm"
                        onClick={() => { setCrmSubSource("broker"); setSelectedRecipients(new Set()); }}
                      >
                        Introducers
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder={`Search ${crmSubSource === "client" ? "prospect" : "introducer"} leads...`}
                          value={recipientSearch}
                          onChange={(e) => setRecipientSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {selectedRecipients.size} selected / {filteredRecipientItems.length} total
                      </div>
                    </div>

                    <div className="rounded-md border max-h-[300px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">
                              <Checkbox
                                checked={filteredRecipientItems.length > 0 && selectedRecipients.size === filteredRecipientItems.length}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedRecipients(new Set(filteredRecipientItems.map((item) => item.key)));
                                  } else {
                                    setSelectedRecipients(new Set());
                                  }
                                }}
                              />
                            </TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Company</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRecipientItems.map((item) => (
                            <TableRow
                              key={item.key}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => toggleRecipient(item.key)}
                            >
                              <TableCell>
                                <Checkbox checked={selectedRecipients.has(item.key)} />
                              </TableCell>
                              <TableCell className="font-mono text-xs">{item.email}</TableCell>
                              <TableCell>{item.name}</TableCell>
                              <TableCell>{item.company}</TableCell>
                            </TableRow>
                          ))}
                          {filteredRecipientItems.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                No {crmSubSource === "client" ? "prospect" : "introducer"} leads with email addresses
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="manual" className="space-y-3">
                    <div className="space-y-2">
                      <Label>Enter email addresses (comma or newline separated)</Label>
                      <textarea
                        className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder={"john@example.com\njane@company.co.uk\nmike@business.com"}
                        value={manualEmails}
                        onChange={(e) => setManualEmails(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        {manualEmails
                          .split(/[,\n]/)
                          .map((e) => e.trim())
                          .filter((e) => e.includes("@")).length}{" "}
                        valid email addresses detected
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {/* Step 4: Review */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <Card className="bg-muted/30">
                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase mb-1">Campaign Name</p>
                        <p className="font-medium">{formName || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase mb-1">Subject Line</p>
                        <p className="font-medium">{formSubject || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase mb-1">Template</p>
                        <p className="font-medium">
                          {formTemplateId
                            ? templates.find((t) => t.id?.toString() === formTemplateId)?.name
                            : "Custom"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase mb-1">Recipients</p>
                        <p className="font-medium text-primary">{getSelectedRecipientList().length} contacts</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Email Verification */}
                <Card className="border-dashed">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <p className="text-sm font-semibold">Email Verification</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleWizardVerify}
                        disabled={isVerifying || getSelectedRecipientList().length === 0}
                        className="gap-1.5"
                      >
                        {isVerifying ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Verifying {verificationProgress.current} of {verificationProgress.total}...
                          </>
                        ) : wizardVerificationResults.size > 0 ? (
                          <>
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Re-verify
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Verify Recipients
                          </>
                        )}
                      </Button>
                    </div>

                    {wizardVerificationResults.size > 0 && (
                      <>
                        {/* Summary badges */}
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">
                            {[...wizardVerificationResults.values()].filter((r) => r.status === "valid").length} valid
                          </Badge>
                          <Badge variant="secondary" className="bg-amber-500/20 text-amber-400">
                            {[...wizardVerificationResults.values()].filter((r) => r.status === "risky").length} risky
                          </Badge>
                          <Badge variant="secondary" className="bg-red-500/20 text-red-400">
                            {[...wizardVerificationResults.values()].filter((r) => r.status === "invalid").length} invalid
                          </Badge>
                        </div>

                        {/* Results table (show risky + invalid) */}
                        {[...wizardVerificationResults.entries()].filter(
                          ([, r]) => r.status !== "valid"
                        ).length > 0 && (
                          <div className="max-h-[200px] overflow-y-auto border rounded-md">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Email</TableHead>
                                  <TableHead>Grade</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead className="w-16">Remove</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {[...wizardVerificationResults.entries()]
                                  .filter(([, r]) => r.status !== "valid")
                                  .map(([email, result]) => {
                                    const gradeConf = verificationGradeConfig[result.qualityGrade];
                                    return (
                                      <TableRow key={email}>
                                        <TableCell className="font-mono text-xs">{email}</TableCell>
                                        <TableCell>
                                          <Badge variant="secondary" className={cn("text-[10px]", gradeConf?.color)}>
                                            {result.qualityGrade}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>
                                          <span className="text-xs text-muted-foreground">{result.explanation}</span>
                                        </TableCell>
                                        <TableCell>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-destructive"
                                            onClick={() => {
                                              // Find and remove this recipient from selectedRecipients
                                              const recipientItem = recipientItems.find((ri) => ri.email === email);
                                              if (recipientItem) {
                                                setSelectedRecipients((prev) => {
                                                  const next = new Set(prev);
                                                  next.delete(recipientItem.key);
                                                  return next;
                                                });
                                              }
                                              // Also remove from manual emails if applicable
                                              if (recipientSource === "manual") {
                                                setManualEmails((prev) =>
                                                  prev
                                                    .split(/[,\n]/)
                                                    .map((e) => e.trim())
                                                    .filter((e) => e !== email)
                                                    .join("\n")
                                                );
                                              }
                                              // Remove from verification results
                                              setWizardVerificationResults((prev) => {
                                                const next = new Map(prev);
                                                next.delete(email);
                                                return next;
                                              });
                                              toast.success(`Removed ${email}`);
                                            }}
                                          >
                                            <XCircle className="h-3.5 w-3.5" />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </>
                    )}

                    {wizardVerificationResults.size === 0 && !isVerifying && (
                      <p className="text-xs text-muted-foreground">
                        Verify recipient emails before creating your campaign to check for invalid addresses.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <div>
                  <p className="text-sm font-semibold mb-2">Content Preview</p>
                  <div className="border rounded-md bg-white dark:bg-zinc-900 max-h-[250px] overflow-y-auto">
                    <div
                      className="p-4 prose prose-sm dark:prose-invert max-w-none [&_p]:my-2"
                      dangerouslySetInnerHTML={{ __html: formContent }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Wizard Footer */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => (wizardStep === 0 ? closeWizard() : setWizardStep(wizardStep - 1))}
              className="gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" />
              {wizardStep === 0 ? "Cancel" : "Back"}
            </Button>
            {wizardStep < wizardSteps.length - 1 ? (
              <Button
                onClick={() => {
                  if (wizardStep === 0 && (!formName.trim() || !formSubject.trim())) {
                    toast.error("Name and subject are required");
                    return;
                  }
                  setWizardStep(wizardStep + 1);
                }}
                className="gap-1.5"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="gap-1.5"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                Create Campaign
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Confirmation */}
      <AlertDialog open={sendConfirmId !== null} onOpenChange={(open) => !open && setSendConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to send this campaign? Emails will be dispatched to all recipients immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => sendConfirmId && sendMutation.mutate({ id: sendConfirmId })}
              disabled={sendMutation.isPending}
              className="gap-1.5"
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Verification Review Dialog (triggered when send detects unverified recipients) */}
      <Dialog open={showVerificationDialog} onOpenChange={(open) => {
        if (!open) {
          setShowVerificationDialog(false);
          setPendingSendCampaignId(null);
          setVerifyDialogResults(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Email Verification Required
            </DialogTitle>
            <DialogDescription>
              {verifyDialogResults?.phase === "prompt"
                ? `${verifyDialogResults.unverifiedCount} of ${verifyDialogResults.totalCount} recipients have not been verified.`
                : verifyDialogResults?.phase === "verifying"
                ? "Verifying recipient emails..."
                : "Verification complete. Review the results below."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Phase: Prompt */}
            {verifyDialogResults?.phase === "prompt" && (
              <div className="flex flex-col items-center gap-4 py-6">
                <ShieldQuestion className="h-12 w-12 text-amber-500/50" />
                <p className="text-sm text-center text-muted-foreground max-w-sm">
                  Sending to unverified emails may increase bounce rates and harm your sender reputation.
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => {
                      if (pendingSendCampaignId) {
                        setVerifyDialogResults({ ...verifyDialogResults, phase: "verifying" });
                        verifyRecipientsMutation.mutate(pendingSendCampaignId);
                      }
                    }}
                    className="gap-1.5"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Verify Now
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (pendingSendCampaignId) {
                        sendMutation.mutate({ id: pendingSendCampaignId, force: true });
                      }
                    }}
                    disabled={sendMutation.isPending}
                    className="gap-1.5"
                  >
                    {sendMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Send Anyway
                  </Button>
                </div>
              </div>
            )}

            {/* Phase: Verifying */}
            {verifyDialogResults?.phase === "verifying" && (
              <div className="flex flex-col items-center gap-4 py-8">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Verifying emails... This may take a moment.</p>
              </div>
            )}

            {/* Phase: Results */}
            {verifyDialogResults?.phase === "results" && (
              <>
                {/* Summary badges */}
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">
                    {verifyDialogResults.valid} valid
                  </Badge>
                  <Badge variant="secondary" className="bg-amber-500/20 text-amber-400">
                    {verifyDialogResults.risky} risky
                  </Badge>
                  <Badge variant="secondary" className="bg-red-500/20 text-red-400">
                    {verifyDialogResults.invalid} invalid
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {verifyDialogResults.verified} newly verified of {verifyDialogResults.total} total
                  </span>
                </div>

                {/* Problem recipients table */}
                {verifyDialogResults.results?.filter((r: any) => r.status !== "valid").length > 0 && (
                  <div className="max-h-[300px] overflow-y-auto border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Grade</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Issue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {verifyDialogResults.results
                          .filter((r: any) => r.status !== "valid")
                          .map((r: any) => {
                            const gradeConf = verificationGradeConfig[r.grade];
                            return (
                              <TableRow key={r.recipientId}>
                                <TableCell className="font-mono text-xs">{r.email}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className={cn("text-[10px]", gradeConf?.color)}>
                                    {r.grade}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs">{r.score}/100</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{r.explanation}</TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {verifyDialogResults.results?.filter((r: any) => r.status !== "valid").length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <ShieldCheck className="h-8 w-8 text-emerald-500" />
                    <p className="text-sm text-muted-foreground">All recipients verified successfully!</p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowVerificationDialog(false);
                      setPendingSendCampaignId(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (pendingSendCampaignId) {
                        sendMutation.mutate({ id: pendingSendCampaignId, force: true });
                      }
                    }}
                    disabled={sendMutation.isPending}
                    className="gap-1.5"
                  >
                    {sendMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {verifyDialogResults.invalid > 0
                      ? `Send to ${verifyDialogResults.total - verifyDialogResults.invalid} recipients`
                      : `Send to ${verifyDialogResults.total} recipients`}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this campaign? This will also remove all recipient data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
