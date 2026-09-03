import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DigitalAssociate } from "@shared/agents";
import type { AgenticDealFile } from "@shared/agenticWorkflow";
import {
  deskJobProgress,
  summariseDeskFunctions,
  type DeskFunctionSpec,
  type DeskLiveState,
} from "@shared/deskOps";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

type RunningJob = {
  agentId?: string;
  status?: string;
  totalSteps?: number;
  completedSteps?: number;
  currentStep?: string;
};

const STATE_LABEL: Record<DeskLiveState, string> = {
  working: "Working",
  waiting_you: "Waiting on you",
  waiting_timer: "On timer",
  idle: "Idle",
  hibernated: "Hibernated",
};

function specFromAgent(agent: DigitalAssociate): DeskFunctionSpec {
  const role = typeof agent.role === "string" ? agent.role : Object.values(agent.role || {})[0] || "";
  const description =
    typeof agent.description === "string" ? agent.description : Object.values(agent.description || {})[0] || "";
  return {
    agentId: agent.id,
    name: agent.name,
    role,
    job: agent.workflow?.jobDescription || description,
    duties: agent.workflow?.responsibilities || [],
  };
}

function relativeTime(iso?: string, nowMs = Date.now()): string | undefined {
  if (!iso) return undefined;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return undefined;
  const delta = Math.max(0, nowMs - then);
  if (delta < 10_000) return "just now";
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

function dueIn(iso?: string, nowMs = Date.now()): string | undefined {
  if (!iso) return undefined;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return undefined;
  const delta = then - nowMs;
  if (delta <= 0) return "due now";
  if (delta < 60_000) return `due in ${Math.ceil(delta / 1000)}s`;
  if (delta < 3_600_000) return `due in ${Math.ceil(delta / 60_000)}m`;
  return `due in ${Math.ceil(delta / 3_600_000)}h`;
}

export function DeskFunctionsPanel() {
  const { data: roster = [], isLoading: rosterLoading } = useQuery<DigitalAssociate[]>({
    queryKey: ["/api/workforce"],
  });
  const { data: deals = [], isLoading: dealsLoading } = useQuery<AgenticDealFile[]>({
    queryKey: ["/api/agentic/deals"],
    refetchInterval: 2000,
  });
  const { data: runningJobs = [] } = useQuery<RunningJob[]>({
    queryKey: ["/api/agent-jobs/running"],
    refetchInterval: 2000,
  });

  const rows = useMemo(() => {
    const specs = roster.map(specFromAgent);
    return summariseDeskFunctions({
      specs,
      deals,
      runningJobAgentIds: runningJobs
        .filter((job) => job.status === "running" || !job.status)
        .map((job) => String(job.agentId || ""))
        .filter(Boolean),
    });
  }, [roster, deals, runningJobs]);

  const working = rows.filter((row) => row.state === "working").length;
  const waitingYou = rows.filter((row) => row.state === "waiting_you").length;

  if (rosterLoading || dealsLoading) {
    return <p className="text-sm text-slate-400">Loading desks…</p>;
  }

  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">No desks on the roster yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-sm text-slate-400">
          What each desk is for, and whether it is actually running. Refreshes every two seconds from Deal files
          and live jobs.
        </p>
        <p className="text-xs tabular-nums text-slate-500" aria-live="polite">
          <span className="text-emerald-300">{working} working</span>
          <span className="mx-2 text-slate-700">·</span>
          <span className={waitingYou ? "text-amber-200" : undefined}>{waitingYou} waiting on you</span>
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {rows.map((row) => {
          const progress = deskJobProgress(runningJobs, row.agentId);
          return (
          <article
            key={row.agentId}
            className={cn(
              "rounded-lg border bg-slate-900 p-4",
              row.state === "working" && "border-emerald-800/80",
              row.state === "waiting_you" && "border-amber-800/80",
              row.state === "waiting_timer" && "border-slate-700",
              row.state === "idle" && "border-slate-800",
              row.state === "hibernated" && "border-slate-800 opacity-60"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-white truncate">{row.name}</h3>
                <p className="text-xs text-slate-500 truncate">{row.role}</p>
              </div>
              <StatusPill state={row.state} />
            </div>

            <p className="mt-3 text-sm text-slate-300 leading-relaxed">{row.job}</p>

            {row.duties.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {row.duties.slice(0, 4).map((duty) => (
                  <li key={duty} className="text-xs text-slate-400 leading-snug pl-3 relative">
                    <span className="absolute left-0 top-1.5 h-1 w-1 rounded-full bg-slate-600" />
                    {duty}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-500">
              {progress ? (
                  <div className="mb-3 space-y-1.5" aria-live="polite">
                    <div className="flex justify-between gap-2 text-[11px]">
                      <span className="text-emerald-300 truncate">{progress.current || "Working"}</span>
                      <span className="tabular-nums text-slate-400 shrink-0">{progress.label}</span>
                    </div>
                    <Progress value={progress.pct} className="h-1.5 bg-slate-800" />
                  </div>
              ) : null}
              {row.state === "working" && row.workingOn ? (
                <p>
                  <span className="text-emerald-300">On file</span> {row.workingOn}
                  {row.lastEvent ? <span className="block text-slate-400 mt-1">{row.lastEvent}</span> : null}
                  {row.lastEventAt ? (
                    <span className="block mt-1 tabular-nums">{relativeTime(row.lastEventAt)}</span>
                  ) : null}
                </p>
              ) : null}
              {row.state === "waiting_you" ? (
                <p>
                  {row.waitingYou} file{row.waitingYou === 1 ? "" : "s"} waiting on you
                  {row.workingOn ? ` · ${row.workingOn}` : ""}
                  {row.lastEvent ? <span className="block text-slate-400 mt-1">{row.lastEvent}</span> : null}
                </p>
              ) : null}
              {row.state === "waiting_timer" ? (
                <p>
                  Timer running{row.workingOn ? ` on ${row.workingOn}` : ""}
                  {row.nextDue ? <span className="block tabular-nums mt-1">{dueIn(row.nextDue)}</span> : null}
                </p>
              ) : null}
              {row.state === "idle" ? <p>No live file on this desk.</p> : null}
              {row.state === "hibernated" ? <p>Not in the launch factory.</p> : null}
            </div>
          </article>
          );
        })}
      </div>
    </div>
  );
}

function StatusPill({ state }: { state: DeskLiveState }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        state === "working" && "border-emerald-700/60 bg-emerald-950/40 text-emerald-300",
        state === "waiting_you" && "border-amber-700/60 bg-amber-950/40 text-amber-200",
        state === "waiting_timer" && "border-slate-600 bg-slate-950 text-slate-300",
        state === "idle" && "border-slate-700 bg-slate-950 text-slate-500",
        state === "hibernated" && "border-slate-800 bg-slate-950 text-slate-600"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          state === "working" && "bg-emerald-400 motion-safe:animate-pulse",
          state === "waiting_you" && "bg-amber-300",
          state === "waiting_timer" && "bg-sky-400",
          state === "idle" && "bg-slate-600",
          state === "hibernated" && "bg-slate-700"
        )}
        aria-hidden
      />
      {STATE_LABEL[state]}
    </span>
  );
}
