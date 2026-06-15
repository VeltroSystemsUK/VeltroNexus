import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Plus, Search, Download } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "unsigned" | "signed" | "negotiating">("all");
  const [filterContactOutcome, setFilterContactOutcome] = useState<"all" | "not_contacted" | "interested" | "no_answer" | "not_interested">("all");
  const [lenders, setLenders] = useState<CDFI[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
    notContacted: lenders.filter((l) => l.contactOutcome === "not_contacted").length,
    interested: lenders.filter((l) => l.contactOutcome === "interested").length,
  };

  const getAgreementBadgeColor = (status?: string) => {
    switch (status) {
      case "signed":
        return "bg-green-100 text-green-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "unsigned":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getContactBadgeColor = (outcome?: string) => {
    switch (outcome) {
      case "interested":
        return "bg-green-100 text-green-800";
      case "negotiating":
        return "bg-blue-100 text-blue-800";
      case "no_answer":
        return "bg-orange-100 text-orange-800";
      case "not_interested":
        return "bg-red-100 text-red-800";
      case "not_contacted":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <PageHeader
        title="CDFI Lender Panel"
        subtitle="Month 1 KPI: 10 signed agreements target"
      />

      {/* Statistics */}
      {lenders.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total CDFIs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Agreements Signed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.signed}/10</div>
              <p className="text-xs text-gray-500 mt-1">{Math.round((stats.signed / 10) * 100)}% of target</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Not Contacted</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.notContacted}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Interested</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.interested}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search & Filter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, contact, phone, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <div>
              <span className="text-sm font-medium text-gray-700 mr-2">Agreement Status:</span>
              <div className="inline-flex gap-1">
                {(["all", "unsigned", "in_progress", "signed"] as const).map((status) => (
                  <Button
                    key={status}
                    variant={filterStatus === status ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterStatus(status)}
                    className="capitalize"
                  >
                    {status === "in_progress" ? "In Progress" : status}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <div>
              <span className="text-sm font-medium text-gray-700 mr-2">Contact Outcome:</span>
              <div className="inline-flex gap-1">
                {(["all", "not_contacted", "interested", "no_answer", "not_interested"] as const).map((outcome) => (
                  <Button
                    key={outcome}
                    variant={filterContactOutcome === outcome ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterContactOutcome(outcome)}
                    className="capitalize text-xs"
                  >
                    {outcome.replace(/_/g, " ")}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lenders List */}
      <Card className="flex-1 flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>CDFI Database</CardTitle>
            <CardDescription>
              {filteredLenders.length} of {lenders.length} CDFIs
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add CDFI
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto">
          {filteredLenders.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No CDFIs found matching your filters.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLenders.map((lender) => (
                <div
                  key={lender.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="font-semibold text-lg">{lender.name}</h3>
                        <Badge className={getAgreementBadgeColor(lender.agreementStatus)}>
                          {lender.agreementStatus === "in_progress" ? "In Progress" : lender.agreementStatus}
                        </Badge>
                        <Badge className={getContactBadgeColor(lender.contactOutcome)}>
                          {lender.contactOutcome?.replace(/_/g, " ")}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                        {lender.contactName && (
                          <div>
                            <span className="font-medium">Contact:</span> {lender.contactName}
                          </div>
                        )}
                        {lender.contactPhone && (
                          <div>
                            <span className="font-medium">Phone:</span> {lender.contactPhone}
                          </div>
                        )}
                        {lender.postalAddress && (
                          <div>
                            <span className="font-medium">Location:</span> {lender.postalAddress}
                          </div>
                        )}
                        {lender.lendingMaxQuantum && (
                          <div>
                            <span className="font-medium">Lending Range:</span> £
                            {lender.lendingMinQuantum?.toLocaleString() || "0"} - £
                            {lender.lendingMaxQuantum.toLocaleString()}
                          </div>
                        )}
                      </div>

                      {lender.geographicalScope && lender.geographicalScope.length > 0 && (
                        <div className="flex gap-1 flex-wrap mb-2">
                          {lender.geographicalScope.map((scope) => (
                            <Badge key={scope} variant="secondary" className="text-xs">
                              {scope}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {lender.lastContacted && (
                        <p className="text-xs text-gray-500">
                          Last contacted: {new Date(lender.lastContacted).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 min-w-fit">
                      {lender.contactOutcome === "not_contacted" && (
                        <Button
                          size="sm"
                          variant="outline"
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
                          onClick={() => signAgreementMutation.mutate(lender.id)}
                          disabled={signAgreementMutation.isPending}
                        >
                          Sign Agreement
                        </Button>
                      )}
                      {lender.agreementStatus === "signed" && (
                        <Badge className="bg-green-100 text-green-800 justify-center">
                          ✓ Signed {new Date(lender.agreementSignedDate!).toLocaleDateString()}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
