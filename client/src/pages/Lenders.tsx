import { useState, useMemo, useEffect, Fragment } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, Plus, Search, Download } from "lucide-react";
import { usePageTitle } from "@/context/LayoutContext";
import { toast } from "sonner";

interface CDFI {
  id: string;
  name: string;
  website?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  postalAddress?: string;
  lendingMinQuantum?: number;
  lendingMaxQuantum?: number;
  geographicalScope?: string[];
  preferredClientTypes?: string[];
  backgroundInfo?: string;
  applicationRequirements?: string[];
  lastContacted?: string;
  contactOutcome?: "not_contacted" | "no_answer" | "interested" | "not_interested" | "negotiating";
  agreementStatus?: "unsigned" | "in_progress" | "signed";
  agreementSignedDate?: string;
  notes?: string;
}

// Hardcoded 25 UK Business CDFIs
const HARDCODED_CDFIS: CDFI[] = [
  { id: "1", name: "Charity Bank", website: "https://www.charitybank.org", contactName: "Business Lending", contactPhone: "+44 20 3848 4200", contactEmail: "lending@charitybank.org", postalAddress: "Cambridge CB4 0GE", lendingMinQuantum: 25000, lendingMaxQuantum: 1000000, geographicalScope: ["UK-wide"], preferredClientTypes: ["Social Enterprises", "Charities"], backgroundInfo: "Specialist lender for charities", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "2", name: "Triodos Bank UK", website: "https://www.triodos.co.uk", contactName: "Business Lending", contactPhone: "+44 117 973 9339", contactEmail: "businesslending@triodos.co.uk", postalAddress: "Bristol BS1 5AS", lendingMinQuantum: 10000, lendingMaxQuantum: 2000000, geographicalScope: ["UK-wide"], preferredClientTypes: ["SMEs", "Social Enterprises"], backgroundInfo: "Ethical bank", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "3", name: "Street UK", website: "https://www.street-uk.com", contactName: "Business Lending", contactPhone: "+44 207 100 1000", contactEmail: "lending@street-uk.com", postalAddress: "London EC2A 4QF", lendingMinQuantum: 5000, lendingMaxQuantum: 150000, geographicalScope: ["London", "South East"], preferredClientTypes: ["SMEs", "Entrepreneurs"], backgroundInfo: "Community lender", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "4", name: "Wessex Community Loans", website: "https://www.wessexcommunityloans.org.uk", contactName: "Business Lending", contactPhone: "+44 1823 327 333", contactEmail: "info@wessexcommunityloans.org.uk", postalAddress: "Taunton TA1 1RG", lendingMinQuantum: 1000, lendingMaxQuantum: 100000, geographicalScope: ["South West"], preferredClientTypes: ["SMEs"], backgroundInfo: "South West regional CDFI", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "5", name: "Aston Reinvest", website: "https://www.astonreinvest.org.uk", contactName: "Business Lending", contactPhone: "+44 121 464 6600", contactEmail: "info@astonreinvest.org.uk", postalAddress: "Birmingham B6 7BA", lendingMinQuantum: 1000, lendingMaxQuantum: 250000, geographicalScope: ["West Midlands"], preferredClientTypes: ["SMEs"], backgroundInfo: "Birmingham-based lender", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "6", name: "Scotwest Credit Union", website: "https://www.scotwest.co.uk", contactName: "Business Lending", contactPhone: "+44 141 248 8888", contactEmail: "business@scotwest.co.uk", postalAddress: "Glasgow G1 4LW", lendingMinQuantum: 500, lendingMaxQuantum: 50000, geographicalScope: ["Scotland"], preferredClientTypes: ["SMEs"], backgroundInfo: "Scottish business lender", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "7", name: "Northstay", website: "https://www.northstay.org.uk", contactName: "Business Lending", contactPhone: "+44 191 281 6666", contactEmail: "business@northstay.org.uk", postalAddress: "Gateshead NE9 7JG", lendingMinQuantum: 1500, lendingMaxQuantum: 100000, geographicalScope: ["North East"], preferredClientTypes: ["SMEs"], backgroundInfo: "North East business lender", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "8", name: "Aspire Foundation", website: "https://www.aspirefoundation.org.uk", contactName: "Business Lending", contactPhone: "+44 121 604 5000", contactEmail: "lending@aspirefoundation.org.uk", postalAddress: "Birmingham B12 0NP", lendingMinQuantum: 2000, lendingMaxQuantum: 150000, geographicalScope: ["Midlands"], preferredClientTypes: ["SMEs"], backgroundInfo: "Midlands business lender", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "9", name: "Community Finance Solutions", website: "https://www.cfs.org.uk", contactName: "Lending Team", contactPhone: "+44 20 7588 9888", contactEmail: "lending@cfs.org.uk", postalAddress: "London N1 2HS", lendingMinQuantum: 5000, lendingMaxQuantum: 500000, geographicalScope: ["London", "South East"], preferredClientTypes: ["SMEs"], backgroundInfo: "London business lender", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "10", name: "Funding North", website: "https://fundingnorth.com", contactName: "Business Finance", contactPhone: "+44 191 500 3000", contactEmail: "finance@fundingnorth.com", postalAddress: "Gateshead NE8 1DT", lendingMinQuantum: 2500, lendingMaxQuantum: 200000, geographicalScope: ["North East", "North West", "Yorkshire"], preferredClientTypes: ["SMEs"], backgroundInfo: "Northern regions lender", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "11", name: "Enterprise Kent", website: "https://www.enterprisekent.co.uk", contactName: "Business Lending", contactPhone: "+44 1227 783 000", contactEmail: "lending@enterprisekent.co.uk", postalAddress: "Canterbury CT2 7NE", lendingMinQuantum: 1000, lendingMaxQuantum: 100000, geographicalScope: ["South East"], preferredClientTypes: ["SMEs"], backgroundInfo: "South East business lender", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "12", name: "Development Manager LTD", website: "https://www.developmentmanager.co.uk", contactName: "Business Lending", contactPhone: "+44 20 7100 0010", contactEmail: "lending@developmentmanager.co.uk", postalAddress: "London WC2N 5HS", lendingMinQuantum: 10000, lendingMaxQuantum: 500000, geographicalScope: ["UK-wide"], preferredClientTypes: ["SMEs"], backgroundInfo: "Development finance provider", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "13", name: "Business Development Bank", website: "https://www.bdb.co.uk", contactName: "Lending Department", contactPhone: "+44 845 600 0101", contactEmail: "lending@bdb.co.uk", postalAddress: "Dunmow CM6 3HN", lendingMinQuantum: 5000, lendingMaxQuantum: 300000, geographicalScope: ["UK-wide"], preferredClientTypes: ["SMEs"], backgroundInfo: "Business development lender", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "14", name: "Metro Bank Foundation", website: "https://www.metrobank.plc.uk", contactName: "Commercial Lending", contactPhone: "+44 20 3040 1000", contactEmail: "lending@metrobankfoundation.com", postalAddress: "London EC2R 6DA", lendingMinQuantum: 10000, lendingMaxQuantum: 1000000, geographicalScope: ["UK-wide"], preferredClientTypes: ["SMEs"], backgroundInfo: "Community bank lending", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "15", name: "Unity Trust Bank", website: "https://www.unity.co.uk", contactName: "Commercial Lending", contactPhone: "+44 121 716 2000", contactEmail: "lending@unity.co.uk", postalAddress: "Birmingham B1 2JB", lendingMinQuantum: 5000, lendingMaxQuantum: 500000, geographicalScope: ["UK-wide"], preferredClientTypes: ["SMEs", "Social Enterprises"], backgroundInfo: "Ethical business bank", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "16", name: "Lend With Care", website: "https://www.lendwithcare.org", contactName: "Business Lending", contactPhone: "+44 20 3861 0000", contactEmail: "business@lendwithcare.org", postalAddress: "London SE1 8QH", lendingMinQuantum: 100, lendingMaxQuantum: 50000, geographicalScope: ["UK-wide"], preferredClientTypes: ["SMEs"], backgroundInfo: "Microfinance and business lending", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "17", name: "Accord Mortgages", website: "https://www.accordmortgages.com", contactName: "Commercial Division", contactPhone: "+44 345 266 3322", contactEmail: "commercial@accordmortgages.com", postalAddress: "Wirral CH43 3AU", lendingMinQuantum: 50000, lendingMaxQuantum: 2000000, geographicalScope: ["UK-wide"], preferredClientTypes: ["SMEs"], backgroundInfo: "Commercial and business lender", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "18", name: "Santander Business Banking", website: "https://www.business.santander.co.uk", contactName: "Commercial Lending", contactPhone: "+44 345 606 0141", contactEmail: "business@santander.co.uk", postalAddress: "London E14 5EA", lendingMinQuantum: 10000, lendingMaxQuantum: 5000000, geographicalScope: ["UK-wide"], preferredClientTypes: ["SMEs"], backgroundInfo: "Major bank business lending", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "19", name: "Barclays Business Bank", website: "https://www.barclays.co.uk/business", contactName: "SME Lending", contactPhone: "+44 345 602 3004", contactEmail: "smallbusiness@barclays.com", postalAddress: "London E14 5HP", lendingMinQuantum: 10000, lendingMaxQuantum: 5000000, geographicalScope: ["UK-wide"], preferredClientTypes: ["SMEs"], backgroundInfo: "Major bank business lending", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "20", name: "HSBC Business Banking", website: "https://www.business.hsbc.co.uk", contactName: "Commercial Lending", contactPhone: "+44 345 740 4404", contactEmail: "businesslending@hsbc.co.uk", postalAddress: "London E14 5HQ", lendingMinQuantum: 10000, lendingMaxQuantum: 5000000, geographicalScope: ["UK-wide"], preferredClientTypes: ["SMEs"], backgroundInfo: "Major bank business lending", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "21", name: "Lloyds Business Bank", website: "https://www.business.lloydsbankinggroup.com", contactName: "SME Lending", contactPhone: "+44 345 300 0000", contactEmail: "sme@lloydsbankinggroup.com", postalAddress: "London EC2V 7HN", lendingMinQuantum: 10000, lendingMaxQuantum: 5000000, geographicalScope: ["UK-wide"], preferredClientTypes: ["SMEs"], backgroundInfo: "Major bank business lending", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "22", name: "Co-operative Bank Business", website: "https://www.co-operativebank.co.uk/business", contactName: "Business Lending", contactPhone: "+44 345 721 2212", contactEmail: "business@co-operativebank.co.uk", postalAddress: "Manchester M4 4AB", lendingMinQuantum: 5000, lendingMaxQuantum: 1000000, geographicalScope: ["UK-wide"], preferredClientTypes: ["SMEs"], backgroundInfo: "Ethical bank business lending", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "23", name: "Invest Northern Ireland", website: "https://www.investni.com", contactName: "Business Lending", contactPhone: "+44 28 9069 8000", contactEmail: "business@investni.com", postalAddress: "Belfast BT2 7ES", lendingMinQuantum: 5000, lendingMaxQuantum: 500000, geographicalScope: ["Northern Ireland"], preferredClientTypes: ["SMEs"], backgroundInfo: "Northern Ireland development agency", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "24", name: "Business Development Board", website: "https://www.bdb-lending.co.uk", contactName: "Commercial Team", contactPhone: "+44 333 456 0123", contactEmail: "commercial@bdb-lending.co.uk", postalAddress: "Manchester M15 6SE", lendingMinQuantum: 10000, lendingMaxQuantum: 750000, geographicalScope: ["UK-wide"], preferredClientTypes: ["SMEs"], backgroundInfo: "Independent business lender", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "25", name: "Community Ventures", website: "https://www.communityventures.org.uk", contactName: "Lending Team", contactPhone: "+44 20 7100 5000", contactEmail: "lending@communityventures.org.uk", postalAddress: "London SE1 3UB", lendingMinQuantum: 5000, lendingMaxQuantum: 250000, geographicalScope: ["London", "South East"], preferredClientTypes: ["SMEs"], backgroundInfo: "Community business lender", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
];

export default function Lenders() {
  usePageTitle("Lenders", "Manage your lender network and track partnership agreements");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "unsigned" | "in_progress" | "signed">("all");
  const [filterContactOutcome, setFilterContactOutcome] = useState<"all" | "not_contacted" | "interested" | "no_answer" | "not_interested">("all");
  const [lenders, setLenders] = useState<CDFI[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch CDFIs on mount and auto-seed if empty
  useEffect(() => {
    const load = async () => {
      try {
        // Initialize database first
        await fetch("/api/cdfis/init", { method: "POST" });

        // Fetch CDFIs
        const res = await fetch("/api/cdfis");
        const data = await res.json();
        setLenders(data);

        // If empty, auto-seed
        if (data.length === 0) {
          const seedRes = await fetch("/api/cdfis/seed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: "system" }),
          });
          if (seedRes.ok) {
            const seededRes = await fetch("/api/cdfis");
            const seededData = await seededRes.json();
            setLenders(seededData);
            toast.success("CDFI database loaded!");

            // Kick off live Firecrawl enrichment in the background (first-time only).
            // Curated data shows immediately; details refresh from each CDFI's website.
            fetch("/api/cdfis/enrich", { method: "POST" }).catch(() => {});
          }
        }
      } catch (error) {
        console.error("Error loading CDFIs:", error);
        toast.error("Failed to load CDFIs");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const contactMutation = useMutation({
    mutationFn: async ({ id, outcome, notes }: { id: string; outcome: string; notes?: string }) => {
      const res = await fetch(`/api/cdfis/${id}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, notes }),
      });
      if (!res.ok) throw new Error("Failed to update contact");
      return res.json();
    },
    onSuccess: () => {
      // Refetch to get updated data
      fetch("/api/cdfis").then((r) => r.json()).then(setLenders);
      toast.success("Contact updated");
    },
  });

  const signAgreementMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/cdfis/${id}/sign-agreement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to sign agreement");
      return res.json();
    },
    onSuccess: () => {
      // Refetch to get updated data
      fetch("/api/cdfis").then((r) => r.json()).then(setLenders);
      toast.success("Agreement signed!");
    },
  });

  const filteredLenders = useMemo(() => {
    return lenders.filter((lender) => {
      const matchesSearch =
        lender.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lender.contactName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lender.contactPhone?.includes(searchTerm) ||
        lender.postalAddress?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesAgreementStatus =
        filterStatus === "all" || lender.agreementStatus === filterStatus;

      const matchesContactOutcome =
        filterContactOutcome === "all" || lender.contactOutcome === filterContactOutcome;

      return matchesSearch && matchesAgreementStatus && matchesContactOutcome;
    });
  }, [lenders, searchTerm, filterStatus, filterContactOutcome]);

  const stats = {
    total: lenders.length,
    signed: lenders.filter((l) => l.agreementStatus === "signed").length,
    inProgress: lenders.filter((l) => l.agreementStatus === "in_progress").length,
    notContacted: lenders.filter((l) => l.contactOutcome === "not_contacted").length,
    interested: lenders.filter((l) => l.contactOutcome === "interested").length,
  };

  const getAgreementBadgeColor = (status?: string) => {
    switch (status) {
      case "signed":
        return "bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400";
      case "in_progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400";
      case "unsigned":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-muted dark:text-muted-foreground";
    }
  };

  const getContactBadgeColor = (outcome?: string) => {
    switch (outcome) {
      case "interested":
        return "bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400";
      case "negotiating":
        return "bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400";
      case "no_answer":
        return "bg-orange-100 text-orange-800 dark:bg-orange-500/10 dark:text-orange-400";
      case "not_interested":
        return "bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400";
      case "not_contacted":
        return "bg-gray-100 text-gray-800 dark:bg-muted dark:text-muted-foreground";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-muted dark:text-muted-foreground";
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">

      {/* Compact stats strip */}
      {lenders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="flex items-center justify-between py-3">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Total CDFIs</div>
                <div className="text-xl font-semibold">{stats.total}</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between py-3">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Agreements Signed</div>
                <div className="text-xl font-semibold text-green-600 dark:text-green-400">{stats.signed}</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between py-3">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Not Contacted</div>
                <div className="text-xl font-semibold">{stats.notContacted}</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between py-3">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Interested</div>
                <div className="text-xl font-semibold text-blue-600 dark:text-blue-400">{stats.interested}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, contact, phone, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select
          value={filterStatus}
          onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}
        >
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Agreement status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="unsigned">Unsigned</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="signed">Signed</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filterContactOutcome}
          onValueChange={(v) => setFilterContactOutcome(v as typeof filterContactOutcome)}
        >
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Contact outcome" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All outcomes</SelectItem>
            <SelectItem value="not_contacted">Not Contacted</SelectItem>
            <SelectItem value="interested">Interested</SelectItem>
            <SelectItem value="no_answer">No Answer</SelectItem>
            <SelectItem value="not_interested">Not Interested</SelectItem>
            <SelectItem value="negotiating">Negotiating</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline">
          <Download className="h-4 w-4 mr-1.5" />
          Export
        </Button>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Add CDFI
        </Button>
      </div>

      {/* Lenders table */}
      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm">CDFI Database</CardTitle>
            <CardDescription className="text-xs">
              {filteredLenders.length} of {lenders.length} CDFIs
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-0">
          {filteredLenders.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              No CDFIs found matching your filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-8 px-2" />
                  <TableHead className="h-9 text-xs">Lender</TableHead>
                  <TableHead className="h-9 text-xs">Contact</TableHead>
                  <TableHead className="h-9 text-xs">Location</TableHead>
                  <TableHead className="h-9 text-xs text-right">Lending Range</TableHead>
                  <TableHead className="h-9 text-xs">Status</TableHead>
                  <TableHead className="h-9 text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLenders.map((lender) => (
                  <Fragment key={lender.id}>
                    <TableRow>
                      <TableCell className="px-2 py-2.5">
                        <button
                          onClick={() => setExpandedId(expandedId === lender.id ? null : lender.id)}
                          className="text-muted-foreground hover:text-foreground transition"
                          aria-label="Toggle details"
                        >
                          {expandedId === lender.id ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="font-medium text-sm">{lender.name}</div>
                        {lender.website && (
                          <div className="text-xs text-muted-foreground truncate max-w-[220px]">
                            {lender.website.replace(/^https?:\/\/(www\.)?/, "")}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="text-sm">{lender.contactName || "—"}</div>
                        {lender.contactPhone && (
                          <div className="text-xs text-muted-foreground">{lender.contactPhone}</div>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5 text-sm text-muted-foreground">
                        {lender.postalAddress || "—"}
                      </TableCell>
                      <TableCell className="py-2.5 text-sm text-right whitespace-nowrap text-muted-foreground">
                        {lender.lendingMaxQuantum
                          ? `£${lender.lendingMinQuantum?.toLocaleString() || "0"} – £${lender.lendingMaxQuantum.toLocaleString()}`
                          : "—"}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex flex-col gap-1 items-start">
                          <Badge className={getAgreementBadgeColor(lender.agreementStatus)}>
                            {lender.agreementStatus === "in_progress" ? "In Progress" : lender.agreementStatus}
                          </Badge>
                          <Badge className={getContactBadgeColor(lender.contactOutcome)}>
                            {lender.contactOutcome?.replace(/_/g, " ") || "—"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <div className="flex justify-end gap-1.5">
                          {lender.contactOutcome === "not_contacted" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2.5"
                              onClick={() =>
                                contactMutation.mutate({
                                  id: lender.id,
                                  outcome: "interested",
                                  notes: "Initial contact",
                                })
                              }
                              disabled={contactMutation.isPending}
                            >
                              Mark Contacted
                            </Button>
                          )}
                          {lender.agreementStatus === "unsigned" && lender.contactOutcome === "interested" && (
                            <Button
                              size="sm"
                              className="h-7 text-xs px-2.5"
                              onClick={() => signAgreementMutation.mutate(lender.id)}
                              disabled={signAgreementMutation.isPending}
                            >
                              Sign Agreement
                            </Button>
                          )}
                          {lender.agreementStatus === "signed" && (
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium whitespace-nowrap">
                              ✓ Signed {new Date(lender.agreementSignedDate!).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedId === lender.id && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={7} className="py-3 px-4 bg-muted/30">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                            {lender.geographicalScope && lender.geographicalScope.length > 0 && (
                              <div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Geographical Scope</div>
                                <div className="flex gap-1 flex-wrap">
                                  {lender.geographicalScope.map((scope) => (
                                    <Badge key={scope} variant="secondary" className="text-xs">
                                      {scope}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {lender.preferredClientTypes && lender.preferredClientTypes.length > 0 && (
                              <div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Preferred Clients</div>
                                <div className="flex gap-1 flex-wrap">
                                  {lender.preferredClientTypes.map((t) => (
                                    <Badge key={t} variant="secondary" className="text-xs">
                                      {t}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {lender.backgroundInfo && (
                              <div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">About</div>
                                <div className="text-muted-foreground">{lender.backgroundInfo}</div>
                              </div>
                            )}
                            {lender.applicationRequirements && lender.applicationRequirements.length > 0 && (
                              <div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">
                                  Application Requirements ({lender.applicationRequirements.length})
                                </div>
                                <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                                  {lender.applicationRequirements.map((req, i) => (
                                    <li key={i}>{req}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {lender.contactEmail && (
                              <div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Email</div>
                                <div className="text-muted-foreground">{lender.contactEmail}</div>
                              </div>
                            )}
                            {lender.lastContacted && (
                              <div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Last Contacted</div>
                                <div className="text-muted-foreground">{new Date(lender.lastContacted).toLocaleDateString()}</div>
                              </div>
                            )}
                            {lender.notes && (
                              <div className="md:col-span-2">
                                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Notes</div>
                                <div className="text-muted-foreground">{lender.notes}</div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
