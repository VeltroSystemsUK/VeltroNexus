import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { LenderForm } from "@/components/LenderForm";
import LenderDiscoveryDialog from "@/components/LenderDiscoveryDialog";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Pencil,
  Trash2,
  Building2,
  Mail,
  Phone,
  Search,
  Filter,
  LayoutGrid,
  List,
  Star,
  StarHalf,
  Globe,
  MapPin,
  Clock,
  Briefcase,
  MoreHorizontal,
  Eye,
  Send,
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  Users,
  Percent,
  PoundSterling,
  Calendar,
  ChevronDown,
  RotateCcw,
  Truck,
  FileText,
  Store,
  HardHat,
  Home,
  Layers,
  Key,
  Wallet,
  Car,
  Wrench,
  Box,
  Link,
  Ship,
  Anchor,
  Scale,
  Coins,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  ArrowLeft,
  ArrowRight,
  FileUp,
  RefreshCcw,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertLenderSchema, type InsertLender, type Lender, LENDER_TYPES, LENDER_TIERS, PRODUCT_TYPES, SECTORS, REGIONS, PANEL_STATUSES } from "@shared/schema";
import { z } from "zod";
import logoChrome from "@assets/logo-chrome.png";
import ThemeToggle from "@/components/ThemeToggle";
import { BulkLenderUpload } from "@/components/BulkLenderUpload";
import { usePageTitle, usePageActions } from "@/context/LayoutContext";
import { Checkbox } from "@/components/ui/checkbox";



const extendedLenderSchema = insertLenderSchema.extend({
  institutionName: z.string().min(1, "Institution name is required"),
  lenderType: z.string().optional(),
  productTypes: z.array(z.string()).optional(),
  minLoanAmount: z.coerce.number().nullable().optional(),
  maxLoanAmount: z.coerce.number().nullable().optional(),
  minTermMonths: z.coerce.number().nullable().optional(),
  maxTermMonths: z.coerce.number().nullable().optional(),
  minLtv: z.coerce.number().nullable().optional(),
  maxLtv: z.coerce.number().nullable().optional(),
  typicalRateFrom: z.string().nullable().optional(),
  typicalRateTo: z.string().nullable().optional(),
  arrangementFee: z.string().nullable().optional(),
  sectors: z.array(z.string()).optional(),
  regions: z.array(z.string()).optional(),
  turnaroundDays: z.coerce.number().nullable().optional(),
  panelStatus: z.string().optional(),
  bdmName: z.string().nullable().optional(),
  bdmEmail: z.string().nullable().optional(),
  bdmPhone: z.string().nullable().optional(),
  submissionEmail: z.string().nullable().optional(),
  creditAppetite: z.string().nullable().optional(),
  keyStrengths: z.string().nullable().optional(),
  keyWeaknesses: z.string().nullable().optional(),
  rating: z.coerce.number().min(0).max(5).nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  lendingPolicy: z.string().nullable().optional(),
  insights: z.string().nullable().optional(),
});

type ExtendedLenderForm = z.infer<typeof extendedLenderSchema>;

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

function RatingStars({ rating }: { rating: number | null | undefined }) {
  if (!rating) return <span className="text-muted-foreground text-sm">Not rated</span>;

  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;

  return (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < fullStars
            ? "fill-yellow-400 text-yellow-400"
            : i === fullStars && hasHalf
              ? "fill-yellow-400/50 text-yellow-400"
              : "text-muted-foreground/30"
            }`}
        />
      ))}
      <span className="ml-1 text-sm text-muted-foreground">({rating.toFixed(1)})</span>
    </div>
  );
}

function PanelBadge({ status }: { status: string | null | undefined }) {
  const panel = PANEL_STATUSES.find((p) => p.value === status) || PANEL_STATUSES[2];
  return (
    <Badge variant={panel.color} className="text-xs">
      {status === "panel" && <CheckCircle2 className="h-3 w-3 mr-1" />}
      {status === "preferred" && <Star className="h-3 w-3 mr-1" />}
      {status === "restricted" && <XCircle className="h-3 w-3 mr-1" />}
      {panel.label}
    </Badge>
  );
}

function TierBadge({ type, tier }: { type: string | null | undefined, tier?: number | null }) {
  // Try to find by numeric tier first
  if (tier !== undefined && tier !== null) {
    const config = LENDER_TIERS.find((t) => t.value === tier);
    if (config) {
      let colorClass = "bg-blue-500/10 text-blue-600 border-blue-200/50";
      if (tier >= 3) colorClass = "bg-slate-500/10 text-slate-600 border-slate-200/50";
      else if (tier >= 2) colorClass = "bg-emerald-500/10 text-emerald-600 border-emerald-200/50";
      else if (tier >= 1.5) colorClass = "bg-indigo-500/10 text-indigo-600 border-indigo-200/50";

      return (
        <Badge className={`${colorClass} text-[9px] font-black uppercase tracking-wider px-2 shadow-none whitespace-nowrap`}>
          {config.label}
        </Badge>
      );
    }
  }

  // Fallback to type string
  if (type) {
    const typeLabel = LENDER_TYPES.find(t => t.value === type)?.label;
    if (typeLabel) {
      let colorClass = "bg-blue-500/10 text-blue-600 border-blue-200/50";
      if (type.includes("tier3")) colorClass = "bg-slate-500/10 text-slate-600 border-slate-200/50";
      else if (type.includes("tier2")) colorClass = "bg-emerald-500/10 text-emerald-600 border-emerald-200/50";
      else if (type.includes("1.5")) colorClass = "bg-indigo-500/10 text-indigo-600 border-indigo-200/50";

      return (
        <Badge className={`${colorClass} text-[9px] font-black uppercase tracking-wider px-2 shadow-none whitespace-nowrap`}>
          {typeLabel}
        </Badge>
      );
    }
  }

  return null;
}

const PRODUCT_CATEGORY_CONFIG: Record<string, { icon: React.ElementType; color: string; tint: string }> = {
  "Term Loan": { icon: Clock, color: "text-blue-700", tint: "bg-blue-50 border-blue-200" },
  "Revolving Credit": { icon: RotateCcw, color: "text-indigo-700", tint: "bg-indigo-50 border-indigo-200" },
  "Asset Finance": { icon: Truck, color: "text-emerald-700", tint: "bg-emerald-50 border-emerald-200" },
  "Invoice Finance": { icon: FileText, color: "text-orange-700", tint: "bg-orange-50 border-orange-200" },
  "Merchant Cash Advance": { icon: Store, color: "text-amber-700", tint: "bg-amber-50 border-amber-200" },
  "Commercial Mortgages": { icon: Building2, color: "text-purple-700", tint: "bg-purple-50 border-purple-200" },
  "Bridging": { icon: Briefcase, color: "text-red-700", tint: "bg-red-50 border-red-200" },
  "Trade Finance": { icon: Globe, color: "text-cyan-700", tint: "bg-cyan-50 border-cyan-200" },
  "Development Finance": { icon: HardHat, color: "text-yellow-700", tint: "bg-yellow-50 border-yellow-200" },
  "Buy-to-Let": { icon: Home, color: "text-pink-700", tint: "bg-pink-50 border-pink-200" },
  "Mezzanine": { icon: Layers, color: "text-slate-700", tint: "bg-slate-50 border-slate-200" },
  "Equity Release": { icon: Key, color: "text-teal-700", tint: "bg-teal-50 border-teal-200" },
  "Working Capital": { icon: Wallet, color: "text-lime-700", tint: "bg-lime-50 border-lime-200" },
  "Vehicle Finance": { icon: Car, color: "text-emerald-700", tint: "bg-emerald-50 border-emerald-200" },
  "Equipment Leasing": { icon: Wrench, color: "text-gray-700", tint: "bg-gray-50 border-gray-200" },
  "Stock Finance": { icon: Box, color: "text-zinc-700", tint: "bg-zinc-50 border-zinc-200" },
  "Supply Chain Finance": { icon: Link, color: "text-violet-700", tint: "bg-violet-50 border-violet-200" },
  "Export Finance": { icon: Ship, color: "text-sky-700", tint: "bg-sky-50 border-sky-200" },
  "Import Finance": { icon: Anchor, color: "text-blue-700", tint: "bg-blue-50 border-blue-200" },
  "Litigation Funding": { icon: Scale, color: "text-rose-700", tint: "bg-rose-50 border-rose-200" },
  "VAT Loans": { icon: Percent, color: "text-indigo-700", tint: "bg-indigo-50 border-indigo-200" },
  "Tax Loans": { icon: Coins, color: "text-green-700", tint: "bg-green-50 border-green-200" },
  "Unsecured Business Loans": { icon: ShieldCheck, color: "text-neutral-700", tint: "bg-neutral-50 border-neutral-200" },
  "Other / Unspecified": { icon: Building2, color: "text-muted-foreground", tint: "bg-muted/10 border-border/50" },
};

export default function Lenders() {
  const [, navigate] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLender, setEditingLender] = useState<Lender | null>(null);
  const [deletingLender, setDeletingLender] = useState<Lender | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPanelStatus, setFilterPanelStatus] = useState<string>("all");
  const [filterLenderType, setFilterLenderType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("find");
  const [matchRequirements, setMatchRequirements] = useState<{
    productType?: string;
    amount?: number;
    sector?: string;
    region?: string;
    turnover?: number;
    profit?: number;
    netWorth?: number;
    creditStatus?: string;
  }>({});
  const [matchedLenders, setMatchedLenders] = useState<Lender[]>([]);
  const [isMatching, setIsMatching] = useState(false);
  const [selectedLenders, setSelectedLenders] = useState<number[]>([]);
  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
  const [discoveryData, setDiscoveryData] = useState<ExtendedLenderForm | null>(null);

  const {
    data: lenders = [],
    isLoading,
    error,
  } = useQuery<Lender[]>({
    queryKey: ["/api/lenders"],
    enabled: isAuthenticated,
  });

  const form = useForm<ExtendedLenderForm>({
    resolver: zodResolver(extendedLenderSchema),
    defaultValues: {
      institutionName: "",
      contactName: "",
      email: "",
      phone: "",
      address: "",
      website: "",
      notes: "",
      lenderType: "bank",
      productTypes: [],
      sectors: [],
      regions: [],
      panelStatus: "market",
    },
  });

  // Create lender mutation
  const createLenderMutation = useMutation({
    mutationFn: async (data: ExtendedLenderForm) => {
      await apiRequest("/api/lenders", "POST", data);
    },
    onSuccess: () => {
      toast.success("Lender created successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/lenders"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast.error(`Failed to create lender: ${error.message}`);
    },
  });

  // Update lender mutation
  const updateLenderMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ExtendedLenderForm }) =>
      apiRequest(`/api/lenders/${id}`, "PATCH", data),
    onSuccess: () => {
      toast.success("Lender updated successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/lenders"] });
      setIsDialogOpen(false);
      setEditingLender(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast.error(`Failed to update lender: ${error.message}`);
    },
  });

  const deleteLenderMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/lenders/${id}`, "DELETE"),
    onSuccess: () => {
      toast.success("Lender deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/lenders"] });
      setDeletingLender(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete lender: ${error.message}`);
    },
  });

  const toggleFavouriteMutation = useMutation({
    mutationFn: ({ id, isFavourite }: { id: number; isFavourite: boolean }) =>
      apiRequest(`/api/lenders/${id}`, "PATCH", { isFavourite: isFavourite ? 1 : 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lenders"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update favourite: ${error.message}`);
    },
  });

  const toggleAgreementMutation = useMutation({
    mutationFn: ({ id, signed }: { id: number; signed: boolean }) =>
      apiRequest(`/api/lenders/${id}`, "PATCH", { introducerAgreementSigned: signed ? 1 : 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lenders"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update agreement status: ${error.message}`);
    },
  });

  const researchLenderMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/lenders/${id}/research`, "POST"),
    onSuccess: () => {
      toast.success("AI Research completed successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/lenders"] });
    },
    onError: (error: Error) => {
      toast.error(`AI Research failed: ${error.message}`);
    },
  });

  const bulkUpdateTierMutation = useMutation({
    mutationFn: ({ ids, tier }: { ids: number[]; tier: number }) =>
      apiRequest("/api/admin/lenders/bulk-update", "PATCH", { ids, updates: { tier } }),
    onSuccess: (data: any) => {
      toast.success(data.message || "Lenders updated successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/lenders"] });
      setSelectedLenders([]);
    },
    onError: (error: Error) => {
      toast.error(`Failed to bulk update lenders: ${error.message}`);
    },
  });

  const bulkUpdateTypeMutation = useMutation({
    mutationFn: ({ ids, lenderType }: { ids: number[]; lenderType: string }) =>
      apiRequest("/api/admin/lenders/bulk-update", "PATCH", { ids, updates: { lenderType } }),
    onSuccess: (data: any) => {
      toast.success(data.message || "Lenders updated successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/lenders"] });
      setSelectedLenders([]);
    },
    onError: (error: Error) => {
      toast.error(`Failed to bulk update lenders: ${error.message}`);
    },
  });

  const bulkDeleteLendersMutation = useMutation({
    mutationFn: (ids: number[]) =>
      apiRequest("/api/admin/lenders/bulk-delete", "DELETE", { ids }),
    onSuccess: (data: any) => {
      toast.success(data.message || "Lenders deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/lenders"] });
      setSelectedLenders([]);
    },
    onError: (error: Error) => {
      toast.error(`Failed to bulk delete lenders: ${error.message}`);
    },
  });

  const onSubmit = (data: ExtendedLenderForm) => {
    if (editingLender) {
      updateLenderMutation.mutate({ id: editingLender.id!, data });
    } else {
      createLenderMutation.mutate(data);
    }
  };

  const handleEdit = (lender: Lender) => {
    setEditingLender(lender);
    // Reset form with lender data
    setDiscoveryData(null);
    form.reset({
      institutionName: lender.institutionName,
      contactName: lender.contactName || "",
      email: lender.email,
      phone: lender.phone || "",
      address: lender.address || "",
      website: lender.website || "",
      notes: lender.notes || "",
      lenderType: lender.lenderType || "bank",
      productTypes: (lender.productTypes as string[]) || [],
      minLoanAmount: lender.minLoanAmount || undefined,
      maxLoanAmount: lender.maxLoanAmount || undefined,
      minTermMonths: lender.minTermMonths || undefined,
      maxTermMonths: lender.maxTermMonths || undefined,
      minLtv: lender.minLtv || undefined,
      maxLtv: lender.maxLtv || undefined,
      typicalRateFrom: lender.typicalRateFrom || "",
      typicalRateTo: lender.typicalRateTo || "",
      arrangementFee: lender.arrangementFee || "",
      sectors: (lender.sectors as string[]) || [],
      regions: (lender.regions as string[]) || [],
      turnaroundDays: lender.turnaroundDays || undefined,
      panelStatus: lender.panelStatus || "market",
      bdmName: lender.bdmName || "",
      bdmEmail: lender.bdmEmail || "",
      bdmPhone: lender.bdmPhone || "",
      submissionEmail: lender.submissionEmail || "",
      creditAppetite: lender.creditAppetite || "",
      keyStrengths: lender.keyStrengths || "",
      keyWeaknesses: lender.keyWeaknesses || "",
      lendingPolicy: lender.lendingPolicy || "",
      insights: lender.insights || "",
      rating: lender.rating || undefined,
    });
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingLender(null);
    setDiscoveryData(null);
    form.reset({
      institutionName: "",
      contactName: "",
      email: "",
      phone: "",
      address: "",
      website: "",
      notes: "",
      lenderType: "bank",
      productTypes: [],
      sectors: [],
      regions: [],
      panelStatus: "market",
    });
    setIsDialogOpen(true);
  };

  const handleDiscoveryAdd = (data: any) => {
    setEditingLender(null);
    const mappedData = {
      institutionName: data.institutionName || "",
      website: data.website || "",
      notes: data.description || "",
      lenderType: data.lenderType || "tier2.0",
      productTypes: data.productTypes || [],
      contactName: "",
      email: "",
      phone: "",
      address: "",
      sectors: [],
      regions: [],
      panelStatus: "market" as const,
      minLoanAmount: null,
      maxLoanAmount: null,
      minTermMonths: null,
      maxTermMonths: null,
      minLtv: null,
      maxLtv: null,
      typicalRateFrom: null,
      typicalRateTo: null,
      arrangementFee: null,
      turnaroundDays: null,
      bdmName: null,
      bdmEmail: null,
      bdmPhone: null,
      submissionEmail: null,
      creditAppetite: null,
      keyStrengths: null,
      keyWeaknesses: null,
      rating: 0,
      logoUrl: null,
      lendingPolicy: null,
      insights: data.reason || null,
      isGlobal: 0,
      securityTypes: [],
      borrowerTypes: [],
      acceptsStartups: 0,
      isFavourite: 0,
      introducerAgreementSigned: 0,
    };
    setDiscoveryData(mappedData);
    form.reset(mappedData);
    setIsDialogOpen(true);
  };

  const filteredLenders = lenders
    .filter((lender) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        searchQuery === "" ||
        lender.institutionName.toLowerCase().includes(query) ||
        lender.contactName?.toLowerCase().includes(query) ||
        lender.bdmName?.toLowerCase().includes(query) ||
        lender.email?.toLowerCase().includes(query) ||
        lender.phone?.toLowerCase().includes(query) ||
        lender.website?.toLowerCase().includes(query) ||
        lender.notes?.toLowerCase().includes(query) ||
        lender.lenderType?.toLowerCase().includes(query) ||
        (lender.productTypes as string[])?.some(p => p.toLowerCase().includes(query)) ||
        (lender.sectors as string[])?.some(s => s.toLowerCase().includes(query)) ||
        (lender.regions as string[])?.some(r => r.toLowerCase().includes(query));

      const matchesPanelStatus =
        filterPanelStatus === "all" || lender.panelStatus === filterPanelStatus;
      const matchesLenderType =
        filterLenderType === "all" ||
        lender.lenderType === filterLenderType ||
        (lender.tier !== null && lender.tier !== undefined && `tier${Number(lender.tier).toFixed(1)}` === filterLenderType);
      const matchesCategory =
        filterCategory === "all" || lender.lenderType === filterCategory;
      const matchesProducts =
        selectedProducts.length === 0 ||
        selectedProducts.some((p) => (lender.productTypes as string[])?.includes(p));

      return matchesSearch && matchesPanelStatus && matchesLenderType && matchesCategory && matchesProducts;
    })
    .sort((a, b) => {
      // Favourites first
      const aFav = a.isFavourite ? 1 : 0;
      const bFav = b.isFavourite ? 1 : 0;
      if (bFav !== aFav) return bFav - aFav;
      // Then alphabetically
      return a.institutionName.localeCompare(b.institutionName);
    });

  const panelLenders = lenders.filter(
    (l) => l.panelStatus === "panel" || l.panelStatus === "preferred"
  );
  const marketLenders = lenders.filter((l) => l.panelStatus === "market");

  // Page Title & Actions
  const actions = (
    <div className="flex items-center gap-2">
      {user?.role === "super_admin" && (
        <Button
          onClick={() => setIsDiscoveryOpen(true)}
          variant="outline"
          size="sm"
          className="hidden sm:flex border-primary/20 hover:bg-primary/5 text-primary"
        >
          <Search className="h-4 w-4 mr-2" />
          Discover Lenders
        </Button>
      )}
      <Button onClick={handleAdd} size="sm" className="hidden sm:flex" data-testid="button-add-lender">
        <Plus className="h-4 w-4 mr-2" />
        Add Lender
      </Button>
    </div>
  );

  usePageTitle(
    "Lender Matching",
    `${panelLenders.length} on panel · ${marketLenders.length} whole of market`
  );
  usePageActions(actions);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-10">
      <main className="w-full px-4 md:px-6 py-6 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <TabsList className="bg-muted/50 p-1">
              <TabsTrigger value="find" className="px-4 py-2">
                <Search className="h-4 w-4 mr-2" />
                Find Lender
              </TabsTrigger>
              <TabsTrigger value="directory" className="px-4 py-2">
                <List className="h-4 w-4 mr-2" />
                Lender Directory
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="directory" className="space-y-6 mt-0 border-none p-0">
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4 mb-6">

                <div className="flex border rounded-md h-9 bg-card shrink-0">
                  <Button
                    variant={viewMode === "grid" ? "secondary" : "ghost"}
                    size="icon"
                    onClick={() => setViewMode("grid")}
                    className="h-full rounded-r-none"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "table" ? "secondary" : "ghost"}
                    size="icon"
                    onClick={() => setViewMode("table")}
                    className="h-full rounded-l-none"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>

                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search lenders, contacts, BDMs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Select value={filterPanelStatus} onValueChange={setFilterPanelStatus}>
                    <SelectTrigger className="w-[150px]" data-testid="select-panel-status">
                      <SelectValue placeholder="Panel Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      {PANEL_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterLenderType} onValueChange={setFilterLenderType}>
                    <SelectTrigger className="w-[160px]" data-testid="select-lender-type">
                      <SelectValue placeholder="Tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tiers</SelectItem>
                      {LENDER_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-[150px]" data-testid="select-category">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                      <SelectItem value="alternative">Alternative</SelectItem>
                      <SelectItem value="specialist">Specialist</SelectItem>
                      <SelectItem value="fintech">Fintech</SelectItem>
                      <SelectItem value="peer_to_peer">Peer-to-Peer</SelectItem>
                      <SelectItem value="crowdfunding">Crowdfunding</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedLenders.length > 0 && user?.role === "super_admin" && (
                <div className="flex items-center gap-4 p-4 bg-primary/5 border border-primary/20 rounded-xl mb-4 animate-in fade-in slide-in-from-top-2">
                  <div className="flex-1">
                    <span className="text-sm font-bold text-primary">{selectedLenders.length} lenders selected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select onValueChange={(val) => bulkUpdateTierMutation.mutate({ ids: selectedLenders, tier: parseFloat(val) })}>
                      <SelectTrigger className="w-[180px] h-9 bg-white font-bold text-xs rounded-lg border-primary/20 shadow-sm focus:ring-primary/20 transition-all hover:border-primary/40">
                        <SelectValue placeholder="Bulk Update Tier" />
                      </SelectTrigger>
                      <SelectContent>
                        {LENDER_TIERS.map((tier) => (
                          <SelectItem key={tier.value} value={tier.value.toString()} className="text-xs font-bold">
                            {tier.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select onValueChange={(val) => bulkUpdateTypeMutation.mutate({ ids: selectedLenders, lenderType: val })}>
                      <SelectTrigger className="w-[180px] h-9 bg-white font-bold text-xs rounded-lg border-primary/20 shadow-sm focus:ring-primary/20 transition-all hover:border-primary/40">
                        <SelectValue placeholder="Bulk Update Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {LENDER_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value} className="text-xs font-bold">
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 text-xs font-bold text-destructive hover:text-destructive hover:bg-destructive/5"
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to delete ${selectedLenders.length} lenders?`)) {
                          bulkDeleteLendersMutation.mutate(selectedLenders);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Delete Selected
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 text-xs font-bold text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedLenders([])}
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>
              )}

              {error ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
                    <p className="text-destructive mb-2">Failed to load lenders</p>
                    <p className="text-sm text-muted-foreground">
                      {error instanceof Error ? error.message : "An error occurred"}
                    </p>
                  </CardContent>
                </Card>
              ) : isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Card key={i} className="animate-pulse">
                      <CardHeader>
                        <div className="h-5 bg-muted rounded w-3/4"></div>
                        <div className="h-4 bg-muted rounded w-1/2 mt-2"></div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="h-4 bg-muted rounded"></div>
                          <div className="h-4 bg-muted rounded w-2/3"></div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredLenders.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    {lenders.length === 0 ? (
                      <>
                        <h3 className="text-lg font-semibold mb-2">Build Your Lender Network</h3>
                        <p className="text-muted-foreground mb-4">
                          Start adding lenders to create your whole-of-market directory
                        </p>
                        <Button onClick={handleAdd} data-testid="button-add-first-lender">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Your First Lender
                        </Button>
                      </>
                    ) : (
                      <>
                        <h3 className="text-lg font-semibold mb-2">No matching lenders</h3>
                        <p className="text-muted-foreground">Try adjusting your search or filters</p>
                      </>
                    )}
                  </CardContent>
                </Card>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredLenders.map((lender) => (
                    <Card
                      key={lender.id}
                      className="group hover:shadow-xl hover:border-primary/20 border-border/50 transition-all duration-300 cursor-pointer relative overflow-hidden flex flex-col"
                      onClick={() => navigate(`/lenders/${lender.id}`)}
                    >
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between gap-4">
                          {lender.logoUrl ? (
                            <div className="h-14 w-14 rounded-xl border bg-white p-2 flex-shrink-0 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-300">
                              <img src={lender.logoUrl} alt={lender.institutionName} className="max-h-full max-w-full object-contain" />
                            </div>
                          ) : (
                            <div className="h-14 w-14 rounded-xl bg-primary/5 border border-primary/10 flex-shrink-0 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                              <Building2 className="h-7 w-7 text-primary/40" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-bold tracking-tight text-foreground group-hover:text-primary transition-colors truncate">
                              {lender.institutionName}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <TierBadge type={lender.lenderType} tier={lender.tier} />
                              <PanelBadge status={lender.panelStatus} />
                              {lender.isGlobal === 1 && (
                                <Badge variant="outline" className="text-[10px] font-bold h-5 border-blue-200 bg-blue-50/50 text-blue-700">
                                  GLOBAL
                                </Badge>
                              )}
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/lenders/${lender.id}`); }}>
                                <Eye className="h-4 w-4 mr-2" /> View Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  researchLenderMutation.mutate(lender.id!);
                                }}
                                disabled={researchLenderMutation.isPending}
                              >
                                <Globe className="h-4 w-4 mr-2" />
                                {researchLenderMutation.isPending ? "Researching..." : "AI Deep Research"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={lender.isGlobal === 1 && lender.userId !== user?.id}
                                onClick={(e) => { e.stopPropagation(); handleEdit(lender); }}
                              >
                                <Pencil className="h-4 w-4 mr-2" /> Edit Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled={lender.isGlobal === 1 && lender.userId !== user?.id}
                                onClick={(e) => { e.stopPropagation(); setDeletingLender(lender); }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete Lender
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 flex-grow">
                        <div className="flex flex-col gap-2.5">
                          <RatingStars rating={lender.rating} />

                          {(lender.minLoanAmount || lender.maxLoanAmount) && (
                            <div className="flex items-center gap-2.5 text-sm text-muted-foreground bg-muted/30 p-2 rounded-lg">
                              <PoundSterling className="h-4 w-4 text-primary/60" />
                              <span className="font-medium text-foreground">
                                {formatCurrency(lender.minLoanAmount)} — {formatCurrency(lender.maxLoanAmount)}
                              </span>
                            </div>
                          )}

                          {(lender.typicalRateFrom || lender.typicalRateTo) && (
                            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                              <Percent className="h-4 w-4 opacity-70" />
                              <span>Rates From {lender.typicalRateFrom || "?"} to {lender.typicalRateTo || "?"}</span>
                            </div>
                          )}
                        </div>

                        {lender.productTypes && (lender.productTypes as string[]).length > 0 && (
                          <div className="pt-2">
                            <div className="flex flex-wrap gap-1.5">
                              {(lender.productTypes as string[]).slice(0, 3).map((p) => (
                                <Badge key={p} variant="secondary" className="text-[10px] px-2 h-5 bg-primary/5 text-primary border-primary/10">
                                  {p}
                                </Badge>
                              ))}
                              {(lender.productTypes as string[]).length > 3 && (
                                <Badge variant="outline" className="text-[10px] px-2 h-5 text-muted-foreground">
                                  +{(lender.productTypes as string[]).length - 3} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                      <CardFooter className="pt-4 border-t border-border/40 bg-muted/10 flex-col gap-4 mt-auto">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Switch
                              checked={!!lender.isFavourite}
                              onCheckedChange={(checked) => toggleFavouriteMutation.mutate({ id: lender.id!, isFavourite: checked })}
                              className="scale-90"
                            />
                            <Star className={`h-4 w-4 transition-colors ${lender.isFavourite ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground opacity-30"}`} />
                          </div>
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Agreement</span>
                            <Switch
                              checked={!!lender.introducerAgreementSigned}
                              onCheckedChange={(checked) => toggleAgreementMutation.mutate({ id: lender.id!, signed: checked })}
                              className="scale-90"
                            />
                          </div>
                        </div>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <Accordion type="multiple" className="space-y-4" defaultValue={[]}>
                  {[...PRODUCT_TYPES, "Other / Unspecified"].map((groupName) => {
                    const groupLenders =
                      groupName === "Other / Unspecified"
                        ? filteredLenders.filter(
                          (l) =>
                            !l.productTypes ||
                            (l.productTypes as string[]).length === 0 ||
                            !(l.productTypes as string[]).some((p) =>
                              PRODUCT_TYPES.some(pt => pt.toLowerCase() === p.toLowerCase())
                            )
                        )
                        : filteredLenders.filter((l) => {
                          const pts = (l.productTypes as string[]) || [];
                          const targetLower = groupName.toLowerCase();

                          return pts.some(p => {
                            const pLower = p.toLowerCase();
                            if (targetLower === "commercial mortgages") {
                              return pLower === "commercial mortgages" || pLower === "commercial mortgage";
                            }
                            return pLower === targetLower;
                          });
                        });

                    if (groupLenders.length === 0) return null;

                    const config = PRODUCT_CATEGORY_CONFIG[groupName] || PRODUCT_CATEGORY_CONFIG["Other / Unspecified"];
                    const Icon = config.icon;

                    return (
                      <AccordionItem key={groupName} value={groupName} className={`border ${config.tint} rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md`}>
                        <AccordionTrigger className="px-6 py-5 hover:no-underline hover:bg-black/5 transition-all group [&[data-state=open]]:bg-black/5 [&[data-state=open]]:border-b">
                          <div className="flex items-center gap-4">
                            <div className={`p-2.5 rounded-lg ${config.tint} border-border/10 shadow-sm`}>
                              <Icon className={`h-5 w-5 ${config.color}`} />
                            </div>
                            <div className="flex flex-col items-start gap-0.5">
                              <span className="text-xl font-bold tracking-tight text-foreground">{groupName}</span>
                              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">
                                {groupLenders.length} {groupLenders.length === 1 ? "LENDER" : "LENDERS"}
                              </span>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-0">
                          <div className="overflow-x-auto">
                            <Table className="table-fixed">
                              <TableHeader>
                                <TableRow className="hover:bg-transparent bg-muted/40 border-b border-border/50">
                                  <TableHead className="w-12 pl-4">
                                    <Checkbox
                                      checked={groupLenders.every(l => selectedLenders.includes(l.id!))}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          const ids = groupLenders.map(l => l.id!);
                                          setSelectedLenders(prev => Array.from(new Set([...prev, ...ids])));
                                        } else {
                                          const ids = groupLenders.map(l => l.id!);
                                          setSelectedLenders(prev => prev.filter(id => !ids.includes(id)));
                                        }
                                      }}
                                    />
                                  </TableHead>
                                  <TableHead className="w-16 pl-4">FAV</TableHead>
                                  <TableHead className="w-[30%] lg:w-[35%] font-semibold">LENDER</TableHead>
                                  <TableHead className="w-[180px] hidden lg:table-cell font-semibold">TIER</TableHead>
                                  <TableHead className="w-[220px] hidden lg:table-cell font-semibold">LOAN RANGE</TableHead>
                                  <TableHead className="w-[120px] hidden xl:table-cell font-semibold text-center">AGREEMENT</TableHead>
                                  <TableHead className="w-[140px] text-right pr-8 font-semibold">ACTIONS</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {groupLenders.map((lender, index) => (
                                  <React.Fragment key={`${groupName}-${lender.id || index}`}>
                                    <TableRow
                                      className={`cursor-pointer group hover:bg-muted/30 transition-colors border-border/40 ${selectedLenders.includes(lender.id!) ? 'bg-primary/5' : ''}`}
                                      onClick={() => navigate(`/lenders/${lender.id}`)}
                                    >
                                      <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                                        <Checkbox
                                          checked={selectedLenders.includes(lender.id!)}
                                          onCheckedChange={(checked) => {
                                            if (checked) setSelectedLenders(prev => [...prev, lender.id!]);
                                            else setSelectedLenders(prev => prev.filter(id => id !== lender.id!));
                                          }}
                                        />
                                      </TableCell>
                                      <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center gap-3">
                                          <Switch
                                            checked={!!lender.isFavourite}
                                            onCheckedChange={(checked) =>
                                              toggleFavouriteMutation.mutate({ id: lender.id!, isFavourite: checked })
                                            }
                                            className="scale-90"
                                          />
                                          <Star className={`h-4 w-4 ${lender.isFavourite ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/10 group-hover:text-muted-foreground/30"}`} />
                                        </div>
                                      </TableCell>
                                      <TableCell className="py-5">
                                        <div className="flex items-center gap-4">
                                          {lender.logoUrl ? (
                                            <div className="h-14 w-14 rounded-xl border border-border/80 bg-white p-2 flex-shrink-0 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                                              <img src={lender.logoUrl} alt={lender.institutionName} className="max-h-full max-w-full object-contain" />
                                            </div>
                                          ) : (
                                            <div className="h-14 w-14 rounded-xl bg-primary/5 border border-primary/10 flex-shrink-0 flex items-center justify-center group-hover:bg-primary/10">
                                              <Building2 className="h-7 w-7 text-primary/30" />
                                            </div>
                                          )}
                                          <div className="flex flex-col min-w-0">
                                            <span className="font-bold text-base text-foreground group-hover:text-primary transition-colors truncate">
                                              {lender.institutionName}
                                            </span>
                                          </div>
                                        </div>
                                      </TableCell>
                                      <TableCell className="hidden lg:table-cell">
                                        <TierBadge type={lender.lenderType} tier={lender.tier} />
                                      </TableCell>
                                      <TableCell className="hidden lg:table-cell">
                                        <div className="flex flex-col gap-0.5">
                                          {(lender.minLoanAmount || lender.maxLoanAmount) ? (
                                            <span className="text-sm font-bold text-foreground/80">
                                              {formatCurrency(lender.minLoanAmount)} — {formatCurrency(lender.maxLoanAmount)}
                                            </span>
                                          ) : (
                                            <span className="text-muted-foreground text-xs italic">Not specified</span>
                                          )}
                                          {lender.typicalRateFrom && (
                                            <span className="text-[10px] text-muted-foreground font-semibold">
                                              Rates from {lender.typicalRateFrom}%
                                            </span>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell onClick={(e) => e.stopPropagation()} className="hidden xl:table-cell">
                                        <div className="flex flex-col items-center gap-1.5">
                                          <CheckCircle2
                                            className={`h-5 w-5 ${lender.introducerAgreementSigned ? "text-green-500" : "text-muted-foreground/20"}`}
                                          />
                                          <span className={`text-[10px] font-bold uppercase tracking-wider ${lender.introducerAgreementSigned ? "text-green-700" : "text-muted-foreground/60"}`}>
                                            {lender.introducerAgreementSigned ? "SIGNED" : "PENDING"}
                                          </span>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-right pr-8" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-end gap-2">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-full"
                                            onClick={() => researchLenderMutation.mutate(lender.id!)}
                                            title="AI Research"
                                            disabled={researchLenderMutation.isPending}
                                          >
                                            <Globe className={`h-4 w-4 ${researchLenderMutation.isPending ? "animate-pulse" : ""}`} />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-full"
                                            onClick={() => handleEdit(lender)}
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-full"
                                            onClick={() => setDeletingLender(lender)}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                    {(lender.lendingPolicy || lender.insights || lender.creditAppetite) && (
                                      <TableRow className="bg-muted/5 border-b border-border/20">
                                        <TableCell colSpan={8} className="py-4 pl-12 pr-8">
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {lender.creditAppetite && (
                                              <div>
                                                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                                  <Star className="h-3 w-3 text-primary" /> Credit Appetite
                                                </h4>
                                                <p className="text-xs text-foreground/80 leading-relaxed italic border-l-2 border-primary/20 pl-3">
                                                  {lender.creditAppetite}
                                                </p>
                                              </div>
                                            )}
                                            {lender.lendingPolicy && (
                                              <div>
                                                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                                  <CheckCircle2 className="h-3 w-3 text-green-500" /> Lending Policy
                                                </h4>
                                                <p className="text-xs text-foreground/80 leading-relaxed border-l-2 border-green-500/20 pl-3">
                                                  {lender.lendingPolicy}
                                                </p>
                                              </div>
                                            )}
                                            {lender.insights && (
                                              <div className="md:col-span-2">
                                                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                                  <Globe className="h-3 w-3 text-blue-500" /> AI Insights
                                                </h4>
                                                <p className="text-[11px] text-foreground/70 leading-relaxed bg-blue-50/30 p-2.5 rounded-lg border border-blue-100/30">
                                                  {lender.insights}
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </React.Fragment>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </div>
          </TabsContent>

          <TabsContent value="find" className="space-y-6 mt-0 border-none p-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Criteria Panel */}
              <div className="lg:col-span-4 space-y-6">
                <Card className="border-border/50 shadow-md overflow-hidden bg-card/50 backdrop-blur-sm">
                  <CardHeader className="bg-gradient-to-br from-primary/5 via-background to-background border-b border-border/50 py-5 px-6">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[10px] font-black tracking-widest uppercase text-primary">Requirement Panel</span>
                    </div>
                    <CardTitle className="text-xl font-black tracking-tight">Deal Specification</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border/40">
                      {[
                        { label: "Product Category", value: matchRequirements.productType || "", onChange: (v: string) => setMatchRequirements(prev => ({ ...prev, productType: v })), icon: Layers, type: "select", options: PRODUCT_TYPES, placeholder: "Select..." },
                        { label: "Loan Amount", value: matchRequirements.amount, onChange: (v: any) => setMatchRequirements(prev => ({ ...prev, amount: parseInt(v) || undefined })), icon: PoundSterling, type: "number", placeholder: "e.g. 500k" },
                        { label: "Sector Focus", value: matchRequirements.sector || "", onChange: (v: string) => setMatchRequirements(prev => ({ ...prev, sector: v })), icon: Briefcase, type: "select", options: SECTORS, placeholder: "Select..." },
                        { label: "Region", value: matchRequirements.region || "", onChange: (v: string) => setMatchRequirements(prev => ({ ...prev, region: v })), icon: MapPin, type: "select", options: REGIONS, placeholder: "Select..." },
                        { label: "Last Year Turnover", value: matchRequirements.turnover, onChange: (v: any) => setMatchRequirements(prev => ({ ...prev, turnover: parseInt(v) || undefined })), icon: Coins, type: "number", placeholder: "e.g. 2M", bg: "bg-primary/[0.01]" },
                        { label: "Profit / Loss", value: matchRequirements.profit, onChange: (v: any) => setMatchRequirements(prev => ({ ...prev, profit: parseInt(v) || undefined })), icon: TrendingUp, type: "number", placeholder: "e.g. 250k", bg: "bg-primary/[0.01]" },
                        { label: "Net Worth", value: matchRequirements.netWorth, onChange: (v: any) => setMatchRequirements(prev => ({ ...prev, netWorth: parseInt(v) || undefined })), icon: Building2, type: "number", placeholder: "e.g. 1.5M", bg: "bg-primary/[0.01]" },
                        { label: "Credit Status", value: matchRequirements.creditStatus || "", onChange: (v: string) => setMatchRequirements(prev => ({ ...prev, creditStatus: v })), icon: ShieldCheck, type: "select", options: ["Very Good", "Good", "Average", "Poor", "Very Poor"], placeholder: "Select...", bg: "bg-primary/[0.02]" },
                      ].map((field, idx) => (
                        <div key={idx} className={`p-3.5 sm:p-4 grid grid-cols-5 items-center gap-3 ${field.bg || ''}`}>
                          <label className="col-span-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground/80 flex items-center gap-2 px-1 truncate">
                            <field.icon className="h-3.5 w-3.5 shrink-0" /> {field.label}
                          </label>
                          <div className="col-span-3">
                            {field.type === "select" ? (
                              <Select value={field.value as string} onValueChange={field.onChange}>
                                <SelectTrigger className="h-9 bg-muted/20 border-border/40 font-semibold text-xs rounded-xl focus:ring-primary/20">
                                  <SelectValue placeholder={field.placeholder} />
                                </SelectTrigger>
                                <SelectContent>
                                  {field.options?.map((opt: string) => (
                                    <SelectItem key={opt} value={opt} className="text-xs font-medium">{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">£</span>
                                <Input
                                  type="number"
                                  placeholder={field.placeholder}
                                  className="h-9 pl-6 bg-muted/20 border-border/40 font-bold text-xs rounded-xl focus:ring-primary/20"
                                  value={field.value || ""}
                                  onChange={(e) => field.onChange(e.target.value)}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p-6 bg-muted/5 border-t border-border/40 mt-1">
                      <Button
                        className="w-full h-11 bg-primary hover:bg-primary/95 text-primary-foreground font-black rounded-xl shadow-lg shadow-primary/10 transition-all hover:scale-[1.02] active:scale-95 group"
                        onClick={() => {
                          setIsMatching(true);
                          setTimeout(() => {
                            const isSubPrime = ["Average", "Poor", "Very Poor"].includes(matchRequirements.creditStatus || "");
                            const isPrime = ["Very Good", "Good"].includes(matchRequirements.creditStatus || "");
                            const hasBlemish = (matchRequirements.profit !== undefined && matchRequirements.profit <= 0) || (matchRequirements.netWorth !== undefined && matchRequirements.netWorth < 0);

                            const results = lenders.filter(l => {
                              const pts = (l.productTypes as string[]) || [];
                              const matchesProduct = !matchRequirements.productType || pts.some(p => p.toLowerCase() === matchRequirements.productType?.toLowerCase());
                              const matchesAmount = !matchRequirements.amount || (
                                (!l.minLoanAmount || matchRequirements.amount >= l.minLoanAmount) &&
                                (!l.maxLoanAmount || matchRequirements.amount <= l.maxLoanAmount)
                              );

                              if (!(matchesProduct && matchesAmount)) return false;

                              // Tier logic for Credit Status
                              if (isSubPrime && (l.tier === 1.0 || l.lenderType === "tier1.0" || l.lenderType === "tier1.5")) return false;
                              if (isPrime && !hasBlemish && (l.tier === 3.0 || l.lenderType === "tier3.0")) return false;

                              return true;
                            }).sort((a, b) => {
                              let scoreA = 0;
                              let scoreB = 0;
                              if (a.isFavourite) scoreA += 2;
                              if (b.isFavourite) scoreB += 2;
                              if (a.panelStatus === "preferred") scoreA += 3;
                              if (b.panelStatus === "preferred") scoreB += 3;
                              if (a.panelStatus === "panel") scoreA += 1;
                              if (b.panelStatus === "panel") scoreB += 1;

                              // Tier Weighting
                              const tierA = a.tier ?? (parseFloat(a.lenderType?.replace("tier", "") || "3.0"));
                              const tierB = b.tier ?? (parseFloat(b.lenderType?.replace("tier", "") || "3.0"));

                              // Lower tier value is better (higher score). Max points 15 for Tier 1.0
                              scoreA += (4 - tierA) * 5;
                              scoreB += (4 - tierB) * 5;

                              if (matchRequirements.sector && (a.sectors as string[])?.includes(matchRequirements.sector)) scoreA += 2;
                              if (matchRequirements.sector && (b.sectors as string[])?.includes(matchRequirements.sector)) scoreB += 2;
                              return scoreB - scoreA;
                            }).slice(0, 5);
                            setMatchedLenders(results);
                            setIsMatching(false);
                          }, 700);
                        }}
                        disabled={isMatching}
                      >
                        {isMatching ? <RotateCcw className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2 group-hover:rotate-12 transition-all" />}
                        {isMatching ? "Analysing Market..." : "Find Best Matches"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column (Placeholder for following steps) */}
              <div className="lg:col-span-8 space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-lg font-black tracking-tight flex items-center gap-2.5 uppercase">
                    Ranked Results
                    {matchedLenders.length > 0 && (
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black px-2 shadow-none uppercase">Top 5 Matches</Badge>
                    )}
                  </h3>
                  {matchedLenders.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setMatchedLenders([])} className="text-[10px] font-black h-8 uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
                      <RefreshCcw className="h-3 w-3 mr-2" /> Reset Search
                    </Button>
                  )}
                </div>

                {matchedLenders.length > 0 ? (
                  <div className="space-y-3">
                    {matchedLenders.map((lender, index) => (
                      <Card
                        key={lender.id}
                        className={`group cursor-pointer transition-all duration-300 hover:shadow-xl hover:border-primary/40 border-border/40 overflow-hidden rounded-2xl ${index === 0 ? 'ring-1 ring-primary/40 bg-primary/[0.02]' : 'bg-card'}`}
                        onClick={() => navigate(`/lenders/${lender.id}`)}
                      >
                        <div className="flex flex-col md:flex-row items-stretch min-h-[90px]">
                          {/* Rank Indicator */}
                          <div className={`w-12 md:w-16 flex items-center justify-center border-b md:border-b-0 md:border-r border-border/40 ${index === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground/60'}`}>
                            <span className="text-2xl font-black">{index + 1}</span>
                          </div>

                          {/* content */}
                          <div className="flex-1 p-4 flex flex-col md:flex-row items-center gap-4">
                            <div className="h-14 w-14 bg-white border border-border/40 rounded-xl p-2 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                              {lender.logoUrl ? (
                                <img src={lender.logoUrl} className="max-h-full max-w-full object-contain" alt="" />
                              ) : (
                                <Building2 className="h-7 w-7 text-muted-foreground/20" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0 text-center md:text-left">
                              <div className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-2.5 mb-1">
                                <h4 className="font-black text-base truncate group-hover:text-primary transition-colors">{lender.institutionName}</h4>
                                <TierBadge type={lender.lenderType} tier={lender.tier} />
                                {lender.isFavourite && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                              </div>

                              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                                <div className="flex items-center gap-1.5">
                                  <PoundSterling className="h-3 w-3 text-primary opacity-50" />
                                  <span className="text-sm font-black text-primary/90">{formatCurrency(lender.minLoanAmount)} - {formatCurrency(lender.maxLoanAmount)}</span>
                                </div>
                                <span className="text-border h-3 w-[1px] bg-border/60 hidden md:block" />
                                <div className="flex flex-wrap gap-1.5">
                                  {(lender.productTypes as string[])?.slice(0, 2).map(p => (
                                    <Badge key={p} variant="secondary" className="text-[9px] font-bold h-4.5 px-2 bg-muted/60 text-muted-foreground border-none">
                                      {p}
                                    </Badge>
                                  ))}
                                  {(lender.productTypes as string[])?.length > 2 && (
                                    <span className="text-[10px] font-bold text-muted-foreground/50">+{(lender.productTypes as string[]).length - 2}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-5 pr-2">
                              <div className="text-right hidden sm:block">
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1.5 opacity-60">Typical Rate</p>
                                <p className="text-xl font-black leading-none text-foreground">{lender.typicalRateFrom || "?"}%</p>
                              </div>
                              <Button variant="secondary" size="icon" className="h-10 w-10 rounded-full bg-muted/50 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500 shadow-sm border border-border/20">
                                <ArrowRight className="h-5 w-5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                    <p className="text-center text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest pt-2">Showing top 5 matches only</p>
                  </div>
                ) : (
                  <div className="border border-dashed border-border/60 rounded-3xl p-16 flex flex-col items-center justify-center text-center bg-muted/5 backdrop-blur-[2px]">
                    <div className="p-5 bg-muted/20 border border-border/40 rounded-full mb-5 shadow-inner">
                      <Search className="h-10 w-10 text-muted-foreground/20" />
                    </div>
                    <h4 className="text-xl font-black text-foreground/80 tracking-tight uppercase">Search Best Fit</h4>
                    <p className="text-sm font-medium text-muted-foreground/60 max-w-[320px] mt-2 leading-relaxed">
                      Enter deal requirements on the left to reveal the top 5 matched lenders.
                    </p>
                    <div className="flex gap-2 mt-8">
                      <Badge variant="outline" className="opacity-30">Whole of Market</Badge>
                      <Badge variant="outline" className="opacity-30">Suitability Matrix</Badge>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main >

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-lender-form">
          <DialogHeader>
            <DialogTitle>
              {editingLender ? "Edit Lender" : "Add New Lender"}
            </DialogTitle>
            <DialogDescription>
              {editingLender
                ? "Update lender details and criteria"
                : "Add a new lender to your directory"}
            </DialogDescription>
          </DialogHeader>

          <LenderForm
            defaultValues={editingLender || discoveryData || {}}
            onSubmit={onSubmit}
            isSubmitting={createLenderMutation.isPending || updateLenderMutation.isPending}
            onCancel={() => {
              setIsDialogOpen(false);
              setEditingLender(null);
              setDiscoveryData(null);
            }}
            submitLabel={editingLender ? "Update Lender" : "Add Lender"}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingLender}
        onOpenChange={(open) => !open && setDeletingLender(null)}
      >
        <AlertDialogContent data-testid="dialog-delete-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lender?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingLender?.institutionName}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingLender && deleteLenderMutation.mutate(deletingLender.id!)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteLenderMutation.isPending}
            >
              {deleteLenderMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <LenderDiscoveryDialog
        open={isDiscoveryOpen}
        onOpenChange={setIsDiscoveryOpen}
        onAddLender={handleDiscoveryAdd}
      />
    </div >
  );
}
