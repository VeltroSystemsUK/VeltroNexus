import { useState, useMemo } from "react";
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    MapPin,
    Globe,
    Mail,
    Phone,
    Star,
    RefreshCw,
    Play,
    CheckCircle,
    ArrowRightCircle,
    Info,
    Users,
    Trash2,
    Eraser,
    Sparkles,
    Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { usePageTitle } from "@/context/LayoutContext";
import { LeadDetailsSheet } from "@/components/LeadDetailsSheet";

interface BrokerResult {
    googlePlaceId: string;
    name: string;
    rating: number | null;
    reviewCount: number | null;
    status: string | null;
    address: string | null;
    phone: string | null;
    website: string | null;
    email: string | null;
    migrated?: boolean;
    sicCode?: string;
    emailConfidence: string | null;
    emailValidated?: boolean;
    pecrStatus: string | null;
    leadScore: number | null;
    enrichedAt?: string | null;
    contactName?: string | undefined;
}

const INVALIDATE = () => queryClient.invalidateQueries({ queryKey: ["/api/broker-finder/results"] });

export function BrokerFinderTab() {
    const [, setLocation] = useLocation();
    const [instruction, setInstruction] = useState("");
    const [isPolling, setIsPolling] = useState(false);
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());
    const [migratingIds, setMigratingIds] = useState<Set<string>>(new Set());
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
    const [enrichAllLocked, setEnrichAllLocked] = useState(false);

    const { data: results = [], isLoading } = useQuery<BrokerResult[]>({
        queryKey: ["/api/broker-finder/results"],
        refetchInterval: isPolling ? 3000 : false,
    });

    const runAgentMutation = useMutation({
        mutationFn: (instr: string) => apiRequest("/api/broker-finder/run", "POST", { instruction: instr }),
        onSuccess: () => {
            toast.success("Broker Agent started!");
            setIsPolling(true);
            setTimeout(() => setIsPolling(false), 60000);
        },
    });

    const migrateMutation = useMutation({
        mutationFn: (placeId: string) => {
            setMigratingIds(prev => new Set(prev).add(placeId));
            return apiRequest(`/api/broker-finder/migrate/${placeId}`, "POST");
        },
        onSuccess: (data: any, placeId) => {
            setMigratingIds(prev => { const next = new Set(prev); next.delete(placeId); return next; });
            if (data.duplicate) {
                toast.warning(`Broker migrated but may be a duplicate of existing record #${data.existingLeadId}`);
            } else {
                toast.success("Broker sent to Broker CRM!");
            }
            INVALIDATE();
        },
        onError: (_err, placeId) => {
            setMigratingIds(prev => { const next = new Set(prev); next.delete(placeId); return next; });
            toast.error("Failed to send broker to CRM.");
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (placeId: string) => {
            setDeletingIds(prev => new Set(prev).add(placeId));
            return apiRequest(`/api/broker-finder/${placeId}`, "DELETE");
        },
        onSuccess: (_data, placeId) => {
            setDeletingIds(prev => { const next = new Set(prev); next.delete(placeId); return next; });
            toast.success("Record deleted."); INVALIDATE();
        },
        onError: (_err, placeId) => {
            setDeletingIds(prev => { const next = new Set(prev); next.delete(placeId); return next; });
            toast.error("Failed to delete record.");
        },
    });

    const clearAllMutation = useMutation({
        mutationFn: () => apiRequest("/api/broker-finder/all", "DELETE"),
        onSuccess: () => {
            toast.success("All broker results cleared.");
            setCurrentPage(1);
            INVALIDATE();
        },
        onError: () => toast.error("Failed to clear results."),
    });

    const enrichMutation = useMutation({
        mutationFn: (placeId: string) => {
            setEnrichingIds(prev => new Set(prev).add(placeId));
            return apiRequest(`/api/broker-finder/enrich/${placeId}`, "POST");
        },
        onSuccess: (_data, placeId) => {
            setEnrichingIds(prev => { const next = new Set(prev); next.delete(placeId); return next; });
            toast.success("Broker enriched successfully."); INVALIDATE();
        },
        onError: (_err, placeId) => {
            setEnrichingIds(prev => { const next = new Set(prev); next.delete(placeId); return next; });
            toast.error("Enrichment failed — no email found.");
        },
    });

    const enrichAllMutation = useMutation({
        mutationFn: () => {
            setEnrichAllLocked(true);
            return apiRequest("/api/broker-finder/enrich/all", "POST");
        },
        onSuccess: (data: any) => {
            toast.success(`Enrichment running for ${data.queued} brokers in the background.`);
            setIsPolling(true);
            setTimeout(() => setIsPolling(false), 120000);
        },
        onError: () => { setEnrichAllLocked(false); toast.error("Failed to start bulk enrichment."); },
    });

    const unenrichedCount = results.filter(r => !r.enrichedAt && r.website).length;

    const selectedLead = useMemo(() =>
        results.find(r => r.googlePlaceId === selectedLeadId) || null,
        [results, selectedLeadId]
    );

    const PAGE_SIZE = 25;
    const totalPages = Math.ceil(results.length / PAGE_SIZE);
    const paginatedResults = results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    function getPageNumbers(current: number, total: number): (number | "...")[] {
        if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
        const pages: (number | "...")[] = [1];
        if (current > 3) pages.push("...");
        for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
        if (current < total - 2) pages.push("...");
        pages.push(total);
        return pages;
    }

    

    return (
        <TooltipProvider>
            <div className="space-y-6 pt-6 pb-12 w-full px-4 md:px-8">
                {/* Header */}
                

                {/* Mission input */}
                <Card className="bg-muted/30 border-dashed">
                    <CardHeader>
                        <CardTitle className="text-lg">Broker Acquisition Mission</CardTitle>
                        <CardDescription>Tell the agent which brokers to hunt for.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-4">
                            <Input
                                placeholder="e.g., 'Find all mortgage brokers in Bristol with good ratings'"
                                value={instruction}
                                onChange={(e) => setInstruction(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && instruction && runAgentMutation.mutate(instruction)}
                            />
                            <Button
                                onClick={() => runAgentMutation.mutate(instruction)}
                                disabled={!instruction || runAgentMutation.isPending}
                            >
                                {runAgentMutation.isPending
                                    ? <RefreshCw className="animate-spin mr-2 h-4 w-4" />
                                    : <Play className="mr-2 h-4 w-4" />}
                                Execute
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Results table */}
                <div className="rounded-lg border bg-card">
                    {/* Table toolbar */}
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                        <p className="text-sm text-muted-foreground">
                            {results.length > 0 ? `${results.length} broker${results.length !== 1 ? "s" : ""} found` : "No results yet"}
                        </p>
                        {results.length > 0 && (
                            <div className="flex items-center gap-2">
                                {unenrichedCount > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="gap-2 text-violet-600 hover:text-violet-600 hover:bg-violet-500/10"
                                        onClick={() => enrichAllMutation.mutate()}
                                        disabled={enrichAllLocked || enrichAllMutation.isPending}
                                    >
                                        {enrichAllLocked || enrichAllMutation.isPending
                                            ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                            : <Zap className="h-3.5 w-3.5" />}
                                        {enrichAllLocked ? "Enrichment running..." : `Enrich all (${unenrichedCount})`}
                                    </Button>
                                )}
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
                                        disabled={clearAllMutation.isPending}
                                    >
                                        {clearAllMutation.isPending
                                            ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                            : <Eraser className="h-3.5 w-3.5" />}
                                        Wipe all results
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Wipe all broker results?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete all {results.length} records from the Broker Finder database. Any brokers already migrated to CRM will be unaffected.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            onClick={() => clearAllMutation.mutate()}
                                        >
                                            Wipe all
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            </div>
                        )}
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Broker Office</TableHead>
                                <TableHead>Rating</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Contact</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-10">Searching...</TableCell>
                                </TableRow>
                            ) : results.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                                        No brokers found yet. Run a mission above to get started.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedResults.map((r) => (
                                    <TableRow key={r.googlePlaceId}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                {r.migrated && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                                                        </TooltipTrigger>
                                                        <TooltipContent>Migrated to CRM</TooltipContent>
                                                    </Tooltip>
                                                )}
                                                {r.name}
                                            </div>
                                            {r.website && (
                                                <a
                                                    href={r.website}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-xs text-primary flex items-center gap-1 mt-1"
                                                >
                                                    <Globe className="h-3 w-3" />
                                                    {r.website.replace(/^https?:\/\//, "")}
                                                </a>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {r.rating != null ? (
                                                <div className="flex items-center gap-1">
                                                    {r.rating}
                                                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                                    <span className="text-xs text-muted-foreground">({r.reviewCount})</span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            <MapPin className="h-3 w-3 inline mr-1" />
                                            {r.address?.split(",").pop()?.trim() ?? "—"}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {r.email ? (
                                                <div className="flex items-center gap-1.5">
                                                    <Mail className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                                                    <span className="text-emerald-600 font-medium">{r.email}</span>
                                                    {r.emailConfidence && (
                                                        <Badge variant="outline" className={`text-[10px] px-1 py-0 h-4 ${
                                                            r.emailConfidence === "high" ? "border-emerald-500 text-emerald-600" :
                                                            r.emailConfidence === "medium" ? "border-amber-500 text-amber-600" :
                                                            "border-muted-foreground text-muted-foreground"
                                                        }`}>
                                                            {r.emailConfidence}
                                                        </Badge>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-xs italic">
                                                    {r.enrichedAt ? "No email found" : "Not enriched"}
                                                </span>
                                            )}
                                            {r.phone && (
                                                <div className="text-muted-foreground flex items-center gap-1 mt-0.5">
                                                    <Phone className="h-3 w-3" /> {r.phone}
                                                </div>
                                            )}
                                            {r.contactName && (
                                                <div className="text-muted-foreground text-xs mt-0.5">{r.contactName}</div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => setSelectedLeadId(r.googlePlaceId)}
                                                        >
                                                            <Info className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>View details</TooltipContent>
                                                </Tooltip>

                                                {r.website && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className={enrichingIds.has(r.googlePlaceId) ? "text-violet-500 animate-pulse" : r.enrichedAt ? "text-violet-500" : "text-muted-foreground hover:text-violet-500 hover:bg-violet-500/10"}
                                                                onClick={() => enrichMutation.mutate(r.googlePlaceId)}
                                                                disabled={enrichingIds.has(r.googlePlaceId) || enrichAllLocked}
                                                            >
                                                                {enrichingIds.has(r.googlePlaceId) ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            {enrichingIds.has(r.googlePlaceId) ? "Enriching..." : r.enrichedAt ? "Re-enrich" : "Enrich — find email & score"}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                )}

                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => migrateMutation.mutate(r.googlePlaceId)}
                                                            disabled={migratingIds.has(r.googlePlaceId) || !!r.migrated}
                                                        >
                                                            {migratingIds.has(r.googlePlaceId) ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRightCircle className="h-4 w-4" />}
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        {migratingIds.has(r.googlePlaceId) ? "Migrating..." : r.migrated ? "Already in Broker CRM" : "Send to Broker CRM"}
                                                    </TooltipContent>
                                                </Tooltip>

                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => deleteMutation.mutate(r.googlePlaceId)}
                                                            disabled={deletingIds.has(r.googlePlaceId)}
                                                        >
                                                            {deletingIds.has(r.googlePlaceId) ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>{deletingIds.has(r.googlePlaceId) ? "Deleting..." : "Delete record"}</TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 pb-4 pt-3 border-t">
                            <p className="text-sm text-muted-foreground">
                                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, results.length)} of {results.length}
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
                                            <PaginationItem key={`ellipsis-${i}`}>
                                                <PaginationEllipsis />
                                            </PaginationItem>
                                        ) : (
                                            <PaginationItem key={page}>
                                                <PaginationLink
                                                    isActive={currentPage === page}
                                                    onClick={() => setCurrentPage(page)}
                                                    className="cursor-pointer"
                                                >
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

                <LeadDetailsSheet
                    lead={selectedLead}
                    open={!!selectedLead}
                    onOpenChange={(o) => !o && setSelectedLeadId(null)}
                />
            </div>
        </TooltipProvider>
    );
}
