import { isPersonalMailbox } from "./pecrSend";

export const SME_HOPPER_TARGET = 250;
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
]);

const GENERIC_CONTACT_WORDS = new Set(["hi", "there", "sir", "team", "director"]);

export type HopperDeal = {
  id?: number | string;
  hopper?: "gated" | "hunt_contact" | "sendable" | "parked" | "queued";
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

export function isSendableContact(input: {
  email?: string | null;
  contactName?: string | null;
  directorNames?: string[];
}): boolean {
  const email = String(input.email || "").trim();
  if (!email) return false;
  if (isPersonalMailbox(email)) return false;
  if (isRoleMailbox(email)) return false;

  const contactName = String(input.contactName || "").trim();
  if (!contactName) return false;
  return directorMatches(contactName, input.directorNames);
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
): { sendable: number; huntContact: number; parked: number; gated: number } {
  const counts = { sendable: 0, huntContact: 0, parked: 0, gated: 0 };
  for (const d of deals) {
    if (!d.hopper) continue;
    if (d.source === "strata_inbound") continue;
    if (d.hopper === "sendable") counts.sendable++;
    else if (d.hopper === "hunt_contact") counts.huntContact++;
    else if (d.hopper === "parked") counts.parked++;
    else if (d.hopper === "gated") counts.gated++;
  }
  return counts;
}

export function hopperStatusLine(deals: Parameters<typeof hopperCounts>[0]): string {
  const c = hopperCounts(deals);
  return `Hopper ${c.sendable}/${SME_HOPPER_TARGET} sendable · ${c.huntContact} hunt-contact · ${c.parked} parked`;
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
