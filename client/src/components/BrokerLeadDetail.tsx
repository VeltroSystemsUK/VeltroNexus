import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
    Phone, Mail, Activity, Trash2,
    Building2, MapPin, Save, X, Edit2, Loader2, DollarSign,
    ShieldCheck, Undo2
} from "lucide-react";
import { BrokerLead, User } from "@shared/schema";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface BrokerLeadDetailProps {
    lead: BrokerLead;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    availableAgents?: User[];
}

export default function BrokerLeadDetail({ lead, open, onOpenChange }: BrokerLeadDetailProps) {
    const [, setLocation] = useLocation();
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<BrokerLead>>({});

    useEffect(() => {
        if (open && lead) {
            setFormData({
                companyName: lead.companyName || "",
                contactName: lead.contactName || "",
                email: lead.email || "",
                phone: lead.phone || "",
                status: lead.status || "new",
                address: lead.address || "",
                commissionRate: lead.commissionRate || 0.1,
                notes: lead.notes || "",
                sicCode: lead.sicCode || ""
            });
            setIsEditing(false);
        }
    }, [open, lead]);

    const deleteMutation = useMutation({
        mutationFn: () => apiRequest(`/api/brokers/leads/${lead.id}`, "DELETE"),
        onSuccess: () => {
            toast.success("Broker lead deleted");
            queryClient.invalidateQueries({ queryKey: ["/api/brokers/leads"] });
            onOpenChange(false);
        },
    });

    const moveToPipelineMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest(`/api/brokers/leads/${lead.id}/move-to-pipeline`, "POST");
            return await res.json();
        },
        onSuccess: () => {
            toast.success("Moved back to the main Pipeline");
            queryClient.invalidateQueries({ queryKey: ["/api/brokers/leads"] });
            queryClient.invalidateQueries({ queryKey: ["/api/prospects"] });
            onOpenChange(false);
        },
        onError: () => toast.error("Failed to move to pipeline"),
    });

    const verifyEmailMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest(`/api/brokers/leads/${lead.id}/verify-email`, "POST");
            return await res.json();
        },
        onSuccess: (data) => {
            if (data.status === "valid") {
                toast.success(`Email verified: ${data.verification.status}`);
            } else if (data.status === "enriched") {
                toast.success(`New email found: ${data.email}`);
                queryClient.invalidateQueries({ queryKey: ["/api/brokers/leads"] });
            } else {
                toast.warning(`Status: ${data.status}. ${data.message || ''}`);
            }
        },
        onError: (error: any) => {
            toast.error(error.message || "Email verification failed");
        }
    });

    const updateLeadMutation = useMutation({
        mutationFn: (updates: Partial<BrokerLead>) => 
            apiRequest(`/api/brokers/leads/${lead.id}`, "PUT", updates),
        onSuccess: (_updatedLead) => {
            toast.success("Broker updated successfully");
            queryClient.invalidateQueries({ queryKey: ["/api/brokers/leads"] });
            setIsEditing(false);
        },
        onError: (_error) => {
            toast.error("Failed to update broker");
        }
    });

    const handleSave = () => {
        updateLeadMutation.mutate(formData);
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-xl overflow-y-auto">
                <SheetHeader className="mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            {isEditing ? (
                                <div className="space-y-4 pr-4">
                                    <div className="space-y-1">
                                        <Label htmlFor="companyName">Company Name</Label>
                                        <Input 
                                            id="companyName"
                                            value={formData.companyName}
                                            onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <SheetTitle className="text-2xl font-bold flex items-center gap-2">
                                    <Building2 className="h-6 w-6 text-primary" />
                                    {lead.companyName}
                                </SheetTitle>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {!isEditing ? (
                                <>
                                    <Badge variant="outline" className="capitalize">
                                        {lead.status}
                                    </Badge>
                                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setIsEditing(true)}>
                                        <Edit2 className="h-4 w-4" />
                                    </Button>
                                </>
                            ) : (
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                                        <X className="h-4 w-4 mr-1" /> Cancel
                                    </Button>
                                    <Button size="sm" onClick={handleSave} disabled={updateLeadMutation.isPending}>
                                        {updateLeadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                                        Save
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                    {!isEditing && (
                        <SheetDescription className="flex items-center gap-2 mt-1">
                            <MapPin className="h-4 w-4" />
                            {lead.address || "No address provided"}
                        </SheetDescription>
                    )}
                </SheetHeader>

                <Tabs defaultValue="overview" className="space-y-4">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="activity">Invoices & Bio</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-6">
                        {isEditing ? (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="status">Status</Label>
                                        <Select 
                                            value={formData.status} 
                                            onValueChange={(val) => setFormData({...formData, status: val})}
                                        >
                                            <SelectTrigger id="status">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="new">Identified</SelectItem>
                                                <SelectItem value="contacted">Contacted</SelectItem>
                                                <SelectItem value="approved">Approved</SelectItem>
                                                <SelectItem value="rejected">Rejected</SelectItem>
                                                <SelectItem value="non_responsive">Non-responsive</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="comm">Commission (%)</Label>
                                        <Input 
                                            id="comm"
                                            type="number"
                                            step="0.1"
                                            value={((formData.commissionRate || 0) * 100).toFixed(1)}
                                            onChange={(e) => setFormData({...formData, commissionRate: parseFloat(e.target.value) / 100})}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="address">Address & Postcode</Label>
                                    <Textarea 
                                        id="address"
                                        rows={3}
                                        value={formData.address}
                                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                                    />
                                </div>

                                <Separator />

                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                        <Phone className="h-4 w-4" />
                                        Contact Details
                                    </h3>
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="contactName">Contact Name</Label>
                                            <Input 
                                                id="contactName"
                                                value={formData.contactName}
                                                onChange={(e) => setFormData({...formData, contactName: e.target.value})}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label htmlFor="email">Email Address</Label>
                                                    {formData.email && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-auto p-0 text-xs text-primary flex items-center gap-1 hover:bg-transparent"
                                                            onClick={() => verifyEmailMutation.mutate()}
                                                            disabled={verifyEmailMutation.isPending}
                                                        >
                                                            {verifyEmailMutation.isPending ? (
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                            ) : (
                                                                <ShieldCheck className="h-3 w-3" />
                                                            )}
                                                            Verify
                                                        </Button>
                                                    )}
                                                </div>
                                                <Input 
                                                    id="email"
                                                    type="email"
                                                    value={formData.email}
                                                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="phone">Phone Number</Label>
                                                <Input 
                                                    id="phone"
                                                    value={formData.phone}
                                                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                <div className="space-y-2">
                                    <Label htmlFor="notes">Internal Bio & Notes</Label>
                                    <Textarea 
                                        id="notes"
                                        rows={6}
                                        className="font-mono text-sm"
                                        value={formData.notes}
                                        onChange={(e) => setFormData({...formData, notes: e.target.value})}
                                    />
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                                Commission Rate
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">{(lead.commissionRate * 100).toFixed(1)}%</div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                                SIC Code
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">{lead.sicCode || "N/A"}</div>
                                        </CardContent>
                                    </Card>
                                </div>

                                <Separator />

                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        <Phone className="h-5 w-5 text-primary" />
                                        Contact Information
                                    </h3>
                                    <div className="grid grid-cols-1 gap-3">
                                        <div className="p-2 border rounded-md bg-muted/20">
                                            <p className="text-xs text-muted-foreground mb-1">Principle Contact</p>
                                            <p className="font-medium text-lg">{lead.contactName || "Unknown"}</p>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <Mail className="h-4 w-4 text-muted-foreground" />
                                                <span className="truncate max-w-[200px]">{lead.email || "No email"}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {lead.email && (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                        onClick={() => verifyEmailMutation.mutate()}
                                                        disabled={verifyEmailMutation.isPending}
                                                        title="Verify Quality"
                                                    >
                                                        {verifyEmailMutation.isPending ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <ShieldCheck className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                )}
                                                {lead.email && (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 text-slate-600 hover:text-slate-800 hover:bg-slate-100"
                                                        onClick={() => setLocation(`/gmail?compose=true&to=${lead.email}&name=${encodeURIComponent(lead.contactName || '')}`)}
                                                        title="Compose in Veltro Gmail"
                                                    >
                                                        <Mail className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <Phone className="h-4 w-4 text-muted-foreground" />
                                                <span>{lead.phone || "No phone"}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        <Activity className="h-5 w-5 text-primary" />
                                        Notes & Context
                                    </h3>
                                    <Card className="bg-muted/10 border-dashed">
                                        <CardContent className="pt-4 text-sm whitespace-pre-wrap">
                                            {lead.notes || "No notes available for this broker."}
                                        </CardContent>
                                    </Card>
                                </div>
                            </>
                        )}
                    </TabsContent>

                    <TabsContent value="activity">
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
                            <DollarSign className="h-12 w-12 opacity-20" />
                            <p>No billing activity found for this broker.</p>
                        </div>
                    </TabsContent>
                </Tabs>

                <div className="mt-10 pt-6 border-t flex justify-end gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            if (confirm(`Move ${lead.companyName} back to the main Pipeline as a direct customer lead?`)) {
                                moveToPipelineMutation.mutate();
                            }
                        }}
                        disabled={moveToPipelineMutation.isPending}
                        title="Use this if this record is actually a direct customer, not an introducer"
                    >
                        {moveToPipelineMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Undo2 className="h-4 w-4 mr-2" />}
                        Move to main Pipeline
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                            if (confirm("Are you sure you want to delete this broker lead?")) {
                                deleteMutation.mutate();
                            }
                        }}
                        disabled={deleteMutation.isPending}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Broker
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
