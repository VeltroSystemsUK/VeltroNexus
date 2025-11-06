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
  Mail, Phone, User, Plus, Trash2, Edit2, Save, X, AlertCircle
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
    mutationFn: () => apiRequest("DELETE", `/api/prospects/${prospectId}`),
    onSuccess: () => {
      toast.success("Prospect deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/prospects"] });
      navigate("/");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete prospect: ${error.message}`);
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
          <TabsList className={`grid w-full ${user?.subscriptionTier === "free" ? "grid-cols-5" : "grid-cols-6"} mb-8`}>
            <TabsTrigger value="contacts" data-testid="tab-contacts">Contacts</TabsTrigger>
            <TabsTrigger value="company" data-testid="tab-company">Company Info</TabsTrigger>
            <TabsTrigger value="loan" data-testid="tab-loan">Loan Requirement</TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">Sales Activity</TabsTrigger>
            {user?.subscriptionTier !== "free" && (
              <TabsTrigger value="diligence" data-testid="tab-diligence">Due Diligence</TabsTrigger>
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
      apiRequest("PATCH", `/api/prospects/${prospect.id}`, { priority: newPriority }),
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
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
    }).format(amount / 100);
  };

  const completedActivities = activities.filter(a => a.completed).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>Overview of all prospect information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-3">Prospect Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stage:</span>
                  <span className="font-medium">{STAGES.find(s => s.value === prospect.stage)?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Loan Amount:</span>
                  <span className="font-medium">{prospect.loanAmount ? formatCurrency(prospect.loanAmount) : "Not set"}</span>
                </div>
                {prospect.term && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Term:</span>
                    <span className="font-medium">{prospect.term} months</span>
                  </div>
                )}
                {prospect.interestRate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Interest Rate:</span>
                    <span className="font-medium">{prospect.interestRate}% APR</span>
                  </div>
                )}
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-3">Activity</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Contacts:</span>
                  <span className="font-medium">{contacts.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Tasks:</span>
                  <span className="font-medium">{activities.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed Tasks:</span>
                  <span className="font-medium">{completedActivities}</span>
                </div>
              </div>
            </div>
          </div>

          {prospect.notes && (
            <div>
              <h3 className="font-semibold mb-2">General Notes</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{prospect.notes}</p>
            </div>
          )}

          {prospect.loanRequirementNotes && (
            <div>
              <h3 className="font-semibold mb-2">Loan Requirement Notes</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{prospect.loanRequirementNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>
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
