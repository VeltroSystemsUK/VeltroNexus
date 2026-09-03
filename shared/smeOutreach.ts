import { tickKindForDeal, type AgenticDealFile, type AgenticEvent } from "./agenticWorkflow";
import { dealStream, excludedSectorReason, isBrokerProspect, looksLikeIntroducer } from "./salesOs";
import { isPersonalMailbox } from "./pecrSend";

export const INTRODUCER_OUTREACH_PAUSED = true;
export const SME_DAILY_FIRST_TOUCH_CAP = 100;
export const SME_EMAIL_APPROVAL_REASON = "Approve this email";

export type SmeOutreachCandidate = {
  companyName: string;
  companyNumber: string;
  email?: string;
  phone?: string;
  contactName?: string;
  website?: string;
  address?: string;
  sicCodes?: string[];
  lenders?: string[];
  hmrc?: boolean;
  incorporationDate?: string;
};

type TickDeal = Parameters<typeof tickKindForDeal>[0];

export function introducerWorkPaused(): boolean {
  return INTRODUCER_OUTREACH_PAUSED;
}

export function shouldProcessAgenticTick(deal: TickDeal): boolean {
  if (deal.status !== "waiting_timer") return false;
  if (introducerWorkPaused() && dealStream(deal.source, deal.stream) === "introducer") return false;
  return tickKindForDeal(deal) !== null;
}

export function smeEmailNeedsApproval(opts: { stream?: string | null; isLinkedIn?: boolean }): boolean {
  return dealStream(undefined, opts.stream) === "sme" && !opts.isLinkedIn;
}

export function isWaitingSmeEmailApproval(
  deal: Pick<AgenticDealFile, "status" | "humanReason"> & Partial<Pick<AgenticDealFile, "stream" | "source">>
): boolean {
  if (deal.status !== "waiting_human") return false;
  if (dealStream(deal.source, deal.stream) !== "sme") return false;
  return (deal.humanReason || "").includes(SME_EMAIL_APPROVAL_REASON);
}

export function londonDayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function isFirstTouchEvent(event: Pick<AgenticEvent, "message" | "at">, day: string): boolean {
  if (londonDayKey(new Date(event.at)) !== day) return false;
  return /day 1 email|email drafted for approval/i.test(event.message || "");
}

export function remainingSmeFirstTouchSlots(opts: {
  deals: Array<
    Partial<Pick<AgenticDealFile, "stream" | "source" | "status" | "humanReason" | "outreachTouch" | "outreachTouchId" | "createdAt" | "events">>
  >;
  cap?: number;
  now?: Date;
}): number {
  const cap = opts.cap ?? SME_DAILY_FIRST_TOUCH_CAP;
  const now = opts.now ?? new Date();
  const day = londonDayKey(now);
  const waiting = opts.deals.filter((deal) => isWaitingSmeEmailApproval(deal as AgenticDealFile)).length;
  const sentToday = opts.deals.filter((deal) => {
    if (dealStream(deal.source, deal.stream) !== "sme") return false;
    if ((deal.outreachTouch || 0) < 1) return false;
    return (deal.events || []).some((event) => isFirstTouchEvent(event, day));
  }).length;
  return Math.max(0, cap - waiting - sentToday);
}

export function isDirectSmeOutreachCandidate(row: SmeOutreachCandidate): boolean {
  const number = String(row.companyNumber || "").trim();
  if (!number || number.toLowerCase().startsWith("web-") || number.toLowerCase().startsWith("unknown")) return false;
  const sicCodes = row.sicCodes || [];
  if (isBrokerProspect(row.companyName, sicCodes)) return false;
  if (looksLikeIntroducer(row.companyName, sicCodes)) return false;
  if (excludedSectorReason(sicCodes, row.companyName)) return false;
  if (row.email && isPersonalMailbox(row.email)) return false;
  return true;
}

function hasCorporateEmail(row: SmeOutreachCandidate): boolean {
  return Boolean(String(row.email || "").trim()) && !isPersonalMailbox(row.email);
}

function isSmeDistress(row: SmeOutreachCandidate): boolean {
  if (looksLikeIntroducer(row.companyName, row.sicCodes || [])) return false;
  if (row.hmrc) return true;
  return (row.lenders || []).some((name) => Boolean(String(name || "").trim()));
}

function rankSmeCandidate(row: SmeOutreachCandidate): number {
  const email = hasCorporateEmail(row);
  const distress = isSmeDistress(row);
  if (distress && email) return 0;
  if (email) return 1;
  if (distress) return 2;
  return 3;
}

export function mergeSmeCandidatePools(
  local: SmeOutreachCandidate[],
  finder: SmeOutreachCandidate[]
): SmeOutreachCandidate[] {
  return [...local, ...finder];
}

function takeEligibleSmeOutreach(opts: {
  candidates: SmeOutreachCandidate[];
  seenNumbers?: Set<string>;
  seenEmails?: Set<string>;
  limit: number;
}): SmeOutreachCandidate[] {
  const seenNumbers = new Set(opts.seenNumbers || []);
  const seenEmails = new Set(
    [...(opts.seenEmails || [])].map((email) => email.trim().toLowerCase()).filter(Boolean)
  );
  const picked: SmeOutreachCandidate[] = [];
  for (const row of opts.candidates) {
    if (picked.length >= opts.limit) break;
    if (!isDirectSmeOutreachCandidate(row)) continue;
    if (!hasCorporateEmail(row)) continue;
    if (seenNumbers.has(row.companyNumber)) continue;
    const email = String(row.email || "").trim().toLowerCase();
    if (email && seenEmails.has(email)) continue;
    seenNumbers.add(row.companyNumber);
    if (email) seenEmails.add(email);
    picked.push(row);
  }
  return picked;
}

export function pickSmeOutreachBatch(opts: {
  candidates: SmeOutreachCandidate[];
  seenNumbers?: Set<string>;
  seenEmails?: Set<string>;
  limit: number;
}): SmeOutreachCandidate[] {
  const eligible = opts.candidates.filter((row) => {
    if (!isDirectSmeOutreachCandidate(row)) return false;
    if (!hasCorporateEmail(row)) return false;
    return true;
  });
  eligible.sort((a, b) => rankSmeCandidate(a) - rankSmeCandidate(b));
  return takeEligibleSmeOutreach({
    candidates: eligible,
    seenNumbers: opts.seenNumbers,
    seenEmails: opts.seenEmails,
    limit: opts.limit,
  });
}

/** Hopper-only drain. Finder/local never fill the 50; empty hopper queues nothing. Preserves hopper rank order. */
export function pickSmeHopperOrLegacy(opts: {
  hopperCandidates: SmeOutreachCandidate[];
  legacyCandidates: SmeOutreachCandidate[];
  seenNumbers?: Set<string>;
  seenEmails?: Set<string>;
  limit: number;
}): SmeOutreachCandidate[] {
  return takeEligibleSmeOutreach({
    candidates: opts.hopperCandidates,
    seenNumbers: opts.seenNumbers,
    seenEmails: opts.seenEmails,
    limit: opts.limit,
  });
}

export function smeApprovalReason(email: string): string {
  return `${SME_EMAIL_APPROVAL_REASON} to ${email} before it sends.`;
}
