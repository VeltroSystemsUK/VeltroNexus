import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ProspectWithCompany, DueDiligenceData } from "@shared/schema";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    AlertTriangle,
    Search,
    Loader2,
    Sparkles,
    AlertCircle
} from "lucide-react";
import { toast } from "sonner";

export default function AnalysisPage() {
    const [match, params] = useRoute("/prospect/:id/underwriting/analysis");
    const prospectId = params?.id ? parseInt(params.id) : 0;

    const { data: prospect } = useQuery<ProspectWithCompany>({
        queryKey: [`/api/prospects/${prospectId}`],
    });

    const { data: dueDiligenceData } = useQuery<DueDiligenceData>({
        queryKey: [`/api/prospects/${prospectId}/due-diligence`],
    });

    const underwriting = dueDiligenceData?.underwriting || {};
    const adverseMedia = underwriting.adverseMedia;
    const swotAnalysis = underwriting.swotAnalysis;

    // Adverse Media Mutation
    const adverseMediaMutation = useMutation({
        mutationFn: async () => {
            const response = await apiRequest(
                `/api/prospects/${prospectId}/underwriting/adverse-media`,
                "POST",
                {
                    companyName: prospect?.company.companyName,
                    companyNumber: prospect?.company.companyNumber,
                }
            );
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospectId}/due-diligence`] });
            toast.success("Adverse media search complete");
        },
        onError: (error: any) => {
            toast.error(error.message || "Failed to search adverse media");
        },
    });

    // SWOT Analysis Mutation
    const swotMutation = useMutation({
        mutationFn: async () => {
            const financialAnalysis = underwriting.financialAnalysis;

            const financialSummary = financialAnalysis
                ? `Risk Score: ${financialAnalysis.riskScore}, DSCR: ${financialAnalysis.dscr?.toFixed(2) || "N/A"}`
                : "";

            const response = await apiRequest(
                `/api/prospects/${prospectId}/underwriting/swot-analysis`,
                "POST",
                {
                    companyName: prospect?.company.companyName,
                    loanAmount: underwriting.loanDetails?.amount || 0,
                    loanPurpose: "Business Expansion", // TODO: Get from loan details
                    financialSummary,
                    consentToAiProcessing: true,
                }
            );
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospectId}/due-diligence`] });
            toast.success("SWOT analysis generated");
        },
        onError: (error: any) => {
            toast.error(error.message || "Failed to generate SWOT");
        },
    });

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Risk Analysis</h2>
                    <p className="text-muted-foreground">Adverse media checks and SWOT assessment</p>
                </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
                {/* Adverse Media Section */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                                Adverse Media Check
                            </CardTitle>
                            <CardDescription>Automated search for negative news and regulatory issues</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                                <div className="space-y-1">
                                    <span className="text-sm font-medium">Risk Level</span>
                                    <div className="flex">
                                        <Badge variant={
                                            adverseMedia?.riskLevel === "HIGH" ? "destructive" :
                                                adverseMedia?.riskLevel === "MEDIUM" ? "secondary" : "default" // default is actually standard/primary, maybe outline for low?
                                        } className="capitalize">
                                            {adverseMedia?.riskLevel || "Not Checked"}
                                        </Badge>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => adverseMediaMutation.mutate()}
                                    disabled={adverseMediaMutation.isPending}
                                >
                                    {adverseMediaMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Search className="h-4 w-4 mr-2" />
                                            Run Search
                                        </>
                                    )}
                                </Button>
                            </div>

                            {adverseMedia?.flags && adverseMedia.flags.length > 0 && (
                                <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4">
                                    <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-400 mb-2">
                                        <AlertCircle className="h-4 w-4" />
                                        Concerns Identified
                                    </h4>
                                    <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-300 list-disc list-inside">
                                        {adverseMedia.flags.map((flag: string, i: number) => (
                                            <li key={i}>{flag}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* SWOT Analysis Section */}
                <div className="space-y-4">
                    <Card className="h-full flex flex-col">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <div>
                                <CardTitle>SWOT Analysis</CardTitle>
                                <CardDescription>AI-generated strategic assessment</CardDescription>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => swotMutation.mutate()}
                                disabled={swotMutation.isPending}
                            >
                                {swotMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Sparkles className="h-4 w-4 text-primary" />
                                )}
                                <span className="ml-2">Generate</span>
                            </Button>
                        </CardHeader>
                        <CardContent className="flex-1">
                            {swotAnalysis ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded border border-green-100 dark:border-green-900">
                                            <h5 className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">Strengths</h5>
                                            <ul className="text-xs space-y-1 list-disc list-inside text-muted-foreground">
                                                {swotAnalysis.strengths?.slice(0, 3).map((s: string, i: number) => <li key={i} className="truncate">{s}</li>)}
                                            </ul>
                                        </div>
                                        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-100 dark:border-amber-900">
                                            <h5 className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Weaknesses</h5>
                                            <ul className="text-xs space-y-1 list-disc list-inside text-muted-foreground">
                                                {swotAnalysis.weaknesses?.slice(0, 3).map((s: string, i: number) => <li key={i} className="truncate">{s}</li>)}
                                            </ul>
                                        </div>
                                        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-100 dark:border-blue-900">
                                            <h5 className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">Opportunities</h5>
                                            <ul className="text-xs space-y-1 list-disc list-inside text-muted-foreground">
                                                {swotAnalysis.opportunities?.slice(0, 3).map((s: string, i: number) => <li key={i} className="truncate">{s}</li>)}
                                            </ul>
                                        </div>
                                        <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded border border-red-100 dark:border-red-900">
                                            <h5 className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">Threats</h5>
                                            <ul className="text-xs space-y-1 list-disc list-inside text-muted-foreground">
                                                {swotAnalysis.threats?.slice(0, 3).map((s: string, i: number) => <li key={i} className="truncate">{s}</li>)}
                                            </ul>
                                        </div>
                                    </div>
                                    <div className="text-sm bg-muted p-3 rounded">
                                        <span className="font-semibold">Summary: </span>
                                        <span className="text-muted-foreground">{swotAnalysis.summary}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground border-2 border-dashed rounded-lg p-8">
                                    <Sparkles className="h-8 w-8 mb-2 opacity-50" />
                                    <p>No analysis generated yet.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
