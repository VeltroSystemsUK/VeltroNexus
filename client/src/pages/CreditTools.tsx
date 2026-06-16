import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    LoanCalculatorTool,
    HirePurchaseCalculatorTool, // Added
    DSCRCalculatorTool,
    AffordabilityEstimatorTool,
    FinancialRatiosCalculatorTool,
    CharacterAssessmentTool,
} from "@/components/DueDiligenceTools";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Calculator,
    TrendingUp,
    Target,
    FileText,
    User,
    Sparkles,
    Mail,
    Building2,
    Menu // Added
} from "lucide-react";
import type { DueDiligenceData } from "@shared/schema";

import { usePageTitle } from "@/context/LayoutContext";

export default function CreditTools() {
    usePageTitle("CREDIT TOOLS", "Utility calculators for credit analysis and risk assessment.");
    const [data, setData] = useState<Partial<DueDiligenceData>>({});
    const [activeTab, setActiveTab] = useState("loan-calc");

    const tabOptions = [
        { id: "loan-calc", label: "Loans", icon: Calculator, color: "bg-primary" },
        { id: "hire-purchase", label: "Hire Purchase", icon: Building2, color: "bg-emerald-600" },
        { id: "dscr", label: "DSCR", icon: TrendingUp, color: "bg-emerald-600" },
        { id: "affordability", label: "Affordability", icon: Target, color: "bg-amber-600" },
        { id: "ratios", label: "Ratios", icon: FileText, color: "bg-emerald-600" },
        { id: "character", label: "Character", icon: User, color: "bg-rose-600" },
    ];

    const handleSave = (updates: Partial<DueDiligenceData>) => {
        setData(prev => ({ ...prev, ...updates }));
    };

    return (
        <div className="min-h-screen bg-background pb-24">
            <div className="w-full mx-auto p-6 space-y-6">
                <div className="mb-6">
                    {/* Description moved to global header */}
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    {/* Mobile View: Hamburger Menu */}
                    <div className="md:hidden flex items-center justify-between bg-muted/50 p-2 rounded-lg mb-4">
                        <div className="flex items-center gap-2 pl-2">
                            {(() => {
                                const current = tabOptions.find(t => t.id === activeTab);
                                const Icon = current?.icon || Calculator;
                                return (
                                    <>
                                        <Icon className="h-5 w-5 text-muted-foreground" />
                                        <span className="font-medium">{current?.label}</span>
                                    </>
                                );
                            })()}
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[200px]">
                                {tabOptions.map((tab) => (
                                    <DropdownMenuItem key={tab.id} onClick={() => setActiveTab(tab.id)}>
                                        <tab.icon className="mr-2 h-4 w-4" />
                                        {tab.label}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Desktop View: Single Row Grid */}
                    <TabsList className="hidden md:grid w-full grid-cols-6 h-auto p-1 gap-1 bg-muted/50">
                        {tabOptions.map((tab) => (
                            <TabsTrigger
                                key={tab.id}
                                value={tab.id}
                                className={`data-[state=active]:${tab.color} data-[state=active]:text-white`}
                            >
                                <tab.icon className="h-4 w-4 mr-2" />
                                {tab.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    <div className="mt-6">
                        <TabsContent value="loan-calc" className="animate-in fade-in slide-in-from-left-2 duration-300">
                            <LoanCalculatorTool data={data as DueDiligenceData} onSave={handleSave} isSaving={false} />
                        </TabsContent>
                        <TabsContent value="hire-purchase" className="animate-in fade-in slide-in-from-left-2 duration-300">
                            <HirePurchaseCalculatorTool data={data as DueDiligenceData} onSave={handleSave} isSaving={false} />
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
        </div>
    );
}
