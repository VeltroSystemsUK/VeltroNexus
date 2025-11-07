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
import { toast } from "sonner";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { ArrowLeft, Building2, Search, MapPin } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import logoUrl from "@assets/Gemini_Generated_Image_w096n4w096n4w096_1762508125080.png";

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
}

export default function CompanySearch() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<CompanySearchResult | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companyNumber, setCompanyNumber] = useState("");
  const [registeredAddress, setRegisteredAddress] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [priority, setPriority] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const { data: searchResults, refetch: searchCompanies, isFetching } = useQuery<{ items: CompanySearchResult[] }>({
    queryKey: ["/api/companies-house/search", searchQuery],
    queryFn: async () => {
      const response = await fetch(
        `/api/companies-house/search?q=${encodeURIComponent(searchQuery)}`,
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      toast.error("Please enter a company name or number");
      return;
    }
    setIsSearching(true);
    try {
      await searchCompanies();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to search companies");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectCompany = (company: CompanySearchResult) => {
    setSelectedCompany(company);
    setCompanyName(company.title);
    setCompanyNumber(company.company_number);
    
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
    
    setIsSearching(false);
    toast.success("Company details populated");
  };

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
              <img src={logoUrl} alt="FlowLoan" className="h-10" data-testid="img-logo" />
              <h1 className="text-xl font-bold">Add Prospect</h1>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        {/* Companies House Search */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <Search className="h-6 w-6 text-primary" />
              <CardTitle>Search Companies House</CardTitle>
            </div>
            <CardDescription>
              Search for a UK company to auto-populate details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter company name or number..."
                  data-testid="input-search-query"
                  className="flex-1"
                />
                <Button 
                  type="submit" 
                  disabled={isFetching || !searchQuery.trim()}
                  data-testid="button-search-companies"
                >
                  {isFetching ? "Searching..." : "Search"}
                </Button>
              </div>
              
              {/* Search Results */}
              {searchResults && searchResults.items && searchResults.items.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {searchResults.items.length} {searchResults.items.length === 1 ? 'result' : 'results'} found
                  </p>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {searchResults.items.map((company) => (
                      <Card
                        key={company.company_number}
                        className="hover-elevate cursor-pointer"
                        onClick={() => handleSelectCompany(company)}
                        data-testid={`company-result-${company.company_number}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm truncate">
                                {company.title}
                              </h3>
                              <p className="text-xs text-muted-foreground font-mono">
                                {company.company_number}
                              </p>
                              {(company.address_snippet || company.address) && (
                                <div className="flex items-start gap-1 mt-2">
                                  <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {company.address_snippet || 
                                      [
                                        company.address?.address_line_1,
                                        company.address?.locality,
                                        company.address?.postal_code
                                      ].filter(Boolean).join(", ")}
                                  </p>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col gap-1 items-end">
                              <Badge variant="secondary" className="text-xs">
                                {company.company_status}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              
              {searchResults && searchResults.items && searchResults.items.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No companies found. Try a different search term.
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Company Details Form */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="h-6 w-6 text-primary" />
              <CardTitle>Company Information</CardTitle>
            </div>
            <CardDescription>
              {selectedCompany 
                ? "Review and complete the details below" 
                : "Or enter company details manually"}
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
