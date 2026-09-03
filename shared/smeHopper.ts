import { MAILBOX_SEND_FLOOR } from "./mailboxScore";
import {
  emailMatchesCompany,
  isClearCompanyMismatch,
  isPersonalMailbox,
  isBlockedOutreachMailbox,
} from "./pecrSend";

export const SME_HOPPER_TARGET = 100;
export const SME_ATTACH_ATTEMPT_CAP = 5;

export const ROLE_LOCALS = new Set([
  "info",
  "sales",
  "enquiry",
  "enquiries",
  "admin",
  "hello",
  "office",
  "accounts",
  "contact",
  "team",
  "mail",
  "reception",
  "bookings",
  "support",
  "marketing",
  "webmaster",
  "ops",
  "finance",
  "hr",
  "jobs",
  "billing",
]);

const GENERIC_CONTACT_WORDS = new Set(["hi", "there", "sir", "team", "director"]);

export type HopperState = "gated" | "hunt_contact" | "sendable" | "parked" | "queued" | "quarantine";
export type MailboxGrade = "director" | "role" | "reject";

export type HopperDeal = {
  id?: number | string;
  hopper?: HopperState;
  source?: string;
  nonBankChargeCount?: number;
  lastSignalAt?: string;
  incorporatedAt?: string;
  hasPetition?: boolean;
  hearingAt?: string;
};

export function isRoleMailbox(email?: string | null): boolean {
  const local = String(email || "")
    .trim()
    .toLowerCase()
    .split("@")[0];
  return !!local && ROLE_LOCALS.has(local);
}

function firstToken(value: string): string {
  return String(value || "")
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase() || "";
}

function hasWholeWord(haystack: string, word: string): boolean {
  if (!word) return false;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(haystack);
}

function directorMatches(contactName: string, directorNames?: string[]): boolean {
  const name = contactName.trim();
  if (!name) return false;
  const first = firstToken(name);
  if (!first) return false;

  if (directorNames == null) {
    return name.length > 1 && !GENERIC_CONTACT_WORDS.has(first);
  }

  return directorNames.some((d) => {
    const entry = String(d || "").trim();
    if (!entry) return false;
    if (firstToken(entry) === first) return true;
    return hasWholeWord(entry, first);
  });
}

export function directorForEmail(email: string, directorNames?: string[]): string | undefined {
  const local = String(email || "")
    .split("@")[0]
    .toLowerCase();
  const localTokens = String(local || "")
    .split(/[^a-z]+/)
    .filter((token) => token.length > 1);
  if (!localTokens.length) return undefined;
  return (directorNames || []).find((name) => {
    const tokens = String(name || "")
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((token) => token.length > 1);
    if (!tokens.length) return false;
    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    return localTokens.includes(first) || localTokens.includes(last);
  });
}

export function gradeMailbox(input: {
  email?: string | null;
  contactName?: string | null;
  directorNames?: string[];
  companyName?: string | null;
}): MailboxGrade {
  const email = String(input.email || "").trim();
  if (!email) return "reject";
  if (isPersonalMailbox(email)) return "reject";
  if (isBlockedOutreachMailbox(email)) return "reject";
  if (isRoleMailbox(email)) return "role";

  const matched = directorForEmail(email, input.directorNames);
  if (matched) return "director";
  const contactName = String(input.contactName || "").trim();
  if (contactName && directorMatches(contactName, input.directorNames)) return "director";
  if (contactName && (input.directorNames == null || input.directorNames.length === 0)) return "director";
  if (input.companyName && emailMatchesCompany(email, input.companyName)) return "director";
  return "reject";
}

export function isSendableContact(input: {
  email?: string | null;
  contactName?: string | null;
  directorNames?: string[];
  companyName?: string | null;
}): boolean {
  if (gradeMailbox(input) === "reject") return false;
  if (input.companyName && isClearCompanyMismatch(input.email, input.companyName)) return false;
  return true;
}

export function isProtectedFromQuarantine(deal: {
  source?: string;
  stream?: string;
  hopper?: string;
  stage?: string;
  outreachTouch?: number | null;
  sterlingHandoffId?: number | null;
  packDocuments?: Array<unknown> | null;
}): boolean {
  if (deal.source === "strata_inbound") return true;
  if (deal.stream === "introducer") return true;
  if ((deal.outreachTouch || 0) >= 1) return true;
  if (deal.sterlingHandoffId) return true;
  if ((deal.packDocuments || []).length > 0) return true;
  const stage = String(deal.stage || "");
  return ["fulfilment", "human_call", "processing", "underwriting", "human_review", "complete"].includes(stage);
}

export function smeHuntNeed(opts: { sendableUnsent: number; remainingSlots: number; target?: number }): number {
  const target = opts.target ?? SME_HOPPER_TARGET;
  const want = Math.min(target, Math.max(0, opts.remainingSlots));
  return Math.max(0, want - Math.max(0, opts.sendableUnsent));
}

function rankTuple(d: HopperDeal): [number, number, number, number, number] {
  const hearing = d.hearingAt ? 1 : 0;
  const petition = d.hasPetition ? 1 : 0;
  const charges = d.nonBankChargeCount || 0;
  const signal = d.lastSignalAt ? Date.parse(d.lastSignalAt) : 0;
  const incorporated = d.incorporatedAt ? Date.parse(d.incorporatedAt) : Number.MAX_SAFE_INTEGER;
  return [hearing, petition, charges, signal, -incorporated];
}

/** Negative when `a` should sort before `b` (better first). */
export function compareSendable(a: HopperDeal, b: HopperDeal): number {
  const ta = rankTuple(a);
  const tb = rankTuple(b);
  for (let i = 0; i < ta.length; i++) {
    if (ta[i] !== tb[i]) return tb[i] - ta[i];
  }
  return 0;
}

export function rankSendable<T extends HopperDeal>(deals: T[]): T[] {
  return [...deals].sort(compareSendable);
}

export function hopperCounts(
  deals: Array<{ hopper?: string | null; source?: string | null }>
): { sendable: number; huntContact: number; parked: number; gated: number; quarantine: number } {
  const counts = { sendable: 0, huntContact: 0, parked: 0, gated: 0, quarantine: 0 };
  for (const d of deals) {
    if (!d.hopper) continue;
    if (d.source === "strata_inbound") continue;
    if (d.hopper === "sendable") counts.sendable++;
    else if (d.hopper === "hunt_contact") counts.huntContact++;
    else if (d.hopper === "parked") counts.parked++;
    else if (d.hopper === "gated") counts.gated++;
    else if (d.hopper === "quarantine") counts.quarantine++;
  }
  return counts;
}

export function hopperStatusLine(deals: Parameters<typeof hopperCounts>[0]): string {
  const c = hopperCounts(deals);
  return `Hopper ${c.sendable}/${SME_HOPPER_TARGET} sendable · ${c.huntContact} hunt-contact · ${c.quarantine} quarantine`;
}

export function sendableShortfall(
  deals: Array<{ hopper?: string | null; source?: string | null }>,
  target: number = SME_HOPPER_TARGET
): number {
  return Math.max(0, target - hopperCounts(deals).sendable);
}

export function isSmeHopperSendable(deal: {
  hopper?: string;
  source?: string;
  stream?: string;
  email?: string | null;
}): boolean {
  if (deal.source === "strata_inbound") return false;
  return deal.hopper === "sendable";
}

export function isContactableDeal(deal: {
  source?: string;
  email?: string | null;
  contactName?: string | null;
  directorNames?: string[];
  companyName?: string | null;
  mailboxConfidence?: number | null;
}): boolean {
  const email = String(deal.email || "").trim();
  if (!email) return false;
  if (deal.source === "strata_inbound") return true;
  if (deal.mailboxConfidence != null && deal.mailboxConfidence < MAILBOX_SEND_FLOOR) return false;
  return isSendableContact({
    email,
    contactName: deal.contactName,
    directorNames: deal.directorNames,
    companyName: deal.companyName,
  });
}
