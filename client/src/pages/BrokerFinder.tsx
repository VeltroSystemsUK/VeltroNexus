import React, { useState, useEffect, useMemo } from "react";
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
    CheckCircle,
    Loader2,
    ArrowRightCircle,
    Info,
    Users
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
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
    // Fields required by LeadDetailsSheet; not populated for broker results
    emailConfidence: string | null;
    pecrStatus: string | null;
    leadScore: number | null;
}

export default function BrokerFinder() {
    const [, setLocation] = useLocation();
    const [instruction, setInstruction] = useState("");
    const [isPolling, setIsPolling] = useState(false);
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);

    const { data: results = [], isLoading } = useQuery<BrokerResult[]>({
        queryKey: ["/api/broker-finder/results"],
        refetchInterval: isPolling ? 3000 : false,
    });

    const runAgentMutation = useMutation({
        mutationFn: (instruction: string) => apiRequest("/api/broker-finder/run", "POST", { instruction }),
        onSuccess: () => {
            toast.success("Broker Agent started!");
            setIsPolling(true);
            setTimeout(() => setIsPolling(false), 60000);
        },
    });

    const migrateMutation = useMutation({
        mutationFn: (placeId: string) => apiRequest(`/api/broker-finder/migrate/${placeId}`, "POST"),
        onSuccess: () => {
            toast.success("Broker migrated to CRM!");
            queryClient.invalidateQueries({ queryKey: ["/api/broker-finder/results"] });
        },
    });

    const selectedLead = useMemo(() =>
        results.find(r => r.googlePlaceId === selectedLeadId) || null
        , [results, selectedLeadId]);

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
        <div className="space-y-6 pt-6 pb-12 w-full px-4 md:px-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Users className="h-8 w-8 text-primary" />
                        Broker Finder Agent
                    </h1>
                    <p className="text-muted-foreground mt-1">AI-powered discovery for new broker partners.</p>
                </div>
                <Button variant="outline" onClick={() => setLocation("/god-mode")}>Admin Home</Button>
            </div>

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
                            onKeyDown={(e) => e.key === "Enter" && runAgentMutation.mutate(instruction)}
                        />
                        <Button onClick={() => runAgentMutation.mutate(instruction)} disabled={!instruction || runAgentMutation.isPending}>
                            {runAgentMutation.isPending ? <RefreshCw className="animate-spin mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                            Execute
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="rounded-lg border bg-card">
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
                            <TableRow><TableCell colSpan={5} className="text-center py-10">Searching...</TableCell></TableRow>
                        ) : results.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No brokers found yet.</TableCell></TableRow>
                        ) : (
                            paginatedResults.map((r) => (
                                <TableRow key={r.googlePlaceId}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            {r.migrated && <CheckCircle className="h-4 w-4 text-green-500" />}
                                            {r.name}
                                        </div>
                                        {r.website && (
                                            <a href={r.website} target="_blank" className="text-xs text-primary flex items-center gap-1 mt-1">
                                                <Globe className="h-3 w-3" /> {r.website.replace(/^https?:\/\//, "")}
                                            </a>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            {r.rating} <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                            <span className="text-xs text-muted-foreground">({r.reviewCount})</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm"><MapPin className="h-3 w-3 inline mr-1" /> {r.address?.split(",").pop()}</TableCell>
                                    <TableCell className="text-sm">
                                        {r.email && <div className="text-emerald-600 font-medium flex items-center gap-1"><Mail className="h-3 w-3" /> {r.email}</div>}
                                        {r.phone && <div className="text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {r.phone}</div>}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => setSelectedLeadId(r.googlePlaceId)}><Info className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" onClick={() => migrateMutation.mutate(r.googlePlaceId)} disabled={migrateMutation.isPending || r.migrated}>
                                                <ArrowRightCircle className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
                {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 px-4 pb-4">
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

            <LeadDetailsSheet
                lead={selectedLead}
                open={!!selectedLead}
                onOpenChange={(o) => !o && setSelectedLeadId(null)}
            />
        </div>
    );
}
