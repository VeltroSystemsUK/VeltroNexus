import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { LenderForm } from "@/components/LenderForm";
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
import { insertLenderSchema, type InsertLender, type Lender, LENDER_TYPES, PRODUCT_TYPES, SECTORS, REGIONS, PANEL_STATUSES } from "@shared/schema";
import { z } from "zod";
import logoChrome from "@assets/logo-chrome.png";
import ThemeToggle from "@/components/ThemeToggle";
import { ArrowLeft, FileUp } from "lucide-react";
import { BulkLenderUpload } from "@/components/BulkLenderUpload";



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
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("directory");

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

  const onSubmit = (data: ExtendedLenderForm) => {
    if (editingLender) {
      updateLenderMutation.mutate({ id: editingLender.id!, data });
    } else {
      createLenderMutation.mutate(data);
    }
  };

  const handleEdit = (lender: Lender) => {
    setEditingLender(lender);
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

  const filteredLenders = lenders
    .filter((lender) => {
      const matchesSearch =
        searchQuery === "" ||
        lender.institutionName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lender.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lender.bdmName?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesPanelStatus =
        filterPanelStatus === "all" || lender.panelStatus === filterPanelStatus;
      const matchesLenderType =
        filterLenderType === "all" || lender.lenderType === filterLenderType;
      const matchesProducts =
        selectedProducts.length === 0 ||
        selectedProducts.some((p) => (lender.productTypes as string[])?.includes(p));

      return matchesSearch && matchesPanelStatus && matchesLenderType && matchesProducts;
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

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-[#1e293b] bg-[#0f172a] sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/pipeline")}
              className="text-gray-300 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <img
                src={logoChrome}
                alt="Veltro"
                className="h-8 object-contain"
              />
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <header className="border-b sticky top-16 bg-background z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/pipeline")}
              data-testid="button-back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">
                Master Broker Lender Directory
              </h1>
              <p className="text-sm text-muted-foreground">
                {panelLenders.length} on panel · {marketLenders.length} whole of market
              </p>
            </div>
          </div>
          <Button onClick={handleAdd} data-testid="button-add-lender">
            <Plus className="h-4 w-4 mr-2" />
            Add Lender
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b">
            <TabsList className="bg-muted/50 p-1">
              <TabsTrigger value="directory" className="gap-2">
                <Building2 className="h-4 w-4" />
                Directory
              </TabsTrigger>
              <TabsTrigger value="bulk-upload" className="gap-2">
                <FileUp className="h-4 w-4" />
                Bulk Upload
              </TabsTrigger>
            </TabsList>

            {activeTab === "directory" && (
              <div className="flex border rounded-md h-9 bg-card">
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
            )}
          </div>

          <TabsContent value="directory" className="space-y-6 mt-0">
            <div className="flex flex-col md:flex-row gap-4 mb-6">
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
                    <SelectValue placeholder="Lender Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {LENDER_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

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
                            <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider px-2 h-5 bg-muted/50">
                              {LENDER_TYPES.find((t) => t.value === lender.lenderType)?.label || "Lender"}
                            </Badge>
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
              <Accordion type="multiple" className="space-y-4" defaultValue={PRODUCT_TYPES}>
                {[...PRODUCT_TYPES, "Other / Unspecified"].map((groupName) => {
                  const groupLenders =
                    groupName === "Other / Unspecified"
                      ? filteredLenders.filter(
                        (l) =>
                          !l.productTypes ||
                          (l.productTypes as string[]).length === 0 ||
                          !(l.productTypes as string[]).some((p) => PRODUCT_TYPES.includes(p))
                      )
                      : filteredLenders.filter((l) => {
                        const pts = (l.productTypes as string[]) || [];
                        if (groupName === "Commercial Mortgages") {
                          return pts.includes("Commercial Mortgages") || pts.includes("Commercial Mortgage");
                        }
                        return pts.includes(groupName);
                      });

                  if (groupLenders.length === 0) return null;

                  return (
                    <AccordionItem key={groupName} value={groupName} className="border border-border/60 rounded-xl bg-card overflow-hidden shadow-sm transition-all hover:border-primary/20">
                      <AccordionTrigger className="px-6 py-5 hover:no-underline hover:bg-muted/30 transition-all group [&[data-state=open]]:bg-muted/50 [&[data-state=open]]:border-b">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-1.5 bg-primary/20 rounded-full group-hover:bg-primary transition-colors" />
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-xl font-bold tracking-tight">{groupName}</span>
                            <span className="text-xs font-medium text-muted-foreground">
                              {groupLenders.length} {groupLenders.length === 1 ? "LENDER" : "LENDERS"}
                            </span>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-0">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent bg-muted/40 border-b border-border/50">
                                <TableHead className="w-16 pl-8">FAV</TableHead>
                                <TableHead className="min-w-[280px] font-semibold">LENDER</TableHead>
                                <TableHead className="hidden lg:table-cell font-semibold">TYPE</TableHead>
                                <TableHead className="hidden md:table-cell font-semibold">PANEL</TableHead>
                                <TableHead className="hidden lg:table-cell font-semibold">LOAN RANGE</TableHead>
                                <TableHead className="hidden sm:table-cell font-semibold">RATING</TableHead>
                                <TableHead className="hidden xl:table-cell font-semibold text-center">AGREEMENT</TableHead>
                                <TableHead className="text-right pr-8 font-semibold">ACTIONS</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {groupLenders.map((lender, index) => (
                                <React.Fragment key={`${groupName}-${lender.id || index}`}>
                                  <TableRow
                                    className="cursor-pointer group hover:bg-muted/30 transition-colors border-border/40"
                                    onClick={() => navigate(`/lenders/${lender.id}`)}
                                  >
                                    <TableCell className="pl-8" onClick={(e) => e.stopPropagation()}>
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
                                          <div className="flex items-center gap-2 mt-1">
                                            {lender.isGlobal === 1 && (
                                              <Badge variant="secondary" className="h-4 px-1.5 text-[10px] bg-blue-50 text-blue-700 border-blue-100 font-bold uppercase tracking-tighter">GLOBAL</Badge>
                                            )}
                                            <span className="text-xs text-muted-foreground font-medium truncate">
                                              {lender.contactName || lender.email || "No contact info"}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell">
                                      <span className="text-muted-foreground text-sm font-medium">
                                        {LENDER_TYPES.find((t) => t.value === lender.lenderType)?.label || "Lender"}
                                      </span>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                      <PanelBadge status={lender.panelStatus} />
                                      {!lender.introducerAgreementSigned && (
                                        <div className="mt-1">
                                          <Badge variant="outline" className="text-[10px] h-4 px-1 border-amber-200 text-amber-700 bg-amber-50 font-bold uppercase tracking-tight">PROSPECTIVE</Badge>
                                        </div>
                                      )}
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
                                    <TableCell className="hidden sm:table-cell">
                                      <RatingStars rating={lender.rating} />
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
          </TabsContent>

          <TabsContent value="bulk-upload" className="mt-0">
            <BulkLenderUpload />
          </TabsContent>
        </Tabs>
      </main>

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
            defaultValues={editingLender || {}}
            onSubmit={onSubmit}
            isSubmitting={createLenderMutation.isPending || updateLenderMutation.isPending}
            onCancel={() => {
              setIsDialogOpen(false);
              setEditingLender(null);
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
    </div >
  );
}
