import { getDelegateJob, isDealEligible, type DelegateJobId } from "@shared/delegate";
import { HIBERNATED_DESKS } from "@shared/deskOps";
import type { AgenticDealFile } from "@shared/agenticWorkflow";
import { storage } from "../storage";
import { agenticWorkflow } from "./agenticWorkflow";

export class DelegateError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type DelegateRequest = {
  agentId: string;
  jobId: string;
  dealId?: number;
  note?: string;
};

function lastMessage(deal: AgenticDealFile): string {
  return deal.events?.[deal.events.length - 1]?.message || deal.humanReason || "Done";
}

async function withBriefing(deal: AgenticDealFile, agentId: string, label: string, note?: string): Promise<AgenticDealFile> {
  const briefing = String(note || "").trim();
  const message = briefing ? `Director delegated: ${label}. ${briefing}` : `Director delegated: ${label}`;
  return storage.updateAgenticDeal(deal.id, {
    events: [
      ...(deal.events || []),
      { at: new Date().toISOString(), stage: deal.stage, agent: agentId, message },
    ],
  }) as Promise<AgenticDealFile>;
}

export async function runDelegate(input: DelegateRequest) {
  const agentId = String(input.agentId || "").trim();
  const job = getDelegateJob(agentId, String(input.jobId || "").trim());
  if (!job) throw new DelegateError("That desk cannot do that job");
  if (HIBERNATED_DESKS.includes(agentId as (typeof HIBERNATED_DESKS)[number])) {
    throw new DelegateError("That desk is hibernated");
  }

  if (job.id === "hunt") {
    const streamFilter =
      agentId === "database-builder-se" ? "introducer" :
      agentId === "database-builder" ? "sme" :
      undefined;
    const result = await agenticWorkflow.startFromDistressScan(undefined, streamFilter);
    const rejectedTotal = Object.values(result.rejected).reduce((sum, count) => sum + count, 0);
    return {
      ok: true,
      jobId: job.id,
      agentId,
      summary: `Looked at ${result.scanned} candidates, opened ${result.deals.length}.`,
      hunt: {
        opened: result.deals.length,
        scanned: result.scanned,
        rejected: result.rejected,
        rejectedTotal,
      },
    };
  }

  if (!input.dealId) throw new DelegateError("Pick a file for this job");
  const existing = await storage.getAgenticDeal(input.dealId);
  if (!existing) throw new DelegateError("Deal file not found", 404);
  if (!isDealEligible(job.id as DelegateJobId, existing)) {
    throw new DelegateError("That file is not ready for this job");
  }

  const deal = await withBriefing(existing, agentId, job.label, input.note);
  let updated: AgenticDealFile;
  switch (job.id) {
    case "match_company":
      updated = await agenticWorkflow.runIngest(deal);
      break;
    case "find_contact":
      updated = await agenticWorkflow.completeContactAndSync(deal);
      break;
    case "retry_send":
      updated = await agenticWorkflow.resolveHuman(deal.id, "retry_send", input.note);
      break;
    case "chase_pack":
      updated = await agenticWorkflow.runFulfilment(deal);
      break;
    case "process_pack":
      updated = deal.stage === "underwriting"
        ? await agenticWorkflow.runUnderwriting(deal)
        : await agenticWorkflow.runProcessing(deal);
      break;
    default:
      throw new DelegateError("Unknown job");
  }

  return {
    ok: true,
    jobId: job.id,
    agentId,
    summary: lastMessage(updated),
    deal: updated,
  };
}
