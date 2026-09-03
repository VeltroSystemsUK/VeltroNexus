import { AGENT_DIRECTORY } from "./agentMailboxes";
import { STAGE_AGENT, type AgenticDealFile, type AgenticStage } from "./agenticWorkflow";

export const HIBERNATED_DESKS = ["accounts-monitor", "capital-strategist", "database-builder-se"] as const;

export type DeskMail = {
  agentId?: string;
  direction?: string;
  status?: string;
};

export type DeskOpsRow = {
  agentId: string;
  name: string;
  role: string;
  open: number;
  waitingYou: number;
  mailed: number;
  notDelivered: number;
  lastFile?: string;
  lastEvent?: string;
};

export function deskJobProgress(
  jobs: Array<{
    agentId?: string;
    status?: string;
    totalSteps?: number;
    completedSteps?: number;
    currentStep?: string;
    startedAt?: string;
  }>,
  agentId: string
): { pct: number; label: string; current?: string } | null {
  const running = jobs.filter((item) => item.agentId === agentId && (item.status === "running" || !item.status));
  const job = [...running].sort((a, b) => String(b.startedAt || "").localeCompare(String(a.startedAt || "")))[0];
  if (!job || !job.totalSteps) return null;
  const done = job.completedSteps || 0;
  return {
    pct: Math.min(100, Math.round((done / job.totalSteps) * 100)),
    label: `${done} / ${job.totalSteps}`,
    current: job.currentStep,
  };
}

export function deskForDeal(
  deal: Pick<AgenticDealFile, "stage" | "source" | "events"> &
    Partial<Pick<AgenticDealFile, "stream" | "email" | "phone" | "status" | "hopper">>
): string {
  const lastAgent = [...(deal.events || [])].reverse().find((event) => event.agent)?.agent;
  const inbound = deal.source === "strata_inbound";
  if (deal.hopper === "quarantine") return "harvest";
  if (
    !inbound &&
    deal.stream !== "introducer" &&
    !deal.email &&
    (deal.hopper === "hunt_contact" || deal.hopper === "gated")
  ) {
    return "harvest";
  }

  if (deal.stream === "introducer") {
    if (!deal.email && !deal.phone) {
      if (deal.stage === "enrich" || lastAgent === "contact-finder") return "contact-finder";
      return lastAgent || "database-builder-se";
    }
    if (deal.stage === "enrich") return "contact-finder";
    if (deal.stage === "fulfilment") return "fulfilment-manager";
    if (deal.stage === "outreach" || deal.stage === "human_call") return lastAgent || "outreach-sales";
    return lastAgent || "database-builder-se";
  }

  if (deal.stage === "enrich") return "contact-finder";
  if (deal.stage === "fulfilment") return "fulfilment-manager";
  if (deal.stage === "processing" || deal.stage === "underwriting" || deal.stage === "human_review") {
    return lastAgent || "deal-processing-underwriter";
  }
  if (deal.stage === "human_call" || deal.stage === "complete" || deal.stage === "failed") {
    return lastAgent || STAGE_AGENT[deal.stage as AgenticStage] || "unassigned";
  }
  if (inbound) {
    if (deal.stage === "ingest" || deal.stage === "company_match" || deal.stage === "pipeline" || deal.stage === "outreach") {
      return lastAgent || "inbound-intake";
    }
    return STAGE_AGENT[deal.stage] || lastAgent || "inbound-intake";
  }
  if (deal.stage === "ingest" || deal.stage === "company_match" || deal.stage === "pipeline") {
    return lastAgent || "database-builder";
  }
  if (deal.stage === "outreach") return lastAgent || "outreach-sales";
  return STAGE_AGENT[deal.stage] || lastAgent || "database-builder";
}

export const WORKING_WINDOW_MS = 2 * 60 * 1000;

export type DeskLiveState = "working" | "waiting_you" | "waiting_timer" | "idle" | "hibernated";

export type DeskFunctionSpec = {
  agentId: string;
  name: string;
  role: string;
  job: string;
  duties: string[];
};

export type DeskFunctionRow = DeskFunctionSpec & {
  state: DeskLiveState;
  open: number;
  waitingYou: number;
  workingOn?: string;
  lastEvent?: string;
  lastEventAt?: string;
  nextDue?: string;
};

const STATE_RANK: Record<DeskLiveState, number> = {
  working: 0,
  waiting_you: 1,
  waiting_timer: 2,
  idle: 3,
  hibernated: 4,
};

function lastEventByAgent(
  deals: Array<Pick<AgenticDealFile, "events" | "companyName">>,
  agentId: string
): { at?: string; message?: string; companyName?: string } {
  let best: { at: string; message?: string; companyName?: string } | undefined;
  for (const deal of deals) {
    for (const event of deal.events || []) {
      if (event.agent !== agentId || !event.at) continue;
      if (!best || event.at > best.at) {
        best = { at: event.at, message: event.message, companyName: deal.companyName };
      }
    }
  }
  return best || {};
}

export function summariseDeskFunctions(input: {
  specs: DeskFunctionSpec[];
  deals: Array<
    Pick<AgenticDealFile, "id" | "stage" | "status" | "source" | "companyName" | "events"> &
      Partial<Pick<AgenticDealFile, "waitUntil" | "stream" | "email" | "phone">>
  >;
  runningJobAgentIds?: string[];
  nowMs?: number;
  workingWindowMs?: number;
}): DeskFunctionRow[] {
  const nowMs = input.nowMs ?? Date.now();
  const windowMs = input.workingWindowMs ?? WORKING_WINDOW_MS;
  const runningJobs = new Set(input.runningJobAgentIds || []);

  const rows = input.specs.map((spec) => {
    const hibernated = HIBERNATED_DESKS.includes(spec.agentId as (typeof HIBERNATED_DESKS)[number]);
    const owned = input.deals.filter((deal) => deskForDeal(deal) === spec.agentId);
    const openDeals = owned.filter((deal) => deal.status !== "complete" && deal.status !== "failed");
    const running = openDeals.filter((deal) => deal.status === "running");
    const waitingYou = openDeals.filter((deal) => deal.status === "waiting_human");
    const waitingTimer = openDeals.filter((deal) => deal.status === "waiting_timer");
    const last = lastEventByAgent(input.deals, spec.agentId);
    const recent = last.at ? nowMs - Date.parse(last.at) <= windowMs : false;
    const workingFile =
      [...running].sort((a, b) => {
        const aAt = a.events?.[a.events.length - 1]?.at || "";
        const bAt = b.events?.[b.events.length - 1]?.at || "";
        return bAt.localeCompare(aAt);
      })[0] || openDeals[0];

    let state: DeskLiveState = "idle";
    if (hibernated) state = "hibernated";
    else if (runningJobs.has(spec.agentId) || running.length > 0 || recent) state = "working";
    else if (waitingYou.length > 0) state = "waiting_you";
    else if (waitingTimer.length > 0) state = "waiting_timer";

    const nextDue = waitingTimer
      .map((deal) => deal.waitUntil)
      .filter((value): value is string => Boolean(value))
      .sort()[0];

    return {
      ...spec,
      state,
      open: openDeals.length,
      waitingYou: waitingYou.length,
      workingOn: workingFile?.companyName || last.companyName,
      lastEvent: last.message,
      lastEventAt: last.at,
      nextDue,
    };
  });

  return rows.sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state]);
}

export function summariseDeskOps(input: {
  deals: Array<Pick<AgenticDealFile, "id" | "stage" | "status" | "source" | "companyName" | "events">>;
  mail: DeskMail[];
}): DeskOpsRow[] {
  const live = AGENT_DIRECTORY.filter((row) => !HIBERNATED_DESKS.includes(row.agentId as (typeof HIBERNATED_DESKS)[number]));
  return live.map((desk) => {
    const owned = input.deals.filter((deal) => deskForDeal(deal) === desk.agentId);
    const openDeals = owned.filter((deal) => deal.status !== "complete" && deal.status !== "failed");
    const last = [...openDeals].sort((a, b) => {
      const aAt = a.events?.[a.events.length - 1]?.at || "";
      const bAt = b.events?.[b.events.length - 1]?.at || "";
      return bAt.localeCompare(aAt);
    })[0];
    const outbound = input.mail.filter((item) => item.agentId === desk.agentId && item.direction === "outbound");
    return {
      agentId: desk.agentId,
      name: desk.displayName,
      role: desk.role,
      open: openDeals.length,
      waitingYou: openDeals.filter((deal) => deal.status === "waiting_human").length,
      mailed: outbound.filter((item) => item.status === "sent").length,
      notDelivered: outbound.filter((item) => item.status === "mock" || item.status === "failed").length,
      lastFile: last?.companyName,
      lastEvent: last?.events?.[last.events.length - 1]?.message,
    };
  });
}
