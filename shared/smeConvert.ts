import { normalizeCompanyNumber, normalizeEmail } from "./openers";
import { hasExploreEnquiry } from "./smeOpenFollowUp";

export const CONVERT_SITE_ORIGIN = "https://www.stratafinance.co.uk";
export const CONVERT_STOP_LINE = "If this isn't useful, reply stop and we won't email again.";
export const CONVERT_WAKE_DAYS = 90;

const LONDON_TZ = "Europe/London";
const LONDON_WEEKDAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);
const WINDOW_START_MINUTES = 8 * 60 + 30;
const WINDOW_END_MINUTES = 16 * 60 + 30;
const BANNED_COPY_RE =
  /learn\.stratanexus|explore\.stratanexus|10-minute|thursday|got 5 minutes|brief call/i;
const PACKAGER_RE = /do not lend|does not lend|packager/i;
const INBOUND_EVENT_RE = /inbound (reply|opt-out)|sequence stopped/i;

export type ConvertMail = {
  touchId?: string;
  direction?: string;
  status?: string;
  opens?: string[];
  clicks?: Array<{ at?: string; url?: string }>;
  dealId?: number;
  createdAt?: string;
  subject?: string;
};

export type ConvertDeal = {
  id?: number;
  email?: string;
  companyName?: string;
  companyNumber?: string;
  contactName?: string;
  status?: string;
  stage?: string;
  source?: string;
  convertPlaybook?: string;
  convertEnrolledAt?: string;
  convertCycle?: number;
  convertWakeAt?: string;
  convertStopReason?: string;
  outreachTouch?: number;
  outreachTouchId?: string;
  waitUntil?: string;
  callPlaybook?: string;
  events?: Array<{ message?: string }>;
  companyStatus?: string;
  companiesHouse?: { companyStatus?: string } | null;
  phone?: string;
};

export type ConvertOpener = {
  status?: string;
  stopReason?: string;
  nurture?: { stopReason?: string; stream?: string };
};

export type ConvertTick =
  | { action: "hold"; reason: "same_day_sme_2" }
  | {
      action: "send";
      cadenceTouchId: "sme_n1" | "sme_n2" | "sme_n3";
      renderTouchId: "sme_n1" | "sme_n2" | "sme_n2_hmrc" | "sme_n2_clicked" | "sme_n3" | "sme_n3_form";
    }
  | { action: "queue_closer" }
  | { action: "noop" }
  | { action: "wake_reenrol" }
  | {
      action: "stay_parked";
      reason: "opt_out" | "promoted" | "failed" | "dissolved" | "bounce_no_phone" | "smtp";
    };

export type ConvertEnrolPatch = {
  convertPlaybook: "sme_nurture";
  convertEnrolledAt: string;
  convertCycle: number;
  convertWakeAt: undefined;
  convertStopReason: undefined;
  outreachTouch: 0;
  outreachTouchId: undefined;
  waitUntil: string;
  callPlaybook: undefined;
};

type ConvertRenderTouchId =
  | "sme_n1"
  | "sme_n2"
  | "sme_n2_hmrc"
  | "sme_n2_clicked"
  | "sme_n3"
  | "sme_n3_form";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function londonParts(date: Date, timeZone = LONDON_TZ) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return {
    weekday: get("weekday"),
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + days);
  return `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())}`;
}

/** Convert a London civil date + clock time to a UTC Date. */
function londonLocalToUtc(dateKey: string, hour: number, minute: number): Date {
  const guess = new Date(`${dateKey}T${pad2(hour)}:${pad2(minute)}:00.000Z`);
  const asLondon = londonParts(guess);
  const asUtcMs = Date.UTC(
    asLondon.year,
    asLondon.month - 1,
    asLondon.day,
    asLondon.hour,
    asLondon.minute,
    asLondon.second
  );
  const offset = asUtcMs - guess.getTime();
  return new Date(guess.getTime() - offset);
}

function dealHasInboundResponse(deal: ConvertDeal): boolean {
  return (deal.events || []).some((event) => INBOUND_EVENT_RE.test(event.message || ""));
}

function chStatus(deal: ConvertDeal): string | undefined {
  if (deal.companiesHouse && typeof deal.companiesHouse === "object") {
    return deal.companiesHouse.companyStatus;
  }
  return deal.companyStatus;
}

function mailForDeal(mail: ConvertMail[], dealId: number): ConvertMail[] {
  return mail.filter((item) => item.dealId === dealId);
}

function isOutboundSent(mail: ConvertMail): boolean {
  return mail.direction === "outbound" && mail.status === "sent";
}

export function isSme1Touch(touchId?: string): boolean {
  return touchId === "sme_1" || touchId === "cold_1";
}

export function isSme2Touch(touchId?: string): boolean {
  return touchId === "sme_2" || touchId === "cold_2";
}

export function londonDateKey(iso: string, nowTimeZone: string = LONDON_TZ): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: nowTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function shouldHoldN1ForSme2SameDay(opts: { sme2SentAt?: string; now?: Date }): boolean {
  if (!opts.sme2SentAt) return false;
  const now = opts.now ?? new Date();
  const sme2Key = londonDateKey(opts.sme2SentAt);
  const nowKey = londonDateKey(now.toISOString());
  return sme2Key === nowKey;
}

export function nextConvertSendWindow(now: Date = new Date()): Date {
  const clock = londonParts(now);
  const minutes = clock.hour * 60 + clock.minute;
  if (LONDON_WEEKDAYS.has(clock.weekday) && minutes >= WINDOW_START_MINUTES && minutes < WINDOW_END_MINUTES) {
    return now;
  }

  let key = `${clock.year}-${pad2(clock.month)}-${pad2(clock.day)}`;
  if (!LONDON_WEEKDAYS.has(clock.weekday) || minutes >= WINDOW_END_MINUTES) {
    key = addDaysToDateKey(key, 1);
  }

  for (let i = 0; i < 8; i++) {
    const candidate = londonLocalToUtc(key, 8, 30);
    const parts = londonParts(candidate);
    if (LONDON_WEEKDAYS.has(parts.weekday)) return candidate;
    key = addDaysToDateKey(key, 1);
  }
  return londonLocalToUtc(key, 8, 30);
}

export function convertWakeAt(completedAt: Date): string {
  const key = londonDateKey(completedAt.toISOString());
  const wakeKey = addDaysToDateKey(key, CONVERT_WAKE_DAYS);
  return londonLocalToUtc(wakeKey, 8, 30).toISOString();
}

export function shouldWakeConvert(opts: { wakeAt?: string; now?: Date }): boolean {
  if (!opts.wakeAt) return false;
  const wakeMs = Date.parse(opts.wakeAt);
  if (!Number.isFinite(wakeMs)) return false;
  const nowMs = (opts.now ?? new Date()).getTime();
  return nowMs >= wakeMs;
}

export function isStrataSiteUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "stratafinance.co.uk" || host === "www.stratafinance.co.uk";
  } catch {
    return false;
  }
}

export function lastStrataSiteClick(
  clicks: Array<{ at?: string; url?: string }>
): { at: string; url: string } | null {
  let best: { at: string; url: string } | null = null;
  for (const click of clicks || []) {
    if (!click?.url || !isStrataSiteUrl(click.url)) continue;
    const at = click.at || "";
    if (!best || at > best.at) {
      best = { at, url: click.url };
    }
  }
  return best;
}

export function siteClickKind(url?: string): "tools" | "process" | "contact" | "other" | null {
  if (!url || !isStrataSiteUrl(url)) return null;
  try {
    const hash = (new URL(url).hash || "").replace(/^#/, "").toLowerCase();
    if (hash === "tools") return "tools";
    if (hash === "process") return "process";
    if (hash === "contact") return "contact";
    return "other";
  } catch {
    return null;
  }
}

export function shouldSkipN2ForContactClick(lastSiteClickUrl?: string | null): boolean {
  return siteClickKind(lastSiteClickUrl || undefined) === "contact";
}

export function pickConvertTouchId(opts: {
  stepTouchId: "sme_n1" | "sme_n2" | "sme_n3";
  hasHmrcPetition: boolean;
  lastSiteClickUrl?: string | null;
}): ConvertRenderTouchId {
  if (opts.stepTouchId === "sme_n1") return "sme_n1";
  if (opts.stepTouchId === "sme_n2") {
    if (opts.hasHmrcPetition) return "sme_n2_hmrc";
    if (siteClickKind(opts.lastSiteClickUrl || undefined) === "tools") return "sme_n2_clicked";
    return "sme_n2";
  }
  if (shouldSkipN2ForContactClick(opts.lastSiteClickUrl)) return "sme_n3_form";
  return "sme_n3";
}

export function isDualOpenConvertEligible(opts: {
  mail: ConvertMail[];
  deal?: ConvertDeal | null;
  opener?: ConvertOpener | null;
  inboundDeals?: Array<{ id?: number; source?: string; email?: string; companyNumber?: string }>;
  blockedReason?: string | null;
}): boolean {
  const deal = opts.deal;
  if (!deal || deal.id == null) return false;
  if (deal.status === "failed" || deal.stage === "failed") return false;
  if (deal.convertPlaybook === "sme_nurture") return false;

  const opener = opts.opener;
  if (opener?.status === "promoted") return false;
  if (opener?.status === "not_now" && (opener.stopReason === "opt_out" || opener.nurture?.stopReason === "opt_out")) {
    return false;
  }
  if (opts.blockedReason) return false;
  if (dealHasInboundResponse(deal)) return false;
  if (hasExploreEnquiry(deal, opts.inboundDeals || [])) return false;

  const email = normalizeEmail(deal.email);
  const companyNumber = normalizeCompanyNumber(deal.companyNumber);
  const inboundHit = (opts.inboundDeals || []).some((other) => {
    if (other.source !== "strata_inbound") return false;
    if (deal.id != null && other.id === deal.id) return false;
    const otherEmail = normalizeEmail(other.email);
    if (email && otherEmail && email === otherEmail) return true;
    const otherNumber = normalizeCompanyNumber(other.companyNumber);
    if (companyNumber && otherNumber && companyNumber === otherNumber) return true;
    return false;
  });
  if (inboundHit) return false;

  const status = chStatus(deal);
  if (status != null && String(status).trim() !== "" && String(status).toLowerCase() !== "active") {
    return false;
  }

  const forDeal = mailForDeal(opts.mail, deal.id);
  const sme1Ok = forDeal.some(
    (item) => isOutboundSent(item) && isSme1Touch(item.touchId) && (item.opens || []).length > 0
  );
  if (!sme1Ok) return false;

  const sme2Ok = forDeal.some((item) => {
    if (!isOutboundSent(item) || !isSme2Touch(item.touchId)) return false;
    if ((item.opens || []).length > 0) return true;
    return (item.clicks || []).length > 0;
  });
  return sme2Ok;
}

function parkedStayReason(deal: ConvertDeal): ConvertTick | null {
  const stop = String(deal.convertStopReason || "").toLowerCase();
  if (stop === "opt_out") return { action: "stay_parked", reason: "opt_out" };
  if (stop === "promoted" || stop === "reply") return { action: "stay_parked", reason: "promoted" };
  if (stop === "dead" || deal.status === "failed" || deal.stage === "failed") {
    return { action: "stay_parked", reason: "failed" };
  }
  const status = chStatus(deal);
  if (status != null && String(status).trim() !== "" && String(status).toLowerCase() !== "active") {
    return { action: "stay_parked", reason: "dissolved" };
  }
  if (stop === "blocked" && !String(deal.phone || "").trim()) {
    return { action: "stay_parked", reason: "bounce_no_phone" };
  }
  if (stop === "smtp") return { action: "stay_parked", reason: "smtp" };
  return null;
}

export function planConvertTick(input: {
  deal: ConvertDeal;
  sme2SentAt?: string;
  now?: Date;
  lastSiteClickUrl?: string | null;
  hasHmrcPetition?: boolean;
}): ConvertTick {
  const deal = input.deal;
  const now = input.now ?? new Date();
  const playbook = deal.convertPlaybook;

  if (deal.convertWakeAt && !playbook && (deal.status === "parked" || deal.status === "non_responsive")) {
    const stay = parkedStayReason(deal);
    if (stay) return stay;
    if (shouldWakeConvert({ wakeAt: deal.convertWakeAt, now })) {
      return { action: "wake_reenrol" };
    }
    return { action: "noop" };
  }

  if (playbook !== "sme_nurture") return { action: "noop" };

  const touch = deal.outreachTouch ?? 0;
  if (touch === 0) {
    if (shouldHoldN1ForSme2SameDay({ sme2SentAt: input.sme2SentAt, now })) {
      return { action: "hold", reason: "same_day_sme_2" };
    }
    return { action: "send", cadenceTouchId: "sme_n1", renderTouchId: "sme_n1" };
  }

  if (touch === 1) {
    if (shouldSkipN2ForContactClick(input.lastSiteClickUrl)) {
      return { action: "send", cadenceTouchId: "sme_n3", renderTouchId: "sme_n3_form" };
    }
    return {
      action: "send",
      cadenceTouchId: "sme_n2",
      renderTouchId: pickConvertTouchId({
        stepTouchId: "sme_n2",
        hasHmrcPetition: Boolean(input.hasHmrcPetition),
        lastSiteClickUrl: input.lastSiteClickUrl,
      }),
    };
  }

  if (touch === 2) {
    return {
      action: "send",
      cadenceTouchId: "sme_n3",
      renderTouchId: pickConvertTouchId({
        stepTouchId: "sme_n3",
        hasHmrcPetition: Boolean(input.hasHmrcPetition),
        lastSiteClickUrl: input.lastSiteClickUrl,
      }),
    };
  }

  if (touch === 3) return { action: "queue_closer" };
  return { action: "noop" };
}

export function convertCopyOk(rendered: {
  subject: string;
  html?: string;
  text: string;
}): { ok: true } | { ok: false; reason: string } {
  const blob = `${rendered.subject}\n${rendered.html || ""}\n${rendered.text}`;
  if (BANNED_COPY_RE.test(blob)) {
    return { ok: false, reason: "banned_copy" };
  }
  if (!/www\.stratafinance\.co\.uk/i.test(blob)) {
    return { ok: false, reason: "missing_site_origin" };
  }
  if (!PACKAGER_RE.test(blob)) {
    return { ok: false, reason: "missing_packager" };
  }
  if (!blob.includes(CONVERT_STOP_LINE)) {
    return { ok: false, reason: "missing_stop_line" };
  }
  return { ok: true };
}

export function convertGreetingName(contactName?: string | null): string {
  const token = String(contactName || "").trim().split(/\s+/)[0] || "";
  if (!token || /^(hi|there|sir|madam|team|director)$/i.test(token)) return "";
  return token;
}

export function buildCloserScript(opts: {
  company: string;
  name: string;
  lastSiteClickUrl?: string | null;
}): string {
  const company = opts.company || "";
  const name = opts.name || "";
  if (opts.lastSiteClickUrl && isStrataSiteUrl(opts.lastSiteClickUrl)) {
    return `${company} (${name}). Opened sme_1 and sme_2. Last site click: ${opts.lastSiteClickUrl}. No enquiry.\nPoint them at the form on that same page. No meeting ask. No credit search.`;
  }
  return `${company} (${name}). Opened sme_1 and sme_2. No site click.\nPoint them at ${CONVERT_SITE_ORIGIN}/?sf=c1#contact\nEnquiry form, no credit search. No meeting ask.`;
}

export function buildConvertEnrolment(
  mail: ConvertMail[],
  deal: ConvertDeal,
  opener: { id: string; status?: string; nurture?: { stopReason?: string; stream?: string } },
  now?: Date,
  extras?: {
    inboundDeals?: Array<{ id?: number; source?: string; email?: string; companyNumber?: string }>;
    blockedReason?: string | null;
  }
): { dealPatch: ConvertEnrolPatch; openerId: string } | null {
  if (
    !isDualOpenConvertEligible({
      mail,
      deal,
      opener,
      inboundDeals: extras?.inboundDeals,
      blockedReason: extras?.blockedReason,
    })
  ) {
    return null;
  }
  const sme2 = mail.find(
    (item) => item.direction === "outbound" && item.status === "sent" && isSme2Touch(item.touchId)
  );
  return {
    dealPatch: enrolConvertDealPatch(deal, { now, sme2SentAt: sme2?.createdAt }),
    openerId: opener.id,
  };
}

export function nextOutreachTouchAfterSend(
  cadenceTouchId: "sme_n1" | "sme_n2" | "sme_n3"
): number {
  if (cadenceTouchId === "sme_n1") return 1;
  if (cadenceTouchId === "sme_n2") return 2;
  return 3;
}

export function convertOverridesHopperHold(deal: {
  convertPlaybook?: string;
  hopper?: string;
}): boolean {
  return deal.convertPlaybook === "sme_nurture";
}

export function sme2SentAtFromMail(mail: ConvertMail[]): string | undefined {
  const hit = (mail || []).find((item) => isOutboundSent(item) && isSme2Touch(item.touchId));
  return hit?.createdAt;
}

export function lastSiteClickUrlFromMail(mail: ConvertMail[]): string | null {
  return lastStrataSiteClick((mail || []).flatMap((item) => item.clicks || []))?.url || null;
}

export function enrolConvertDealPatch(
  deal: ConvertDeal,
  opts: { now?: Date; sme2SentAt?: string } = {}
): ConvertEnrolPatch {
  const now = opts.now ?? new Date();
  let waitUntil = nextConvertSendWindow(now);
  if (shouldHoldN1ForSme2SameDay({ sme2SentAt: opts.sme2SentAt, now })) {
    const sme2Key = londonDateKey(opts.sme2SentAt!);
    const nextMorning = londonLocalToUtc(addDaysToDateKey(sme2Key, 1), 8, 30);
    waitUntil = nextConvertSendWindow(nextMorning);
  }

  return {
    convertPlaybook: "sme_nurture",
    convertEnrolledAt: now.toISOString(),
    convertCycle: (deal.convertCycle || 0) + 1,
    convertWakeAt: undefined,
    convertStopReason: undefined,
    outreachTouch: 0,
    outreachTouchId: undefined,
    waitUntil: waitUntil.toISOString(),
    callPlaybook: undefined,
  };
}
