import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Search,
  Building2,
  ExternalLink,
  Plus,
  Trash2,
  Check,
  X,
  RefreshCw,
  FileText,
  Phone,
  Mail,
  MapPin,
  User,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import type { Lead } from "@shared/schema";
import logoChrome from "@assets/logo-chrome.png";
import ThemeToggle from "@/components/ThemeToggle";
import { ArrowLeft } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-gray-500/10 text-gray-700 dark:text-gray-300",
  matched: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  prospect_created: "bg-green-500/10 text-green-700 dark:text-green-300",
  ignored: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  matched: "Matched",
  prospect_created: "Added to Pipeline",
  ignored: "Ignored",
};

export default function Leads() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showCompanySearchDialog, setShowCompanySearchDialog] = useState(false);
  const [companiesHouseResults, setCompaniesHouseResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { data: leads, isLoading } = useQuery<Lead[]>({
    queryKey: [
      "/api/leads",
      { search: searchTerm, matchStatus: statusFilter !== "all" ? statusFilter : undefined },
    ],
    refetchInterval: 30000,
  });

  const { data: uploads } = useQuery<any[]>({
    queryKey: ["/api/leads/uploads"],
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/leads/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: "Lead Deleted",
        description: "The lead has been removed.",
      });
    },
  });

  const ignoreLeadMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/leads/${id}`, "PATCH", { matchStatus: "ignored" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: "Lead Ignored",
        description: "The lead has been marked as ignored.",
      });
    },
  });

  const createProspectMutation = useMutation({
    mutationFn: async ({ leadId, companyNumber, companyName, companyData }: any) => {
      const response = await apiRequest(`/api/leads/${leadId}/prospects`, "POST", {
        companyNumber,
        companyName,
        companyData,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prospects"] });
      setShowCompanySearchDialog(false);
      setSelectedLead(null);
      toast({
        title: "Prospect Created",
        description: "The lead has been added to your pipeline.",
      });
      setLocation(`/prospect/${data.prospect.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create prospect",
        variant: "destructive",
      });
    },
  });

  const handleSearchCompaniesHouse = async (lead: Lead) => {
    setSelectedLead(lead);
    setShowCompanySearchDialog(true);
    setIsSearching(true);
    setCompaniesHouseResults([]);

    try {
      const searchQuery = lead.companyNumber || lead.companyName;
      const response = await fetch(
        `/api/companies-house/search?q=${encodeURIComponent(searchQuery)}`
      );
      if (response.ok) {
        const data = await response.json();
        setCompaniesHouseResults(data.items || []);
      }
    } catch (error) {
      console.error("Error searching Companies House:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectCompany = async (company: any) => {
    if (!selectedLead) return;

    try {
      const profileResponse = await fetch(`/api/companies-house/company/${company.company_number}`);
      const companyData = profileResponse.ok ? await profileResponse.json() : null;

      createProspectMutation.mutate({
        leadId: selectedLead.id,
        companyNumber: company.company_number,
        companyName: company.title,
        companyData,
      });
    } catch (error) {
      createProspectMutation.mutate({
        leadId: selectedLead.id,
        companyNumber: company.company_number,
        companyName: company.title,
        companyData: null,
      });
    }
  };

  const filteredLeads =
    leads?.filter((lead) => {
      const matchesSearch =
        !searchTerm ||
        lead.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.companyNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.contactName?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "all" || lead.matchStatus === statusFilter;

      return matchesSearch && matchesStatus;
    }) || [];

  const stats = {
    total: leads?.length || 0,
    pending: leads?.filter((l) => l.matchStatus === "pending").length || 0,
    added: leads?.filter((l) => l.matchStatus === "prospect_created").length || 0,
    ignored: leads?.filter((l) => l.matchStatus === "ignored").length || 0,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" data-testid="loader-leads" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
        <div>
          <span className="kicker">Sales</span>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight mt-1">
            Prospect directory
          </h1>
        </div>
        <Tabs defaultValue="directory" className="space-y-6">
          <TabsList className="bg-muted/50 border border-border">
            <TabsTrigger value="directory" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <User className="w-4 h-4 mr-2" />
              Prospect Directory
            </TabsTrigger>
            <TabsTrigger value="find" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Search className="w-4 h-4 mr-2" />
              Find Prospects
            </TabsTrigger>
          </TabsList>

          <TabsContent value="directory" className="space-y-6 mt-0">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-leads-title">
              Leads
            </h1>
            <p className="text-muted-foreground">Imported company leads ready for prospecting</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild data-testid="button-import-more">
              <Link href="/settings">
                <Plus className="h-4 w-4 mr-2" />
                Import More
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total Leads</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-gray-600">{stats.pending}</div>
              <div className="text-sm text-muted-foreground">Pending Review</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{stats.added}</div>
              <div className="text-sm text-muted-foreground">Added to Pipeline</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-600">{stats.ignored}</div>
              <div className="text-sm text-muted-foreground">Ignored</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle>All Leads</CardTitle>
                <CardDescription>
                  Click a lead to search Companies House and add to your pipeline
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search leads..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-64"
                    data-testid="input-search-leads"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40" data-testid="select-status-filter">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="matched">Matched</SelectItem>
                    <SelectItem value="prospect_created">Added</SelectItem>
                    <SelectItem value="ignored">Ignored</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredLeads.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Leads Found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || statusFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : "Upload a CSV file in Settings to import leads"}
                </p>
                <Button asChild>
                  <Link href="/settings">Import Leads</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                    data-testid={`lead-${lead.id}`}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        <Building2 className="h-10 w-10 text-muted-foreground p-2 rounded-lg bg-muted" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium truncate" data-testid={`lead-name-${lead.id}`}>
                            {lead.companyName}
                          </h4>
                          <Badge className={statusColors[lead.matchStatus] || statusColors.pending}>
                            {statusLabels[lead.matchStatus] || "Pending"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap mt-1">
                          {lead.companyNumber && (
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {lead.companyNumber}
                            </span>
                          )}
                          {lead.contactName && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {lead.contactName}
                            </span>
                          )}
                          {lead.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {lead.email}
                            </span>
                          )}
                          {lead.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {lead.phone}
                            </span>
                          )}
                          {lead.postcode && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {lead.postcode}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {lead.matchStatus === "pending" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleSearchCompaniesHouse(lead)}
                            data-testid={`button-search-${lead.id}`}
                          >
                            <Search className="h-4 w-4 mr-2" />
                            Search & Add
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => ignoreLeadMutation.mutate(lead.id)}
                            data-testid={`button-ignore-${lead.id}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {lead.matchStatus === "prospect_created" && lead.linkedProspectId && (
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/prospect/${lead.linkedProspectId}`}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Prospect
                          </Link>
                        </Button>
                      )}
                      {lead.matchStatus === "ignored" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSearchCompaniesHouse(lead)}
                          data-testid={`button-reconsider-${lead.id}`}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Reconsider
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteLeadMutation.mutate(lead.id)}
                        disabled={deleteLeadMutation.isPending}
                        data-testid={`button-delete-${lead.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showCompanySearchDialog} onOpenChange={setShowCompanySearchDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Retrieve Data</DialogTitle>
              <DialogDescription>
                {selectedLead && (
                  <>Searching for "{selectedLead.companyNumber || selectedLead.companyName}"</>
                )}
              </DialogDescription>
            </DialogHeader>

            {isSearching ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : companiesHouseResults.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No companies found matching your search.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Try searching with a different term on the main search page.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {companiesHouseResults.map((company) => (
                  <div
                    key={company.company_number}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleSelectCompany(company)}
                    data-testid={`ch-result-${company.company_number}`}
                  >
                    <div>
                      <h4 className="font-medium">{company.title}</h4>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span>{company.company_number}</span>
                        {company.company_status && (
                          <Badge variant="outline" className="capitalize">
                            {company.company_status}
                          </Badge>
                        )}
                      </div>
                      {company.address_snippet && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {company.address_snippet}
                        </p>
                      )}
                    </div>
                    <Button size="sm" disabled={createProspectMutation.isPending}>
                      {createProspectMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Add
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCompanySearchDialog(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
          </TabsContent>

          {/* NOTE: the "find" tab content was lost when this file was truncated
              during the local-SQL migration; re-add a <TabsContent value="find">
              block here to restore the Find Prospects tab. */}
          <TabsContent value="find" className="space-y-6 mt-0">
            <div className="tile p-8 text-center text-muted-foreground">
              Find Prospects — coming back shortly.
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
