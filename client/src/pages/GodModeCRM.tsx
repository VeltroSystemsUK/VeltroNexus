import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
    Card,
    CardContent,
    CardDescription,
    CardTitle,
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
    Plus,
    Trash2,
    CheckCircle,
    ArrowUpRight,
    ArrowUpDown,
    Search,
    Filter,
    MapPin,
    Briefcase,
    DollarSign,
    UserPlus,
    Check,
    Loader2,
    Activity,
    Clock,
    AlertTriangle,
    XCircle,
    CheckCircle2,
    Send,
    UserSearch,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { AgentJobProgress } from "@/components/AgentJobProgress";
import { useAuth } from "@/hooks/useAuth";
import { InternalLead, Commission, User } from "@shared/schema";
import { toast } from "sonner";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { usePageTitle } from "@/context/LayoutContext";

// Reuse Components
import InternalLeadDetail from "@/components/InternalLeadDetail";

export default function GodModeCRM() {
    const [location, setLocation] = useLocation();

    const [selectedLead, setSelectedLead] = useState<InternalLead | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [cityFilter, setCityFilter] = useState<string>("all");
    const [sicFilter, setSicFilter] = useState<string>("all");
    const [chargeFilter, setChargeFilter] = useState<string>("all");
    const [lenderFilter, setLenderFilter] = useState<string>("all");
    const [lenderOpen, setLenderOpen] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: keyof InternalLead | "none", direction: "asc" | "desc" }>({ key: "none", direction: "desc" });
    const [currentPage, setCurrentPage] = useState(1);

    const { user } = useAuth();
    const [selectedLeadIds, setSelectedLeadIds] = useState<Set<number>>(new Set());
    const [activeTab, setActiveTab] = useState("leads");

    // Agent A - Lead Collection
    const [discoveryTown, setDiscoveryTown] = useState("");
    const [discoverySicCodes, setDiscoverySicCodes] = useState("");
    const [discoveryDialogOpen, setDiscoveryDialogOpen] = useState(false);
    const [discoveryAutoEnrich, setDiscoveryAutoEnrich] = useState(false);

    // Notification for job completion
    const { data: runningJobs } = useQuery<any[]>({
        queryKey: ["/api/agent-jobs/running"],
        refetchInterval: 3000,
    });

    const prevRunningCount = useRef(0);
    useEffect(() => {
        if (runningJobs && prevRunningCount.current > runningJobs.length) {
            // A job must have finished
            toast.success("Agent task completed! Refreshing leads...", {
                icon: <CheckCircle className="h-4 w-4 text-green-500" />
            });
            queryClient.invalidateQueries({ queryKey: ["/api/god/crm/leads"] });
        }
        if (runningJobs) {
            prevRunningCount.current = runningJobs.length;
        }
    }, [runningJobs]);

    // Fetch Leads
    const { data: leads = [], isLoading } = useQuery<InternalLead[]>({
        queryKey: ["/api/god/crm/leads"],
    });

    // Fetch Users (for Agent assignment)
    const { data: users = [] } = useQuery<User[]>({
        queryKey: ["/api/god/users"],
    });

    // Filter for potential agents (e.g. admins or specific role, for now all users)
    const agents = users;

    const createLeadMutation = useMutation({
        mutationFn: (data: any) => apiRequest("/api/god/crm/leads", "POST", data),
        onSuccess: () => {
            toast.success("Lead added to pipeline");
            queryClient.invalidateQueries({ queryKey: ["/api/god/crm/leads"] });
        },
    });

    const updateLeadMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) =>
            apiRequest(`/api/god/crm/leads/${id}`, "PUT", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/god/crm/leads"] });
        },
    });

    const promoteLeadMutation = useMutation({
        mutationFn: (leadId: number) => apiRequest(`/api/god/crm/leads/${leadId}/promote`, "POST"),
        onSuccess: () => {
            toast.success("Lead promoted to Prospect pipeline!");
            queryClient.invalidateQueries({ queryKey: ["/api/god/crm/leads"] });
            queryClient.invalidateQueries({ queryKey: ["/api/prospects"] });
        },
        onError: (error: any) => {
            toast.error("Promotion failed: " + error.message);
        }
    });

    const deleteLeadMutation = useMutation({
        mutationFn: (leadId: number) => apiRequest(`/api/god/crm/leads/${leadId}`, "DELETE"),
        onSuccess: () => {
            toast.success("Lead deleted.");
            queryClient.invalidateQueries({ queryKey: ["/api/god/crm/leads"] });
        },
        onError: (error: any) => {
            toast.error("Deletion failed: " + error.message);
        }
    });

    const clearLeadsMutation = useMutation({
        mutationFn: () => apiRequest("/api/god/crm/leads/clear-all", "DELETE"),
        onSuccess: () => {
            toast.success("Database cleared");
            queryClient.invalidateQueries({ queryKey: ["/api/god/crm/leads"] });
        },
        onError: (error: any) => {
            toast.error("Clearing failed: " + error.message);
        }
    });

    // Agent A - Dynamic Discovery Mutation
    const discoverLeadsMutation = useMutation({
        mutationFn: (vars: { town?: string, sicCodes?: string[], autoEnrich?: boolean }) =>
            apiRequest("/api/god/crm/discover", "POST", {
                town: vars.town,
                sicCodes: vars.sicCodes,
                autoEnrich: vars.autoEnrich
            }),
        onSuccess: () => {
            toast.success(`Discovery started${discoveryAutoEnrich ? " with Auto-Enrichment" : ""}`);
            setDiscoveryDialogOpen(false);
            setDiscoveryTown("");
            setDiscoverySicCodes("");
            setDiscoveryAutoEnrich(false);
            queryClient.invalidateQueries({ queryKey: ["/api/agent-jobs"] });
        },
        onError: (error: any) => {
            toast.error("Discovery failed: " + error.message);
        }
    });

    const triggerDiscovery = () => {
        if (!discoveryTown.trim() && !discoverySicCodes.trim()) {
            toast.error("Please enter a town or SIC codes");
            return;
        }

        const sicArray = discoverySicCodes ? discoverySicCodes.split(",").map(s => s.trim()) : undefined;
        discoverLeadsMutation.mutate({
            town: discoveryTown,
            sicCodes: sicArray,
            autoEnrich: discoveryAutoEnrich
        });
    };

    // Agent B - Enrichment Mutations
    const enrichLeadMutation = useMutation({
        mutationFn: (leadId: number) => apiRequest(`/api/god/crm/enrich/${leadId}`, "POST"),
        onSuccess: (data: any) => {
            toast.success(data.message || "Lead enriched successfully");
            queryClient.invalidateQueries({ queryKey: ["/api/god/crm/leads"] });
        },
        onError: (error: any) => {
            toast.error("Enrichment failed: " + error.message);
        }
    });

    const enrichBulkMutation = useMutation({
        mutationFn: (leadIds: number[]) => apiRequest("/api/god/crm/enrich-bulk", "POST", { leadIds }),
        onSuccess: (data: any) => {
            toast.success(data.message || "Bulk enrichment started");
            setSelectedLeadIds(new Set());
        },
        onError: (error: any) => {
            toast.error("Bulk enrichment failed: " + error.message);
        }
    });

    // Contact Finder mutations
    const findContactsMutation = useMutation({
        mutationFn: async (leadId: number) => { const res = await apiRequest(`/api/god/crm/find-contacts/${leadId}`, "POST"); return res.json(); },
        onSuccess: (data: any) => {
            toast.success(data.message || "Contacts found");
            queryClient.invalidateQueries({ queryKey: ["/api/god/crm/leads"] });
        },
        onError: (error: any) => {
            toast.error("Contact search failed: " + error.message);
        }
    });

    const findContactsBulkMutation = useMutation({
        mutationFn: async (leadIds: number[]) => { const res = await apiRequest("/api/god/crm/find-contacts-bulk", "POST", { leadIds }); return res.json(); },
        onSuccess: (data: any) => {
            toast.success(data.message || "Contact discovery started");
            setSelectedLeadIds(new Set());
            queryClient.invalidateQueries({ queryKey: ["/api/agent-jobs"] });
        },
        onError: (error: any) => {
            toast.error("Bulk contact search failed: " + error.message);
        }
    });

    // Kanban Columns
    const stages = [
        { id: "new", label: "New Lead", color: "bg-blue-500/10 border-blue-500/20 text-blue-500" },
        { id: "contacted", label: "Contacted", color: "bg-yellow-500/10 border-yellow-500/20 text-yellow-500" },
        { id: "demo_booked", label: "Demo Booked", color: "bg-purple-500/10 border-purple-500/20 text-purple-500" },
        { id: "trial", label: "Trial Active", color: "bg-indigo-500/10 border-indigo-500/20 text-indigo-500" },
        { id: "subscribed", label: "Subscribed", color: "bg-green-500/10 border-green-500/20 text-green-500" },
        { id: "churned", label: "Lost/Churned", color: "bg-red-500/10 border-red-500/20 text-red-500" },
    ];

    const cities = useMemo(() => Array.from(new Set(leads.map(l => l.city).filter(Boolean))) as string[], [leads]);
    const leadSicCodes = useMemo(() => Array.from(new Set(leads.map(l => l.sicCode).filter(Boolean))) as string[], [leads]);
    const lenders = useMemo(() => Array.from(new Set(leads.map(l => l.identifiedLender).filter((l): l is string => !!l))).sort((a, b) => a.localeCompare(b)), [leads]);

    const filteredAndSortedLeads = useMemo(() => {
        return leads
            .filter(lead => {
                if (lead.status === "converted") return false;
                const matchesSearch = lead.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    lead.companyNumber?.includes(searchQuery);
                const matchesCity = cityFilter === "all" || lead.city === cityFilter;
                const matchesSic = sicFilter === "all" || lead.sicCode === sicFilter;
                const matchesCharge = chargeFilter === "all" ||
                    (chargeFilter === "active_lender" && !!lead.identifiedLender && lead.chargeStatus !== "satisfied") ||
                    (chargeFilter === "former_lender" && !!lead.identifiedLender && lead.chargeStatus === "satisfied") ||
                    (chargeFilter === "enrichment_needed" && lead.hasCharges && !lead.identifiedLender) ||
                    (chargeFilter === "no_charges" && !lead.hasCharges && !lead.identifiedLender);
                const matchesLender = lenderFilter === "all" || lead.identifiedLender === lenderFilter;

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

                if (sortConfig.key === "incorporationDate") {
                    const dateA = new Date(aValue as string).getTime();
                    const dateB = new Date(bValue as string).getTime();
                    return (dateA - dateB) * modifier;
                }

                return 0;
            });
    }, [leads, searchQuery, cityFilter, sicFilter, chargeFilter, lenderFilter, sortConfig]);

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

    const handleSort = (key: keyof InternalLead) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
        }));
    };

    const getLeadsByStage = (stage: string) => {
        return filteredAndSortedLeads.filter((lead) => lead.status === stage);
    };

    const handleDrop = (e: React.DragEvent, stage: string) => {
        const leadId = parseInt(e.dataTransfer.getData("leadId"));
        if (leadId) {
            updateLeadMutation.mutate({ id: leadId, data: { status: stage } });
        }
    };

    usePageTitle("Prospects", "Foundational data collected from Companies House");

    return (
        <div className="space-y-6 pt-6 pb-12 w-full">
            {/* Detail Dialog */}
            {selectedLead && (
                <InternalLeadDetail
                    lead={selectedLead}
                    open={!!selectedLead}
                    onOpenChange={(open) => !open && setSelectedLead(null)}
                    availableAgents={users}
                />
            )}

            <div className="flex items-center justify-between">
                <div></div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setLocation("/god-mode")}>
                        Back to Dashboard
                    </Button>
                    <div className="flex gap-1">
                        {/* Agent A - Lead Collection */}
                        <Dialog open={discoveryDialogOpen} onOpenChange={setDiscoveryDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="secondary">
                                    <Search className="mr-2 h-4 w-4" /> Discover Leads
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>🔍 Lead Collection Agent</DialogTitle>
                                    <DialogDescription>
                                        Enter a town or city name to discover active companies from Companies House
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="town">Town / City Name</Label>
                                        <Input
                                            id="town"
                                            placeholder="e.g., Manchester, Birmingham, Leeds, Cambridge"
                                            value={discoveryTown}
                                            onChange={(e) => setDiscoveryTown(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") triggerDiscovery();
                                            }}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Agent will search Companies House for active Ltd companies in this location
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="sicCodes">SIC Codes (Optional)</Label>
                                        <Input
                                            id="sicCodes"
                                            placeholder="e.g., 64921, 64922, 70229"
                                            value={discoverySicCodes}
                                            onChange={(e) => setDiscoverySicCodes(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") triggerDiscovery();
                                            }}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Find specific industries across the UK
                                        </p>
                                    </div>

                                    <div className="flex items-center space-x-2 pt-2">
                                        <Checkbox
                                            id="autoEnrich"
                                            checked={discoveryAutoEnrich}
                                            onCheckedChange={(checked) => setDiscoveryAutoEnrich(!!checked)}
                                        />
                                        <div className="grid gap-1.5 leading-none">
                                            <Label
                                                htmlFor="autoEnrich"
                                                className="text-sm font-medium leading-none cursor-pointer"
                                            >
                                                Auto-Enrich discovered leads (Agent B)
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                Automatically find emails, phones and business overviews
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button
                                        onClick={triggerDiscovery}
                                        disabled={discoverLeadsMutation.isPending}
                                    >
                                        {discoverLeadsMutation.isPending ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Working...
                                            </>
                                        ) : (
                                            <>
                                                <Search className="mr-2 h-4 w-4" /> Start Agent A
                                            </>
                                        )}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        {/* Agent B - Lead Enrichment */}
                        <Button
                            variant="secondary"
                            onClick={() => {
                                if (selectedLeadIds.size === 0) {
                                    toast.info("Select leads to enrich by clicking checkboxes in the table");
                                } else {
                                    enrichBulkMutation.mutate(Array.from(selectedLeadIds));
                                }
                            }}
                            disabled={enrichBulkMutation.isPending}
                        >
                            <UserPlus className="mr-2 h-4 w-4" />
                            Enrich {selectedLeadIds.size > 0 ? `(${selectedLeadIds.size})` : "Leads"}
                        </Button>

                        {/* Contact Finder */}
                        <Button
                            variant="secondary"
                            onClick={() => {
                                if (selectedLeadIds.size === 0) {
                                    toast.info("Select leads to find contacts for by clicking checkboxes in the table");
                                } else {
                                    findContactsBulkMutation.mutate(Array.from(selectedLeadIds));
                                }
                            }}
                            disabled={findContactsBulkMutation.isPending}
                        >
                            <UserSearch className="mr-2 h-4 w-4" />
                            Find Contacts {selectedLeadIds.size > 0 ? `(${selectedLeadIds.size})` : ""}
                        </Button>

                        <Button
                            variant="secondary"
                            onClick={() => {
                                if (selectedLeadIds.size === 0) {
                                    toast.info("Select leads to send a campaign to by clicking checkboxes in the table");
                                } else {
                                    const ids = Array.from(selectedLeadIds).join(",");
                                    setLocation(`/email-campaigns?prefill=crm&source=client&ids=${ids}`);
                                }
                            }}
                        >
                            <Send className="mr-2 h-4 w-4" />
                            Campaign {selectedLeadIds.size > 0 ? `(${selectedLeadIds.size})` : ""}
                        </Button>

                        <Button
                            variant="destructive"
                            onClick={() => {
                                if (window.confirm("Are you sure you want to clear ALL internal leads? This cannot be undone.")) {
                                    clearLeadsMutation.mutate();
                                }
                            }}
                            disabled={clearLeadsMutation.isPending}
                        >
                            Clear Dashboard
                        </Button>
                    </div>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> New Lead
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add Manual Lead</DialogTitle>
                                <DialogDescription>Enter company details to track.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="manual-companyName">Company Name</Label>
                                    <Input id="manual-companyName" name="companyName" placeholder="Acme Corp" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="manual-companyNumber">Company Number</Label>
                                    <Input id="manual-companyNumber" name="companyNumber" placeholder="12345678" />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={() => toast.info("Manual lead entry placeholder")}>Save Lead</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Card className="border-none shadow-none bg-transparent">
                <div className="flex flex-col gap-6">
                    {/* Agent Progress Section */}
                    <AgentJobProgress userId={user?.id} />

                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Discovered Leads</CardTitle>
                            <CardDescription>
                                Active companies in target Midlands regions
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-4">
                            <Badge variant="outline" className="text-lg py-1 px-3">
                                {leads.length} Total Leads
                            </Badge>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => { if (confirm("Wipe ALL internal leads?")) clearLeadsMutation.mutate(); }}
                                disabled={clearLeadsMutation.isPending}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Wipe Database
                            </Button>
                        </div>
                    </div>
                </div>
                <CardContent className="px-0">
                    {/* Filter Bar */}
                    <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-muted/30 rounded-lg border border-dashed">
                        <div className="flex-1 min-w-[200px] relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="crm-search"
                                name="crm-search"
                                placeholder="Search leads..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Select value={cityFilter} onValueChange={setCityFilter}>
                            <SelectTrigger id="filter-city" className="w-[180px]">
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
                            <SelectTrigger id="filter-sic" className="w-[180px]">
                                <Briefcase className="h-3 w-3 mr-2" />
                                <SelectValue placeholder="All SIC Codes" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All SIC Codes</SelectItem>
                                {leadSicCodes.map(sic => (
                                    <SelectItem key={sic} value={sic}>{sic}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={chargeFilter} onValueChange={setChargeFilter}>
                            <SelectTrigger id="filter-risk" className="w-[180px]">
                                <Filter className="h-3 w-3 mr-2" />
                                <SelectValue placeholder="All Risk Types" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Risk Types</SelectItem>
                                <SelectItem value="active_lender">Active Lender ✅</SelectItem>
                                <SelectItem value="former_lender">Former Lender 🔵</SelectItem>
                                <SelectItem value="enrichment_needed">Enrichment Needed ⚠️</SelectItem>
                                <SelectItem value="no_charges">No Charges ❌</SelectItem>
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
                                    <CommandInput placeholder="Search lenders..." />
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
                                Reset Filters
                            </Button>
                        )}
                    </div>

                    <div className="rounded-lg border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="w-[40px]">
                                        <input
                                            type="checkbox"
                                            id="select-all-leads"
                                            name="select-all-leads"
                                            aria-label="Select all leads"
                                            className="rounded border-gray-300"
                                            checked={selectedLeadIds.size === filteredAndSortedLeads.length && filteredAndSortedLeads.length > 0}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedLeadIds(new Set(filteredAndSortedLeads.map(l => l.id)));
                                                } else {
                                                    setSelectedLeadIds(new Set());
                                                }
                                            }}
                                        />
                                    </TableHead>
                                    <TableHead
                                        className="w-[280px] cursor-pointer hover:text-foreground transition-colors group"
                                        onClick={() => handleSort("companyName")}
                                    >
                                        <div className="flex items-center gap-2">
                                            Company Name
                                            <ArrowUpDown className={`h-3 w-3 opacity-20 group-hover:opacity-100 ${sortConfig.key === "companyName" ? "opacity-100 text-primary" : ""}`} />
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="cursor-pointer hover:text-foreground transition-colors group"
                                        onClick={() => handleSort("companyNumber")}
                                    >
                                        <div className="flex items-center gap-2">
                                            Number
                                            <ArrowUpDown className={`h-3 w-3 opacity-20 group-hover:opacity-100 ${sortConfig.key === "companyNumber" ? "opacity-100 text-primary" : ""}`} />
                                        </div>
                                    </TableHead>

                                    <TableHead
                                        className="cursor-pointer hover:text-foreground transition-colors group"
                                        onClick={() => handleSort("hasCharges")}
                                    >
                                        <div className="flex items-center gap-2">
                                            Charges
                                            <ArrowUpDown className={`h-3 w-3 opacity-20 group-hover:opacity-100 ${sortConfig.key === "hasCharges" ? "opacity-100 text-primary" : ""}`} />
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="cursor-pointer hover:text-foreground transition-colors group"
                                        onClick={() => handleSort("incorporationDate")}
                                    >
                                        <div className="flex items-center gap-2">
                                            Incorporation
                                            <ArrowUpDown className={`h-3 w-3 opacity-20 group-hover:opacity-100 ${sortConfig.key === "incorporationDate" ? "opacity-100 text-primary" : ""}`} />
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="cursor-pointer hover:text-foreground transition-colors group"
                                        onClick={() => handleSort("city")}
                                    >
                                        <div className="flex items-center gap-2">
                                            Town / City
                                            <ArrowUpDown className={`h-3 w-3 opacity-20 group-hover:opacity-100 ${sortConfig.key === "city" ? "opacity-100 text-primary" : ""}`} />
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="cursor-pointer hover:text-foreground transition-colors group"
                                        onClick={() => handleSort("identifiedLender")}
                                    >
                                        <div className="flex items-center gap-2">
                                            Lender
                                            <ArrowUpDown className={`h-3 w-3 opacity-20 group-hover:opacity-100 ${sortConfig.key === "identifiedLender" ? "opacity-100 text-primary" : ""}`} />
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="cursor-pointer hover:text-foreground transition-colors group"
                                        onClick={() => handleSort("sicCode")}
                                    >
                                        <div className="flex items-center gap-2">
                                            SIC Code
                                            <ArrowUpDown className={`h-3 w-3 opacity-20 group-hover:opacity-100 ${sortConfig.key === "sicCode" ? "opacity-100 text-primary" : ""}`} />
                                        </div>
                                    </TableHead>

                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-10">
                                            Loading leads...
                                        </TableCell>
                                    </TableRow>
                                ) : filteredAndSortedLeads.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-10">
                                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                <Search className="h-8 w-8 opacity-20" />
                                                <p>No leads found matching your criteria.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedLeads.map((lead) => (
                                        <TableRow key={lead.id} className={`cursor-pointer hover:bg-muted/50 ${selectedLeadIds.has(lead.id) ? "bg-muted/30" : ""}`} onClick={() => setSelectedLead(lead)}>
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    id={`select-lead-${lead.id}`}
                                                    name={`select-lead-${lead.id}`}
                                                    aria-label={`Select ${lead.companyName}`}
                                                    className="rounded border-gray-300"
                                                    checked={selectedLeadIds.has(lead.id)}
                                                    onChange={(e) => {
                                                        const newSet = new Set(selectedLeadIds);
                                                        if (e.target.checked) {
                                                            newSet.add(lead.id);
                                                        } else {
                                                            newSet.delete(lead.id);
                                                        }
                                                        setSelectedLeadIds(newSet);
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                <button
                                                    onClick={() => setSelectedLead(lead)}
                                                    className="text-primary hover:underline text-left font-semibold"
                                                >
                                                    {lead.companyName}
                                                </button>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground">
                                                {lead.companyNumber}
                                            </TableCell>

                                            <TableCell>
                                                {lead.identifiedLender ? (
                                                    lead.chargeStatus === "satisfied" ? (
                                                        <CheckCircle2 className="h-4 w-4 text-blue-500" />
                                                    ) : (
                                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                    )
                                                ) : lead.hasCharges ? (
                                                    <span className="text-xs text-amber-600 flex items-center gap-1">
                                                        <AlertTriangle className="h-3 w-3" />
                                                        Enrichment Needed
                                                    </span>
                                                ) : (
                                                    <XCircle className="h-4 w-4 text-red-400" />
                                                )}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {lead.incorporationDate ? format(new Date(lead.incorporationDate), "dd MMM yyyy") : "N/A"}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {(() => {
                                                    const city = lead.city || "";
                                                    // Strip postcodes (UK format: letter+digit patterns at end)
                                                    const cleaned = city.replace(/\s*[A-Z]{1,2}\d{1,2}\s*\d[A-Z]{2}\s*$/i, "").trim();
                                                    if (cleaned) return cleaned;
                                                    // Fallback: extract city from address (second-to-last segment, skip postcode)
                                                    if (lead.address) {
                                                        const parts = lead.address.split(",").map((p: string) => p.trim()).filter(Boolean);
                                                        if (parts.length >= 2) return parts[parts.length - 2];
                                                        if (parts.length === 1) return parts[0];
                                                    }
                                                    return "N/A";
                                                })()}
                                            </TableCell>
                                            <TableCell>
                                                {lead.identifiedLender ? (
                                                    <span
                                                        className={cn(
                                                            "text-xs truncate max-w-[180px] block cursor-help",
                                                            lead.chargeStatus === "satisfied" ? "text-muted-foreground" : "text-foreground"
                                                        )}
                                                        title={lead.identifiedLender}
                                                    >
                                                        {lead.chargeStatus === "satisfied" ? "Former: " : ""}
                                                        {lead.identifiedLender.length > 30
                                                            ? lead.identifiedLender.slice(0, 30) + "..."
                                                            : lead.identifiedLender}
                                                    </span>
                                                ) : lead.hasCharges ? (
                                                    <span className="text-xs text-muted-foreground italic">Enrichment Required</span>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground opacity-30">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-xs font-mono">
                                                {lead.sicCode || "—"}
                                            </TableCell>

                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                                    {lead.status === "converted" ? (
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            className="h-8 gap-1 bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
                                                            onClick={() => setLocation("/pipeline")}
                                                        >
                                                            <CheckCircle className="h-3.5 w-3.5" />
                                                            In Pipeline
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 text-primary border-primary/20 hover:bg-primary/5 gap-1"
                                                            onClick={() => promoteLeadMutation.mutate(lead.id)}
                                                            disabled={promoteLeadMutation.isPending}
                                                        >
                                                            <ArrowUpRight className="h-3.5 w-3.5" />
                                                            Promote
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                        onClick={() => { if (confirm(`Delete ${lead.companyName}?`)) deleteLeadMutation.mutate(lead.id); }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
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
            </Card >
        </div >
    );
}
