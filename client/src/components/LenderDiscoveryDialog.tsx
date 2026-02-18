import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Globe, Plus, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";

export interface DiscoveryResult {
    institutionName: string;
    website?: string;
    description?: string;
    lenderType?: string;
    productTypes?: string[];
    confidence: number;
    source: string;
    reason?: string;
}

interface LenderDiscoveryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAddLender: (data: Partial<DiscoveryResult>) => void;
}

export default function LenderDiscoveryDialog({ open, onOpenChange, onAddLender }: LenderDiscoveryDialogProps) {
    const [query, setQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<DiscoveryResult[]>([]);

    const handleSearch = async () => {
        if (!query.trim()) return;

        setIsLoading(true);
        try {
            const response = await apiRequest("/api/admin/lenders/discover", "POST", { query });
            const data = await response.json();
            setResults(data);
            if (data.length === 0) {
                toast.info("No new lenders found for this query.");
            }
        } catch (error: any) {
            toast.error(`Discovery failed: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl flex items-center gap-2">
                        <Search className="h-6 w-6 text-primary" />
                        Lender Discovery
                    </DialogTitle>
                    <DialogDescription>
                        Search Companies House, Gemini Grounded Search, and Exa for new or recently launched lenders to add to your database.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex gap-2 my-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="lender-discovery-search"
                            name="query"
                            placeholder="e.g. Invoice finance lenders UK, New bridging lenders 2024..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            className="pl-10 h-11"
                            disabled={isLoading}
                        />
                    </div>
                    <Button onClick={handleSearch} disabled={isLoading || !query.trim()} className="h-11 px-6">
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Discover"}
                    </Button>
                </div>

                <div className="space-y-4">
                    {isLoading && (
                        <div className="py-12 flex flex-col items-center justify-center text-muted-foreground animate-pulse">
                            <Globe className="h-12 w-12 mb-4 animate-bounce text-primary/40" />
                            <p className="font-medium">Scanning external sources & synthesizing data...</p>
                            <p className="text-sm">This may take 15-30 seconds</p>
                        </div>
                    )}

                    {!isLoading && results.length > 0 && (
                        <div className="grid gap-4">
                            {results.map((result, idx) => (
                                <Card key={idx} className="hover:border-primary/50 transition-colors">
                                    <CardContent className="p-5">
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="text-lg font-bold">{result.institutionName}</h3>
                                                    <Badge variant="outline" className="capitalize">
                                                        {result.lenderType?.replace("tier", "Tier ") || "Lender"}
                                                    </Badge>
                                                    <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none">
                                                        {result.confidence}% Match
                                                    </Badge>
                                                </div>

                                                {result.website && (
                                                    <a
                                                        href={result.website.startsWith('http') ? result.website : `https://${result.website}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm text-primary hover:underline flex items-center gap-1 mb-3"
                                                    >
                                                        <Globe className="h-3 w-3" />
                                                        {result.website}
                                                    </a>
                                                )}

                                                <p className="text-sm text-muted-foreground mb-4">
                                                    {result.description}
                                                </p>

                                                <div className="flex flex-wrap gap-2 mb-4">
                                                    {result.productTypes?.map((type: string, i: number) => (
                                                        <Badge key={i} variant="secondary" className="text-[10px] uppercase font-bold tracking-wider">
                                                            {type}
                                                        </Badge>
                                                    ))}
                                                </div>

                                                {result.reason && (
                                                    <div className="flex items-start gap-2 bg-muted/50 p-2 rounded text-xs border border-muted">
                                                        <Info className="h-3 w-3 mt-0.5 text-blue-500" />
                                                        <span><span className="font-semibold">Insight:</span> {result.reason}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <Button
                                                size="sm"
                                                onClick={() => {
                                                    onAddLender(result);
                                                    onOpenChange(false);
                                                }}
                                                className="gap-2"
                                            >
                                                <Plus className="h-4 w-4" />
                                                Add to Directory
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {!isLoading && results.length === 0 && query && (
                        <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                            <p>Search for new lenders to see results here.</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
