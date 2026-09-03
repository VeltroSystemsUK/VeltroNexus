import { classifyInboundMail, isHardBounce, isSuppressed, type MailKind } from "@shared/mailDesk";
import { storage } from "../storage";
import { deleteAgentMail, listAgentMail, patchAgentMail, type AgentMailItem } from "./agentMailLog";
import { addSuppression, loadSuppression } from "./mailSuppression";

async function dealsForEmail(email: string) {
  const target = String(email || "").trim().toLowerCase();
  if (!target) return [];
  return (await storage.listAgenticDeals()).filter(
    (deal) => String(deal.email || "").trim().toLowerCase() === target
  );
}

export async function applyMailDesk(item: AgentMailItem): Promise<{ kind: MailKind; action: string }> {
  if (item.deskKind) return { kind: item.deskKind, action: "already processed" };
  const verdict = classifyInboundMail({
    from: item.from,
    to: item.to,
    subject: item.subject,
    text: item.text,
    html: item.html,
  });

  if (verdict.kind === "spam") {
    deleteAgentMail(item.id);
    return { kind: "spam", action: "deleted spam" };
  }

  if (verdict.kind === "stop") {
    const email = String(item.from || "").trim().toLowerCase();
    const matches = await dealsForEmail(email);
    addSuppression({
      email,
      companyNumber: matches[0]?.companyNumber,
      reason: "opt-out",
    });
    for (const deal of matches) {
      await storage.deleteAgenticDeal(deal.id);
    }
    patchAgentMail(item.id, {
      deskKind: "stop",
      deskNote: `Opt-out. ${matches.length} deal file(s) deleted. Address suppressed.`,
      agentId: "mailbox-clerk",
      agentName: "Rowan Vale",
    });
    return { kind: "stop", action: `suppressed ${email}, deleted ${matches.length} deals` };
  }

  if (verdict.kind === "bounce") {
    const recipient = verdict.recipient;
    const reason = verdict.reason || "delivery failed";
    const hard = isHardBounce(reason);
    const matches = recipient ? await dealsForEmail(recipient) : [];
    if (hard && recipient) {
      addSuppression({
        email: recipient,
        companyNumber: matches[0]?.companyNumber,
        reason,
      });
    }
    for (const deal of matches) {
      await storage.updateAgenticDeal(deal.id, {
        stage: "outreach",
        status: "waiting_human",
        humanReason: hard
          ? `Bounce: ${reason} for ${recipient}. Address suppressed.`
          : `Bounce: ${reason} for ${recipient}.`,
        events: [
          ...(deal.events || []),
          {
            at: new Date().toISOString(),
            stage: "outreach",
            agent: "mailbox-clerk",
            message: `Delivery failed to ${recipient}: ${reason}`,
          },
        ],
      });
    }
    patchAgentMail(item.id, {
      deskKind: "bounce",
      deskNote: `${reason}${recipient ? ` · ${recipient}` : ""}`,
      agentId: "mailbox-clerk",
      agentName: "Rowan Vale",
    });
    return { kind: "bounce", action: reason };
  }

  if (verdict.kind === "responsive") {
    const matches = await dealsForEmail(item.from);
    for (const deal of matches) {
      await storage.updateAgenticDeal(deal.id, {
        status: "waiting_human",
        humanReason: `They replied — you own the thread. Open Agent Mail.`,
        events: [
          ...(deal.events || []),
          {
            at: new Date().toISOString(),
            stage: deal.stage,
            agent: "mailbox-clerk",
            message: `Customer reply: ${item.subject || "(no subject)"}`,
          },
        ],
      });
    }
    patchAgentMail(item.id, {
      deskKind: "responsive",
      deskNote: matches.length ? "Customer reply — waiting on you" : "Looks like a live customer. Read it now.",
      agentId: "mailbox-clerk",
      agentName: "Rowan Vale",
    });
    return { kind: "responsive", action: "attention" };
  }

  patchAgentMail(item.id, { deskKind: "other", agentId: "mailbox-clerk", agentName: "Rowan Vale" });
  return { kind: "other", action: "filed" };
}

export async function processAgentInbox(): Promise<{ processed: number; spam: number; stops: number; bounces: number; replies: number }> {
  const inbox = listAgentMail(2000).filter((item) => item.direction === "inbound" && !item.deskKind);
  const tally = { processed: 0, spam: 0, stops: 0, bounces: 0, replies: 0 };
  for (const item of inbox) {
    const result = await applyMailDesk(item);
    tally.processed += 1;
    if (result.kind === "spam") tally.spam += 1;
    if (result.kind === "stop") tally.stops += 1;
    if (result.kind === "bounce") tally.bounces += 1;
    if (result.kind === "responsive") tally.replies += 1;
  }
  if (tally.processed) {
    console.log(
      `[Mailbox] Rowan processed ${tally.processed}: ${tally.replies} replies, ${tally.stops} stops, ${tally.bounces} bounces, ${tally.spam} spam`
    );
  }
  return tally;
}

export function mailIsSuppressed(email?: string | null, companyNumber?: string | null): boolean {
  return isSuppressed({ email, companyNumber }, loadSuppression());
}
