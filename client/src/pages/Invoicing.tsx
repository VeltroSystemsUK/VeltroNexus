import { useState } from "react";
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
  Send,
  CheckCircle,
  Trash2,
  Pencil,
  Loader2,
  FileText,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number; // in pence
  total: number;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  prospectId: number;
  clientName: string;
  amount: number;
  currency: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  issueDate: string;
  dueDate: string;
  paidDate: string | null;
  lineItems: LineItem[];
  notes: string | null;
  createdAt: string;
}

interface Prospect {
  id: number;
  company?: { name: string } | null;
}

const formatGBP = (pence: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(pence / 100);

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-gray-500/20 text-muted-foreground" },
  sent: { label: "Sent", color: "bg-blue-500/20 text-blue-400" },
  paid: { label: "Paid", color: "bg-emerald-500/20 text-emerald-400" },
  overdue: { label: "Overdue", color: "bg-red-500/20 text-red-400" },
  cancelled: { label: "Cancelled", color: "bg-slate-500/20 text-slate-400" },
};

const emptyLineItem = (): LineItem => ({
  description: "",
  quantity: 1,
  unitPrice: 0,
  total: 0,
});

export default function Invoicing() {
  usePageTitle("Invoicing", "Create and manage invoices");
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  // Form state
  const [prospectId, setProspectId] = useState<string>("");
  const [clientName, setClientName] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLineItem()]);

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: prospects = [] } = useQuery<Prospect[]>({
    queryKey: ["/api/prospects"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("/api/invoices", "POST", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice created" });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest(`/api/invoices/${id}`, "PATCH", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice updated" });
      closeDialog();
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest(`/api/invoices/${id}/send`, "POST");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice marked as sent" });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest(`/api/invoices/${id}/mark-paid`, "POST");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/income/summary"] });
      toast({ title: "Invoice marked as paid" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/invoices/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice deleted" });
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingInvoice(null);
    setProspectId("");
    setClientName("");
    setIssueDate(new Date().toISOString().split("T")[0]);
    setDueDate("");
    setNotes("");
    setLineItems([emptyLineItem()]);
  };

  const openCreate = () => {
    closeDialog();
    setDialogOpen(true);
  };

  const openEdit = (inv: Invoice) => {
    setEditingInvoice(inv);
    setProspectId(inv.prospectId.toString());
    setClientName(inv.clientName);
    setIssueDate(inv.issueDate ? new Date(inv.issueDate).toISOString().split("T")[0] : "");
    setDueDate(inv.dueDate ? new Date(inv.dueDate).toISOString().split("T")[0] : "");
    setNotes(inv.notes || "");
    setLineItems(inv.lineItems.length > 0 ? inv.lineItems : [emptyLineItem()]);
    setDialogOpen(true);
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      item.total = Math.round(item.quantity * item.unitPrice);
      updated[index] = item;
      return updated;
    });
  };

  const addLineItem = () => setLineItems((prev) => [...prev, emptyLineItem()]);

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const grandTotal = lineItems.reduce((sum, li) => sum + li.total, 0);

  const handleProspectChange = (val: string) => {
    setProspectId(val);
    const prospect = prospects.find((p) => p.id.toString() === val);
    if (prospect?.company?.name) {
      setClientName(prospect.company.name);
    }
  };

  const handleSubmit = () => {
    const validLines = lineItems.filter((li) => li.description.trim() && li.unitPrice > 0);
    if (validLines.length === 0) {
      toast({ title: "Add at least one line item", variant: "destructive" });
      return;
    }
    if (!prospectId || !clientName || !issueDate || !dueDate) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    const payload = {
      prospectId: parseInt(prospectId),
      clientName,
      amount: grandTotal,
      invoiceNumber: editingInvoice?.invoiceNumber || `INV-${Date.now()}`,
      status: editingInvoice?.status || "draft",
      issueDate: new Date(issueDate).toISOString(),
      dueDate: new Date(dueDate).toISOString(),
      paidDate: null,
      lineItems: validLines,
      notes: notes || null,
    };

    if (editingInvoice) {
      updateMutation.mutate({ id: editingInvoice.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{invoices.length} invoice{invoices.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Invoice
        </Button>
      </div>

      {/* Invoice Table */}
      <Card>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No invoices yet. Create your first one.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-[11px] text-muted-foreground font-medium uppercase tracking-wide p-4">Invoice #</th>
                    <th className="text-left text-[11px] text-muted-foreground font-medium uppercase tracking-wide p-4">Client</th>
                    <th className="text-right text-[11px] text-muted-foreground font-medium uppercase tracking-wide p-4">Amount</th>
                    <th className="text-center text-[11px] text-muted-foreground font-medium uppercase tracking-wide p-4">Status</th>
                    <th className="text-left text-[11px] text-muted-foreground font-medium uppercase tracking-wide p-4">Issued</th>
                    <th className="text-left text-[11px] text-muted-foreground font-medium uppercase tracking-wide p-4">Due</th>
                    <th className="text-right text-[11px] text-muted-foreground font-medium uppercase tracking-wide p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const status = statusConfig[inv.status] || statusConfig.draft;
                    return (
                      <tr key={inv.id} className="border-b border-border/30 hover:bg-muted/50 transition-colors">
                        <td className="p-4 text-foreground font-medium">{inv.invoiceNumber}</td>
                        <td className="p-4 text-foreground/70">{inv.clientName}</td>
                        <td className="p-4 text-right text-foreground font-medium">{formatGBP(inv.amount)}</td>
                        <td className="p-4 text-center">
                          <span className={cn("px-2.5 py-1 rounded-full text-[11px] font-medium", status.color)}>
                            {status.label}
                          </span>
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {inv.issueDate ? new Date(inv.issueDate).toLocaleDateString("en-GB") : "—"}
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-GB") : "—"}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-1">
                            {inv.status === "draft" && (
                              <>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(inv)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400 hover:text-blue-300" onClick={() => sendMutation.mutate(inv.id)}>
                                  <Send className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300" onClick={() => deleteMutation.mutate(inv.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                            {inv.status === "sent" && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-400 hover:text-emerald-300" onClick={() => markPaidMutation.mutate(inv.id)}>
                                <CheckCircle className="h-3.5 w-3.5" />
                              </Button>
                            )}
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
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-[640px] bg-card border-border text-foreground max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingInvoice ? "Edit Invoice" : "Create Invoice"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* Prospect Selector */}
            <div className="space-y-2">
              <Label className="text-foreground/70">Linked Prospect</Label>
              <Select value={prospectId} onValueChange={handleProspectChange}>
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue placeholder="Select a prospect..." />
                </SelectTrigger>
                <SelectContent>
                  {prospects.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.company?.name || `Prospect #${p.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Client Name */}
            <div className="space-y-2">
              <Label className="text-foreground/70">Client Name</Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="bg-muted border-border"
                placeholder="Client / Company name"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground/70">Issue Date</Label>
                <Input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="bg-muted border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/70">Due Date</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-muted border-border"
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-foreground/70">Line Items</Label>
                <Button variant="ghost" size="sm" className="text-xs text-primary h-7" onClick={addLineItem}>
                  <Plus className="h-3 w-3 mr-1" /> Add Row
                </Button>
              </div>

              <div className="space-y-2">
                {/* Header */}
                <div className="grid grid-cols-[1fr_70px_100px_90px_32px] gap-2 text-[10px] text-muted-foreground uppercase tracking-wide px-1">
                  <span>Description</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Unit Price</span>
                  <span className="text-right">Total</span>
                  <span />
                </div>

                {lineItems.map((li, i) => (
                  <div key={i} className="grid grid-cols-[1fr_70px_100px_90px_32px] gap-2 items-center">
                    <Input
                      value={li.description}
                      onChange={(e) => updateLineItem(i, "description", e.target.value)}
                      placeholder="Description"
                      className="bg-muted border-border h-9 text-sm"
                    />
                    <Input
                      type="number"
                      min={1}
                      value={li.quantity}
                      onChange={(e) => updateLineItem(i, "quantity", parseInt(e.target.value) || 1)}
                      className="bg-muted border-border h-9 text-sm text-right"
                    />
                    <Input
                      type="number"
                      min={0}
                      step={100}
                      value={li.unitPrice}
                      onChange={(e) => updateLineItem(i, "unitPrice", parseInt(e.target.value) || 0)}
                      placeholder="Pence"
                      className="bg-muted border-border h-9 text-sm text-right"
                    />
                    <div className="text-right text-sm text-foreground/70 pr-1">
                      {formatGBP(li.total)}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-400"
                      onClick={() => removeLineItem(i)}
                      disabled={lineItems.length <= 1}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Grand Total */}
              <div className="flex justify-end pt-2 border-t border-border">
                <div className="text-right">
                  <span className="text-xs text-muted-foreground mr-4">Total</span>
                  <span className="text-lg font-bold text-foreground">{formatGBP(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-foreground/70">Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-muted border-border min-h-[80px]"
                placeholder="Payment terms, additional notes..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={closeDialog}>Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingInvoice ? "Update Invoice" : "Create Invoice"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
