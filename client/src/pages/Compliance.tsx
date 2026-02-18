import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ComplianceLibrary } from "@/components/compliance/ComplianceLibrary";
import { RegulatoryAssistant } from "@/components/compliance/RegulatoryAssistant";
import { ComplianceChecklist } from "@/components/compliance/ComplianceChecklist";
import { ReportingSchedule } from "@/components/compliance/ReportingSchedule";
import { Badge } from "@/components/ui/badge";
import { FileText, MessageSquare, CheckSquare, CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export default function Compliance() {
    return (
        <div className="flex flex-col h-full bg-background">
            <PageHeader
                title="Compliance Hub"
                description="Monitor regulatory obligations, access policies, and get expert guidance."
                showBackButton={false}
            >
                <Badge variant="outline" className="border-green-500/50 bg-green-500/10 text-green-500">
                    FCA Handbook v2026.01
                </Badge>
            </PageHeader>

            <div className="flex-1 overflow-hidden p-6">
                <Tabs defaultValue="library" className="h-full flex flex-col space-y-6">
                    <TabsList className="grid w-full grid-cols-4 h-auto p-1 gap-1 bg-muted/50">
                        <TabsTrigger value="library" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <FileText className="h-4 w-4" />
                            Compliance Library
                        </TabsTrigger>
                        <TabsTrigger value="checklists" className="flex items-center gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                            <CheckSquare className="h-4 w-4" />
                            Interactive Checklists
                        </TabsTrigger>
                        <TabsTrigger value="assistant" className="flex items-center gap-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                            <MessageSquare className="h-4 w-4" />
                            Regulatory Assistant
                        </TabsTrigger>
                        <TabsTrigger value="reporting" className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                            <CalendarClock className="h-4 w-4" />
                            Reporting Schedule
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="library" className="flex-1 overflow-y-auto pb-6">
                        <ComplianceLibrary />
                    </TabsContent>

                    <TabsContent value="checklists" className="flex-1 overflow-y-auto pb-6">
                        <ComplianceChecklist />
                    </TabsContent>

                    <TabsContent value="assistant" className="flex-1 overflow-hidden">
                        <RegulatoryAssistant />
                    </TabsContent>

                    <TabsContent value="reporting" className="flex-1 overflow-y-auto pb-6">
                        <ReportingSchedule />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
