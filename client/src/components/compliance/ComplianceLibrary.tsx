import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, AlertTriangle, Clock, Users, Building2, GraduationCap, ShieldCheck } from "lucide-react";
import { complianceResources } from "@/data/complianceResources";
import type { LucideIcon } from "lucide-react";

interface CategoryTheme {
    gradient: string;
    accentClass: string;
    borderClass: string;
    Icon: LucideIcon;
    label: string;
    subtitleClass: string;
}

const CATEGORY_THEMES: CategoryTheme[] = [
    {
        gradient: "from-blue-950/80 via-blue-950/40 to-transparent",
        accentClass: "text-blue-400",
        borderClass: "border-blue-500/25",
        Icon: Users,
        label: "Client-Facing",
        subtitleClass: "text-blue-300/60",
    },
    {
        gradient: "from-violet-950/80 via-violet-950/40 to-transparent",
        accentClass: "text-violet-400",
        borderClass: "border-violet-500/25",
        Icon: Building2,
        label: "Governance",
        subtitleClass: "text-violet-300/60",
    },
    {
        gradient: "from-emerald-950/80 via-emerald-950/40 to-transparent",
        accentClass: "text-emerald-400",
        borderClass: "border-emerald-500/25",
        Icon: GraduationCap,
        label: "Personnel",
        subtitleClass: "text-emerald-300/60",
    },
];

export function ComplianceLibrary() {
    return (
        <div className="space-y-6">
            {/* Category hero cards */}
            <div className="grid gap-4 md:grid-cols-3">
                {complianceResources.document_categories.map((category, idx) => {
                    const theme = CATEGORY_THEMES[idx] ?? CATEGORY_THEMES[0];
                    const { gradient, accentClass, borderClass, Icon, label, subtitleClass } = theme;
                    const docCount = category.documents.length;

                    return (
                        <Card
                            key={category.category_name}
                            className={`relative overflow-hidden border ${borderClass} bg-card`}
                        >
                            {/* Gradient wash */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} pointer-events-none`} />
                            {/* Dot grid */}
                            <div
                                className="absolute inset-0 pointer-events-none"
                                style={{
                                    backgroundImage: "radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)",
                                    backgroundSize: "18px 18px",
                                }}
                            />
                            {/* Large icon watermark */}
                            <div className="absolute -bottom-5 -right-5 pointer-events-none select-none">
                                <Icon className={`w-36 h-36 ${accentClass} opacity-[0.08]`} />
                            </div>

                            <CardHeader className="relative z-10 pb-4">
                                <div className="flex items-start justify-between mb-3">
                                    <Badge
                                        variant="outline"
                                        className={`text-[9px] uppercase tracking-widest font-semibold ${accentClass} border-current/30 bg-current/5`}
                                    >
                                        {label}
                                    </Badge>
                                    <span className={`text-4xl font-black tabular-nums leading-none ${accentClass} opacity-80`}>
                                        {docCount}
                                    </span>
                                </div>
                                <CardTitle className={`text-sm font-semibold leading-snug ${accentClass}`}>
                                    {category.category_name}
                                </CardTitle>
                                <CardDescription className={`text-xs mt-1 ${subtitleClass}`}>
                                    {category.description}
                                </CardDescription>
                                <p className="text-[9px] text-muted-foreground/40 uppercase tracking-widest mt-2.5 font-medium">
                                    {docCount} mandatory document{docCount !== 1 ? "s" : ""}
                                </p>
                            </CardHeader>
                        </Card>
                    );
                })}
            </div>

            {/* Full library accordion */}
            <Card>
                <CardHeader className="pb-3 border-b border-border/60">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-primary/10">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-sm font-semibold">
                                Regulatory Documentation Library
                            </CardTitle>
                            <CardDescription className="text-xs mt-0.5">
                                Comprehensive list of mandatory compliance documents and policies.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-4">
                    <Accordion type="single" collapsible className="w-full">
                        {complianceResources.document_categories.map((category, idx) => {
                            const theme = CATEGORY_THEMES[idx] ?? CATEGORY_THEMES[0];
                            return (
                                <AccordionItem key={idx} value={`category-${idx}`}>
                                    <AccordionTrigger className={`text-left text-xs font-semibold uppercase tracking-wider ${theme.accentClass} hover:no-underline`}>
                                        {category.category_name}
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="grid gap-3 pt-3">
                                            {category.documents.map((doc) => (
                                                <Card key={doc.id} className="bg-muted/30 border-muted/60">
                                                    <CardHeader className="pb-2 pt-3 px-4">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex-1 min-w-0">
                                                                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                                                                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                                    <span className="truncate">{doc.title}</span>
                                                                </CardTitle>
                                                                <CardDescription className="mt-1 text-[11px]">
                                                                    Source: {doc.regulatory_source}
                                                                </CardDescription>
                                                            </div>
                                                            <Badge variant="outline" className="text-[10px] shrink-0 font-mono">{doc.id}</Badge>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="text-xs space-y-3 px-4 pb-3">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div>
                                                                <h4 className="text-[10px] font-semibold mb-2 flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground">
                                                                    <AlertTriangle className="h-3 w-3" /> Key Requirements
                                                                </h4>
                                                                <ul className="list-disc list-inside space-y-1 text-muted-foreground text-[11px]">
                                                                    {doc.key_content_requirements.map((req, i) => (
                                                                        <li key={i}>{req}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                            <div className="space-y-3">
                                                                <div>
                                                                    <h4 className="text-[10px] font-semibold mb-1 flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground">
                                                                        <Clock className="h-3 w-3" /> Retention
                                                                    </h4>
                                                                    <p className="text-muted-foreground text-[11px]">{doc.retention_period}</p>
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-[10px] font-semibold mb-1 uppercase tracking-wider text-muted-foreground">Update Trigger</h4>
                                                                    <p className="text-muted-foreground text-[11px]">{doc.update_trigger}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                                            {doc.mandatory_for.map((role) => (
                                                                <Badge key={role} variant="secondary" className="text-[10px] h-5">
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
                            );
                        })}
                    </Accordion>
                </CardContent>
            </Card>
        </div>
    );
}
