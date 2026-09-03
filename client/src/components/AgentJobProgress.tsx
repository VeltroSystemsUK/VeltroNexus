import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, AlertCircle, Clock, Activity, Trash2, Search, Database, Pause } from "lucide-react";
import { toast } from "sonner";

interface AgentJob {
  id: string;
  agentId: string;
  type: string;
  status: "pending" | "running" | "paused" | "completed" | "failed";
  title: string;
  description: string;
  totalSteps: number;
  completedSteps: number;
  currentStep: string;
  logs: Array<{
    timestamp: string;
    message: string;
    type: "info" | "success" | "warning" | "error";
  }>;
  results: any;
  startedAt: string;
  completedAt?: string;
}

interface AgentJobProgressProps {
  userId?: string;
  refreshInterval?: number;
}

export function AgentJobProgress({ userId, refreshInterval = 2000 }: AgentJobProgressProps) {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: jobs, isLoading } = useQuery<AgentJob[]>({
    queryKey: ["/api/agent-jobs"],
    refetchInterval: refreshInterval,
  });

  const { data: runningJobs } = useQuery<AgentJob[]>({
    queryKey: ["/api/agent-jobs/running"],
    refetchInterval: refreshInterval,
  });

  // Fetch agent roster to show agent names
  const { data: agents } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/workforce"],
  });

  const deleteJobMutation = useMutation({
    mutationFn: (jobId: string) => apiRequest(`/api/agent-jobs/${jobId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent-jobs"] });
      toast.success("Activity record deleted");
    },
    onError: (error: any) => {
      toast.error("Failed to delete record: " + error.message);
    }
  });

  const stopJobMutation = useMutation({
    mutationFn: ({ jobId, action }: { jobId: string; action: "pause" | "complete" }) =>
      apiRequest(`/api/agent-jobs/${jobId}/${action}`, "POST"),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent-jobs/running"] });
      toast.success(vars.action === "pause" ? "Job paused" : "Job completed");
    },
    onError: (error: any) => {
      toast.error("Failed to stop job: " + error.message);
    },
  });

  const getAgentName = (agentId: string) => {
    if (agentId === "enrichment-agent") return "Agent B (Enrichment)";
    if (agentId === "database-builder") return "Opportunity Hunter";
    const agent = agents?.find((a) => a.id === agentId);
    return agent?.name || agentId;
  };

  const safeDate = (date: any) => {
    if (!date) return new Date();
    const d = new Date(date);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-sky-300" />;
      case "paused":
        return <Pause className="h-4 w-4 text-amber-300" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-emerald-400" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-300" />;
      default:
        return <Clock className="h-4 w-4 text-slate-500" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "data_enrichment":
        return <Database className="h-3 w-3 text-violet-300" />;
      case "scheduled_task":
        return <Search className="h-3 w-3 text-sky-300" />;
      default:
        return <Activity className="h-3 w-3 text-slate-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return (
          <Badge className="bg-sky-500/15 text-sky-200 border border-sky-500/30 hover:bg-sky-500/15">
            In Progress
          </Badge>
        );
      case "paused":
        return (
          <Badge className="bg-amber-500/15 text-amber-200 border border-amber-500/30 hover:bg-amber-500/15">
            Paused
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-200 border border-emerald-500/30 hover:bg-emerald-500/15">
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-500/15 text-red-200 border border-red-500/30 hover:bg-red-500/15">
            Failed
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-800">
            Pending
          </Badge>
        );
    }
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-3 w-3 text-emerald-400" />;
      case "error":
        return <AlertCircle className="h-3 w-3 text-red-300" />;
      case "warning":
        return <AlertCircle className="h-3 w-3 text-amber-300" />;
      default:
        return <Activity className="h-3 w-3 text-sky-300" />;
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
            <span className="ml-2 text-sm">Loading jobs…</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const allJobs = jobs ?? [];
  const pinnedRunning = runningJobs ?? [];
  if (allJobs.length === 0 && pinnedRunning.length === 0) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="pt-10 pb-10">
          <div className="flex flex-col items-center justify-center text-slate-500 py-4">
            <Activity className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm font-medium text-slate-300">No jobs yet</p>
            <p className="text-xs text-slate-500">Hunt, enrich, and ingest runs will list here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const recentJobs = [
    ...pinnedRunning,
    ...allJobs.filter((job) => !pinnedRunning.some((running) => running.id === job.id)),
  ].slice(0, Math.max(5, pinnedRunning.length));
  const hasRunningJobs = pinnedRunning.length > 0;

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base text-white flex items-center gap-2">
            Jobs
            {hasRunningJobs && (
              <Badge className="bg-sky-500/15 text-sky-200 border border-sky-500/30 hover:bg-sky-500/15">
                {runningJobs.length} running
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">Hunt, enrich, ingest</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recentJobs.map((job) => (
            <div
              key={job.id}
              className={`rounded-lg p-3 transition-all relative group border ${
                expandedJobId === job.id
                  ? "border-white/20 bg-slate-950"
                  : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
              }`}
            >
              <div className="flex items-start justify-between mb-2 gap-2 flex-wrap">
                <div
                  className="flex flex-col gap-1 cursor-pointer flex-1"
                  onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                >
                  <div className="flex items-center gap-2">
                    {getStatusIcon(job.status)}
                    <span className="font-semibold text-sm text-white">{job.title}</span>
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-medium text-slate-400">
                      {getTypeIcon(job.type)}
                      {job.type === "harvest" ? "Harvest" : job.type === "data_enrichment" ? "Enrichment" : "Discovery"}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 ml-6">
                    {getAgentName(job.agentId)} •{" "}
                    {safeDate(job.startedAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {getStatusBadge(job.status)}
                  {job.status === "running" && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px] text-amber-200 hover:text-amber-100 hover:bg-amber-500/10"
                        disabled={stopJobMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            window.confirm(
                              "Pause this job? Work already done is kept. In-flight API calls may finish, then it stops."
                            )
                          ) {
                            stopJobMutation.mutate({ jobId: job.id, action: "pause" });
                          }
                        }}
                      >
                        <Pause className="h-3 w-3 mr-1" />
                        Pause
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px] text-emerald-200 hover:text-emerald-100 hover:bg-emerald-500/10"
                        disabled={stopJobMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm("Mark this job complete now? Remaining items will not run.")) {
                            stopJobMutation.mutate({ jobId: job.id, action: "complete" });
                          }
                        }}
                      >
                        Complete now
                      </Button>
                    </div>
                  )}
                  {job.status !== "running" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-red-300 hover:bg-red-500/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm("Delete this activity record?")) {
                          deleteJobMutation.mutate(job.id);
                        }
                      }}
                      disabled={deleteJobMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {!expandedJobId || expandedJobId !== job.id ? (
                <div className="ml-6 flex items-center gap-3">
                  <div className="flex-1">
                    <Progress value={(job.completedSteps / job.totalSteps) * 100} className="h-1 bg-slate-800" />
                  </div>
                  <span className="text-[10px] text-slate-500 whitespace-nowrap min-w-[40px]">
                    {Math.round((job.completedSteps / job.totalSteps) * 100)}%
                  </span>
                </div>
              ) : (
                <div className="mt-3 ml-6 space-y-3">
                  <p className="text-xs text-slate-400 italic mb-2 border-l-2 border-slate-700 pl-2">
                    {job.description}
                  </p>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span className="font-medium text-slate-200">{job.currentStep}</span>
                      <span>
                        {job.completedSteps} / {job.totalSteps} targets
                      </span>
                    </div>
                    <Progress value={(job.completedSteps / job.totalSteps) * 100} className="h-1.5 bg-slate-800" />
                  </div>

                  {job.logs.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-800">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Activity log
                      </h4>
                      <ScrollArea className="h-32">
                        <div className="space-y-1.5">
                          {[...job.logs].reverse().map((log, index) => (
                            <div key={index} className="flex items-start gap-2 text-xs">
                              {getLogIcon(log.type)}
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-500 text-[9px]">
                                    {safeDate(log.timestamp).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      second: "2-digit",
                                    })}
                                  </span>
                                  <p
                                    className={
                                      log.type === "error"
                                        ? "text-red-300 font-medium"
                                        : log.type === "success"
                                          ? "text-emerald-300 font-medium"
                                          : "text-slate-300"
                                    }
                                  >
                                    {log.message}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {job.results && (
                    <div className="mt-3 pt-3 border-t border-slate-800">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Summary
                      </h4>
                      <div className="bg-slate-950 border border-slate-800 p-2 rounded text-[10px] font-mono whitespace-pre-wrap text-slate-300">
                        {typeof job.results === "object"
                          ? Object.entries(job.results)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join("\n")
                          : String(job.results)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {job.status === "running" && expandedJobId !== job.id && (
                <div className="mt-2 ml-6 flex items-center gap-1.5 text-[10px] text-sky-300 font-medium">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  <span>Running…</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
