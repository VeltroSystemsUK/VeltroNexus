import { isPersonalMailbox, isBlockedOutreachMailbox } from "./pecrSend";
import { isSendableContact } from "./smeHopper";
import type { CadenceTouchId } from "./salesOs";
import type { OutreachTouchId } from "./strataOutreach";

export type OutreachHoldReason =
  | "no_mailbox"
  | "mailbox_not_sendable"
  | "pecr_individual"
  | "no_stop_line"
  | "smtp_unhealthy"
  | "refer_contact_missing"
  | "wrong_pipeline_pack"
  | "book_status_blocks"
  | "playbook_gap"
  | "suppressed_email";

export type OutreachPipeline = "sme" | "introducer" | "inbound";

const BLOCKED_STAGES = new Set([
  "human_call",
  "fulfilment",
  "processing",
  "underwriting",
  "human_review",
  "complete",
  "failed",
]);

export function compiledHasStopLine(text: string): boolean {
  return /\breply\s+stop\b|\bSTOP\b/i.test(String(text || ""));
}

export function pipelineAllowsTouch(
  pipeline: OutreachPipeline | string | null | undefined,
  touchId: string
): boolean {
  const id = String(touchId || "");
  const stream = pipeline === "introducer" || pipeline === "inbound" ? pipeline : "sme";
  if (stream === "sme") return /^(sme_|cold_)/.test(id);
  if (stream === "introducer") return id.startsWith("intro_");
  return id.startsWith("inbound_");
}

export function outreachEligibility(input: {
  deal: {
    stream?: string | null;
    stage?: string | null;
    status?: string | null;
    email?: string | null;
    companyName?: string | null;
    companyNumber?: string | null;
    contactName?: string | null;
    directorNames?: string[];
    hopper?: string | null;
    reachableCorporateContact?: boolean;
    doNotContact?: boolean;
  };
  touchId: CadenceTouchId | OutreachTouchId | string;
  compiledText: string;
  channel?: "email" | "linkedin" | "email+call" | string;
}): { ok: true } | { ok: false; reason: OutreachHoldReason } {
  const deal = input.deal;
  if (deal.doNotContact) return { ok: false, reason: "suppressed_email" };

  const pipeline = (deal.stream === "introducer" || deal.stream === "inbound" ? deal.stream : "sme") as OutreachPipeline;
  if (!pipelineAllowsTouch(pipeline, input.touchId)) return { ok: false, reason: "wrong_pipeline_pack" };
  if (pipeline === "inbound") return { ok: true };

  if (BLOCKED_STAGES.has(String(deal.stage || ""))) return { ok: false, reason: "book_status_blocks" };

  if (pipeline === "introducer" && deal.reachableCorporateContact === false) {
    return { ok: false, reason: "refer_contact_missing" };
  }

  const linkedIn = input.channel === "linkedin" || String(input.touchId).includes("linkedin");
  if (linkedIn) return { ok: true };

  if (!deal.email) return { ok: false, reason: "no_mailbox" };
  if (isPersonalMailbox(deal.email)) return { ok: false, reason: "pecr_individual" };
  if (isBlockedOutreachMailbox(deal.email)) return { ok: false, reason: "mailbox_not_sendable" };
  if (
    pipeline !== "inbound" &&
    !isSendableContact({
      email: deal.email,
      contactName: deal.contactName,
      directorNames: deal.directorNames,
      companyName: deal.companyName,
    })
  ) {
    return { ok: false, reason: "mailbox_not_sendable" };
  }

  if (!compiledHasStopLine(input.compiledText)) return { ok: false, reason: "no_stop_line" };
  if (!String(input.compiledText || "").trim()) return { ok: false, reason: "playbook_gap" };

  return { ok: true };
}
