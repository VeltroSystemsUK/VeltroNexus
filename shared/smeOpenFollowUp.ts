export type SmeOpenMail = {
  direction?: string;
  status?: string;
  touchId?: string;
  subject?: string;
  opens?: string[];
  dealId?: number;
};

export type SmeOpenDeal = {
  id?: number;
  status?: string;
  stage?: string;
  email?: string;
  companyNumber?: string;
  source?: string;
  smeOpenFollowUpSentAt?: string;
  smeFollowupSentAt?: string;
  events?: Array<{ message?: string }>;
};

export const SME_FOLLOWUP_DELAY_MS = 2 * 24 * 60 * 60 * 1000;

export type ExploreDeal = {
  id?: number;
  source?: string;
  email?: string;
  companyNumber?: string;
};

function normEmail(value?: string | null): string {
  return String(value || "").trim().toLowerCase();
}

function normCompanyNumber(value?: string | null): string {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

function isSme1Touch(mail: SmeOpenMail): boolean {
  if (mail.touchId === "sme_1" || mail.touchId === "cold_1") return true;
  if (mail.touchId) return false;
  return /restructuring .+ monthly debt commitments|hmrc petition against /i.test(mail.subject || "");
}

function dealHasInboundResponse(deal: SmeOpenDeal): boolean {
  return (deal.events || []).some((event) =>
    /inbound (reply|opt-out)|sequence stopped/i.test(event.message || "")
  );
}

export function shouldSendSmeOpenFollowUp(opts: {
  mail: SmeOpenMail;
  deal?: SmeOpenDeal | null;
  blockedReason?: string | null;
}): boolean {
  const { mail, deal, blockedReason } = opts;
  if (mail.direction !== "outbound") return false;
  if (mail.status !== "sent") return false;
  if (!isSme1Touch(mail)) return false;
  if (!(mail.opens || []).length) return false;
  if (!mail.dealId || !deal) return false;
  if (!String(deal.email || "").trim()) return false;
  if (deal.status === "failed" || deal.stage === "failed") return false;
  if (deal.smeOpenFollowUpSentAt) return false;
  if (blockedReason) return false;
  if (dealHasInboundResponse(deal)) return false;
  return true;
}

export function pickSmeOpenBackfill(items: SmeOpenMail[]): SmeOpenMail[] {
  const chosen = new Map<number, SmeOpenMail>();
  for (const item of items) {
    if (item.direction !== "outbound") continue;
    if (item.status !== "sent") continue;
    if (!isSme1Touch(item)) continue;
    if (!(item.opens || []).length) continue;
    if (!item.dealId || chosen.has(item.dealId)) continue;
    chosen.set(item.dealId, item);
  }
  return [...chosen.values()];
}

export function replySubject(subject: string): string {
  const trimmed = String(subject || "").trim();
  if (!trimmed) return "Re:";
  if (/^re\s*:/i.test(trimmed)) return trimmed;
  return `Re: ${trimmed}`;
}

export function hasExploreEnquiry(deal: ExploreDeal, inboundDeals: ExploreDeal[] = []): boolean {
  const email = normEmail(deal.email);
  const companyNumber = normCompanyNumber(deal.companyNumber);
  return inboundDeals.some((other) => {
    if (other.source !== "strata_inbound") return false;
    if (deal.id != null && other.id === deal.id) return false;
    const otherEmail = normEmail(other.email);
    if (email && otherEmail && email === otherEmail) return true;
    const otherNumber = normCompanyNumber(other.companyNumber);
    if (companyNumber && otherNumber && companyNumber === otherNumber) return true;
    return false;
  });
}

export function shouldSendSmeFollowUp(opts: {
  deal?: SmeOpenDeal | null;
  now?: Date | string | number;
  inboundDeals?: ExploreDeal[];
  blockedReason?: string | null;
}): boolean {
  const { deal, blockedReason } = opts;
  if (!deal) return false;
  if (!String(deal.email || "").trim()) return false;
  if (deal.status === "failed" || deal.stage === "failed") return false;
  if (deal.smeFollowupSentAt) return false;
  if (blockedReason) return false;
  if (dealHasInboundResponse(deal)) return false;
  const sentAt = Date.parse(String(deal.smeOpenFollowUpSentAt || ""));
  if (!Number.isFinite(sentAt)) return false;
  const nowMs = opts.now == null ? Date.now() : new Date(opts.now).getTime();
  if (!Number.isFinite(nowMs) || nowMs - sentAt < SME_FOLLOWUP_DELAY_MS) return false;
  if (hasExploreEnquiry(deal, opts.inboundDeals || [])) return false;
  return true;
}
