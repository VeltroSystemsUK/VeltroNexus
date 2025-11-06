import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { ArrowLeft, Building2 } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

export default function CompanySearch() {
  const [, navigate] = useLocation();
  const [companyName, setCompanyName] = useState("");
  const [companyNumber, setCompanyNumber] = useState("");
  const [registeredAddress, setRegisteredAddress] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [priority, setPriority] = useState<string>("");
  const [notes, setNotes] = useState("");

  const createProspectMutation = useMutation({
    mutationFn: async (data: {
      companyName: string;
      companyNumber: string;
      registeredAddress?: string;
      loanAmount?: number;
      priority?: string;
      notes?: string;
    }) => {
      // First create or get the company
      const company = await api.companies.create({
        companyName: data.companyName,
        companyNumber: data.companyNumber,
        registeredAddress: data.registeredAddress || null,
        incorporationDate: null,
        companyStatus: null,
        companyType: null,
      });

      // Then create the prospect
      return api.prospects.create({
        companyId: company.id,
        stage: "lead",
        loanAmount: data.loanAmount || null,
        priority: data.priority || null,
        notes: data.notes || null,
      });
    },
    onSuccess: () => {
      toast.success("Prospect created successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/prospects"] });
      navigate("/");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create prospect: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName.trim() || !companyNumber.trim()) {
      toast.error("Company name and number are required");
      return;
    }

    createProspectMutation.mutate({
      companyName: companyName.trim(),
      companyNumber: companyNumber.trim(),
      registeredAddress: registeredAddress.trim() || undefined,
      loanAmount: loanAmount ? parseInt(loanAmount) * 100 : undefined, // Convert to pence
      priority: priority || undefined,
      notes: notes.trim() || undefined,
    });
  };

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
                <span className="text-primary-foreground font-bold text-sm">LP</span>
              </div>
              <h1 className="text-xl font-bold">Add Prospect</h1>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="h-6 w-6 text-primary" />
              <CardTitle>Company Information</CardTitle>
            </div>
            <CardDescription>
              Enter the company details to create a new prospect in your pipeline
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="companyName">
                  Company Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g., Tech Innovations Ltd"
                  required
                  data-testid="input-company-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyNumber">
                  Company Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="companyNumber"
                  value={companyNumber}
                  onChange={(e) => setCompanyNumber(e.target.value)}
                  placeholder="e.g., 12345678"
                  required
                  data-testid="input-company-number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="registeredAddress">Registered Address</Label>
                <Textarea
                  id="registeredAddress"
                  value={registeredAddress}
                  onChange={(e) => setRegisteredAddress(e.target.value)}
                  placeholder="Enter the company's registered address"
                  rows={3}
                  data-testid="input-address"
                />
              </div>

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
                  data-testid="input-loan-amount"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the requested loan amount in pounds
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="priority" data-testid="select-priority">
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
                  placeholder="Add any relevant notes about this prospect"
                  rows={4}
                  data-testid="input-notes"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={createProspectMutation.isPending}
                  className="flex-1"
                  data-testid="button-create-prospect"
                >
                  {createProspectMutation.isPending ? "Creating..." : "Create Prospect"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/")}
                  disabled={createProspectMutation.isPending}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
