import crypto from "crypto";
import fs from "fs";
import path from "path";
import { countLiveNonBankCharges, isLiveCharge } from "@shared/chargeClassifier";
import { isOpenedOutboundMail, lastMailOpenAt } from "@shared/mailTracking";
import { mailboxForAgent } from "@shared/agentMailboxes";
import {
  applyOpenEvent,
  approveNurtureSend,
  canPromoteOpener,
  completeTouch2,
  failNurtureSend,
  isTouch2Due,
  mergeOpeners,
  normalizeCompanyNumber,
  normalizeEmail,
  normalizeOpener,
  openedMailEvents,
  openerNurtureDraft,
  skipNurtureStep,
  startNurture,
  stopNurture,
  type OpenerRecord,
} from "@shared/openers";
import { wasEmailDelivered } from "@shared/outreachSend";
import { companiesHouseClient } from "../utils/companiesHouseClient";
import type { AgentMailItem } from "./agentMailLog";

export type OpenerChClient = {
  getCompanyProfile(n: string): Promise<any>;
  getCompanyOfficers(n: string): Promise<any>;
  getCompanyCharges(n: string): Promise<any>;
};

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

function asItems(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.items)) return payload.items;
  return [];
}

function addressSnippet(address: any): string | undefined {
  if (!address || typeof address !== "object") return undefined;
  const parts = [
    address.premises,
    address.address_line_1,
    address.address_line_2,
    address.locality,
    address.region,
    address.postal_code,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

export function snapshotFromCompaniesHouse(
  profile: any,
  officers: any,
  charges: any
): Partial<OpenerRecord> {
  const officerItems = asItems(officers);
  const chargeItems = asItems(charges);

  const directors = officerItems
    .filter((officer) => !officer?.resigned_on)
    .map((officer) => ({
      name: String(officer?.name || ""),
      role: officer?.officer_role,
    }))
    .filter((officer) => officer.name);

  const liveCharges = chargeItems
    .filter((charge) => isLiveCharge(charge?.status))
    .map((charge) => ({
      chargee: charge?.persons_entitled?.[0]?.name,
      status: charge?.status,
      createdOn: charge?.delivered_on || charge?.created_on,
    }));

  const nonBankChargeCount = countLiveNonBankCharges(
    chargeItems.map((charge) => ({
      status: charge?.status,
      personsEntitled: (charge?.persons_entitled || [])
        .map((person: any) => person?.name)
        .filter(Boolean),
    }))
  );

  return {
    companyName: profile?.company_name,
    companyStatus: profile?.company_status,
    sicCodes: Array.isArray(profile?.sic_codes) ? profile.sic_codes : [],
    dateOfCreation: profile?.date_of_creation,
    address: addressSnippet(profile?.registered_office_address),
    directors,
    liveCharges,
    nonBankChargeCount,
  };
}

function requireOpener(id: string): OpenerRecord {
  const opener = getOpener(id);
  if (!opener) throw new Error(`Opener not found: ${id}`);
  return opener;
}

export async function enrichOpener(
  id: string,
  client: OpenerChClient = companiesHouseClient
): Promise<OpenerRecord> {
  const current = requireOpener(id);
  if (!current.companyNumber) return current;

  try {
    const [profile, officers, charges] = await Promise.all([
      client.getCompanyProfile(current.companyNumber),
      client.getCompanyOfficers(current.companyNumber),
      client.getCompanyCharges(current.companyNumber),
    ]);
    if (!profile) {
      return patchOpener(id, { enrichError: "Companies House profile not found" }) ?? current;
    }
    const snapshot = snapshotFromCompaniesHouse(profile, officers, charges);
    return (
      patchOpener(id, {
        ...snapshot,
        enrichedAt: new Date().toISOString(),
        enrichError: undefined,
      }) ?? current
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return patchOpener(id, { enrichError: message }) ?? current;
  }
}

export async function attachCompanyNumber(
  id: string,
  companyNumber: string,
  client: OpenerChClient = companiesHouseClient
): Promise<OpenerRecord> {
  const current = requireOpener(id);
  const number = normalizeCompanyNumber(companyNumber);
  const duplicate = findByCompany(
    readOpeners().filter((row) => row.id !== id),
    number
  );

  let opener: OpenerRecord = normalizeOpener({
    ...current,
    companyNumber: number || undefined,
    updatedAt: new Date().toISOString(),
  });
  let dropId: string | undefined;
  if (duplicate) {
    opener = mergeOpeners(opener, duplicate);
    dropId = duplicate.id;
  }
  saveOpener(opener, dropId);
  return enrichOpener(opener.id, client);
}

export type PromoteDeps = {
  getCompanyByNumber(n: string): Promise<{ id: number; companyNumber: string } | undefined>;
  createCompany(data: any): Promise<{ id: number }>;
  listProspects(userId: string): Promise<Array<{ id: number; companyId: number }>>;
  createProspect(data: any, userId: string): Promise<{ id: number }>;
  createContact(data: any, userId: string): Promise<any>;
};

type SendEmailFn = typeof import("./email").sendEmail;

function httpError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

async function defaultPromoteDeps(): Promise<PromoteDeps> {
  const { storage } = await import("../storage");
  return {
    getCompanyByNumber: (n) => storage.getCompanyByNumber(n),
    createCompany: (data) => storage.createCompany(data),
    listProspects: (userId) => storage.listProspects(userId),
    createProspect: (data, userId) => storage.createProspect(data, userId),
    createContact: (data, userId) => storage.createContact(data, userId),
  };
}

export function completeTouch2IfDue(
  opener: OpenerRecord,
  channel: "whatsapp" | "call",
  now?: Date
): OpenerRecord {
  const when = now ?? new Date();
  const stamp = when.toISOString();
  const next = isTouch2Due(opener, when) ? completeTouch2(opener, channel, when) : opener;
  return { ...next, lastTouchAt: stamp, updatedAt: stamp };
}

export async function runNurtureAction(
  id: string,
  action: "start" | "approve" | "skip" | "stop" | "touch2",
  opts?: { channel?: "whatsapp" | "call"; now?: Date; send?: SendEmailFn }
): Promise<OpenerRecord> {
  const opener = requireOpener(id);
  const now = opts?.now;

  if (action === "start") {
    return saveOpener(startNurture(opener, openerNurtureDraft(opener), now));
  }

  if (action === "skip") {
    return saveOpener(skipNurtureStep(opener, now));
  }

  if (action === "stop") {
    return saveOpener(stopNurture(opener, "manual", now));
  }

  if (action === "touch2") {
    const channel = opts?.channel;
    if (channel !== "whatsapp" && channel !== "call") {
      throw httpError("channel required", 400);
    }
    return saveOpener(completeTouch2(opener, channel, now));
  }

  if (opener.nurture.touch1MailId) return opener;

  const draft = opener.nurture.touch1Draft || openerNurtureDraft(opener);
  const send = opts?.send ?? (await import("./email")).sendEmail;
  const mailbox = mailboxForAgent("outreach-sales");
  let result: Awaited<ReturnType<SendEmailFn>>;
  try {
    result = await send(
      {
        agentId: "outreach-sales",
        fromEmail: mailbox.address,
        fromName: mailbox.fromName,
        replyTo: mailbox.replyTo,
        dealId: opener.dealId,
        prospectId: opener.prospectId,
        touchId: "opener_1",
      },
      opener.email,
      draft.subject,
      draft.html
    );
  } catch {
    return saveOpener(failNurtureSend(opener));
  }

  if (!wasEmailDelivered(result)) {
    return saveOpener(failNurtureSend(opener));
  }

  const mailId = result.id || crypto.randomUUID();
  return saveOpener(approveNurtureSend(opener, mailId, now));
}

export async function promoteOpener(
  id: string,
  userId: string,
  deps?: PromoteDeps
): Promise<{ opener: OpenerRecord; prospectId: number; created: boolean }> {
  const opener = requireOpener(id);
  if (!canPromoteOpener(opener)) {
    throw httpError("Company number required", 400);
  }

  let resolvedUserId = userId;
  if (!resolvedUserId) {
    const { resolvePipelineOwnerUserId } = await import("./inboundPipeline");
    resolvedUserId = await resolvePipelineOwnerUserId();
  }
  const d = deps ?? (await defaultPromoteDeps());
  const number = normalizeCompanyNumber(opener.companyNumber);
  let company = await d.getCompanyByNumber(number);
  if (!company) {
    company = {
      ...(await d.createCompany({
        companyName: opener.companyName || opener.email,
        companyNumber: number,
        registeredAddress: opener.address || "",
        companyType: "ltd",
        sicCode: opener.sicCodes[0] || undefined,
        incorporationDate: opener.dateOfCreation || undefined,
        companyStatus: opener.companyStatus || "active",
      })),
      companyNumber: number,
    };
  }

  const existing = (await d.listProspects(resolvedUserId)).find((row) => row.companyId === company!.id);
  if (existing?.id) {
    const next = saveOpener({
      ...stopNurture(opener, "promoted"),
      status: "promoted",
      prospectId: existing.id,
    });
    return { opener: next, prospectId: existing.id, created: false };
  }

  const prospect = await d.createProspect(
    {
      companyId: company.id,
      stage: "lead",
      referralSource: "Openers",
      notes: `Opened Agent Mail. Last open: ${opener.lastOpenedAt}. Email: ${opener.email}`,
      directorsGuarantee: 0,
      commercialProperty: 0,
      homeEquity: 0,
      propertyOther: 0,
      debenture: 0,
      parentCompanyGuarantee: 0,
      collateral: 0,
      crossCompanyGuarantee: 0,
      queueOrder: 0,
    },
    resolvedUserId
  );

  const directorName = opener.directors[0]?.name;
  if (opener.email || opener.phone || directorName) {
    await d.createContact(
      {
        prospectId: prospect.id,
        name: directorName || opener.companyName || opener.email,
        email: opener.email || null,
        phone: opener.phone || null,
        role: "Director",
        isPrimary: 1,
      },
      resolvedUserId
    );
  }

  const next = saveOpener({
    ...stopNurture(opener, "promoted"),
    status: "promoted",
    prospectId: prospect.id,
  });
  return { opener: next, prospectId: prospect.id, created: true };
}

export async function sendOpenerWhatsApp(
  id: string,
  message: string,
  send?: (phone: string, body: string) => Promise<string>,
  now?: Date
): Promise<OpenerRecord> {
  const opener = requireOpener(id);
  if (!opener.phone) throw httpError("Phone required", 400);
  const sendFn =
    send ??
    (async (phone: string, body: string) => {
      const { whatsappService } = await import("./whatsappService");
      return whatsappService.sendMessage(phone, body);
    });
  await sendFn(opener.phone, message);
  return saveOpener(completeTouch2IfDue(opener, "whatsapp", now));
}

export async function logOpenerCall(id: string, note: string, now?: Date): Promise<OpenerRecord> {
  const opener = requireOpener(id);
  if (!opener.phone) throw httpError("Phone required", 400);
  const stamp = (now ?? new Date()).toISOString();
  const line = `${stamp} ${note}`;
  const withNote: OpenerRecord = {
    ...opener,
    notes: opener.notes ? `${line}\n${opener.notes}` : line,
  };
  return saveOpener(completeTouch2IfDue(withNote, "call", now));
}

export function stopOpenerNurtureByEmail(
  email: string,
  reason: "reply" | "opt_out"
): OpenerRecord | undefined {
  const opener = findByEmail(readOpeners(), normalizeEmail(email));
  if (!opener) return undefined;
  return saveOpener(stopNurture(opener, reason));
}
