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

function directorMatches(contactName: string, directorNames?: string[]): boolean {
  const name = contactName.trim();
  if (!name) return false;
  const first = name.split(/\s+/)[0]?.toLowerCase();
  if (!first) return false;

  if (directorNames == null) {
    return name.length > 1 && !GENERIC_CONTACT_WORDS.has(first);
  }

  return directorNames.some((d) => {
    const entry = String(d || "").trim().toLowerCase();
    if (!entry) return false;
    if (entry.includes(first)) return true;
    return entry.split(/\s+/)[0] === first;
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

export function sendableShortfall(
  deals: Array<{ hopper?: string | null; source?: string | null }>,
  target: number = SME_HOPPER_TARGET
): number {
  return Math.max(0, target - hopperCounts(deals).sendable);
}
