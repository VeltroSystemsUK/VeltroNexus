import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { ArrowLeft, Building2, TrendingUp, Search, MapPin, Users, Hash, Briefcase, UserSearch, PenLine, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import ThemeToggle from "@/components/ThemeToggle";

interface CompanySearchResult {
  title: string;
  company_number: string;
  company_status: string;
  company_type: string;
  address_snippet?: string;
  address?: {
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    postal_code?: string;
  };
  date_of_creation?: string;
  sic_codes?: string[];
}

interface OfficerSearchResult {
  title: string;
  address_snippet?: string;
  date_of_birth?: {
    month: number;
    year: number;
  };
  appointed_to?: {
    company_number: string;
    company_name: string;
    company_status: string;
  };
  links?: {
    self: string;
  };
}

interface OfficerAppointment {
  appointed_to: {
    company_name: string;
    company_number: string;
    company_status: string;
  };
  officer_role: string;
  appointed_on?: string;
  resigned_on?: string;
}

type SearchType = "company" | "sic" | "location" | "postcode" | "officers";

const COMPANY_TYPES = [
  { value: "ltd", label: "Limited Company (Ltd)" },
  { value: "plc", label: "Public Limited Company (PLC)" },
  { value: "llp", label: "Limited Liability Partnership (LLP)" },
  { value: "partnership", label: "Partnership" },
  { value: "sole-trader", label: "Sole Trader" },
  { value: "cic", label: "Community Interest Company (CIC)" },
];

const NON_REGISTERED_TYPES = ["partnership", "sole-trader"];

export default function CompanySearch() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"search" | "manual">("search");
  
  // Search state
  const [searchType, setSearchType] = useState<SearchType>("company");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<CompanySearchResult | null>(null);
  const [selectedOfficer, setSelectedOfficer] = useState<OfficerSearchResult | null>(null);
  const [officerAppointments, setOfficerAppointments] = useState<OfficerAppointment[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);
  
  // Search filters
  const [hideDissolvedCompanies, setHideDissolvedCompanies] = useState(true);
  const [searchLimit, setSearchLimit] = useState<string>("50");
  
  // Form state (shared between search selection and manual entry)
  const [companyName, setCompanyName] = useState("");
  const [companyNumber, setCompanyNumber] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [registeredAddress, setRegisteredAddress] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [priority, setPriority] = useState<string>("");
  const [notes, setNotes] = useState("");

  // Company search query
  const { data: companyResults, refetch: searchCompanies, isFetching: isSearchingCompanies } = useQuery<{ items: CompanySearchResult[] }>({
    queryKey: ["/api/companies-house/search", searchQuery, searchType, hideDissolvedCompanies, searchLimit],
    queryFn: async () => {
      const limit = parseInt(searchLimit) || 50;
      const activeOnly = hideDissolvedCompanies ? "&active_only=true" : "";
      
      let url = `/api/companies-house/search?q=${encodeURIComponent(searchQuery)}&limit=${limit}${activeOnly}`;
      
      // Add search type specific parameters
      if (searchType === "sic") {
        url = `/api/companies-house/advanced-search?sic_codes=${encodeURIComponent(searchQuery)}&limit=${limit}${activeOnly}`;
      } else if (searchType === "location") {
        url = `/api/companies-house/advanced-search?location=${encodeURIComponent(searchQuery)}&limit=${limit}${activeOnly}`;
      } else if (searchType === "postcode") {
        url = `/api/companies-house/advanced-search?postcode=${encodeURIComponent(searchQuery)}&limit=${limit}${activeOnly}`;
      }
      
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || response.statusText);
      }
      return response.json();
    },
    enabled: false,
  });

  // Officers search query
  const { data: officerResults, refetch: searchOfficers, isFetching: isSearchingOfficers } = useQuery<{ items: OfficerSearchResult[] }>({
    queryKey: ["/api/companies-house/search-officers", searchQuery],
    queryFn: async () => {
      const response = await fetch(
        `/api/companies-house/search-officers?q=${encodeURIComponent(searchQuery)}`,
        { credentials: "include" }
      );
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || response.statusText);
      }
      return response.json();
    },
    enabled: false,
  });

  const createProspectMutation = useMutation({
    mutationFn: async (data: {
      companyName: string;
      companyNumber: string;
      companyType?: string;
      registeredAddress?: string;
      loanAmount?: number;
      priority?: string;
      notes?: string;
    }) => {
      // For non-registered types, generate a unique identifier using crypto
      const generateUniqueId = () => {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 10);
        return `UNREG-${timestamp}-${random}`.toUpperCase();
      };
      
      const finalCompanyNumber = NON_REGISTERED_TYPES.includes(data.companyType || "") 
        ? generateUniqueId()
        : data.companyNumber;

      // First create or get the company
      const company = await api.companies.create({
        companyName: data.companyName,
        companyNumber: finalCompanyNumber,
        registeredAddress: data.registeredAddress || null,
        incorporationDate: null,
        companyStatus: null,
        companyType: data.companyType || null,
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      toast.error("Please enter a search term");
      return;
    }
    
    try {
      if (searchType === "officers") {
        await searchOfficers();
      } else {
        await searchCompanies();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Search failed");
    }
  };

  const handleSelectCompany = (company: CompanySearchResult) => {
    setSelectedCompany(company);
    setCompanyName(company.title);
    setCompanyNumber(company.company_number);
    setCompanyType(company.company_type || "ltd");
    
    // Build address string
    if (company.address) {
      const addressParts = [
        company.address.address_line_1,
        company.address.address_line_2,
        company.address.locality,
        company.address.postal_code,
      ].filter(Boolean);
      setRegisteredAddress(addressParts.join(", "));
    } else if (company.address_snippet) {
      setRegisteredAddress(company.address_snippet);
    }
    
    toast.success("Company details populated");
  };

  const handleSelectOfficer = async (officer: OfficerSearchResult) => {
    // Extract officer ID from the links.self path
    const officerLink = officer.links?.self;
    if (!officerLink) {
      toast.error("Unable to fetch director's companies");
      return;
    }
    
    // Extract officer ID from path like /officers/abc123/appointments
    const officerIdMatch = officerLink.match(/\/officers\/([^\/]+)/);
    const officerId = officerIdMatch ? officerIdMatch[1] : null;
    
    if (!officerId) {
      toast.error("Unable to identify officer");
      return;
    }
    
    setSelectedOfficer(officer);
    setIsLoadingAppointments(true);
    setOfficerAppointments([]);
    
    try {
      const response = await fetch(
        `/api/companies-house/officer-appointments?officer_id=${encodeURIComponent(officerId)}`,
        { credentials: "include" }
      );
      
      if (response.ok) {
        const data = await response.json();
        // Filter to only show active appointments (no resigned_on date)
        const activeAppointments = (data.items || []).filter(
          (apt: OfficerAppointment) => !apt.resigned_on
        );
        setOfficerAppointments(activeAppointments);
        
        if (activeAppointments.length === 0) {
          toast.info("No active directorships found for this person");
        }
      } else {
        toast.error("Failed to fetch director's companies");
      }
    } catch {
      toast.error("Failed to fetch director's companies");
    } finally {
      setIsLoadingAppointments(false);
    }
  };
  
  const handleSelectAppointmentCompany = async (appointment: OfficerAppointment) => {
    // Fetch the company details
    try {
      const response = await fetch(
        `/api/companies-house/company/${appointment.appointed_to.company_number}`,
        { credentials: "include" }
      );
      if (response.ok) {
        const company = await response.json();
        handleSelectCompany({
          title: company.company_name,
          company_number: company.company_number,
          company_status: company.company_status,
          company_type: company.type,
          address: company.registered_office_address,
        });
        // Clear officer selection state
        setSelectedOfficer(null);
        setOfficerAppointments([]);
      } else {
        toast.error("Failed to fetch company details");
      }
    } catch {
      toast.error("Failed to fetch company details");
    }
  };
  
  const clearOfficerSelection = () => {
    setSelectedOfficer(null);
    setOfficerAppointments([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName.trim()) {
      toast.error("Company/Business name is required");
      return;
    }

    // Company number only required for registered types
    const isUnregistered = NON_REGISTERED_TYPES.includes(companyType);
    if (!isUnregistered && !companyNumber.trim()) {
      toast.error("Company number is required for this business type");
      return;
    }

    createProspectMutation.mutate({
      companyName: companyName.trim(),
      companyNumber: companyNumber.trim(),
      companyType: companyType || undefined,
      registeredAddress: registeredAddress.trim() || undefined,
      loanAmount: loanAmount ? parseInt(loanAmount) * 100 : undefined,
      priority: priority || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const resetForm = () => {
    setSelectedCompany(null);
    setSelectedOfficer(null);
    setOfficerAppointments([]);
    setCompanyName("");
    setCompanyNumber("");
    setCompanyType("");
    setRegisteredAddress("");
    setLoanAmount("");
    setPriority("");
    setNotes("");
  };

  const getSearchPlaceholder = () => {
    switch (searchType) {
      case "company": return "Enter company name or number...";
      case "sic": return "Enter SIC code (e.g., 62020, 47110)...";
      case "location": return "Enter town or city (e.g., Manchester, Leeds)...";
      case "postcode": return "Enter postcode area (e.g., SW1A, M1, B15)...";
      case "officers": return "Enter director/officer name...";
      default: return "Search...";
    }
  };

  const getSearchHint = () => {
    switch (searchType) {
      case "sic": return "Enter a SIC code to find companies in that industry";
      case "location": return "Search for companies by town or city name";
      case "postcode": return "Enter a postcode to find companies in that area";
      case "officers": return "Search by name, then click to see their companies";
      default: return null;
    }
  };

  const getSearchLabel = () => {
    switch (searchType) {
      case "company": return "Company Name/Number";
      case "sic": return "SIC Code";
      case "location": return "Town/City";
      case "postcode": return "Postcode";
      case "officers": return "Director/Officer Name";
      default: return "Search";
    }
  };

  const isUnregisteredType = NON_REGISTERED_TYPES.includes(companyType);
  const isFetching = isSearchingCompanies || isSearchingOfficers;

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
              <h1 className="text-xl font-bold">FlowLoan - Add Prospect</h1>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as "search" | "manual"); resetForm(); }}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="search" data-testid="tab-search" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Search Companies House
            </TabsTrigger>
            <TabsTrigger value="manual" data-testid="tab-manual" className="flex items-center gap-2">
              <PenLine className="h-4 w-4" />
              Add Manually
            </TabsTrigger>
          </TabsList>

          {/* SEARCH TAB */}
          <TabsContent value="search" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <Search className="h-6 w-6 text-primary" />
                  <CardTitle>Search Companies House</CardTitle>
                </div>
                <CardDescription>
                  Search UK registered companies by name, SIC code, location, postcode, or director name
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search Type Selector */}
                <div className="grid grid-cols-5 gap-2">
                  <Button
                    type="button"
                    variant={searchType === "company" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setSearchType("company"); setSearchQuery(""); }}
                    className="flex flex-col items-center gap-1 h-auto py-2"
                    data-testid="search-type-company"
                  >
                    <Building2 className="h-4 w-4" />
                    <span className="text-xs">Company</span>
                  </Button>
                  <Button
                    type="button"
                    variant={searchType === "sic" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setSearchType("sic"); setSearchQuery(""); }}
                    className="flex flex-col items-center gap-1 h-auto py-2"
                    data-testid="search-type-sic"
                  >
                    <Hash className="h-4 w-4" />
                    <span className="text-xs">SIC Code</span>
                  </Button>
                  <Button
                    type="button"
                    variant={searchType === "location" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setSearchType("location"); setSearchQuery(""); }}
                    className="flex flex-col items-center gap-1 h-auto py-2"
                    data-testid="search-type-location"
                  >
                    <MapPin className="h-4 w-4" />
                    <span className="text-xs">Town/City</span>
                  </Button>
                  <Button
                    type="button"
                    variant={searchType === "postcode" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setSearchType("postcode"); setSearchQuery(""); }}
                    className="flex flex-col items-center gap-1 h-auto py-2"
                    data-testid="search-type-postcode"
                  >
                    <Briefcase className="h-4 w-4" />
                    <span className="text-xs">Postcode</span>
                  </Button>
                  <Button
                    type="button"
                    variant={searchType === "officers" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setSearchType("officers"); setSearchQuery(""); }}
                    className="flex flex-col items-center gap-1 h-auto py-2"
                    data-testid="search-type-officers"
                  >
                    <UserSearch className="h-4 w-4" />
                    <span className="text-xs">Directors</span>
                  </Button>
                </div>

                {/* Search Form */}
                <form onSubmit={handleSearch} className="space-y-4">
                  <div className="space-y-2">
                    <Label>{getSearchLabel()}</Label>
                    <div className="flex gap-2">
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={getSearchPlaceholder()}
                        data-testid="input-search-query"
                        className="flex-1"
                      />
                      <Button 
                        type="submit" 
                        disabled={isFetching || !searchQuery.trim()}
                        data-testid="button-search"
                      >
                        {isFetching ? "Searching..." : "Search"}
                      </Button>
                    </div>
                    {getSearchHint() && (
                      <p className="text-xs text-muted-foreground">{getSearchHint()}</p>
                    )}
                  </div>
                  
                  {/* Search Filters */}
                  <div className="flex flex-wrap items-center gap-4 pt-2 border-t">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="hide-dissolved"
                        checked={hideDissolvedCompanies}
                        onCheckedChange={(checked) => setHideDissolvedCompanies(checked === true)}
                        data-testid="checkbox-hide-dissolved"
                      />
                      <label 
                        htmlFor="hide-dissolved" 
                        className="text-sm cursor-pointer"
                      >
                        Hide dissolved companies
                      </label>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Label htmlFor="search-limit" className="text-sm whitespace-nowrap">Max results:</Label>
                      <Select value={searchLimit} onValueChange={setSearchLimit}>
                        <SelectTrigger className="w-20 h-8" id="search-limit" data-testid="select-search-limit">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </form>

                {/* Company Search Results */}
                {searchType !== "officers" && companyResults?.items && companyResults.items.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {companyResults.items.length} {companyResults.items.length === 1 ? 'result' : 'results'} found
                    </p>
                    <div className="max-h-80 overflow-y-auto space-y-2">
                      {companyResults.items.map((company) => (
                        <Card
                          key={company.company_number}
                          className="hover-elevate cursor-pointer"
                          onClick={() => handleSelectCompany(company)}
                          data-testid={`company-result-${company.company_number}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-sm truncate">{company.title}</h3>
                                <p className="text-xs text-muted-foreground font-mono">{company.company_number}</p>
                                {company.address_snippet && (
                                  <div className="flex items-start gap-1 mt-1">
                                    <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-muted-foreground line-clamp-1">{company.address_snippet}</p>
                                  </div>
                                )}
                                {company.sic_codes && company.sic_codes.length > 0 && (
                                  <p className="text-xs text-muted-foreground mt-1">SIC: {company.sic_codes.join(", ")}</p>
                                )}
                              </div>
                              <Badge variant="secondary" className="text-xs flex-shrink-0">
                                {company.company_status}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Officers Search Results */}
                {searchType === "officers" && !selectedOfficer && officerResults?.items && officerResults.items.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {officerResults.items.length} {officerResults.items.length === 1 ? 'director' : 'directors'} found - click to view their companies
                    </p>
                    <div className="max-h-80 overflow-y-auto space-y-2">
                      {officerResults.items.map((officer, idx) => (
                        <Card
                          key={`${officer.title}-${idx}`}
                          className="hover-elevate cursor-pointer"
                          onClick={() => handleSelectOfficer(officer)}
                          data-testid={`officer-result-${idx}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4 text-primary flex-shrink-0" />
                                  <h3 className="font-semibold text-sm truncate">{officer.title}</h3>
                                </div>
                                {officer.address_snippet && (
                                  <div className="flex items-start gap-1 mt-1 pl-6">
                                    <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-muted-foreground line-clamp-1">{officer.address_snippet}</p>
                                  </div>
                                )}
                              </div>
                              <Badge variant="outline" className="text-xs flex-shrink-0">
                                Click to view companies
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Selected Officer's Companies */}
                {selectedOfficer && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">{selectedOfficer.title}'s Companies</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={clearOfficerSelection}>
                        Back to results
                      </Button>
                    </div>
                    
                    {isLoadingAppointments && (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground">Loading companies...</p>
                      </div>
                    )}
                    
                    {!isLoadingAppointments && officerAppointments.length > 0 && (
                      <div className="max-h-80 overflow-y-auto space-y-2">
                        {officerAppointments.map((apt, idx) => (
                          <Card
                            key={`${apt.appointed_to.company_number}-${idx}`}
                            className="hover-elevate cursor-pointer"
                            onClick={() => handleSelectAppointmentCompany(apt)}
                            data-testid={`appointment-result-${idx}`}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
                                    <h3 className="font-semibold text-sm truncate">{apt.appointed_to.company_name}</h3>
                                  </div>
                                  <div className="mt-1 pl-6">
                                    <p className="text-xs text-muted-foreground font-mono">{apt.appointed_to.company_number}</p>
                                    <p className="text-xs text-muted-foreground capitalize">Role: {apt.officer_role.replace(/-/g, ' ')}</p>
                                  </div>
                                </div>
                                <Badge variant="secondary" className="text-xs flex-shrink-0">
                                  {apt.appointed_to.company_status}
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                    
                    {!isLoadingAppointments && officerAppointments.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No active directorships found for this person.
                      </p>
                    )}
                  </div>
                )}

                {/* No Results */}
                {((searchType !== "officers" && companyResults?.items?.length === 0) ||
                  (searchType === "officers" && !selectedOfficer && officerResults?.items?.length === 0)) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No results found. Try a different search term.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Selected Company Form */}
            {selectedCompany && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-6 w-6 text-primary" />
                      <div>
                        <CardTitle>Selected Company</CardTitle>
                        <CardDescription>Review and complete the prospect details</CardDescription>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={resetForm}>
                      Clear
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Company Name</Label>
                        <Input value={companyName} readOnly className="bg-muted" data-testid="input-company-name" />
                      </div>
                      <div className="space-y-2">
                        <Label>Company Number</Label>
                        <Input value={companyNumber} readOnly className="bg-muted" data-testid="input-company-number" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Registered Address</Label>
                      <Textarea value={registeredAddress} readOnly rows={2} className="bg-muted" data-testid="input-address" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="priority">Priority</Label>
                        <Select value={priority} onValueChange={setPriority}>
                          <SelectTrigger id="priority" data-testid="select-priority">
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add any relevant notes..."
                        rows={3}
                        data-testid="input-notes"
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button
                        type="submit"
                        disabled={createProspectMutation.isPending}
                        className="flex-1"
                        data-testid="button-create-prospect"
                      >
                        {createProspectMutation.isPending ? "Creating..." : "Create Prospect"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => navigate("/")} data-testid="button-cancel">
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* MANUAL TAB */}
          <TabsContent value="manual" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <PenLine className="h-6 w-6 text-primary" />
                  <CardTitle>Add Prospect Manually</CardTitle>
                </div>
                <CardDescription>
                  Enter business details manually for any type of business entity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="companyType">
                      Business Type <span className="text-destructive">*</span>
                    </Label>
                    <Select value={companyType} onValueChange={setCompanyType}>
                      <SelectTrigger id="companyType" data-testid="select-company-type">
                        <SelectValue placeholder="Select business type" />
                      </SelectTrigger>
                      <SelectContent>
                        {COMPANY_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isUnregisteredType && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Not registered with Companies House - a system reference will be generated
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyName">
                      Business Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder={isUnregisteredType ? "e.g., Smith & Partners" : "e.g., Tech Innovations Ltd"}
                      required
                      data-testid="input-company-name-manual"
                    />
                  </div>

                  {!isUnregisteredType && (
                    <div className="space-y-2">
                      <Label htmlFor="companyNumber">
                        Company Number <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="companyNumber"
                        value={companyNumber}
                        onChange={(e) => setCompanyNumber(e.target.value)}
                        placeholder="e.g., 12345678"
                        required={!isUnregisteredType}
                        data-testid="input-company-number-manual"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="registeredAddress">Business Address</Label>
                    <Textarea
                      id="registeredAddress"
                      value={registeredAddress}
                      onChange={(e) => setRegisteredAddress(e.target.value)}
                      placeholder="Enter the business address"
                      rows={3}
                      data-testid="input-address-manual"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
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
                        data-testid="input-loan-amount-manual"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority</Label>
                      <Select value={priority} onValueChange={setPriority}>
                        <SelectTrigger id="priority" data-testid="select-priority-manual">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any relevant notes about this prospect"
                      rows={4}
                      data-testid="input-notes-manual"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="submit"
                      disabled={createProspectMutation.isPending || (!isUnregisteredType && !companyNumber.trim()) || !companyName.trim()}
                      className="flex-1"
                      data-testid="button-create-prospect-manual"
                    >
                      {createProspectMutation.isPending ? "Creating..." : "Create Prospect"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate("/")}
                      disabled={createProspectMutation.isPending}
                      data-testid="button-cancel-manual"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
