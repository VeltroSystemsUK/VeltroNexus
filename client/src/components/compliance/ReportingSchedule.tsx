
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { complianceResources } from "@/data/complianceResources";

export function ReportingSchedule() {
    return (
        <div className="grid gap-6 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Reporting Schedule</CardTitle>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[400px] pr-4">
                        <div className="space-y-4">
                            {complianceResources.reporting_schedule.map((report) => (
                                <div key={report.id} className="p-4 rounded-lg border bg-card">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-semibold">{report.title}</h3>
                                        <Badge>{report.form_code}</Badge>
                                    </div>
                                    <div className="space-y-2 text-sm">
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
                                            <p className="bg-muted p-2 rounded text-xs">{report.deadline_logic}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Financial Crime Protocols</CardTitle>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[400px] pr-4">
                        <div className="space-y-4">
                            {complianceResources.financial_crime_protocols.map((protocol) => (
                                <div key={protocol.id} className="p-4 rounded-lg border bg-card">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-semibold">{protocol.title}</h3>
                                        <Badge variant="destructive">CRITICAL</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mb-3">
                                        Source: {protocol.regulation_source}
                                    </p>
                                    <div className="space-y-2 text-sm">
                                        {protocol.trigger_logic && (
                                            <div className="bg-amber-500/10 p-2 rounded border border-amber-500/20">
                                                <span className="font-semibold text-amber-600 dark:text-amber-400">Trigger: </span>
                                                {protocol.trigger_logic}
                                            </div>
                                        )}
                                        {"action_required" in protocol && (
                                            <div>
                                                <span className="font-semibold">Action: </span>
                                                {protocol.action_required}
                                            </div>
                                        )}
                                        {"data_requirements" in protocol && (
                                            <div>
                                                <span className="font-semibold block mb-1">Required Data:</span>
                                                <ul className="list-disc list-inside text-muted-foreground text-xs">
                                                    {(protocol.data_requirements as string[]).map((req, i) => (
                                                        <li key={i}>{req}</li>
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
