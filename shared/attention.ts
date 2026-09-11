import { isNoiseDeal, STAGE_LABELS, type AgenticDealFile } from "./agenticWorkflow";
import { isAutoReplyText } from "./mailDesk";
import { isSmeHopperSendable } from "./smeHopper";
import { isWaitingLinkedInHold } from "./outreachSend";
import { isWaitingSmeEmailApproval, smeFirstTouchSlot } from "./smeOutreach";

export type AttentionItem = {
  id: string;
  title: string;
  task: string;
  at: string;
  to: string;
  tone: "accent" | "plain";
};

export function needsDirector(deal: Pick<AgenticDealFile, "status" | "stage" | "humanReason" | "hopper"> & Partial<AgenticDealFile>): boolean {
  if (isNoiseDeal(deal as AgenticDealFile)) return false;
  if (isWaitingSmeEmailApproval(deal)) return false;
  if (isWaitingLinkedInHold(deal)) return false;
  const reason = String(deal.humanReason || "");
  if (deal.hopper === "quarantine" || /no corporate mailbox/i.test(reason)) return false;
  if (/^Bounce:/i.test(reason) || /hard bounce/i.test(reason)) return false;
  if (/Will not send cold email|personal mailbox|pecr|mailbox is not this company/i.test(reason)) return false;
  if (/book_status_blocks/i.test(reason) || /Hunt desk hold/i.test(reason)) return false;
  if (/Approve this email/i.test(reason)) return false;
  const blob = [reason, ...((deal.events || []).map((event) => event.message || ""))].join(" ");
  if (/they replied/i.test(reason) && isAutoReplyText(blob)) return false;
  if (deal.stage === "human_call" || deal.stage === "human_review" || deal.stage === "company_match") return true;
  if (deal.status !== "waiting_human") return false;
  return true;
}

function needsYou(deal: AgenticDealFile): boolean {
  return needsDirector(deal);
}

function taskFor(deal: AgenticDealFile): string {
  const reason = String(deal.humanReason || "");
  if (deal.stage === "company_match") return "Pick the Companies House match";
  if (deal.stage === "human_call") return "Call this contact — script is on the file";
  if (deal.stage === "human_review") return "Approve the file for Sterling";
  if (/linkedin/i.test(reason)) return "Mark LinkedIn posted so the cadence can continue";
  if (/Approve this email/i.test(reason)) return "Approve this first-touch email before it sends";
  if (/smtp/i.test(reason) || /did not send/i.test(reason)) return "Email did not send — retry when mail is live";
  if (/personal mailbox|pecr/i.test(reason)) return "Personal mailbox — will not cold-email";
  if (/introducer outreach is paused/i.test(reason)) return "Introducer outreach is paused";
  if (deal.hopper === "quarantine" || /no corporate mailbox/i.test(reason)) return "Inspect this lead before delete";
  if (reason.trim()) return reason.trim();
  const last = (deal.events || [])[deal.events.length - 1];
  if (last?.message) return last.message;
  return STAGE_LABELS[deal.stage] || "Needs your decision";
}

function stampOf(deal: AgenticDealFile): string {
  const last = (deal.events || [])[deal.events.length - 1];
  return last?.at || deal.updatedAt || deal.createdAt;
}

export function attentionFromDeals(deals: AgenticDealFile[]): AttentionItem[] {
  return deals
    .filter((deal) => !isNoiseDeal(deal) && needsYou(deal))
    .map((deal) => {
      const task = taskFor(deal);
      const urgent =
        deal.stage === "human_call" ||
        deal.stage === "human_review" ||
        deal.stage === "company_match" ||
        /they replied/i.test(deal.humanReason || "");
      return {
        id: String(deal.id),
        title: deal.companyName,
        task,
        at: stampOf(deal),
        to: /they replied/i.test(deal.humanReason || "") ? "/agent-mail" : "/workforce",
        tone: (urgent ? "accent" : "plain") as AttentionItem["tone"],
      };
    })
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export function attentionFromHopper(
  deals: Array<Pick<AgenticDealFile, "hopper" | "source" | "stream" | "email"> & Partial<AgenticDealFile>>,
  now: Date = new Date()
): AttentionItem[] {
  if (!smeFirstTouchSlot(now)) return [];
  if (deals.some((deal) => isSmeHopperSendable(deal))) return [];
  return [
    {
      id: "hopper-dry",
      title: "SME hopper",
      task: "No sendable SME contacts in the hopper — harvest is dry",
      at: now.toISOString(),
      to: "/workforce",
      tone: "accent",
    },
  ];
}

export function attentionFromMail(
  mail: Array<{ id: string; from?: string; subject?: string; createdAt?: string; deskKind?: string; deskNote?: string; direction?: string }>
): AttentionItem[] {
  return mail
    .filter(
      (item) =>
        item.direction === "inbound" &&
        item.deskKind === "responsive" &&
        !isAutoReplyText(`${item.subject || ""} ${item.deskNote || ""} ${item.from || ""}`)
    )
    .map((item) => ({
      id: `mail-${item.id}`,
      title: item.from || "Customer",
      task: item.deskNote || item.subject || "Customer reply — open Agent Mail now",
      at: item.createdAt || new Date().toISOString(),
      to: "/agent-mail",
      tone: "accent" as const,
    }))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
