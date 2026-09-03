import { renderCallForDeal, renderOutreachEmail, type OutreachTouchId } from "@shared/strataOutreach";
import type { AgenticDealFile } from "@shared/agenticWorkflow";

const TOUCH_IDS: OutreachTouchId[] = [
  "inbound_ack",
  "inbound_chase",
  "sme_1",
  "sme_linkedin",
  "sme_2",
  "sme_close",
  "intro_1",
  "intro_linkedin",
  "intro_2",
];

export function OutreachPlaybook({ deal }: { deal: AgenticDealFile }) {
  const onCall = deal.stage === "human_call";
  const playbook = deal.callPlaybook || (onCall ? renderCallForDeal(deal) : undefined);
  const lastEmail =
    deal.outreachTouchId && TOUCH_IDS.includes(deal.outreachTouchId as OutreachTouchId)
      ? renderOutreachEmail(
          deal,
          deal.outreachTouchId as OutreachTouchId,
          deal.source === "strata_inbound" ? "inbound-intake" : "outreach-sales"
        )
      : deal.outreachBody
        ? { subject: deal.outreachSubject || "Last email", text: stripHtml(deal.outreachBody) }
        : null;

  if (!lastEmail && !deal.socialPlaybook && !playbook) return null;

  return (
    <div className="space-y-3 rounded-md border border-slate-800 bg-slate-950/50 px-3 py-3">
      {lastEmail && !onCall && (
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
            {deal.status === "waiting_human" && deal.humanReason?.includes("Approve this email")
              ? "Email draft — waiting for approval"
              : "Email sent"}
          </p>
          <p className="text-sm font-medium text-white">{lastEmail.subject}</p>
          <p className="text-sm text-slate-300 whitespace-pre-wrap line-clamp-10 mt-1">{lastEmail.text}</p>
        </div>
      )}
      {deal.socialPlaybook && (deal.humanReason?.includes("LinkedIn") || deal.stage === "outreach") && (
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
            LinkedIn — {deal.socialPlaybook.action}
          </p>
          <p className="text-sm text-slate-200 whitespace-pre-wrap">{deal.socialPlaybook.message}</p>
        </div>
      )}
      {onCall && playbook && (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-amber-200">{playbook.title}</p>
          <p className="text-sm text-white">{playbook.opener}</p>
          {playbook.beats.slice(0, 4).map((beat) => (
            <div key={beat.label}>
              <p className="text-xs text-slate-500">{beat.label}</p>
              <p className="text-sm text-slate-200">{beat.say}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .trim();
}
