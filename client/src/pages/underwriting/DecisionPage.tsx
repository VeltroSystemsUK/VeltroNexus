import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { ProspectWithCompany } from "@shared/schema";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, TrendingUp, ChevronRight, FileCheck } from "lucide-react";
import { ARRANGEMENT_FEE_PERCENT, DSCR_THRESHOLD } from "@/lib/creditUnderwriting/constants";
import { unwrapDueDiligence } from "@shared/dueDiligence";

export default function DecisionPage() {
    const [match, params] = useRoute("/prospect/:id/underwriting/decision");
    const [, setLocation] = useLocation();
    const prospectId = params?.id ? parseInt(params.id) : 0;

    const { data: dueDiligenceRaw } = useQuery<unknown>({
        queryKey: [`/api/prospects/${prospectId}/due-diligence`],
    });

    const dueDiligenceData = unwrapDueDiligence(dueDiligenceRaw);
    const underwriting = dueDiligenceData.underwriting || {};
    const financialAnalysis = underwriting.financialAnalysis;
    const accountsDscr = underwriting.accountsAnalysis?.dscr?.average;
    const decisionDscr = financialAnalysis?.dscr ?? accountsDscr;
    const creditsafe = underwriting.creditsafe;
    const isEligible = underwriting.eligibility?.isEligible;
    const loanAmount = underwriting.loanDetails?.amount || 0;
    const termMonths = underwriting.loanDetails?.termMonths || 0;
    const interestRate = underwriting.loanDetails?.interestRate || 0;
    const monthlyRepayment = underwriting.loanDetails?.monthlyRepayment || 0;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: "GBP",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Automated Decision Results</h2>
                    <p className="text-muted-foreground">Review the calculated risk profile and loan parameters</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Loan Parameters</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Loan Amount</span>
                            <span className="font-bold">{formatCurrency(loanAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Term</span>
                            <span className="font-medium">{termMonths} months</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Interest Rate</span>
                            <span className="font-medium">{interestRate}%</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Monthly Repayment</span>
                            <span className="font-bold text-primary">
                                {formatCurrency(monthlyRepayment)}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Arrangement Fee ({ARRANGEMENT_FEE_PERCENT}%)</span>
                            <span className="font-medium">
                                {formatCurrency(loanAmount * (ARRANGEMENT_FEE_PERCENT / 100))}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Risk Assessment</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">DSCR</span>
                            <div className="flex items-center gap-2">
                                    <span className={`font-bold ${(decisionDscr || 0) >= DSCR_THRESHOLD ? "text-green-600" : "text-red-600"}`}>
                                    {decisionDscr != null ? `${decisionDscr.toFixed(2)}x` : "N/A"}
                                </span>
                                {(decisionDscr || 0) >= DSCR_THRESHOLD ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                    <XCircle className="h-4 w-4 text-red-500" />
                                )}
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Threshold</span>
                            <span className="font-medium">{DSCR_THRESHOLD}x</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Eligibility</span>
                            <Badge variant={isEligible ? "default" : "destructive"}>
                                {isEligible ? "Eligible" : "Not Eligible"}
                            </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Risk Score</span>
                            <span className="font-medium">{financialAnalysis?.riskScore || "N/A"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Creditsafe</span>
                            <span className="font-medium">{creditsafe?.score || "N/A"}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Decision Summary</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm leading-relaxed">
                        {financialAnalysis?.summary || "No analysis summary available. Please complete the Financials section."}
                    </p>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={() => setLocation(`/prospect/${prospectId}/underwriting/summary`)}>
                    Proceed to Adviser Summary
                    <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
            </div>
        </div>
    );
}
