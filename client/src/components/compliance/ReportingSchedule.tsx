import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarClock, ShieldAlert, AlertTriangle } from "lucide-react";
import { complianceResources } from "@/data/complianceResources";

const DOT_GRID = {
    backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)",
    backgroundSize: "18px 18px",
};

export function ReportingSchedule() {
    return (
        <div className="grid gap-6 md:grid-cols-2">
            {/* Reporting Schedule */}
            <Card className="relative overflow-hidden border-blue-500/20 bg-card">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-950/60 via-blue-950/20 to-transparent pointer-events-none" />
                <div className="absolute inset-0 pointer-events-none" style={DOT_GRID} />
                <div className="absolute -bottom-6 -right-6 pointer-events-none select-none">
                    <CalendarClock className="w-44 h-44 text-blue-400 opacity-[0.06]" />
                </div>

                <CardHeader className="relative z-10 pb-3 border-b border-border/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-md bg-blue-500/10 border border-blue-500/20">
                                <CalendarClock className="h-3.5 w-3.5 text-blue-400" />
                            </div>
                            <CardTitle className="text-sm font-semibold text-blue-400">
                                Reporting Schedule
                            </CardTitle>
                        </div>
                        <Badge
                            variant="outline"
                            className="text-[9px] uppercase tracking-wider text-blue-400 border-blue-500/30 bg-blue-500/5"
                        >
                            {complianceResources.reporting_schedule.length} forms
                        </Badge>
                    </div>
                </CardHeader>

                <CardContent className="relative z-10 pt-4 px-3">
                    <ScrollArea className="h-[400px] pr-2">
                        <div className="space-y-3">
                            {complianceResources.reporting_schedule.map((report) => (
                                <div
                                    key={report.id}
                                    className="p-3.5 rounded-lg border border-blue-500/10 bg-blue-950/20 backdrop-blur-sm"
                                >
                                    <div className="flex justify-between items-start mb-2 gap-2">
                                        <h3 className="text-xs font-semibold leading-snug">{report.title}</h3>
                                        <Badge className="text-[9px] shrink-0 bg-blue-500/10 text-blue-400 border border-blue-500/25 font-mono">
                                            {report.form_code}
                                        </Badge>
                                    </div>
                                    <div className="space-y-1.5 text-[11px]">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Frequency:</span>
                                            <span className="font-medium">{report.frequency}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">System:</span>
                                            <span className="font-medium">{report.submission_system}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block mb-1">Deadline:</span>
                                            <p className="bg-muted/40 p-2 rounded text-[10px] leading-relaxed">{report.deadline_logic}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>

            {/* Financial Crime Protocols */}
            <Card className="relative overflow-hidden border-rose-500/20 bg-card">
                <div className="absolute inset-0 bg-gradient-to-br from-rose-950/60 via-rose-950/20 to-transparent pointer-events-none" />
                <div className="absolute inset-0 pointer-events-none" style={DOT_GRID} />
                <div className="absolute -bottom-6 -right-6 pointer-events-none select-none">
                    <ShieldAlert className="w-44 h-44 text-rose-400 opacity-[0.06]" />
                </div>

                <CardHeader className="relative z-10 pb-3 border-b border-border/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-md bg-rose-500/10 border border-rose-500/20">
                                <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                            </div>
                            <CardTitle className="text-sm font-semibold text-rose-400">
                                Financial Crime Protocols
                            </CardTitle>
                        </div>
                        <Badge variant="destructive" className="text-[9px] uppercase tracking-wider">
                            Critical
                        </Badge>
                    </div>
                </CardHeader>

                <CardContent className="relative z-10 pt-4 px-3">
                    <ScrollArea className="h-[400px] pr-2">
                        <div className="space-y-3">
                            {complianceResources.financial_crime_protocols.map((protocol) => (
                                <div
                                    key={protocol.id}
                                    className="p-3.5 rounded-lg border border-rose-500/10 bg-rose-950/20 backdrop-blur-sm"
                                >
                                    <div className="flex justify-between items-start mb-1.5 gap-2">
                                        <h3 className="text-xs font-semibold leading-snug">{protocol.title}</h3>
                                        <Badge variant="destructive" className="text-[9px] shrink-0">CRITICAL</Badge>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mb-2.5">
                                        Source: {protocol.regulation_source}
                                    </p>
                                    <div className="space-y-2 text-[11px]">
                                        {protocol.trigger_logic && (
                                            <div className="bg-amber-500/10 p-2 rounded border border-amber-500/20">
                                                <span className="font-semibold text-amber-400 text-[10px] uppercase tracking-wider">Trigger: </span>
                                                <span className="text-amber-200/80">{protocol.trigger_logic}</span>
                                            </div>
                                        )}
                                        {"action_required" in protocol && (
                                            <div>
                                                <span className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">Action: </span>
                                                {String(protocol.action_required)}
                                            </div>
                                        )}
                                        {"data_requirements" in protocol && (
                                            <div>
                                                <span className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Required Data:</span>
                                                <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                                                    {(protocol.data_requirements as string[]).map((req, i) => (
                                                        <li key={i} className="text-[10px]">{req}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
