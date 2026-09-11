import {
  bounceRecipient,
  classifyInboundMail,
  isHardBounce,
  isHardBounceMailbox,
  isOptOutSuppressed,
  isSuppressed,
  type MailKind,
} from "@shared/mailDesk";
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

function bounceAddress(item: AgentMailItem, classified?: string): string | undefined {
  const fromNote = String(item.deskNote || "")
    .split("·")
    .pop()
    ?.trim()
    .toLowerCase();
  const candidates = [
    classified,
    bounceRecipient(item.text),
    bounceRecipient(item.deskNote),
    fromNote && fromNote.includes("@") ? fromNote : undefined,
  ];
  return candidates.find((value) => Boolean(value && value.includes("@"))) || undefined;
}

async function dropHardBounce(
  item: AgentMailItem,
  recipient: string | undefined,
  reason: string
): Promise<{ kind: MailKind; action: string }> {
  const matches = recipient ? await dealsForEmail(recipient) : [];
  const note = reason.startsWith("hard bounce") ? reason : "hard bounce — address does not exist";
  if (recipient) {
    addSuppression({
      email: recipient,
      reason: note,
    });
    try {
      const { deleteOpenerByEmail } = await import("./openers");
      deleteOpenerByEmail(recipient);
    } catch {
      // opener drop is best-effort; suppression still stands
    }
  }
  const at = new Date().toISOString();
  for (const deal of matches) {
    await storage.updateAgenticDeal(deal.id, {
      email: "",
      hopper: "hunt_contact",
      events: [
        ...(deal.events || []),
        {
          at,
          stage: deal.stage || "outreach",
          agent: "mailbox-clerk",
          message: `Hard bounce ${recipient || ""}. Mailbox stripped; Harper will hunt a director address.`.trim(),
        },
      ],
    });
  }
  deleteAgentMail(item.id);
  return {
    kind: "bounce",
    action: `bounced ${recipient || "unknown"}; queued harvest`,
  };
}

async function purgeHardBounces(): Promise<number> {
  const items = listAgentMail(5000).filter(
    (item) => item.direction === "inbound" && item.deskKind === "bounce"
  );
  let deleted = 0;
  for (const item of items) {
    const blob = `${item.deskNote || ""} ${item.text || ""} ${item.subject || ""}`;
    if (!isHardBounce(blob)) continue;
    await dropHardBounce(item, bounceAddress(item), item.deskNote || "hard bounce — address does not exist");
    deleted += 1;
  }
  return deleted;
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
    let fanout = { emails: email ? [email] : [], companyNumber: matches[0]?.companyNumber as string | undefined };
    try {
      const { stopOpenerNurtureByEmail, suppressionFanoutForEmail } = await import("./openers");
      fanout = suppressionFanoutForEmail(email);
      if (!fanout.companyNumber) fanout = { ...fanout, companyNumber: matches[0]?.companyNumber };
      stopOpenerNurtureByEmail(email, "opt_out");
    } catch {
      // opener park is best-effort; suppression still stands
    }
    const companyNumber = fanout.companyNumber || matches[0]?.companyNumber;
    for (const addr of fanout.emails.length ? fanout.emails : [email]) {
      addSuppression({
        email: addr,
        companyNumber,
        reason: "opt-out",
      });
    }
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
    const recipient = bounceAddress(item, verdict.recipient);
    const reason = verdict.reason || "delivery failed";
    const hard = isHardBounce(`${reason} ${item.text || ""} ${item.subject || ""} ${item.deskNote || ""}`);
    if (hard) {
      return dropHardBounce(item, recipient, reason);
    }
    const matches = recipient ? await dealsForEmail(recipient) : [];
    for (const deal of matches) {
      await storage.updateAgenticDeal(deal.id, {
        stage: "outreach",
        status: "waiting_human",
        humanReason: `Bounce: ${reason} for ${recipient}.`,
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
  const inbox = listAgentMail(5000).filter((item) => item.direction === "inbound" && !item.deskKind);
  const tally = { processed: 0, spam: 0, stops: 0, bounces: 0, replies: 0 };
  for (const item of inbox) {
    const result = await applyMailDesk(item);
    tally.processed += 1;
    if (result.kind === "spam") tally.spam += 1;
    if (result.kind === "stop") tally.stops += 1;
    if (result.kind === "bounce") tally.bounces += 1;
    if (result.kind === "responsive") tally.replies += 1;
    if (result.kind === "responsive" || result.kind === "other") {
      try {
        const { draftJamesReply } = await import("./jamesInbound");
        await draftJamesReply(item);
      } catch (error: any) {
        console.warn("[SAL-1] draft failed:", error?.message || error);
      }
    }
  }
  const purged = await purgeHardBounces();
  tally.bounces += purged;
  tally.processed += purged;
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

export function mailIsOptedOut(email?: string | null, companyNumber?: string | null): boolean {
  return isOptOutSuppressed({ email, companyNumber }, loadSuppression());
}

export function mailIsHardBounced(email?: string | null): boolean {
  return isHardBounceMailbox(email, loadSuppression());
}
