import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { usePageTitle } from "@/context/LayoutContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Receipt,
  Car,
  Download,
  Filter,
  PoundSterling,
  Clock,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// --- Types ---

interface MileageDetail {
  miles: number;
  ratePerMile: number;
  from: string;
  to: string;
  vehicleType: "car" | "motorcycle" | "bicycle";
}

interface Expense {
  id: number;
  userId: string;
  date: string;
  category: string;
  description: string;
  amount: number; // pence
  currency: string;
  status: "pending" | "approved" | "rejected";
  vendor: string | null;
  receiptUrl: string | null;
  mileageDetails: MileageDetail | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ReportData {
  grandTotal: number;
  expenseCount: number;
  categories: { category: string; count: number; total: number }[];
  months: { month: string; label: string; total: number }[];
  mileage: { totalMiles: number; totalCost: number; claimCount: number };
}

// --- Constants ---

const CATEGORIES: Record<string, { label: string; color: string; bg: string }> = {
  travel_mileage: { label: "Travel & Mileage", color: "text-blue-400", bg: "bg-blue-500/10" },
  office_supplies: { label: "Office & Supplies", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  telecoms: { label: "Telecoms", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  professional_services: { label: "Professional Services", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  marketing_advertising: { label: "Marketing & Advertising", color: "text-amber-400", bg: "bg-amber-500/10" },
  insurance: { label: "Insurance", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  training_development: { label: "Training & Development", color: "text-pink-400", bg: "bg-pink-500/10" },
  meals_entertainment: { label: "Meals & Entertainment", color: "text-orange-400", bg: "bg-orange-500/10" },
  rent_utilities: { label: "Rent & Utilities", color: "text-teal-400", bg: "bg-teal-500/10" },
  bank_finance: { label: "Bank & Finance", color: "text-red-400", bg: "bg-red-500/10" },
  other: { label: "Other", color: "text-muted-foreground", bg: "bg-gray-500/10" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "text-amber-400", bg: "bg-amber-500/10" },
  approved: { label: "Approved", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  rejected: { label: "Rejected", color: "text-red-400", bg: "bg-red-500/10" },
};

const HMRC_RATE_FIRST_10K = 45; // pence per mile
const HMRC_RATE_AFTER_10K = 25;

const formatGBP = (pence: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pence / 100);

function calculateMileageAmount(miles: number): number {
  if (miles <= 10000) return miles * HMRC_RATE_FIRST_10K;
  return 10000 * HMRC_RATE_FIRST_10K + (miles - 10000) * HMRC_RATE_AFTER_10K;
}

function getEffectiveRate(miles: number): number {
  if (miles <= 10000) return HMRC_RATE_FIRST_10K;
  return HMRC_RATE_AFTER_10K;
}

export default function Expenses() {
  usePageTitle("Expenses", "Track and manage business expenses");
  const { toast } = useToast();

  // --- State ---
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // Report date range
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");

  // Form state
  const [formDate, setFormDate] = useState("");
  const [formCategory, setFormCategory] = useState<string>("");
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formVendor, setFormVendor] = useState("");
  const [formReceiptUrl, setFormReceiptUrl] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formStatus, setFormStatus] = useState<string>("pending");

  // Mileage fields
  const [formMiles, setFormMiles] = useState("");
  const [formMileageFrom, setFormMileageFrom] = useState("");
  const [formMileageTo, setFormMileageTo] = useState("");
  const [formVehicleType, setFormVehicleType] = useState<string>("car");

  const isMileage = formCategory === "travel_mileage";

  // --- Queries ---
  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  // Build report query string
  const reportQueryStr = useMemo(() => {
    const params = new URLSearchParams();
    if (reportFrom) params.set("from", reportFrom);
    if (reportTo) params.set("to", reportTo);
    return params.toString();
  }, [reportFrom, reportTo]);

  const { data: reportData, isLoading: reportLoading } = useQuery<ReportData>({
    queryKey: ["/api/expenses/report", reportQueryStr],
    queryFn: async () => {
      const res = await fetch(`/api/expenses/report${reportQueryStr ? `?${reportQueryStr}` : ""}`);
      if (!res.ok) throw new Error("Failed to load report");
      return res.json();
    },
    enabled: reportOpen,
  });

  // --- Mutations ---
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("/api/expenses", "POST", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: "Expense created" });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest(`/api/expenses/${id}`, "PATCH", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: "Expense updated" });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/expenses/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: "Expense deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // --- Helpers ---
  const closeDialog = () => {
    setDialogOpen(false);
    setEditingExpense(null);
    setFormDate("");
    setFormCategory("");
    setFormDescription("");
    setFormAmount("");
    setFormVendor("");
    setFormReceiptUrl("");
    setFormNotes("");
    setFormStatus("pending");
    setFormMiles("");
    setFormMileageFrom("");
    setFormMileageTo("");
    setFormVehicleType("car");
  };

  const openCreate = () => {
    closeDialog();
    setFormDate(new Date().toISOString().split("T")[0]);
    setDialogOpen(true);
  };

  const openEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setFormDate(exp.date ? new Date(exp.date).toISOString().split("T")[0] : "");
    setFormCategory(exp.category);
    setFormDescription(exp.description);
    setFormAmount(String(exp.amount / 100));
    setFormVendor(exp.vendor || "");
    setFormReceiptUrl(exp.receiptUrl || "");
    setFormNotes(exp.notes || "");
    setFormStatus(exp.status);
    if (exp.mileageDetails) {
      setFormMiles(String(exp.mileageDetails.miles));
      setFormMileageFrom(exp.mileageDetails.from);
      setFormMileageTo(exp.mileageDetails.to);
      setFormVehicleType(exp.mileageDetails.vehicleType);
    }
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formDate || !formCategory || !formDescription) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }

    let amountPence: number;
    let mileageDetails: MileageDetail | null = null;

    if (isMileage) {
      const miles = parseFloat(formMiles);
      if (!miles || miles <= 0) {
        toast({ title: "Please enter valid miles", variant: "destructive" });
        return;
      }
      amountPence = calculateMileageAmount(miles);
      mileageDetails = {
        miles,
        ratePerMile: getEffectiveRate(miles),
        from: formMileageFrom,
        to: formMileageTo,
        vehicleType: formVehicleType as "car" | "motorcycle" | "bicycle",
      };
    } else {
      amountPence = Math.round(parseFloat(formAmount) * 100);
      if (!amountPence || amountPence <= 0) {
        toast({ title: "Please enter a valid amount", variant: "destructive" });
        return;
      }
    }

    const payload = {
      date: formDate,
      category: formCategory,
      description: formDescription,
      amount: amountPence,
      currency: "GBP",
      status: formStatus,
      vendor: formVendor || null,
      receiptUrl: formReceiptUrl || null,
      mileageDetails,
      notes: formNotes || null,
    };

    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // --- Filtered expenses ---
  const filtered = useMemo(() => {
    let result = expenses;
    if (filterCategory !== "all") {
      result = result.filter((e) => e.category === filterCategory);
    }
    if (filterStatus !== "all") {
      result = result.filter((e) => e.status === filterStatus);
    }
    if (filterFrom) {
      const from = new Date(filterFrom);
      result = result.filter((e) => new Date(e.date) >= from);
    }
    if (filterTo) {
      const to = new Date(filterTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((e) => new Date(e.date) <= to);
    }
    return result;
  }, [expenses, filterCategory, filterStatus, filterFrom, filterTo]);

  // --- Summary stats ---
  const totalExpenses = filtered.reduce((s, e) => s + e.amount, 0);
  const mileageClaims = filtered.filter((e) => e.mileageDetails).length;
  const pendingCount = filtered.filter((e) => e.status === "pending").length;
  const now = new Date();
  const thisMonthTotal = filtered
    .filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, e) => s + e.amount, 0);

  // --- CSV export ---
  const downloadCSV = () => {
    if (!reportData) return;
    const lines = ["Category,Count,Total (£)"];
    for (const cat of reportData.categories) {
      const label = CATEGORIES[cat.category]?.label || cat.category;
      lines.push(`"${label}",${cat.count},${cat.total.toFixed(2)}`);
    }
    lines.push("");
    lines.push(`Grand Total,,${reportData.grandTotal.toFixed(2)}`);
    lines.push("");
    lines.push("Mileage Summary");
    lines.push(`Total Miles,,${reportData.mileage.totalMiles}`);
    lines.push(`Mileage Cost,,${reportData.mileage.totalCost.toFixed(2)}`);
    lines.push(`Claims,,${reportData.mileage.claimCount}`);

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expense-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Mileage auto-calc display ---
  const mileagePreview = isMileage && formMiles
    ? calculateMileageAmount(parseFloat(formMiles) || 0)
    : 0;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Expenses",
            value: formatGBP(totalExpenses),
            icon: PoundSterling,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
          },
          {
            label: "Mileage Claims",
            value: String(mileageClaims),
            icon: Car,
            color: "text-blue-400",
            bg: "bg-blue-500/10",
          },
          {
            label: "Pending",
            value: String(pendingCount),
            icon: Clock,
            color: "text-amber-400",
            bg: "bg-amber-500/10",
          },
          {
            label: "This Month",
            value: formatGBP(thisMonthTotal),
            icon: TrendingUp,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${card.bg}`}>
                    <Icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                  <p className="text-[12px] text-muted-foreground font-medium uppercase tracking-wide">
                    {card.label}
                  </p>
                </div>
                <p className="text-2xl font-bold text-foreground">{card.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Actions + Filters Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button className="gap-2 bg-primary hover:bg-primary/90" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add Expense
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-border text-foreground/70 hover:text-foreground"
              onClick={() => setReportOpen(true)}
            >
              <Download className="h-4 w-4" />
              Generate Report
            </Button>

            <div className="flex-1" />

            <div className="flex items-center gap-2 text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              <span className="text-xs">Filters:</span>
            </div>

            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[160px] h-9 bg-muted border-border text-foreground text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(CATEGORIES).map(([key, cat]) => (
                  <SelectItem key={key} value={key}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[120px] h-9 bg-muted border-border text-foreground text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="w-[130px] h-9 bg-muted border-border text-foreground text-xs"
              placeholder="From"
            />
            <Input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="w-[130px] h-9 bg-muted border-border text-foreground text-xs"
              placeholder="To"
            />
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">
              Expenses
              <span className="text-muted-foreground font-normal ml-2">({filtered.length})</span>
            </h3>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-orange-500/10">
                <Receipt className="h-7 w-7 text-orange-500" />
              </div>
              <p className="text-sm text-muted-foreground">No expenses found. Add your first expense to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-[11px] text-muted-foreground font-medium uppercase tracking-wide pb-3 pr-4">Date</th>
                    <th className="text-left text-[11px] text-muted-foreground font-medium uppercase tracking-wide pb-3 px-4">Category</th>
                    <th className="text-left text-[11px] text-muted-foreground font-medium uppercase tracking-wide pb-3 px-4">Description</th>
                    <th className="text-left text-[11px] text-muted-foreground font-medium uppercase tracking-wide pb-3 px-4">Vendor</th>
                    <th className="text-right text-[11px] text-muted-foreground font-medium uppercase tracking-wide pb-3 px-4">Amount</th>
                    <th className="text-center text-[11px] text-muted-foreground font-medium uppercase tracking-wide pb-3 px-4">Status</th>
                    <th className="text-right text-[11px] text-muted-foreground font-medium uppercase tracking-wide pb-3 pl-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((exp) => {
                    const cat = CATEGORIES[exp.category] || CATEGORIES.other;
                    const status = STATUS_CONFIG[exp.status] || STATUS_CONFIG.pending;

                    return (
                      <tr key={exp.id} className="border-b border-border/30 hover:bg-muted/50 transition-colors">
                        <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">
                          {exp.date ? new Date(exp.date).toLocaleDateString("en-GB") : "—"}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className={cn("text-xs px-2 py-0.5 rounded font-medium", cat.bg, cat.color)}>
                            {cat.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="text-foreground font-medium truncate max-w-[250px]">{exp.description}</div>
                          {exp.mileageDetails && (
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Car className="h-3 w-3" />
                              {exp.mileageDetails.miles} miles
                              {exp.mileageDetails.from && ` — ${exp.mileageDetails.from} to ${exp.mileageDetails.to}`}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-foreground/70">{exp.vendor || "—"}</td>
                        <td className="py-2.5 px-4 text-right text-foreground font-medium whitespace-nowrap">
                          {formatGBP(exp.amount)}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span className={cn("text-xs px-2 py-0.5 rounded font-medium", status.bg, status.color)}>
                            {status.label}
                          </span>
                        </td>
                        <td className="py-2.5 pl-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => openEdit(exp)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-red-400"
                              onClick={() => deleteMutation.mutate(exp.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-[540px] bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Edit Expense" : "Add Expense"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Date + Category row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-foreground/70">Date *</Label>
                <Input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="mt-1 bg-muted border-border text-foreground"
                />
              </div>
              <div>
                <Label className="text-xs text-foreground/70">Category *</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger className="mt-1 bg-muted border-border text-foreground">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIES).map(([key, cat]) => (
                      <SelectItem key={key} value={key}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div>
              <Label className="text-xs text-foreground/70">Description *</Label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="e.g. Client meeting travel, Office chair"
                className="mt-1 bg-muted border-border text-foreground"
              />
            </div>

            {/* Mileage section — only for travel_mileage */}
            {isMileage ? (
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Car className="h-4 w-4 text-blue-400" />
                  <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Mileage Claim</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-foreground/70">From</Label>
                    <Input
                      value={formMileageFrom}
                      onChange={(e) => setFormMileageFrom(e.target.value)}
                      placeholder="Start location"
                      className="mt-1 bg-muted border-border text-foreground text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-foreground/70">To</Label>
                    <Input
                      value={formMileageTo}
                      onChange={(e) => setFormMileageTo(e.target.value)}
                      placeholder="Destination"
                      className="mt-1 bg-muted border-border text-foreground text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-foreground/70">Miles</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formMiles}
                      onChange={(e) => setFormMiles(e.target.value)}
                      placeholder="0"
                      className="mt-1 bg-muted border-border text-foreground text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-foreground/70">Vehicle</Label>
                    <Select value={formVehicleType} onValueChange={setFormVehicleType}>
                      <SelectTrigger className="mt-1 bg-muted border-border text-foreground text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="car">Car</SelectItem>
                        <SelectItem value="motorcycle">Motorcycle</SelectItem>
                        <SelectItem value="bicycle">Bicycle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {mileagePreview > 0 && (
                  <div className="bg-blue-500/10 rounded-md p-2 text-center">
                    <p className="text-xs text-muted-foreground">Calculated amount (HMRC rate: 45p/mile first 10k, 25p after)</p>
                    <p className="text-lg font-bold text-blue-400 mt-1">{formatGBP(mileagePreview)}</p>
                  </div>
                )}
              </div>
            ) : (
              /* Amount + Vendor row */
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-foreground/70">Amount (£) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="0.00"
                    className="mt-1 bg-muted border-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-xs text-foreground/70">Vendor</Label>
                  <Input
                    value={formVendor}
                    onChange={(e) => setFormVendor(e.target.value)}
                    placeholder="e.g. Amazon, Vodafone"
                    className="mt-1 bg-muted border-border text-foreground"
                  />
                </div>
              </div>
            )}

            {/* Vendor for mileage */}
            {isMileage && (
              <div>
                <Label className="text-xs text-foreground/70">Vendor (optional)</Label>
                <Input
                  value={formVendor}
                  onChange={(e) => setFormVendor(e.target.value)}
                  placeholder="e.g. Fuel station"
                  className="mt-1 bg-muted border-border text-foreground"
                />
              </div>
            )}

            {/* Status + Receipt URL */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-foreground/70">Status</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger className="mt-1 bg-muted border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-foreground/70">Receipt URL</Label>
                <Input
                  value={formReceiptUrl}
                  onChange={(e) => setFormReceiptUrl(e.target.value)}
                  placeholder="https://..."
                  className="mt-1 bg-muted border-border text-foreground"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label className="text-xs text-foreground/70">Notes</Label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Additional details..."
                className="mt-1 bg-muted border-border text-foreground min-h-[60px]"
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeDialog} className="border-border text-foreground/70">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-primary hover:bg-primary/90"
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                {editingExpense ? "Update" : "Add Expense"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-[600px] bg-card border-border text-foreground max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Expense Report</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Date range filter */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label className="text-xs text-foreground/70">From</Label>
                <Input
                  type="date"
                  value={reportFrom}
                  onChange={(e) => setReportFrom(e.target.value)}
                  className="mt-1 bg-muted border-border text-foreground text-sm"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs text-foreground/70">To</Label>
                <Input
                  type="date"
                  value={reportTo}
                  onChange={(e) => setReportTo(e.target.value)}
                  className="mt-1 bg-muted border-border text-foreground text-sm"
                />
              </div>
            </div>

            {reportLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : reportData ? (
              <>
                {/* Grand Total */}
                <div className="bg-muted rounded-lg p-4 text-center border border-border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Grand Total</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    £{reportData.grandTotal.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{reportData.expenseCount} expenses</p>
                </div>

                {/* Category breakdown */}
                <div>
                  <h4 className="text-xs font-semibold text-foreground/70 uppercase tracking-wide mb-3">By Category</h4>
                  <div className="space-y-2">
                    {reportData.categories.map((cat) => {
                      const config = CATEGORIES[cat.category] || CATEGORIES.other;
                      const pct = reportData.grandTotal > 0 ? (cat.total / reportData.grandTotal) * 100 : 0;
                      return (
                        <div key={cat.category} className="flex items-center gap-3">
                          <span className={cn("text-xs w-[160px] truncate", config.color)}>{config.label}</span>
                          <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className={cn("h-full rounded-full", config.bg.replace("/10", "/40"))}
                              style={{ width: `${Math.max(pct, 1)}%` }}
                            />
                          </div>
                          <span className="text-xs text-foreground/70 w-[80px] text-right font-medium">
                            £{cat.total.toFixed(2)}
                          </span>
                          <span className="text-xs text-muted-foreground w-[30px] text-right">{cat.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Mileage summary */}
                {reportData.mileage.claimCount > 0 && (
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Car className="h-4 w-4 text-blue-400" />
                      <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Mileage Summary</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-lg font-bold text-foreground">{reportData.mileage.totalMiles}</p>
                        <p className="text-[11px] text-muted-foreground">Total Miles</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-foreground">£{reportData.mileage.totalCost.toFixed(2)}</p>
                        <p className="text-[11px] text-muted-foreground">Total Cost</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-foreground">{reportData.mileage.claimCount}</p>
                        <p className="text-[11px] text-muted-foreground">Claims</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Monthly breakdown */}
                {reportData.months.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-foreground/70 uppercase tracking-wide mb-3">Monthly Breakdown</h4>
                    <div className="space-y-1.5">
                      {reportData.months.map((m) => (
                        <div key={m.month} className="flex items-center justify-between text-sm">
                          <span className="text-foreground/70">{m.label}</span>
                          <span className="text-foreground font-medium">£{m.total.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Download */}
                <div className="flex justify-end pt-2">
                  <Button
                    variant="outline"
                    className="gap-2 border-border text-foreground/70 hover:text-foreground"
                    onClick={downloadCSV}
                  >
                    <Download className="h-4 w-4" />
                    Download CSV
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Select a date range to generate a report.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
