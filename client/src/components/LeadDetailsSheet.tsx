import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    Building2,
    Globe,
    Mail,
    Phone,
    MapPin,
    Star,
    User,
    CreditCard,
    Calendar,
    CheckCircle,
    Copy,
    Search
} from "lucide-react";
import { toast } from "sonner";
import { DomainContactPanel } from "./DomainContactPanel";

interface Lead {
    googlePlaceId: string;
    name: string;
    address: string | null;
    phone: string | null;
    website: string | null;
    rating: number | null;
    reviewCount: number | null;
    status: string | null;
    email: string | null;
    emailConfidence: string | null;
    pecrStatus: string | null;
    leadScore: number | null;
    companyNumber?: string;
    contactName?: string;
    contactRole?: string;
    hasCharges?: boolean;
    activeChargeCount?: number;
    lenderNames?: string[];
    migrated?: boolean;
    sicCode?: string;
    incorporationDate?: string;
}

interface LeadDetailsSheetProps {
    lead: Lead | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaveContact?: (contact: { email: string, context?: string }) => void;
}

import { useMutation, useQueryClient } from "@tanstack/react-query";

export function LeadDetailsSheet({ lead, open, onOpenChange, onSaveContact }: LeadDetailsSheetProps) {
    if (!lead) return null;

    const queryClient = useQueryClient();
    const deepSearchMutation = useMutation({
        mutationFn: async (placeId: string) => {
            const res = await fetch(`/api/lead-finder/${placeId}/deep-search`, {
                method: "POST"
            });
            if (!res.ok) throw new Error("Failed to perform deep search");
            return res.json();
        },
        onSuccess: (data) => {
            if (data.success) {
                toast.success(`Deep Search found: ${data.business.email} (${data.business.emailConfidence})`);

                // Instantly update the cache so the UI reflects the new data immediately
                queryClient.setQueryData(["/api/lead-finder/results"], (oldLeads: any[] | undefined) => {
                    if (!oldLeads) return oldLeads;
                    return oldLeads.map(lead =>
                        lead.googlePlaceId === data.business.googlePlaceId ? data.business : lead
                    );
                });
            } else {
                toast.warning("Deep Search completed: No email found.");
            }
        },
        onError: (error) => {
            toast.error("Deep Search failed to execute");
        }
    });

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard`);
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        {lead.name}
                        {lead.migrated && (
                            <CheckCircle className="h-5 w-5 text-green-500 fill-green-100" />
                        )}
                    </SheetTitle>
                    <SheetDescription>
                        Internal Lead Record
                    </SheetDescription>
                </SheetHeader>

                <ScrollArea className="h-[calc(100vh-100px)] mt-6 pr-4">
                    <div className="space-y-6">
                        {/* Core Info */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Company Details</h3>

                            <div className="grid grid-cols-1 gap-4">
                                {lead.address && (
                                    <div className="flex items-start gap-3">
                                        <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium">Address</p>
                                            <p className="text-sm text-muted-foreground">{lead.address}</p>
                                        </div>
                                    </div>
                                )}

                                {lead.website && (
                                    <div className="flex items-center gap-3">
                                        <Globe className="h-4 w-4 text-muted-foreground" />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium">Website</p>
                                            <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                                                {lead.website}
                                            </a>
                                            <div className="mt-2">
                                                <DomainContactPanel
                                                    domain={lead.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                                                    contactName={lead.contactName || undefined}
                                                    onSaveContact={(contact) => {
                                                        onSaveContact?.({ email: contact.email, context: contact.context });
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {lead.phone && (
                                    <div className="flex items-center gap-3">
                                        <Phone className="h-4 w-4 text-muted-foreground" />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium">Phone</p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm text-muted-foreground">{lead.phone}</p>
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(lead.phone!, "Phone")}>
                                                    <Copy className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <Separator />

                        {/* Contact Info */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Key Contact</h3>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs gap-1.5 border-dashed border-amber-500/50 hover:border-amber-500 hover:bg-amber-50"
                                    onClick={() => deepSearchMutation.mutate(lead.googlePlaceId!)}
                                    disabled={deepSearchMutation.isPending || !lead.website}
                                >
                                    {deepSearchMutation.isPending ? (
                                        <>Searching...</>
                                    ) : (
                                        <>Deep Search 🐝</>
                                    )}
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {(lead.contactName || lead.contactRole) && (
                                    <div className="flex items-start gap-3">
                                        <User className="h-4 w-4 text-muted-foreground mt-1" />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium">{lead.contactName || "Unknown"}</p>
                                            <p className="text-sm text-muted-foreground">{lead.contactRole || "N/A"}</p>
                                        </div>
                                    </div>
                                )}

                                {lead.email && (
                                    <div className="flex items-center gap-3">
                                        <Mail className="h-4 w-4 text-muted-foreground" />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium">Email</p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm text-emerald-600 font-medium">{lead.email}</p>
                                                <Badge variant="outline" className="text-[10px]">{lead.emailConfidence}</Badge>
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(lead.email!, "Email")}>
                                                    <Copy className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <Separator />

                        {/* Corporate Data */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Corporate Data</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-muted-foreground">Company Number</p>
                                    <p className="text-sm font-medium">{lead.companyNumber || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">SIC Code</p>
                                    <p className="text-sm font-medium">{lead.sicCode || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Incorporation Date</p>
                                    <p className="text-sm font-medium">
                                        {lead.incorporationDate ? new Date(lead.incorporationDate).toLocaleDateString() : "N/A"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Active Charges</p>
                                    <div className="flex items-center gap-2">
                                        <CreditCard className="h-3 w-3 text-amber-600" />
                                        <p className="text-sm font-medium">{lead.activeChargeCount || 0}</p>
                                    </div>
                                </div>
                            </div>

                            {lead.lenderNames && lead.lenderNames.length > 0 && (
                                <div>
                                    <p className="text-xs text-muted-foreground mb-2">Identified Lenders</p>
                                    <div className="flex flex-wrap gap-2">
                                        {lead.lenderNames.map((lender, i) => (
                                            <Badge key={i} variant="secondary">{lender}</Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}
