import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ComplianceLibrary } from "@/components/compliance/ComplianceLibrary";
import { RegulatoryAssistant } from "@/components/compliance/RegulatoryAssistant";
import { ComplianceChecklist } from "@/components/compliance/ComplianceChecklist";
import { ReportingSchedule } from "@/components/compliance/ReportingSchedule";
import { ComplianceOfficer } from "@/components/compliance/ComplianceOfficer";
import { Badge } from "@/components/ui/badge";
import { FileText, MessageSquare, CheckSquare, CalendarClock, Shield, Eye } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { complianceResources } from "@/data/complianceResources";

const totalDocs = complianceResources.document_categories.reduce((sum, c) => sum + c.documents.length, 0);
const totalReports = complianceResources.reporting_schedule.length;
const totalProtocols = complianceResources.financial_crime_protocols.length;

const STATS = [
    {
        label: "Mandatory Documents",
        value: totalDocs,
        Icon: FileText,
        valueClass: "text-blue-400",
        bgClass: "bg-blue-950/40",
        borderClass: "border-blue-500/20",
        iconClass: "text-blue-400/10",
    },
    {
        label: "Active Checklists",
        value: 3,
        Icon: CheckSquare,
        valueClass: "text-emerald-400",
        bgClass: "bg-emerald-950/40",
        borderClass: "border-emerald-500/20",
        iconClass: "text-emerald-400/10",
    },
    {
        label: "Reporting Forms",
        value: totalReports,
        Icon: CalendarClock,
        valueClass: "text-violet-400",
        bgClass: "bg-violet-950/40",
        borderClass: "border-violet-500/20",
        iconClass: "text-violet-400/10",
    },
    {
        label: "Crime Protocols",
        value: totalProtocols,
        Icon: Shield,
        valueClass: "text-rose-400",
        bgClass: "bg-rose-950/40",
        borderClass: "border-rose-500/20",
        iconClass: "text-rose-400/10",
    },
];

export default function Compliance() {
    return (
        <div className="flex flex-col h-full bg-background">
            <PageHeader
                title="Compliance Hub"
                description="Active monitoring, exception management, evidence capture, and FCA/UK GDPR oversight for Strata."
                showBackButton={false}
            >
                <Badge variant="outline" className="border-green-500/50 bg-green-500/10 text-green-500 text-xs">
                    Compliance Officer · Monitoring
                </Badge>
            </PageHeader>

            <div className="flex-1 overflow-hidden p-6 flex flex-col gap-5">
                {/* Stats strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
                    {STATS.map(({ label, value, Icon, valueClass, bgClass, borderClass, iconClass }) => (
                        <div
                            key={label}
                            className={`relative overflow-hidden rounded-xl border ${borderClass} ${bgClass} p-4`}
                            style={{
                                backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)",
                                backgroundSize: "16px 16px",
                            }}
                        >
                            <div className="absolute -bottom-3 -right-3 pointer-events-none select-none">
                                <Icon className={`w-16 h-16 ${iconClass}`} />
                            </div>
                            <p className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground/70 mb-1.5">
                                {label}
                            </p>
                            <p className={`text-3xl font-black tabular-nums leading-none ${valueClass}`}>{value}</p>
                        </div>
                    ))}
                </div>

                <Tabs defaultValue="officer" className="flex-1 flex flex-col gap-4 min-h-0">
                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto p-1 gap-1 bg-muted/50 shrink-0">
                        <TabsTrigger value="officer" className="flex items-center gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs"><Eye className="h-3.5 w-3.5" />Compliance Officer</TabsTrigger>
                        <TabsTrigger
                            value="library"
                            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs"
                        >
                            <FileText className="h-3.5 w-3.5" />
                            Compliance Library
                        </TabsTrigger>
                        <TabsTrigger
                            value="checklists"
                            className="flex items-center gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs"
                        >
                            <CheckSquare className="h-3.5 w-3.5" />
                            Interactive Checklists
                        </TabsTrigger>
                        <TabsTrigger
                            value="assistant"
                            className="flex items-center gap-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white text-xs"
                        >
                            <MessageSquare className="h-3.5 w-3.5" />
                            Regulatory Assistant
                        </TabsTrigger>
                        <TabsTrigger
                            value="reporting"
                            className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs"
                        >
                            <CalendarClock className="h-3.5 w-3.5" />
                            Reporting Schedule
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="officer" className="flex-1 overflow-y-auto pb-6 mt-0">
                        <ComplianceOfficer />
                    </TabsContent>

                    <TabsContent value="library" className="flex-1 overflow-y-auto pb-6 mt-0">
                        <ComplianceLibrary />
                    </TabsContent>

                    <TabsContent value="checklists" className="flex-1 overflow-y-auto pb-6 mt-0">
                        <ComplianceChecklist />
                    </TabsContent>

                    <TabsContent value="assistant" className="flex-1 overflow-hidden mt-0">
                        <RegulatoryAssistant />
                    </TabsContent>

                    <TabsContent value="reporting" className="flex-1 overflow-y-auto pb-6 mt-0">
                        <ReportingSchedule />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
