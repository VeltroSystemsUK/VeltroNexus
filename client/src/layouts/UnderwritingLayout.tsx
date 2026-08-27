import { Link, useRoute, useLocation, Switch, Route } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    ClipboardList,
    Upload,
    Search,
    Shield,
    FileCheck,
    Package,
    ChevronLeft,
    Settings,
    Calculator,
    Save,
    Loader2,
    Database
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type { ProspectWithCompany, DueDiligenceData } from "@shared/schema";
import UnderwritingDashboard from "@/pages/underwriting/DashboardPage";
import EligibilityPage from "@/pages/underwriting/EligibilityPage";
import FinancialsPage from "@/pages/underwriting/FinancialsPage";
import AnalysisPage from "@/pages/underwriting/AnalysisPage";
import DecisionPage from "@/pages/underwriting/DecisionPage";
import SummaryPage from "@/pages/underwriting/SummaryPage";
import PackagingPage from "@/pages/underwriting/PackagingPage";

interface UnderwritingLayoutProps {
    children?: React.ReactNode;
}

export default function UnderwritingLayout() {
    const [match, params] = useRoute("/prospect/:id/underwriting/*?");
    const [, setLocation] = useLocation();
    const prospectId = params?.id ? parseInt(params.id) : 0;

    // Fetch Prospect
    const { data: prospect, isLoading: isLoadingProspect } = useQuery<ProspectWithCompany>({
        queryKey: [`/api/prospects/${prospectId}`],
        enabled: prospectId > 0,
    });

    // Fetch Due Diligence Data
    const { data: dueDiligenceData, isLoading: isLoadingDD } = useQuery<DueDiligenceData>({
        queryKey: [`/api/prospects/${prospectId}/due-diligence`],
        enabled: prospectId > 0,
    });

    // Save Mutation (Global for the studio)
    const saveDueDiligenceMutation = useMutation({
        mutationFn: async (data: Partial<DueDiligenceData>) => {
            const res = await apiRequest(
                `/api/prospects/${prospectId}/due-diligence`,
                "POST",
                data
            );
            return res.json();
        },
        onSuccess: () => {
            toast.success("Changes saved");
            queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospectId}/due-diligence`] });
        },
        onError: (error: Error) => {
            toast.error(`Failed to save: ${error.message}`);
        },
    });

    if (isLoadingProspect || isLoadingDD) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!prospect) {
        return <div>Prospect not found</div>;
    }

    const navItems = [
        {
            label: "Dashboard",
            icon: LayoutDashboard,
            href: `/prospect/${prospectId}/underwriting/dashboard`,
            match: "dashboard"
        },
        {
            label: "Eligibility",
            icon: ClipboardList,
            href: `/prospect/${prospectId}/underwriting/eligibility`,
            match: "eligibility"
        },
        {
            label: "Strata",
            icon: Package,
            href: `/prospect/${prospectId}/underwriting/packaging`,
            match: "packaging"
        },
        {
            label: "Financials",
            icon: Upload,
            href: `/prospect/${prospectId}/underwriting/financials`,
            match: "financials"
        },
        {
            label: "Analysis",
            icon: Search,
            href: `/prospect/${prospectId}/underwriting/analysis`,
            match: "analysis"
        },
        {
            label: "Decision",
            icon: Shield,
            href: `/prospect/${prospectId}/underwriting/decision`,
            match: "decision"
        },
        {
            label: "Summary",
            icon: FileCheck,
            href: `/prospect/${prospectId}/underwriting/summary`,
            match: "summary"
        }
    ];

    // Helper to check if current route matches
    const isActive = (pathPart: string) => {
        // Current location logic
        const currentPath = window.location.pathname; // using window.location as wouter hook might be tricky with nested
        return currentPath.includes(pathPart);
    };

    return (
        <div className="flex h-full bg-background">
            {/* Studio Sidebar */}
            <div className="w-64 border-r bg-card flex flex-col h-full">
                <div className="p-4 border-b">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="mb-2 -ml-2 text-muted-foreground"
                        onClick={() => setLocation(`/prospect/${prospectId}`)}
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Back to Prospect
                    </Button>
                    <div className="font-semibold truncate">{prospect.company.companyName}</div>
                    <div className="text-xs text-muted-foreground">Underwriting Studio</div>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {navItems.map((item) => (
                        <Link key={item.href} href={item.href}>
                            <a
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                                    isActive(item.match)
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.label}
                            </a>
                        </Link>
                    ))}

                    <Separator className="my-4" />

                    {/* Tools Section */}
                    <div className="px-3 py-2">
                        <h4 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Tools
                        </h4>
                        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
                            <Calculator className="h-4 w-4 mr-2" />
                            Quick Calculator
                        </Button>
                        <Link href="/lenders">
                            <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
                                <Database className="h-4 w-4 mr-2" />
                                Lender Database
                            </Button>
                        </Link>
                    </div>
                </nav>

                <div className="p-4 border-t bg-muted/20">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Status:</span>
                        <span className="font-medium text-foreground capitalize">In Progress</span>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Bar for Context/Actions */}
                <header className="h-14 border-b flex items-center justify-between px-6 bg-card/50 backdrop-blur">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {/* Breadcrumbs or Context could go here */}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => saveDueDiligenceMutation.mutate(dueDiligenceData || {})}
                            disabled={saveDueDiligenceMutation.isPending}
                        >
                            <Save className="h-4 w-4 mr-2" />
                            {saveDueDiligenceMutation.isPending ? "Saving..." : "Save Progress"}
                        </Button>
                    </div>
                </header>

                <main className={cn("flex-1 overflow-y-auto", isActive("packaging") ? "p-0" : "p-6")}>
                    <div className={isActive("packaging") ? "h-full" : "max-w-5xl mx-auto"}>
                        <Switch>
                            <Route path="/prospect/:id/underwriting" component={UnderwritingDashboard} />
                            <Route path="/prospect/:id/underwriting/dashboard" component={UnderwritingDashboard} />
                            <Route path="/prospect/:id/underwriting/eligibility" component={EligibilityPage} />
                            <Route path="/prospect/:id/underwriting/packaging" component={PackagingPage} />
                            <Route path="/prospect/:id/underwriting/financials" component={FinancialsPage} />
                            <Route path="/prospect/:id/underwriting/analysis" component={AnalysisPage} />
                            <Route path="/prospect/:id/underwriting/decision" component={DecisionPage} />
                            <Route path="/prospect/:id/underwriting/summary" component={SummaryPage} />
                        </Switch>
                    </div>
                </main>
            </div>
        </div>
    );
}
