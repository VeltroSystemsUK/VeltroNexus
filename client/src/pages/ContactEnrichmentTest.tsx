import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Mail, Phone, User, Award, ExternalLink } from "lucide-react";

interface ContactData {
    email?: string;
    name?: string;
    title?: string;
    phone?: string;
    linkedInUrl?: string;
    enrichmentScore: number;
    confidence: number;
    source: string;
}

interface EnrichmentResult {
    companyName: string;
    companyNumber: string;
    websiteUrl?: string;
    contacts: ContactData[];
    primaryContact?: ContactData;
    enrichmentStatus: "success" | "partial" | "failed";
    failureReason?: string;
}

export default function ContactEnrichmentTest() {
    const { toast } = useToast();
    const [companyName, setCompanyName] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<EnrichmentResult | null>(null);

    const testEnrichment = async () => {
        if (!companyName.trim()) {
            toast({
                title: "Enter a company name",
                variant: "destructive",
            });
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const res = await apiRequest("/api/enrichment/test", "POST", {
                companyName: companyName.trim(),
            });
            const data = await res.json();
            setResult(data);

            toast({
                title: "Enrichment complete!",
                description: `Found ${data.contacts?.length || 0} contacts`,
            });
        } catch (error) {
            toast({
                title: "Enrichment failed",
                description: "Could not enrich company data",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 70) return "text-green-500";
        if (score >= 50) return "text-amber-500";
        return "text-red-500";
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, any> = {
            success: "default",
            partial: "secondary",
            failed: "destructive",
        };
        return variants[status] || "outline";
    };

    return (
        <div className="container mx-auto py-8 space-y-6">
            <div>
                <h1 className="text-base md:text-lg font-bold text-slate-100 uppercase">Contact Enrichment Test</h1>
                <p className="text-slate-400 mt-2">
                    Test AI web scraping to find decision-maker contacts for UK companies
                </p>
            </div>

            {/* Test Input */}
            <Card className="border-slate-800 bg-slate-900/50">
                <CardHeader>
                    <CardTitle className="text-slate-100">Test Company</CardTitle>
                    <CardDescription>Enter a UK company name to test enrichment</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="companyName" className="text-slate-300">Company Name</Label>
                        <div className="flex gap-2">
                            <Input
                                id="companyName"
                                placeholder="e.g., Monzo Bank Ltd, Revolut Ltd, Brewdog Plc"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && testEnrichment()}
                                className="bg-slate-800 border-slate-700 text-slate-100"
                            />
                            <Button
                                onClick={testEnrichment}
                                disabled={loading}
                                className="gap-2"
                            >
                                <Search className="w-4 h-4" />
                                {loading ? "Enriching..." : "Test"}
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-4">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCompanyName("Monzo Bank Ltd")}
                        >
                            Monzo
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCompanyName("Revolut Ltd")}
                        >
                            Revolut
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCompanyName("Brewdog Plc")}
                        >
                            Brewdog
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Results */}
            {result && (
                <Card className="border-slate-800 bg-slate-900/50">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-slate-100">{result.companyName}</CardTitle>
                                <CardDescription>
                                    {result.websiteUrl && (
                                        <a
                                            href={result.websiteUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                                        >
                                            {result.websiteUrl}
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                </CardDescription>
                            </div>
                            <Badge variant={getStatusBadge(result.enrichmentStatus)}>
                                {result.enrichmentStatus}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {result.failureReason && (
                            <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-lg text-red-400 text-sm">
                                {result.failureReason}
                            </div>
                        )}

                        {result.primaryContact && (
                            <div className="p-4 bg-emerald-950/30 border border-emerald-900/50 rounded-lg space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-emerald-400 font-semibold flex items-center gap-2">
                                        <Award className="w-4 h-4" />
                                        Primary Contact
                                    </h3>
                                    <span className={`text-2xl font-bold ${getScoreColor(result.primaryContact.enrichmentScore)}`}>
                                        {result.primaryContact.enrichmentScore}/100
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {result.primaryContact.name && (
                                        <div className="flex items-center gap-2 text-slate-300">
                                            <User className="w-4 h-4 text-slate-500" />
                                            <span>{result.primaryContact.name}</span>
                                        </div>
                                    )}
                                    {result.primaryContact.title && (
                                        <div className="text-slate-400 text-sm">
                                            {result.primaryContact.title}
                                        </div>
                                    )}
                                    {result.primaryContact.email && (
                                        <div className="flex items-center gap-2 text-slate-300">
                                            <Mail className="w-4 h-4 text-slate-500" />
                                            <span>{result.primaryContact.email}</span>
                                        </div>
                                    )}
                                    {result.primaryContact.phone && (
                                        <div className="flex items-center gap-2 text-slate-300">
                                            <Phone className="w-4 h-4 text-slate-500" />
                                            <span>{result.primaryContact.phone}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {result.contacts && result.contacts.length > 1 && (
                            <div className="space-y-2">
                                <h3 className="text-slate-300 font-semibold">All Contacts ({result.contacts.length})</h3>
                                <div className="space-y-2">
                                    {result.contacts.slice(1).map((contact, idx) => (
                                        <div
                                            key={idx}
                                            className="p-3 bg-slate-800/50 rounded-lg border border-slate-700"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-slate-300 font-medium">
                                                    {contact.name || contact.email || "Unknown"}
                                                </span>
                                                <span className={`text-sm font-semibold ${getScoreColor(contact.enrichmentScore)}`}>
                                                    {contact.enrichmentScore}/100
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-sm text-slate-400">
                                                {contact.title && <div>{contact.title}</div>}
                                                {contact.email && <div>{contact.email}</div>}
                                                {contact.phone && <div>{contact.phone}</div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
