import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AgenticDealFile } from "@shared/agenticWorkflow";
import {
  eligibleDeals,
  jobsForAgent,
  liveDelegateDesks,
  type DelegateJobId,
} from "@shared/delegate";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

type DelegateResult = {
  ok: boolean;
  jobId: string;
  agentId: string;
  summary: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAgentId?: string;
};

export function DelegateDialog({ open, onOpenChange, initialAgentId }: Props) {
  const { toast } = useToast();
  const desks = liveDelegateDesks();
  const defaultDesk =
    desks.find((desk) => desk.agentId === "database-builder")?.agentId || desks[0]?.agentId || "";
  const [agentId, setAgentId] = useState(initialAgentId || defaultDesk);
  const [jobId, setJobId] = useState<DelegateJobId>("hunt");
  const [dealId, setDealId] = useState("");
  const [note, setNote] = useState("");

  const { data: deals = [] } = useQuery<AgenticDealFile[]>({
    queryKey: ["/api/agentic/deals"],
    enabled: open,
  });

  const jobs = useMemo(() => jobsForAgent(agentId), [agentId]);
  const job = jobs.find((item) => item.id === jobId) || jobs[0];
  const files = useMemo(
    () => (job ? eligibleDeals(job.id, deals) : []),
    [job, deals]
  );

  useEffect(() => {
    if (!open) return;
    const nextAgent =
      initialAgentId && desks.some((desk) => desk.agentId === initialAgentId)
        ? initialAgentId
        : defaultDesk;
    setAgentId(nextAgent);
    setNote("");
    setDealId("");
  }, [open, initialAgentId]);

  useEffect(() => {
    const nextJob = jobsForAgent(agentId)[0];
    setJobId(nextJob?.id || "hunt");
    setDealId("");
  }, [agentId]);

  const mutate = useMutation({
    mutationFn: async (): Promise<DelegateResult> => {
      if (!job) throw new Error("Pick a job");
      const res = await apiRequest("/api/agentic/delegate", "POST", {
        agentId,
        jobId: job.id,
        dealId: job.needsDeal ? Number(dealId) : undefined,
        note: note.trim() || undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agentic/deals"] });
      toast({ title: "Put to work", description: data.summary });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Could not delegate", description: error.message, variant: "destructive" });
    },
  });

  const canRun = Boolean(job) && (!job?.needsDeal || Boolean(dealId));
  const selectedDesk = desks.find((desk) => desk.agentId === agentId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-950 border-slate-800 text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Delegate</DialogTitle>
          <DialogDescription className="text-slate-400">
            Assign a real job to a desk. Scheduling comes later — this runs now.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Desk</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger className="bg-slate-900 border-slate-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {desks.map((desk) => (
                  <SelectItem key={desk.agentId} value={desk.agentId}>
                    {desk.displayName} · {desk.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Job</Label>
            <Select
              value={job?.id}
              onValueChange={(value) => {
                setJobId(value as DelegateJobId);
                setDealId("");
              }}
            >
              <SelectTrigger className="bg-slate-900 border-slate-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {jobs.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {job ? <p className="text-xs text-slate-500">{job.description}</p> : null}
          </div>

          {job?.needsDeal ? (
            <div className="space-y-2">
              <Label>File</Label>
              {files.length === 0 ? (
                <p className="text-sm text-amber-200">
                  {selectedDesk?.displayName} has no file ready for this job.
                </p>
              ) : (
                <Select value={dealId} onValueChange={setDealId}>
                  <SelectTrigger className="bg-slate-900 border-slate-800">
                    <SelectValue placeholder="Pick a file" />
                  </SelectTrigger>
                  <SelectContent>
                    {files.map((file) => (
                      <SelectItem key={file.id} value={String(file.id)}>
                        {file.companyName} · {file.stage.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Briefing (optional)</Label>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What you want done. Logged on the file."
              className="bg-slate-900 border-slate-800 text-white min-h-[72px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutate.mutate()} disabled={!canRun || mutate.isPending}>
            {mutate.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Working…
              </>
            ) : (
              "Put to work"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
