import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Circle, AlertCircle as AlertCircleIcon } from "lucide-react";

interface ChecklistItem {
    id: string;
    text: string;
    required: boolean;
    docReference?: string;
}

interface Checklist {
    id: string;
    title: string;
    description: string;
    items: ChecklistItem[];
}

const complianceChecklists: Checklist[] = [
    {
        id: "new_client_onboarding",
        title: "New Client Onboarding",
        description: "Mandatory steps for onboarding a new credit broking client.",
        items: [
            { id: "idd_provided", text: "Provide Initial Disclosure Document (IDD)", required: true, docReference: "DOC_001" },
            { id: "privacy_notice", text: "Provide Privacy Notice (GDPR)", required: true, docReference: "DOC_002" },
            { id: "sanctions_check", text: "Perform Sanctions Screening", required: true, docReference: "AML_002" },
            { id: "vulnerability_assessment", text: "Conduct Vulnerability Assessment (TEXAS model)", required: true, docReference: "DOC_005" },
            { id: "needs_analysis", text: "Complete Needs & Circumstances Analysis", required: true },
            { id: "adequate_explanations", text: "Provide Adequate Explanations (Pre-Contract Info)", required: true, docReference: "DOC_003" },
        ]
    },
    {
        id: "annual_compliance_review",
        title: "Annual Compliance Review",
        description: "Yearly governance and monitoring tasks.",
        items: [
            { id: "review_policies", text: "Review and update all compliance policies", required: true },
            { id: "fit_proper_assessments", text: "Complete annual Fit & Proper assessments for certified staff", required: true, docReference: "SMCR_002" },
            { id: "data_protection_audit", text: "Conduct Data Protection / GDPR Audit", required: true },
            { id: "complaints_analysis", text: "Analyze complaints data for root causes", required: true, docReference: "DOC_004" },
            { id: "submit_regdata", text: "Submit annual RegData returns (CCR007 / CCR001)", required: true, docReference: "RPT_001" },
        ]
    },
    {
        id: "file_check",
        title: "Client File Quality Check",
        description: "Routine CMP check for individual client files.",
        items: [
            { id: "id_verification", text: "Is client identity verified?", required: true },
            { id: "suitability_statement", text: "Is the product suitability statement clear and personalized?", required: true },
            { id: "commission_disclosure", text: "Was commission existence and nature disclosed?", required: true, docReference: "DOC_001" },
            { id: "affordability_evidence", text: "Is there evidence of affordability assessment?", required: true },
            { id: "vulnerability_recorded", text: "Are any vulnerabilities recorded and supported?", required: false },
        ]
    }
];

export function ComplianceChecklist() {
    // Load state from localStorage or default to empty object
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
        const saved = localStorage.getItem("complianceChecklistState");
        return saved ? JSON.parse(saved) : {};
    });

    const [activeChecklist, setActiveChecklist] = useState<string>(complianceChecklists[0].id);

    // Save state to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem("complianceChecklistState", JSON.stringify(checkedItems));
    }, [checkedItems]);

    const handleCheckChange = (itemId: string, checked: boolean) => {
        setCheckedItems(prev => ({
            ...prev,
            [itemId]: checked
        }));
    };

    const getProgress = (checklistId: string) => {
        const checklist = complianceChecklists.find(c => c.id === checklistId);
        if (!checklist) return 0;

        const checkedCount = checklist.items.filter(item => checkedItems[`${checklistId}_${item.id}`]).length;
        return Math.round((checkedCount / checklist.items.length) * 100);
    };

    const currentChecklist = complianceChecklists.find(c => c.id === activeChecklist);

    return (
        <div className="grid gap-6 md:grid-cols-[300px_1fr]">
            {/* Sidebar / Checklist Selection */}
            <Card className="h-fit">
                <CardHeader className="pb-3 border-b border-border/60">
                    <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Checklists</CardTitle>
                    <CardDescription className="text-[11px]">Select a workflow</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[400px]">
                        <div className="flex flex-col">
                            {complianceChecklists.map((checklist) => {
                                const progress = getProgress(checklist.id);
                                return (
                                    <button
                                        key={checklist.id}
                                        onClick={() => setActiveChecklist(checklist.id)}
                                        className={`text-left p-4 border-l-4 transition-colors hover:bg-muted/50 ${activeChecklist === checklist.id
                                                ? "border-primary bg-muted/30"
                                                : "border-transparent"
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-medium text-sm">{checklist.title}</span>
                                            {progress === 100 && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                        </div>
                                        <Progress value={progress} className="h-1.5 mb-1" />
                                        <span className="text-xs text-muted-foreground">{progress}% Complete</span>
                                    </button>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>

            {/* Main Checklist View */}
            <Card className="min-h-[500px]">
                {currentChecklist && (
                    <>
                        <CardHeader className="pb-3 border-b border-border/60">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-sm font-semibold">{currentChecklist.title}</CardTitle>
                                    <CardDescription className="mt-1 text-xs">{currentChecklist.description}</CardDescription>
                                </div>
                                <Badge variant="outline" className="text-[10px] tabular-nums">
                                    {getProgress(currentChecklist.id)}% Done
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {currentChecklist.items.map((item) => {
                                    const isChecked = checkedItems[`${currentChecklist.id}_${item.id}`] || false;
                                    return (
                                        <div
                                            key={item.id}
                                            className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${isChecked ? "bg-muted/30 border-primary/20" : "bg-card hover:bg-muted/10"
                                                }`}
                                        >
                                            <Checkbox
                                                id={`${currentChecklist.id}_${item.id}`}
                                                checked={isChecked}
                                                onCheckedChange={(checked) => handleCheckChange(`${currentChecklist.id}_${item.id}`, checked as boolean)}
                                                className="mt-0.5"
                                            />
                                            <div className="flex-1 space-y-1">
                                                <label
                                                    htmlFor={`${currentChecklist.id}_${item.id}`}
                                                    className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer ${isChecked ? "text-muted-foreground line-through decoration-primary/50" : ""
                                                        }`}
                                                >
                                                    {item.text}
                                                </label>
                                                <div className="flex gap-2">
                                                    {item.required && (
                                                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal text-muted-foreground">
                                                            Required
                                                        </Badge>
                                                    )}
                                                    {item.docReference && (
                                                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
                                                            Ref: {item.docReference}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </>
                )}
            </Card>
        </div>
    );
}
