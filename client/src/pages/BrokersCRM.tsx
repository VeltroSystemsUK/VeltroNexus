import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
    Card,
    CardContent,
    CardDescription,
    CardTitle,
} from "@/components/ui/card";
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Search,
    Filter,
    MapPin,
    Briefcase,
    CheckCircle,
    Loader2,
    Activity,
    Users,
    Trash2,
    Plus
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { AgentJobProgress } from "@/components/AgentJobProgress";
import { useAuth } from "@/hooks/useAuth";
import { BrokerLead } from "@shared/schema";
import { toast } from "sonner";
import { useLocation } from "wouter";

// Broker Details Component
import BrokerLeadDetail from "@/components/BrokerLeadDetail";

export default function BrokersCRM() {
    const [, setLocation] = useLocation();
    const { user } = useAuth();

    const [selectedLead, setSelectedLead] = useState<BrokerLead | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [cityFilter, setCityFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");

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

    const cities = useMemo(() => Array.from(new Set(leads.map(l => l.city).filter(Boolean))) as string[], [leads]);

    const filteredLeads = useMemo(() => {
        return leads.filter(lead => {
            const matchesSearch = lead.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                lead.companyNumber?.includes(searchQuery);
            const matchesCity = cityFilter === "all" || lead.city === cityFilter;
            const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
            return matchesSearch && matchesCity && matchesStatus;
        });
    }, [leads, searchQuery, cityFilter, statusFilter]);

    return (
        <div className="space-y-6 pt-6 pb-12 w-full px-4 md:px-8">
            {selectedLead && (
                <BrokerLeadDetail
                    lead={selectedLead}
                    open={!!selectedLead}
                    onOpenChange={(open) => !open && setSelectedLead(null)}
                />
            )}

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Users className="h-8 w-8 text-primary" />
                        Brokers CRM
                    </h1>
                    <p className="text-muted-foreground mt-1">Manage and recruit external brokers for your lender network.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setLocation("/god-mode")}>
                        Admin Home
                    </Button>

                    <Dialog open={discoveryDialogOpen} onOpenChange={setDiscoveryDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="secondary">
                                <Search className="mr-2 h-4 w-4" /> Recruit Brokers
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>🔍 Broker Discovery Agent</DialogTitle>
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
                <Select value={cityFilter} onValueChange={setCityFilter}>
                    <SelectTrigger className="w-[180px]">
                        <MapPin className="h-3 w-3 mr-2" />
                        <SelectValue placeholder="All Cities" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Cities</SelectItem>
                        {cities.map(city => <SelectItem key={city} value={city}>{city}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                        <Activity className="h-3 w-3 mr-2" />
                        <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="rounded-lg border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Broker Company</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>SIC Code</TableHead>
                            <TableHead>Commission</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-10">Loading brokers...</TableCell></TableRow>
                        ) : filteredLeads.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No brokers found.</TableCell></TableRow>
                        ) : (
                            filteredLeads.map((lead) => (
                                <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLead(lead)}>
                                    <TableCell className="font-medium">{lead.companyName}</TableCell>
                                    <TableCell className="text-muted-foreground">{lead.city || "Unknown"}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="capitalize">{lead.status}</Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">{lead.sicCode || "—"}</TableCell>
                                    <TableCell>{(lead.commissionRate * 100).toFixed(1)}%</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedLead(lead); }}>Details</Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
