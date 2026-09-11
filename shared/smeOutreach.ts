import { tickKindForDeal, type AgenticDealFile, type AgenticEvent } from "./agenticWorkflow";
import { dealStream, excludedSectorReason, isBrokerProspect, looksLikeIntroducer } from "./salesOs";
import { isPersonalMailbox } from "./pecrSend";

export const INTRODUCER_OUTREACH_PAUSED = true;
export const SME_FIRST_TOUCH_PER_HOUR = 20;
export const SME_FIRST_TOUCH_HOURS = 12;
export const SME_FIRST_TOUCH_DRIP_MINUTES = 3;
export const SME_DAILY_FIRST_TOUCH_CAP = SME_FIRST_TOUCH_PER_HOUR * SME_FIRST_TOUCH_HOURS;
export const SME_EMAIL_APPROVAL_REASON = "Approve this email";
const LONDON_WEEKDAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);
const WINDOW_START_MINUTES = 8 * 60 + 30;
const WINDOW_END_MINUTES = 20 * 60 + 30;

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

export function smeEmailNeedsApproval(_opts: { stream?: string | null; isLinkedIn?: boolean }): boolean {
  return false;
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

function londonClock(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return {
    weekday: get("weekday"),
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

export function smeFirstTouchSlot(now: Date = new Date()): { hourKey: string; minutesIntoSlot: number } | null {
  const clock = londonClock(now);
  if (!LONDON_WEEKDAYS.has(clock.weekday)) return null;
  const minutes = clock.hour * 60 + clock.minute;
  if (minutes < WINDOW_START_MINUTES || minutes >= WINDOW_END_MINUTES) return null;
  const minutesIntoWindow = minutes - WINDOW_START_MINUTES;
  const slotIndex = Math.floor(minutesIntoWindow / 60);
  const slotHour = 8 + slotIndex;
  return {
    hourKey: `${clock.year}-${clock.month}-${clock.day}T${String(slotHour).padStart(2, "0")}:30`,
    minutesIntoSlot: minutesIntoWindow % 60,
  };
}

function isFirstTouchSend(event: Pick<AgenticEvent, "message" | "at">, now: Date): boolean {
  if (Date.parse(event.at) > now.getTime()) return false;
  const message = event.message || "";
  if (/drafted for approval/i.test(message)) return false;
  return /day 1 email/i.test(message);
}

function firstTouchSends(opts: {
  deals: Array<Partial<Pick<AgenticDealFile, "stream" | "source" | "events">>>;
  now: Date;
  hourKey?: string;
}): number {
  return opts.deals.filter((deal) => {
    if (dealStream(deal.source, deal.stream) !== "sme") return false;
    return (deal.events || []).some((event) => {
      if (!isFirstTouchSend(event, opts.now)) return false;
      if (!opts.hourKey) return londonDayKey(new Date(event.at)) === londonDayKey(opts.now);
      return smeFirstTouchSlot(new Date(event.at))?.hourKey === opts.hourKey;
    });
  }).length;
}

export function remainingSmeFirstTouchSlots(opts: {
  deals: Array<
    Partial<Pick<AgenticDealFile, "stream" | "source" | "status" | "humanReason" | "outreachTouch" | "outreachTouchId" | "createdAt" | "events">>
  >;
  cap?: number;
  now?: Date;
}): number {
  const now = opts.now ?? new Date();
  const slot = smeFirstTouchSlot(now);
  if (!slot) return 0;
  const cap = opts.cap ?? SME_FIRST_TOUCH_PER_HOUR;
  const allowed = Math.min(cap, Math.floor(slot.minutesIntoSlot / SME_FIRST_TOUCH_DRIP_MINUTES) + 1);
  return Math.max(0, allowed - firstTouchSends({ deals: opts.deals, now, hourKey: slot.hourKey }));
}

export function remainingSmeFirstTouchDaySlots(opts: {
  deals: Array<Partial<Pick<AgenticDealFile, "stream" | "source" | "events">>>;
  cap?: number;
  now?: Date;
}): number {
  const cap = opts.cap ?? SME_DAILY_FIRST_TOUCH_CAP;
  const now = opts.now ?? new Date();
  return Math.max(0, cap - firstTouchSends({ deals: opts.deals, now }));
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
