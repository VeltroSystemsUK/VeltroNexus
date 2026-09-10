import { SME_HOPPER_TARGET, type HopperDeal } from "./smeHopper";

export type AttachBudget = { ch: number; places: number; firecrawl: number; smtp: number };

export type QualityAlert = { id?: string; tone: "amber" | "red"; message: string };

export type HuntQuality = {
  scanned: number;
  deliverable: number;
  director: number;
  role: number;
  sent: number;
  opened: number;
  replied: number;
  rejected: Record<string, number>;
  yieldPct: number;
  target: number;
  remainingSlots: number;
  budget: { total: AttachBudget; remaining: AttachBudget };
  alerts: QualityAlert[];
};

function usedPct(remaining: number, total: number): number {
  if (total <= 0) return 0;
  return (total - remaining) / total;
}

export function qualityAlerts(input: {
  scanned: number;
  deliverable: number;
  sent: number;
  replied: number;
  remainingSlots: number;
  budget: { total: AttachBudget; remaining: AttachBudget };
  chCooldown?: boolean;
  smtpFailed?: number;
  guessPaused?: boolean;
}): QualityAlert[] {
  const alerts: QualityAlert[] = [];
  if (input.guessPaused) {
    alerts.push({
      id: "guess_paused",
      tone: "amber",
      message: "Guessing paused — bounce rate on constructed mailboxes. Published harvest continues.",
    });
  }
  const yieldPct = input.scanned > 0 ? (input.deliverable / input.scanned) * 100 : 0;
  if (input.scanned >= 20 && yieldPct < 15) {
    alerts.push({
      tone: "amber",
      message: `Yield ${Math.round(yieldPct)}% — scanned ${input.scanned} for ${input.deliverable} mail-ready. Hunt will keep going, but inboxes are thin.`,
    });
  }
  if (usedPct(input.budget.remaining.places, input.budget.total.places) >= 0.8) {
    alerts.push({
      tone: "amber",
      message: `Places API ${Math.round(usedPct(input.budget.remaining.places, input.budget.total.places) * 100)}% used. Risk of stalling before 100 deliverables.`,
    });
  }
  if (usedPct(input.budget.remaining.firecrawl, input.budget.total.firecrawl) >= 0.8) {
    alerts.push({
      tone: "amber",
      message: `Firecrawl ${Math.round(usedPct(input.budget.remaining.firecrawl, input.budget.total.firecrawl) * 100)}% used.`,
    });
  }
  if ((input.smtpFailed || 0) > 0) {
    alerts.push({ tone: "amber", message: `${input.smtpFailed} SMTP send(s) failed. Check the mailbox before the next batch.` });
  }
  if (input.chCooldown || input.budget.remaining.ch <= 0) {
    alerts.push({
      tone: "red",
      message: "Companies House rate limit or officer budget exhausted. Hunt stopped short — resume when the cooldown lifts.",
    });
  }
  if (input.deliverable < SME_HOPPER_TARGET && input.remainingSlots > 0 && input.budget.remaining.places <= 0 && input.budget.remaining.firecrawl <= 0) {
    alerts.push({
      tone: "red",
      message: `Only ${input.deliverable}/${SME_HOPPER_TARGET} deliverables and attach budget is spent. Will not hit 100 today unless more budget is available.`,
    });
  }
  if (input.sent >= 20 && input.replied / input.sent < 0.05) {
    alerts.push({
      tone: "amber",
      message: `Reply rate ${(100 * input.replied / input.sent).toFixed(1)}% on ${input.sent} sends — below the 5% target.`,
    });
  }
  return alerts;
}

export function buildHuntQuality(input: {
  scanned: number;
  deliverable: number;
  director: number;
  role: number;
  sent: number;
  opened: number;
  replied: number;
  rejected?: Record<string, number>;
  remainingSlots: number;
  budget: { total: AttachBudget; remaining: AttachBudget };
  chCooldown?: boolean;
  smtpFailed?: number;
  guessPaused?: boolean;
}): HuntQuality {
  const scanned = input.scanned;
  const yieldPct = scanned > 0 ? Math.round((input.deliverable / scanned) * 100) : 0;
  return {
    scanned,
    deliverable: input.deliverable,
    director: input.director,
    role: input.role,
    sent: input.sent,
    opened: input.opened,
    replied: input.replied,
    rejected: input.rejected || {},
    yieldPct,
    target: SME_HOPPER_TARGET,
    remainingSlots: input.remainingSlots,
    budget: input.budget,
    alerts: qualityAlerts(input),
  };
}

export function sendableUnsentCount(
  deals: Array<HopperDeal & { hopper?: string; outreachTouch?: number | null }>
): number {
  return deals.filter((deal) => deal.hopper === "sendable" && (deal.outreachTouch || 0) < 1).length;
}
