import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { ProspectWithCompany } from "@shared/schema";
import { unwrapDueDiligence } from "@shared/dueDiligence";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    CheckCircle2,
    XCircle,
    AlertTriangle,
    TrendingUp,
    Shield,
    Activity
} from "lucide-react";

export default function UnderwritingDashboard() {
    const [match, params] = useRoute("/prospect/:id/underwriting/dashboard");
    const prospectId = params?.id ? parseInt(params.id) : 0;

    // Re-fetch data (React Query handles deduping with Layout)
    const { data: prospect } = useQuery<ProspectWithCompany>({
        queryKey: [`/api/prospects/${prospectId}`],
    });

    const { data: dueDiligenceRaw } = useQuery<unknown>({
        queryKey: [`/api/prospects/${prospectId}/due-diligence`],
    });

    if (!prospect || !dueDiligenceRaw) {
        return <div>Loading dashboard...</div>;
    }

    const dueDiligenceData = unwrapDueDiligence(dueDiligenceRaw);
    const underwriting = dueDiligenceData.underwriting || {};
    const financialAnalysis = underwriting.financialAnalysis;
    const accountsAnalysis = underwriting.accountsAnalysis;
    const decisionDscr = financialAnalysis?.dscr ?? accountsAnalysis?.dscr?.average;
    const adverseMedia = underwriting.adverseMedia;
    const swotAnalysis = underwriting.swotAnalysis;
    const creditsafe = underwriting.creditsafe;
    const isEligible = underwriting.eligibility?.isEligible;

    const DSCR_THRESHOLD = 1.25;

    const getRiskGradeBadge = (score: number) => {
        if (score >= 80) return <Badge className="bg-green-500">Low Risk (A)</Badge>;
        if (score >= 60) return <Badge className="bg-lime-500">Moderate Risk (B)</Badge>;
        if (score >= 40) return <Badge className="bg-yellow-500">Medium Risk (C)</Badge>;
        return <Badge className="bg-red-500">High Risk (D)</Badge>;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Credit Dashboard</h2>
                    <p className="text-muted-foreground">Overview of credit risk and application status</p>
                </div>
                {financialAnalysis && getRiskGradeBadge(Number(financialAnalysis.riskScore) || 0)}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{financialAnalysis?.riskScore || "N/A"}</div>
                        <p className="text-xs text-muted-foreground">Automated Assessment</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Eligibility</CardTitle>
                        <Shield className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            {isEligible === undefined ? (
                                <span className="text-2xl font-bold text-muted-foreground">Pending</span>
                            ) : isEligible ? (
                                <>
                                    <span className="text-2xl font-bold text-green-600">Passed</span>
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                </>
                            ) : (
                                <>
                                    <span className="text-2xl font-bold text-destructive">Failed</span>
                                    <XCircle className="h-4 w-4 text-destructive" />
                                </>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">Basic Criteria Check</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">DSCR</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <span className={`text-2xl font-bold ${(decisionDscr || 0) >= DSCR_THRESHOLD ? "text-green-600" : "text-amber-600"}`}>
                                {decisionDscr != null ? `${decisionDscr.toFixed(2)}x` : "N/A"}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">Target: {DSCR_THRESHOLD}x</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Adverse Media</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold capitalize">
                            {adverseMedia?.riskLevel?.toLowerCase() || "Not Checked"}
                        </div>
                        <p className="text-xs text-muted-foreground">Reputational Risk</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Main Decision Summary */}
                <Card className="col-span-2">
                    <CardHeader>
                        <CardTitle>Decision Summary</CardTitle>
                        <CardDescription>Automated insights based on financial data and eligibility</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {financialAnalysis?.summary || swotAnalysis?.summary ? (
                            <div className="space-y-3 text-sm leading-relaxed">
                                {financialAnalysis?.summary && <p>{financialAnalysis.summary}</p>}
                                {swotAnalysis?.summary && <p><span className="font-medium">SWOT:</span> {swotAnalysis.summary}</p>}
                                {creditsafe && <p><span className="font-medium">Creditsafe:</span> {creditsafe.score || "No score"} · {creditsafe.rating || "No rating"}</p>}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                                <p>No analysis generated yet. Complete the Financials section to generate insights.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
