import { isOpenedOutboundMail, lastMailOpenAt } from "./mailTracking";
import { convertWakeAt } from "./smeConvert";
import { SME_NURTURE_CADENCE } from "./salesOs";

export const OPENER_BOARD_STATUSES = ["new", "nurturing", "not_now", "promoted"] as const;
export type OpenerBoardStatus = (typeof OPENER_BOARD_STATUSES)[number];
export const OPENER_STATUSES = ["non_responsive", ...OPENER_BOARD_STATUSES] as const;
export type OpenerStatus = (typeof OPENER_STATUSES)[number];
export type OpenerDesk = "openers" | "non_responsive";

export const OPENER_TOUCH2_DELAY_MS = 3 * 24 * 60 * 60 * 1000;
export const OPENER_CONVERT_CLOSER_DELAY_MS = 3 * 24 * 60 * 60 * 1000;
export const OPENER_AUTO_PROMOTE_AFTER_EMAILS = 5;

export type OpenerNurture = {
  step: 0 | 1 | 2 | 3;
  touch1Status: "idle" | "pending_approval" | "sent" | "skipped" | "failed";
  touch1Draft?: { subject: string; html: string };
  touch1At?: string;
  touch1MailId?: string;
  /** Stored values are idle | done | skipped; "due" is view-only via withDerivedNurture. */
  touch2Status: "idle" | "due" | "done" | "skipped";
  touch2Channel?: "whatsapp" | "call";
  touch2At?: string;
  stoppedAt?: string;
  stopReason?: "completed" | "reply" | "opt_out" | "promoted" | "manual" | "blocked";
  stream?: "convert" | "opener_3touch";
  convertCycle?: number;
  wakeAt?: string;
  n1MailId?: string;
  n2MailId?: string;
  n3MailId?: string;
  n1At?: string;
  n2At?: string;
  n3At?: string;
  /** Stored values are idle | done | skipped; "due" is view-only via withDerivedNurture. */
  closerStatus?: "idle" | "due" | "done" | "skipped";
  closerChannel?: "whatsapp" | "call";
  closerAt?: string;
  closerScript?: string;
  promoteBlocked?: boolean;
};

export type OpenerRecord = {
  id: string;
  email: string;
  emails: string[];
  companyNumber?: string;
  companyName?: string;
  dealId?: number;
  prospectId?: number;
  phone?: string;
  companyStatus?: string;
  sicCodes: string[];
  directors: { name: string; role?: string }[];
  dateOfCreation?: string;
  address?: string;
  liveCharges: { chargee?: string; status?: string; createdOn?: string }[];
  nonBankChargeCount: number;
  enrichedAt?: string;
  enrichError?: string;
  status: OpenerStatus;
  notes: string;
  firstOpenedAt: string;
  lastOpenedAt: string;
  openCount: number;
  clickCount: number;
  mailIds?: string[];
  lastTouchAt?: string;
  createdAt: string;
  updatedAt: string;
  nurture: OpenerNurture;
};

export type OpenerMailLike = {
  id: string;
  direction?: string;
  status?: string;
  to?: string;
  from?: string;
  subject?: string;
  opens?: string[];
  clicks?: Array<{ at: string; url?: string }>;
  createdAt?: string;
  dealId?: number;
  prospectId?: number;
};

const STATUS_RANK: Record<OpenerStatus, number> = {
  promoted: 4,
  nurturing: 3,
  not_now: 2,
  new: 1,
  non_responsive: 0,
};

function nowIso(now?: Date): string {
  return (now ?? new Date()).toISOString();
}

function pickPreferredStatus(a: OpenerStatus, b: OpenerStatus): OpenerStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

function preferDefined<T>(a: T | undefined, b: T | undefined): T | undefined {
  return a !== undefined && a !== null && a !== "" ? a : b;
}

export function normalizeEmail(value?: string | null): string {
  return String(value || "").trim().toLowerCase();
}

export function normalizeCompanyNumber(value?: string | null): string {
  const cleaned = String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
  if (!cleaned) return "";
  if (/^\d+$/.test(cleaned)) return cleaned.padStart(8, "0");
  return cleaned;
}

export function emptyNurture(): OpenerNurture {
  return {
    step: 0,
    touch1Status: "idle",
    touch2Status: "idle",
    stream: "opener_3touch",
    closerStatus: "idle",
  };
}

function storedCloserStatus(
  status: OpenerNurture["closerStatus"]
): Exclude<OpenerNurture["closerStatus"], "due"> {
  if (!status || status === "due") return "idle";
  return status;
}

function normalizeNurture(input?: OpenerNurture): OpenerNurture {
  const nurture = { ...emptyNurture(), ...input };
  return {
    ...nurture,
    stream: nurture.stream ?? "opener_3touch",
    closerStatus: storedCloserStatus(nurture.closerStatus),
  };
}

export function normalizeOpener(
  input: Partial<OpenerRecord> & Pick<OpenerRecord, "id" | "email">
): OpenerRecord {
  const email = normalizeEmail(input.email);
  const stamp = nowIso();
  const companyNumber = input.companyNumber
    ? normalizeCompanyNumber(input.companyNumber)
    : undefined;

  return {
    id: input.id,
    email,
    emails: [...new Set([email, ...(input.emails || [])].map(normalizeEmail).filter(Boolean))],
    companyNumber: companyNumber || undefined,
    companyName: input.companyName,
    dealId: input.dealId,
    prospectId: input.prospectId,
    phone: input.phone,
    companyStatus: input.companyStatus,
    sicCodes: input.sicCodes ?? [],
    directors: input.directors ?? [],
    dateOfCreation: input.dateOfCreation,
    address: input.address,
    liveCharges: input.liveCharges ?? [],
    nonBankChargeCount: input.nonBankChargeCount ?? 0,
    enrichedAt: input.enrichedAt,
    enrichError: input.enrichError,
    status: input.status ?? "new",
    notes: input.notes ?? "",
    firstOpenedAt:
      input.firstOpenedAt ?? (input.status === "non_responsive" ? "" : stamp),
    lastOpenedAt:
      input.lastOpenedAt ??
      input.firstOpenedAt ??
      (input.status === "non_responsive" ? "" : stamp),
    openCount: input.openCount ?? 0,
    clickCount: input.clickCount ?? 0,
    mailIds: input.mailIds,
    lastTouchAt: input.lastTouchAt,
    createdAt: input.createdAt ?? stamp,
    updatedAt: input.updatedAt ?? stamp,
    nurture: normalizeNurture(input.nurture),
  };
}

export function daysSittingMs(
  opener: Pick<OpenerRecord, "lastTouchAt" | "lastOpenedAt">,
  now?: Date
): number {
  const anchor = opener.lastTouchAt || opener.lastOpenedAt;
  const start = Date.parse(anchor);
  const end = (now ?? new Date()).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, end - start);
}

export function daysSitting(
  opener: Pick<OpenerRecord, "lastTouchAt" | "lastOpenedAt">,
  now?: Date
): number {
  return Math.floor(daysSittingMs(opener, now) / (24 * 60 * 60 * 1000));
}

function openerDisplayName(opener: Pick<OpenerRecord, "companyName" | "email">): string {
  return opener.companyName?.trim() || opener.email;
}

export type OpenerRankable = Pick<OpenerRecord, "companyName" | "email" | "openCount" | "clickCount"> & {
  timeline?: Array<{ clicks?: unknown[] }>;
};

export function openerClickCount(opener: OpenerRankable): number {
  if (opener.clickCount) return opener.clickCount;
  return (opener.timeline || []).reduce((n, item) => n + (item.clicks?.length ?? 0), 0);
}

export function isHotClickOpener(opener: OpenerRankable): boolean {
  return openerClickCount(opener) > 2;
}

export function compareOpenersByOpenCount(a: OpenerRankable, b: OpenerRankable): number {
  const byClicks = openerClickCount(b) - openerClickCount(a);
  if (byClicks) return byClicks;
  const byOpens = b.openCount - a.openCount;
  if (byOpens) return byOpens;
  return openerDisplayName(a).localeCompare(openerDisplayName(b), undefined, { sensitivity: "base" });
}

export function mergeOpeners(keeper: OpenerRecord, incoming: OpenerRecord): OpenerRecord {
  const emails = [...new Set([...keeper.emails, ...incoming.emails, keeper.email, incoming.email].map(normalizeEmail).filter(Boolean))];

  const firstOpenedAt = !hasRealOpenAt(keeper.firstOpenedAt)
    ? incoming.firstOpenedAt
    : !hasRealOpenAt(incoming.firstOpenedAt)
      ? keeper.firstOpenedAt
      : Date.parse(incoming.firstOpenedAt) < Date.parse(keeper.firstOpenedAt)
        ? incoming.firstOpenedAt
        : keeper.firstOpenedAt;

  const lastOpenedAt = !hasRealOpenAt(keeper.lastOpenedAt)
    ? incoming.lastOpenedAt
    : !hasRealOpenAt(incoming.lastOpenedAt)
      ? keeper.lastOpenedAt
      : Date.parse(incoming.lastOpenedAt) > Date.parse(keeper.lastOpenedAt)
        ? incoming.lastOpenedAt
        : keeper.lastOpenedAt;

  const keepCh = Boolean(keeper.enrichedAt) || keeper.sicCodes.length > 0 || keeper.directors.length > 0;
  const incomingCh = Boolean(incoming.enrichedAt) || incoming.sicCodes.length > 0 || incoming.directors.length > 0;
  const chFrom = keepCh ? keeper : incomingCh ? incoming : keeper;

  return {
    ...keeper,
    email: keeper.email || incoming.email,
    emails,
    companyNumber: preferDefined(keeper.companyNumber, incoming.companyNumber),
    companyName: preferDefined(keeper.companyName, incoming.companyName),
    dealId: preferDefined(keeper.dealId, incoming.dealId),
    prospectId: preferDefined(keeper.prospectId, incoming.prospectId),
    phone: preferDefined(keeper.phone, incoming.phone),
    companyStatus: preferDefined(chFrom.companyStatus, keepCh ? incoming.companyStatus : keeper.companyStatus),
    sicCodes: chFrom.sicCodes.length ? chFrom.sicCodes : keepCh ? incoming.sicCodes : keeper.sicCodes,
    directors: chFrom.directors.length ? chFrom.directors : keepCh ? incoming.directors : keeper.directors,
    dateOfCreation: preferDefined(chFrom.dateOfCreation, keepCh ? incoming.dateOfCreation : keeper.dateOfCreation),
    address: preferDefined(chFrom.address, keepCh ? incoming.address : keeper.address),
    liveCharges: chFrom.liveCharges.length ? chFrom.liveCharges : keepCh ? incoming.liveCharges : keeper.liveCharges,
    nonBankChargeCount: Math.max(keeper.nonBankChargeCount, incoming.nonBankChargeCount),
    enrichedAt: preferDefined(keeper.enrichedAt, incoming.enrichedAt),
    enrichError: preferDefined(keeper.enrichError, incoming.enrichError),
    status: pickPreferredStatus(keeper.status, incoming.status),
    notes: keeper.notes || incoming.notes,
    firstOpenedAt,
    lastOpenedAt,
    openCount: keeper.openCount + incoming.openCount,
    clickCount: (keeper.clickCount ?? 0) + (incoming.clickCount ?? 0),
    mailIds: [...new Set([...(keeper.mailIds || []), ...(incoming.mailIds || [])])],
    lastTouchAt:
      keeper.lastTouchAt && incoming.lastTouchAt
        ? Date.parse(keeper.lastTouchAt) >= Date.parse(incoming.lastTouchAt)
          ? keeper.lastTouchAt
          : incoming.lastTouchAt
        : preferDefined(keeper.lastTouchAt, incoming.lastTouchAt),
    createdAt:
      Date.parse(keeper.createdAt) <= Date.parse(incoming.createdAt) ? keeper.createdAt : incoming.createdAt,
    updatedAt: nowIso(),
    nurture: STATUS_RANK[keeper.status] >= STATUS_RANK[incoming.status] ? keeper.nurture : incoming.nurture,
  };
}

function hasRealOpenAt(value?: string): boolean {
  return Boolean(value) && Number.isFinite(Date.parse(value!));
}

export function applyOpenEvent(opener: OpenerRecord, at: string, extraOpens = 1): OpenerRecord {
  const lastOpenedAt =
    hasRealOpenAt(opener.lastOpenedAt) && Date.parse(at) <= Date.parse(opener.lastOpenedAt)
      ? opener.lastOpenedAt
      : at;
  const firstOpenedAt =
    hasRealOpenAt(opener.firstOpenedAt) && Date.parse(at) >= Date.parse(opener.firstOpenedAt)
      ? opener.firstOpenedAt
      : at;
  return {
    ...opener,
    status: opener.status === "non_responsive" ? "new" : opener.status,
    firstOpenedAt,
    lastOpenedAt,
    openCount: opener.openCount + Math.max(0, extraOpens),
    updatedAt: nowIso(),
  };
}

export function applyClickEvent(opener: OpenerRecord, extraClicks = 1): OpenerRecord {
  return {
    ...opener,
    status: opener.status === "non_responsive" ? "new" : opener.status,
    clickCount: (opener.clickCount ?? 0) + Math.max(0, extraClicks),
    updatedAt: nowIso(),
  };
}

export function openerNurtureDraft(opener: OpenerRecord): { subject: string; html: string } {
  const who = opener.companyName?.trim() || opener.email;
  return {
    subject: `Following up — ${who}`,
    html: `<p>Hi,</p>
<p>You opened our earlier note about restructuring monthly debt commitments for ${who}.</p>
<p>Strata packages UK SME distress-refinance files for the right panel. We do not lend.</p>
<p>If a short call would help map the next step, reply to this email.</p>`,
  };
}

export const SECOND_EMAIL_TOUCH_IDS = ["sme_open", "sme_followup", "sme_2", "opener_1"] as const;

export type OpenerSecondEmailMail = {
  to?: string;
  direction?: string;
  status?: string;
  touchId?: string;
};

export type SecondEmailEvidence = {
  mail?: OpenerSecondEmailMail[];
  smeOpenFollowUpSentAt?: string | null;
  smeFollowupSentAt?: string | null;
};

export function isSecondEmailTouch(touchId?: string | null): boolean {
  return Boolean(touchId && (SECOND_EMAIL_TOUCH_IDS as readonly string[]).includes(touchId));
}

export type OpenerOutboundMail = {
  id?: string;
  to?: string;
  direction?: string;
  status?: string;
  createdAt?: string;
  subject?: string;
};

export function openerOutboundSentCount(
  opener: Pick<OpenerRecord, "email" | "emails">,
  mail: OpenerOutboundMail[] = []
): number {
  const emails = new Set(
    [opener.email, ...(opener.emails || [])].map(normalizeEmail).filter(Boolean)
  );
  const seen = new Set<string>();
  for (const item of mail) {
    if (item.direction !== "outbound") continue;
    if (item.status !== "sent") continue;
    if (!emails.has(normalizeEmail(item.to))) continue;
    const key = item.id || `${item.to}|${item.createdAt || ""}|${item.subject || ""}`;
    seen.add(key);
  }
  return seen.size;
}

export function openerHasReceivedSecondEmail(
  opener: Pick<OpenerRecord, "email" | "emails">,
  evidence: SecondEmailEvidence = {}
): boolean {
  if (evidence.smeOpenFollowUpSentAt || evidence.smeFollowupSentAt) return true;
  const emails = new Set(
    [opener.email, ...(opener.emails || [])].map(normalizeEmail).filter(Boolean)
  );
  const outbound = (evidence.mail || []).filter((item) => {
    if (item.direction !== "outbound") return false;
    if (item.status !== "sent") return false;
    return emails.has(normalizeEmail(item.to));
  });
  if (outbound.some((item) => isSecondEmailTouch(item.touchId))) return true;
  return outbound.length >= 2;
}

export function applySecondEmailNurturing(opener: OpenerRecord, now?: Date): OpenerRecord {
  if (opener.status !== "new") return opener;
  return {
    ...opener,
    status: "nurturing",
    updatedAt: nowIso(now),
  };
}

export function isConvertOpener(opener: Pick<OpenerRecord, "nurture">): boolean {
  return opener.nurture.stream === "convert";
}

export function enrolConvertOpener(opener: OpenerRecord, now?: Date): OpenerRecord {
  const stamp = nowIso(now);
  return {
    ...opener,
    status: "nurturing",
    updatedAt: stamp,
    nurture: {
      ...opener.nurture,
      stream: "convert",
      convertCycle: (opener.nurture.convertCycle || 0) + 1,
      wakeAt: undefined,
      step: 0,
      touch1Status: "idle",
      touch1Draft: undefined,
      touch1At: undefined,
      touch1MailId: undefined,
      touch2Status: "idle",
      touch2Channel: undefined,
      touch2At: undefined,
      n1MailId: undefined,
      n2MailId: undefined,
      n3MailId: undefined,
      n1At: undefined,
      n2At: undefined,
      n3At: undefined,
      closerStatus: "idle",
      closerChannel: undefined,
      closerAt: undefined,
      closerScript: undefined,
      promoteBlocked: undefined,
      stoppedAt: undefined,
      stopReason: undefined,
    },
  };
}

export function recordConvertSend(
  opener: OpenerRecord,
  cadenceTouchId: "sme_n1" | "sme_n2" | "sme_n3",
  mailId: string,
  now?: Date
): OpenerRecord {
  const stamp = nowIso(now);
  const sent =
    cadenceTouchId === "sme_n1"
      ? { n1MailId: mailId, n1At: stamp }
      : cadenceTouchId === "sme_n2"
        ? { n2MailId: mailId, n2At: stamp }
        : { n3MailId: mailId, n3At: stamp };
  return {
    ...opener,
    status: "nurturing",
    lastTouchAt: stamp,
    updatedAt: stamp,
    nurture: {
      ...opener.nurture,
      ...sent,
    },
  };
}

export function writeCloserScript(opener: OpenerRecord, script: string, now?: Date): OpenerRecord {
  const stamp = nowIso(now);
  return {
    ...opener,
    updatedAt: stamp,
    nurture: {
      ...opener.nurture,
      closerScript: script,
    },
  };
}

export function isConvertCloserDue(opener: OpenerRecord, now?: Date): boolean {
  if (!isConvertOpener(opener)) return false;
  if (opener.nurture.closerStatus === "done" || opener.nurture.closerStatus === "skipped") return false;
  const n3At = opener.nurture.n3At;
  if (!n3At) return false;
  const start = Date.parse(n3At);
  if (!Number.isFinite(start)) return false;
  const end = (now ?? new Date()).getTime();
  return end - start >= OPENER_CONVERT_CLOSER_DELAY_MS;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function convertGapMs(touchId: "sme_n2" | "sme_n3"): number {
  const fallback = touchId === "sme_n2" ? 4 : 5;
  const days = SME_NURTURE_CADENCE.find((step) => step.touchId === touchId)?.delayDaysFromPrevious ?? fallback;
  return days * DAY_MS;
}

function daysUntil(fromIso: string | undefined, delayMs: number, now?: Date): number {
  const start = Date.parse(fromIso || "");
  if (!Number.isFinite(start)) return 0;
  const end = (now ?? new Date()).getTime();
  return Math.max(0, Math.ceil((start + delayMs - end) / DAY_MS));
}

function daysLabel(n: number): string {
  return `${n} ${n === 1 ? "day" : "days"}`;
}

export function convertStepBadge(opener: OpenerRecord, now?: Date): string {
  if (isConvertCloserDue(opener, now)) return "C1 due";
  const { n1At, n2At, n3At } = opener.nurture;
  if (!n1At) return "N1 queued";
  if (n3At) return `C1 in ${daysLabel(daysUntil(n3At, OPENER_CONVERT_CLOSER_DELAY_MS, now))}`;
  if (!n2At) return `N2 in ${daysLabel(daysUntil(n1At, convertGapMs("sme_n2"), now))}`;
  return `N3 in ${daysLabel(daysUntil(n2At, convertGapMs("sme_n3"), now))}`;
}

export function completeConvertCloser(
  opener: OpenerRecord,
  channel: "whatsapp" | "call" | "skipped",
  now?: Date
): OpenerRecord {
  const when = now ?? new Date();
  const stamp = nowIso(when);
  const skipped = channel === "skipped";
  return {
    ...opener,
    status: "non_responsive",
    updatedAt: stamp,
    nurture: {
      ...opener.nurture,
      closerStatus: skipped ? "skipped" : "done",
      closerChannel: skipped ? undefined : channel,
      closerAt: stamp,
      stoppedAt: stamp,
      stopReason: "completed",
      wakeAt: convertWakeAt(when),
    },
  };
}

export function startNurture(
  opener: OpenerRecord,
  draft: { subject: string; html: string },
  now?: Date
): OpenerRecord {
  if (isConvertOpener(opener)) return opener;
  const stamp = nowIso(now);
  return {
    ...opener,
    updatedAt: stamp,
    nurture: {
      step: 0,
      touch1Status: "pending_approval",
      touch1Draft: { subject: draft.subject, html: draft.html },
      touch2Status: "idle",
      stream: "opener_3touch",
      closerStatus: "idle",
    },
  };
}

export function approveNurtureSend(opener: OpenerRecord, mailId: string, now?: Date): OpenerRecord {
  if (opener.nurture.touch1MailId) return opener;
  const stamp = nowIso(now);
  return {
    ...opener,
    status: "nurturing",
    lastTouchAt: stamp,
    updatedAt: stamp,
    nurture: {
      ...opener.nurture,
      step: 1,
      touch1Status: "sent",
      touch1At: stamp,
      touch1MailId: mailId,
    },
  };
}

export function failNurtureSend(opener: OpenerRecord): OpenerRecord {
  return {
    ...opener,
    updatedAt: nowIso(),
    nurture: {
      ...opener.nurture,
      touch1Status: "failed",
    },
  };
}

export function skipNurtureStep(opener: OpenerRecord, now?: Date): OpenerRecord {
  const stamp = nowIso(now);
  const { touch1Status } = opener.nurture;
  if (touch1Status === "pending_approval" || touch1Status === "failed") {
    return {
      ...opener,
      updatedAt: stamp,
      nurture: {
        ...opener.nurture,
        step: 1,
        touch1Status: "skipped",
        touch1At: stamp,
      },
    };
  }
  if (opener.nurture.stopReason) return opener;
  if (opener.nurture.step >= 1 && isTouch2Due(opener, now)) {
    return {
      ...opener,
      updatedAt: stamp,
      nurture: {
        ...opener.nurture,
        step: 3,
        touch2Status: "skipped",
        touch2At: stamp,
        stoppedAt: stamp,
        stopReason: "manual",
      },
    };
  }
  return opener;
}

export function isNurtureInFlight(opener: Pick<OpenerRecord, "nurture">): boolean {
  return opener.nurture.step >= 1 && !opener.nurture.stopReason;
}

export function openerOnPipeline(
  opener: Pick<OpenerRecord, "prospectId" | "companyNumber">,
  pipelineCompanyNumbers?: Iterable<string>
): boolean {
  if (opener.prospectId) return true;
  const number = normalizeCompanyNumber(opener.companyNumber);
  if (!number || !pipelineCompanyNumbers) return false;
  for (const value of pipelineCompanyNumbers) {
    if (normalizeCompanyNumber(value) === number) return true;
  }
  return false;
}

export function stopNurture(
  opener: OpenerRecord,
  reason: NonNullable<OpenerNurture["stopReason"]>,
  now?: Date
): OpenerRecord {
  const stamp = nowIso(now);
  return {
    ...opener,
    status: reason === "opt_out" ? "not_now" : opener.status,
    updatedAt: stamp,
    nurture: {
      ...opener.nurture,
      step: 3,
      stoppedAt: stamp,
      stopReason: reason,
    },
  };
}

export function applyConvertStop(
  opener: OpenerRecord,
  reason: "promoted" | "reply" | "opt_out" | "blocked",
  now?: Date
): OpenerRecord {
  const stamp = nowIso(now);
  if (reason === "blocked") {
    return {
      ...opener,
      status: opener.status === "promoted" ? opener.status : "nurturing",
      updatedAt: stamp,
      nurture: {
        ...opener.nurture,
        stream: "convert",
        promoteBlocked: true,
        wakeAt: undefined,
        stoppedAt: stamp,
        stopReason: "blocked",
      },
    };
  }
  const stopped = stopNurture(opener, reason, now);
  return {
    ...stopped,
    status: reason === "promoted" ? "promoted" : stopped.status,
    nurture: {
      ...stopped.nurture,
      stream: opener.nurture.stream ?? "convert",
      wakeAt: undefined,
    },
  };
}

export function convertReasonFromInboundKind(
  kind: string
): "opt_out" | "reply" | undefined {
  if (kind === "stop") return "opt_out";
  if (kind === "responsive") return "reply";
  return undefined;
}

export function completeTouch2(
  opener: OpenerRecord,
  channel: "whatsapp" | "call",
  now?: Date
): OpenerRecord {
  const stamp = nowIso(now);
  return {
    ...opener,
    status: opener.status === "new" ? "nurturing" : opener.status,
    lastTouchAt: stamp,
    updatedAt: stamp,
    nurture: {
      ...opener.nurture,
      step: 3,
      touch2Status: "done",
      touch2Channel: channel,
      touch2At: stamp,
      stoppedAt: stamp,
      stopReason: "completed",
    },
  };
}

export function isTouch2Due(opener: OpenerRecord, now?: Date): boolean {
  if (opener.nurture.stopReason) return false;
  if (opener.nurture.step < 1) return false;
  if (opener.nurture.touch2Status !== "idle") return false;
  const touch1At = opener.nurture.touch1At;
  if (!touch1At) return false;
  const start = Date.parse(touch1At);
  if (!Number.isFinite(start)) return false;
  const end = (now ?? new Date()).getTime();
  return end - start >= OPENER_TOUCH2_DELAY_MS;
}

export function canPromoteOpener(opener: Pick<OpenerRecord, "companyNumber">): boolean {
  return Boolean(normalizeCompanyNumber(opener.companyNumber));
}

export function isDoNotContactOpener(
  opener: Pick<OpenerRecord, "status" | "nurture">
): boolean {
  return opener.status === "not_now" || opener.nurture.stopReason === "opt_out";
}

export function shouldAutoPromoteOpener(
  opener: OpenerRecord,
  mail: OpenerOutboundMail[] = [],
  optOutEmails?: Iterable<string>
): boolean {
  if (opener.status === "promoted" || opener.status === "non_responsive") return false;
  if (!canPromoteOpener(opener)) return false;
  if (isDoNotContactOpener(opener)) return false;
  if (optOutEmails) {
    const blocked = new Set([...optOutEmails].map(normalizeEmail).filter(Boolean));
    const hit = [opener.email, ...(opener.emails || [])].some((email) =>
      blocked.has(normalizeEmail(email))
    );
    if (hit) return false;
  }
  if (isConvertOpener(opener)) return false;
  return openerOutboundSentCount(opener, mail) > OPENER_AUTO_PROMOTE_AFTER_EMAILS;
}

export function canDragOpenerTo(opener: OpenerRecord, column: OpenerStatus): boolean {
  if (opener.status === "non_responsive" || column === "non_responsive") return false;
  if (isDoNotContactOpener(opener)) return column === "not_now";
  if (column === "not_now") return true;
  if (column === "new") {
    if (isConvertOpener(opener)) return !opener.nurture.n1At;
    return opener.nurture.step === 0;
  }
  if (column === "nurturing") {
    if (isConvertOpener(opener)) return opener.nurture.stopReason !== "promoted";
    return opener.nurture.step >= 1 && opener.nurture.stopReason !== "promoted";
  }
  if (column === "promoted") return canPromoteOpener(opener);
  return false;
}

export function keepConvertOpenerOnHardBounce(opener: OpenerRecord): boolean {
  if (!isConvertOpener(opener)) return false;
  if (!String(opener.phone || "").trim()) return false;
  if (opener.nurture.closerStatus === "done" || opener.nurture.closerStatus === "skipped") return false;
  return true;
}

export function openerBelongsToDesk(opener: Pick<OpenerRecord, "status">, desk: OpenerDesk): boolean {
  if (desk === "non_responsive") return opener.status === "non_responsive";
  return opener.status !== "non_responsive";
}

export function sentUnopenedMailEvents(
  items: OpenerMailLike[]
): Array<{
  email: string;
  at: string;
  subject?: string;
  dealId?: number;
  prospectId?: number;
  mailId: string;
}> {
  const events: Array<{
    email: string;
    at: string;
    subject?: string;
    dealId?: number;
    prospectId?: number;
    mailId: string;
  }> = [];

  for (const item of items) {
    if (item.direction !== "outbound") continue;
    if (item.status !== "sent") continue;
    if (lastMailOpenAt(item.opens)) continue;
    if (item.clicks?.length) continue;
    const email = normalizeEmail(item.to);
    if (!email) continue;
    const at = item.createdAt;
    if (!at) continue;
    events.push({
      email,
      at,
      subject: item.subject,
      dealId: item.dealId,
      prospectId: item.prospectId,
      mailId: item.id,
    });
  }
  return events;
}

export function openedMailEvents(
  items: OpenerMailLike[]
): Array<{
  email: string;
  at: string;
  openCount: number;
  subject?: string;
  dealId?: number;
  prospectId?: number;
  mailId: string;
}> {
  const events: Array<{
    email: string;
    at: string;
    openCount: number;
    subject?: string;
    dealId?: number;
    prospectId?: number;
    mailId: string;
  }> = [];

  for (const item of items) {
    if (!isOpenedOutboundMail(item)) continue;
    const at = lastMailOpenAt(item.opens);
    if (!at) continue;
    const email = normalizeEmail(item.to);
    if (!email) continue;
    events.push({
      email,
      at,
      openCount: item.opens?.length ?? 0,
      subject: item.subject,
      dealId: item.dealId,
      prospectId: item.prospectId,
      mailId: item.id,
    });
  }
  return events;
}

export function withDerivedNurture(opener: OpenerRecord, now?: Date): OpenerRecord {
  const touch2Due = isTouch2Due(opener, now);
  const closerDue = isConvertCloserDue(opener, now);
  if (!touch2Due && !closerDue) return opener;
  return {
    ...opener,
    nurture: {
      ...opener.nurture,
      ...(touch2Due ? { touch2Status: "due" as const } : {}),
      ...(closerDue ? { closerStatus: "due" as const } : {}),
    },
  };
}
