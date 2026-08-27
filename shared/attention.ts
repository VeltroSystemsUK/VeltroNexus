import { isNoiseDeal, STAGE_LABELS, type AgenticDealFile } from "./agenticWorkflow";

export type AttentionItem = {
  id: string;
  title: string;
  task: string;
  at: string;
  to: string;
  tone: "accent" | "plain";
};

function needsYou(deal: AgenticDealFile): boolean {
  if (deal.status === "waiting_human") return true;
  return deal.stage === "human_call" || deal.stage === "human_review" || deal.stage === "company_match";
}

function taskFor(deal: AgenticDealFile): string {
  const reason = String(deal.humanReason || "");
  if (deal.stage === "company_match") return "Pick the Companies House match";
  if (deal.stage === "human_call") return "Call this contact — script is on the file";
  if (deal.stage === "human_review") return "Approve the file for Sterling";
  if (/linkedin/i.test(reason)) return "Mark LinkedIn posted so the cadence can continue";
  if (/smtp/i.test(reason) || /did not send/i.test(reason)) return "Email did not send — retry when mail is live";
  if (/personal mailbox|pecr/i.test(reason)) return "Personal mailbox — will not cold-email";
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
      const urgent = deal.stage === "human_call" || deal.stage === "human_review" || deal.stage === "company_match";
      return {
        id: String(deal.id),
        title: deal.companyName,
        task,
        at: stampOf(deal),
        to: "/workforce",
        tone: urgent ? "accent" : "plain",
      };
    })
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
