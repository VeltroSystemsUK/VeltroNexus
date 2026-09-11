import { dealStream, nextCadenceStep } from "./salesOs";

export type CadenceAfterOutreach =
  | "advance"
  | "hold_undelivered"
  | "hold_pecr"
  | "hold_approval";

const DAY_MS = 24 * 60 * 60 * 1000;

export function wasEmailDelivered(result?: { success?: boolean; mock?: boolean; messageId?: string } | null): boolean {
  if (!result) return false;
  if (result.mock) return false;
  return result.success === true;
}

export function cadenceAfterOutreach(opts: {
  autoSend: boolean;
  isLinkedIn: boolean;
  delivered: boolean;
  blockReason?: string | null;
  requireApproval?: boolean;
  approved?: boolean;
}): CadenceAfterOutreach {
  if (opts.blockReason) return "hold_pecr";
  if (opts.requireApproval && !opts.approved) return "hold_approval";
  if (opts.autoSend && !opts.delivered) return "hold_undelivered";
  return "advance";
}

export function isWaitingLinkedInHold(deal: {
  status?: string | null;
  humanReason?: string | null;
}): boolean {
  if (deal.status !== "waiting_human") return false;
  return /linkedin/i.test(String(deal.humanReason || ""));
}

function linkedInStagedAt(deal: {
  updatedAt?: string;
  events?: Array<{ at?: string; message?: string }>;
}): string | undefined {
  const hit = [...(deal.events || [])].reverse().find((event) => /linkedin/i.test(String(event.message || "")));
  return hit?.at || deal.updatedAt;
}

export function linkedInHoldReleasePatch(
  deal: {
    status?: string | null;
    humanReason?: string | null;
    stream?: string | null;
    source?: string | null;
    outreachTouch?: number | null;
    updatedAt?: string;
    events?: Array<{ at?: string; message?: string }>;
  },
  now: Date = new Date()
): { status: "waiting_timer"; waitUntil: string; humanReason: undefined } | null {
  if (!isWaitingLinkedInHold(deal)) return null;
  const following = nextCadenceStep(dealStream(deal.source, deal.stream), deal.outreachTouch || 0);
  const waitDays = following?.delayDaysFromPrevious ?? 4;
  const staged = Date.parse(linkedInStagedAt(deal) || now.toISOString());
  const dueMs = (Number.isNaN(staged) ? now.getTime() : staged) + waitDays * DAY_MS;
  return {
    status: "waiting_timer",
    waitUntil: dueMs <= now.getTime() ? now.toISOString() : new Date(dueMs).toISOString(),
    humanReason: undefined,
  };
}
