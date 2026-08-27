import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { BrokerLead } from "@shared/schema";
import { toast } from "sonner";

const STAGES = [
    { key: "new", label: "Identified" },
    { key: "contacted", label: "Contacted" },
    { key: "approved", label: "Approved" },
] as const;

const REJECTED_STATUSES = new Set(["rejected", "non_responsive", "inactive"]);
const KNOWN_STATUSES = new Set(["new", "contacted", "approved", "rejected", "non_responsive"]);

function stageOf(status: string): "new" | "contacted" | "approved" | "rejected" {
    if (REJECTED_STATUSES.has(status)) return "rejected";
    if (status === "contacted") return "contacted";
    if (status === "approved" || status === "active") return "approved";
    return "new";
}

interface IntroducerPipelineProps {
    leads: BrokerLead[];
    isLoading: boolean;
    onSelectLead: (lead: BrokerLead) => void;
}

export function IntroducerPipeline({ leads, isLoading, onSelectLead }: IntroducerPipelineProps) {
    const updateStatus = useMutation({
        mutationFn: ({ id, status }: { id: number; status: string }) =>
            apiRequest(`/api/brokers/leads/${id}`, "PUT", { status }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/brokers/leads"] });
        },
        onError: () => toast.error("Failed to update stage"),
    });

    if (isLoading) {
        return <div className="text-center py-10 text-muted-foreground">Loading pipeline…</div>;
    }

    const buckets: Record<"new" | "contacted" | "approved" | "rejected", BrokerLead[]> = {
        new: [], contacted: [], approved: [], rejected: [],
    };
    for (const lead of leads) buckets[stageOf(lead.status || "new")].push(lead);

    const renderCard = (lead: BrokerLead) => {
        const currentValue = KNOWN_STATUSES.has(lead.status) ? lead.status : "new";
        return (
            <Card
                key={lead.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => onSelectLead(lead)}
            >
                <CardContent className="p-3 space-y-2">
                    <div className="font-medium text-sm truncate">{lead.companyName}</div>
                    <div className="text-xs text-muted-foreground truncate">
                        {lead.contactName || lead.email || "No contact yet"}
                    </div>
                    <Select
                        value={currentValue}
                        onValueChange={(value) => updateStatus.mutate({ id: lead.id, status: value })}
                    >
                        <SelectTrigger className="h-7 text-xs" onClick={(e) => e.stopPropagation()}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent onClick={(e) => e.stopPropagation()}>
                            <SelectItem value="new">Identified</SelectItem>
                            <SelectItem value="contacted">Contacted</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                            <SelectItem value="non_responsive">Non-responsive</SelectItem>
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {STAGES.map((stage) => (
                    <div key={stage.key} className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-sm">{stage.label}</h3>
                            <Badge variant="secondary">{buckets[stage.key].length}</Badge>
                        </div>
                        <div className="space-y-2 min-h-[80px]">
                            {buckets[stage.key].length === 0 ? (
                                <p className="text-xs text-muted-foreground py-6 text-center border border-dashed rounded-lg">
                                    Nothing here
                                </p>
                            ) : (
                                buckets[stage.key].map(renderCard)
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="rounded-lg border border-dashed border-destructive/30 bg-destructive/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-destructive">Rejection dump</h3>
                    <Badge variant="outline" className="border-destructive/40 text-destructive">
                        {buckets.rejected.length}
                    </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                    Non-responsive prospects and introducers actively rejected.
                </p>
                {buckets.rejected.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">Nothing rejected.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {buckets.rejected.map(renderCard)}
                    </div>
                )}
            </div>
        </div>
    );
}
