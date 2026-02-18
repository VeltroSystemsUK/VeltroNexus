import { useQuery, useMutation } from "@tanstack/react-query";
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
    Building2, MapPin, Globe, Phone, Mail,
    Calendar, Briefcase, DollarSign, Activity,
    Trash2, ExternalLink
} from "lucide-react";
import { BrokerLead, User } from "@shared/schema";
import { toast } from "sonner";
import { format } from "date-fns";

interface BrokerLeadDetailProps {
    lead: BrokerLead;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    availableAgents?: User[];
}

export default function BrokerLeadDetail({ lead, open, onOpenChange }: BrokerLeadDetailProps) {
    const deleteMutation = useMutation({
        mutationFn: () => apiRequest(`/api/brokers/leads/${lead.id}`, "DELETE"),
        onSuccess: () => {
            toast.success("Broker lead deleted");
            queryClient.invalidateQueries({ queryKey: ["/api/brokers/leads"] });
            onOpenChange(false);
        },
    });

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-xl overflow-y-auto">
                <SheetHeader className="mb-6">
                    <div className="flex items-center justify-between">
                        <SheetTitle className="text-2xl font-bold flex items-center gap-2">
                            <Building2 className="h-6 w-6 text-primary" />
                            {lead.companyName}
                        </SheetTitle>
                        <Badge variant="outline" className="capitalize">
                            {lead.status}
                        </Badge>
                    </div>
                    <SheetDescription className="flex items-center gap-2 mt-1">
                        <MapPin className="h-4 w-4" />
                        {lead.address || "No address provided"}
                    </SheetDescription>
                </SheetHeader>

                <Tabs defaultValue="overview" className="space-y-4">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="activity">Invoices & Bio</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-6">
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
                                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <Mail className="h-4 w-4 text-muted-foreground" />
                                        <span>{lead.email || "No email"}</span>
                                    </div>
                                    {lead.email && <Button variant="ghost" size="icon"><ExternalLink className="h-4 w-4" /></Button>}
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
                    </TabsContent>

                    <TabsContent value="activity">
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
                            <DollarSign className="h-12 w-12 opacity-20" />
                            <p>No billing activity found for this broker.</p>
                        </div>
                    </TabsContent>
                </Tabs>

                <div className="mt-10 pt-6 border-t flex justify-end">
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
