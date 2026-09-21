import fs from "fs";
import path from "path";
import {
  annotateCrmLeads,
  applyHarvestToCrmLead,
  isCrmHarvestCandidate,
  type CrmLeadContactProbe,
} from "@shared/crmLeadContact";
import {
  chargeHarvestSignal,
  compareHarvestRank,
  isHarvestSkipClass,
  obviousSkipClass,
  type HarvestRank,
  type HarvestSkipClass,
} from "@shared/crmHarvestRank";
import { isHardBounceReason } from "@shared/mailDesk";
import { HARVEST_PER_HOUR, HARVEST_RETRY_MS, attachOne, liveAttachDeps, type AttachBudget, type AttachDeps } from "./smeLeadHopper";
import { storage } from "../storage";
import { AGENT_MAIL_KEEP, listAgentMail } from "./agentMailLog";
import { loadSuppression } from "./mailSuppression";
import { loadLenderCostCache } from "./lenderCostCache";
import type { LenderCostCache } from "@shared/lenderCost";

export type CrmHarvestRow = {
  attempts: number;
  waitUntil?: string;
  directorNames?: string[];
  skipClass?: HarvestSkipClass;
  harvestNow?: boolean;
  smeBorrower?: number;
  rankedAt?: string;
};

export type CrmHarvestStore = {
  read(id: number): CrmHarvestRow;
  write(id: number, row: CrmHarvestRow): void;
};

const DEFAULT_STORE = path.resolve(process.cwd(), "uploads", "crm_harvest.json");
let storeOverride: string | null = null;

export function setCrmHarvestStorePathForTests(filePath: string | null) {
  storeOverride = filePath;
  fileStoreMem = null;
  fileStoreDirty = 0;
}

function storePath() {
  return storeOverride || DEFAULT_STORE;
}

let fileStoreMem: Record<string, CrmHarvestRow> | null = null;
let fileStoreDirty = 0;

function loadFileStore(): Record<string, CrmHarvestRow> {
  if (fileStoreMem) return fileStoreMem;
  const file = storePath();
  if (!fs.existsSync(file)) {
    fileStoreMem = {};
    return fileStoreMem;
  }
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    fileStoreMem = data && typeof data === "object" ? data : {};
  } catch {
    fileStoreMem = {};
  }
  return fileStoreMem;
}

function persistFileStore() {
  if (!fileStoreMem) return;
  const file = storePath();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(fileStoreMem));
  fileStoreDirty = 0;
}

export function flushCrmHarvestStore() {
  if (fileStoreDirty > 0) persistFileStore();
}

export function fileCrmHarvestStore(): CrmHarvestStore {
  return {
    read(id) {
      const row = loadFileStore()[String(id)];
      if (!row || typeof row.attempts !== "number") return { attempts: 0 };
      return row;
    },
    write(id, row) {
      loadFileStore()[String(id)] = row;
      fileStoreDirty += 1;
      if (fileStoreDirty >= 100) persistFileStore();
    },
  };
}

export type CrmHarvestLead = CrmLeadContactProbe & {
  id: number;
  companyName: string;
  companyNumber?: string | null;
  hasCharges?: boolean | null;
  companyType?: string | null;
  sicCode?: string | null;
  identifiedLender?: string | null;
};

function rankFromRow(row: CrmHarvestRow): HarvestRank | null {
  if (!row.skipClass && row.harvestNow == null && row.smeBorrower == null) return null;
  return {
    harvestNow: Boolean(row.harvestNow),
    smeBorrower: Number(row.smeBorrower) || 0,
    skipClass: row.skipClass || "unsure",
    at: row.rankedAt,
  };
}

function syntheticRank(lead: CrmHarvestLead, at: string): HarvestRank {
  const signal = chargeHarvestSignal(lead);
  if (signal === "property_only") {
    return { harvestNow: false, smeBorrower: 0, skipClass: "unsure", at };
  }
  const business = signal === "business";
  return {
    harvestNow: true,
    smeBorrower: business ? 3 : lead.hasCharges ? 2 : 1,
    skipClass: business ? "charge_sme" : "unsure",
    at,
  };
}

async function rankWithTimeout(
  lead: CrmHarvestLead,
  rank: (lead: CrmHarvestLead) => Promise<HarvestRank>,
  ms: number,
  fallback: HarvestRank,
): Promise<HarvestRank> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      rank(lead),
      new Promise<HarvestRank>((_, reject) => {
        timer = setTimeout(() => reject(new Error("jev-timeout")), ms);
      }),
    ]);
  } catch {
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function persistRank(row: CrmHarvestRow, rank: HarvestRank, at: string): CrmHarvestRow {
  return {
    ...row,
    skipClass: rank.skipClass,
    harvestNow: rank.harvestNow,
    smeBorrower: rank.smeBorrower,
    rankedAt: rank.at || at,
  };
}

export async function harvestCrmLeads(opts: {
  leads: CrmHarvestLead[];
  deps: AttachDeps;
  budget?: AttachBudget;
  now?: Date;
  limit?: number;
  skipEmails?: Set<string>;
  store?: CrmHarvestStore;
  rank?: (lead: CrmHarvestLead) => Promise<HarvestRank>;
  rankTimeoutMs?: number;
  costCache?: LenderCostCache;
  updateLead: (id: number, patch: Record<string, unknown>) => Promise<unknown>;
  createDeal?: (deal: Record<string, unknown>) => Promise<unknown>;
}): Promise<{ attempted: number; updated: number }> {
  const now = opts.now || new Date();
  const rankedAt = now.toISOString();
  const store = opts.store || fileCrmHarvestStore();
  const skipEmails = opts.skipEmails || new Set<string>();
  const limit = opts.limit ?? HARVEST_PER_HOUR;
  let budget = opts.budget || { ch: 800, places: 400, firecrawl: 400, smtp: 150 };
  let attempted = 0;
  let updated = 0;

  const queued: Array<{ lead: CrmHarvestLead; state: CrmHarvestRow; rank: HarvestRank }> = [];
  const pending: Array<{ lead: CrmHarvestLead; state: CrmHarvestRow }> = [];
  for (const lead of opts.leads) {
    const state = store.read(lead.id);
    if (!isCrmHarvestCandidate(lead, { now, attempts: state.attempts, waitUntil: state.waitUntil })) continue;
    const cached = rankFromRow(state);
    if (cached) {
      if (isHarvestSkipClass(cached.skipClass)) continue;
      queued.push({ lead, state, rank: cached });
      continue;
    }
    const obvious = obviousSkipClass(lead);
    if (obvious) {
      store.write(lead.id, persistRank(state, { harvestNow: false, smeBorrower: 0, skipClass: obvious, at: rankedAt }, rankedAt));
      continue;
    }
    if (!opts.rank) continue;
    pending.push({ lead, state });
  }
  pending.sort((a, b) => Number(b.lead.hasCharges) - Number(a.lead.hasCharges) || a.lead.id - b.lead.id);
  const jevCap = opts.rank ? Math.min(20, Math.max(limit, 10)) : 0;
  const rankTimeoutMs = opts.rankTimeoutMs ?? 2500;
  let skipJev = false;
  for (let i = 0; i < pending.length; i++) {
    const { lead, state } = pending[i];
    let rank: HarvestRank;
    let nextState = state;
    if (opts.rank && i < jevCap && !skipJev) {
      const t0 = Date.now();
      rank = await rankWithTimeout(lead, opts.rank, rankTimeoutMs, syntheticRank(lead, rankedAt));
      if (Date.now() - t0 >= rankTimeoutMs) {
        skipJev = true;
        console.warn("[Jev] rank timed out; finishing this harvest pass without more Jev calls");
      }
      nextState = persistRank(state, rank, rankedAt);
      store.write(lead.id, nextState);
    } else {
      rank = syntheticRank(lead, rankedAt);
    }
    if (isHarvestSkipClass(rank.skipClass)) continue;
    queued.push({ lead, state: nextState, rank });
  }
  const costCache = opts.costCache || loadLenderCostCache();
  queued.sort((a, b) => compareHarvestRank({ lead: a.lead, rank: a.rank }, { lead: b.lead, rank: b.rank }, costCache));

  for (const { lead, state } of queued) {
    if (attempted >= limit) break;
    attempted += 1;
    const { dealPatch, budget: next } = await attachOne(
      {
        id: lead.id,
        source: "distress_scan",
        hopper: lead.bounced ? "hunt_contact" : "gated",
        companyName: lead.companyName,
        companyNumber: String(lead.companyNumber || ""),
        website: lead.website || undefined,
        phone: lead.phone || undefined,
        contactName: lead.contactName || undefined,
        directorNames: state.directorNames || [],
        email: lead.bounced ? undefined : lead.email || undefined,
        attachAttempts: state.attempts,
        events: [],
      } as any,
      opts.deps,
      budget,
      now,
      skipEmails,
    );
    budget = next;
    const directorNames = dealPatch.directorNames || state.directorNames || [];
    const miss = dealPatch.hopper !== "sendable";
    const attempts = miss ? (state.attempts || 0) + 1 : state.attempts || 0;
    const waitUntil = miss ? new Date(now.getTime() + HARVEST_RETRY_MS).toISOString() : undefined;
    store.write(lead.id, { ...state, attempts, waitUntil, directorNames });
    const patch = applyHarvestToCrmLead(lead, {
      email: dealPatch.email,
      contactName: dealPatch.contactName,
      directorNames,
      website: dealPatch.website,
      phone: dealPatch.phone,
    });
    if (!patch.changed) continue;
    await opts.updateLead(lead.id, {
      email: patch.email,
      contactName: patch.contactName,
      contacts: patch.contacts,
      ...(patch.website ? { website: patch.website } : {}),
      ...(patch.phone ? { phone: patch.phone } : {}),
    });
    updated += 1;
  }
  return { attempted, updated };
}

export async function cacheCrmHarvestRanks(opts: {
  leads: CrmHarvestLead[];
  store?: CrmHarvestStore;
  rank: (lead: CrmHarvestLead) => Promise<HarvestRank>;
  now?: Date;
  limit?: number;
}): Promise<{ obvious: number; jev: number; already: number }> {
  const now = (opts.now || new Date()).toISOString();
  const store = opts.store || fileCrmHarvestStore();
  const limit = opts.limit ?? Number.POSITIVE_INFINITY;
  let obvious = 0;
  let jev = 0;
  let already = 0;
  const leads = [...opts.leads].sort((a, b) => b.id - a.id);
  for (const lead of leads) {
    if (!isCrmHarvestCandidate(lead)) continue;
    const state = store.read(lead.id);
    if (rankFromRow(state)) {
      already += 1;
      continue;
    }
    const skip = obviousSkipClass(lead);
    if (skip) {
      store.write(lead.id, persistRank(state, { harvestNow: false, smeBorrower: 0, skipClass: skip, at: now }, now));
      obvious += 1;
      continue;
    }
    if (jev >= limit) continue;
    const ranked = await opts.rank(lead);
    store.write(lead.id, persistRank(state, ranked, now));
    jev += 1;
  }
  return { obvious, jev, already };
}

let crmHarvestBusy = false;

export async function harvestClientsMailboxes(): Promise<{ attempted: number; updated: number }> {
  if (crmHarvestBusy) return { attempted: 0, updated: 0 };
  crmHarvestBusy = true;
  try {
    const [leads, recipients] = await Promise.all([
      storage.listInternalLeads(),
      storage.listAllCampaignRecipients(),
    ]);
    const suppression = loadSuppression();
    const annotated = annotateCrmLeads(leads, {
      mail: listAgentMail(AGENT_MAIL_KEEP),
      recipients,
      suppression,
    });
    const skipEmails = new Set(
      suppression.filter((row) => isHardBounceReason(row.reason)).map((row) => String(row.email || "").trim().toLowerCase()).filter(Boolean),
    );
    const deps = liveAttachDeps();
    deps.guessPaused = false;
    return harvestCrmLeads({
      leads: annotated,
      deps,
      skipEmails,
      updateLead: (id, patch) => storage.updateInternalLead(id, patch),
    });
  } finally {
    flushCrmHarvestStore();
    crmHarvestBusy = false;
  }
}
