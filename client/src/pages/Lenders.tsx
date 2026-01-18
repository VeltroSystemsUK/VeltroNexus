import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
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
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertLenderSchema, type InsertLender, type Lender } from "@shared/schema";
import { z } from "zod";

const LENDER_TYPES = [
  { value: "bank", label: "Bank" },
  { value: "challenger_bank", label: "Challenger Bank" },
  { value: "building_society", label: "Building Society" },
  { value: "specialist_lender", label: "Specialist Lender" },
  { value: "specialist_cdfi", label: "Specialist - CDFI" },
  { value: "bridging_lender", label: "Bridging Lender" },
  { value: "asset_finance", label: "Asset Finance" },
  { value: "invoice_finance", label: "Invoice Finance" },
  { value: "development_finance", label: "Development Finance" },
  { value: "peer_to_peer", label: "Peer-to-Peer" },
  { value: "private_lender", label: "Private Lender" },
];

const PRODUCT_TYPES = [
  "Term Loan",
  "Revolving Credit",
  "Asset Finance",
  "Invoice Finance",
  "Trade Finance",
  "Development Finance",
  "Bridging",
  "Commercial Mortgage",
  "Buy-to-Let",
  "Mezzanine",
  "Equity Release",
  "Working Capital",
];

const SECTORS = [
  "Manufacturing",
  "Retail",
  "Technology",
  "Healthcare",
  "Construction",
  "Real Estate",
  "Hospitality",
  "Transport",
  "Agriculture",
  "Energy",
  "Professional Services",
  "Wholesale",
];

const REGIONS = [
  "National",
  "London",
  "South East",
  "South West",
  "East of England",
  "Midlands",
  "North West",
  "North East",
  "Yorkshire",
  "Scotland",
  "Wales",
  "Northern Ireland",
];

const PANEL_STATUSES = [
  { value: "panel", label: "On Panel", color: "default" as const },
  { value: "preferred", label: "Preferred", color: "default" as const },
  { value: "market", label: "Whole of Market", color: "secondary" as const },
  { value: "restricted", label: "Restricted", color: "destructive" as const },
];

const extendedLenderSchema = insertLenderSchema.extend({
  institutionName: z.string().min(1, "Institution name is required"),
  lenderType: z.string().optional(),
  productTypes: z.array(z.string()).optional().default([]),
  minLoanAmount: z.coerce.number().optional(),
  maxLoanAmount: z.coerce.number().optional(),
  minTermMonths: z.coerce.number().optional(),
  maxTermMonths: z.coerce.number().optional(),
  minLtv: z.coerce.number().optional(),
  maxLtv: z.coerce.number().optional(),
  typicalRateFrom: z.string().optional(),
  typicalRateTo: z.string().optional(),
  arrangementFee: z.string().optional(),
  sectors: z.array(z.string()).optional().default([]),
  regions: z.array(z.string()).optional().default([]),
  turnaroundDays: z.coerce.number().optional(),
  panelStatus: z.string().optional().default("market"),
  bdmName: z.string().optional(),
  bdmEmail: z.string().optional(),
  bdmPhone: z.string().optional(),
  submissionEmail: z.string().optional(),
  creditAppetite: z.string().optional(),
  keyStrengths: z.string().optional(),
  keyWeaknesses: z.string().optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
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
  const { isAuthenticated } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLender, setEditingLender] = useState<Lender | null>(null);
  const [deletingLender, setDeletingLender] = useState<Lender | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPanelStatus, setFilterPanelStatus] = useState<string>("all");
  const [filterLenderType, setFilterLenderType] = useState<string>("all");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

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

  const createMutation = useMutation({
    mutationFn: (data: ExtendedLenderForm) => apiRequest("/api/lenders", "POST", data),
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

  const updateMutation = useMutation({
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

  const deleteMutation = useMutation({
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

  const handleSubmit = (data: ExtendedLenderForm) => {
    if (editingLender) {
      updateMutation.mutate({ id: editingLender.id, data });
    } else {
      createMutation.mutate(data);
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
      <header className="border-b sticky top-0 bg-background z-10">
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
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
                data-testid="button-view-grid"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("table")}
                data-testid="button-view-table"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLenders.map((lender) => (
              <Card
                key={lender.id}
                className="hover-elevate cursor-pointer transition-all"
                onClick={() => navigate(`/lenders/${lender.id}`)}
                data-testid={`card-lender-${lender.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{lender.institutionName}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {LENDER_TYPES.find((t) => t.value === lender.lenderType)?.label ||
                            "Lender"}
                        </Badge>
                        <PanelBadge status={lender.panelStatus} />
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/lenders/${lender.id}`);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(lender);
                          }}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {lender.email && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              window.location.href = `mailto:${lender.email}`;
                            }}
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            Email
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingLender(lender);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <RatingStars rating={lender.rating} />

                  {(lender.minLoanAmount || lender.maxLoanAmount) && (
                    <div className="flex items-center gap-2 text-sm">
                      <PoundSterling className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {formatCurrency(lender.minLoanAmount)} -{" "}
                        {formatCurrency(lender.maxLoanAmount)}
                      </span>
                    </div>
                  )}

                  {(lender.typicalRateFrom || lender.typicalRateTo) && (
                    <div className="flex items-center gap-2 text-sm">
                      <Percent className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {lender.typicalRateFrom || "?"} - {lender.typicalRateTo || "?"}
                      </span>
                    </div>
                  )}

                  {lender.turnaroundDays && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{lender.turnaroundDays} days turnaround</span>
                    </div>
                  )}

                  {(lender.productTypes as string[])?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(lender.productTypes as string[]).slice(0, 3).map((product) => (
                        <Badge key={product} variant="secondary" className="text-xs">
                          {product}
                        </Badge>
                      ))}
                      {(lender.productTypes as string[]).length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{(lender.productTypes as string[]).length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="pt-0 flex-col gap-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground w-full">
                    {lender.bdmName && (
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span className="truncate">{lender.bdmName}</span>
                      </div>
                    )}
                    {lender.lastContactedAt && (
                      <div className="flex items-center gap-1 ml-auto">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(lender.lastContactedAt).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between w-full pt-2 border-t">
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={!!lender.isFavourite}
                        onCheckedChange={(checked) =>
                          toggleFavouriteMutation.mutate({ id: lender.id, isFavourite: checked })
                        }
                        data-testid={`switch-favourite-${lender.id}`}
                      />
                      <Star
                        className={`h-4 w-4 ${lender.isFavourite ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`}
                      />
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <span className="text-xs text-muted-foreground">Introducer Agreement</span>
                      <Switch
                        checked={!!lender.introducerAgreementSigned}
                        onCheckedChange={(checked) =>
                          toggleAgreementMutation.mutate({ id: lender.id, signed: checked })
                        }
                        data-testid={`switch-agreement-${lender.id}`}
                      />
                      <CheckCircle2
                        className={`h-4 w-4 ${lender.introducerAgreementSigned ? "text-green-500" : "text-muted-foreground"}`}
                      />
                    </div>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">Fav</TableHead>
                    <TableHead>Lender</TableHead>
                    <TableHead className="hidden md:table-cell">Type</TableHead>
                    <TableHead className="hidden md:table-cell">Panel</TableHead>
                    <TableHead className="hidden md:table-cell">Loan Range</TableHead>
                    <TableHead className="hidden md:table-cell">Rating</TableHead>
                    <TableHead className="hidden md:table-cell">Agreement</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLenders.map((lender) => (
                    <TableRow
                      key={lender.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/lenders/${lender.id}`)}
                      data-testid={`row-lender-${lender.id}`}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Switch
                            checked={!!lender.isFavourite}
                            onCheckedChange={(checked) =>
                              toggleFavouriteMutation.mutate({
                                id: lender.id,
                                isFavourite: checked,
                              })
                            }
                            data-testid={`table-switch-favourite-${lender.id}`}
                          />
                          <Star
                            className={`h-4 w-4 ${lender.isFavourite ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {lender.institutionName}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className="text-xs">
                          {LENDER_TYPES.find((t) => t.value === lender.lenderType)?.label ||
                            "Lender"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <PanelBadge status={lender.panelStatus} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {formatCurrency(lender.minLoanAmount)} -{" "}
                        {formatCurrency(lender.maxLoanAmount)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <RatingStars rating={lender.rating} />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()} className="hidden md:table-cell">
                        <div className="flex items-center gap-1">
                          <Switch
                            checked={!!lender.introducerAgreementSigned}
                            onCheckedChange={(checked) =>
                              toggleAgreementMutation.mutate({ id: lender.id, signed: checked })
                            }
                            data-testid={`table-switch-agreement-${lender.id}`}
                          />
                          <CheckCircle2
                            className={`h-4 w-4 ${lender.introducerAgreementSigned ? "text-green-500" : "text-muted-foreground"}`}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(lender)}
                            data-testid={`button-edit-${lender.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingLender(lender)}
                            data-testid={`button-delete-${lender.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent
          className="max-w-4xl max-h-[90vh] overflow-hidden"
          data-testid="dialog-lender"
        >
          <DialogHeader>
            <DialogTitle>{editingLender ? "Edit Lender" : "Add New Lender"}</DialogTitle>
            <DialogDescription>
              {editingLender
                ? "Update lender information and criteria"
                : "Add a new lender to your directory"}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
                    <TabsTrigger value="basic">Basic Info</TabsTrigger>
                    <TabsTrigger value="criteria">Lending Criteria</TabsTrigger>
                    <TabsTrigger value="contacts">Contacts</TabsTrigger>
                    <TabsTrigger value="notes">Notes & Rating</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="institutionName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Institution Name *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., Barclays Business"
                                data-testid="input-institution-name"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lenderType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Lender Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || undefined}>
                              <FormControl>
                                <SelectTrigger data-testid="select-lender-type-form">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {LENDER_TYPES.map((type) => (
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
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="panelStatus"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Panel Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || undefined}>
                              <FormControl>
                                <SelectTrigger data-testid="select-panel-status-form">
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {PANEL_STATUSES.map((status) => (
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
                      <FormField
                        control={form.control}
                        name="website"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Website</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="https://..."
                                data-testid="input-website"
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Full address..."
                              data-testid="input-address"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div>
                      <Label>Product Types</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {PRODUCT_TYPES.map((product) => {
                          const isSelected = form.watch("productTypes")?.includes(product);
                          return (
                            <Badge
                              key={product}
                              variant={isSelected ? "default" : "outline"}
                              className="cursor-pointer"
                              onClick={() => {
                                const current = form.getValues("productTypes") || [];
                                if (isSelected) {
                                  form.setValue(
                                    "productTypes",
                                    current.filter((p) => p !== product)
                                  );
                                } else {
                                  form.setValue("productTypes", [...current, product]);
                                }
                              }}
                            >
                              {product}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="criteria" className="space-y-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="minLoanAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Minimum Loan Amount (£)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="e.g., 50000"
                                data-testid="input-min-loan"
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="maxLoanAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Maximum Loan Amount (£)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="e.g., 10000000"
                                data-testid="input-max-loan"
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="minTermMonths"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Min Term (months)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="e.g., 12" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="maxTermMonths"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max Term (months)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="e.g., 60" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="minLtv"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Min LTV (%)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="e.g., 0" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="maxLtv"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max LTV (%)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="e.g., 75" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="typicalRateFrom"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rate From</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 4.5%" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="typicalRateTo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rate To</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 8.5%" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="arrangementFee"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Arrangement Fee</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 1.5%" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="turnaroundDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Typical Turnaround (days)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="e.g., 14" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div>
                      <Label>Sectors</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {SECTORS.map((sector) => {
                          const isSelected = form.watch("sectors")?.includes(sector);
                          return (
                            <Badge
                              key={sector}
                              variant={isSelected ? "default" : "outline"}
                              className="cursor-pointer"
                              onClick={() => {
                                const current = form.getValues("sectors") || [];
                                if (isSelected) {
                                  form.setValue(
                                    "sectors",
                                    current.filter((s) => s !== sector)
                                  );
                                } else {
                                  form.setValue("sectors", [...current, sector]);
                                }
                              }}
                            >
                              {sector}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <Label>Regions</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {REGIONS.map((region) => {
                          const isSelected = form.watch("regions")?.includes(region);
                          return (
                            <Badge
                              key={region}
                              variant={isSelected ? "default" : "outline"}
                              className="cursor-pointer"
                              onClick={() => {
                                const current = form.getValues("regions") || [];
                                if (isSelected) {
                                  form.setValue(
                                    "regions",
                                    current.filter((r) => r !== region)
                                  );
                                } else {
                                  form.setValue("regions", [...current, region]);
                                }
                              }}
                            >
                              {region}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="contacts" className="space-y-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="contactName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Primary Contact Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., John Smith" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Primary Email *</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="email@example.com" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary Phone</FormLabel>
                          <FormControl>
                            <Input type="tel" placeholder="+44 20 1234 5678" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Separator />
                    <h4 className="font-medium">BDM Contact</h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="bdmName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>BDM Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Sarah Jones" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="bdmEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>BDM Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="bdm@example.com" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="bdmPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>BDM Phone</FormLabel>
                            <FormControl>
                              <Input type="tel" placeholder="+44..." {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="submissionEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Submission Email</FormLabel>
                          <FormDescription>
                            Email address for sending loan applications
                          </FormDescription>
                          <FormControl>
                            <Input type="email" placeholder="submissions@example.com" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>

                  <TabsContent value="notes" className="space-y-4 mt-4">
                    <FormField
                      control={form.control}
                      name="rating"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Your Rating (1-5)</FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-2">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Button
                                  key={star}
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => field.onChange(star)}
                                >
                                  <Star
                                    className={`h-6 w-6 ${field.value && star <= field.value
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "text-muted-foreground"
                                      }`}
                                  />
                                </Button>
                              ))}
                              {field.value && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => field.onChange(undefined)}
                                >
                                  Clear
                                </Button>
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="creditAppetite"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Credit Appetite</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe their current lending appetite..."
                              className="resize-none"
                              rows={2}
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="keyStrengths"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Key Strengths</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="What they're good at..."
                              className="resize-none"
                              rows={2}
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="keyWeaknesses"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Key Weaknesses</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Areas of concern or limitations..."
                              className="resize-none"
                              rows={2}
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>General Notes</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Any other relevant information..."
                              className="resize-none"
                              rows={3}
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>
                </Tabs>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      setEditingLender(null);
                      form.reset();
                    }}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-submit"
                  >
                    {editingLender ? "Update" : "Add"} Lender
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </ScrollArea>
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
              onClick={() => deletingLender && deleteMutation.mutate(deletingLender.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
