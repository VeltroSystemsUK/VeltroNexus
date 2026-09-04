import { isOpenedOutboundMail, lastMailOpenAt } from "./mailTracking";

export const OPENER_STATUSES = ["new", "nurturing", "not_now", "promoted"] as const;
export type OpenerStatus = (typeof OPENER_STATUSES)[number];

export const OPENER_TOUCH2_DELAY_MS = 3 * 24 * 60 * 60 * 1000;

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
  stopReason?: "completed" | "reply" | "opt_out" | "promoted" | "manual";
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
  mailIds?: string[];
  lastTouchAt?: string;
  createdAt: string;
  updatedAt: string;
  nurture: OpenerNurture;
};

export type OpenerMailLike = {
  id: string;
  direction?: string;
  to?: string;
  from?: string;
  subject?: string;
  opens?: string[];
  dealId?: number;
  prospectId?: number;
};

const STATUS_RANK: Record<OpenerStatus, number> = {
  promoted: 4,
  nurturing: 3,
  not_now: 2,
  new: 1,
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
    emails: (input.emails?.length ? input.emails : [email]).map(normalizeEmail).filter(Boolean),
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
    firstOpenedAt: input.firstOpenedAt ?? stamp,
    lastOpenedAt: input.lastOpenedAt ?? input.firstOpenedAt ?? stamp,
    openCount: input.openCount ?? 0,
    mailIds: input.mailIds,
    lastTouchAt: input.lastTouchAt,
    createdAt: input.createdAt ?? stamp,
    updatedAt: input.updatedAt ?? stamp,
    nurture: input.nurture ?? emptyNurture(),
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

export function mergeOpeners(keeper: OpenerRecord, incoming: OpenerRecord): OpenerRecord {
  const emails = [...new Set([...keeper.emails, ...incoming.emails, keeper.email, incoming.email].map(normalizeEmail).filter(Boolean))];

  const firstOpenedAt =
    Date.parse(incoming.firstOpenedAt) < Date.parse(keeper.firstOpenedAt)
      ? incoming.firstOpenedAt
      : keeper.firstOpenedAt;

  const lastOpenedAt =
    Date.parse(incoming.lastOpenedAt) > Date.parse(keeper.lastOpenedAt)
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

export function applyOpenEvent(opener: OpenerRecord, at: string, extraOpens = 1): OpenerRecord {
  const lastOpenedAt = Date.parse(at) > Date.parse(opener.lastOpenedAt) ? at : opener.lastOpenedAt;
  const firstOpenedAt = Date.parse(at) < Date.parse(opener.firstOpenedAt) ? at : opener.firstOpenedAt;
  return {
    ...opener,
    firstOpenedAt,
    lastOpenedAt,
    openCount: opener.openCount + Math.max(0, extraOpens),
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

export function startNurture(
  opener: OpenerRecord,
  draft: { subject: string; html: string },
  now?: Date
): OpenerRecord {
  const stamp = nowIso(now);
  return {
    ...opener,
    updatedAt: stamp,
    nurture: {
      ...opener.nurture,
      touch1Status: "pending_approval",
      touch1Draft: { subject: draft.subject, html: draft.html },
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
  if (opener.nurture.touch2Status === "idle" && opener.nurture.step >= 1 && !opener.nurture.stopReason) {
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

export function stopNurture(
  opener: OpenerRecord,
  reason: NonNullable<OpenerNurture["stopReason"]>,
  now?: Date
): OpenerRecord {
  const stamp = nowIso(now);
  return {
    ...opener,
    updatedAt: stamp,
    nurture: {
      ...opener.nurture,
      step: 3,
      stoppedAt: stamp,
      stopReason: reason,
    },
  };
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

export function canDragOpenerTo(opener: OpenerRecord, column: OpenerStatus): boolean {
  if (column === "not_now") return true;
  if (column === "new") return opener.nurture.step === 0;
  if (column === "nurturing") {
    return opener.nurture.step >= 1 && opener.nurture.stopReason !== "promoted";
  }
  if (column === "promoted") return canPromoteOpener(opener);
  return false;
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
  if (!isTouch2Due(opener, now)) return opener;
  return {
    ...opener,
    nurture: {
      ...opener.nurture,
      touch2Status: "due",
    },
  };
}
