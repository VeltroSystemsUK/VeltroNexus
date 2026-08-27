import { useState, useRef } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ProspectWithCompany } from "@shared/schema";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
    Upload,
    FileText,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Link as LinkIcon,
    RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { CreditsafeCheck } from "@/components/CreditsafeCheck";
import { AccountsAnalysis } from "@/components/AccountsAnalysis";
import { unwrapDueDiligence } from "@shared/dueDiligence";

export default function FinancialsPage() {
    const [match, params] = useRoute("/prospect/:id/underwriting/financials");
    const prospectId = params?.id ? parseInt(params.id) : 0;

    const { data: prospect } = useQuery<ProspectWithCompany>({
        queryKey: [`/api/prospects/${prospectId}`],
    });

    const { data: dueDiligenceRaw } = useQuery<unknown>({
        queryKey: [`/api/prospects/${prospectId}/due-diligence`],
    });

    const dueDiligenceData = unwrapDueDiligence(dueDiligenceRaw);
    const underwriting = dueDiligenceData.underwriting || {};

    // State for CSV Upload
    const [csvFileName, setCsvFileName] = useState(underwriting.csvFileName || "");
    const [isAnalyzeCsvPending, setIsAnalyzeCsvPending] = useState(false);

    // Mutations
    const analyzeCsvMutation = useMutation({
        mutationFn: async (csvData: string) => {
            const response = await apiRequest(
                `/api/prospects/${prospectId}/underwriting/analyze-csv`,
                "POST",
                {
                    csvData,
                    loanAmount: underwriting.loanDetails?.amount || 0,
                    monthlyRepayment: underwriting.loanDetails?.monthlyRepayment || 0,
                    consentToAiProcessing: true,
                }
            );
            return response.json();
        },
        onSuccess: () => {
            toast.success("Financial analysis complete");
            queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospectId}/due-diligence`] });
        },
        onError: (error: any) => {
            toast.error(error.message || "Failed to analyze CSV");
        }
    });

    const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith(".csv")) {
            toast.error("Please upload a CSV file");
            return;
        }

        setCsvFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            // In a real app we might validate content here

            // Auto-analyze or wait for button? Original tool did it on a separate button click or immediate?
            // Let's offer a button to analyze to be clear.
            analyzeCsvMutation.mutate(text);
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Financial Data</h2>
                    <p className="text-muted-foreground">Upload and manage financial documents for analysis</p>
                </div>
            </div>

            <Tabs defaultValue="banking" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="banking">Banking Data</TabsTrigger>
                    <TabsTrigger value="accounts">Company Accounts</TabsTrigger>
                    <TabsTrigger value="integrations">Integrations</TabsTrigger>
                </TabsList>

                <TabsContent value="banking" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Bank Statements (CSV)</CardTitle>
                            <CardDescription>Upload raw transaction data for AI analysis.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid w-full max-w-sm items-center gap-1.5">
                                <Label htmlFor="csv_upload">Upload Statement (CSV)</Label>
                                <Input id="csv_upload" type="file" accept=".csv" onChange={handleCsvUpload} disabled={analyzeCsvMutation.isPending} />
                            </div>

                            {csvFileName && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted p-2 rounded">
                                    <FileText className="h-4 w-4" />
                                    {csvFileName}
                                    {analyzeCsvMutation.isPending && <Loader2 className="h-3 w-3 animate-spin ml-2" />}
                                    {analyzeCsvMutation.isSuccess && <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />}
                                </div>
                            )}

                            {underwriting.financialAnalysis && (
                                <div className="rounded-md border p-4 bg-muted/20">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                        <span className="font-semibold">Analysis Generated</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Risk Score: {underwriting.financialAnalysis.riskScore} •
                                        DSCR: {underwriting.financialAnalysis.dscr?.toFixed(2)}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Add PDF Bank Statement Upload here if needed */}
                </TabsContent>

                <TabsContent value="accounts" className="space-y-4">
                    {prospect && <AccountsAnalysis prospect={prospect} />}
                </TabsContent>

                <TabsContent value="integrations" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Open Banking & Accounting</CardTitle>
                            <CardDescription>Connect external data sources.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                            <LinkIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div>
                                            <div className="font-medium">Open Banking</div>
                                            <div className="text-xs text-muted-foreground">Connect bank accounts directly</div>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm">Connect</Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    {prospect && <CreditsafeCheck prospect={prospect} />}
                </TabsContent>
            </Tabs>
        </div>
    );
}
