import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmailLink } from "@/components/EmailLink";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  ChevronLeft,
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Star,
  Clock,
  PoundSterling,
  Percent,
  Users,
  Calendar,
  Plus,
  Send,
  MessageSquare,
  FileText,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Lender, LenderProduct, LenderInteraction } from "@shared/schema";

const INTERACTION_TYPES = [
  { value: "inquiry", label: "Inquiry" },
  { value: "application", label: "Application Sent" },
  { value: "meeting", label: "Meeting" },
  { value: "call", label: "Phone Call" },
  { value: "email", label: "Email" },
  { value: "response", label: "Response Received" },
  { value: "approval", label: "Approval" },
  { value: "decline", label: "Decline" },
  { value: "note", label: "Note" },
];

const INTERACTION_STATUSES = [
  { value: "sent", label: "Sent" },
  { value: "pending", label: "Pending Response" },
  { value: "responded", label: "Responded" },
  { value: "completed", label: "Completed" },
];

const PANEL_STATUSES: Record<
  string,
  { label: string; color: "default" | "secondary" | "destructive" }
> = {
  panel: { label: "On Panel", color: "default" },
  preferred: { label: "Preferred", color: "default" },
  market: { label: "Whole of Market", color: "secondary" },
  restricted: { label: "Restricted", color: "destructive" },
};

const LENDER_TYPES: Record<string, string> = {
  bank: "Bank",
  challenger_bank: "Challenger Bank",
  building_society: "Building Society",
  specialist_lender: "Specialist Lender",
  specialist_cdfi: "Specialist - CDFI",
  bridging_lender: "Bridging Lender",
  asset_finance: "Asset Finance",
  invoice_finance: "Invoice Finance",
  development_finance: "Development Finance",
  peer_to_peer: "Peer-to-Peer",
  private_lender: "Private Lender",
};

const interactionSchema = z.object({
  interactionType: z.string(),
  channel: z.string().optional(),
  subject: z.string().optional(),
  summary: z.string().optional(),
  status: z.string().optional(),
  outcome: z.string().optional(),
});

type InteractionForm = z.infer<typeof interactionSchema>;

function formatCurrency(amount: number | null | undefined): string {
  if (!amount) return "-";
  if (amount >= 1000000) {
    return `£${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `£${(amount / 1000).toFixed(0)}K`;
  }
  return `£${amount}`;
}


function PanelBadge({ status }: { status: string | null | undefined }) {
  const panel = PANEL_STATUSES[status || "market"] || PANEL_STATUSES.market;
  return (
    <Badge variant={panel.color} className="text-sm">
      {status === "panel" && <CheckCircle2 className="h-3 w-3 mr-1" />}
      {status === "preferred" && <Star className="h-3 w-3 mr-1" />}
      {status === "restricted" && <XCircle className="h-3 w-3 mr-1" />}
      {panel.label}
    </Badge>
  );
}

const LENDER_TIERS = [
  { value: 1.0, label: "Tier 1.0 - Major Banks" },
  { value: 1.5, label: "Tier 1.5 - Challenger & Vendor" },
  { value: 2.0, label: "Tier 2.0 - Alternative & CDFI" },
  { value: 2.5, label: "Tier 2.5 - Specialised Lenders" },
  { value: 3.0, label: "Tier 3.0 - Sub Prime Lenders" },
];

const LENDER_TYPES_LIST = [
  { value: "tier1", label: "Tier 1.0 - Major Banks" },
  { value: "tier2", label: "Tier 2.0 - Alternative & CDFI" },
  { value: "tier3", label: "Tier 3.0 - Specialized & Other" },
];

function TierBadge({ type, tier }: { type: string | null | undefined, tier?: number | null }) {
  if (tier !== undefined && tier !== null) {
    const config = LENDER_TIERS.find((t) => t.value === tier);
    if (config) {
      let colorClass = "bg-blue-500/10 text-blue-600 border-blue-200/50";
      if (tier >= 3) colorClass = "bg-slate-500/10 text-slate-600 border-slate-200/50";
      else if (tier >= 2) colorClass = "bg-emerald-500/10 text-emerald-600 border-emerald-200/50";

      return (
        <Badge className={`${colorClass} text-xs font-black uppercase tracking-wider px-2 shadow-none whitespace-nowrap`}>
          {config.label}
        </Badge>
      );
    }
  }

  const typeConfig = LENDER_TYPES_LIST.find(t => t.value === type);
  const label = typeConfig ? typeConfig.label : (LENDER_TYPES[type || ""] || "Lender");

  return <Badge variant="outline" className="text-xs">{label}</Badge>;
}

function InteractionIcon({ type }: { type: string }) {
  switch (type) {
    case "email":
    case "inquiry":
      return <Mail className="h-4 w-4" />;
    case "call":
      return <Phone className="h-4 w-4" />;
    case "meeting":
      return <Users className="h-4 w-4" />;
    case "application":
      return <FileText className="h-4 w-4" />;
    case "approval":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "decline":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "response":
      return <MessageSquare className="h-4 w-4" />;
    default:
      return <MessageSquare className="h-4 w-4" />;
  }
}

type LenderWithDetails = Lender & {
  products?: LenderProduct[];
  interactions?: LenderInteraction[];
};

export default function LenderDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [isInteractionDialogOpen, setIsInteractionDialogOpen] = useState(false);

  const lenderId = parseInt(params.id || "0");

  const {
    data: lender,
    isLoading,
    error,
  } = useQuery<LenderWithDetails>({
    queryKey: ["/api/lenders", lenderId, "full"],
    queryFn: async () => {
      const response = await fetch(`/api/lenders/${lenderId}/full`);
      if (!response.ok) throw new Error("Failed to fetch lender");
      return response.json();
    },
    enabled: isAuthenticated && lenderId > 0,
  });

  const interactionForm = useForm<InteractionForm>({
    resolver: zodResolver(interactionSchema),
    defaultValues: {
      interactionType: "email",
      channel: "email",
      status: "sent",
      subject: "",
      summary: "",
      outcome: "",
    },
  });

  const createInteractionMutation = useMutation({
    mutationFn: (data: InteractionForm) =>
      apiRequest("/api/lender-interactions", "POST", {
        ...data,
        lenderId,
        sentAt: new Date().toISOString(),
      }),
    onSuccess: () => {
      toast.success("Interaction logged successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/lenders", lenderId, "full"] });
      setIsInteractionDialogOpen(false);
      interactionForm.reset();
    },
    onError: (error: Error) => {
      toast.error(`Failed to log interaction: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest(`/api/lenders/${lenderId}`, "DELETE"),
    onSuccess: () => {
      toast.success("Lender deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/lenders"] });
      navigate("/lenders");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete lender: ${error.message}`);
    },
  });

  const researchMutation = useMutation({
    mutationFn: () => apiRequest(`/api/lenders/${lenderId}/research`, "POST"),
    onSuccess: () => {
      toast.success("AI Research completed! Fields updated.");
      queryClient.invalidateQueries({ queryKey: ["/api/lenders", lenderId, "full"] });
    },
    onError: (error: Error) => {
      toast.error(`AI Research failed: ${error.message}`);
    },
  });

  const handleLogInteraction = (data: InteractionForm) => {
    createInteractionMutation.mutate(data);
  };

  if (!isAuthenticated) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !lender) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b sticky top-0 bg-background z-10">
          <div className="container mx-auto px-4 py-4">
            <Button variant="ghost" onClick={() => navigate("/lenders")}>
              <ChevronLeft className="h-5 w-5 mr-1" />
              Back to Directory
            </Button>
          </div>
        </header>
        <main className="container mx-auto px-4 py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-xl font-semibold mb-2">Lender Not Found</h2>
          <p className="text-muted-foreground">
            This lender may have been deleted or you don't have access to it.
          </p>
        </main>
      </div>
    );
  }

  const productTypes = (lender.productTypes as string[]) || [];
  const sectors = (lender.sectors as string[]) || [];
  const regions = (lender.regions as string[]) || [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/lenders")}
              data-testid="button-back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-4">
              {lender.logoUrl ? (
                <div className="h-16 w-16 rounded border bg-white p-1 flex-shrink-0 flex items-center justify-center shadow-sm">
                  <img src={lender.logoUrl} alt={lender.institutionName} className="max-h-full max-w-full object-contain" />
                </div>
              ) : (
                <div className="h-16 w-16 rounded bg-primary/10 flex-shrink-0 flex items-center justify-center">
                  <Building2 className="h-8 w-8 text-primary/60" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold" data-testid="text-lender-name">
                  {lender.institutionName}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <TierBadge type={lender.lenderType} tier={lender.tier} />
                  <PanelBadge status={lender.panelStatus} />
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="text-primary hover:text-primary border-primary/20 hover:border-primary"
              onClick={() => researchMutation.mutate()}
              disabled={researchMutation.isPending}
              data-testid="button-ai-research"
            >
              {researchMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              AI Research
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsInteractionDialogOpen(true)}
              data-testid="button-log-interaction"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Log Interaction
            </Button>
            {lender.email && (
              <Button asChild data-testid="button-email-lender">
                <EmailLink email={lender.email} className="flex items-center">
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </EmailLink>
              </Button>
            )}
            {user?.role === "super_admin" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="ml-2"
                    data-testid="button-delete-lender"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Lender
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Lender?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete <strong>{lender.institutionName}</strong>?
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(lender.minLoanAmount || lender.maxLoanAmount) && (
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs">Loan Range</Label>
                      <div className="flex items-center gap-2">
                        <PoundSterling className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {formatCurrency(lender.minLoanAmount)} -{" "}
                          {formatCurrency(lender.maxLoanAmount)}
                        </span>
                      </div>
                    </div>
                  )}

                  {(lender.typicalRateFrom || lender.typicalRateTo) && (
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs">Rate Range</Label>
                      <div className="flex items-center gap-2">
                        <Percent className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {lender.typicalRateFrom || "?"} - {lender.typicalRateTo || "?"}
                        </span>
                      </div>
                    </div>
                  )}

                  {(lender.minLtv || lender.maxLtv) && (
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs">LTV Range</Label>
                      <div className="flex items-center gap-2">
                        <Percent className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {lender.minLtv || 0}% - {lender.maxLtv || 100}%
                        </span>
                      </div>
                    </div>
                  )}

                  {lender.turnaroundDays && (
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs">Turnaround</Label>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{lender.turnaroundDays} days</span>
                      </div>
                    </div>
                  )}
                </div>

                {productTypes.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">Products</Label>
                    <div className="flex flex-wrap gap-2">
                      {productTypes.map((product) => (
                        <Badge key={product} variant="secondary">
                          {product}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {sectors.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">Sectors</Label>
                    <div className="flex flex-wrap gap-2">
                      {sectors.map((sector) => (
                        <Badge key={sector} variant="outline">
                          {sector}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {regions.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">Regions</Label>
                    <div className="flex flex-wrap gap-2">
                      {regions.map((region) => (
                        <Badge key={region} variant="outline">
                          <MapPin className="h-3 w-3 mr-1" />
                          {region}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Tabs defaultValue="interactions" className="w-full">
              <TabsList>
                <TabsTrigger value="interactions">
                  Interaction History ({lender.interactions?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="notes">Notes & Assessment</TabsTrigger>
              </TabsList>

              <TabsContent value="interactions" className="mt-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                    <CardTitle className="text-lg">Interaction Timeline</CardTitle>
                    <Button size="sm" onClick={() => setIsInteractionDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Log New
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {!lender.interactions || lender.interactions.length === 0 ? (
                      <div className="text-center py-8">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">No interactions logged yet</p>
                        <Button
                          variant="outline"
                          className="mt-4"
                          onClick={() => setIsInteractionDialogOpen(true)}
                        >
                          Log First Interaction
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {lender.interactions.map((interaction) => (
                          <div
                            key={interaction.id}
                            className="flex gap-4 p-4 border rounded-lg"
                            data-testid={`interaction-${interaction.id}`}
                          >
                            <div className="flex-shrink-0 mt-1">
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                <InteractionIcon type={interaction.interactionType} />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">
                                  {INTERACTION_TYPES.find(
                                    (t) => t.value === interaction.interactionType
                                  )?.label || interaction.interactionType}
                                </span>
                                {interaction.status && (
                                  <Badge variant="outline" className="text-xs">
                                    {INTERACTION_STATUSES.find(
                                      (s) => s.value === interaction.status
                                    )?.label || interaction.status}
                                  </Badge>
                                )}
                              </div>
                              {interaction.subject && (
                                <p className="font-medium text-sm">{interaction.subject}</p>
                              )}
                              {interaction.summary && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {interaction.summary}
                                </p>
                              )}
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                {interaction.sentAt && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(interaction.sentAt).toLocaleDateString()}
                                  </span>
                                )}
                                {interaction.outcome && <span>Outcome: {interaction.outcome}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notes" className="mt-4">
                <Card>
                  <CardContent className="pt-6 space-y-6">
                    {lender.creditAppetite && (
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Credit Appetite</Label>
                        <p className="text-sm">{lender.creditAppetite}</p>
                      </div>
                    )}

                    {lender.keyStrengths && (
                      <div className="space-y-2">
                        <Label className="text-muted-foreground flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          Key Strengths
                        </Label>
                        <p className="text-sm">{lender.keyStrengths}</p>
                      </div>
                    )}

                    {lender.keyWeaknesses && (
                      <div className="space-y-2">
                        <Label className="text-muted-foreground flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                          Key Weaknesses
                        </Label>
                        <p className="text-sm">{lender.keyWeaknesses}</p>
                      </div>
                    )}

                    {lender.notes && (
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">General Notes</Label>
                        <p className="text-sm">{lender.notes}</p>
                      </div>
                    )}

                    {!lender.creditAppetite &&
                      !lender.keyStrengths &&
                      !lender.keyWeaknesses &&
                      !lender.notes && (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>No notes or assessment recorded</p>
                        </div>
                      )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {lender.contactName && (
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {lender.contactName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{lender.contactName}</p>
                      <p className="text-xs text-muted-foreground">Primary Contact</p>
                    </div>
                  </div>
                )}

                {lender.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <EmailLink email={lender.email} className="text-sm hover:underline">
                      {lender.email}
                    </EmailLink>
                  </div>
                )}

                {lender.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${lender.phone}`} className="text-sm hover:underline">
                      {lender.phone}
                    </a>
                  </div>
                )}

                {lender.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={
                        lender.website.startsWith("http")
                          ? lender.website
                          : `https://${lender.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm hover:underline flex items-center gap-1"
                    >
                      Website
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}

                {lender.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <p className="text-sm">{lender.address}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {(lender.bdmName || lender.bdmEmail || lender.bdmPhone) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">BDM Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {lender.bdmName && (
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {lender.bdmName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{lender.bdmName}</p>
                        <p className="text-xs text-muted-foreground">
                          Business Development Manager
                        </p>
                      </div>
                    </div>
                  )}

                  {lender.bdmEmail && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <EmailLink email={lender.bdmEmail} className="text-sm hover:underline">
                        {lender.bdmEmail}
                      </EmailLink>
                    </div>
                  )}

                  {lender.bdmPhone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${lender.bdmPhone}`} className="text-sm hover:underline">
                        {lender.bdmPhone}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {lender.submissionEmail && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Submissions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Send className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <EmailLink email={lender.submissionEmail} className="text-sm hover:underline">
                        {lender.submissionEmail}
                      </EmailLink>
                      <p className="text-xs text-muted-foreground">Application submissions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {lender.lastContactedAt && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Last Contacted</p>
                      <p className="font-medium">
                        {new Date(lender.lastContactedAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      <Dialog open={isInteractionDialogOpen} onOpenChange={setIsInteractionDialogOpen}>
        <DialogContent data-testid="dialog-log-interaction">
          <DialogHeader>
            <DialogTitle>Log Interaction</DialogTitle>
            <DialogDescription>
              Record an interaction with {lender.institutionName}
            </DialogDescription>
          </DialogHeader>
          <Form {...interactionForm}>
            <form
              onSubmit={interactionForm.handleSubmit(handleLogInteraction)}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={interactionForm.control}
                  name="interactionType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {INTERACTION_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={interactionForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {INTERACTION_STATUSES.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={interactionForm.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input placeholder="Brief subject..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={interactionForm.control}
                name="summary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Summary</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Details of the interaction..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={interactionForm.control}
                name="outcome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Outcome (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Result of the interaction..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsInteractionDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createInteractionMutation.isPending}>
                  {createInteractionMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Log Interaction
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
