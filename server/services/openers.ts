import crypto from "crypto";
import fs from "fs";
import path from "path";
import { countLiveNonBankCharges, isLiveCharge } from "@shared/chargeClassifier";
import { isOpenedOutboundMail, lastMailOpenAt } from "@shared/mailTracking";
import { resolveSendAsMailbox } from "@shared/agentMailboxes";
import { signatureHtml } from "@shared/strataOutreach";
import {
  applyClickEvent,
  applyOpenEvent,
  applySecondEmailNurturing,
  approveNurtureSend,
  canPromoteOpener,
  completeTouch2,
  enrolConvertOpener,
  failNurtureSend,
  isDoNotContactOpener,
  isNurtureInFlight,
  isTouch2Due,
  mergeOpeners,
  normalizeCompanyNumber,
  normalizeEmail,
  normalizeOpener,
  openedMailEvents,
  openerHasReceivedSecondEmail,
  sentUnopenedMailEvents,
  openerNurtureDraft,
  shouldAutoPromoteOpener,
  skipNurtureStep,
  startNurture,
  stopNurture,
  type OpenerRecord,
} from "@shared/openers";
import { buildConvertEnrolment } from "@shared/smeConvert";
import { classifyInboundMail } from "@shared/mailDesk";
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

export type OpenerIdentityDeal = {
  id: number;
  companyNumber?: string | null;
  companyName?: string | null;
  phone?: string | null;
  prospectId?: number | null;
  email?: string | null;
  smeOpenFollowUpSentAt?: string | null;
  smeFollowupSentAt?: string | null;
};

export type OpenerIdentityProspect = {
  id: number;
  companyId?: number;
  company?: { companyNumber?: string | null; companyName?: string | null } | null;
};

export type OpenerIdentityContact = {
  email?: string | null;
  phone?: string | null;
  prospectId?: number;
};

export type OpenerIdentityLead = {
  email?: string | null;
  phone?: string | null;
  companyNumber?: string | null;
  companyName?: string | null;
};

export type OpenerIdentityDeps = {
  getAgenticDeal(id: number): Promise<OpenerIdentityDeal | undefined>;
  listAgenticDeals(): Promise<OpenerIdentityDeal[]>;
  getProspectById(id: number): Promise<OpenerIdentityProspect | undefined>;
  listProspects(userId: string): Promise<OpenerIdentityProspect[]>;
  listContacts(prospectId: number, userId: string): Promise<OpenerIdentityContact[]>;
  listInternalLeads(): Promise<OpenerIdentityLead[]>;
  resolvePipelineOwnerUserId(): Promise<string>;
};

type IdentitySnapshot = {
  ownerUserId?: string;
  dealsById: Map<number, OpenerIdentityDeal>;
  dealsByEmail: Map<string, OpenerIdentityDeal>;
  prospectsById: Map<number, OpenerIdentityProspect>;
  contactsByEmail: Map<string, { prospectId: number; phone?: string; companyNumber?: string; companyName?: string }>;
  leadsByEmail: Map<string, OpenerIdentityLead>;
  pipelineCompanyNumbers: Set<string>;
};

let storePathForTests: string | null = null;
let identityDepsForTests: OpenerIdentityDeps | null = null;
let identitySnapshot: IdentitySnapshot | null = null;
let identityFollowUp: Promise<void> = Promise.resolve();
let chClientForTests: OpenerChClient | null = null;

export function setOpenersStorePathForTests(filePath: string | null): void {
  storePathForTests = filePath;
}

export function setOpenerIdentityDepsForTests(deps: OpenerIdentityDeps | null): void {
  identityDepsForTests = deps;
  identitySnapshot = null;
  identityFollowUp = Promise.resolve();
}

export function setOpenerChClientForTests(client: OpenerChClient | null): void {
  chClientForTests = client;
}

export function flushOpenerIdentityFollowUps(): Promise<void> {
  return identityFollowUp;
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

function inVitest(): boolean {
  return Boolean(process.env.VITEST);
}

async function productionIdentityDeps(): Promise<OpenerIdentityDeps> {
  const { storage } = await import("../storage");
  const { resolvePipelineOwnerUserId } = await import("./inboundPipeline");
  return {
    getAgenticDeal: (id) => storage.getAgenticDeal(id),
    listAgenticDeals: () => storage.listAgenticDeals(),
    getProspectById: (id) => storage.getProspectById(id),
    listProspects: (userId) => storage.listProspects(userId),
    listContacts: (prospectId, userId) => storage.listContacts(prospectId, userId),
    listInternalLeads: () => storage.listInternalLeads(),
    resolvePipelineOwnerUserId,
  };
}

async function identityDeps(): Promise<OpenerIdentityDeps | null> {
  if (identityDepsForTests) return identityDepsForTests;
  if (inVitest()) return null;
  return productionIdentityDeps();
}

function fillHit(hit: OpenerResolveHit, extra: OpenerResolveHit): OpenerResolveHit {
  return {
    companyNumber: hit.companyNumber || extra.companyNumber,
    companyName: hit.companyName || extra.companyName,
    dealId: hit.dealId ?? extra.dealId,
    prospectId: hit.prospectId ?? extra.prospectId,
    phone: hit.phone || extra.phone,
  };
}

function hitFromDeal(deal: OpenerIdentityDeal): OpenerResolveHit {
  return {
    companyNumber: deal.companyNumber || undefined,
    companyName: deal.companyName || undefined,
    dealId: deal.id,
    prospectId: deal.prospectId || undefined,
    phone: deal.phone || undefined,
  };
}

function hitFromProspect(prospect: OpenerIdentityProspect, phone?: string): OpenerResolveHit {
  return {
    companyNumber: prospect.company?.companyNumber || undefined,
    companyName: prospect.company?.companyName || undefined,
    prospectId: prospect.id,
    phone,
  };
}

function hitFromLead(lead: OpenerIdentityLead): OpenerResolveHit {
  return {
    companyNumber: lead.companyNumber || undefined,
    companyName: lead.companyName || undefined,
    phone: lead.phone || undefined,
  };
}

function emptySnapshot(): IdentitySnapshot {
  return {
    dealsById: new Map(),
    dealsByEmail: new Map(),
    prospectsById: new Map(),
    contactsByEmail: new Map(),
    leadsByEmail: new Map(),
    pipelineCompanyNumbers: new Set(),
  };
}

async function loadIdentitySnapshot(deps: OpenerIdentityDeps): Promise<IdentitySnapshot> {
  const snapshot = emptySnapshot();
  const [deals, leads, ownerUserId] = await Promise.all([
    deps.listAgenticDeals().catch(() => [] as OpenerIdentityDeal[]),
    deps.listInternalLeads().catch(() => [] as OpenerIdentityLead[]),
    deps.resolvePipelineOwnerUserId().catch(() => ""),
  ]);
  snapshot.ownerUserId = ownerUserId || undefined;

  for (const deal of deals) {
    snapshot.dealsById.set(deal.id, deal);
    const email = normalizeEmail(deal.email);
    if (email && !snapshot.dealsByEmail.has(email)) snapshot.dealsByEmail.set(email, deal);
  }
  for (const lead of leads) {
    const email = normalizeEmail(lead.email);
    if (email && !snapshot.leadsByEmail.has(email)) snapshot.leadsByEmail.set(email, lead);
  }
  if (!ownerUserId) return snapshot;

  const prospects = await deps.listProspects(ownerUserId).catch(() => [] as OpenerIdentityProspect[]);
  for (const prospect of prospects) {
    snapshot.prospectsById.set(prospect.id, prospect);
    const number = normalizeCompanyNumber(prospect.company?.companyNumber);
    if (number) snapshot.pipelineCompanyNumbers.add(number);
    const contacts = await deps.listContacts(prospect.id, ownerUserId).catch(() => [] as OpenerIdentityContact[]);
    for (const contact of contacts) {
      const email = normalizeEmail(contact.email);
      if (!email || snapshot.contactsByEmail.has(email)) continue;
      snapshot.contactsByEmail.set(email, {
        prospectId: prospect.id,
        phone: contact.phone || undefined,
        companyNumber: number || undefined,
        companyName: prospect.company?.companyName || undefined,
      });
    }
  }
  return snapshot;
}

export async function refreshOpenerIdentitySnapshot(): Promise<IdentitySnapshot | null> {
  const deps = await identityDeps();
  if (!deps) {
    identitySnapshot = null;
    return null;
  }
  identitySnapshot = await loadIdentitySnapshot(deps);
  return identitySnapshot;
}

function resolveFromSnapshot(email: string, mail: AgentMailItem, snapshot: IdentitySnapshot): OpenerResolveHit {
  let hit: OpenerResolveHit = {};
  if (mail.dealId != null) {
    const deal = snapshot.dealsById.get(mail.dealId);
    if (deal) hit = fillHit(hit, hitFromDeal(deal));
  }
  if (mail.prospectId != null) {
    const prospect = snapshot.prospectsById.get(mail.prospectId);
    if (prospect) {
      const contact = [...snapshot.contactsByEmail.values()].find((row) => row.prospectId === prospect.id);
      hit = fillHit(hit, hitFromProspect(prospect, contact?.phone));
    }
  }
  const dealByEmail = snapshot.dealsByEmail.get(email);
  if (dealByEmail) hit = fillHit(hit, hitFromDeal(dealByEmail));
  const contact = snapshot.contactsByEmail.get(email);
  if (contact) {
    hit = fillHit(hit, {
      companyNumber: contact.companyNumber,
      companyName: contact.companyName,
      prospectId: contact.prospectId,
      phone: contact.phone,
    });
  }
  const lead = snapshot.leadsByEmail.get(email);
  if (lead) hit = fillHit(hit, hitFromLead(lead));
  return hit;
}

export function defaultOpenerResolver(email: string, mail: AgentMailItem): OpenerResolveHit {
  if (!identitySnapshot) return {};
  return resolveFromSnapshot(email, mail, identitySnapshot);
}

export async function resolveOpenerIdentity(email: string, mail: AgentMailItem): Promise<OpenerResolveHit> {
  const deps = await identityDeps();
  if (!deps) return identitySnapshot ? resolveFromSnapshot(email, mail, identitySnapshot) : {};

  let hit: OpenerResolveHit = {};
  if (mail.dealId != null) {
    try {
      const deal = await deps.getAgenticDeal(mail.dealId);
      if (deal) hit = fillHit(hit, hitFromDeal(deal));
    } catch {
      // deal lookup is best-effort
    }
  }
  if (mail.prospectId != null) {
    try {
      const prospect = await deps.getProspectById(mail.prospectId);
      if (prospect) {
        let phone: string | undefined;
        try {
          const ownerId = identitySnapshot?.ownerUserId || (await deps.resolvePipelineOwnerUserId().catch(() => ""));
          const contacts = await deps.listContacts(mail.prospectId, ownerId);
          phone = contacts.find((row) => row.phone)?.phone || undefined;
        } catch {
          // contacts are optional
        }
        hit = fillHit(hit, hitFromProspect(prospect, phone));
      }
    } catch {
      // prospect lookup is best-effort
    }
  }
  if (!identitySnapshot) {
    identitySnapshot = await loadIdentitySnapshot(deps);
  }
  return fillHit(hit, resolveFromSnapshot(email, mail, identitySnapshot));
}

export function currentOpenerPipelineCompanyNumbers(): Set<string> {
  return new Set(identitySnapshot?.pipelineCompanyNumbers || []);
}

export async function listOpenerPipelineCompanyNumbers(extraUserId?: string): Promise<Set<string>> {
  if (!identitySnapshot) await refreshOpenerIdentitySnapshot();
  const numbers = new Set<string>(identitySnapshot?.pipelineCompanyNumbers || []);
  const extra = extraUserId?.trim();
  if (!extra || extra === identitySnapshot?.ownerUserId) return numbers;
  const deps = await identityDeps();
  if (!deps) return numbers;
  try {
    const prospects = await deps.listProspects(extra);
    for (const prospect of prospects) {
      const number = normalizeCompanyNumber(prospect.company?.companyNumber);
      if (number) numbers.add(number);
    }
  } catch {
    // request-user lookup is best-effort
  }
  return numbers;
}

function enqueueIdentityFollowUp(work: () => Promise<void>): void {
  identityFollowUp = identityFollowUp.then(work).catch((error: any) => {
    console.warn("[Openers] identity follow-up failed:", error?.message || error);
  });
}

function scheduleEnrichIfNew(hadNumber: boolean, opener?: OpenerRecord): void {
  if (!opener || hadNumber) return;
  if (!normalizeCompanyNumber(opener.companyNumber) || opener.enrichedAt) return;
  if (inVitest() && !chClientForTests) return;
  void enrichOpener(opener.id, chClientForTests ?? companiesHouseClient).catch((error: any) => {
    console.warn("[Openers] enrich after identity attach failed:", error?.message || error);
  });
}

function scheduleDefaultIdentityFollowUp(mail: AgentMailItem): void {
  if (inVitest() && !identityDepsForTests) return;
  const email = normalizeEmail(mail.to);
  enqueueIdentityFollowUp(async () => {
    const hit = await resolveOpenerIdentity(email, mail);
    applyOpenedMail(mail, () => hit, 0, true);
    applySentUnopenedMail(mail, () => hit);
  });
}

function lastClickAt(clicks?: Array<{ at: string; url?: string }>): string | undefined {
  if (!clicks?.length) return undefined;
  return clicks[clicks.length - 1]?.at;
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

export function suppressionFanoutForEmail(email: string): { emails: string[]; companyNumber?: string } {
  const normalized = normalizeEmail(email);
  const emails = new Set<string>();
  if (normalized) emails.add(normalized);
  const opener = findByEmail(readOpeners(), normalized);
  if (opener) {
    emails.add(opener.email);
    for (const extra of opener.emails || []) {
      const alias = normalizeEmail(extra);
      if (alias) emails.add(alias);
    }
  }
  return { emails: [...emails], companyNumber: opener?.companyNumber };
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

export async function enrolConvertFromMail(item: AgentMailItem, now?: Date): Promise<void> {
  const dealId = item.dealId;
  if (dealId == null) return;
  const email = normalizeEmail(item.to);
  if (!email) return;
  const opener = findByEmail(readOpeners(), email);
  if (!opener) return;

  try {
    const { storage } = await import("../storage");
    const deal = await storage.getAgenticDeal(dealId);
    if (!deal) return;

    const { listAgentMail } = await import("./agentMailLog");
    const mail = listAgentMail(10_000).filter((row) => row.dealId === dealId);
    if (item.id && !mail.some((row) => row.id === item.id)) mail.push(item);

    const built = buildConvertEnrolment(mail, deal, opener, now);
    if (!built) return;

    await storage.updateAgenticDeal(dealId, built.dealPatch);
    saveOpener(enrolConvertOpener(getOpener(opener.id) || opener, now));
  } catch (error: any) {
    console.warn("[Openers] convert enrol failed:", error?.message || error);
  }
}

function identityChanged(before: OpenerRecord, after: OpenerRecord): boolean {
  return (
    before.companyNumber !== after.companyNumber ||
    before.phone !== after.phone ||
    before.prospectId !== after.prospectId ||
    before.dealId !== after.dealId ||
    before.companyName !== after.companyName ||
    before.emails.slice().sort().join("|") !== after.emails.slice().sort().join("|")
  );
}

function applyOpenedMailTo(
  all: OpenerRecord[],
  mail: AgentMailItem,
  resolve: OpenerResolver | undefined,
  extraOpens: number,
  skipIfSeen: boolean
): { all: OpenerRecord[]; opener?: OpenerRecord } {
  if (!isOpenedOutboundMail(mail)) return { all };
  const email = normalizeEmail(mail.to);
  if (!email) return { all };
  const opens = mail.opens || [];
  const at = lastMailOpenAt(opens);
  if (!at) return { all };

  const hit = takeResolveHit(email, mail, resolve);
  const seenRow = all.find((row) => row.mailIds?.includes(mail.id));
  const identityOnly = Boolean(
    skipIfSeen && seenRow && seenRow.status !== "non_responsive" && seenRow.openCount > 0
  );

  let opener: OpenerRecord;
  let dropId: string | undefined;

  if (identityOnly) {
    opener = seenRow!;
    const companyRow = findByCompany(
      all.filter((row) => row.id !== opener.id),
      hit.companyNumber
    );
    if (companyRow) {
      opener = mergeOpeners(opener, companyRow);
      dropId = companyRow.id;
    }
    opener = applyIdentity(opener, email, mail, hit);
    if (!dropId && !identityChanged(seenRow!, opener)) return { all };
  } else {
    const byEmail = findByEmail(all, email);
    const byCompany = findByCompany(all, hit.companyNumber);

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
        clickCount: 0,
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
  }

  const next = all.filter((row) => row.id !== opener.id && row.id !== dropId);
  next.push(opener);
  return { all: next, opener };
}

function applyOpenedMail(
  mail: AgentMailItem,
  resolve: OpenerResolver | undefined,
  extraOpens: number,
  skipIfSeen: boolean
): OpenerRecord | undefined {
  const all = readOpeners();
  const email = normalizeEmail(mail.to);
  const existing = findByEmail(all, email) || findByCompany(all, takeResolveHit(email, mail, resolve).companyNumber);
  const hadNumber = Boolean(normalizeCompanyNumber(existing?.companyNumber));
  const result = applyOpenedMailTo(all, mail, resolve, extraOpens, skipIfSeen);
  if (!result.opener) return undefined;
  writeOpeners(result.all);
  scheduleEnrichIfNew(hadNumber, result.opener);
  return result.opener;
}

export function upsertOpenerFromMail(
  mail: AgentMailItem,
  resolve?: OpenerResolver
): OpenerRecord | undefined {
  const resolver = resolve ?? defaultOpenerResolver;
  const opener = applyOpenedMail(mail, resolver, 1, false);
  if (resolve) {
    const email = normalizeEmail(mail.to);
    const pending = resolve(email, mail);
    if (pending && typeof (pending as Promise<OpenerResolveHit>).then === "function") {
      enqueueIdentityFollowUp(async () => {
        const hit = await pending;
        applyOpenedMail(mail, () => hit, 0, true);
      });
    }
  } else {
    scheduleDefaultIdentityFollowUp(mail);
  }
  return opener;
}

function applySentUnopenedMailTo(
  all: OpenerRecord[],
  mail: AgentMailItem,
  resolve?: OpenerResolver
): { all: OpenerRecord[]; opener?: OpenerRecord } {
  if (mail.direction !== "outbound" || mail.status !== "sent") return { all };
  if (isOpenedOutboundMail(mail) || lastClickAt(mail.clicks)) return { all };
  const email = normalizeEmail(mail.to);
  if (!email) return { all };

  const hit = takeResolveHit(email, mail, resolve);
  const existing = findByEmail(all, email) || findByCompany(all, hit.companyNumber);
  if (existing) {
    if (existing.status !== "non_responsive") return { all, opener: existing };
    const opener = {
      ...applyIdentity(existing, email, mail, hit),
      lastTouchAt: mail.createdAt || existing.lastTouchAt,
      mailIds: [...new Set([...(existing.mailIds || []), mail.id])],
      updatedAt: new Date().toISOString(),
    };
    const next = all.filter((row) => row.id !== opener.id);
    next.push(opener);
    return { all: next, opener };
  }

  const opener = applyIdentity(
    normalizeOpener({
      id: crypto.randomUUID(),
      email,
      status: "non_responsive",
      openCount: 0,
      clickCount: 0,
      firstOpenedAt: "",
      lastOpenedAt: "",
      lastTouchAt: mail.createdAt,
      mailIds: [mail.id],
      companyNumber: hit.companyNumber,
      companyName: hit.companyName,
      dealId: hit.dealId ?? mail.dealId,
      prospectId: hit.prospectId ?? mail.prospectId,
      phone: hit.phone,
    }),
    email,
    mail,
    hit
  );
  return { all: [...all, opener], opener };
}

function applySentUnopenedMail(
  mail: AgentMailItem,
  resolve?: OpenerResolver
): OpenerRecord | undefined {
  const all = readOpeners();
  const existing = findByEmail(all, normalizeEmail(mail.to));
  const hadNumber = Boolean(normalizeCompanyNumber(existing?.companyNumber));
  const result = applySentUnopenedMailTo(all, mail, resolve);
  if (!result.opener || result.opener === existing) {
    if (result.opener && result.all !== all) writeOpeners(result.all);
    return result.opener;
  }
  writeOpeners(result.all);
  scheduleEnrichIfNew(hadNumber, result.opener);
  return result.opener;
}

export function upsertNonResponsiveFromMail(
  mail: AgentMailItem,
  resolve?: OpenerResolver
): OpenerRecord | undefined {
  if (mail.direction !== "outbound" || mail.status !== "sent") return undefined;
  if (isOpenedOutboundMail(mail) || lastClickAt(mail.clicks)) return undefined;
  const resolver = resolve ?? defaultOpenerResolver;
  const opener = applySentUnopenedMail(mail, resolver);
  if (resolve) {
    const email = normalizeEmail(mail.to);
    const pending = resolve(email, mail);
    if (pending && typeof (pending as Promise<OpenerResolveHit>).then === "function") {
      enqueueIdentityFollowUp(async () => {
        const hit = await pending;
        applySentUnopenedMail(mail, () => hit);
      });
    }
  } else {
    scheduleDefaultIdentityFollowUp(mail);
  }
  return opener;
}

export function upsertOpenerClickFromMail(
  mail: AgentMailItem,
  resolve?: OpenerResolver
): OpenerRecord | undefined {
  if (mail.direction !== "outbound") return undefined;
  if (!mail.clicks?.length) return undefined;
  const resolver = resolve ?? defaultOpenerResolver;
  const all = readOpeners();
  const result = applyClickEngagementTo(all, mail, resolver, 1);
  if (!result.opener) return undefined;
  if (result.all !== all) writeOpeners(result.all);
  return result.opener;
}

function dealFlagsForOpener(opener: OpenerRecord): {
  smeOpenFollowUpSentAt?: string | null;
  smeFollowupSentAt?: string | null;
} {
  const snapshot = identitySnapshot;
  if (!snapshot) return {};
  const byId = opener.dealId != null ? snapshot.dealsById.get(opener.dealId) : undefined;
  const byEmail = snapshot.dealsByEmail.get(normalizeEmail(opener.email));
  const deal = byId || byEmail;
  if (!deal) return {};
  return {
    smeOpenFollowUpSentAt: deal.smeOpenFollowUpSentAt,
    smeFollowupSentAt: deal.smeFollowupSentAt,
  };
}

function applySecondEmailNurturingPass(
  all: OpenerRecord[],
  mail: AgentMailItem[]
): { all: OpenerRecord[]; dirty: boolean } {
  let dirty = false;
  const next = all.map((opener) => {
    if (
      !openerHasReceivedSecondEmail(opener, {
        mail,
        ...dealFlagsForOpener(opener),
      })
    ) {
      return opener;
    }
    const moved = applySecondEmailNurturing(opener);
    if (moved.status !== opener.status) dirty = true;
    return moved;
  });
  return { all: next, dirty };
}

function collectOptOutEmails(
  items: AgentMailItem[],
  extra?: Iterable<string>
): Set<string> {
  const emails = new Set(
    [...(extra || [])].map(normalizeEmail).filter(Boolean)
  );
  for (const item of items) {
    if (item.direction !== "inbound") continue;
    const from = normalizeEmail(item.from);
    if (!from) continue;
    if (item.deskKind === "stop") {
      emails.add(from);
      continue;
    }
    if (item.deskKind) continue;
    if (classifyInboundMail(item).kind === "stop") emails.add(from);
  }
  return emails;
}

function applyUnsubscribes(all: OpenerRecord[], optOutEmails: Set<string>): {
  all: OpenerRecord[];
  dirty: boolean;
} {
  if (optOutEmails.size === 0) return { all, dirty: false };
  let dirty = false;
  const next = all.map((opener) => {
    const hit = [opener.email, ...(opener.emails || [])].some((email) =>
      optOutEmails.has(normalizeEmail(email))
    );
    if (!hit || opener.status === "not_now") return opener;
    dirty = true;
    return stopNurture(opener, "opt_out");
  });
  return { all: next, dirty };
}

function applyClickEngagementTo(
  all: OpenerRecord[],
  mail: AgentMailItem,
  resolve?: OpenerResolver,
  extraClicks = 1
): { all: OpenerRecord[]; opener?: OpenerRecord } {
  if (mail.direction !== "outbound") return { all };
  const at = lastClickAt(mail.clicks);
  if (!at) return { all };
  const email = normalizeEmail(mail.to);
  if (!email) return { all };

  const hit = takeResolveHit(email, mail, resolve);
  const existing = findByEmail(all, email) || findByCompany(all, hit.companyNumber);
  if (existing) {
    if (extraClicks === 0 && existing.status !== "non_responsive") {
      return { all, opener: existing };
    }
    const opener = {
      ...applyClickEvent(applyIdentity(existing, email, mail, hit), extraClicks),
      mailIds: [...new Set([...(existing.mailIds || []), mail.id])],
    };
    const next = all.filter((row) => row.id !== opener.id);
    next.push(opener);
    return { all: next, opener };
  }

  const opener = applyClickEvent(
    applyIdentity(
      normalizeOpener({
        id: crypto.randomUUID(),
        email,
        status: "new",
        openCount: 0,
        clickCount: 0,
        firstOpenedAt: at,
        lastOpenedAt: at,
        lastTouchAt: mail.createdAt,
        mailIds: [mail.id],
        companyNumber: hit.companyNumber,
        companyName: hit.companyName,
        dealId: hit.dealId ?? mail.dealId,
        prospectId: hit.prospectId ?? mail.prospectId,
        phone: hit.phone,
      }),
      email,
      mail,
      hit
    ),
    extraClicks
  );
  return { all: [...all, opener], opener };
}

function totalClicksFor(opener: OpenerRecord, items: AgentMailItem[]): number {
  const emails = new Set(
    [opener.email, ...(opener.emails || [])].map(normalizeEmail).filter(Boolean)
  );
  let n = 0;
  for (const item of items) {
    if (item.direction !== "outbound") continue;
    if (!emails.has(normalizeEmail(item.to))) continue;
    n += item.clicks?.length ?? 0;
  }
  return n;
}

function syncClickCounts(
  all: OpenerRecord[],
  items: AgentMailItem[]
): { all: OpenerRecord[]; dirty: boolean } {
  let dirty = false;
  const next = all.map((opener) => {
    const clickCount = totalClicksFor(opener, items);
    const status =
      clickCount > 0 && opener.status === "non_responsive" ? "new" : opener.status;
    if (clickCount === opener.clickCount && status === opener.status) return opener;
    dirty = true;
    return { ...opener, clickCount, status, updatedAt: new Date().toISOString() };
  });
  return { all: next, dirty };
}

function dropBounced(
  all: OpenerRecord[],
  bounceEmails: Set<string>
): { all: OpenerRecord[]; dirty: boolean } {
  if (bounceEmails.size === 0) return { all, dirty: false };
  const next = all.filter((opener) => {
    return ![opener.email, ...(opener.emails || [])].some((email) =>
      bounceEmails.has(normalizeEmail(email))
    );
  });
  return { all: next, dirty: next.length !== all.length };
}

export function hydrateFromAgentMail(
  items: AgentMailItem[],
  resolve?: OpenerResolver,
  opts?: { optOutEmails?: Iterable<string>; bounceEmails?: Iterable<string> }
): OpenerRecord[] {
  const resolver = resolve ?? defaultOpenerResolver;
  let all = readOpeners();
  const byId = new Map(items.map((item) => [item.id, item]));
  let dirty = false;
  const newlyNumbered: OpenerRecord[] = [];

  for (const event of sentUnopenedMailEvents(items)) {
    const mail = byId.get(event.mailId);
    if (!mail) continue;
    const email = normalizeEmail(mail.to);
    const existing = findByEmail(all, email);
    const hadNumber = Boolean(normalizeCompanyNumber(existing?.companyNumber));
    const result = applySentUnopenedMailTo(all, mail, resolver);
    if (result.opener) {
      if (result.all !== all) dirty = true;
      all = result.all;
      if (
        result.opener.status === "non_responsive" &&
        !hadNumber &&
        result.opener.companyNumber &&
        !result.opener.enrichedAt
      ) {
        newlyNumbered.push(result.opener);
      }
    }
  }

  for (const event of openedMailEvents(items)) {
    const mail = byId.get(event.mailId);
    if (!mail) continue;
    const email = normalizeEmail(mail.to);
    const existing = findByEmail(all, email);
    const hadNumber = Boolean(normalizeCompanyNumber(existing?.companyNumber));
    const result = applyOpenedMailTo(all, mail, resolver, event.openCount, true);
    if (result.opener) {
      all = result.all;
      dirty = true;
      if (!hadNumber && result.opener.companyNumber && !result.opener.enrichedAt) {
        newlyNumbered.push(result.opener);
      }
    }
  }

  for (const item of items) {
    const result = applyClickEngagementTo(all, item, resolver, 0);
    if (result.opener && result.all !== all) {
      all = result.all;
      dirty = true;
    }
  }

  const clicks = syncClickCounts(all, items);
  all = clicks.all;
  if (clicks.dirty) dirty = true;

  const secondEmail = applySecondEmailNurturingPass(all, items);
  all = secondEmail.all;
  if (secondEmail.dirty) dirty = true;
  const unsubscribed = applyUnsubscribes(all, collectOptOutEmails(items, opts?.optOutEmails));
  all = unsubscribed.all;
  if (unsubscribed.dirty) dirty = true;
  const bounced = dropBounced(
    all,
    new Set([...(opts?.bounceEmails || [])].map(normalizeEmail).filter(Boolean))
  );
  all = bounced.all;
  if (bounced.dirty) dirty = true;
  if (dirty) writeOpeners(all);
  for (const opener of newlyNumbered) scheduleEnrichIfNew(false, opener);
  return all;
}

export function markOpenerNurturingOnOutbound(
  mail: AgentMailItem,
  allMail: AgentMailItem[] = [mail]
): OpenerRecord | undefined {
  if (mail.direction !== "outbound" || mail.status !== "sent") return undefined;
  const email = normalizeEmail(mail.to);
  if (!email) return undefined;
  const all = readOpeners();
  const opener = findByEmail(all, email);
  if (!opener) return undefined;
  if (
    !openerHasReceivedSecondEmail(opener, {
      mail: allMail,
      ...dealFlagsForOpener(opener),
      ...(mail.touchId === "sme_open" ? { smeOpenFollowUpSentAt: mail.createdAt } : {}),
      ...(mail.touchId === "sme_followup" ? { smeFollowupSentAt: mail.createdAt } : {}),
    })
  ) {
    return undefined;
  }
  const moved = applySecondEmailNurturing(opener);
  if (moved.status === opener.status) return opener;
  return saveOpener(moved);
}

export async function autoPromoteEligibleOpeners(
  mail: AgentMailItem[],
  opts?: { userId?: string; optOutEmails?: Iterable<string>; deps?: PromoteDeps }
): Promise<OpenerRecord[]> {
  const deps = opts?.deps ?? (inVitest() ? null : await defaultPromoteDeps());
  if (!deps) return [];
  const promoted: OpenerRecord[] = [];
  for (const opener of readOpeners()) {
    if (!shouldAutoPromoteOpener(opener, mail, opts?.optOutEmails)) continue;
    try {
      const result = await promoteOpener(opener.id, opts?.userId || "", deps);
      promoted.push(result.opener);
    } catch (error: any) {
      console.warn("[Openers] auto-promote failed:", opener.email, error?.message || error);
    }
  }
  return promoted;
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
  resolvePipelineOwnerUserId?(): Promise<string>;
};

type SendEmailFn = typeof import("./email").sendEmail;

function httpError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

async function defaultPromoteDeps(): Promise<PromoteDeps> {
  const { storage } = await import("../storage");
  const { resolvePipelineOwnerUserId } = await import("./inboundPipeline");
  return {
    getCompanyByNumber: (n) => storage.getCompanyByNumber(n),
    createCompany: (data) => storage.createCompany(data),
    listProspects: (userId) => storage.listProspects(userId),
    createProspect: (data, userId) => storage.createProspect(data, userId),
    createContact: (data, userId) => storage.createContact(data, userId),
    resolvePipelineOwnerUserId,
  };
}

async function findProspectForCompany(
  d: PromoteDeps,
  companyId: number,
  userId: string
): Promise<{ id: number; companyId: number } | undefined> {
  const seen = new Set<string>();
  const userIds: string[] = [];
  if (d.resolvePipelineOwnerUserId) {
    try {
      userIds.push(await d.resolvePipelineOwnerUserId());
    } catch {
      // owner lookup is best-effort; still try the request user
    }
  } else if (!userId) {
    try {
      const { resolvePipelineOwnerUserId } = await import("./inboundPipeline");
      userIds.push(await resolvePipelineOwnerUserId());
    } catch {
      // no owner available
    }
  }
  if (userId) userIds.push(userId);
  for (const id of userIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const hit = (await d.listProspects(id)).find((row) => row.companyId === companyId);
    if (hit?.id) return hit;
  }
  return undefined;
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

function refuseDoNotContact(opener: OpenerRecord): void {
  if (isDoNotContactOpener(opener)) throw httpError("Do not contact", 400);
}

export async function runNurtureAction(
  id: string,
  action: "start" | "approve" | "skip" | "stop" | "touch2",
  opts?: { channel?: "whatsapp" | "call"; now?: Date; send?: SendEmailFn; agentId?: string }
): Promise<OpenerRecord> {
  const opener = requireOpener(id);
  const now = opts?.now;
  if (action !== "stop") refuseDoNotContact(opener);

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
  const mailbox = resolveSendAsMailbox(opts?.agentId, "outreach-sales");
  const html = `${draft.html}\n${signatureHtml(mailbox)}`;
  let result: Awaited<ReturnType<SendEmailFn>>;
  try {
    result = await send(
      {
        agentId: mailbox.agentId,
        fromEmail: mailbox.address,
        fromName: mailbox.fromName,
        replyTo: mailbox.replyTo,
        dealId: opener.dealId,
        prospectId: opener.prospectId,
        touchId: "opener_1",
      },
      opener.email,
      draft.subject,
      html
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

  const existing = await findProspectForCompany(d, company!.id, resolvedUserId);
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
  refuseDoNotContact(opener);
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
  refuseDoNotContact(opener);
  if (!opener.phone) throw httpError("Phone required", 400);
  const stamp = (now ?? new Date()).toISOString();
  const line = `${stamp} ${note}`;
  const withNote: OpenerRecord = {
    ...opener,
    notes: opener.notes ? `${line}\n${opener.notes}` : line,
  };
  return saveOpener(completeTouch2IfDue(withNote, "call", now));
}

export function deleteOpenerByEmail(email: string): boolean {
  const target = normalizeEmail(email);
  if (!target) return false;
  const all = readOpeners();
  const next = all.filter(
    (row) => row.email !== target && !(row.emails || []).includes(target)
  );
  if (next.length === all.length) return false;
  writeOpeners(next);
  return true;
}

export function stopOpenerNurtureByEmail(
  email: string,
  reason: "reply" | "opt_out"
): OpenerRecord | undefined {
  const opener = findByEmail(readOpeners(), normalizeEmail(email));
  if (!opener) return undefined;
  if (reason === "opt_out") {
    if (opener.status === "not_now" && opener.nurture.stopReason === "opt_out") return opener;
    return saveOpener(stopNurture(opener, "opt_out"));
  }
  if (!isNurtureInFlight(opener)) return undefined;
  return saveOpener(stopNurture(opener, reason));
}
