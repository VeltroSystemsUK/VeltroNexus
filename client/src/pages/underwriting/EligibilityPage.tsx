import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ProspectWithCompany, DueDiligenceData } from "@shared/schema";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { ELIGIBILITY_QUESTIONS } from "@/lib/creditUnderwriting/constants";

export default function EligibilityPage() {
    const [match, params] = useRoute("/prospect/:id/underwriting/eligibility");
    const prospectId = params?.id ? parseInt(params.id) : 0;

    const { data: dueDiligenceData } = useQuery<DueDiligenceData>({
        queryKey: [`/api/prospects/${prospectId}/due-diligence`],
    });

    const underwriting = dueDiligenceData?.underwriting || {};
    const [answers, setAnswers] = useState<Record<string, boolean>>({});
    const [isDirty, setIsDirty] = useState(false);

    // Sync state with loaded data
    useEffect(() => {
        if (underwriting.eligibility?.answers) {
            setAnswers(underwriting.eligibility.answers);
        }
    }, [underwriting.eligibility]);

    const saveMutation = useMutation({
        mutationFn: async (updatedData: Partial<DueDiligenceData>) => {
            const res = await apiRequest(
                `/api/prospects/${prospectId}/due-diligence`,
                "POST",
                updatedData
            );
            return res.json();
        },
        onSuccess: () => {
            toast.success("Eligibility saved");
            queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospectId}/due-diligence`] });
            setIsDirty(false);
        },
        onError: (error: Error) => {
            toast.error(`Failed to save: ${error.message}`);
        },
    });

    const checkEligibility = () => {
        const reasons: string[] = [];
        let isEligible = true;

        for (const question of ELIGIBILITY_QUESTIONS) {
            const answer = answers[question.id];
            if (answer === undefined) {
                reasons.push(`Missing answer: ${question.text}`);
                isEligible = false; // Require all answers? Or just fail if wrong? 
                // Original logic: if undefined, isEligible = false (continues)
                continue;
            }

            if (question.category === "eligibility" && answer !== question.requiredAnswer) {
                reasons.push(`Failed: ${question.text}`);
                isEligible = false;
            } else if (question.category === "exclusion" && answer === true) {
                reasons.push(`Exclusion: ${question.text}`);
                isEligible = false;
            }
        }
        return { isEligible, reasons };
    };

    const handleSave = () => {
        const { isEligible, reasons } = checkEligibility();

        // Validate that all questions are answered before determining final status?
        // Original allowed saving interim state if I recall, but let's encourage completion.
        const answeredCount = Object.keys(answers).length;
        if (answeredCount < ELIGIBILITY_QUESTIONS.length) {
            toast.warning("Assessment incomplete", { description: "You can save progress, but eligibility cannot be determined yet." });
            // We still save the answers though
        }

        saveMutation.mutate({
            underwriting: {
                ...underwriting,
                eligibility: {
                    answers,
                    isEligible: answeredCount === ELIGIBILITY_QUESTIONS.length ? isEligible : undefined,
                    ineligibilityReasons: reasons,
                },
            },
        });
    };

    const currentStatus = underwriting.eligibility?.isEligible;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Eligibility Check</h2>
                    <p className="text-muted-foreground">Verify the prospect against core lending criteria</p>
                </div>

                <div className="flex items-center gap-2">
                    {currentStatus !== undefined && (
                        <Badge variant={currentStatus ? "default" : "destructive"} className="text-base px-4 py-1">
                            {currentStatus ? "Eligible" : "Not Eligible"}
                        </Badge>
                    )}
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Mandatory Criteria</CardTitle>
                    <CardDescription>All questions must be answered to proceed.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {ELIGIBILITY_QUESTIONS.map((q) => (
                        <div key={q.id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                            <Checkbox
                                id={q.id}
                                checked={answers[q.id] || false}
                                onCheckedChange={(checked) => {
                                    setAnswers(prev => ({ ...prev, [q.id]: checked === true }));
                                    setIsDirty(true);
                                }}
                                className="mt-1"
                            />
                            <div className="space-y-1 leading-none">
                                <Label
                                    htmlFor={q.id}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                >
                                    {q.text}
                                </Label>
                                {q.category === "exclusion" && (
                                    <p className="text-xs text-muted-foreground text-destructive/80">
                                        (Checking this will disqualify the applicant)
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </CardContent>
                <CardFooter className="flex justify-between border-t pt-6">
                    <Button variant="ghost" onClick={() => {
                        setAnswers({});
                        setIsDirty(true);
                    }}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reset
                    </Button>
                    <Button onClick={handleSave} disabled={saveMutation.isPending || !isDirty}>
                        <Save className="h-4 w-4 mr-2" />
                        {saveMutation.isPending ? "Saving..." : "Save Assessment"}
                    </Button>
                </CardFooter>
            </Card>

            {underwriting.eligibility?.ineligibilityReasons?.length ? (
                <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
                    <CardHeader>
                        <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                            <AlertCircle className="h-5 w-5" />
                            <CardTitle className="text-base">Ineligibility Reasons</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ul className="list-disc list-inside space-y-1 text-sm text-red-600 dark:text-red-300">
                            {underwriting.eligibility.ineligibilityReasons.map((reason: string, i: number) => (
                                <li key={i}>{reason}</li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            ) : null}
        </div>
    );
}
