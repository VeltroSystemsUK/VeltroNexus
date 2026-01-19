import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Shield, AlertTriangle, Check, Clock } from "lucide-react";
import { complianceResources } from "@/data/complianceResources";

export function ComplianceLibrary() {
    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                {complianceResources.document_categories.map((category) => (
                    <Card key={category.category_name} className="bg-card text-card-foreground">
                        <CardHeader>
                            <CardTitle className="text-lg font-medium">{category.category_name}</CardTitle>
                            <CardDescription>{category.description}</CardDescription>
                        </CardHeader>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        Regulatory Documentation Library
                    </CardTitle>
                    <CardDescription>
                        Comprehensive list of mandatory compliance documents and policies.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                        {complianceResources.document_categories.map((category, idx) => (
                            <AccordionItem key={idx} value={`category-${idx}`}>
                                <AccordionTrigger className="text-left font-semibold">
                                    {category.category_name}
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="grid gap-4 pt-4">
                                        {category.documents.map((doc) => (
                                            <Card key={doc.id} className="bg-muted/50 border-muted">
                                                <CardHeader className="pb-2">
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <CardTitle className="text-base font-medium flex items-center gap-2">
                                                                <FileText className="h-4 w-4 text-muted-foreground" />
                                                                {doc.title}
                                                            </CardTitle>
                                                            <CardDescription className="mt-1">
                                                                Source: {doc.regulatory_source}
                                                            </CardDescription>
                                                        </div>
                                                        <Badge variant="outline">{doc.id}</Badge>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="text-sm space-y-4">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <h4 className="font-semibold mb-2 flex items-center gap-2">
                                                                <AlertTriangle className="h-3 w-3" /> Key Requirements
                                                            </h4>
                                                            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                                                {doc.key_content_requirements.map((req, i) => (
                                                                    <li key={i}>{req}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                        <div className="space-y-4">
                                                            <div>
                                                                <h4 className="font-semibold mb-1 flex items-center gap-2">
                                                                    <Clock className="h-3 w-3" /> Retention
                                                                </h4>
                                                                <p className="text-muted-foreground">{doc.retention_period}</p>
                                                            </div>
                                                            <div>
                                                                <h4 className="font-semibold mb-1">Update Trigger</h4>
                                                                <p className="text-muted-foreground">{doc.update_trigger}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 pt-2">
                                                        {doc.mandatory_for.map((role) => (
                                                            <Badge key={role} variant="secondary" className="text-xs">
                                                                {role.replace(/_/g, " ")}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
            </Card>

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
        </div>
    );
}
