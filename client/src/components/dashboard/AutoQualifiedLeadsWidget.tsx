import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, ArrowRight, AlertTriangle, CheckCircle, Search } from "lucide-react";
import { ScrapedLead } from "@shared/schema";

export function AutoQualifiedLeadsWidget() {
    const { data: leads, isLoading } = useQuery<ScrapedLead[]>({
        queryKey: ["/api/scraped-leads", { status: "new" }],
    });

    if (isLoading) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle>Today's Auto-Qualified Leads</CardTitle>
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[50px] w-full mb-2" />
                    <Skeleton className="h-[50px] w-full mb-2" />
                    <Skeleton className="h-[50px] w-full" />
                </CardContent>
            </Card>
        );
    }

    const highPriorityLeads = leads?.filter(l => l.score >= 70) || [];

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-3 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <Search className="h-5 w-5 text-primary" />
                            Today's Auto-Qualified Leads
                        </CardTitle>
                        <div className="text-xs text-muted-foreground">
                            Matches found by Debt Marker Scraper
                        </div>
                    </div>
                    <Badge variant="secondary" className="px-2 py-1">
                        {highPriorityLeads.length} New
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 relative">
                <ScrollArea className="h-[350px]">
                    {highPriorityLeads.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground p-4 text-center">
                            <CheckCircle className="h-8 w-8 mb-2 opacity-50" />
                            <p>No high-priority debt markers found today.</p>
                            <p className="text-xs mt-1">Scraper runs daily at 08:00 AM</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {highPriorityLeads.map((lead) => (
                                <div key={lead.id} className="p-4 hover:bg-muted/30 transition-colors group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h4 className="font-medium text-sm text-foreground">{lead.companyName}</h4>
                                            <div className="text-xs text-muted-foreground font-mono mt-0.5">
                                                {lead.companyNumber}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge className={
                                                lead.score >= 80 ? "bg-red-100 text-red-700 hover:bg-red-100 border-red-200" : "bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200"
                                            }>
                                                Score: {lead.score}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                        {lead.identifiedLender && (
                                            <div className="col-span-2 flex items-center gap-1.5 text-amber-700 bg-amber-50 p-1.5 rounded-md border border-amber-100">
                                                <AlertTriangle className="h-3 w-3" />
                                                <span className="font-semibold">Detected: {lead.identifiedLender}</span>
                                                <span className="text-muted-foreground ml-auto">
                                                    {lead.chargeDate ? new Date(lead.chargeDate).toLocaleDateString() : ""}
                                                </span>
                                            </div>
                                        )}

                                        {lead.crisisRatio && (
                                            <div title="Creditors / Cash Ratio" className="col-span-1 p-1 bg-slate-50 rounded border text-center">
                                                <span className="text-muted-foreground block text-[10px] uppercase">Crisis Ratio</span>
                                                <span className={`font-mono font-medium ${lead.crisisRatio > 1.5 ? "text-red-600" : ""}`}>
                                                    {lead.crisisRatio.toFixed(2)}x
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 mt-2">
                                        <Button size="sm" variant="outline" className="h-7 text-xs flex-1 gap-1">
                                            <Mail className="h-3 w-3" />
                                            {lead.emailDraftId ? "Review Draft" : "Draft Email"}
                                        </Button>
                                        <Button size="sm" className="h-7 text-xs gap-1 bg-primary/90 hover:bg-primary">
                                            View Report <ArrowRight className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
