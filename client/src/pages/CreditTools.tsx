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
    Building2,
    Menu,
} from "lucide-react";
import type { DueDiligenceData } from "@shared/schema";

import { usePageTitle } from "@/context/LayoutContext";
import { toast } from "sonner";

const STORAGE_KEY = "credit-tools-data";

function loadStoredData(): Partial<DueDiligenceData> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

export default function CreditTools() {
    usePageTitle("CREDIT TOOLS", "Utility calculators for credit analysis and risk assessment.");
    const [data, setData] = useState<Partial<DueDiligenceData>>(loadStoredData);
    const [activeTab, setActiveTab] = useState("loan-calc");

    const tabOptions = [
        { id: "loan-calc", label: "Loans", icon: Calculator },
        { id: "hire-purchase", label: "Hire Purchase", icon: Building2 },
        { id: "dscr", label: "DSCR", icon: TrendingUp },
        { id: "affordability", label: "Affordability", icon: Target },
        { id: "ratios", label: "Ratios", icon: FileText },
        { id: "character", label: "Character", icon: User },
    ];

    const handleSave = (updates: Partial<DueDiligenceData>) => {
        setData(prev => {
            const next = { ...prev, ...updates };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
        toast.success("Saved — figures will be here next time you open Credit Tools");
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
                                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
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
            </div>
        </div>
    );
}
