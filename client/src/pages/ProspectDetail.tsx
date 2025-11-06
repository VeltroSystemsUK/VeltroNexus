import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { ArrowLeft, Building2, PoundSterling, Calendar, FileText, TrendingUp } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { useState } from "react";

const STAGES = [
  { value: "lead", label: "Lead" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "due-diligence", label: "Due Diligence" },
  { value: "approval", label: "Approval" },
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
  { value: "withdrawn", label: "Withdrawn" },
];

const priorityColors = {
  high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

export default function ProspectDetail() {
  const params = useParams();
  const [, navigate] = useLocation();
  const prospectId = params.id ? parseInt(params.id) : 0;

  const [isEditing, setIsEditing] = useState(false);
  const [loanAmount, setLoanAmount] = useState("");
  const [priority, setPriority] = useState("");
  const [notes, setNotes] = useState("");

  const { data: prospect, isLoading, error } = useQuery({
    queryKey: ["/api/prospects", prospectId],
    queryFn: () => api.prospects.get(prospectId),
    enabled: prospectId > 0,
  });

  const updateStageMutation = useMutation({
    mutationFn: ({ stage }: { stage: string }) =>
      api.prospects.updateStage(prospectId, stage),
    onSuccess: () => {
      toast.success("Stage updated successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/prospects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prospects", prospectId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update stage: ${error.message}`);
    },
  });

  const updateProspectMutation = useMutation({
    mutationFn: (updates: { loanAmount?: number | null; priority?: string | null; notes?: string | null }) =>
      api.prospects.update(prospectId, updates),
    onSuccess: () => {
      toast.success("Prospect updated successfully");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/prospects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prospects", prospectId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update prospect: ${error.message}`);
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / 100);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const handleEdit = () => {
    if (prospect) {
      setLoanAmount(prospect.loanAmount ? (prospect.loanAmount / 100).toString() : "");
      setPriority(prospect.priority || "");
      setNotes(prospect.notes || "");
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    updateProspectMutation.mutate({
      loanAmount: loanAmount ? parseInt(loanAmount) * 100 : null,
      priority: priority || null,
      notes: notes || null,
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setLoanAmount("");
    setPriority("");
    setNotes("");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading prospect...</p>
        </div>
      </div>
    );
  }

  if (error || !prospect) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-destructive font-semibold mb-2">
              {error ? "Failed to load prospect" : "Prospect not found"}
            </p>
            {error && (
              <p className="text-muted-foreground text-sm mb-4">
                {error instanceof Error ? error.message : "An unexpected error occurred"}
              </p>
            )}
            <Button onClick={() => navigate("/")}>Back to Pipeline</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-primary rounded-md flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-bold" data-testid="text-company-name">
                {prospect.company.companyName}
              </h1>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="grid gap-6">
          {/* Company Information */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <Building2 className="h-6 w-6 text-primary" />
                    <CardTitle>Company Information</CardTitle>
                  </div>
                  <CardDescription>Basic company details</CardDescription>
                </div>
                {prospect.priority && (
                  <Badge className={priorityColors[prospect.priority as keyof typeof priorityColors]}>
                    {prospect.priority.charAt(0).toUpperCase() + prospect.priority.slice(1)} Priority
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Company Number</Label>
                <p className="font-mono text-sm" data-testid="text-company-number">
                  {prospect.company.companyNumber}
                </p>
              </div>
              {prospect.company.registeredAddress && (
                <div>
                  <Label className="text-muted-foreground">Registered Address</Label>
                  <p className="text-sm" data-testid="text-address">
                    {prospect.company.registeredAddress}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pipeline Status */}
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Status</CardTitle>
              <CardDescription>Current stage in the lending pipeline</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Current Stage</Label>
                <Select
                  value={prospect.stage}
                  onValueChange={(stage) => updateStageMutation.mutate({ stage })}
                  disabled={updateStageMutation.isPending}
                >
                  <SelectTrigger data-testid="select-stage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((stage) => (
                      <SelectItem key={stage.value} value={stage.value}>
                        {stage.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Created
                  </Label>
                  <p className="text-sm" data-testid="text-created-date">
                    {formatDate(prospect.createdAt)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Last Updated
                  </Label>
                  <p className="text-sm" data-testid="text-updated-date">
                    {formatDate(prospect.updatedAt)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Prospect Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Prospect Details</CardTitle>
                  <CardDescription>Loan information and notes</CardDescription>
                </div>
                {!isEditing && (
                  <Button variant="outline" size="sm" onClick={handleEdit} data-testid="button-edit">
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="loanAmount">Loan Amount (£)</Label>
                    <Input
                      id="loanAmount"
                      type="number"
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(e.target.value)}
                      placeholder="e.g., 250000"
                      min="0"
                      step="1000"
                      data-testid="input-edit-loan-amount"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger id="priority" data-testid="select-edit-priority">
                        <SelectValue placeholder="Select priority level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low Priority</SelectItem>
                        <SelectItem value="medium">Medium Priority</SelectItem>
                        <SelectItem value="high">High Priority</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any relevant notes"
                      rows={4}
                      data-testid="input-edit-notes"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={handleSave}
                      disabled={updateProspectMutation.isPending}
                      data-testid="button-save"
                    >
                      {updateProspectMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      disabled={updateProspectMutation.isPending}
                      data-testid="button-cancel-edit"
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label className="text-muted-foreground flex items-center gap-2">
                      <PoundSterling className="h-4 w-4" />
                      Loan Amount
                    </Label>
                    <p className="text-lg font-semibold" data-testid="text-loan-amount">
                      {prospect.loanAmount ? formatCurrency(prospect.loanAmount) : "Not specified"}
                    </p>
                  </div>
                  {prospect.notes && (
                    <div>
                      <Label className="text-muted-foreground flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Notes
                      </Label>
                      <p className="text-sm whitespace-pre-wrap" data-testid="text-notes">
                        {prospect.notes}
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
