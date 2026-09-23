import { mailboxForAgent } from "@shared/agentMailboxes";
import { coldEmailBlockedReason } from "@shared/pecrSend";
import { wasEmailDelivered } from "@shared/outreachSend";
import { dealStream } from "@shared/salesOs";
import {
  applyOutreachTemplateOverride,
  renderOutreachEmail,
  type OutreachTemplateOverride,
} from "@shared/strataOutreach";
import {
  pickSmeOpenBackfill,
  replySubject,
  shouldSendSmeFollowUp,
  shouldSendSmeOpenFollowUp,
} from "@shared/smeOpenFollowUp";
import { storage } from "../storage";
import { listAgentMail, type AgentMailItem } from "./agentMailLog";
import { sendEmail } from "./email";
import { mailIsSuppressed } from "./mailDesk";

const sendingDealIds = new Set<number>();

function blockedReasonFor(deal: {
  email?: string;
  companyNumber?: string;
  companyName?: string;
  source?: string;
  stream?: string | null;
}): string | null {
  if (mailIsSuppressed(deal.email, deal.companyNumber)) return "suppressed — do not contact";
  return coldEmailBlockedReason(deal.email, dealStream(deal.source, deal.stream), deal.companyName);
}

export async function maybeSendSmeOpenFollowUp(item: AgentMailItem): Promise<boolean> {
  if (!item.dealId) return false;
  if (sendingDealIds.has(item.dealId)) return false;
  sendingDealIds.add(item.dealId);
  try {
    const deal = await storage.getAgenticDeal(item.dealId);
    if (!deal) return false;
    const blockedReason = blockedReasonFor(deal);
    if (!shouldSendSmeOpenFollowUp({ mail: item, deal, blockedReason })) return false;

    const claimedAt = new Date().toISOString();
    const claimed = await storage.updateAgenticDeal(deal.id, { smeOpenFollowUpSentAt: claimedAt });
    if (!claimed?.email) return false;

    const mailbox = mailboxForAgent("outreach-sales");
    const builtIn = renderOutreachEmail(claimed, "sme_open", mailbox);
    const templateOverrides = (await storage.getSystemSetting("agent_outreach_templates")) || {};
    const script = applyOutreachTemplateOverride(
      builtIn,
      templateOverrides.sme_open as OutreachTemplateOverride | undefined,
      claimed,
      mailbox
    );

    try {
      const sendResult = await sendEmail(
        {
          agentId: "outreach-sales",
          fromEmail: mailbox.address,
          fromName: mailbox.fromName,
          replyTo: mailbox.replyTo,
          dealId: claimed.id,
          prospectId: claimed.prospectId,
          touchId: "sme_open",
          contactSource: claimed.contactSource,
          inReplyTo: item.messageId,
        },
        claimed.email,
        replySubject(item.subject || script.subject),
        script.html
      );
      if (!wasEmailDelivered(sendResult)) {
        await storage.updateAgenticDeal(claimed.id, { smeOpenFollowUpSentAt: undefined });
        return false;
      }
      await storage.updateAgenticDeal(claimed.id, {
        events: [
          ...(claimed.events || []),
          {
            at: claimedAt,
            stage: claimed.stage,
            agent: "outreach-sales",
            message: `sme_1 opened — quiz follow-up sent to ${claimed.email}`,
          },
        ],
      });
      return true;
    } catch (error: any) {
      await storage.updateAgenticDeal(claimed.id, { smeOpenFollowUpSentAt: undefined });
      console.error("[AgentMail] sme_open follow-up failed:", error?.message || error);
      return false;
    }
  } finally {
    sendingDealIds.delete(item.dealId);
  }
}

export async function backfillSmeOpenFollowUps(): Promise<{ candidates: number; sent: number; skipped: number }> {
  const candidates = pickSmeOpenBackfill(listAgentMail(2000)) as AgentMailItem[];
  let sent = 0;
  let skipped = 0;
  for (const item of candidates) {
    const ok = await maybeSendSmeOpenFollowUp(item);
    if (ok) sent += 1;
    else skipped += 1;
  }
  return { candidates: candidates.length, sent, skipped };
}

function threadMailForDeal(dealId: number): { messageId?: string; subject: string } {
  const items = listAgentMail(2000).filter(
    (item) => item.dealId === dealId && item.direction === "outbound" && item.status === "sent"
  );
  const sme1 =
    items.find((item) => item.touchId === "sme_1" || item.touchId === "cold_1") ||
    items.find((item) => !item.touchId && /restructuring .+ monthly debt commitments|hmrc petition against /i.test(item.subject || ""));
  const chosen = sme1 || items.find((item) => item.touchId === "sme_open");
  return { messageId: chosen?.messageId, subject: chosen?.subject || "" };
}

export async function maybeSendSmeFollowUp(dealId: number): Promise<boolean> {
  if (!dealId) return false;
  if (sendingDealIds.has(dealId)) return false;
  sendingDealIds.add(dealId);
  try {
    const deal = await storage.getAgenticDeal(dealId);
    if (!deal) return false;
    const inboundDeals = (await storage.listAgenticDeals()).filter((item) => item.source === "strata_inbound");
    const blockedReason = blockedReasonFor(deal);
    if (!shouldSendSmeFollowUp({ deal, inboundDeals, blockedReason })) return false;

    const claimedAt = new Date().toISOString();
    const claimed = await storage.updateAgenticDeal(deal.id, { smeFollowupSentAt: claimedAt });
    if (!claimed?.email) return false;

    const mailbox = mailboxForAgent("outreach-sales");
    const builtIn = renderOutreachEmail(claimed, "sme_followup", mailbox);
    const templateOverrides = (await storage.getSystemSetting("agent_outreach_templates")) || {};
    const script = applyOutreachTemplateOverride(
      builtIn,
      templateOverrides.sme_followup as OutreachTemplateOverride | undefined,
      claimed,
      mailbox
    );
    const thread = threadMailForDeal(claimed.id);

    try {
      const sendResult = await sendEmail(
        {
          agentId: "outreach-sales",
          fromEmail: mailbox.address,
          fromName: mailbox.fromName,
          replyTo: mailbox.replyTo,
          dealId: claimed.id,
          prospectId: claimed.prospectId,
          touchId: "sme_followup",
          contactSource: claimed.contactSource,
          inReplyTo: thread.messageId,
        },
        claimed.email,
        thread.subject ? replySubject(thread.subject) : script.subject,
        script.html
      );
      if (!wasEmailDelivered(sendResult)) {
        await storage.updateAgenticDeal(claimed.id, { smeFollowupSentAt: undefined });
        return false;
      }
      await storage.updateAgenticDeal(claimed.id, {
        events: [
          ...(claimed.events || []),
          {
            at: claimedAt,
            stage: claimed.stage,
            agent: "outreach-sales",
            message: `sme_open aged 2 days — Learn follow-up sent to ${claimed.email}`,
          },
        ],
      });
      return true;
    } catch (error: any) {
      await storage.updateAgenticDeal(claimed.id, { smeFollowupSentAt: undefined });
      console.error("[AgentMail] sme_followup failed:", error?.message || error);
      return false;
    }
  } finally {
    sendingDealIds.delete(dealId);
  }
}

export async function sendDueSmeFollowUps(): Promise<{ candidates: number; sent: number; skipped: number }> {
  const deals = await storage.listAgenticDeals();
  const inboundDeals = deals.filter((deal) => deal.source === "strata_inbound");
  const candidates = deals.filter((deal) =>
    shouldSendSmeFollowUp({ deal, inboundDeals, blockedReason: blockedReasonFor(deal) })
  );
  let sent = 0;
  let skipped = 0;
  for (const deal of candidates) {
    const ok = await maybeSendSmeFollowUp(deal.id);
    if (ok) sent += 1;
    else skipped += 1;
  }
  return { candidates: candidates.length, sent, skipped };
}
