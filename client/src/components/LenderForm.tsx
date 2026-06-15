import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { insertLenderSchema, LENDER_TYPES, LENDER_TIERS, PANEL_STATUSES, PRODUCT_TYPES, SECTORS, REGIONS } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, Linkedin, Globe, LayoutDashboard, Plus, Mail, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { FileText, Send, CheckCircle2 } from "lucide-react";
import { GmailComposer } from "./GmailComposer";

// Extended schema to handle array fields for UI that might be null in DB
const formSchema = insertLenderSchema.extend({
    id: z.number().optional(),
    productTypes: z.array(z.string()).optional(),
    sectors: z.array(z.string()).optional(),
    regions: z.array(z.string()).optional(),
    lendingPolicy: z.string().nullable().optional(),
    insights: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface LenderFormProps {
    defaultValues?: Partial<FormValues>;
    onSubmit: (data: FormValues) => void;
    isSubmitting?: boolean;
    onCancel: () => void;
    submitLabel?: string;
}

export function LenderForm({
    defaultValues,
    onSubmit,
    isSubmitting = false,
    onCancel,
    submitLabel = "Save Lender",
}: LenderFormProps) {
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            institutionName: "",
            lenderType: "tier2.0",
            panelStatus: "market",
            productTypes: [],
            sectors: [],
            regions: [],
            rating: 0,
            ...defaultValues,
        },
    });

    const [isFetchingLogo, setIsFetchingLogo] = useState(false);
    const [researchingField, setResearchingField] = useState<string | null>(null);
    const [researchingModule, setResearchingModule] = useState<string | null>(null);
    const [proposedUpdates, setProposedUpdates] = useState<any | null>(null);

    const handleFetchLogo = async () => {
        const website = form.getValues("website");
        const name = form.getValues("institutionName");

        if (!website && !name) {
            form.setError("logoUrl", { message: "Please enter a website or institution name first" });
            return;
        }

        try {
            setIsFetchingLogo(true);
            const res = await apiRequest("/api/lenders/lookup-logo", "POST", { website, name });
            const data = await res.json();

            if (data.logoUrl) {
                form.setValue("logoUrl", data.logoUrl);
                form.clearErrors("logoUrl");
            } else {
                form.setError("logoUrl", { message: "No logo found" });
            }
        } catch (error) {
            console.error("Failed to fetch logo", error);
            form.setError("logoUrl", { message: "Failed to fetch logo" });
        } finally {
            setIsFetchingLogo(false);
        }
    };

    const handleModuleEnrichment = async (module: "basic" | "criteria" | "contacts" | "notes") => {
        const website = form.getValues("website");
        const name = form.getValues("institutionName");
        const lenderId = form.getValues("id");

        if (!name) {
            toast.error("Please enter an institution name first");
            return;
        }

        try {
            setResearchingModule(module);
            setProposedUpdates(null);

            const url = lenderId
                ? `/api/lenders/${lenderId}/enrich/${module}`
                : `/api/lenders/0/enrich/${module}`; // 0 for new lender

            const res = await apiRequest(url, "POST", { website, name });
            const data = await res.json();

            if (Object.keys(data).length > 0) {
                setProposedUpdates({ module, data });
                toast.success(`AI found proposed updates for ${module} info`);
            } else {
                toast.error("AI couldn't find significant info for this module.");
            }
        } catch (error) {
            console.error("AI Enrichment failed", error);
            toast.error("AI Research failed. Please try again.");
        } finally {
            setResearchingModule(null);
        }
    };

    const commitProposedUpdates = () => {
        if (!proposedUpdates) return;

        const { data } = proposedUpdates;

        // Handle special case for 'bdm' object in contacts module
        if (data.bdm) {
            Object.keys(data.bdm).forEach(key => {
                if (data.bdm[key]) form.setValue(key as any, data.bdm[key]);
            });
            delete data.bdm;
        }

        // Apply remaining fields
        Object.keys(data).forEach((key) => {
            if (data[key] !== undefined && data[key] !== null) {
                form.setValue(key as any, data[key]);
            }
        });

        setProposedUpdates(null);
        toast.success("AI updates applied to form");
    };

    const handleAISearch = async (field: keyof FormValues) => {
        // Legacy support or fallback
        const website = form.getValues("website");
        const name = form.getValues("institutionName");
        const lenderId = form.getValues("id");

        if (!website && !name) {
            toast.error("Please enter a website or institution name first");
            return;
        }

        try {
            setResearchingField(field as string);
            const url = lenderId ? `/api/lenders/${lenderId}/research` : `/api/lenders/research-prospect`;
            const res = await apiRequest(url, "POST", { website, name, targetField: field });
            const data = await res.json();

            if (data[field]) {
                form.setValue(field, data[field]);
                toast.success(`AI Research completed for ${field}`);
            } else if (data.result && data.result[field]) {
                form.setValue(field, data.result[field]);
                toast.success(`AI Research completed for ${field}`);
            } else {
                toast.error("AI couldn't find specific info for this field.");
            }
        } catch (error) {
            console.error("AI Research failed", error);
            toast.error("AI Research failed. Please try again.");
        } finally {
            setResearchingField(null);
        }
    };

    const { data: user } = useQuery<any>({
        queryKey: ["/api/auth/user"],
    });

    const [isCreatingDoc, setIsCreatingDoc] = useState(false);
    const [isDraftingEmail, setIsDraftingEmail] = useState(false);

    const handleCreateGoogleDoc = async () => {
        const name = form.getValues("institutionName");
        const policy = form.getValues("lendingPolicy");
        const appetite = form.getValues("creditAppetite");

        try {
            setIsCreatingDoc(true);
            const content = `<h1>Lender Review: ${name}</h1>
                <p><strong>Lending Policy:</strong> ${policy || "Not specified"}</p>
                <p><strong>Credit Appetite:</strong> ${appetite || "Not specified"}</p>
                <p>Generated by Veltro AI.</p>`;

            const res = await apiRequest("/api/google/docs/create", "POST", { title: `${name} - Lender Review`, content });
            const data = await res.json();
            if (data.webViewLink) {
                window.open(data.webViewLink, "_blank");
                toast.success("Google Doc created!");
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to create Google Doc");
        } finally {
            setIsCreatingDoc(false);
        }
    };

    const [isComposerOpen, setIsComposerOpen] = useState(false);

    const handleDraftGmail = async (payload: any) => {
        try {
            setIsDraftingEmail(true);
            const res = await apiRequest("/api/google/gmail/draft", "POST", payload);
            if (res.ok) {
                toast.success("Draft email sent to your Gmail!");
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to draft email");
        } finally {
            setIsDraftingEmail(false);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {proposedUpdates && (
                    <Card className="border-primary/20 bg-primary/5 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                                    <Globe className="h-5 w-5 text-primary animate-pulse" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-primary capitalize">{proposedUpdates.module} Research Complete</p>
                                    <p className="text-xs text-muted-foreground">AI has found {Object.keys(proposedUpdates.data).length} proposed updates for this lender.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setProposedUpdates(null)}
                                    className="h-8"
                                >
                                    Discard
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={commitProposedUpdates}
                                    className="h-8 gap-1.5"
                                >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Commit Updates
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
                        <TabsTrigger value="basic">Basic Info</TabsTrigger>
                        <TabsTrigger value="criteria">Lending Criteria</TabsTrigger>
                        <TabsTrigger value="contacts">Contacts</TabsTrigger>
                        <TabsTrigger value="notes">Notes & Assessment</TabsTrigger>
                    </TabsList>

                    <TabsContent value="basic" className="space-y-4 mt-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Classification & Profile</h3>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-primary hover:bg-primary/5 gap-2"
                                onClick={() => handleModuleEnrichment("basic")}
                                disabled={!!researchingModule}
                            >
                                <Globe className={`h-3.5 w-3.5 ${researchingModule === "basic" ? "animate-spin" : ""}`} />
                                {researchingModule === "basic" ? "Gathering Info..." : "Research Basic Info"}
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="institutionName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Institution Name *</FormLabel>
                                        <FormControl>
                                            <Input
                                                id={field.name}
                                                placeholder="e.g., Barclays Business"
                                                data-testid="input-institution-name"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="lenderType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Lender Type</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || ""}>
                                            <FormControl>
                                                <SelectTrigger data-testid="select-lender-type-form">
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {LENDER_TYPES.map((type) => (
                                                    <SelectItem key={type.value} value={type.value}>
                                                        {type.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="panelStatus"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Panel Status</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || ""}>
                                            <FormControl>
                                                <SelectTrigger data-testid="select-panel-status-form">
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {PANEL_STATUSES.map((status) => (
                                                    <SelectItem key={status.value} value={status.value}>
                                                        {status.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {user?.role === "super_admin" && (
                                <FormField
                                    control={form.control}
                                    name="tier"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Lender Tier (Admin Only)</FormLabel>
                                            <Select
                                                onValueChange={(val) => field.onChange(parseFloat(val))}
                                                value={field.value?.toString() || ""}
                                            >
                                                <FormControl>
                                                    <SelectTrigger data-testid="select-tier-form">
                                                        <SelectValue placeholder="Assign Tier" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {LENDER_TIERS.map((tier) => (
                                                        <SelectItem key={tier.value} value={tier.value.toString()}>
                                                            {tier.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>

                        <div>
                            <div className="text-sm font-medium">Product Types</div>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {PRODUCT_TYPES.map((product) => {
                                    const isSelected = form.watch("productTypes")?.includes(product);
                                    return (
                                        <Badge
                                            key={product}
                                            variant={isSelected ? "default" : "outline"}
                                            className="cursor-pointer"
                                            onClick={() => {
                                                const current = form.getValues("productTypes") || [];
                                                if (isSelected) {
                                                    form.setValue(
                                                        "productTypes",
                                                        current.filter((p) => p !== product)
                                                    );
                                                } else {
                                                    form.setValue("productTypes", [...current, product]);
                                                }
                                            }}
                                        >
                                            {product}
                                        </Badge>
                                    );
                                })}
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="criteria" className="space-y-4 mt-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Policy & Appetite</h3>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-primary hover:bg-primary/5 gap-2"
                                onClick={() => handleModuleEnrichment("criteria")}
                                disabled={!!researchingModule}
                            >
                                <Globe className={`h-3.5 w-3.5 ${researchingModule === "criteria" ? "animate-spin" : ""}`} />
                                {researchingModule === "criteria" ? "Gathering Info..." : "Enrich Lending Criteria"}
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="minLoanAmount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Minimum Loan Amount (£)</FormLabel>
                                        <FormControl>
                                            <Input
                                                id={field.name}
                                                type="number"
                                                placeholder="e.g., 50000"
                                                data-testid="input-min-loan"
                                                {...field}
                                                value={field.value || ""}
                                                onChange={(e) => field.onChange(e.target.valueAsNumber || undefined)}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="maxLoanAmount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Maximum Loan Amount (£)</FormLabel>
                                        <FormControl>
                                            <Input
                                                id={field.name}
                                                type="number"
                                                placeholder="e.g., 10000000"
                                                data-testid="input-max-loan"
                                                {...field}
                                                value={field.value || ""}
                                                onChange={(e) => field.onChange(e.target.valueAsNumber || undefined)}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="minTermMonths"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Min Term (months)</FormLabel>
                                        <FormControl>
                                            <Input
                                                id={field.name}
                                                type="number"
                                                placeholder="e.g., 12"
                                                {...field}
                                                value={field.value || ""}
                                                onChange={(e) => field.onChange(e.target.valueAsNumber || undefined)}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="maxTermMonths"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Max Term (months)</FormLabel>
                                        <FormControl>
                                            <Input
                                                id={field.name}
                                                type="number"
                                                placeholder="e.g., 60"
                                                {...field}
                                                value={field.value || ""}
                                                onChange={(e) => field.onChange(e.target.valueAsNumber || undefined)}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="minLtv"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Min LTV (%)</FormLabel>
                                        <FormControl>
                                            <Input
                                                id={field.name}
                                                type="number"
                                                placeholder="e.g., 0"
                                                {...field}
                                                value={field.value || ""}
                                                onChange={(e) => field.onChange(e.target.valueAsNumber || undefined)}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="maxLtv"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Max LTV (%)</FormLabel>
                                        <FormControl>
                                            <Input
                                                id={field.name}
                                                type="number"
                                                placeholder="e.g., 75"
                                                {...field}
                                                value={field.value || ""}
                                                onChange={(e) => field.onChange(e.target.valueAsNumber || undefined)}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField
                                control={form.control}
                                name="typicalRateFrom"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Rate From</FormLabel>
                                        <FormControl>
                                            <Input id={field.name} placeholder="e.g., 4.5%" {...field} value={field.value || ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="typicalRateTo"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Rate To</FormLabel>
                                        <FormControl>
                                            <Input id={field.name} placeholder="e.g., 8.5%" {...field} value={field.value || ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="arrangementFee"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Arrangement Fee</FormLabel>
                                        <FormControl>
                                            <Input id={field.name} placeholder="e.g., 1.5%" {...field} value={field.value || ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="turnaroundDays"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Typical Turnaround (days)</FormLabel>
                                    <FormControl>
                                        <Input
                                            id={field.name}
                                            type="number"
                                            placeholder="e.g., 14"
                                            {...field}
                                            value={field.value || ""}
                                            onChange={(e) => field.onChange(e.target.valueAsNumber || undefined)}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div>
                            <div className="text-sm font-medium">Sectors</div>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {SECTORS.map((sector) => {
                                    const isSelected = form.watch("sectors")?.includes(sector);
                                    return (
                                        <Badge
                                            key={sector}
                                            variant={isSelected ? "default" : "outline"}
                                            className="cursor-pointer"
                                            onClick={() => {
                                                const current = form.getValues("sectors") || [];
                                                if (isSelected) {
                                                    form.setValue(
                                                        "sectors",
                                                        current.filter((s) => s !== sector)
                                                    );
                                                } else {
                                                    form.setValue("sectors", [...current, sector]);
                                                }
                                            }}
                                        >
                                            {sector}
                                        </Badge>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <div className="text-sm font-medium">Regions</div>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {REGIONS.map((region) => {
                                    const isSelected = form.watch("regions")?.includes(region);
                                    return (
                                        <Badge
                                            key={region}
                                            variant={isSelected ? "default" : "outline"}
                                            className="cursor-pointer"
                                            onClick={() => {
                                                const current = form.getValues("regions") || [];
                                                if (isSelected) {
                                                    form.setValue(
                                                        "regions",
                                                        current.filter((r) => r !== region)
                                                    );
                                                } else {
                                                    form.setValue("regions", [...current, region]);
                                                }
                                            }}
                                        >
                                            {region}
                                        </Badge>
                                    );
                                })}
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="contacts" className="space-y-4 mt-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Key Contacts & BDMs</h3>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-primary hover:bg-primary/5 gap-2"
                                onClick={() => handleModuleEnrichment("contacts")}
                                disabled={!!researchingModule}
                            >
                                <Globe className={`h-3.5 w-3.5 ${researchingModule === "contacts" ? "animate-spin" : ""}`} />
                                {researchingModule === "contacts" ? "Discovering Contacts..." : "Find Key Contacts"}
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="contactName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Primary Contact Name</FormLabel>
                                        <FormControl>
                                            <Input id={field.name} placeholder="e.g., John Smith" {...field} value={field.value || ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Primary Email *</FormLabel>
                                        <FormControl>
                                            <Input
                                                id={field.name}
                                                type="email"
                                                placeholder="email@example.com"
                                                {...field}
                                                value={field.value || ""}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Primary Phone</FormLabel>
                                        <FormControl>
                                            <Input
                                                id={field.name}
                                                type="tel"
                                                placeholder="+44 20 1234 5678"
                                                {...field}
                                                value={field.value || ""}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="website"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Website</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id={field.name}
                                                    placeholder="https://..."
                                                    className="pl-9"
                                                    {...field}
                                                    value={field.value || ""}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="logoUrl"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Logo URL</FormLabel>
                                        <div className="flex gap-2">
                                            <FormControl>
                                                <Input
                                                    id={field.name}
                                                    placeholder="https://..."
                                                    {...field}
                                                    value={field.value || ""}
                                                />
                                            </FormControl>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={handleFetchLogo}
                                                disabled={isFetchingLogo}
                                                title="Auto-fetch Logo"
                                            >
                                                {isFetchingLogo ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <Globe className="h-4 w-4" />}
                                            </Button>
                                            <FormControl>
                                                <div className="relative">
                                                    <Input
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        id="logo-upload"
                                                        onChange={async (e) => {
                                                            const file = e.target.files?.[0];
                                                            if (!file) return;

                                                            const formData = new FormData();
                                                            formData.append("file", file);

                                                            try {
                                                                const res = await fetch("/api/lenders/upload-logo", {
                                                                    method: "POST",
                                                                    body: formData,
                                                                });
                                                                if (!res.ok) throw new Error("Upload failed");
                                                                const data = await res.json();
                                                                form.setValue("logoUrl", data.logoUrl);
                                                            } catch (err) {
                                                                console.error("Logo upload error:", err);
                                                            }
                                                        }}
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => document.getElementById("logo-upload")?.click()}
                                                        title="Upload Logo"
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </FormControl>
                                        </div>
                                        {field.value && (
                                            <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                                                <span>Preview:</span>
                                                <img src={field.value} alt="Logo Preview" className="h-8 w-8 object-contain rounded-sm border bg-white" />
                                            </div>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="linkedinUrl"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>LinkedIn URL</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Linkedin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id={field.name}
                                                    placeholder="https://linkedin.com/in/..."
                                                    className="pl-9"
                                                    {...field}
                                                    value={field.value || ""}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="portalUrl"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Portal URL</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <LayoutDashboard className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id={field.name}
                                                    placeholder="https://portal.lender.com..."
                                                    className="pl-9"
                                                    {...field}
                                                    value={field.value || ""}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Address</FormLabel>
                                    <FormControl>
                                        <Input
                                            id={field.name}
                                            placeholder="Full address..."
                                            {...field}
                                            value={field.value || ""}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <Separator />
                        <h4 className="font-medium">BDM Contact</h4>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField
                                control={form.control}
                                name="bdmName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>BDM Name</FormLabel>
                                        <FormControl>
                                            <Input id={field.name} placeholder="e.g., Sarah Jones" {...field} value={field.value || ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="bdmEmail"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>BDM Email</FormLabel>
                                        <FormControl>
                                            <Input
                                                id={field.name}
                                                type="email"
                                                placeholder="bdm@example.com"
                                                {...field}
                                                value={field.value || ""}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="bdmPhone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>BDM Phone</FormLabel>
                                        <FormControl>
                                            <Input
                                                id={field.name}
                                                type="tel"
                                                placeholder="+44..."
                                                {...field}
                                                value={field.value || ""}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="submissionEmail"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Submission Email</FormLabel>
                                    <FormDescription>
                                        Email address for sending loan applications
                                    </FormDescription>
                                    <FormControl>
                                        <Input
                                            id={field.name}
                                            type="email"
                                            placeholder="submissions@example.com"
                                            {...field}
                                            value={field.value || ""}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </TabsContent>

                    <TabsContent value="notes" className="space-y-4 mt-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Ratings & Strategic Insights</h3>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-primary hover:bg-primary/5 gap-2"
                                onClick={() => handleModuleEnrichment("notes")}
                                disabled={!!researchingModule}
                            >
                                <Globe className={`h-3.5 w-3.5 ${researchingModule === "notes" ? "animate-spin" : ""}`} />
                                {researchingModule === "notes" ? "Gathering Insights..." : "Generate AI Insights"}
                            </Button>
                        </div>
                        <FormField
                            control={form.control}
                            name="rating"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Your Rating (1-5)</FormLabel>
                                    <FormControl>
                                        <div className="flex items-center gap-2">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <Button
                                                    key={star}
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => field.onChange(star)}
                                                >
                                                    <Star
                                                        className={`h-6 w-6 ${field.value && star <= field.value
                                                            ? "fill-yellow-400 text-yellow-400"
                                                            : "text-muted-foreground"
                                                            }`}
                                                    />
                                                </Button>
                                            ))}
                                            {field.value && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => field.onChange(undefined)}
                                                >
                                                    Clear
                                                </Button>
                                            )}
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="creditAppetite"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="flex items-center justify-between mb-1">
                                        <FormLabel>Credit Appetite</FormLabel>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-[10px] text-primary hover:bg-primary/5 gap-1.5"
                                            onClick={() => handleAISearch("creditAppetite")}
                                            disabled={!!researchingField}
                                        >
                                            <Globe className={`h-3 w-3 ${researchingField === "creditAppetite" ? "animate-spin" : ""}`} />
                                            {researchingField === "creditAppetite" ? "Generating..." : "Research with AI"}
                                        </Button>
                                    </div>
                                    <FormControl>
                                        <Textarea
                                            id={field.name}
                                            placeholder="Describe their current lending appetite..."
                                            className="resize-none"
                                            rows={2}
                                            {...field}
                                            value={field.value || ""}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="lendingPolicy"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="flex items-center justify-between mb-1">
                                        <FormLabel>Lending Policy</FormLabel>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-[10px] text-primary hover:bg-primary/5 gap-1.5"
                                            onClick={() => handleAISearch("lendingPolicy")}
                                            disabled={!!researchingField}
                                        >
                                            <Globe className={`h-3 w-3 ${researchingField === "lendingPolicy" ? "animate-spin" : ""}`} />
                                            {researchingField === "lendingPolicy" ? "Generating..." : "Research with AI"}
                                        </Button>
                                    </div>
                                    <FormControl>
                                        <Textarea
                                            id={field.name}
                                            placeholder="Guidelines, requirements, or restrictions..."
                                            className="resize-none"
                                            rows={2}
                                            {...field}
                                            value={field.value || ""}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="keyStrengths"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="flex items-center justify-between mb-1">
                                        <FormLabel>Key Strengths</FormLabel>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-[10px] text-primary hover:bg-primary/5 gap-1.5"
                                            onClick={() => handleAISearch("keyStrengths")}
                                            disabled={!!researchingField}
                                        >
                                            <Globe className={`h-3 w-3 ${researchingField === "keyStrengths" ? "animate-spin" : ""}`} />
                                            {researchingField === "keyStrengths" ? "Generating..." : "Research with AI"}
                                        </Button>
                                    </div>
                                    <FormControl>
                                        <Textarea
                                            id={field.name}
                                            placeholder="What they're good at..."
                                            className="resize-none"
                                            rows={2}
                                            {...field}
                                            value={field.value || ""}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="keyWeaknesses"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="flex items-center justify-between mb-1">
                                        <FormLabel>Key Weaknesses</FormLabel>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-[10px] text-primary hover:bg-primary/5 gap-1.5"
                                            onClick={() => handleAISearch("keyWeaknesses")}
                                            disabled={!!researchingField}
                                        >
                                            <Globe className={`h-3 w-3 ${researchingField === "keyWeaknesses" ? "animate-spin" : ""}`} />
                                            {researchingField === "keyWeaknesses" ? "Generating..." : "Research with AI"}
                                        </Button>
                                    </div>
                                    <FormControl>
                                        <Textarea
                                            id={field.name}
                                            placeholder="Areas of concern or limitations..."
                                            className="resize-none"
                                            rows={2}
                                            {...field}
                                            value={field.value || ""}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="insights"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="flex items-center justify-between mb-1">
                                        <FormLabel>AI Insights</FormLabel>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-[10px] text-primary hover:bg-primary/5 gap-1.5"
                                            onClick={() => handleAISearch("insights")}
                                            disabled={!!researchingField}
                                        >
                                            <Globe className={`h-3 w-3 ${researchingField === "insights" ? "animate-spin" : ""}`} />
                                            {researchingField === "insights" ? "Generating..." : "Research with AI"}
                                        </Button>
                                    </div>
                                    <FormControl>
                                        <Textarea
                                            id={field.name}
                                            placeholder="Unique insider knowledge or process tips..."
                                            className="resize-none"
                                            rows={2}
                                            {...field}
                                            value={field.value || ""}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>General Notes</FormLabel>
                                    <FormDescription>High-level summary notes. Use the Diary for ongoing updates.</FormDescription>
                                    <FormControl>
                                        <Textarea
                                            id={field.name}
                                            placeholder="Any other relevant info..."
                                            className="resize-none"
                                            rows={3}
                                            {...field}
                                            value={field.value || ""}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </TabsContent>


                </Tabs>

                <div className="flex justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onCancel}
                        data-testid="button-cancel"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        data-testid="button-submit"
                    >
                        {isSubmitting ? "Saving..." : submitLabel}
                    </Button>
                </div>

                <GmailComposer
                    isOpen={isComposerOpen}
                    onClose={() => setIsComposerOpen(false)}
                    onSend={handleDraftGmail}
                    defaultTo={form.getValues("submissionEmail") || form.getValues("bdmEmail") || "team@example.com"}
                    defaultSubject={`Outreach: ${form.getValues("institutionName")}`}
                    defaultBody={`<p>Hi team,</p><p>We are considering <strong>${form.getValues("institutionName")}</strong> for several upcoming deals. Their current credit appetite is: ${form.getValues("creditAppetite") || "TBD"}.</p>`}
                />
            </form>
        </Form >
    );
}
