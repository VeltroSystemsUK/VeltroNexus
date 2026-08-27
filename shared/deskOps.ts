import { AGENT_DIRECTORY } from "./agentMailboxes";
import { STAGE_AGENT, type AgenticDealFile, type AgenticStage } from "./agenticWorkflow";

export const HIBERNATED_DESKS = ["accounts-monitor", "capital-strategist"] as const;

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

function deskForDeal(deal: Pick<AgenticDealFile, "stage" | "source" | "events">): string {
  const lastAgent = [...(deal.events || [])].reverse().find((event) => event.agent)?.agent;
  if (deal.stage === "human_call" || deal.stage === "human_review" || deal.stage === "complete" || deal.stage === "failed") {
    return lastAgent || STAGE_AGENT[deal.stage as AgenticStage] || "unassigned";
  }
  return STAGE_AGENT[deal.stage] || lastAgent || (deal.source === "strata_inbound" ? "inbound-intake" : "database-builder");
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
