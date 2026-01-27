import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    LoanCalculatorTool,
    DSCRCalculatorTool,
    AffordabilityEstimatorTool,
    FinancialRatiosCalculatorTool,
    CharacterAssessmentTool,
} from "@/components/DueDiligenceTools";
import { EmailValidation } from "@/components/EmailValidation";
import {
    Calculator,
    TrendingUp,
    Target,
    FileText,
    User,
    Sparkles,
    Mail
} from "lucide-react";
import type { DueDiligenceData } from "@shared/schema";

export default function CreditTools() {
    const [data, setData] = useState<Partial<DueDiligenceData>>({});

    const handleSave = (updates: Partial<DueDiligenceData>) => {
        setData(prev => ({ ...prev, ...updates }));
    };

    return (
        <div className="container mx-auto px-6 py-8">
            <div className="flex flex-col gap-2 mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Credit Tools</h1>
                <p className="text-muted-foreground">
                    Utility calculators for credit analysis and risk assessment.
                </p>
            </div>

            <Tabs defaultValue="loan-calc" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 h-auto p-1 gap-1 bg-muted/50">
                    <TabsTrigger value="loan-calc" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <Calculator className="h-4 w-4 mr-2" />
                        <span className="hidden md:inline">Loan Calc</span>
                        <span className="md:hidden">Loan</span>
                    </TabsTrigger>
                    <TabsTrigger value="dscr" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        <span className="hidden md:inline">DSCR</span>
                        <span className="md:hidden">DSCR</span>
                    </TabsTrigger>
                    <TabsTrigger value="affordability" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                        <Target className="h-4 w-4 mr-2" />
                        <span className="hidden md:inline">Affordability</span>
                        <span className="md:hidden">Afford</span>
                    </TabsTrigger>
                    <TabsTrigger value="ratios" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                        <FileText className="h-4 w-4 mr-2" />
                        <span className="hidden md:inline">Ratios</span>
                        <span className="md:hidden">Ratios</span>
                    </TabsTrigger>
                    <TabsTrigger value="character" className="data-[state=active]:bg-rose-600 data-[state=active]:text-white">
                        <User className="h-4 w-4 mr-2" />
                        <span className="hidden md:inline">Character</span>
                        <span className="md:hidden">Char</span>
                    </TabsTrigger>
                    <TabsTrigger value="email" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                        <Mail className="h-4 w-4 mr-2" />
                        <span className="hidden md:inline">Email Validation</span>
                        <span className="md:hidden">Email</span>
                    </TabsTrigger>
                </TabsList>

                <div className="mt-6">
                    <TabsContent value="loan-calc" className="animate-in fade-in slide-in-from-left-2 duration-300">
                        <LoanCalculatorTool data={data as DueDiligenceData} onSave={handleSave} isSaving={false} />
                    </TabsContent>
                    <TabsContent value="dscr" className="animate-in fade-in slide-in-from-left-2 duration-300">
                        <DSCRCalculatorTool data={data as DueDiligenceData} onSave={handleSave} isSaving={false} />
                    </TabsContent>
                    <TabsContent value="affordability" className="animate-in fade-in slide-in-from-left-2 duration-300">
                        <AffordabilityEstimatorTool data={data as DueDiligenceData} onSave={handleSave} isSaving={false} />
                    </TabsContent>
                    <TabsContent value="ratios" className="animate-in fade-in slide-in-from-left-2 duration-300">
                        <FinancialRatiosCalculatorTool data={data as DueDiligenceData} onSave={handleSave} isSaving={false} />
                    </TabsContent>
                    <TabsContent value="character" className="animate-in fade-in slide-in-from-left-2 duration-300">
                        <CharacterAssessmentTool data={data as DueDiligenceData} onSave={handleSave} isSaving={false} />
                    </TabsContent>
                    <TabsContent value="email" className="animate-in fade-in slide-in-from-left-2 duration-300">
                        <EmailValidation />
                    </TabsContent>
                </div>
            </Tabs>

            <div className="mt-12 p-6 border-2 border-dashed rounded-xl bg-muted/30 flex flex-col items-center text-center">
                <Sparkles className="h-10 w-10 text-primary mb-4 opacity-50" />
                <h3 className="text-lg font-semibold">More tools coming soon</h3>
                <p className="text-sm text-muted-foreground max-w-md mt-2">
                    We're working on additional AI-powered calculators and risk modelling tools to help you analyze deals faster.
                </p>
            </div>
        </div>
    );
}
