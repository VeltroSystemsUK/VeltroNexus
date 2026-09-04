import crypto from "crypto";
import fs from "fs";
import path from "path";
import { isOpenedOutboundMail, lastMailOpenAt } from "@shared/mailTracking";
import {
  applyOpenEvent,
  mergeOpeners,
  normalizeCompanyNumber,
  normalizeEmail,
  normalizeOpener,
  openedMailEvents,
  type OpenerRecord,
} from "@shared/openers";
import type { AgentMailItem } from "./agentMailLog";

export const OPENERS_STORE = path.resolve(process.cwd(), "uploads", "openers.json");

export type OpenerResolveHit = {
  companyNumber?: string;
  companyName?: string;
  dealId?: number;
  prospectId?: number;
  phone?: string;
};

export type OpenerResolver = (
  email: string,
  mail: AgentMailItem
) => OpenerResolveHit | Promise<OpenerResolveHit>;

let storePathForTests: string | null = null;

export function setOpenersStorePathForTests(filePath: string | null): void {
  storePathForTests = filePath;
}

function storePath(): string {
  return storePathForTests || OPENERS_STORE;
}

export function readOpeners(): OpenerRecord[] {
  const file = storePath();
  if (!fs.existsSync(file)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(raw)) return [];
    return raw
      .map((row) => {
        if (!row || typeof row !== "object" || !row.id || !row.email) return undefined;
        return normalizeOpener(row);
      })
      .filter((row): row is OpenerRecord => Boolean(row));
  } catch {
    return [];
  }
}

export function writeOpeners(items: OpenerRecord[]): void {
  const file = storePath();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(items, null, 2));
}

export function listOpeners(): OpenerRecord[] {
  return readOpeners();
}

export function getOpener(id: string): OpenerRecord | undefined {
  return readOpeners().find((row) => row.id === id);
}

export function patchOpener(id: string, updates: Partial<OpenerRecord>): OpenerRecord | undefined {
  const all = readOpeners();
  const idx = all.findIndex((row) => row.id === id);
  if (idx < 0) return undefined;
  const next = normalizeOpener({ ...all[idx], ...updates, id, updatedAt: new Date().toISOString() });
  all[idx] = next;
  writeOpeners(all);
  return next;
}

function takeResolveHit(email: string, mail: AgentMailItem, resolve?: OpenerResolver): OpenerResolveHit {
  if (!resolve) return {};
  const hit = resolve(email, mail);
  if (hit && typeof (hit as Promise<OpenerResolveHit>).then === "function") return {};
  return (hit || {}) as OpenerResolveHit;
}

function findByEmail(items: OpenerRecord[], email: string): OpenerRecord | undefined {
  return items.find((row) => row.email === email || row.emails.includes(email));
}

function findByCompany(items: OpenerRecord[], companyNumber?: string): OpenerRecord | undefined {
  const number = normalizeCompanyNumber(companyNumber);
  if (!number) return undefined;
  return items.find((row) => normalizeCompanyNumber(row.companyNumber) === number);
}

function applyIdentity(
  opener: OpenerRecord,
  email: string,
  mail: AgentMailItem,
  hit: OpenerResolveHit
): OpenerRecord {
  const emails = [
    ...new Set([...opener.emails, opener.email, email].map(normalizeEmail).filter(Boolean)),
  ];
  const resolvedNumber = hit.companyNumber ? normalizeCompanyNumber(hit.companyNumber) : "";
  return {
    ...opener,
    email: opener.email || email,
    emails,
    companyNumber: resolvedNumber || opener.companyNumber,
    companyName: opener.companyName || hit.companyName,
    dealId: opener.dealId ?? hit.dealId ?? mail.dealId,
    prospectId: opener.prospectId ?? hit.prospectId ?? mail.prospectId,
    phone: opener.phone || hit.phone,
  };
}

function earliestOpenAt(opens: string[], fallback: string): string {
  let earliest = fallback;
  for (const stamp of opens) {
    if (Date.parse(stamp) < Date.parse(earliest)) earliest = stamp;
  }
  return earliest;
}

function saveOpener(opener: OpenerRecord, dropId?: string): OpenerRecord {
  const next = readOpeners().filter((row) => row.id !== opener.id && row.id !== dropId);
  next.push(opener);
  writeOpeners(next);
  return opener;
}

function applyOpenedMail(
  mail: AgentMailItem,
  resolve: OpenerResolver | undefined,
  extraOpens: number,
  skipIfSeen: boolean
): OpenerRecord | undefined {
  if (!isOpenedOutboundMail(mail)) return undefined;
  const email = normalizeEmail(mail.to);
  if (!email) return undefined;
  const opens = mail.opens || [];
  const at = lastMailOpenAt(opens);
  if (!at) return undefined;

  const all = readOpeners();
  if (skipIfSeen && all.some((row) => row.mailIds?.includes(mail.id))) return undefined;

  const hit = takeResolveHit(email, mail, resolve);
  const byEmail = findByEmail(all, email);
  const byCompany = findByCompany(all, hit.companyNumber);

  let opener: OpenerRecord;
  let dropId: string | undefined;

  if (byEmail && byCompany && byEmail.id !== byCompany.id) {
    opener = mergeOpeners(byEmail, byCompany);
    dropId = byCompany.id;
  } else if (byEmail) {
    opener = byEmail;
  } else if (byCompany) {
    opener = byCompany;
  } else {
    opener = normalizeOpener({
      id: crypto.randomUUID(),
      email,
      firstOpenedAt: earliestOpenAt(opens, at),
      lastOpenedAt: at,
      openCount: 0,
      companyNumber: hit.companyNumber,
      companyName: hit.companyName,
      dealId: hit.dealId ?? mail.dealId,
      prospectId: hit.prospectId ?? mail.prospectId,
      phone: hit.phone,
    });
  }

  opener = applyIdentity(opener, email, mail, hit);
  opener = applyOpenEvent(opener, at, extraOpens);
  const firstAt = earliestOpenAt(opens, at);
  if (Date.parse(firstAt) < Date.parse(opener.firstOpenedAt)) {
    opener = { ...opener, firstOpenedAt: firstAt };
  }
  opener = {
    ...opener,
    mailIds: [...new Set([...(opener.mailIds || []), mail.id])],
  };

  return saveOpener(opener, dropId);
}

export function upsertOpenerFromMail(
  mail: AgentMailItem,
  resolve?: OpenerResolver
): OpenerRecord | undefined {
  return applyOpenedMail(mail, resolve, 1, false);
}

export function hydrateFromAgentMail(
  items: AgentMailItem[],
  resolve?: OpenerResolver
): OpenerRecord[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  for (const event of openedMailEvents(items)) {
    const mail = byId.get(event.mailId);
    if (!mail) continue;
    applyOpenedMail(mail, resolve, event.openCount, true);
  }
  return listOpeners();
}
