import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
import { toast } from "sonner";
import { api } from "@/lib/api";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  ArrowLeft, Building2, PoundSterling, Calendar, Target,
  Users, FileText, TrendingUp, CheckSquare, Calculator,
  Mail, Phone, User, Plus, Trash2, Edit2, Save, X, AlertCircle, FileDown,
  Network, Search, ExternalLink, Loader2
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { useState, useEffect } from "react";
import type { Prospect, ProspectWithCompany, Contact, Activity, DueDiligence, DueDiligenceData } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import {
  DueDiligenceChecklist,
  LoanCalculatorTool,
  DSCRCalculatorTool,
  AffordabilityEstimatorTool,
  FinancialRatiosCalculatorTool,
  CharacterAssessmentTool,
} from "@/components/DueDiligenceTools";
import { CompanyInformation } from "@/components/CompanyInformation";
import type { CompanyProfile } from "@shared/companiesHouseTypes";

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

const priorityConfig = {
  high: { badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", dot: "bg-red-500" },
  medium: { badge: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", dot: "bg-amber-500" },
  low: { badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", dot: "bg-blue-500" },
};

export default function ProspectDetail() {
  const params = useParams();
  const [, navigate] = useLocation();
  const prospectId = params.id ? parseInt(params.id) : 0;
  const { user } = useAuth();

  const { data: prospect, isLoading } = useQuery<ProspectWithCompany>({
    queryKey: [`/api/prospects/${prospectId}`],
    enabled: prospectId > 0,
  });

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: [`/api/prospects/${prospectId}/contacts`],
    enabled: prospectId > 0,
  });

  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: [`/api/prospects/${prospectId}/activities`],
    enabled: prospectId > 0,
  });

  const deleteProspectMutation = useMutation({
    mutationFn: () => apiRequest(`/api/prospects/${prospectId}`, "DELETE"),
    onSuccess: () => {
      toast.success("Prospect deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/prospects"] });
      navigate("/");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete prospect: ${error.message}`);
    },
  });

  const handleDownloadReport = () => {
    window.open(`/api/prospects/${prospectId}/report`, '_blank');
    toast.success("Generating report...");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / 100);
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  if (isLoading || !prospect) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading prospect...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-primary rounded-md flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-bold" data-testid="text-company-name">
                    {prospect.company.companyName}
                  </h1>
                  <p className="text-sm text-muted-foreground font-mono" data-testid="text-company-number">
                    {prospect.company.companyNumber}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => navigate("/")} data-testid="link-view-directory">
                View in Directory
              </Button>
              <Button variant="outline" onClick={handleDownloadReport} data-testid="button-download-report">
                <FileDown className="h-4 w-4 mr-2" />
                Download Report
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" data-testid="button-delete-prospect">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Prospect?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this prospect for {prospect.company.companyName}? 
                      This action cannot be undone and will permanently remove all associated contacts, 
                      activities, and due diligence data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteProspectMutation.mutate()}
                      disabled={deleteProspectMutation.isPending}
                      data-testid="button-confirm-delete"
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleteProspectMutation.isPending ? "Deleting..." : "Delete Prospect"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Key Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StageCard prospect={prospect} />
          <LoanAmountCard prospect={prospect} />
          <DateAddedCard prospect={prospect} />
          <PriorityCard prospect={prospect} />
        </div>

        {/* Company Overview */}
        <CompanyOverview prospect={prospect} />

        {/* Tabbed Content */}
        <Tabs defaultValue="contacts" className="mt-8">
          <TabsList className={`grid w-full ${user?.subscriptionTier === "free" ? "grid-cols-5" : user?.subscriptionTier === "premium" ? "grid-cols-7" : "grid-cols-6"} mb-8`}>
            <TabsTrigger value="contacts" data-testid="tab-contacts">Contacts</TabsTrigger>
            <TabsTrigger value="company" data-testid="tab-company">Company Info</TabsTrigger>
            <TabsTrigger value="loan" data-testid="tab-loan">Loan Requirement</TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">Sales Activity</TabsTrigger>
            {user?.subscriptionTier !== "free" && (
              <TabsTrigger value="diligence" data-testid="tab-diligence">Due Diligence</TabsTrigger>
            )}
            {user?.subscriptionTier === "premium" && (
              <TabsTrigger value="associations" data-testid="tab-associations">Associations & Media</TabsTrigger>
            )}
            <TabsTrigger value="summary" data-testid="tab-summary">Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="contacts">
            <ContactsTab prospectId={prospectId} contacts={contacts} />
          </TabsContent>

          <TabsContent value="company">
            <CompanyInformationTab companyNumber={prospect.company.companyNumber} />
          </TabsContent>

          <TabsContent value="loan">
            <LoanRequirementTab prospect={prospect} />
          </TabsContent>

          <TabsContent value="activity">
            <SalesActivityTab prospectId={prospectId} activities={activities} />
          </TabsContent>

          {user?.subscriptionTier !== "free" && (
            <TabsContent value="diligence">
              <DueDiligenceTab prospect={prospect} />
            </TabsContent>
          )}

          {user?.subscriptionTier === "premium" && (
            <TabsContent value="associations">
              <AssociationsMediaTab prospect={prospect} />
            </TabsContent>
          )}

          <TabsContent value="summary">
            <SummaryTab prospect={prospect} contacts={contacts} activities={activities} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function StageCard({ prospect }: { prospect: ProspectWithCompany }) {
  const updateStageMutation = useMutation({
    mutationFn: ({ stage }: { stage: string }) =>
      fetch(`/api/prospects/${prospect.id}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ stage }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prospects"] });
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospect.id}`] });
      toast.success("Stage updated");
    },
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-muted-foreground text-sm">Stage</Label>
          <Target className="h-4 w-4 text-muted-foreground" />
        </div>
        <Select
          value={prospect.stage}
          onValueChange={(stage) => updateStageMutation.mutate({ stage })}
          data-testid="select-stage"
        >
          <SelectTrigger className="border-0 p-0 h-auto focus:ring-0">
            <SelectValue className="text-base font-semibold" />
          </SelectTrigger>
          <SelectContent>
            {STAGES.map((stage) => (
              <SelectItem key={stage.value} value={stage.value}>
                {stage.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

function LoanAmountCard({ prospect }: { prospect: ProspectWithCompany }) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
    }).format(amount / 100);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-muted-foreground text-sm">Loan Amount</Label>
          <PoundSterling className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-base font-semibold" data-testid="text-loan-amount">
          {prospect.loanAmount ? formatCurrency(prospect.loanAmount) : "Not set"}
        </p>
      </CardContent>
    </Card>
  );
}

function DateAddedCard({ prospect }: { prospect: ProspectWithCompany }) {
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-muted-foreground text-sm">Date Added</Label>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-base font-semibold" data-testid="text-date-added">
          {formatDate(prospect.createdAt)}
        </p>
      </CardContent>
    </Card>
  );
}

function PriorityCard({ prospect }: { prospect: ProspectWithCompany }) {
  const priority = prospect.priority || "medium";
  const config = priorityConfig[priority as keyof typeof priorityConfig];

  const updatePriorityMutation = useMutation({
    mutationFn: (newPriority: string) =>
      apiRequest(`/api/prospects/${prospect.id}`, "PATCH", { priority: newPriority }),
    onSuccess: () => {
      toast.success("Priority updated");
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospect.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/prospects"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update priority: ${error.message}`);
    },
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-muted-foreground text-sm">Priority</Label>
          <div className={`h-2 w-2 rounded-full ${config.dot}`} />
        </div>
        <Select
          value={priority}
          onValueChange={(value) => updatePriorityMutation.mutate(value)}
          disabled={updatePriorityMutation.isPending}
        >
          <SelectTrigger className="w-full" data-testid="select-priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="high" data-testid="priority-high">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                High Priority
              </div>
            </SelectItem>
            <SelectItem value="medium" data-testid="priority-medium">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                Medium Priority
              </div>
            </SelectItem>
            <SelectItem value="low" data-testid="priority-low">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                Low Priority
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

function CompanyOverview({ prospect }: { prospect: ProspectWithCompany }) {
  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Company Status</Label>
              <p className="text-sm font-medium" data-testid="text-company-status">
                {prospect.company.companyStatus || "ACTIVE"}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Incorporation Date</Label>
              <p className="text-sm" data-testid="text-incorporation-date">
                {formatDate(prospect.company.incorporationDate)}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Company Type</Label>
              <p className="text-sm" data-testid="text-company-type">
                {prospect.company.companyType || "ltd"}
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Registered Address</Label>
              <p className="text-sm" data-testid="text-registered-address">
                {prospect.company.registeredAddress || "N/A"}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Last Updated</Label>
              <p className="text-sm" data-testid="text-last-updated">
                {formatDate(prospect.updatedAt)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ContactsTab({ prospectId, contacts }: { prospectId: number; contacts: Contact[] }) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");

  const addContactMutation = useMutation({
    mutationFn: (contact: { name: string; email?: string; phone?: string; role?: string }) =>
      fetch(`/api/prospects/${prospectId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(contact),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospectId}/contacts`] });
      toast.success("Contact added");
      setIsAdding(false);
      setName("");
      setEmail("");
      setPhone("");
      setRole("");
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: (contactId: number) =>
      fetch(`/api/contacts/${contactId}`, {
        method: "DELETE",
        credentials: "include",
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospectId}/contacts`] });
      toast.success("Contact deleted");
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Contacts</CardTitle>
            <CardDescription>Manage contacts at this company</CardDescription>
          </div>
          <Button onClick={() => setIsAdding(true)} data-testid="button-add-contact">
            <Plus className="h-4 w-4 mr-2" />
            Add Contact
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isAdding && (
          <Card className="mb-4">
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contact-name">Name *</Label>
                <Input
                  id="contact-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Smith"
                  data-testid="input-contact-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact-email">Email</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                    data-testid="input-contact-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-phone">Phone</Label>
                  <Input
                    id="contact-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+44 20 1234 5678"
                    data-testid="input-contact-phone"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-role">Role</Label>
                <Input
                  id="contact-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="Finance Director"
                  data-testid="input-contact-role"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => addContactMutation.mutate({ name, email: email || undefined, phone: phone || undefined, role: role || undefined })}
                  disabled={!name || addContactMutation.isPending}
                  data-testid="button-save-contact"
                >
                  Save Contact
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsAdding(false)}
                  data-testid="button-cancel-contact"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {contacts.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No contacts yet</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setIsAdding(true)}
              data-testid="button-add-first-contact"
            >
              Add First Contact
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {contacts.map((contact) => (
              <Card key={contact.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4">
                      <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold" data-testid={`text-contact-name-${contact.id}`}>
                          {contact.name}
                        </p>
                        {contact.role && (
                          <p className="text-sm text-muted-foreground">{contact.role}</p>
                        )}
                        <div className="flex gap-4 mt-2">
                          {contact.email && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span>{contact.email}</span>
                            </div>
                          )}
                          {contact.phone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span>{contact.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteContactMutation.mutate(contact.id)}
                      data-testid={`button-delete-contact-${contact.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LoanRequirementTab({ prospect }: { prospect: ProspectWithCompany }) {
  const [loanAmount, setLoanAmount] = useState(prospect.loanAmount ? (prospect.loanAmount / 100).toString() : "");
  const [term, setTerm] = useState(prospect.term?.toString() || "");
  const [interestRate, setInterestRate] = useState(prospect.interestRate || "");
  const [directorsGuarantee, setDirectorsGuarantee] = useState(!!prospect.directorsGuarantee);
  const [commercialProperty, setCommercialProperty] = useState(!!prospect.commercialProperty);
  const [homeEquity, setHomeEquity] = useState(!!prospect.homeEquity);
  const [propertyOther, setPropertyOther] = useState(!!prospect.propertyOther);
  const [debenture, setDebenture] = useState(!!prospect.debenture);
  const [parentCompanyGuarantee, setParentCompanyGuarantee] = useState(!!prospect.parentCompanyGuarantee);
  const [collateral, setCollateral] = useState(!!prospect.collateral);
  const [crossCompanyGuarantee, setCrossCompanyGuarantee] = useState(!!prospect.crossCompanyGuarantee);
  const [notes, setNotes] = useState(prospect.loanRequirementNotes || "");

  useEffect(() => {
    setLoanAmount(prospect.loanAmount ? (prospect.loanAmount / 100).toString() : "");
    setTerm(prospect.term?.toString() || "");
    setInterestRate(prospect.interestRate || "");
    setDirectorsGuarantee(!!prospect.directorsGuarantee);
    setCommercialProperty(!!prospect.commercialProperty);
    setHomeEquity(!!prospect.homeEquity);
    setPropertyOther(!!prospect.propertyOther);
    setDebenture(!!prospect.debenture);
    setParentCompanyGuarantee(!!prospect.parentCompanyGuarantee);
    setCollateral(!!prospect.collateral);
    setCrossCompanyGuarantee(!!prospect.crossCompanyGuarantee);
    setNotes(prospect.loanRequirementNotes || "");
  }, [prospect]);

  const saveLoanRequirementMutation = useMutation({
    mutationFn: (updates: any) =>
      fetch(`/api/prospects/${prospect.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospect.id}`] });
      toast.success("Loan requirements saved");
    },
  });

  const handleSave = () => {
    saveLoanRequirementMutation.mutate({
      loanAmount: loanAmount ? parseInt(loanAmount) * 100 : null,
      term: term ? parseInt(term) : null,
      interestRate: interestRate || null,
      directorsGuarantee: directorsGuarantee ? 1 : 0,
      commercialProperty: commercialProperty ? 1 : 0,
      homeEquity: homeEquity ? 1 : 0,
      propertyOther: propertyOther ? 1 : 0,
      debenture: debenture ? 1 : 0,
      parentCompanyGuarantee: parentCompanyGuarantee ? 1 : 0,
      collateral: collateral ? 1 : 0,
      crossCompanyGuarantee: crossCompanyGuarantee ? 1 : 0,
      loanRequirementNotes: notes,
    });
  };

  const calculateMonthlyPayment = () => {
    if (!loanAmount || !term || !interestRate) return 0;
    const principal = parseFloat(loanAmount);
    const monthlyRate = parseFloat(interestRate) / 100 / 12;
    const numPayments = parseInt(term);
    if (monthlyRate === 0) return principal / numPayments;
    const payment = (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
                    (Math.pow(1 + monthlyRate, numPayments) - 1);
    return Math.round(payment * 100) / 100;
  };

  const calculateFacilityFee = () => {
    if (!loanAmount) return 0;
    return parseFloat(loanAmount) * 0.035;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Loan Requirement</CardTitle>
        <CardDescription>Specify the loan details for this prospect</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="loan-amount">Loan Amount (£)</Label>
            <Input
              id="loan-amount"
              type="number"
              value={loanAmount}
              onChange={(e) => setLoanAmount(e.target.value)}
              placeholder="150000"
              data-testid="input-loan-amount"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="term">Term (Months)</Label>
            <Input
              id="term"
              type="number"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="60"
              data-testid="input-term"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="interest-rate">Interest Rate (APR %)</Label>
            <Input
              id="interest-rate"
              type="number"
              step="0.1"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              placeholder="17"
              data-testid="input-interest-rate"
            />
          </div>
        </div>

        <div>
          <Label className="mb-3 block">Security</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="directors-guarantee"
                checked={directorsGuarantee}
                onCheckedChange={(checked) => setDirectorsGuarantee(!!checked)}
                data-testid="checkbox-directors-guarantee"
              />
              <label htmlFor="directors-guarantee" className="text-sm cursor-pointer">
                Director's Guarantee
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="debenture"
                checked={debenture}
                onCheckedChange={(checked) => setDebenture(!!checked)}
                data-testid="checkbox-debenture"
              />
              <label htmlFor="debenture" className="text-sm cursor-pointer">
                Debenture
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="commercial-property"
                checked={commercialProperty}
                onCheckedChange={(checked) => setCommercialProperty(!!checked)}
                data-testid="checkbox-commercial-property"
              />
              <label htmlFor="commercial-property" className="text-sm cursor-pointer">
                Commercial Property
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="parent-company-guarantee"
                checked={parentCompanyGuarantee}
                onCheckedChange={(checked) => setParentCompanyGuarantee(!!checked)}
                data-testid="checkbox-parent-company-guarantee"
              />
              <label htmlFor="parent-company-guarantee" className="text-sm cursor-pointer">
                Parent Company Guarantee
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="home-equity"
                checked={homeEquity}
                onCheckedChange={(checked) => setHomeEquity(!!checked)}
                data-testid="checkbox-home-equity"
              />
              <label htmlFor="home-equity" className="text-sm cursor-pointer">
                Home Equity
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="collateral"
                checked={collateral}
                onCheckedChange={(checked) => setCollateral(!!checked)}
                data-testid="checkbox-collateral"
              />
              <label htmlFor="collateral" className="text-sm cursor-pointer">
                Collateral
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="property-other"
                checked={propertyOther}
                onCheckedChange={(checked) => setPropertyOther(!!checked)}
                data-testid="checkbox-property-other"
              />
              <label htmlFor="property-other" className="text-sm cursor-pointer">
                Property (Other)
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="cross-company-guarantee"
                checked={crossCompanyGuarantee}
                onCheckedChange={(checked) => setCrossCompanyGuarantee(!!checked)}
                data-testid="checkbox-cross-company-guarantee"
              />
              <label htmlFor="cross-company-guarantee" className="text-sm cursor-pointer">
                Cross Company Guarantee
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="loan-notes">Notes</Label>
          <Textarea
            id="loan-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Looking to Refinance £120,000 with GOT Capital & Capify"
            rows={4}
            data-testid="textarea-loan-notes"
          />
        </div>

        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-base">Calculated Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Facility Fee (3.5%):</span>
              <span className="font-semibold" data-testid="text-facility-fee">
                £{calculateFacilityFee().toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estimated Monthly Payment:</span>
              <span className="font-semibold" data-testid="text-monthly-payment">
                £{calculateMonthlyPayment().toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saveLoanRequirementMutation.isPending} data-testid="button-save-loan-requirements">
          {saveLoanRequirementMutation.isPending ? "Saving..." : "Save Loan Requirements"}
        </Button>
      </CardContent>
    </Card>
  );
}

function SalesActivityTab({ prospectId, activities }: { prospectId: number; activities: Activity[] }) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const addActivityMutation = useMutation({
    mutationFn: (activity: { title: string; description?: string }) =>
      fetch(`/api/prospects/${prospectId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(activity),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospectId}/activities`] });
      toast.success("Task added");
      setIsAdding(false);
      setTitle("");
      setDescription("");
    },
  });

  const toggleActivityMutation = useMutation({
    mutationFn: ({ id, completed }: { id: number; completed: number }) =>
      fetch(`/api/activities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ completed }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospectId}/activities`] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Sales Activity</CardTitle>
            <CardDescription>Track sales tasks and activities</CardDescription>
          </div>
          <Button onClick={() => setIsAdding(true)} data-testid="button-new-task">
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isAdding && (
          <Card className="mb-4">
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="activity-title">Title *</Label>
                <Input
                  id="activity-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Follow up call"
                  data-testid="input-activity-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="activity-description">Description</Label>
                <Textarea
                  id="activity-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Discuss loan terms..."
                  rows={3}
                  data-testid="textarea-activity-description"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => addActivityMutation.mutate({ title, description: description || undefined })}
                  disabled={!title || addActivityMutation.isPending}
                  data-testid="button-save-activity"
                >
                  Save Task
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsAdding(false)}
                  data-testid="button-cancel-activity"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activities.length === 0 ? (
          <div className="text-center py-12">
            <CheckSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No activities yet</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setIsAdding(true)}
              data-testid="button-add-first-task"
            >
              Add First Task
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <Card key={activity.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={!!activity.completed}
                      onCheckedChange={(checked) =>
                        toggleActivityMutation.mutate({ id: activity.id, completed: checked ? 1 : 0 })
                      }
                      data-testid={`checkbox-activity-${activity.id}`}
                    />
                    <div className="flex-1">
                      <p className={`font-semibold ${activity.completed ? "line-through text-muted-foreground" : ""}`} data-testid={`text-activity-title-${activity.id}`}>
                        {activity.title}
                      </p>
                      {activity.description && (
                        <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(activity.createdAt).toLocaleDateString("en-GB")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DueDiligenceTab({ prospect }: { prospect: ProspectWithCompany }) {
  const { data: dueDiligence } = useQuery<DueDiligence>({
    queryKey: [`/api/prospects/${prospect.id}/due-diligence`],
  });

  const saveDueDiligenceMutation = useMutation({
    mutationFn: (updates: Partial<DueDiligenceData>) =>
      fetch(`/api/prospects/${prospect.id}/due-diligence`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospect.id}/due-diligence`] });
      toast.success("Assessment saved");
    },
    onError: () => {
      toast.error("Failed to save assessment");
    },
  });

  const dueDiligenceData: DueDiligenceData = (dueDiligence?.data as DueDiligenceData) || {};

  const handleSave = (updates: Partial<DueDiligenceData>) => {
    saveDueDiligenceMutation.mutate(updates);
  };

  return (
    <div className="space-y-6">
      <Accordion type="multiple" defaultValue={["checklist"]} className="space-y-4">
        <AccordionItem value="checklist" className="border rounded-lg" data-testid="accordion-checklist">
          <AccordionTrigger className="px-6 hover:no-underline">
            <span className="text-lg font-semibold">Due Diligence Checklist</span>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <DueDiligenceChecklist
              data={dueDiligenceData}
              onSave={handleSave}
              isSaving={saveDueDiligenceMutation.isPending}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="loan-calc" className="border rounded-lg" data-testid="accordion-loan-calc">
          <AccordionTrigger className="px-6 hover:no-underline">
            <span className="text-lg font-semibold">Loan Calculator</span>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <LoanCalculatorTool
              data={dueDiligenceData}
              onSave={handleSave}
              isSaving={saveDueDiligenceMutation.isPending}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="dscr" className="border rounded-lg" data-testid="accordion-dscr">
          <AccordionTrigger className="px-6 hover:no-underline">
            <span className="text-lg font-semibold">DSCR Calculator</span>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <DSCRCalculatorTool
              data={dueDiligenceData}
              onSave={handleSave}
              isSaving={saveDueDiligenceMutation.isPending}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="affordability" className="border rounded-lg" data-testid="accordion-affordability">
          <AccordionTrigger className="px-6 hover:no-underline">
            <span className="text-lg font-semibold">Affordability Estimator</span>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <AffordabilityEstimatorTool
              data={dueDiligenceData}
              onSave={handleSave}
              isSaving={saveDueDiligenceMutation.isPending}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="ratios" className="border rounded-lg" data-testid="accordion-ratios">
          <AccordionTrigger className="px-6 hover:no-underline">
            <span className="text-lg font-semibold">Financial Ratios Calculator</span>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <FinancialRatiosCalculatorTool
              data={dueDiligenceData}
              onSave={handleSave}
              isSaving={saveDueDiligenceMutation.isPending}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="character" className="border rounded-lg" data-testid="accordion-character">
          <AccordionTrigger className="px-6 hover:no-underline">
            <span className="text-lg font-semibold">Character Assessment</span>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <CharacterAssessmentTool
              data={dueDiligenceData}
              onSave={handleSave}
              isSaving={saveDueDiligenceMutation.isPending}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function SummaryTab({ prospect, contacts, activities }: { prospect: ProspectWithCompany; contacts: Contact[]; activities: Activity[] }) {
  const { user } = useAuth();
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
    }).format(amount / 100);
  };

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const { data: companyProfile, isLoading: isLoadingProfile } = useQuery<any>({
    queryKey: [`/api/companies-house/company/${prospect.company.companyNumber}`],
    enabled: !!prospect.company.companyNumber,
  });

  const { data: officers, isLoading: isLoadingOfficers } = useQuery<any>({
    queryKey: [`/api/companies-house/company/${prospect.company.companyNumber}/officers`],
    enabled: !!prospect.company.companyNumber,
  });

  const { data: pscData, isLoading: isLoadingPSC } = useQuery<any>({
    queryKey: [`/api/companies-house/company/${prospect.company.companyNumber}/persons-with-significant-control`],
    enabled: !!prospect.company.companyNumber,
  });

  const { data: chargesData, isLoading: isLoadingCharges } = useQuery<any>({
    queryKey: [`/api/companies-house/company/${prospect.company.companyNumber}/charges`],
    enabled: !!prospect.company.companyNumber,
  });

  const { data: dueDiligence } = useQuery<DueDiligence>({
    queryKey: [`/api/prospects/${prospect.id}/due-diligence`],
    enabled: prospect.id > 0,
  });

  const dueDiligenceData = (dueDiligence?.data || {}) as DueDiligenceData & { characterAssessment?: { notes?: string } };
  const completedActivities = activities.filter(a => a.completed).length;
  const savedAssociations = (prospect.savedAssociations || []) as any[];

  const handleDownloadReport = () => {
    window.open(`/api/prospects/${prospect.id}/report`, '_blank');
    toast.success("Generating comprehensive report...");
  };

  const activeOfficers = officers?.items?.filter((o: any) => !o.resigned_on) || [];
  const activePSC = pscData?.items?.filter((p: any) => !p.ceased_on) || [];
  const outstandingCharges = chargesData?.items?.filter((c: any) => c.status === 'outstanding') || [];

  const checklistProgress = () => {
    if (!dueDiligenceData.checklist || dueDiligenceData.checklist.length === 0) return null;
    const total = dueDiligenceData.checklist.length;
    const completed = dueDiligenceData.checklist.filter((item: any) => item.checked).length;
    return { total, completed, percentage: Math.round((completed / total) * 100) };
  };

  return (
    <div className="space-y-6">
      <Card data-testid="card-summary-header">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-2xl flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                Complete Application Summary
              </CardTitle>
              <CardDescription className="mt-2">
                Full overview of all prospect information, Companies House data, and due diligence
              </CardDescription>
            </div>
            <Button size="lg" onClick={handleDownloadReport} data-testid="button-download-summary-report">
              <FileDown className="h-5 w-5 mr-2" />
              Download Full Report
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Accordion type="multiple" defaultValue={["company", "loan", "diligence", "associations"]} className="space-y-4">
        <AccordionItem value="company" className="border rounded-lg" data-testid="accordion-summary-company">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-lg font-semibold">Companies House Information</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-muted/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Company Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Company Name:</span>
                      <span className="text-sm font-medium">{prospect.company.companyName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Company Number:</span>
                      <span className="text-sm font-mono font-medium">{prospect.company.companyNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      <Badge variant={prospect.company.companyStatus === "active" ? "default" : "secondary"}>
                        {prospect.company.companyStatus || "Active"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Company Type:</span>
                      <span className="text-sm font-medium">{prospect.company.companyType || "ltd"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Incorporated:</span>
                      <span className="text-sm font-medium">{formatDate(prospect.company.incorporationDate)}</span>
                    </div>
                    {prospect.company.registeredAddress && (
                      <div>
                        <span className="text-sm text-muted-foreground block mb-1">Registered Address:</span>
                        <span className="text-sm">{prospect.company.registeredAddress}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card className="bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span>Officers</span>
                        {isLoadingOfficers ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Badge variant="outline">{activeOfficers.length} Active</Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {activeOfficers.length > 0 ? (
                        <div className="space-y-2">
                          {activeOfficers.slice(0, 5).map((officer: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span className="font-medium">{officer.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {officer.officer_role?.replace(/-/g, ' ')}
                              </Badge>
                            </div>
                          ))}
                          {activeOfficers.length > 5 && (
                            <p className="text-xs text-muted-foreground">+{activeOfficers.length - 5} more officers</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No officers data available</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span>Persons with Significant Control</span>
                        {isLoadingPSC ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Badge variant="outline">{activePSC.length} Active</Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {activePSC.length > 0 ? (
                        <div className="space-y-2">
                          {activePSC.slice(0, 5).map((psc: any, idx: number) => (
                            <div key={idx} className="text-sm">
                              <span className="font-medium">{psc.name}</span>
                              {psc.natures_of_control && psc.natures_of_control.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {psc.natures_of_control[0]?.replace(/-/g, ' ')}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No PSC data available</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Card className="bg-muted/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Charges / Security Interests</span>
                    {isLoadingCharges ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Badge variant={outstandingCharges.length > 0 ? "destructive" : "outline"}>
                        {outstandingCharges.length} Outstanding
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {outstandingCharges.length > 0 ? (
                    <div className="space-y-2">
                      {outstandingCharges.map((charge: any, idx: number) => (
                        <div key={idx} className="text-sm border-l-2 border-amber-500 pl-3">
                          <span className="font-medium">{charge.persons_entitled?.[0]?.name || 'Unknown Lender'}</span>
                          <p className="text-xs text-muted-foreground">
                            Created: {formatDate(charge.created_on)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No outstanding charges</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="loan" className="border rounded-lg" data-testid="accordion-summary-loan">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                <PoundSterling className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-lg font-semibold">Loan Requirements</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Loan Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Current Stage:</span>
                    <Badge>{STAGES.find(s => s.value === prospect.stage)?.label}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Priority:</span>
                    <Badge variant={prospect.priority === 'high' ? 'destructive' : prospect.priority === 'medium' ? 'secondary' : 'outline'}>
                      {prospect.priority || 'Medium'} Priority
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Loan Amount:</span>
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">
                      {prospect.loanAmount ? formatCurrency(prospect.loanAmount) : "Not set"}
                    </span>
                  </div>
                  {prospect.term && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Term:</span>
                      <span className="text-sm font-medium">{prospect.term} months</span>
                    </div>
                  )}
                  {prospect.interestRate && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Interest Rate:</span>
                      <span className="text-sm font-medium">{prospect.interestRate}% APR</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Security & Collateral</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {prospect.directorsGuarantee && prospect.directorsGuarantee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Directors Guarantee:</span>
                      <span className="text-sm font-medium">{formatCurrency(prospect.directorsGuarantee)}</span>
                    </div>
                  )}
                  {prospect.commercialProperty && prospect.commercialProperty > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Commercial Property:</span>
                      <span className="text-sm font-medium">{formatCurrency(prospect.commercialProperty)}</span>
                    </div>
                  )}
                  {prospect.homeEquity && prospect.homeEquity > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Home Equity:</span>
                      <span className="text-sm font-medium">{formatCurrency(prospect.homeEquity)}</span>
                    </div>
                  )}
                  {prospect.debenture && prospect.debenture > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Debenture:</span>
                      <span className="text-sm font-medium">{formatCurrency(prospect.debenture)}</span>
                    </div>
                  )}
                  {prospect.collateral && prospect.collateral > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Other Collateral:</span>
                      <span className="text-sm font-medium">{formatCurrency(prospect.collateral)}</span>
                    </div>
                  )}
                  {!prospect.directorsGuarantee && !prospect.commercialProperty && !prospect.homeEquity && !prospect.debenture && !prospect.collateral && (
                    <p className="text-sm text-muted-foreground">No collateral specified</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {(prospect.loanRequirementNotes || prospect.notes) && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {prospect.loanRequirementNotes && (
                  <Card className="bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Loan Requirement Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap">{prospect.loanRequirementNotes}</p>
                    </CardContent>
                  </Card>
                )}
                {prospect.notes && (
                  <Card className="bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">General Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap">{prospect.notes}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="diligence" className="border rounded-lg" data-testid="accordion-summary-diligence">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <CheckSquare className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-lg font-semibold">Due Diligence</span>
              {user?.subscriptionTier === "free" && (
                <Badge variant="secondary" className="text-xs">View Only</Badge>
              )}
            </div>
          </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckSquare className="h-4 w-4" />
                      Checklist Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {checklistProgress() ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-2xl font-bold">{checklistProgress()!.percentage}%</span>
                          <span className="text-sm text-muted-foreground">
                            {checklistProgress()!.completed}/{checklistProgress()!.total} items
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 transition-all"
                            style={{ width: `${checklistProgress()!.percentage}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No checklist data</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      Loan Calculator
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dueDiligenceData.loanCalculator?.loanAmount ? (
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Principal:</span>
                          <span className="font-medium">{formatCurrency((dueDiligenceData.loanCalculator.loanAmount || 0) * 100)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Rate:</span>
                          <span className="font-medium">{dueDiligenceData.loanCalculator.interestRate}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Term:</span>
                          <span className="font-medium">{dueDiligenceData.loanCalculator.term} months</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not calculated</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      DSCR Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dueDiligenceData.dscr?.annualNetOperatingIncome ? (
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Net Operating Income:</span>
                          <span className="font-medium">{formatCurrency((dueDiligenceData.dscr.annualNetOperatingIncome || 0) * 100)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Debt Service:</span>
                          <span className="font-medium">{formatCurrency((dueDiligenceData.dscr.annualDebtService || 0) * 100)}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not calculated</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      Affordability
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dueDiligenceData.affordability?.personalIncome ? (
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Personal Income:</span>
                          <span className="font-medium">{formatCurrency((dueDiligenceData.affordability.personalIncome || 0) * 100)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Commitments:</span>
                          <span className="font-medium">{formatCurrency((dueDiligenceData.affordability.monthlyCommitments || 0) * 100)}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not calculated</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Financial Ratios
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dueDiligenceData.financialRatios?.revenue ? (
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Revenue:</span>
                          <span className="font-medium">{formatCurrency((dueDiligenceData.financialRatios.revenue || 0) * 100)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Current Assets:</span>
                          <span className="font-medium">{formatCurrency((dueDiligenceData.financialRatios.currentAssets || 0) * 100)}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not calculated</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Character Assessment
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dueDiligenceData.characterAssessment?.notes ? (
                      <p className="text-sm line-clamp-3">{dueDiligenceData.characterAssessment.notes}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not assessed</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </AccordionContent>
          </AccordionItem>

        <AccordionItem value="associations" className="border rounded-lg" data-testid="accordion-summary-associations">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Network className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="text-lg font-semibold">Associations & Media</span>
              {savedAssociations.length > 0 && (
                <Badge variant="secondary">{savedAssociations.length} saved</Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            {savedAssociations.length > 0 ? (
              <div className="space-y-4">
                {['officer', 'psc', 'address'].map((type) => {
                  const typeAssociations = savedAssociations.filter((a: any) => a.associationType === type);
                  if (typeAssociations.length === 0) return null;
                  
                  const typeLabels: { [key: string]: string } = {
                    officer: 'Common Directors',
                    psc: 'Common Ownership',
                    address: 'Same Registered Address'
                  };

                  return (
                    <Card key={type} className="bg-muted/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{typeLabels[type]} ({typeAssociations.length})</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {typeAssociations.map((company: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-sm border-l-2 border-purple-500 pl-3">
                              <div>
                                <span className="font-medium">{company.company_name}</span>
                                <span className="text-muted-foreground ml-2 font-mono text-xs">({company.company_number})</span>
                              </div>
                              <Badge variant="outline" className="text-xs">{company.company_status}</Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Network className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No Saved Associations</h3>
                <p className="text-sm text-muted-foreground">
                  Use the Associations & Media tab to find and save related companies
                </p>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="contacts" className="border rounded-lg" data-testid="accordion-summary-contacts">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <span className="text-lg font-semibold">Contacts & Activity</span>
              <Badge variant="secondary">{contacts.length} contacts</Badge>
              <Badge variant="secondary">{activities.length} tasks</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-muted/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Key Contacts</CardTitle>
                </CardHeader>
                <CardContent>
                  {contacts.length > 0 ? (
                    <div className="space-y-3">
                      {contacts.map((contact, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{contact.name}</span>
                              {contact.isPrimary === 1 && <Badge variant="default" className="text-xs">Primary</Badge>}
                            </div>
                            {contact.role && <p className="text-xs text-muted-foreground">{contact.role}</p>}
                            {contact.email && <p className="text-xs text-muted-foreground">{contact.email}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No contacts added</p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-muted/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Activity Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Tasks:</span>
                      <span className="text-sm font-medium">{activities.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Completed:</span>
                      <span className="text-sm font-medium text-green-600">{completedActivities}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Pending:</span>
                      <span className="text-sm font-medium text-amber-600">{activities.length - completedActivities}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden mt-2">
                      <div 
                        className="h-full bg-green-500 transition-all"
                        style={{ width: activities.length > 0 ? `${(completedActivities / activities.length) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function CompanyInformationTab({ companyNumber }: { companyNumber: string }) {
  const { data: companyProfile, isLoading, error } = useQuery<CompanyProfile>({
    queryKey: [`/api/companies-house/company/${companyNumber}`],
    enabled: !!companyNumber,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">Loading company information...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Failed to Load Company Information</h3>
            <p className="text-sm text-muted-foreground">
              {(error as Error).message || "An error occurred while fetching company data from Companies House"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!companyProfile) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No Company Data Available</h3>
            <p className="text-sm text-muted-foreground">
              Company information could not be found for company number: {companyNumber}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return <CompanyInformation companyProfile={companyProfile} />;
}

function AssociationsMediaTab({ prospect }: { prospect: ProspectWithCompany }) {
  const [isLoadingAssociations, setIsLoadingAssociations] = useState(false);
  const [associatedCompanies, setAssociatedCompanies] = useState<any>(null);
  const [isLoadingWebSearch, setIsLoadingWebSearch] = useState(false);
  const [webSearchResults, setWebSearchResults] = useState<any>(null);
  const [selectedAssociations, setSelectedAssociations] = useState<any[]>([]);
  const [isSavingAssociations, setIsSavingAssociations] = useState(false);
  const savedAssociations = (prospect as any).savedAssociations || [];

  const loadAssociatedCompanies = async () => {
    setIsLoadingAssociations(true);
    try {
      const response = await fetch(`/api/prospects/${prospect.id}/associated-companies`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error(await response.text());
      }
      
      const data = await response.json();
      setAssociatedCompanies(data);
    } catch (error: any) {
      toast.error(`Failed to load associated companies: ${error.message}`);
    } finally {
      setIsLoadingAssociations(false);
    }
  };

  const toggleAssociation = (company: any, type: string) => {
    const association = { ...company, associationType: type };
    const key = `${company.company_number}-${type}`;
    
    setSelectedAssociations(prev => {
      const exists = prev.find(a => `${a.company_number}-${a.associationType}` === key);
      if (exists) {
        return prev.filter(a => `${a.company_number}-${a.associationType}` !== key);
      } else {
        return [...prev, association];
      }
    });
  };

  const isSelected = (companyNumber: string, type: string) => {
    const key = `${companyNumber}-${type}`;
    return selectedAssociations.some(a => `${a.company_number}-${a.associationType}` === key);
  };

  const saveSelectedAssociations = async () => {
    if (selectedAssociations.length === 0) {
      toast.error("Please select at least one company to save");
      return;
    }

    setIsSavingAssociations(true);
    try {
      await apiRequest(`/api/prospects/${prospect.id}/save-associations`, "POST", {
        associations: selectedAssociations
      });
      
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospect.id}`] });
      toast.success(`Saved ${selectedAssociations.length} association(s)`);
      setSelectedAssociations([]);
    } catch (error: any) {
      toast.error(`Failed to save associations: ${error.message}`);
    } finally {
      setIsSavingAssociations(false);
    }
  };

  const performWebSearch = async () => {
    setIsLoadingWebSearch(true);
    try {
      const response = await apiRequest(`/api/prospects/${prospect.id}/web-search`, "POST", {});
      const data = await response.json();
      console.log("Web search data:", data);
      console.log("Results array:", data?.results);
      console.log("Answer:", data?.answer);
      setWebSearchResults(data);
    } catch (error: any) {
      console.error("Web search error:", error);
      toast.error(`Failed to search web: ${error.message}`);
    } finally {
      setIsLoadingWebSearch(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Associated Companies Section */}
      <Card data-testid="card-associations">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                Associated Companies
              </CardTitle>
              <CardDescription>
                Find companies linked through common directors, ownership, or registered address
              </CardDescription>
            </div>
            <Button
              onClick={loadAssociatedCompanies}
              disabled={isLoadingAssociations}
              data-testid="button-find-associations"
            >
              {isLoadingAssociations && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Find Associations
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Saved Associations */}
          {savedAssociations.length > 0 && (
            <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Network className="h-4 w-4" />
                Saved Associations ({savedAssociations.length})
              </h3>
              <div className="space-y-2">
                {savedAssociations.map((company: any, index: number) => (
                  <Card key={index} className="bg-background" data-testid={`card-saved-association-${index}`}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-sm">{company.company_name}</h4>
                            <Badge variant="outline" className="text-xs">{company.company_number}</Badge>
                            {company.company_status && (
                              <Badge variant="secondary" className="text-xs">{company.company_status}</Badge>
                            )}
                            <Badge className="text-xs capitalize">{company.associationType}</Badge>
                          </div>
                          {company.officer_name && (
                            <p className="text-xs text-muted-foreground">Director: {company.officer_name}</p>
                          )}
                          {company.psc_name && (
                            <p className="text-xs text-muted-foreground">PSC: {company.psc_name}</p>
                          )}
                        </div>
                        <a
                          href={`https://find-and-update.company-information.service.gov.uk/company/${company.company_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="icon" data-testid={`button-view-saved-${index}`}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {isLoadingAssociations && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">Searching Companies House...</p>
              </div>
            </div>
          )}

          {!isLoadingAssociations && associatedCompanies && (
            <div className="space-y-6">
              {/* Save Selected Button */}
              {(associatedCompanies.officers.length > 0 || associatedCompanies.psc.length > 0 || associatedCompanies.sameAddress.length > 0) && (
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm">
                    {selectedAssociations.length > 0 ? (
                      <span className="font-medium">{selectedAssociations.length} company/companies selected</span>
                    ) : (
                      <span className="text-muted-foreground">Select companies to save to this prospect</span>
                    )}
                  </div>
                  <Button
                    onClick={saveSelectedAssociations}
                    disabled={selectedAssociations.length === 0 || isSavingAssociations}
                    data-testid="button-save-associations"
                  >
                    {isSavingAssociations && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Selected ({selectedAssociations.length})
                  </Button>
                </div>
              )}

              {/* Companies via Common Officers */}
              {associatedCompanies.officers.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Companies with Common Directors ({associatedCompanies.officers.length})</h3>
                  <div className="space-y-2">
                    {associatedCompanies.officers.map((company: any, index: number) => (
                      <Card key={index} className="hover-elevate" data-testid={`card-officer-company-${index}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <Checkbox
                              checked={isSelected(company.company_number, 'officer')}
                              onCheckedChange={() => toggleAssociation(company, 'officer')}
                              data-testid={`checkbox-officer-${index}`}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{company.company_name}</h4>
                                <Badge variant="outline" className="text-xs">{company.company_number}</Badge>
                                {company.company_status && (
                                  <Badge variant="secondary" className="text-xs">{company.company_status}</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Common Director: <span className="font-medium">{company.officer_name}</span>
                                {company.officer_role && ` (${company.officer_role})`}
                              </p>
                              {company.appointed_on && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Appointed: {new Date(company.appointed_on).toLocaleDateString("en-GB")}
                                </p>
                              )}
                            </div>
                            <a
                              href={`https://find-and-update.company-information.service.gov.uk/company/${company.company_number}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button variant="ghost" size="icon" data-testid={`button-view-officer-company-${index}`}>
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </a>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Companies via Common PSC */}
              {associatedCompanies.psc.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Companies with Common Ownership ({associatedCompanies.psc.length})</h3>
                  <div className="space-y-2">
                    {associatedCompanies.psc.map((company: any, index: number) => (
                      <Card key={index} className="hover-elevate" data-testid={`card-psc-company-${index}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <Checkbox
                              checked={isSelected(company.company_number, 'psc')}
                              onCheckedChange={() => toggleAssociation(company, 'psc')}
                              data-testid={`checkbox-psc-${index}`}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{company.company_name}</h4>
                                <Badge variant="outline" className="text-xs">{company.company_number}</Badge>
                                {company.company_status && (
                                  <Badge variant="secondary" className="text-xs">{company.company_status}</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Common PSC: <span className="font-medium">{company.psc_name}</span>
                              </p>
                              {company.address_snippet && (
                                <p className="text-xs text-muted-foreground mt-1">{company.address_snippet}</p>
                              )}
                            </div>
                            <a
                              href={`https://find-and-update.company-information.service.gov.uk/company/${company.company_number}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button variant="ghost" size="icon" data-testid={`button-view-psc-company-${index}`}>
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </a>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Companies at Same Address */}
              {associatedCompanies.sameAddress.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Companies at Same Registered Address ({associatedCompanies.sameAddress.length})</h3>
                  <div className="space-y-2">
                    {associatedCompanies.sameAddress.map((company: any, index: number) => (
                      <Card key={index} className="hover-elevate" data-testid={`card-address-company-${index}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <Checkbox
                              checked={isSelected(company.company_number, 'address')}
                              onCheckedChange={() => toggleAssociation(company, 'address')}
                              data-testid={`checkbox-address-${index}`}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{company.company_name}</h4>
                                <Badge variant="outline" className="text-xs">{company.company_number}</Badge>
                                {company.company_status && (
                                  <Badge variant="secondary" className="text-xs">{company.company_status}</Badge>
                                )}
                              </div>
                              {company.address_snippet && (
                                <p className="text-sm text-muted-foreground">{company.address_snippet}</p>
                              )}
                            </div>
                            <a
                              href={`https://find-and-update.company-information.service.gov.uk/company/${company.company_number}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button variant="ghost" size="icon" data-testid={`button-view-address-company-${index}`}>
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </a>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {associatedCompanies.officers.length === 0 && 
               associatedCompanies.psc.length === 0 && 
               associatedCompanies.sameAddress.length === 0 && (
                <div className="text-center py-8">
                  <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">No Associated Companies Found</h3>
                  <p className="text-sm text-muted-foreground">
                    No companies found with common directors, ownership, or registered address.
                  </p>
                </div>
              )}
            </div>
          )}

          {!isLoadingAssociations && !associatedCompanies && (
            <div className="text-center py-8">
              <Network className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Find Associated Companies</h3>
              <p className="text-sm text-muted-foreground">
                Click "Find Associations" to search for companies linked to {prospect.company.companyName}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Web Search Section */}
      <Card data-testid="card-web-search">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                AI Web Search
              </CardTitle>
              <CardDescription>
                Search the web for news, information, and media coverage about {prospect.company.companyName}
              </CardDescription>
            </div>
            <Button
              onClick={performWebSearch}
              disabled={isLoadingWebSearch}
              data-testid="button-web-search"
            >
              {isLoadingWebSearch && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Search Web
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingWebSearch && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">Searching the web with AI...</p>
              </div>
            </div>
          )}

          {!isLoadingWebSearch && webSearchResults && (
            <div className="space-y-6">
              {/* AI Summary */}
              {webSearchResults.answer && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    AI Summary
                  </h3>
                  <p className="text-sm whitespace-pre-wrap" data-testid="text-ai-summary">
                    {webSearchResults.answer}
                  </p>
                </div>
              )}

              {/* Search Results */}
              {webSearchResults.results && webSearchResults.results.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Web Results ({webSearchResults.results.length})</h3>
                  <div className="space-y-3">
                    {webSearchResults.results.map((result: any, index: number) => (
                      <Card key={index} className="hover-elevate" data-testid={`card-search-result-${index}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <a
                                href={result.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium hover:underline text-primary"
                              >
                                {result.title}
                              </a>
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {result.content}
                              </p>
                              <p className="text-xs text-muted-foreground mt-2">
                                {new URL(result.url).hostname} • Score: {result.score?.toFixed(2) || 'N/A'}
                              </p>
                            </div>
                            <a
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button variant="ghost" size="icon" data-testid={`button-view-result-${index}`}>
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </a>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {(!webSearchResults.results || webSearchResults.results.length === 0) && (
                <div className="text-center py-8">
                  <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">No Results Found</h3>
                  <p className="text-sm text-muted-foreground">
                    No web results found for {prospect.company.companyName}
                  </p>
                </div>
              )}
            </div>
          )}

          {!isLoadingWebSearch && !webSearchResults && (
            <div className="text-center py-8">
              <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Search the Web</h3>
              <p className="text-sm text-muted-foreground">
                Click "Search Web" to find news and information about {prospect.company.companyName}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
