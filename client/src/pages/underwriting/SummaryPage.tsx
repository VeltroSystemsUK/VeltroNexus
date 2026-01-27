import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Loader2, Sparkles, Save } from "lucide-react";
import { toast } from "sonner";
import { SUMMARY_SECTIONS, CAMPARI_QUESTIONS } from "@/lib/creditUnderwriting/constants";

export default function SummaryPage() {
    const [match, params] = useRoute("/prospect/:id/underwriting/summary");
    const prospectId = params?.id ? parseInt(params.id) : 0;

    const { data: prospect } = useQuery<ProspectWithCompany>({
        queryKey: [`/api/prospects/${prospectId}`],
    });

    const { data: dueDiligenceData } = useQuery<DueDiligenceData>({
        queryKey: [`/api/prospects/${prospectId}/due-diligence`],
    });

    const underwriting = dueDiligenceData?.underwriting || {};
    const [adviserSummary, setAdviserSummary] = useState<any>({});
    const [generatingSection, setGeneratingSection] = useState<string | null>(null);

    useEffect(() => {
        if (underwriting.adviserSummary) {
            setAdviserSummary(underwriting.adviserSummary);
        } else if (prospect) {
            // Initialize defaults
            setAdviserSummary({
                product: "RGF",
                region: "England",
                sector: "Professional Services",
                purpose: "",
                sections: {},
            });
        }
    }, [underwriting.adviserSummary, prospect]);

    const saveMutation = useMutation({
        mutationFn: async (updatedSummary: any) => {
            const res = await apiRequest(
                `/api/prospects/${prospectId}/due-diligence`,
                "POST",
                {
                    underwriting: {
                        ...underwriting,
                        adviserSummary: updatedSummary
                    }
                }
            );
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospectId}/due-diligence`] });
            toast.success("Summary saved");
        },
        onError: (error: Error) => {
            toast.error("Failed to save summary");
        }
    });

    const aiSectionMutation = useMutation({
        mutationFn: async (sectionKey: string) => {
            setGeneratingSection(sectionKey);
            const financialAnalysis = underwriting.financialAnalysis;
            const accountsAnalysis = underwriting.accountsAnalysis;

            const financialSummary = financialAnalysis ? JSON.stringify(financialAnalysis) : "";

            const response = await apiRequest(
                `/api/prospects/${prospectId}/underwriting/campari-section`,
                "POST",
                {
                    sectionKey,
                    companyName: prospect?.company.companyName,
                    sector: adviserSummary.sector,
                    loanAmount: underwriting.loanDetails?.amount || 0,
                    loanPurpose: adviserSummary.purpose,
                    financialSummary,
                    consentToAiProcessing: true,
                }
            );
            return response.json();
        },
        onSuccess: (result) => {
            const updatedSections = {
                ...adviserSummary.sections,
                [result.sectionKey]: result.content
            };
            const updatedSummary = { ...adviserSummary, sections: updatedSections };
            setAdviserSummary(updatedSummary);
            saveMutation.mutate(updatedSummary);
            setGeneratingSection(null);
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to generate section");
            setGeneratingSection(null);
        }
    });

    const handleSave = () => {
        saveMutation.mutate(adviserSummary);
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-10">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Adviser Summary</h2>
                    <p className="text-muted-foreground">Complete the CAMPARI assessment for final submission</p>
                </div>
                <Button onClick={handleSave} disabled={saveMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {saveMutation.isPending ? "Saving..." : "Save Summary"}
                </Button>
            </div>

            {/* Product & Header Info */}
            <Card>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <Label htmlFor="product">Product</Label>
                            <Select
                                value={adviserSummary.product}
                                onValueChange={(val) => setAdviserSummary({ ...adviserSummary, product: val })}
                            >
                                <SelectTrigger id="product"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="RGF">RGF (Regional Growth Fund)</SelectItem>
                                    <SelectItem value="ELEM2">ELEM2</SelectItem>
                                    <SelectItem value="MEIFII">MEIFII</SelectItem>
                                    <SelectItem value="STARTUP">Start Up Loan</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="sector">Sector</Label>
                            <Input
                                id="sector"
                                value={adviserSummary.sector || ""}
                                onChange={(e) => setAdviserSummary({ ...adviserSummary, sector: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label htmlFor="region">Region</Label>
                            <Select
                                value={adviserSummary.region}
                                onValueChange={(val) => setAdviserSummary({ ...adviserSummary, region: val })}
                            >
                                <SelectTrigger id="region"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="England">England</SelectItem>
                                    <SelectItem value="Scotland">Scotland</SelectItem>
                                    <SelectItem value="Wales">Wales</SelectItem>
                                    <SelectItem value="Northern Ireland">Northern Ireland</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="mt-4">
                        <Label htmlFor="purpose">Purpose of Finance</Label>
                        <Textarea
                            id="purpose"
                            value={adviserSummary.purpose || ""}
                            onChange={(e) => setAdviserSummary({ ...adviserSummary, purpose: e.target.value })}
                            placeholder="Describe the loan purpose..."
                        />
                    </div>
                </CardContent>
            </Card>

            <Separator />

            {/* CAMPARI Tabs */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold">CAMPARI Assessment</h3>
                <Tabs defaultValue="character" className="w-full">
                    <TabsList className="flex flex-wrap h-auto gap-1">
                        {SUMMARY_SECTIONS.slice(2, 9).map((section) => (
                            <TabsTrigger key={section.key} value={section.key}>
                                {section.title.split("–")[0]}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {SUMMARY_SECTIONS.slice(2, 9).map((section) => (
                        <TabsContent key={section.key} value={section.key}>
                            <Card>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base">{section.title}</CardTitle>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={generatingSection !== null}
                                            onClick={() => aiSectionMutation.mutate(section.key)}
                                        >
                                            {generatingSection === section.key ? (
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            ) : (
                                                <Sparkles className="h-4 w-4 text-primary mr-2" />
                                            )}
                                            Auto Write
                                        </Button>
                                    </div>
                                    {CAMPARI_QUESTIONS[section.key] && (
                                        <CardDescription>
                                            Consider: {CAMPARI_QUESTIONS[section.key].slice(0, 2).join(", ")}...
                                        </CardDescription>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    <Textarea
                                        rows={8}
                                        value={adviserSummary.sections?.[section.key] || ""}
                                        onChange={(e) => setAdviserSummary({
                                            ...adviserSummary,
                                            sections: {
                                                ...adviserSummary.sections,
                                                [section.key]: e.target.value
                                            }
                                        })}
                                        placeholder={`Enter ${section.title} details...`}
                                    />
                                </CardContent>
                            </Card>
                        </TabsContent>
                    ))}
                </Tabs>
            </div>

            <Separator />

            {/* Final Recommendation */}
            <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                    <CardTitle>Final Recommendation</CardTitle>
                </CardHeader>
                <CardContent>
                    <Select
                        value={adviserSummary.recommendation || ""}
                        onValueChange={(val) => setAdviserSummary({ ...adviserSummary, recommendation: val })}
                    >
                        <SelectTrigger className="w-full md:w-1/2 bg-background">
                            <SelectValue placeholder="Select Recommendation" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="approve">Recommend Approval</SelectItem>
                            <SelectItem value="approve_conditions">Approve with Conditions</SelectItem>
                            <SelectItem value="refer">Refer to Credit Committee</SelectItem>
                            <SelectItem value="decline">Recommend Decline</SelectItem>
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>
        </div>
    );
}
