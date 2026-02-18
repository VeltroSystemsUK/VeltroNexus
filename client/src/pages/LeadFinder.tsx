import React, { useState, useEffect, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import {
    Search,
    MapPin,
    Globe,
    Mail,
    Phone,
    Star,
    RefreshCw,
    Play,
    AlertCircle,
    CheckCircle,
    Trash2,
    Loader2,
    ArrowRightCircle,
    User,
    Check,
    Briefcase,
    CreditCard,
    Info,
    Filter,
    ArrowUpDown,
    DollarSign
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { DomainContactPanel } from "@/components/DomainContactPanel";
import { LeadDetailsSheet } from "@/components/LeadDetailsSheet";
import { EmailLink } from "@/components/EmailLink";

interface LeadResult {
    googlePlaceId: string;
    name: string;
    rating: number | null;
    reviewCount: number | null;
    status: string | null;
    address: string | null;
    phone: string | null;
    website: string | null;
    email: string | null;
    emailConfidence: string | null;
    linkedin?: string | null;
    facebook?: string | null;
    instagram?: string | null;
    twitter?: string | null;
    leadScore: number | null;
    pecrStatus: string | null;
    companyNumber?: string;
    contactName?: string;
    contactRole?: string;
    hasCharges?: boolean;
    activeChargeCount?: number;
    lenderNames?: string[];
    migrated?: boolean;
    sicCode?: string;
}

interface AgentStatus {
    total: number;
    enriched: number;
    emails_found: number;
}

export default function LeadFinder() {
    const [location, setLocation] = useLocation();
    const [instruction, setInstruction] = useState("");
    const [isPolling, setIsPolling] = useState(false);

    // Filters & Sort
    const [searchQuery, setSearchQuery] = useState("");
    const [cityFilter, setCityFilter] = useState<string>("all");
    const [sicFilter, setSicFilter] = useState<string>("all");
    const [chargeFilter, setChargeFilter] = useState<string>("all");
    const [lenderFilter, setLenderFilter] = useState<string>("all");
    const [lenderOpen, setLenderOpen] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: keyof LeadResult | "none", direction: "asc" | "desc" }>({ key: "none", direction: "desc" });
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

    // Fetch Leads
    const { data: leads = [], isLoading, refetch } = useQuery<LeadResult[]>({
        queryKey: ["/api/lead-finder/results"],
        refetchInterval: isPolling ? 2000 : false,
    });

    // Fetch Status
    const { data: status } = useQuery<AgentStatus>({
        queryKey: ["/api/lead-finder/status"],
        refetchInterval: isPolling ? 2000 : false,
    });

    const runAgentMutation = useMutation({
        mutationFn: (instruction: string) => apiRequest("/api/lead-finder/run", "POST", { instruction }),
        onSuccess: () => {
            toast.success("Agent started! Watch the table for live updates.");
            setInstruction("");
            setIsPolling(true);
            // Stop polling after 60 seconds automatically if no explicit stop
            setTimeout(() => setIsPolling(false), 60000);
        },
        onError: (error: any) => {
            toast.error("Failed to start agent: " + error.message);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (placeId: string) => apiRequest(`/api/lead-finder/${placeId}`, "DELETE"),
        onSuccess: () => {
            toast.success("Lead deleted");
            queryClient.invalidateQueries({ queryKey: ["/api/lead-finder/results"] });
            queryClient.invalidateQueries({ queryKey: ["/api/lead-finder/status"] });
        },
        onError: (error: any) => {
            toast.error("Failed to delete lead: " + error.message);
        }
    });

    const migrateMutation = useMutation({
        mutationFn: (placeId: string) => apiRequest(`/api/lead-finder/migrate/${placeId}`, "POST"),
        onSuccess: () => {
            toast.success("Lead migrated to CRM!");
            queryClient.invalidateQueries({ queryKey: ["/api/lead-finder/results"] });
        },
        onError: (error: any) => {
            toast.error("Failed to migrate lead: " + error.message);
        }
    });

    const saveContactMutation = useMutation({
        mutationFn: ({ placeId, email, context }: { placeId: string, email: string, context?: string }) =>
            apiRequest(`/api/lead-finder/${placeId}/contact`, "PUT", { email, context }),
        onSuccess: () => {
            toast.success("Contact saved!");
            queryClient.invalidateQueries({ queryKey: ["/api/lead-finder/results"] });
        },
        onError: (error: any) => {
            toast.error("Failed to save contact: " + error.message);
        }
    });

    // Toggle polling if results change significantly or if user wants to stop
    useEffect(() => {
        if (leads.length > 0 && isPolling) {
            // Maybe keep polling? Let's just let the user toggle or timeout.
        }
    }, [leads.length, isPolling]);

    // Derived State
    const cities = Array.from(new Set(leads.map(l => l.address?.split(',').slice(-2)[0]?.trim()).filter(Boolean))) as string[];
    const sicCodes = Array.from(new Set(leads.map(l => l.sicCode).filter(Boolean))) as string[];
    const lenders = Array.from(new Set(leads.flatMap(l => l.lenderNames || []).filter(Boolean))).sort((a, b) => a.localeCompare(b));

    const filteredAndSortedLeads = leads
        .filter(lead => {
            const matchesSearch = lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                lead.companyNumber?.includes(searchQuery);
            const matchesCity = cityFilter === "all" || (lead.address && lead.address.includes(cityFilter));
            const matchesSic = sicFilter === "all" || lead.sicCode === sicFilter;
            const matchesCharge = chargeFilter === "all" ||
                (chargeFilter === "charged" && lead.hasCharges) ||
                (chargeFilter === "none" && !lead.hasCharges) ||
                (chargeFilter === "enrichment_required" && lead.hasCharges && (!lead.lenderNames || lead.lenderNames.length === 0));
            const matchesLender = lenderFilter === "all" || (lead.lenderNames && lead.lenderNames.includes(lenderFilter));

            return matchesSearch && matchesCity && matchesSic && matchesCharge && matchesLender;
        })
        .sort((a, b) => {
            if (sortConfig.key === "none") return 0;

            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];

            if (aValue === undefined || aValue === null) return sortConfig.direction === "asc" ? 1 : -1;
            if (bValue === undefined || bValue === null) return sortConfig.direction === "asc" ? -1 : 1;

            const modifier = sortConfig.direction === "asc" ? 1 : -1;

            if (typeof aValue === "string" && typeof bValue === "string") {
                return aValue.localeCompare(bValue) * modifier;
            }

            if (typeof aValue === "number" && typeof bValue === "number") {
                return (aValue - bValue) * modifier;
            }

            if (typeof aValue === "boolean" && typeof bValue === "boolean") {
                return (aValue === bValue ? 0 : aValue ? 1 : -1) * modifier;
            }

            return 0;
        });

    const PAGE_SIZE = 25;
    const totalPages = Math.ceil(filteredAndSortedLeads.length / PAGE_SIZE);
    const paginatedLeads = filteredAndSortedLeads.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE
    );

    useEffect(() => { setCurrentPage(1); }, [searchQuery, cityFilter, sicFilter, chargeFilter, lenderFilter, sortConfig]);

    function getPageNumbers(current: number, total: number): (number | "...")[] {
        if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
        const pages: (number | "...")[] = [1];
        if (current > 3) pages.push("...");
        for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
        if (current < total - 2) pages.push("...");
        pages.push(total);
        return pages;
    }

    const handleSort = (key: keyof LeadResult) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
        }));
    };

    const selectedLead = useMemo(() =>
        leads.find(l => l.googlePlaceId === selectedLeadId) || null
        , [leads, selectedLeadId]);

    return (
        <div className="space-y-6 pt-6 pb-12 w-full">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Search className="h-8 w-8 text-primary" />
                        Lead Finder Agent
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        AI-powered lead discovery and enrichment.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setLocation("/")}>
                        Back to Dashboard
                    </Button>
                </div>
            </div>

            {/* Instruction Panel */}
            <Card className="bg-muted/30 border-dashed">
                <CardHeader>
                    <CardTitle className="text-lg">Agent Instruction</CardTitle>
                    <CardDescription>
                        Tell the agent what to find. Be specific about location and criteria.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4">
                        <Input
                            id="agent-instruction"
                            name="instruction"
                            placeholder="e.g., 'Find finance brokers in Manchester, minimum 4 stars'"
                            value={instruction}
                            onChange={(e) => setInstruction(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && instruction.trim()) {
                                    runAgentMutation.mutate(instruction.trim());
                                }
                            }}
                            className="bg-background"
                        />
                        <Button
                            onClick={() => runAgentMutation.mutate(instruction.trim())}
                            disabled={!instruction.trim() || runAgentMutation.isPending}
                        >
                            {runAgentMutation.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                            Run Agent
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Status Cards */}
            <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                        <Search className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{status?.total || 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Emails Found</CardTitle>
                        <Mail className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{status?.emails_found || 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Enriched</CardTitle>
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{status?.enriched || 0}</div>
                    </CardContent>
                </Card>
                <Card className="flex flex-col justify-center items-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setIsPolling(!isPolling)}>
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <RefreshCw className={`h-4 w-4 ${isPolling ? "animate-spin" : ""}`} />
                        {isPolling ? "Live Updates On" : "Click to Refresh"}
                    </div>
                </Card>
            </div>

            <Card className="border-none shadow-none bg-transparent">
                <CardHeader className="px-0">
                    <CardTitle>Results</CardTitle>
                    <CardDescription>
                        Latest leads found by the agent.
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                    {/* Filter Bar */}
                    <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-muted/30 rounded-lg border border-dashed">
                        <div className="flex-1 min-w-[200px] relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="finder-search"
                                name="finder-search"
                                placeholder="Search results..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Select value={cityFilter} onValueChange={setCityFilter}>
                            <SelectTrigger className="w-[180px]">
                                <MapPin className="h-3 w-3 mr-2" />
                                <SelectValue placeholder="All Cities" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Cities</SelectItem>
                                {cities.map(city => (
                                    <SelectItem key={city} value={city}>{city}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={sicFilter} onValueChange={setSicFilter}>
                            <SelectTrigger className="w-[180px]">
                                <Briefcase className="h-3 w-3 mr-2" />
                                <SelectValue placeholder="All SIC Codes" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All SIC Codes</SelectItem>
                                {sicCodes.map(sic => (
                                    <SelectItem key={sic} value={sic}>{sic}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={chargeFilter} onValueChange={setChargeFilter}>
                            <SelectTrigger className="w-[150px]">
                                <Filter className="h-3 w-3 mr-2" />
                                <SelectValue placeholder="All Risk" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Risk</SelectItem>
                                <SelectItem value="charged">Charges ✅</SelectItem>
                                <SelectItem value="none">Clear</SelectItem>
                            </SelectContent>
                        </Select>

                        <Popover open={lenderOpen} onOpenChange={setLenderOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={lenderOpen}
                                    className="w-[200px] justify-between font-normal"
                                >
                                    <div className="flex items-center truncate">
                                        <DollarSign className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                        {lenderFilter === "all"
                                            ? "All Lenders"
                                            : lenders.find((lender) => lender === lenderFilter) || "Select Lender..."}
                                    </div>
                                    <ArrowUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[250px] p-0">
                                <Command>
                                    <CommandInput
                                        placeholder="Search lenders..."
                                        id="lender-search"
                                        name="lender-search"
                                    />
                                    <CommandList>
                                        <CommandEmpty>No lender found.</CommandEmpty>
                                        <CommandGroup>
                                            <CommandItem
                                                value="all"
                                                onSelect={() => {
                                                    setLenderFilter("all");
                                                    setLenderOpen(false);
                                                }}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        lenderFilter === "all" ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                All Lenders
                                            </CommandItem>
                                            {lenders.map((lender) => (
                                                <CommandItem
                                                    key={lender}
                                                    value={lender}
                                                    onSelect={(currentValue) => {
                                                        setLenderFilter(currentValue === lenderFilter ? "all" : currentValue);
                                                        setLenderOpen(false);
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            lenderFilter === lender ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {lender}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>

                        {(searchQuery || cityFilter !== "all" || sicFilter !== "all" || chargeFilter !== "all" || lenderFilter !== "all") && (
                            <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(""); setCityFilter("all"); setSicFilter("all"); setChargeFilter("all"); setLenderFilter("all"); }}>
                                Reset
                            </Button>
                        )}
                    </div>

                    <div className="rounded-lg border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead
                                        className="w-[280px] cursor-pointer hover:text-foreground group"
                                        onClick={() => handleSort("name")}
                                    >
                                        <div className="flex items-center gap-2">
                                            Company Name
                                            <ArrowUpDown className={`h-3 w-3 opacity-20 group-hover:opacity-100 ${sortConfig.key === "name" ? "opacity-100 text-primary" : ""}`} />
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="cursor-pointer hover:text-foreground group"
                                        onClick={() => handleSort("rating")}
                                    >
                                        <div className="flex items-center gap-2">
                                            Rating
                                            <ArrowUpDown className={`h-3 w-3 opacity-20 group-hover:opacity-100 ${sortConfig.key === "rating" ? "opacity-100 text-primary" : ""}`} />
                                        </div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:text-foreground group" onClick={() => handleSort("address")}>
                                        Location
                                    </TableHead>
                                    <TableHead>Contact</TableHead>
                                    <TableHead
                                        className="cursor-pointer hover:text-foreground group"
                                        onClick={() => handleSort("activeChargeCount")}
                                    >
                                        <div className="flex items-center gap-2">
                                            Charges
                                            <ArrowUpDown className={`h-3 w-3 opacity-20 group-hover:opacity-100 ${sortConfig.key === "activeChargeCount" ? "opacity-100 text-primary" : ""}`} />
                                        </div>
                                    </TableHead>
                                    <TableHead>Lender</TableHead>
                                    <TableHead
                                        className="cursor-pointer hover:text-foreground group"
                                        onClick={() => handleSort("sicCode")}
                                    >
                                        <div className="flex items-center gap-2">
                                            SIC
                                            <ArrowUpDown className={`h-3 w-3 opacity-20 group-hover:opacity-100 ${sortConfig.key === "sicCode" ? "opacity-100 text-primary" : ""}`} />
                                        </div>
                                    </TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 7 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                            <TableCell />
                                        </TableRow>
                                    ))
                                ) : filteredAndSortedLeads.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-10">
                                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                <Search className="h-8 w-8 opacity-20" />
                                                <p>No leads found yet. Run the agent above.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedLeads.map((lead, i) => (
                                        <TableRow key={lead.googlePlaceId || i} className="hover:bg-muted/50">
                                            <TableCell className="font-medium">
                                                <div className="flex items-start gap-2">
                                                    {lead.migrated && (
                                                        <CheckCircle className="h-4 w-4 text-green-500 fill-green-100 mt-1 shrink-0" />
                                                    )}
                                                    <div className="flex flex-col gap-0.5">
                                                        {lead.googlePlaceId ? (
                                                            <a
                                                                href={`https://www.google.com/maps/place/?q=place_id:${lead.googlePlaceId}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-base font-medium hover:underline hover:text-primary transition-colors"
                                                            >
                                                                {lead.name}
                                                            </a>
                                                        ) : (
                                                            <span className="text-base">{lead.name}</span>
                                                        )}
                                                        {lead.website ? (
                                                            <a
                                                                href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-xs text-muted-foreground hover:text-primary truncate max-w-[200px] flex items-center gap-1"
                                                            >
                                                                <Globe className="h-3 w-3" />
                                                                {lead.website.replace(/^https?:\/\/(www\.)?/, "")}
                                                            </a>
                                                        ) : (
                                                            lead.status && <span className="text-xs text-muted-foreground capitalize">{lead.status.replace(/_/g, " ").toLowerCase()}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    {lead.rating ? (
                                                        <>
                                                            <span className="font-bold">{lead.rating}</span>
                                                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                                            <span className="text-xs text-muted-foreground">({lead.reviewCount})</span>
                                                        </>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap" title={lead.address || ""}>
                                                    <MapPin className="h-3 w-3 shrink-0" />
                                                    {(() => {
                                                        if (!lead.address) return "N/A";
                                                        // Simple UK postcode regex or fallback to last part
                                                        const postcodeMatch = lead.address.match(/([A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})/i);
                                                        return postcodeMatch ? postcodeMatch[0].toUpperCase() : lead.address.split(",").pop()?.trim();
                                                    })()}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    {lead.contactName ? (
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2 text-sm font-medium">
                                                                <User className="h-3 w-3 text-primary" />
                                                                {(() => {
                                                                    // Format SURNAME, Forename -> Forename Surname
                                                                    const name = lead.contactName;
                                                                    if (name.includes(',')) {
                                                                        const parts = name.split(',').map(p => p.trim());
                                                                        if (parts.length >= 2) {
                                                                            const surname = parts[0];
                                                                            const forename = parts[1].split(' ')[0];
                                                                            return `${forename} ${surname}`.replace(/\b\w/g, l => l.toUpperCase());
                                                                        }
                                                                    }
                                                                    return name;
                                                                })()}
                                                            </div>
                                                            <span className="text-xs text-muted-foreground ml-5">{lead.contactRole}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col gap-1">
                                                            {lead.phone && (
                                                                <div className="flex items-center gap-2 text-xs">
                                                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                                                    {lead.phone}
                                                                </div>
                                                            )}
                                                            {lead.email && (
                                                                <div className="flex items-center gap-2 text-xs">
                                                                    <Mail className="h-3 w-3 text-emerald-500" />
                                                                    <span className="text-emerald-700 font-medium">{lead.email}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                {lead.website && (
                                                    <div className="mt-2">
                                                        {/* Moved to Details Sheet */}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {lead.hasCharges ? (
                                                        <div className="flex items-center gap-1" title={`${lead.activeChargeCount} Active Charges`}>
                                                            <CreditCard className="h-4 w-4 text-amber-600" />
                                                            <span className="font-bold text-amber-700">{lead.activeChargeCount}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">-</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {lead.lenderNames && lead.lenderNames.length > 0 ? (
                                                    <div className="flex flex-col max-w-[150px]">
                                                        <span className="text-xs font-medium truncate" title={lead.lenderNames.join(", ")}>
                                                            {lead.lenderNames[0]}
                                                        </span>
                                                        {lead.lenderNames.length > 1 && (
                                                            <span className="text-[10px] text-muted-foreground">
                                                                +{lead.lenderNames.length - 1} more
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    {lead.sicCode ? (
                                                        <Badge variant="outline" className="font-mono text-[10px]">
                                                            {lead.sicCode}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">-</span>
                                                    )}
                                                    {/* PECR Status Mini Badge - REMOVED */}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                        title="View Details"
                                                        onClick={() => setSelectedLeadId(lead.googlePlaceId || null)}
                                                    >
                                                        <Info className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                        title="Migrate to CRM"
                                                        onClick={() => lead.googlePlaceId && migrateMutation.mutate(lead.googlePlaceId)}
                                                        disabled={migrateMutation.isPending}
                                                    >
                                                        {migrateMutation.isPending && migrateMutation.variables === lead.googlePlaceId ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <ArrowRightCircle className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                        title="Delete Lead"
                                                        onClick={() => lead.googlePlaceId && deleteMutation.mutate(lead.googlePlaceId)}
                                                        disabled={deleteMutation.isPending}
                                                    >
                                                        {deleteMutation.isPending && deleteMutation.variables === lead.googlePlaceId ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between mt-4 px-2">
                                <p className="text-sm text-muted-foreground">
                                    Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredAndSortedLeads.length)} of {filteredAndSortedLeads.length}
                                </p>
                                <Pagination>
                                    <PaginationContent>
                                        <PaginationItem>
                                            <PaginationPrevious
                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                aria-disabled={currentPage === 1}
                                                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                            />
                                        </PaginationItem>
                                        {getPageNumbers(currentPage, totalPages).map((page, i) =>
                                            page === "..." ? (
                                                <PaginationItem key={`ellipsis-${i}`}><PaginationEllipsis /></PaginationItem>
                                            ) : (
                                                <PaginationItem key={page}>
                                                    <PaginationLink isActive={currentPage === page} onClick={() => setCurrentPage(page)} className="cursor-pointer">
                                                        {page}
                                                    </PaginationLink>
                                                </PaginationItem>
                                            )
                                        )}
                                        <PaginationItem>
                                            <PaginationNext
                                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                aria-disabled={currentPage === totalPages}
                                                className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                            />
                                        </PaginationItem>
                                    </PaginationContent>
                                </Pagination>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <LeadDetailsSheet
                lead={selectedLead}
                open={!!selectedLead}
                onOpenChange={(open) => !open && setSelectedLeadId(null)}
                onSaveContact={(contact) => {
                    if (selectedLead?.googlePlaceId) {
                        saveContactMutation.mutate({
                            placeId: selectedLead.googlePlaceId,
                            email: contact.email,
                            context: contact.context
                        });
                    }
                }}
            />
        </div>
    );
}
