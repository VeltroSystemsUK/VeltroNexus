import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrokerFinderTab } from "@/components/BrokerFinderTab";
import { IntroducerPipeline } from "@/components/IntroducerPipeline";

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
    Loader2,
    Activity,
    Trash2,
    Linkedin,
    Mail,
    MessageCircle,
    ArrowUp,
    ArrowDown,
    ChevronsUpDown,
    ShieldCheck
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { AgentJobProgress } from "@/components/AgentJobProgress";
import { useAuth } from "@/hooks/useAuth";
import { BrokerLead } from "@shared/schema";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { usePageTitle } from "@/context/LayoutContext";

// Broker Details Component
import BrokerLeadDetail from "@/components/BrokerLeadDetail";

export default function BrokersCRM() {
    const [, setLocation] = useLocation();
    const { user } = useAuth();

    const [selectedLead, setSelectedLead] = useState<BrokerLead | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [postcodeFilter, setPostcodeFilter] = useState<string>("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: keyof BrokerLead | "location" | undefined; direction: "asc" | "desc" | undefined }>({
        key: undefined,
        direction: undefined
    });

    // Agent Discovery State
    const [discoveryTown, setDiscoveryTown] = useState("");
    const [discoverySicCodes, setDiscoverySicCodes] = useState("");
    const [discoveryDialogOpen, setDiscoveryDialogOpen] = useState(false);
    const [discoveryAutoEnrich, setDiscoveryAutoEnrich] = useState(false);

    // Fetch Broker Leads
    const { data: leads = [], isLoading } = useQuery<BrokerLead[]>({
        queryKey: ["/api/brokers/leads"],
    });

    const clearLeadsMutation = useMutation({
        mutationFn: () => apiRequest("/api/brokers/leads/clear-all", "DELETE"),
        onSuccess: () => {
            toast.success("Broker database cleared");
            queryClient.invalidateQueries({ queryKey: ["/api/brokers/leads"] });
        },
    });

    const sweepMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("/api/brokers/sweep-introducers", "POST");
            return await res.json();
        },
        onSuccess: (data) => {
            const total = (data.movedFromLeads || 0) + (data.movedFromPipeline || 0);
            if (total === 0) {
                toast.success("No introducers found in the main pipeline");
            } else {
                toast.success(`Moved ${total} introducer${total === 1 ? "" : "s"} into this pipeline (${data.movedFromLeads} from Leads, ${data.movedFromPipeline} from Pipeline)`);
            }
            queryClient.invalidateQueries({ queryKey: ["/api/brokers/leads"] });
            queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
            queryClient.invalidateQueries({ queryKey: ["/api/prospects"] });
        },
        onError: () => toast.error("Sweep failed"),
    });

    const discoverLeadsMutation = useMutation({
        mutationFn: (vars: { town?: string, sicCodes?: string[], autoEnrich?: boolean }) =>
            apiRequest("/api/brokers/discover", "POST", vars),
        onSuccess: () => {
            toast.success("Broker discovery started");
            setDiscoveryDialogOpen(false);
            setDiscoveryTown("");
            setDiscoverySicCodes("");
            queryClient.invalidateQueries({ queryKey: ["/api/agent-jobs"] });
        },
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

    const verifyEmailMutation = useMutation({
        mutationFn: async (leadId: number) => {
            const res = await apiRequest(`/api/brokers/leads/${leadId}/verify-email`, "POST");
            return await res.json();
        },
        onSuccess: (data) => {
            if (data.status === "valid") {
                toast.success(`Email verified: ${data.verification.status}`);
            } else if (data.status === "enriched") {
                toast.success(`New email found: ${data.email}`);
                queryClient.invalidateQueries({ queryKey: ["/api/brokers/leads"] });
            } else {
                toast.warning(`Status: ${data.status}. ${data.message || ''}`);
            }
        },
        onError: (error: any) => {
            toast.error(error.message || "Email verification failed");
        }
    });

    const filteredLeads = useMemo(() => {
        return leads.filter(lead => {
            const matchesSearch = lead.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                lead.companyNumber?.includes(searchQuery);

            // Postcode matching logic
            let matchesPostcode = true;
            if (postcodeFilter) {
                const pcMatch = lead.address?.match(/([A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})/i);
                if (pcMatch) {
                    const pc = pcMatch[1].replace(/[^A-Z0-9]/ig, '').toUpperCase();
                    const filter = postcodeFilter.replace(/[^A-Z0-9]/ig, '').toUpperCase();
                    matchesPostcode = pc.startsWith(filter);
                } else {
                    matchesPostcode = false;
                }
            }

            const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
            return matchesSearch && matchesPostcode && matchesStatus;
        }).sort((a, b) => {
            if (!sortConfig.key || !sortConfig.direction) return 0;

            let aValue: any;
            let bValue: any;

            if (sortConfig.key === "location") {
                const getPC = (addr: string) => addr?.match(/([A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})/i)?.[1] || "";
                aValue = getPC(a.address || "");
                bValue = getPC(b.address || "");
            } else {
                aValue = a[sortConfig.key as keyof BrokerLead];
                bValue = b[sortConfig.key as keyof BrokerLead];
            }

            if (aValue === bValue) return 0;
            if (aValue === null || aValue === undefined) return 1;
            if (bValue === null || bValue === undefined) return -1;

            const comparison = String(aValue).localeCompare(String(bValue), undefined, { numeric: true, sensitivity: 'base' });
            return sortConfig.direction === "asc" ? comparison : -comparison;
        });
    }, [leads, searchQuery, postcodeFilter, statusFilter, sortConfig]);

    const PAGE_SIZE = 25;
    const totalPages = Math.ceil(filteredLeads.length / PAGE_SIZE);
    const paginatedLeads = filteredLeads.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    useEffect(() => { setCurrentPage(1); }, [searchQuery, postcodeFilter, statusFilter]);

    const requestSort = (key: keyof BrokerLead | "location") => {
        let direction: "asc" | "desc" | undefined = "asc";
        if (sortConfig.key === key && sortConfig.direction === "asc") {
            direction = "desc";
        } else if (sortConfig.key === key && sortConfig.direction === "desc") {
            direction = undefined;
        }
        setSortConfig({ key, direction });
    };

    const SortIcon = ({ column }: { column: keyof BrokerLead | "location" }) => {
        if (sortConfig.key !== column) return <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />;
        if (sortConfig.direction === "asc") return <ArrowUp className="ml-2 h-4 w-4 text-primary" />;
        if (sortConfig.direction === "desc") return <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
        return <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />;
    };

    function getPageNumbers(current: number, total: number): (number | "...")[] {
        if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
        const pages: (number | "...")[] = [1];
        if (current > 3) pages.push("...");
        for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
        if (current < total - 2) pages.push("...");
        pages.push(total);
        return pages;
    }

    usePageTitle("Introducers", "Manage and recruit external brokers for your lender network");

    return (
        <div className="space-y-6 pt-6 pb-12 w-full px-4 md:px-8">
            {selectedLead && (
                <BrokerLeadDetail
                    lead={selectedLead}
                    open={!!selectedLead}
                    onOpenChange={(open) => !open && setSelectedLead(null)}
                />
            )}

            <Tabs defaultValue="pipeline" className="w-full">
                <TabsList>
                    <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
                    <TabsTrigger value="leads">All Introducers</TabsTrigger>
                </TabsList>

                <TabsContent value="pipeline" className="pt-4 space-y-4">
                    <div className="flex justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={sweepMutation.isPending}
                            onClick={() => {
                                if (confirm("Scan the main Leads and Pipeline lists for accountants/CFOs/introducers and move them here?")) {
                                    sweepMutation.mutate();
                                }
                            }}
                        >
                            {sweepMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                            Sweep main pipeline for introducers
                        </Button>
                    </div>
                    <IntroducerPipeline leads={leads} isLoading={isLoading} onSelectLead={setSelectedLead} />
                </TabsContent>

                <TabsContent value="leads" className="space-y-6 pt-4">
            <div className="flex items-center justify-between">
                <div></div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setLocation("/god-mode")}>
                        Admin Home
                    </Button>

                    <Dialog open={discoveryDialogOpen} onOpenChange={setDiscoveryDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="secondary">
                                <Search className="mr-2 h-4 w-4" /> Find Introducers
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Search className="h-4 w-4" /> Broker Discovery Agent
                                </DialogTitle>
                                <DialogDescription>
                                    Recruit brokers by searching specific regions or industries.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="town">Target Region (Town/City)</Label>
                                    <Input
                                        id="town"
                                        placeholder="e.g. London, Manchester, Bristol"
                                        value={discoveryTown}
                                        onChange={(e) => setDiscoveryTown(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="sicCodes">SIC Industry Filter</Label>
                                    <Input
                                        id="sicCodes"
                                        placeholder="e.g. 64921 (Finance), 66190"
                                        value={discoverySicCodes}
                                        onChange={(e) => setDiscoverySicCodes(e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center space-x-2 pt-2">
                                    <Checkbox
                                        id="autoEnrich"
                                        checked={discoveryAutoEnrich}
                                        onCheckedChange={(checked) => setDiscoveryAutoEnrich(!!checked)}
                                    />
                                    <Label htmlFor="autoEnrich" className="text-sm font-medium cursor-pointer">
                                        Auto-Enrich discovered brokers
                                    </Label>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={triggerDiscovery} disabled={discoverLeadsMutation.isPending}>
                                    {discoverLeadsMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Search className="mr-2 h-4 w-4" />}
                                    Start Discovery
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Button variant="destructive" onClick={() => { if (confirm("Wipe Broker DB?")) clearLeadsMutation.mutate(); }}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <AgentJobProgress userId={user?.id} />

            <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/30 rounded-lg border border-dashed">
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search brokers..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="w-[200px] relative">
                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Postcode (e.g. SW1)"
                        className="pl-9"
                        value={postcodeFilter}
                        onChange={(e) => setPostcodeFilter(e.target.value)}
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                        <Activity className="h-3 w-3 mr-2" />
                        <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="new">Identified</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="non_responsive">Non-responsive</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="rounded-lg border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead 
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => requestSort("companyName")}
                            >
                                <div className="flex items-center">
                                    Introducer
                                    <SortIcon column="companyName" />
                                </div>
                            </TableHead>
                            <TableHead 
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => requestSort("location")}
                            >
                                <div className="flex items-center">
                                    Location
                                    <SortIcon column="location" />
                                </div>
                            </TableHead>
                            <TableHead 
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => requestSort("contactName")}
                            >
                                <div className="flex items-center">
                                    Contact Name
                                    <SortIcon column="contactName" />
                                </div>
                            </TableHead>
                            <TableHead>Telephone</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead 
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => requestSort("status")}
                            >
                                <div className="flex items-center">
                                    Status
                                    <SortIcon column="status" />
                                </div>
                            </TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-10">Loading brokers...</TableCell></TableRow>
                        ) : filteredLeads.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No brokers found.</TableCell></TableRow>
                        ) : (
                            paginatedLeads.map((lead) => (
                                <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLead(lead)}>
                                    {(() => {
                                        const pcMatch = lead.address?.match(/([A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})/i);
                                        const loc = pcMatch ? (() => {
                                            const raw = pcMatch[1].replace(/[^A-Z0-9]/ig, '').toUpperCase();
                                            return raw.length > 3 ? `${raw.slice(0, -3)} ${raw.slice(-3)}` : raw;
                                        })() : "—";
                                        
                                        const phoneRaw = lead.phone || "";
                                        const waNumber = phoneRaw.startsWith('0') ? '44' + phoneRaw.slice(1).replace(/[^0-9]/g, '') : phoneRaw.replace(/[^0-9]/g, '');

                                        return (
                                            <>
                                                <TableCell className="font-medium">{lead.companyName}</TableCell>
                                                <TableCell className="text-muted-foreground font-mono text-sm">{loc}</TableCell>
                                                <TableCell>{lead.contactName || "—"}</TableCell>
                                                <TableCell>{lead.phone || "—"}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        {lead.email ? (
                                                            <button 
                                                                className="text-blue-500 hover:underline truncate max-w-[150px] text-left bg-transparent border-none p-0 cursor-pointer"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setLocation(`/gmail?compose=true&to=${lead.email}&name=${encodeURIComponent(lead.contactName || '')}`);
                                                                }}
                                                            >
                                                                {lead.email}
                                                            </button>
                                                        ) : "—"}
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-muted-foreground hover:text-primary"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                verifyEmailMutation.mutate(lead.id);
                                                            }}
                                                            disabled={verifyEmailMutation.isPending && verifyEmailMutation.variables === lead.id}
                                                            title="Verify Email Quality & Find Alternatives"
                                                        >
                                                            {verifyEmailMutation.isPending && verifyEmailMutation.variables === lead.id ? (
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                            ) : (
                                                                <ShieldCheck className="h-3 w-3" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="capitalize">{lead.status}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button 
                                                            variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                window.open(`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent((lead.contactName || "") + ' ' + lead.companyName)}`, '_blank');
                                                            }}
                                                            title="Search LinkedIn"
                                                        >
                                                            <Linkedin className="h-4 w-4" />
                                                        </Button>
                                                        {lead.email && (
                                                            <Button 
                                                                variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-slate-800 hover:bg-slate-100"
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    setLocation(`/gmail?compose=true&to=${lead.email}&name=${encodeURIComponent(lead.contactName || '')}`);
                                                                }}
                                                                title="Send Email"
                                                            >
                                                                <Mail className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        {waNumber && (
                                                            <Button 
                                                                variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    window.open(`https://wa.me/${waNumber}`, '_blank');
                                                                }}
                                                                title="WhatsApp"
                                                            >
                                                                <MessageCircle className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedLead(lead); }}>
                                                            Details
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </>
                                        );
                                    })()}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
                {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 px-4 pb-4">
                        <p className="text-sm text-muted-foreground">
                            Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredLeads.length)} of {filteredLeads.length}
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
                </TabsContent>
            </Tabs>
        </div>
    );
}
