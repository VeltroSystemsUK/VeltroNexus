import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Campaign, InsertCampaign } from "@shared/schema";
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle
} from "@/components/ui/card";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    MapPin,
    Factory,
    Play,
    Pause,
    Trash2,
    Plus,
    Target,
    BarChart3,
    Globe
} from "lucide-react";
import { Loader2 } from "lucide-react";

export function CampaignManager() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newCampaign, setNewCampaign] = useState<Partial<InsertCampaign>>({
        name: "",
        type: "region",
        value: "",
        priority: "medium",
        status: "active"
    });

    const { data: campaigns, isLoading } = useQuery<Campaign[]>({
        queryKey: ["/api/campaigns"],
    });

    const createMutation = useMutation({
        mutationFn: async (campaign: Partial<InsertCampaign>) => {
            const res = await apiRequest("/api/campaigns", "POST", campaign);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
            setIsCreateOpen(false);
            setNewCampaign({ name: "", type: "region", value: "", priority: "medium", status: "active" });
            toast({ title: "Campaign Launched", description: "The agent will now target this vector." });
        },
        onError: (e: any) => {
            toast({ title: "Failed", description: e.message, variant: "destructive" });
        }
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: number, updates: Partial<Campaign> }) => {
            const res = await apiRequest(`/api/campaigns/${id}`, "PATCH", updates);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
            toast({ title: "Updated", description: "Campaign status updated." });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            await apiRequest(`/api/campaigns/${id}`, "DELETE");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
            toast({ title: "Deleted", description: "Campaign removed." });
        }
    });

    const handleSubmit = () => {
        if (!newCampaign.name || !newCampaign.value) {
            toast({ title: "Validation Error", description: "Name and Value are required", variant: "destructive" });
            return;
        }
        createMutation.mutate(newCampaign);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Strategy Engine</h2>
                    <p className="text-slate-400">Define search vectors for the autonomous agent.</p>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-primary hover:bg-primary/90">
                            <Plus className="mr-2 h-4 w-4" />
                            New Campaign
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-slate-900 border-slate-800 text-white">
                        <DialogHeader>
                            <DialogTitle>Launch New Campaign</DialogTitle>
                            <DialogDescription>
                                Configure a region or sector for targeted lead acquisition.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Campaign Name</label>
                                <Input
                                    placeholder="e.g. Manchester City Centre"
                                    value={newCampaign.name}
                                    onChange={e => setNewCampaign({ ...newCampaign, name: e.target.value })}
                                    className="bg-slate-950 border-slate-800"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Type</label>
                                    <Select
                                        value={newCampaign.type}
                                        onValueChange={(v: "region" | "sector") => setNewCampaign({ ...newCampaign, type: v })}
                                    >
                                        <SelectTrigger className="bg-slate-950 border-slate-800">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                            <SelectItem value="region">Region (Postcode/City)</SelectItem>
                                            <SelectItem value="sector">Sector (SIC Code)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Target Value</label>
                                    <Input
                                        placeholder={newCampaign.type === 'region' ? "e.g. M3, Manchester" : "e.g. 41202"}
                                        value={newCampaign.value}
                                        onChange={e => setNewCampaign({ ...newCampaign, value: e.target.value })}
                                        className="bg-slate-950 border-slate-800"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Priority</label>
                                <Select
                                    value={newCampaign.priority}
                                    onValueChange={(v: "low" | "medium" | "high") => setNewCampaign({ ...newCampaign, priority: v })}
                                >
                                    <SelectTrigger className="bg-slate-950 border-slate-800">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                        <SelectItem value="high">High (Daily Scan)</SelectItem>
                                        <SelectItem value="medium">Medium (Weekly Scan)</SelectItem>
                                        <SelectItem value="low">Low (Backlog)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="border-slate-700 text-white">Cancel</Button>
                            <Button onClick={handleSubmit} disabled={createMutation.isPending} className="bg-primary hover:bg-primary/90">
                                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Launch Campaign
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {campaigns?.map(campaign => (
                    <Card key={campaign.id} className="bg-slate-900 border-slate-800 hover:border-primary/50 transition-all">
                        <CardHeader className="flex flex-row items-start justify-between pb-2">
                            <div className="space-y-1">
                                <CardTitle className="text-lg font-bold flex items-center gap-2">
                                    {campaign.type === 'region' ? <MapPin className="h-4 w-4 text-emerald-500" /> : <Factory className="h-4 w-4 text-blue-500" />}
                                    {campaign.name}
                                </CardTitle>
                                <CardDescription className="text-xs font-mono bg-slate-950 px-2 py-1 rounded inline-block border border-slate-800">
                                    {campaign.value}
                                </CardDescription>
                            </div>
                            <Badge variant={campaign.status === 'active' ? "default" : "secondary"} className="uppercase text-[10px]">
                                {campaign.status}
                            </Badge>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800/50">
                                    <span className="text-xs text-slate-500 block mb-1">Leads Found</span>
                                    <span className="text-xl font-bold text-white flex items-center gap-2">
                                        <Target className="h-4 w-4 text-primary" />
                                        {campaign.leadsFound}
                                    </span>
                                </div>
                                <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800/50">
                                    <span className="text-xs text-slate-500 block mb-1">Last Run</span>
                                    <span className="text-sm font-medium text-slate-300">
                                        {campaign.lastRun ? new Date(campaign.lastRun).toLocaleDateString() : 'Pending'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                                    onClick={() => updateMutation.mutate({
                                        id: campaign.id!,
                                        updates: { status: campaign.status === 'active' ? 'paused' : 'active' }
                                    })}
                                >
                                    {campaign.status === 'active' ? <Pause className="mr-2 h-3 w-3" /> : <Play className="mr-2 h-3 w-3" />}
                                    {campaign.status === 'active' ? 'Pause' : 'Resume'}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="px-2 border-slate-700 text-slate-400 hover:text-red-400 hover:bg-red-950/20"
                                    onClick={() => {
                                        if (confirm("Delete this campaign?")) deleteMutation.mutate(campaign.id!)
                                    }}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {/* Empty State / Prompt */}
                {campaigns?.length === 0 && !isLoading && (
                    <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/50">
                        <Globe className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-300">No Active Campaigns</h3>
                        <p className="text-sm text-slate-500 mb-4">Define a region to start autonomous prospecting.</p>
                        <Button variant="outline" onClick={() => setIsCreateOpen(true)} className="border-primary/50 text-primary hover:bg-primary/10">
                            Create First Campaign
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
