import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Briefcase,
    CheckCircle,
    DollarSign,
    MoreHorizontal,
    Plus,
    Search,
    UserPlus,
    Users,
    ArrowRight
} from "lucide-react";
import { InternalLead, Commission, User } from "@shared/schema";
import { toast } from "sonner";
import { format } from "date-fns";
import { useLocation } from "wouter";

// Reuse Company Search Logic (Simplified for God Mode)
import CompanySearch from "@/pages/CompanySearch";
import InternalLeadDetail from "@/components/InternalLeadDetail";

export default function GodModeCRM() {
    const [location, setLocation] = useLocation();

    // Fetch Leads
    const { data: leads = [], isLoading: isLoadingLeads } = useQuery<InternalLead[]>({
        queryKey: ["/api/god/crm/leads"],
    });

    // Fetch Users (for Agent assignment)
    const { data: users = [] } = useQuery<User[]>({
        queryKey: ["/api/god/users"],
    });

    // Filter for potential agents (e.g. admins or specific role, for now all users)
    const agents = users;

    const createLeadMutation = useMutation({
        mutationFn: (data: any) => apiRequest("/api/god/crm/leads", "POST", data),
        onSuccess: () => {
            toast.success("Lead added to pipeline");
            queryClient.invalidateQueries({ queryKey: ["/api/god/crm/leads"] });
        },
    });

    const updateLeadMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) =>
            apiRequest(`/api/god/crm/leads/${id}`, "PUT", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/god/crm/leads"] });
        },
    });

    // Kanban Columns
    const stages = [
        { id: "new", label: "New Lead", color: "bg-blue-500/10 border-blue-500/20 text-blue-500" },
        { id: "contacted", label: "Contacted", color: "bg-yellow-500/10 border-yellow-500/20 text-yellow-500" },
        { id: "demo_booked", label: "Demo Booked", color: "bg-purple-500/10 border-purple-500/20 text-purple-500" },
        { id: "trial", label: "Trial Active", color: "bg-indigo-500/10 border-indigo-500/20 text-indigo-500" },
        { id: "subscribed", label: "Subscribed", color: "bg-green-500/10 border-green-500/20 text-green-500" },
        { id: "churned", label: "Lost/Churned", color: "bg-red-500/10 border-red-500/20 text-red-500" },
    ];

    const getLeadsByStage = (stage: string) => leads.filter(l => l.status === stage);

    const handleDrop = (e: React.DragEvent, stage: string) => {
        const leadId = parseInt(e.dataTransfer.getData("leadId"));
        if (leadId) {
            updateLeadMutation.mutate({ id: leadId, data: { status: stage } });
        }
    };

    // Selection for Detail View
    const [selectedLead, setSelectedLead] = useState<InternalLead | null>(null);

    return (
        <div className="space-y-6 pt-6 pb-12 w-full">
            {/* Detail Dialog */}
            {selectedLead && (
                <InternalLeadDetail
                    lead={selectedLead}
                    open={!!selectedLead}
                    onOpenChange={(open) => !open && setSelectedLead(null)}
                    availableAgents={users}
                />
            )}

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Briefcase className="h-8 w-8 text-primary" />
                        Veltro Sales CRM
                    </h1>
                    <p className="text-muted-foreground mt-1">Manage outreach, subscriptions, and commissions.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setLocation("/god-mode")}>
                        Back to Dashboard
                    </Button>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> New Lead
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add Manual Lead</DialogTitle>
                                <DialogDescription>Enter company details to track.</DialogDescription>
                            </DialogHeader>
                            {/* Simple Form Placeholder - ideally reuse a form component */}
                            <p className="text-sm text-gray-500">For rich data, use the "Prospecting" tab to search Companies House.</p>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Tabs defaultValue="pipeline" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-4">
                    <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
                    <TabsTrigger value="prospecting">Prospecting</TabsTrigger>
                    <TabsTrigger value="agents">Agents</TabsTrigger>
                    <TabsTrigger value="commissions">Commissions</TabsTrigger>
                </TabsList>

                {/* --- PIPELINE (KANBAN) --- */}
                <TabsContent value="pipeline" className="mt-6">
                    <div className="flex h-[calc(100vh-250px)] gap-4 overflow-x-auto pb-4">
                        {stages.map((stage) => (
                            <div
                                key={stage.id}
                                className={`flex-shrink-0 w-80 flex flex-col rounded-lg border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-background/60`}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleDrop(e, stage.id)}
                            >
                                <div className={`p-4 border-b flex items-center justify-between ${stage.color} bg-opacity-10`}>
                                    <h3 className="font-semibold">{stage.label}</h3>
                                    <Badge variant="outline" className="bg-background">{getLeadsByStage(stage.id).length}</Badge>
                                </div>
                                <div className="p-3 flex-1 overflow-y-auto space-y-3">
                                    {getLeadsByStage(stage.id).map((lead) => (
                                        <Card
                                            key={lead.id}
                                            draggable
                                            onDragStart={(e) => e.dataTransfer.setData("leadId", lead.id.toString())}
                                            onClick={() => setSelectedLead(lead)}
                                            className="cursor-pointer hover:border-primary transition-colors hover:shadow-md"
                                        >
                                            <CardContent className="p-4 space-y-2">
                                                <div className="flex justify-between items-start">
                                                    <h4 className="font-medium truncate" title={lead.companyName}>{lead.companyName}</h4>
                                                    {lead.assignedAgentId && (
                                                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs text-primary font-bold" title="Assigned Agent">
                                                            A
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground truncate">{lead.email || "No email"}</p>
                                                <div className="flex items-center justify-between pt-2">
                                                    <span className="text-xs text-muted-foreground">
                                                        {lead.createdAt ? format(new Date(lead.createdAt), "MMM d") : "N/A"}
                                                    </span>
                                                    {lead.estimatedValue && (
                                                        <Badge variant="secondary" className="text-xs">
                                                            £{lead.estimatedValue}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </TabsContent>

                {/* --- PROSPECTING --- */}
                <TabsContent value="prospecting" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Find New Veltro Clients</CardTitle>
                            <CardDescription>Search Companies House to identify prospective lenders or brokers.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {/* Embedding the Search Page logic */}
                            <CompanySearch mode="god_mode" />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- AGENTS --- */}
                <TabsContent value="agents" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Sales Agents</CardTitle>
                            <CardDescription>Manage your sales team and assign leads.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Agent Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Joined</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {agents.map((agent) => (
                                        <TableRow key={agent.id}>
                                            <TableCell className="font-medium">{agent.firstName} {agent.lastName}</TableCell>
                                            <TableCell>{agent.email}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{agent.role}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                {agent.createdAt ? format(new Date(agent.createdAt), "MMM d, yyyy") : "N/A"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm">View Details</Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- COMMISSIONS --- */}
                <TabsContent value="commissions" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Commission Tracking</CardTitle>
                            <CardDescription>Monitor payouts and pending commissions.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-4 mb-6">
                                <Card className="p-4 flex-1 bg-green-500/10 border-green-500/20">
                                    <div className="text-sm font-medium text-green-600 mb-1">Total Paid</div>
                                    <div className="text-2xl font-bold">£0.00</div>
                                </Card>
                                <Card className="p-4 flex-1 bg-yellow-500/10 border-yellow-500/20">
                                    <div className="text-sm font-medium text-yellow-600 mb-1">Pending</div>
                                    <div className="text-2xl font-bold">£0.00</div>
                                </Card>
                            </div>

                            <div className="rounded-md border p-8 text-center text-muted-foreground">
                                <DollarSign className="mx-auto h-12 w-12 mb-4 opacity-20" />
                                <p>No commissions recorded yet.</p>
                                <Button variant="outline" className="mt-4">Record Payout</Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
