import crypto from "crypto";
import fs from "fs";
import path from "path";
import { storage } from "../storage";
import { searchCompanies, companiesHouseClient, chFetch } from "../utils/companiesHouseClient";
import { sendEmail } from "./email";
import { applyOutreachTemplateOverride, renderCallForDeal, renderOutreachEmail, type OutreachTemplateOverride } from "@shared/strataOutreach";
import { coldEmailBlockedReason } from "@shared/pecrSend";
import { cadenceAfterOutreach, wasEmailDelivered } from "@shared/outreachSend";
import { buildSfp, type StandardFinancialProfile } from "@shared/sfp";
import { evaluateSterlingCompleteness, namedPackGaps } from "@shared/sterlingCompleteness";
import { ensureSterlingHandoff } from "./sterlingHandoff";
import {
  assessIntroducerFit,
  dealStream,
  excludedSectorReason,
  isBrokerProspect,
  nextCadenceStep,
  type CadenceStep,
  type SalesStream,
} from "@shared/salesOs";
import {
  assessStrataFit,
  incorporatedToCutoff,
  MIN_FIT_SCORE,
  rejectBeforeCharges,
  type StrataFitResult,
} from "./strataFit";
import {
  DEFAULT_ATTACH_BUDGET,
  GATED_SME_HUNT_HOLD,
  attachOne,
  isExcludedFromSmeHunt,
  liveAttachDeps,
  refillSendableHopper,
  shouldEnterSmeHunt,
  shouldSendOutreachAfterSmeHunt,
  type ChargeLike,
} from "./smeLeadHopper";
import { isSendableContact, isSmeHopperSendable, rankSendable } from "@shared/smeHopper";
import { assessBbbEligibility, bbbBlockMessage, type BbbAssessment } from "@shared/bbbEligibility";
import { mailboxForAgent, inboundMailbox } from "@shared/agentMailboxes";
import { listLeadFinderCandidates } from "./leadFinderPool";
import { isDistressHuntRow } from "./huntCandidates";
import { harvestHmrcPetitions } from "./signalHarvest";
import { toDealPetition, type HmrcMarker } from "@shared/distressSignals";
import { searchIntroducerDirectory } from "./introducerDirectory";
import {
  cadenceRetryIndex,
  introducerPipelineStatus,
  packMissingDisposition,
  shouldReprocessPack,
  tickKindForDeal,
  type AgenticCompanyCandidate,
  type AgenticDealFile,
  type AgenticEvent,
  type AgenticSource,
  type AgenticStage,
} from "@shared/agenticWorkflow";
import {
  introducerWorkPaused,
  isWaitingSmeEmailApproval,
  mergeSmeCandidatePools,
  pickSmeHopperOrLegacy,
  remainingSmeFirstTouchSlots,
  smeApprovalReason,
  smeEmailNeedsApproval,
  shouldProcessAgenticTick,
  SME_DAILY_FIRST_TOUCH_CAP,
  type SmeOutreachCandidate,
} from "@shared/smeOutreach";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
export const DISTRESS_SCAN_LIMIT = 25;
export const GAZETTE_HMRC_LIMIT = 40;
export const INTRODUCER_SCAN_LIMIT = 40;

function daysMs(days: number) {
  return days * 24 * 60 * 60 * 1000;
}

const PLACES_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";

function nowIso() {
  return new Date().toISOString();
}

function addEvent(deal: AgenticDealFile, stage: AgenticStage, message: string, agent?: string): AgenticEvent[] {
  return [...(deal.events || []), { at: nowIso(), stage, agent, message }];
}

function sfpFromDeal(deal: AgenticDealFile, extracted?: StandardFinancialProfile["figures"]): StandardFinancialProfile {
  return buildSfp({
    documents: [
      ...(deal.packDocuments || []),
      ...((deal as any).pipelineDocuments || []),
    ],
    fundingReason: deal.fundingReason,
    companyNumber: deal.companyNumber,
    extracted: extracted || deal.sfp?.figures,
  });
}

function normName(value: string): string {
  return value
    .toLowerCase()
    .replace(/limited|ltd|plc|llp|llc/g, "")
    .replace(/[^a-z0-9]/g, "");
}

async function resolveOwnerUserId(): Promise<string> {
  const users = await storage.getAllUsers();
  const shaun = users.find((user) => (user.email || "").toLowerCase() === "shaun@veltro.co.uk");
  if (shaun) return shaun.id;
  const admin = users.find((user) => user.role === "super_admin");
  if (admin) return admin.id;
  if (users[0]) return users[0].id;
  throw new Error("No owner user available for agentic workflow");
}

function pickCompany(query: string, results: AgenticCompanyCandidate[]): AgenticCompanyCandidate | null {
  const active = results.filter((item) => (item.companyStatus || "").toLowerCase() === "active");
  const pool = active.length ? active : results;
  if (pool.length === 0) return null;
  const target = normName(query);
  const exact = pool.find((item) => normName(item.companyName) === target);
  if (exact) return exact;
  if (pool.length === 1) return pool[0];
  return null;
}

async function searchPlaces(companyName: string, address?: string) {
  const key = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const query = [companyName, address].filter(Boolean).join(" ");
  const response = await fetch(`${PLACES_URL}?query=${encodeURIComponent(query)}&key=${key}`);
  if (!response.ok) return null;
  const data = await response.json();
  const top = data.results?.[0];
  if (!top) return null;

  let phone: string | undefined;
  let website: string | undefined;
  if (top.place_id) {
    try {
      const detailsRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(top.place_id)}&fields=formatted_phone_number,international_phone_number,website&key=${key}`
      );
      const details = detailsRes.ok ? await detailsRes.json() : null;
      const result = details?.result;
      phone = result?.international_phone_number || result?.formatted_phone_number;
      website = result?.website;
    } catch {
      // details are optional
    }
  }

  return {
    placeName: top.name as string,
    placeAddress: top.formatted_address as string,
    placeId: top.place_id as string,
    businessStatus: top.business_status as string | undefined,
    phone,
    website,
  };
}

function missingContact(deal: Pick<AgenticDealFile, "email" | "phone">): boolean {
  return !deal.email || !deal.phone;
}

async function withUploadToken(deal: AgenticDealFile): Promise<AgenticDealFile> {
  if (deal.uploadToken) return deal;
  return storage.updateAgenticDeal(deal.id, {
    uploadToken: crypto.randomBytes(24).toString("base64url"),
  }) as Promise<AgenticDealFile>;
}

async function upsertIntroducerLead(deal: AgenticDealFile, registeredAddress?: string) {
  const companyNumber = deal.companyNumber || `WEB-${deal.id}`;
  const existing = deal.companyNumber
    ? await storage.getBrokerLeadByCompanyNumber(deal.companyNumber)
    : undefined;
  const nextStatus = introducerPipelineStatus({
    hasContact: Boolean(deal.email || deal.phone),
    outreachTouch: deal.outreachTouch,
    stage: deal.stage,
  });
  const status = nextStatus === "none" ? "new" : nextStatus;
  if (!existing) {
    await storage.createBrokerLead({
      companyName: deal.companyName,
      companyNumber,
      contactName: deal.contactName,
      email: deal.email,
      phone: deal.phone,
      status,
      address: registeredAddress || deal.placeAddress || undefined,
      notes: `Found by Refer Agent (deal #${deal.id}). Source: ${deal.source}.`,
      commissionRate: 0.1,
      hasCharges: false,
      totalChargesCount: 0,
      satisfiedChargesCount: 0,
      contacts: [],
      possibleDuplicate: false,
    });
    return;
  }
  const rank: Record<string, number> = { new: 0, contacted: 1, approved: 2 };
  const bumped = (rank[existing.status] ?? 0) < (rank[status] ?? 0) ? status : existing.status;
  await storage.updateBrokerLead(existing.id, {
    contactName: deal.contactName || existing.contactName,
    email: deal.email || existing.email,
    phone: deal.phone || existing.phone,
    status: bumped,
  });
}

async function markIntroducerStatus(deal: AgenticDealFile, status: "new" | "contacted" | "approved") {
  if (!deal.companyNumber) return;
  const existing = await storage.getBrokerLeadByCompanyNumber(deal.companyNumber);
  if (!existing) return;
  const rank: Record<string, number> = { new: 0, contacted: 1, approved: 2 };
  if ((rank[existing.status] ?? 0) >= rank[status]) return;
  await storage.updateBrokerLead(existing.id, { status });
}

export type DistressHuntResult = {
  deals: AgenticDealFile[];
  scanned: number;
  rejected: Record<string, number>;
};

const CH_COOLDOWN_PATH = path.resolve(process.cwd(), "uploads", "ch_cooldown.json");
const CH_COOLDOWN_MS = 6 * 60 * 1000;

function setChCooldown(ms = CH_COOLDOWN_MS) {
  const until = new Date(Date.now() + ms).toISOString();
  const dir = path.dirname(CH_COOLDOWN_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CH_COOLDOWN_PATH, JSON.stringify({ until }));
  return until;
}

function chCooldownUntil(): string | null {
  try {
    if (!fs.existsSync(CH_COOLDOWN_PATH)) return null;
    const until = JSON.parse(fs.readFileSync(CH_COOLDOWN_PATH, "utf8")).until as string;
    if (!until || new Date(until).getTime() <= Date.now()) return null;
    return until;
  } catch {
    return null;
  }
}

async function chJson(urlPath: string): Promise<{ ok: boolean; status: number; data: any }> {
  if (chCooldownUntil()) {
    return { ok: false, status: 429, data: null };
  }
  const first = await chFetch(urlPath);
  if (first.status === 429) {
    setChCooldown();
    return { ok: false, status: 429, data: null };
  }
  const data = first.ok ? await first.json() : null;
  return { ok: first.ok, status: first.status, data };
}

function bumpReject(rejected: Record<string, number>, reason: string) {
  rejected[reason] = (rejected[reason] || 0) + 1;
}

function newestChargeCreatedOn(charges?: ChargeLike[]): string | undefined {
  let best: string | undefined;
  let bestTs = Number.NEGATIVE_INFINITY;
  for (const charge of charges || []) {
    if (!charge.createdOn) continue;
    const ts = Date.parse(charge.createdOn);
    if (Number.isFinite(ts) && ts >= bestTs) {
      bestTs = ts;
      best = charge.createdOn;
    }
  }
  return best;
}

function smeHuntFitSummary(liveNonBankChargeCount: number, hasPetition?: boolean): string {
  if (hasPetition && liveNonBankChargeCount >= 1) {
    return `P0 hunt: HMRC petition and ${liveNonBankChargeCount} live non-bank charge${liveNonBankChargeCount === 1 ? "" : "s"}`;
  }
  if (hasPetition) return "P0 hunt: HMRC petition";
  return `P0 hunt: ${liveNonBankChargeCount} live non-bank charge${liveNonBankChargeCount === 1 ? "" : "s"}`;
}

async function holdOpenedGatedSme(deal: AgenticDealFile, address?: string): Promise<AgenticDealFile> {
  if (shouldSendOutreachAfterSmeHunt(deal)) {
    throw new Error("holdOpenedGatedSme is only for gated SME hunt files");
  }
  return storage.updateAgenticDeal(deal.id, {
    ...GATED_SME_HUNT_HOLD,
    waitUntil: undefined,
    ...(address ? { placeAddress: deal.placeAddress || address } : {}),
  }) as Promise<AgenticDealFile>;
}

function withHopperRank(deal: AgenticDealFile): AgenticDealFile & { hasPetition: boolean; hearingAt?: string } {
  return {
    ...deal,
    hasPetition: Boolean(deal.petition),
    hearingAt: deal.petition?.hearingAt,
  };
}

function toSmeOutreachCandidate(deal: AgenticDealFile): SmeOutreachCandidate {
  return {
    companyName: deal.companyName,
    companyNumber: String(deal.companyNumber || ""),
    email: deal.email,
    phone: deal.phone,
    contactName: deal.contactName,
    website: deal.website,
    address: deal.placeAddress,
    hmrc: Boolean(deal.petition),
    incorporationDate: deal.incorporatedAt,
  };
}

function isSmeHuntContactRetry(deal: Pick<AgenticDealFile, "hopper" | "source">): boolean {
  return deal.hopper === "hunt_contact" && deal.source !== "strata_inbound";
}

async function applySendableHopperPatches(
  opened: AgenticDealFile[]
): Promise<AgenticDealFile[]> {
  const latest = await storage.listAgenticDeals();
  const { patches } = await refillSendableHopper({ deals: latest, deps: liveAttachDeps() });
  const next = [...opened];
  for (const { id, patch } of patches) {
    const updated = await storage.updateAgenticDeal(id, patch);
    const idx = next.findIndex((deal) => deal.id === id);
    if (idx >= 0) next[idx] = updated;
  }
  return next;
}

async function loadBookedCompanyNumbers(ownerUserId: string): Promise<Set<string>> {
  const numbers = new Set<string>();
  const prospects = await storage.listProspects(ownerUserId);
  for (const row of prospects) {
    const number = (row as any).company?.companyNumber;
    if (number) numbers.add(String(number));
  }
  // Discovery dumps in internal_leads are not the book. Only live inbound /
  // converted files count, so the hunter can still promote a high-fit company
  // that was scraped years ago and never worked.
  const inbound = await storage.listInternalLeads();
  for (const lead of inbound) {
    const status = String(lead.status || "").toLowerCase();
    const worked = status === "converted" || status === "application_submitted";
    const companyNumber = String(lead.companyNumber || "");
    if (worked && companyNumber && !companyNumber.startsWith("WEB-")) {
      numbers.add(companyNumber);
    }
  }
  return numbers;
}

function loanAmountGbp(deal: AgenticDealFile): number | undefined {
  if (deal.loanAmount == null) return undefined;
  return deal.loanAmount > 100000 ? deal.loanAmount / 100 : deal.loanAmount;
}

async function persistBbbOnProspect(deal: AgenticDealFile, assessment: BbbAssessment) {
  if (!deal.prospectId) return;
  try {
    const existing = await storage.getDueDiligence(deal.prospectId, deal.ownerUserId);
    const data = (existing?.data || {}) as any;
    await storage.upsertDueDiligence(deal.prospectId, deal.ownerUserId, {
      ...data,
      underwriting: {
        ...(data.underwriting || {}),
        eligibility: {
          answers: Object.fromEntries(
            Object.entries(assessment.answers).filter(([, value]) => typeof value === "boolean")
          ),
          isEligible: assessment.isEligible,
          ineligibilityReasons: assessment.reasons,
        },
      },
    });
  } catch (error: any) {
    console.warn("[Agentic] Could not persist BBB eligibility on prospect:", error?.message || error);
  }
}

async function persistSfpOnProspect(deal: AgenticDealFile, sfp: StandardFinancialProfile) {
  if (!deal.prospectId) return;
  try {
    const existing = await storage.getDueDiligence(deal.prospectId, deal.ownerUserId);
    const data = (existing?.data || {}) as any;
    await storage.upsertDueDiligence(deal.prospectId, deal.ownerUserId, {
      ...data,
      underwriting: {
        ...(data.underwriting || {}),
        sfp,
      },
    });
  } catch (error: any) {
    console.warn("[Agentic] Could not persist SFP on prospect:", error?.message || error);
  }
}

function bbbFromProfile(
  deal: AgenticDealFile,
  extras?: { sicCodes?: string[]; address?: string; companyStatus?: string; companyStatusDetail?: string; turnoverGbp?: number }
): BbbAssessment {
  return assessBbbEligibility({
    answers: deal.bbbEligibility?.answers,
    companyStatus: extras?.companyStatus,
    companyStatusDetail: extras?.companyStatusDetail,
    sicCodes: extras?.sicCodes,
    address: extras?.address || deal.placeAddress,
    turnoverGbp: extras?.turnoverGbp,
    loanAmountGbp: loanAmountGbp(deal),
  });
}

async function assessCompanyFit(item: any, booked: Set<string>): Promise<StrataFitResult & { charges: ChargeLike[] }> {
  const companyName = item.company_name || "";
  const companyNumber = item.company_number || "";
  const sicCodes = item.sic_codes || [];
  const early = rejectBeforeCharges({
    companyName,
    companyNumber,
    companyStatus: item.company_status,
    companyStatusDetail: item.company_status_detail,
    dateOfCreation: item.date_of_creation,
    sicCodes,
    alreadyOnBook: booked.has(companyNumber),
  });
  if (early) {
    return {
      pass: false,
      score: 0,
      rejectReason: early,
      reasons: [],
      summary: early,
      lenders: [],
      charges: [],
    };
  }

  let charges: any[] = [];
  try {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const result = await chJson(`/company/${companyNumber}/charges`);
    if (result.status === 429) {
      return {
        pass: false,
        score: 0,
        rejectReason: "Companies House rate limit — wait a few minutes and hunt again",
        reasons: [],
        summary: "Companies House rate limit",
        lenders: [],
        charges: [],
      };
    }
    if (result.ok) charges = result.data?.items || [];
  } catch {
    charges = [];
  }

  const mapped: ChargeLike[] = charges.map((charge) => ({
    status: charge.status,
    createdOn: charge.created_on,
    personsEntitled: (charge.persons_entitled || []).map((person: any) => person.name || "").filter(Boolean),
  }));

  return {
    ...assessStrataFit({
      companyName,
      companyNumber,
      companyStatus: item.company_status,
      companyStatusDetail: item.company_status_detail,
      dateOfCreation: item.date_of_creation,
      sicCodes,
      alreadyOnBook: false,
      charges: mapped,
    }),
    charges: mapped,
  };
}

async function findMissingContact(deal: AgenticDealFile): Promise<Partial<AgenticDealFile>> {
  const found: Partial<AgenticDealFile> = {};
  const website = deal.website;

  if (deal.companyNumber) {
    try {
      const { findContacts } = await import("./contactFinderService");
      const contacts = await findContacts({
        companyName: deal.companyName,
        companyNumber: deal.companyNumber,
        website: website || null,
        contactName: deal.contactName || null,
        email: deal.email || null,
        phone: deal.phone || null,
      } as any);

      const best = contacts.find((contact) => contact.email || contact.phone) || contacts[0];
      if (best) {
        if (!deal.contactName && best.name) found.contactName = best.name;
        if (!deal.email && best.email) found.email = best.email;
        if (!deal.phone && best.phone) found.phone = best.phone;
      }

      if (!found.email) {
        const generic = contacts.find((contact) => contact.email)?.email;
        if (generic) found.email = generic;
      }
    } catch (error: any) {
      console.warn("[Agentic] Contact finder failed:", error?.message || error);
    }
  }

  if (!found.email && website) {
    try {
      const { findEmail } = await import("../utils/scraperUtils");
      const emailResult = await findEmail(website, deal.contactName || found.contactName || null);
      if (emailResult?.email) found.email = emailResult.email;
    } catch (error: any) {
      console.warn("[Agentic] Email scrape failed:", error?.message || error);
    }
  }

  return found;
}

export const agenticWorkflow = {
  async startFromInbound(internalLeadId: number, extras?: { loanAmount?: number; prospectId?: number }): Promise<AgenticDealFile> {
    const existing = (await storage.listAgenticDeals()).find((deal) => deal.internalLeadId === internalLeadId);
    if (existing) return existing;

    const lead = await storage.getInternalLead(internalLeadId);
    if (!lead) throw new Error("Inbound lead not found");

    const ownerUserId = await resolveOwnerUserId();
    const deal = await storage.createAgenticDeal({
      source: "strata_inbound" as AgenticSource,
      stream: "inbound",
      stage: extras?.prospectId ? "pipeline" : "ingest",
      status: "running",
      ownerUserId,
      internalLeadId,
      prospectId: extras?.prospectId,
      companyName: lead.companyName,
      contactName: lead.contactName || undefined,
      email: lead.email || undefined,
      phone: lead.phone || undefined,
      loanAmount: extras?.loanAmount ?? (lead.estimatedValue ? Number(lead.estimatedValue) * 100 : undefined),
      events: [{ at: nowIso(), stage: "ingest", agent: "inbound-intake", message: `Inbound from stratafinance.co.uk: ${lead.companyName}` }],
    });

    return this.runIngest(deal);
  },

  /**
   * streamFilter narrows this hunt to one desk's job: "sme" is the Client Agent
   * (Daniel Crowe) — direct borrowers only. "introducer" is the Refer Agent (Tom
   * Brennan) — accountants/CFOs/turnaround advisers only, never a direct lead.
   * Omitted, it runs both (used by the unscoped manual scan endpoint).
   */
  async startFromDistressScan(limit = DISTRESS_SCAN_LIMIT, streamFilter?: "sme" | "introducer"): Promise<DistressHuntResult> {
    if (streamFilter === "introducer" && introducerWorkPaused()) {
      return { deals: [], scanned: 0, rejected: { "introducer outreach paused": 1 } };
    }
    const wantsSme = streamFilter !== "introducer";
    const wantsIntroducer = streamFilter !== "sme" && !introducerWorkPaused();
    const opened: AgenticDealFile[] = [];
    const rejected: Record<string, number> = {};
    let chargeOpened = 0;
    const existing = await storage.listAgenticDeals();
    const seen = new Set(existing.map((deal) => deal.companyNumber).filter(Boolean));
    const ownerUserId = await resolveOwnerUserId();
    const booked = await loadBookedCompanyNumbers(ownerUserId);
    const inboundNumbers = new Set(
      existing
        .filter((deal) => deal.source === "strata_inbound" && deal.companyNumber)
        .map((deal) => String(deal.companyNumber))
    );
    const inboundEmails = new Set(
      existing
        .filter((deal) => deal.source === "strata_inbound")
        .map((deal) => String(deal.email || "").trim().toLowerCase())
        .filter(Boolean)
    );
    let scanned = 0;

    const gazetteByNumber = new Map<string, HmrcMarker>();
    try {
      const petitions = await harvestHmrcPetitions({ days: 21, limit: 30 });
      for (const marker of petitions) {
        if (!marker.companyNumber) continue;
        gazetteByNumber.set(marker.companyNumber, marker);
        // HMRC petitions are always a direct-SME distress signal, never an introducer one.
        if (!wantsSme) continue;
        if (opened.length >= GAZETTE_HMRC_LIMIT) continue;
        if (seen.has(marker.companyNumber) || booked.has(marker.companyNumber)) continue;
        if (
          isExcludedFromSmeHunt(
            { source: "distress_scan", companyNumber: marker.companyNumber },
            booked,
            inboundNumbers,
            inboundEmails
          )
        ) {
          continue;
        }
        seen.add(marker.companyNumber);
        scanned += 1;

        let profile: any = null;
        if (!chCooldownUntil()) {
          const result = await chJson(`/company/${marker.companyNumber}`);
          if (result.status === 429) {
            setChCooldown();
          } else if (result.ok) {
            profile = result.data;
          }
        }

        const companyName = marker.companyName || profile?.company_name || marker.companyNumber;
        const hunt = shouldEnterSmeHunt({
          companyName,
          companyNumber: marker.companyNumber,
          companyStatus: profile?.company_status || "active",
          companyStatusDetail: profile?.company_status_detail,
          dateOfCreation: profile?.date_of_creation,
          sicCodes: profile?.sic_codes || [],
          alreadyOnBook: booked.has(marker.companyNumber),
          charges: [],
          hasPetition: true,
        });
        if (!hunt.ok) {
          bumpReject(rejected, hunt.reason || "HMRC petition did not meet Strata fit");
          continue;
        }
        const fit = assessStrataFit({
          companyName,
          companyNumber: marker.companyNumber,
          companyStatus: profile?.company_status || "active",
          companyStatusDetail: profile?.company_status_detail,
          dateOfCreation: profile?.date_of_creation,
          sicCodes: profile?.sic_codes || [],
          alreadyOnBook: false,
          charges: [],
          hmrcTtp: true,
        });
        const huntSummary = smeHuntFitSummary(hunt.liveNonBankChargeCount, true);
        const address = profile?.registered_office_address
          ? [profile.registered_office_address.address_line_1, profile.registered_office_address.locality, profile.registered_office_address.postal_code]
              .filter(Boolean)
              .join(", ")
          : undefined;
        const deal = await storage.createAgenticDeal({
          source: "distress_scan",
          stream: "sme",
          ...GATED_SME_HUNT_HOLD,
          ownerUserId,
          companyName,
          companyNumber: marker.companyNumber,
          placeAddress: address,
          fitScore: fit.pass ? fit.score : undefined,
          fitReasons: fit.pass ? fit.reasons : [huntSummary],
          fitSummary: fit.pass ? fit.summary : huntSummary,
          petition: toDealPetition(marker),
          nonBankChargeCount: hunt.liveNonBankChargeCount,
          lastSignalAt: marker.publishedAt,
          incorporatedAt: profile?.date_of_creation,
          events: [
            {
              at: nowIso(),
              stage: "ingest",
              agent: "database-builder",
              message: `SIG-02 Gazette HMRC petition: ${companyName} — ${marker.note}`,
            },
          ],
        });
        opened.push(await holdOpenedGatedSme(deal, address));
      }
    } catch (error: any) {
      console.warn("[Agentic] Gazette HMRC ingest failed:", error?.message || error);
      bumpReject(rejected, "Gazette HMRC ingest failed");
    }

    const finderPool = listLeadFinderCandidates(400);
    for (const candidate of finderPool) {
      if (chargeOpened >= limit) break;
      const companyNumber = candidate.companyNumber;
      if (seen.has(companyNumber) || booked.has(companyNumber)) continue;
      if (
        isExcludedFromSmeHunt(
          { source: "distress_scan", companyNumber, email: candidate.email },
          booked,
          inboundNumbers,
          inboundEmails
        )
      ) {
        continue;
      }
      if (
        !isDistressHuntRow({
          companyName: candidate.companyName,
          sicCodes: candidate.sicCode ? [candidate.sicCode] : [],
          lenders: candidate.lenders,
          hmrc: gazetteByNumber.has(companyNumber),
        })
      ) {
        continue;
      }
      seen.add(companyNumber);
      scanned += 1;
      const liveLenders = candidate.lenders.filter(Boolean);
      const charges = liveLenders.map((lender) => ({
        status: "outstanding",
        createdOn: candidate.lastChargeDate,
        personsEntitled: [lender],
      }));
      const hasPetition = gazetteByNumber.has(companyNumber);
      const hunt = shouldEnterSmeHunt({
        companyName: candidate.companyName,
        companyNumber,
        companyStatus: "active",
        dateOfCreation: candidate.incorporationDate,
        sicCodes: candidate.sicCode ? [candidate.sicCode] : [],
        alreadyOnBook: false,
        charges,
        hasPetition,
      });
      const fit = assessStrataFit({
        companyName: candidate.companyName,
        companyNumber,
        sicCodes: candidate.sicCode ? [candidate.sicCode] : [],
        dateOfCreation: candidate.incorporationDate,
        alreadyOnBook: false,
        hmrcTtp: hasPetition,
        charges,
      });
      if (!hunt.ok) {
        if (!wantsIntroducer) {
          bumpReject(rejected, hunt.reason || fit.rejectReason || "did not meet Strata fit");
          continue;
        }
        const intro = assessIntroducerFit({
          companyName: candidate.companyName,
          sicCodes: candidate.sicCode ? [candidate.sicCode] : [],
          dateOfCreation: candidate.incorporationDate,
          alreadyOnBook: booked.has(companyNumber),
        });
        if (!intro.pass) {
          bumpReject(rejected, hunt.reason || fit.rejectReason || intro.rejectReason || "did not meet Strata fit");
          continue;
        }
        const deal = await storage.createAgenticDeal({
          source: "distress_scan",
          stream: "introducer",
          stage: "ingest",
          status: "running",
          ownerUserId,
          companyName: candidate.companyName,
          companyNumber,
          contactName: candidate.contactName,
          email: candidate.email,
          phone: candidate.phone,
          website: candidate.website,
          fitScore: intro.score,
          fitReasons: intro.reasons,
          fitSummary: intro.summary,
          events: [
            {
              at: nowIso(),
              stage: "ingest",
              agent: "database-builder-se",
              message: `Stream B introducer from Lead Finder: ${candidate.companyName} — ${intro.reasons.join("; ")}`,
            },
          ],
        });
        opened.push(
          await this.applyCompany(deal, {
            companyName: candidate.companyName,
            companyNumber,
            companyStatus: "active",
            address: candidate.address,
          })
        );
        continue;
      }
      if (!wantsSme) continue;
      const huntSummary = smeHuntFitSummary(hunt.liveNonBankChargeCount, hasPetition);
      const petition = hasPetition ? toDealPetition(gazetteByNumber.get(companyNumber)!) : undefined;
      const deal = await storage.createAgenticDeal({
        source: "distress_scan",
        stream: "sme",
        ...GATED_SME_HUNT_HOLD,
        ownerUserId,
        companyName: candidate.companyName,
        companyNumber,
        contactName: candidate.contactName,
        email: candidate.email,
        phone: candidate.phone,
        website: candidate.website,
        placeAddress: candidate.address,
        fitScore: fit.pass ? fit.score : undefined,
        fitReasons: fit.pass ? fit.reasons : [huntSummary],
        fitSummary: fit.pass ? fit.summary : huntSummary,
        petition,
        nonBankChargeCount: hunt.liveNonBankChargeCount,
        lastSignalAt: petition?.publishedAt || candidate.lastChargeDate,
        incorporatedAt: candidate.incorporationDate,
        events: [
          {
            at: nowIso(),
            stage: "ingest",
            agent: "database-builder",
            message: fit.pass
              ? `Strata fit ${fit.score}/100 from Lead Finder: ${candidate.companyName} — ${fit.reasons.join("; ")}`
              : `${huntSummary} from Lead Finder: ${candidate.companyName}`,
          },
        ],
      });
      opened.push(await holdOpenedGatedSme(deal, candidate.address));
      chargeOpened += 1;
    }

    // The local Leads book only ever yields direct-SME candidates here — introducer
    // shaped rows are routed out of it at ingestion time, so there's nothing for the
    // Refer Agent to find in this loop.
    const localLeads = wantsSme ? await storage.listInternalLeads() : [];

    for (const lead of localLeads) {
      if (chargeOpened >= limit) break;
      const companyNumber = String(lead.companyNumber || "");
      const companyName = lead.companyName;
      if (!companyNumber || companyNumber.startsWith("WEB-") || seen.has(companyNumber)) continue;
      if (
        isExcludedFromSmeHunt(
          { source: "distress_scan", companyNumber, email: lead.email || undefined },
          booked,
          inboundNumbers,
          inboundEmails
        )
      ) {
        continue;
      }
      const lender = String(lead.identifiedLender || "").trim();
      const liveCharge = Boolean(lender) && String(lead.chargeStatus || "").toLowerCase() !== "satisfied";
      if (
        !isDistressHuntRow({
          companyName,
          sicCodes: lead.sicCode ? [String(lead.sicCode)] : [],
          lenders: liveCharge ? [lender] : [],
          hmrc: gazetteByNumber.has(companyNumber),
        })
      ) {
        continue;
      }
      seen.add(companyNumber);
      scanned += 1;
      const charges = liveCharge
        ? [{ status: "outstanding", createdOn: lead.chargeDate, personsEntitled: [lender] }]
        : [];
      const hasPetition = gazetteByNumber.has(companyNumber);
      const hunt = shouldEnterSmeHunt({
        companyName,
        companyNumber,
        companyStatus: "active",
        dateOfCreation: lead.incorporationDate,
        sicCodes: lead.sicCode ? [String(lead.sicCode)] : [],
        alreadyOnBook: booked.has(companyNumber),
        charges,
        hasPetition,
      });
      const fit = assessStrataFit({
        companyName,
        companyNumber,
        sicCodes: lead.sicCode ? [String(lead.sicCode)] : [],
        dateOfCreation: lead.incorporationDate,
        alreadyOnBook: booked.has(companyNumber),
        hmrcTtp: hasPetition,
        charges,
      });
      if (!hunt.ok) {
        bumpReject(rejected, hunt.reason || fit.rejectReason || "did not meet Strata fit");
        continue;
      }

      const huntSummary = smeHuntFitSummary(hunt.liveNonBankChargeCount, hasPetition);
      const petition = hasPetition ? toDealPetition(gazetteByNumber.get(companyNumber)!) : undefined;
      const address = [lead.address, lead.city].filter(Boolean).join(", ") || undefined;
      const deal = await storage.createAgenticDeal({
        source: "distress_scan",
        stream: "sme",
        ...GATED_SME_HUNT_HOLD,
        ownerUserId,
        companyName,
        companyNumber,
        contactName: lead.contactName || undefined,
        email: lead.email || undefined,
        phone: lead.phone || undefined,
        website: lead.website || undefined,
        placeAddress: address,
        fitScore: fit.pass ? fit.score : undefined,
        fitReasons: fit.pass ? fit.reasons : [huntSummary],
        fitSummary: fit.pass ? fit.summary : huntSummary,
        petition,
        nonBankChargeCount: hunt.liveNonBankChargeCount,
        lastSignalAt: petition?.publishedAt || lead.chargeDate,
        incorporatedAt: lead.incorporationDate,
        events: [
          {
            at: nowIso(),
            stage: "ingest",
            agent: "database-builder",
            message: fit.pass
              ? `Strata fit ${fit.score}/100 from local book: ${companyName} — ${fit.reasons.join("; ")}`
              : `${huntSummary} from local book: ${companyName}`,
          },
        ],
      });
      opened.push(await holdOpenedGatedSme(deal, address));
      chargeOpened += 1;
    }

    if (chargeOpened < limit && !chCooldownUntil()) {
      const locations = ["Leicester", "Nottingham", "Derby"];
      for (const location of locations) {
        if (chargeOpened >= limit) break;
        const params = new URLSearchParams({
          company_status: "active",
          company_type: "ltd",
          size: "25",
          start_index: "0",
          location,
          incorporated_to: incorporatedToCutoff(),
        });
        try {
          const result = await chJson(`/advanced-search/companies?${params.toString()}`);
          if (result.status === 429) {
            const until = setChCooldown();
            bumpReject(
              rejected,
              `Companies House rate limit — cooling off until ${new Date(until).toLocaleTimeString("en-GB")}`
            );
            break;
          }
          if (!result.ok) {
            bumpReject(rejected, `Companies House search failed (${result.status})`);
            continue;
          }
          for (const item of result.data?.items || []) {
            if (chargeOpened >= limit) break;
            const companyNumber = item.company_number;
            const companyName = item.company_name;
            if (!companyNumber || seen.has(companyNumber)) continue;
            if (excludedSectorReason(item.sic_codes || [], companyName) || isBrokerProspect(companyName, item.sic_codes || [])) {
              continue;
            }
            if (
              isExcludedFromSmeHunt(
                { source: "distress_scan", companyNumber },
                booked,
                inboundNumbers,
                inboundEmails
              )
            ) {
              continue;
            }
            seen.add(companyNumber);
            scanned += 1;
            const fit = await assessCompanyFit(item, booked);
            if (fit.rejectReason?.includes("rate limit")) {
              const until = setChCooldown();
              bumpReject(
                rejected,
                `Companies House rate limit — cooling off until ${new Date(until).toLocaleTimeString("en-GB")}`
              );
              let hunted = opened;
              if (wantsSme) {
                try {
                  hunted = await applySendableHopperPatches(opened);
                } catch (error: any) {
                  console.warn("[Agentic] Hopper refill failed:", error?.message || error);
                }
              }
              return { deals: hunted, scanned, rejected };
            }
            const hasPetition = gazetteByNumber.has(companyNumber);
            const hunt = shouldEnterSmeHunt({
              companyName,
              companyNumber,
              companyStatus: item.company_status,
              companyStatusDetail: item.company_status_detail,
              dateOfCreation: item.date_of_creation,
              sicCodes: item.sic_codes || [],
              alreadyOnBook: booked.has(companyNumber),
              charges: fit.charges,
              hasPetition,
            });
            if (!hunt.ok) {
              if (!wantsIntroducer) {
                bumpReject(rejected, hunt.reason || fit.rejectReason || "did not meet Strata fit");
                continue;
              }
              const intro = assessIntroducerFit({
                companyName,
                sicCodes: item.sic_codes || [],
                companyStatus: item.company_status,
                dateOfCreation: item.date_of_creation,
                alreadyOnBook: booked.has(companyNumber),
              });
              if (!intro.pass) {
                bumpReject(rejected, hunt.reason || fit.rejectReason || intro.rejectReason || "did not meet Strata fit");
                continue;
              }
              const introDeal = await storage.createAgenticDeal({
                source: "distress_scan",
                stream: "introducer",
                stage: "ingest",
                status: "running",
                ownerUserId,
                companyName,
                companyNumber,
                fitScore: intro.score,
                fitReasons: intro.reasons,
                fitSummary: intro.summary,
                events: [
                  {
                    at: nowIso(),
                    stage: "ingest",
                    agent: "database-builder-se",
                    message: `Stream B introducer: ${companyName} — ${intro.reasons.join("; ")}`,
                  },
                ],
              });
              const introAddress = item.registered_office_address
                ? [item.registered_office_address.address_line_1, item.registered_office_address.locality, item.registered_office_address.postal_code]
                    .filter(Boolean)
                    .join(", ")
                : undefined;
              opened.push(
                await this.applyCompany(introDeal, {
                  companyName,
                  companyNumber,
                  companyStatus: item.company_status,
                  address: introAddress,
                })
              );
              continue;
            }
            if (!wantsSme) continue;
            const huntSummary = smeHuntFitSummary(hunt.liveNonBankChargeCount, hasPetition);
            const petition = hasPetition ? toDealPetition(gazetteByNumber.get(companyNumber)!) : undefined;
            const address = item.registered_office_address
              ? [item.registered_office_address.address_line_1, item.registered_office_address.locality, item.registered_office_address.postal_code]
                  .filter(Boolean)
                  .join(", ")
              : undefined;
            const deal = await storage.createAgenticDeal({
              source: "distress_scan",
              stream: "sme",
              ...GATED_SME_HUNT_HOLD,
              ownerUserId,
              companyName,
              companyNumber,
              placeAddress: address,
              fitScore: fit.pass ? fit.score : undefined,
              fitReasons: fit.pass ? fit.reasons : [huntSummary],
              fitSummary: fit.pass ? fit.summary : huntSummary,
              petition,
              nonBankChargeCount: hunt.liveNonBankChargeCount,
              lastSignalAt: petition?.publishedAt || newestChargeCreatedOn(fit.charges),
              incorporatedAt: item.date_of_creation,
              events: [
                {
                  at: nowIso(),
                  stage: "ingest",
                  agent: "database-builder",
                  message: fit.pass
                    ? `Strata fit ${fit.score}/100: ${companyName} — ${fit.reasons.join("; ")}`
                    : `${huntSummary}: ${companyName}`,
                },
              ],
            });
            opened.push(await holdOpenedGatedSme(deal, address));
            chargeOpened += 1;
          }
        } catch (error) {
          console.warn(`[Agentic] Distress search failed for ${location}:`, error);
          bumpReject(rejected, `Companies House search failed for ${location}`);
        }
      }
    } else if (chCooldownUntil()) {
      bumpReject(
        rejected,
        `Companies House cooling off until ${new Date(chCooldownUntil() as string).toLocaleTimeString("en-GB")} — hunted the local book only`
      );
    }

    if (wantsIntroducer && !chCooldownUntil()) {
      try {
        const introducers = await searchIntroducerDirectory({
          limit: INTRODUCER_SCAN_LIMIT,
          skipNumbers: seen,
        });
        for (const candidate of introducers) {
          if (seen.has(candidate.companyNumber) || booked.has(candidate.companyNumber)) continue;
          seen.add(candidate.companyNumber);
          scanned += 1;
          const deal = await storage.createAgenticDeal({
            source: "distress_scan",
            stream: "introducer",
            stage: "ingest",
            status: "running",
            ownerUserId,
            companyName: candidate.companyName,
            companyNumber: candidate.companyNumber,
            fitScore: candidate.score,
            fitReasons: candidate.reasons,
            fitSummary: candidate.summary,
            events: [
              {
                at: nowIso(),
                stage: "ingest",
                agent: "database-builder-se",
                message: `Stream B ICAEW/ACCA directory: ${candidate.companyName} — ${candidate.summary}`,
              },
            ],
          });
          opened.push(
            await this.applyCompany(deal, {
              companyName: candidate.companyName,
              companyNumber: candidate.companyNumber,
              companyStatus: candidate.companyStatus || "active",
              address: candidate.address,
            })
          );
        }
      } catch (error: any) {
        console.warn("[Agentic] Introducer directory hunt failed:", error?.message || error);
        bumpReject(rejected, "Introducer directory hunt failed");
      }
    }

    let hunted = opened;
    if (wantsSme) {
      try {
        hunted = await applySendableHopperPatches(opened);
      } catch (error: any) {
        console.warn("[Agentic] Hopper refill failed:", error?.message || error);
      }
    }

    console.log(
      `[Agentic] Hunt scanned ${scanned}, opened ${hunted.length}, rejected ${JSON.stringify(rejected)}`
    );
    return { deals: hunted, scanned, rejected };
  },

  async startSmeOutreachBatch(limit = SME_DAILY_FIRST_TOUCH_CAP): Promise<DistressHuntResult> {
    const existing = await storage.listAgenticDeals();
    const remaining = remainingSmeFirstTouchSlots({ deals: existing });
    const cap = Math.min(limit, remaining);
    if (cap <= 0) {
      return { deals: [], scanned: 0, rejected: { "daily first-touch cap reached": 1 } };
    }

    const ownerUserId = await resolveOwnerUserId();
    const booked = await loadBookedCompanyNumbers(ownerUserId);
    const hopperDeals = rankSendable(existing.filter(isSmeHopperSendable).map(withHopperRank));
    const hopperCandidates = hopperDeals.map(toSmeOutreachCandidate);
    const useHopper = hopperCandidates.length > 0;

    const seenNumbers = new Set<string>();
    const seenEmails = new Set<string>();
    if (useHopper) {
      const hopperNumbers = new Set(
        hopperDeals.map((deal) => String(deal.companyNumber || "")).filter(Boolean)
      );
      for (const number of booked) {
        if (!hopperNumbers.has(String(number))) seenNumbers.add(String(number));
      }
      for (const deal of existing) {
        if (isSmeHopperSendable(deal)) continue;
        const email = String(deal.email || "").trim().toLowerCase();
        if (email) seenEmails.add(email);
      }
    } else {
      for (const value of [...existing.map((deal) => deal.companyNumber).filter(Boolean), ...booked]) {
        seenNumbers.add(String(value));
      }
      for (const deal of existing) {
        const email = String(deal.email || "").trim().toLowerCase();
        if (email) seenEmails.add(email);
      }
    }

    let legacyCandidates: SmeOutreachCandidate[] = [];
    if (!useHopper) {
      const finder: SmeOutreachCandidate[] = listLeadFinderCandidates(400).map((row) => ({
        companyName: row.companyName,
        companyNumber: row.companyNumber,
        email: row.email,
        phone: row.phone,
        contactName: row.contactName,
        website: row.website,
        address: row.address,
        sicCodes: row.sicCode ? [row.sicCode] : [],
        lenders: row.lenders,
        incorporationDate: row.incorporationDate,
      }));
      const localLeads = await storage.listInternalLeads();
      const local: SmeOutreachCandidate[] = localLeads.map((lead) => {
        const lender = String(lead.identifiedLender || "").trim();
        const liveCharge = Boolean(lender) && String(lead.chargeStatus || "").toLowerCase() !== "satisfied";
        return {
          companyName: lead.companyName,
          companyNumber: String(lead.companyNumber || ""),
          email: lead.email || undefined,
          phone: lead.phone || undefined,
          contactName: lead.contactName || undefined,
          website: lead.website || undefined,
          address: [lead.address, lead.city].filter(Boolean).join(", ") || undefined,
          sicCodes: lead.sicCode ? [String(lead.sicCode)] : [],
          lenders: liveCharge ? [lender] : [],
          incorporationDate: lead.incorporationDate || undefined,
        };
      });
      legacyCandidates = mergeSmeCandidatePools(local, finder).filter((row) =>
        isSendableContact({ email: row.email, contactName: row.contactName })
      );
    }

    const picked = pickSmeHopperOrLegacy({
      hopperCandidates,
      legacyCandidates,
      seenNumbers,
      seenEmails,
      limit: cap,
    });

    const opened: AgenticDealFile[] = [];
    const rejected: Record<string, number> = {};
    const scanned = useHopper ? hopperCandidates.length : legacyCandidates.length;
    if (picked.length < cap) {
      bumpReject(
        rejected,
        useHopper
          ? `only ${picked.length} sendable hopper contacts after filters`
          : `only ${picked.length} sendable SME contacts after filters`
      );
    }

    if (useHopper) {
      const byNumber = new Map(hopperDeals.map((deal) => [String(deal.companyNumber || ""), deal]));
      for (const row of picked) {
        const deal = byNumber.get(row.companyNumber);
        if (!deal) continue;
        const queued = await storage.updateAgenticDeal(deal.id, {
          hopper: "queued",
          events: addEvent(
            deal,
            "outreach",
            `SME first-touch queued from hopper: ${deal.companyName}`,
            "database-builder"
          ),
        });
        opened.push(await this.sendOutreach(queued));
      }
    } else {
      for (const row of picked) {
        const deal = await storage.createAgenticDeal({
          source: "distress_scan" as AgenticSource,
          stream: "sme",
          stage: "outreach",
          status: "running",
          ownerUserId,
          companyName: row.companyName,
          companyNumber: row.companyNumber,
          contactName: row.contactName,
          email: row.email,
          phone: row.phone,
          website: row.website,
          placeAddress: row.address,
          hopper: "queued",
          events: [
            {
              at: nowIso(),
              stage: "outreach",
              agent: "database-builder",
              message: `SME first-touch queued from Leads: ${row.companyName}`,
            },
          ],
        });
        opened.push(await this.sendOutreach(deal));
      }
    }

    console.log(
      `[Agentic] SME first-touch queued ${opened.length}/${cap} from ${useHopper ? "hopper" : "legacy"}, scanned ${scanned}, rejected ${JSON.stringify(rejected)}`
    );
    return { deals: opened, scanned, rejected };
  },

  async runIngest(deal: AgenticDealFile): Promise<AgenticDealFile> {
    try {
      const results = await searchCompanies(deal.companyName, 8);
      const candidates: AgenticCompanyCandidate[] = results.map((item) => ({
        companyName: item.company_name,
        companyNumber: item.company_number,
        companyStatus: item.company_status,
        address: item.address_snippet,
      }));
      const match = pickCompany(deal.companyName, candidates);

      if (!match) {
        return storage.updateAgenticDeal(deal.id, {
          stage: "company_match",
          status: "waiting_human",
          companyCandidates: candidates,
          humanReason: candidates.length
            ? "Multiple Companies House matches — pick the correct business"
            : "No Companies House match — pick or skip",
          events: addEvent(deal, "company_match", `Need a human to pick the company (${candidates.length} results)`, "inbound-intake"),
        }) as Promise<AgenticDealFile>;
      }

      return this.applyCompany(deal, match);
    } catch (error: any) {
      return storage.updateAgenticDeal(deal.id, {
        stage: "company_match",
        status: "waiting_human",
        humanReason: "Companies House search failed — pick the company manually",
        events: addEvent(deal, "company_match", `CH search failed: ${error.message}`, "inbound-intake"),
      }) as Promise<AgenticDealFile>;
    }
  },

  async applyCompany(deal: AgenticDealFile, match: AgenticCompanyCandidate): Promise<AgenticDealFile> {
    let address = match.address;
    let sicCodes: string[] = [];
    let companyStatus = match.companyStatus;
    let companyStatusDetail: string | undefined;
    try {
      const profile = await companiesHouseClient.getCompanyProfile(match.companyNumber);
      const registered = profile?.registered_office_address;
      if (registered) {
        address = [registered.address_line_1, registered.locality, registered.country, registered.postal_code]
          .filter(Boolean)
          .join(", ");
      }
      sicCodes = profile?.sic_codes || [];
      companyStatus = profile?.company_status || companyStatus;
      companyStatusDetail = profile?.company_status_detail;
    } catch {
      // profile is optional
    }

    const bbbEligibility = bbbFromProfile(deal, { sicCodes, address, companyStatus, companyStatusDetail });

    let updated = await storage.updateAgenticDeal(deal.id, {
      stage: "enrich",
      status: "running",
      companyNumber: match.companyNumber,
      companyName: match.companyName,
      bbbEligibility,
      events: addEvent(
        deal,
        "company_match",
        `Matched ${match.companyName} (${match.companyNumber}). BBB eligibility: ${bbbEligibility.status}`,
        "inbound-intake"
      ),
    });

    updated = await this.completeContact({ ...updated, placeAddress: updated.placeAddress || address });

    return this.promoteToPipeline(updated, address);
  },

  async completeContact(deal: AgenticDealFile): Promise<AgenticDealFile> {
    if (isSmeHuntContactRetry(deal)) {
      const { dealPatch } = await attachOne(deal, liveAttachDeps(), DEFAULT_ATTACH_BUDGET);
      return storage.updateAgenticDeal(deal.id, dealPatch) as Promise<AgenticDealFile>;
    }

    let working = deal;
    if (!working.website || !working.phone || !working.placeName) {
      const place = await searchPlaces(working.companyName, working.placeAddress || undefined);
      if (place) {
        working = await storage.updateAgenticDeal(working.id, {
          placeName: place.placeName,
          placeAddress: place.placeAddress,
          website: working.website || place.website,
          phone: working.phone || place.phone,
          events: addEvent(
            working,
            "enrich",
            `Places: ${place.placeName} — ${place.placeAddress}${place.phone ? ` · ${place.phone}` : ""}`,
            "contact-finder"
          ),
        });
      }
    }

    const found = await findMissingContact(working);
    const parts: string[] = [];
    if (found.contactName && found.contactName !== working.contactName) parts.push(`name ${found.contactName}`);
    if (found.email) parts.push(`email ${found.email}`);
    if (found.phone) parts.push(`phone ${found.phone}`);

    const merged = {
      contactName: found.contactName || working.contactName,
      email: found.email || working.email,
      phone: found.phone || working.phone,
      website: found.website || working.website,
    };

    if (working.internalLeadId && (found.email || found.phone || found.contactName)) {
      await storage.updateInternalLead(working.internalLeadId, {
        contactName: merged.contactName,
        email: merged.email,
        phone: merged.phone,
      });
    }

    return storage.updateAgenticDeal(working.id, {
      ...merged,
      events: addEvent(
        working,
        "enrich",
        parts.length ? `Contact finder filled: ${parts.join(", ")}` : "Contact finder ran — still missing email or phone",
        "contact-finder"
      ),
    }) as Promise<AgenticDealFile>;
  },

  async completeContactAndSync(deal: AgenticDealFile): Promise<AgenticDealFile> {
    const updated = await this.completeContact(deal);
    if (updated.prospectId && (updated.email || updated.phone || updated.contactName)) {
      const existing = await storage.listContacts(updated.prospectId, updated.ownerUserId);
      const primary = existing.find((contact) => contact.isPrimary) || existing[0];
      if (primary?.id) {
        await storage.updateContact(primary.id, updated.ownerUserId, {
          name: updated.contactName || primary.name,
          email: updated.email || primary.email,
          phone: updated.phone || primary.phone,
        });
      } else {
        await storage.createContact(
          {
            prospectId: updated.prospectId,
            name: updated.contactName || updated.companyName,
            email: updated.email || null,
            phone: updated.phone || null,
            role: "Director",
            isPrimary: 1,
          },
          updated.ownerUserId
        );
      }
    }
    return updated;
  },

  async promoteToPipeline(deal: AgenticDealFile, registeredAddress?: string): Promise<AgenticDealFile> {
    // Introducer-stream deals (accountants, CFOs, turnaround advisers the Refer Agent
    // finds) never belong in the direct-borrower pipeline — they don't carry loan
    // amounts, guarantees, or any of the fields a real customer enquiry needs.
    if (dealStream(deal.source, deal.stream) === "introducer") {
      return this.promoteToIntroducerPipeline(deal, registeredAddress);
    }

    if (deal.prospectId) {
      const existingProspect = await storage.getProspectById(deal.prospectId);
      if (existingProspect?.company?.companyNumber?.startsWith("WEB-") && deal.companyNumber && !deal.companyNumber.startsWith("WEB-")) {
        await storage.updateCompany(existingProspect.companyId, {
          companyName: deal.companyName,
          companyNumber: deal.companyNumber,
          registeredAddress: registeredAddress || deal.placeAddress || existingProspect.company.registeredAddress || "",
          companyStatus: "active",
        });
      }
      if (deal.internalLeadId) {
        await storage.updateInternalLead(deal.internalLeadId, { status: "converted" });
      }
      const promoted = await storage.updateAgenticDeal(deal.id, {
        stage: "pipeline",
        prospectId: deal.prospectId,
        events: addEvent(deal, "pipeline", `Using pipeline lead #${deal.prospectId}`, "inbound-intake"),
      });
      return this.sendOutreach(promoted);
    }

    if (!deal.companyNumber) {
      return storage.updateAgenticDeal(deal.id, {
        stage: "company_match",
        status: "waiting_human",
        humanReason: "Cannot create a pipeline lead without a company number",
      }) as Promise<AgenticDealFile>;
    }

    let company = await storage.getCompanyByNumber(deal.companyNumber);
    if (!company) {
      company = await storage.createCompany({
        companyName: deal.companyName,
        companyNumber: deal.companyNumber,
        registeredAddress: registeredAddress || deal.placeAddress || null,
        companyStatus: "active",
      });
    }

    const existing = (await storage.listProspects(deal.ownerUserId)).find((row) => row.companyId === company!.id);
    let prospectId = existing?.id;
    if (!prospectId) {
      const created = await storage.createProspect(
        {
          companyId: company.id!,
          stage: "lead",
          // Reaching this branch means dealStream() already ruled out "introducer"
          // above, so this is always a direct SME/customer lead.
          referralSource: deal.source === "strata_inbound" ? "Strata" : "Client Agent",
          notes: `Agentic workflow ${deal.id}. Source: ${deal.source}.\nContact: ${deal.contactName || "Unknown"}\nEmail: ${deal.email || "N/A"}\nPhone: ${deal.phone || "N/A"}`,
          loanAmount: deal.loanAmount ?? null,
          queueOrder: 0,
          directorsGuarantee: 0,
          commercialProperty: 0,
          homeEquity: 0,
          propertyOther: 0,
          debenture: 0,
          parentCompanyGuarantee: 0,
          collateral: 0,
          crossCompanyGuarantee: 0,
        },
        deal.ownerUserId
      );
      prospectId = created.id;
    }

    if (!prospectId) {
      throw new Error("Failed to create or locate pipeline prospect");
    }

    if (deal.contactName || deal.email || deal.phone) {
      await storage.createContact(
        {
          prospectId,
          name: deal.contactName || deal.companyName,
          email: deal.email || null,
          phone: deal.phone || null,
          role: "Director",
          isPrimary: 1,
        },
        deal.ownerUserId
      );
    }

    if (deal.internalLeadId) {
      await storage.updateInternalLead(deal.internalLeadId, { status: "converted" });
    }

    const promoted = await storage.updateAgenticDeal(deal.id, {
      stage: "pipeline",
      prospectId,
      events: addEvent(
        deal,
        "pipeline",
        `Created pipeline lead #${prospectId} marked ${deal.source === "strata_inbound" ? "Strata" : "Client Agent"}`,
        deal.source === "strata_inbound" ? "inbound-intake" : "database-builder"
      ),
    });

    return this.sendOutreach(promoted);
  },

  async promoteToIntroducerPipeline(deal: AgenticDealFile, registeredAddress?: string): Promise<AgenticDealFile> {
    // A name with no way to reach it is no use to anyone — retry Elena, never dump
    // the find, and never put it on the SME email cadence.
    if (!deal.email && !deal.phone) {
      deal = await this.completeContact(deal);
    }
    if (!deal.email && !deal.phone) {
      return storage.updateAgenticDeal(deal.id, {
        stage: "outreach",
        status: "waiting_timer",
        waitUntil: new Date(Date.now() + ONE_DAY_MS).toISOString(),
        events: addEvent(deal, "outreach", "No email or phone found — Contact Finder will retry tomorrow before this reaches the Introducer pipeline.", "contact-finder"),
      }) as Promise<AgenticDealFile>;
    }

    await upsertIntroducerLead(deal, registeredAddress);

    if (deal.internalLeadId) {
      await storage.updateInternalLead(deal.internalLeadId, { status: "converted" });
    }

    const pipeline = introducerPipelineStatus({
      hasContact: true,
      outreachTouch: deal.outreachTouch,
      stage: deal.stage,
    });
    if (pipeline === "approved" || deal.stage === "complete") {
      return deal;
    }

    const stream = dealStream(deal.source, deal.stream);
    const step = nextCadenceStep(stream, cadenceRetryIndex(deal.outreachTouch));
    if (!step) {
      return this.completeIntroducer(deal, "Cadence complete — Introducer pipeline Approved.");
    }
    return this.applyCadenceStep(deal, stream, step);
  },

  async completeIntroducer(deal: AgenticDealFile, message: string): Promise<AgenticDealFile> {
    await markIntroducerStatus(deal, "approved");
    return storage.updateAgenticDeal(deal.id, {
      stage: "complete",
      status: "complete",
      waitUntil: undefined,
      humanReason: undefined,
      events: addEvent(deal, "complete", message, "database-builder-se"),
    }) as Promise<AgenticDealFile>;
  },

  async sendOutreach(deal: AgenticDealFile): Promise<AgenticDealFile> {
    const stream = dealStream(deal.source, deal.stream);
    if (stream === "introducer") {
      if (introducerWorkPaused()) {
        return storage.updateAgenticDeal(deal.id, {
          stage: "outreach",
          status: "waiting_human",
          waitUntil: undefined,
          humanReason: "Introducer outreach is paused until further notice.",
          events: addEvent(deal, "outreach", "Held — introducer outreach paused", "database-builder-se"),
        }) as Promise<AgenticDealFile>;
      }
      return this.promoteToIntroducerPipeline(deal);
    }
    if (stream === "sme" && deal.source !== "strata_inbound" && deal.hopper && deal.hopper !== "queued") {
      if (isSmeHuntContactRetry(deal)) return this.completeContact(deal);
      return deal;
    }
    if (stream === "sme" && typeof deal.fitScore === "number" && deal.fitScore > 0 && deal.fitScore < MIN_FIT_SCORE) {
      return storage.updateAgenticDeal(deal.id, {
        stage: "failed",
        status: "failed",
        events: addEvent(
          deal,
          "failed",
          `Not emailed — fit ${deal.fitScore ?? 0}/${MIN_FIT_SCORE}. ${deal.fitSummary || "No Strata-fit evidence on file."}`,
          "database-builder"
        ),
      }) as Promise<AgenticDealFile>;
    }

    if (!deal.email) {
      const hunted = await this.completeContact(deal);
      if (!hunted.email) {
        return storage.updateAgenticDeal(hunted.id, {
          stage: "outreach",
          status: "waiting_timer",
          waitUntil: new Date(Date.now() + ONE_DAY_MS).toISOString(),
          events: addEvent(
            hunted,
            "outreach",
            "No email yet — Contact Finder will retry tomorrow.",
            "contact-finder"
          ),
        }) as Promise<AgenticDealFile>;
      }
      deal = hunted;
    }

    const step = nextCadenceStep(stream, cadenceRetryIndex(deal.outreachTouch));
    if (!step) {
      return storage.updateAgenticDeal(deal.id, {
        stage: "failed",
        status: "failed",
        events: addEvent(deal, "failed", "No cadence step available", "outreach-sales"),
      }) as Promise<AgenticDealFile>;
    }
    return this.applyCadenceStep(deal, stream, step);
  },

  async applyCadenceStep(deal: AgenticDealFile, stream: SalesStream, step: CadenceStep): Promise<AgenticDealFile> {
    deal = await withUploadToken(deal);
    const inbound = stream === "inbound";
    const agentId = inbound
      ? step.touchId === "inbound_ack"
        ? "inbound-intake"
        : "fulfilment-manager"
      : "outreach-sales";
    const mailbox = inbound ? inboundMailbox(agentId) : mailboxForAgent("outreach-sales");
    const builtInScript = renderOutreachEmail(deal, step.touchId, mailbox);
    const templateOverrides = (await storage.getSystemSetting("agent_outreach_templates")) || {};
    const script = applyOutreachTemplateOverride(
      builtInScript,
      templateOverrides[step.touchId] as OutreachTemplateOverride | undefined,
      deal,
      mailbox,
    );
    const nextTouch = (deal.outreachTouch || 0) + 1;
    const following = nextCadenceStep(stream, nextTouch);
    const isLinkedIn = step.channel === "linkedin";

    const pecrReason = coldEmailBlockedReason(deal.email, stream);
    const needsApproval = smeEmailNeedsApproval({ stream, isLinkedIn });
    let delivered = !step.autoSend || isLinkedIn;
    if (step.autoSend && !isLinkedIn && pecrReason) {
      delivered = false;
    } else if (needsApproval) {
      delivered = false;
    } else if (step.autoSend && !isLinkedIn && deal.email) {
      try {
        const sendResult = await sendEmail(
          {
            agentId,
            fromEmail: mailbox.address,
            fromName: mailbox.fromName,
            replyTo: mailbox.replyTo,
            dealId: deal.id,
            prospectId: deal.prospectId,
          },
          deal.email,
          script.subject,
          script.html
        );
        delivered = wasEmailDelivered(sendResult);
      } catch (error: any) {
        console.error("[Agentic] Outreach email failed:", error);
        delivered = false;
      }
    }

    const outcome = cadenceAfterOutreach({
      autoSend: step.autoSend,
      isLinkedIn,
      delivered,
      blockReason: step.autoSend && !isLinkedIn ? pecrReason : null,
      requireApproval: needsApproval,
      approved: false,
    });

    if (stream === "introducer" && (outcome === "advance" || outcome === "hold_linkedin") && !isLinkedIn && delivered) {
      await markIntroducerStatus(deal, "contacted");
    }

    if (outcome === "hold_pecr") {
      return storage.updateAgenticDeal(deal.id, {
        stage: "outreach",
        status: "waiting_human",
        waitUntil: undefined,
        humanReason: `Will not send cold email: ${pecrReason}`,
        events: addEvent(deal, "outreach", `Held — ${pecrReason}`, agentId),
      }) as Promise<AgenticDealFile>;
    }

    if (outcome === "hold_undelivered") {
      return storage.updateAgenticDeal(deal.id, {
        stage: "outreach",
        status: "waiting_human",
        waitUntil: undefined,
        humanReason: "Email did not send (SMTP missing or failed). Retry when mail is live.",
        events: addEvent(deal, "outreach", "Email not delivered — cadence not advanced", agentId),
      }) as Promise<AgenticDealFile>;
    }

    if (deal.prospectId) {
      await storage.createActivity(
        {
          prospectId: deal.prospectId,
          title: isLinkedIn ? `LinkedIn touch ready (${step.touchId})` : `Agent outreach ${nextTouch} sent`,
          description: `${script.subject} — ${script.purpose}`,
          activityType: isLinkedIn ? "note" : "email",
        } as any,
        deal.ownerUserId
      );
    }

    const socialPlaybook = isLinkedIn
      ? { network: "linkedin" as const, action: "Profile review then connection request", message: script.text }
      : deal.socialPlaybook;

    if (outcome === "hold_approval") {
      return storage.updateAgenticDeal(deal.id, {
        stage: "outreach",
        status: "waiting_human",
        waitUntil: undefined,
        uploadToken: deal.uploadToken,
        outreachSubject: script.subject,
        outreachBody: script.html,
        outreachTouchId: script.touchId,
        socialPlaybook,
        humanReason: smeApprovalReason(deal.email || "the mailbox"),
        events: addEvent(
          deal,
          "outreach",
          `Day ${step.day} email drafted for approval: ${script.purpose}`,
          agentId
        ),
      }) as Promise<AgenticDealFile>;
    }

    if (outcome === "hold_linkedin") {
      return storage.updateAgenticDeal(deal.id, {
        stage: "outreach",
        status: "waiting_human",
        waitUntil: undefined,
        uploadToken: deal.uploadToken,
        outreachSubject: script.subject,
        outreachBody: script.text,
        outreachTouch: nextTouch,
        outreachTouchId: script.touchId,
        socialPlaybook,
        humanReason: "Post the LinkedIn copy, then mark it posted. The next email will not send until you do.",
        events: addEvent(deal, "outreach", `Day ${step.day} LinkedIn copy staged. Waiting for you to post.`, agentId),
      }) as Promise<AgenticDealFile>;
    }

    if (step.queueCall) {
      const callPlaybook = renderCallForDeal(deal, process.env.STRATA_PHONE || process.env.STRATA_CALLBACK_NUMBER);
      const reason = inbound
        ? "They already enquired via Strata and the pack hasn't arrived — warm follow-up call"
        : stream === "introducer"
          ? "Stream B day 10 — introducer partner call"
          : "Stream A day 14 — SME close call";
      return storage.updateAgenticDeal(deal.id, {
        stage: "human_call",
        status: "waiting_human",
        waitUntil: undefined,
        uploadToken: deal.uploadToken,
        outreachSubject: script.subject,
        outreachBody: script.html,
        outreachTouch: nextTouch,
        outreachTouchId: script.touchId,
        socialPlaybook,
        callPlaybook,
        humanReason: reason,
        events: addEvent(
          deal,
          "human_call",
          `${script.purpose} Call script is on the file.`,
          agentId
        ),
      }) as Promise<AgenticDealFile>;
    }

    const waitDays = following?.delayDaysFromPrevious ?? 3;
    return storage.updateAgenticDeal(deal.id, {
      stage: "fulfilment",
      status: "waiting_timer",
      waitUntil: new Date(Date.now() + daysMs(waitDays)).toISOString(),
      uploadToken: deal.uploadToken,
      outreachSubject: script.subject,
      outreachBody: isLinkedIn ? script.text : script.html,
      outreachTouch: nextTouch,
      outreachTouchId: script.touchId,
      socialPlaybook,
      events: addEvent(
        deal,
        nextTouch === 1 ? "outreach" : "fulfilment",
        isLinkedIn
          ? `Day ${step.day} LinkedIn copy staged for ${deal.companyName}. Not emailed.`
          : `Day ${step.day} ${step.channel} to ${deal.email}: ${script.purpose}`,
        agentId
      ),
    }) as Promise<AgenticDealFile>;
  },

  async runFulfilment(deal: AgenticDealFile): Promise<AgenticDealFile> {
    const docs = deal.prospectId ? await storage.listProspectDocuments(deal.prospectId) : [];
    const packDocs = deal.packDocuments || [];
    const fileCount = packDocs.length || docs.length;
    if (
      shouldReprocessPack({
        packDocuments: packDocs,
        extraDocCount: packDocs.length ? 0 : docs.length,
        sfp: deal.sfp,
      })
    ) {
      const sfp = sfpFromDeal({
        ...deal,
        packDocuments: packDocs.length ? packDocs : docs.map((doc: any) => ({
          id: String(doc.id),
          category: doc.category,
          fileName: doc.fileName,
          fileSize: doc.fileSize || 0,
          fileType: doc.fileType || "",
          storagePath: doc.storagePath || "",
          uploadedAt: doc.uploadedAt || nowIso(),
        })),
      });
      const ready = await storage.updateAgenticDeal(deal.id, {
        sfp,
        stage: "processing",
        status: "running",
        waitUntil: undefined,
        events: addEvent(deal, "fulfilment", `${fileCount} document(s) on file — ingesting`, "fulfilment-manager"),
      });
      return this.runProcessing(ready);
    }

    if (deal.sfp?.status === "PARTIAL") {
      return this.keepChasingPack(deal);
    }

    const stream = dealStream(deal.source, deal.stream);
    const step = nextCadenceStep(stream, deal.outreachTouch || 0);
    if (!step) {
      const disposition = packMissingDisposition(deal);
      if (disposition === "approve_introducer") {
        return this.completeIntroducer(deal, "Stream B complete — Introducer pipeline Approved.");
      }
      if (disposition === "keep_chasing") {
        return this.keepChasingPack(deal);
      }
      return storage.updateAgenticDeal(deal.id, {
        stage: "fulfilment",
        status: "waiting_human",
        waitUntil: undefined,
        humanReason: "Cadence complete and the pack is still missing. Chase or stop — do not park a live opportunity.",
        events: addEvent(deal, "fulfilment", "Cadence complete. Pack missing — holding for chase, not parking.", "fulfilment-manager"),
      }) as Promise<AgenticDealFile>;
    }
    return this.applyCadenceStep(deal, stream, step);
  },

  async keepChasingPack(deal: AgenticDealFile): Promise<AgenticDealFile> {
    deal = await withUploadToken(deal);
    const mailbox = inboundMailbox("fulfilment-manager");
    const builtInScript = renderOutreachEmail(deal, "inbound_chase", mailbox);
    const templateOverrides = (await storage.getSystemSetting("agent_outreach_templates")) || {};
    const script = applyOutreachTemplateOverride(
      builtInScript,
      templateOverrides.inbound_chase as OutreachTemplateOverride | undefined,
      deal,
      mailbox,
    );
    const gaps = deal.sfp?.missing?.length ? deal.sfp.missing.join("; ") : namedPackGaps(deal).join("; ");
    if (deal.email) {
      const pecrReason = coldEmailBlockedReason(deal.email, dealStream(deal.source, deal.stream));
      if (!pecrReason) {
        try {
          await sendEmail(
            {
              agentId: "fulfilment-manager",
              fromEmail: mailbox.address,
              fromName: mailbox.fromName,
              replyTo: mailbox.replyTo,
              dealId: deal.id,
              prospectId: deal.prospectId,
            },
            deal.email,
            script.subject,
            script.html
          );
        } catch (error: any) {
          console.error("[Agentic] Pack chase email failed:", error);
        }
      }
    }
    return storage.updateAgenticDeal(deal.id, {
      stage: "fulfilment",
      status: "waiting_timer",
      waitUntil: new Date(Date.now() + daysMs(3)).toISOString(),
      humanReason: undefined,
      events: addEvent(
        deal,
        "fulfilment",
        gaps ? `Sophie chasing named gaps: ${gaps}` : "Sophie chasing the pack — file stays open.",
        "fulfilment-manager"
      ),
    }) as Promise<AgenticDealFile>;
  },

  async onPackArrived(dealId: number): Promise<AgenticDealFile | null> {
    const deal = await storage.getAgenticDeal(dealId);
    if (!deal) return null;
    const sfp = sfpFromDeal(deal);
    const gaps = namedPackGaps(deal);
    await persistSfpOnProspect(deal, sfp);
    const updated = await storage.updateAgenticDeal(deal.id, {
      sfp,
      packReceivedAt: deal.packReceivedAt || nowIso(),
      events: addEvent(
        deal,
        deal.stage,
        gaps.length
          ? `Pack updated. Still missing: ${gaps.join("; ")}`
          : "Required pack documents are on the file. Building the financial profile.",
        "inbound-intake"
      ),
    });
    if (sfp.status === "COMPLETE" || (deal.packDocuments || []).length > 0) {
      return this.runProcessing(updated);
    }
    return updated;
  },

  async runProcessing(deal: AgenticDealFile): Promise<AgenticDealFile> {
    const bbb = deal.bbbEligibility?.status === "pass"
      ? deal.bbbEligibility
      : bbbFromProfile(deal);
    if (bbb.status !== "pass") {
      await persistBbbOnProspect(deal, bbb);
      return storage.updateAgenticDeal(deal.id, {
        stage: "processing",
        status: "waiting_human",
        bbbEligibility: bbb,
        humanReason: bbbBlockMessage(bbb),
        events: addEvent(
          deal,
          "processing",
          `Application held — ${bbbBlockMessage(bbb)}`,
          "deal-processing-underwriter"
        ),
      }) as Promise<AgenticDealFile>;
    }

    const sfp = deal.sfp?.status ? deal.sfp : sfpFromDeal(deal);
    await persistSfpOnProspect(deal, sfp);
    if (sfp.status !== "COMPLETE") {
      const gaps = sfp.missing.length ? sfp.missing.join("; ") : namedPackGaps(deal).join("; ");
      return storage.updateAgenticDeal(deal.id, {
        sfp,
        stage: "fulfilment",
        status: "waiting_timer",
        waitUntil: new Date(Date.now() + daysMs(1)).toISOString(),
        processingSummary: `SFP PARTIAL. Missing: ${gaps}. Will not underwrite from the event log.`,
        humanReason: `Pack is incomplete: ${gaps}`,
        events: addEvent(
          deal,
          "processing",
          `Held — SFP PARTIAL. Sophie will chase: ${gaps}`,
          "deal-processing-underwriter"
        ),
      }) as Promise<AgenticDealFile>;
    }

    const figureLines = Object.entries(sfp.figures)
      .map(([key, figure]) => `${key}: ${figure?.value} (src: ${figure?.source})`)
      .join("\n");
    const summary = `SFP COMPLETE for ${deal.companyName}.\n${figureLines || "Sourced figures on file."}\nFunding reason: ${deal.fundingReason || "n/a"}`;

    const processed = await storage.updateAgenticDeal(deal.id, {
      sfp,
      stage: "underwriting",
      status: "running",
      processingSummary: summary,
      events: addEvent(deal, "processing", "SFP complete — writing recommendation from sourced figures", "deal-processing-underwriter"),
    });
    return this.runUnderwriting(processed);
  },

  async runUnderwriting(deal: AgenticDealFile): Promise<AgenticDealFile> {
    const sfp = deal.sfp?.status ? deal.sfp : sfpFromDeal(deal);
    if (sfp.status !== "COMPLETE") {
      return this.runProcessing({ ...deal, sfp });
    }

    const judgement =
      `Recommendation only — not a credit decision.\n` +
      `SFP COMPLETE. Director to approve before Sterling.\n` +
      (deal.processingSummary || "");

    return storage.updateAgenticDeal(deal.id, {
      stage: "human_review",
      status: "waiting_human",
      underwritingJudgement: judgement,
      humanReason: "SFP complete. Approve the recommendation, then send the pack to David at Sterling.",
      events: addEvent(deal, "human_review", "Waiting for Director credit-memo approval before Sterling.", "deal-processing-underwriter"),
    }) as Promise<AgenticDealFile>;
  },

  async selectCompany(dealId: number, companyNumber: string): Promise<AgenticDealFile> {
    const deal = await storage.getAgenticDeal(dealId);
    if (!deal) throw new Error("Deal file not found");
    const match = (deal.companyCandidates || []).find((item) => item.companyNumber === companyNumber);
    if (!match) throw new Error("That company is not in the candidate list");
    return this.applyCompany(deal, match);
  },

  async approveSmeSend(deal: AgenticDealFile, note?: string): Promise<AgenticDealFile> {
    if (!isWaitingSmeEmailApproval(deal)) {
      throw new Error("This file is not waiting for email approval");
    }
    const stream = dealStream(deal.source, deal.stream);
    const step = nextCadenceStep(stream, cadenceRetryIndex(deal.outreachTouch));
    if (!step || step.channel === "linkedin") {
      throw new Error("No email step waiting on this file");
    }
    if (!deal.email || !deal.outreachSubject || !deal.outreachBody) {
      throw new Error("Draft email is missing");
    }
    const pecrReason = coldEmailBlockedReason(deal.email, stream);
    if (pecrReason) {
      return storage.updateAgenticDeal(deal.id, {
        stage: "outreach",
        status: "waiting_human",
        humanReason: `Will not send cold email: ${pecrReason}`,
        events: addEvent(deal, "outreach", `Held — ${pecrReason}`, "outreach-sales"),
      }) as Promise<AgenticDealFile>;
    }

    const inbound = stream === "inbound";
    const agentId = inbound
      ? step.touchId === "inbound_ack"
        ? "inbound-intake"
        : "fulfilment-manager"
      : "outreach-sales";
    const mailbox = inbound ? inboundMailbox(agentId) : mailboxForAgent("outreach-sales");
    let delivered = false;
    try {
      const sendResult = await sendEmail(
        {
          agentId,
          fromEmail: mailbox.address,
          fromName: mailbox.fromName,
          replyTo: mailbox.replyTo,
          dealId: deal.id,
          prospectId: deal.prospectId,
        },
        deal.email,
        deal.outreachSubject,
        deal.outreachBody
      );
      delivered = wasEmailDelivered(sendResult);
    } catch (error: any) {
      console.error("[Agentic] Approved outreach email failed:", error);
      delivered = false;
    }
    if (!delivered) {
      return storage.updateAgenticDeal(deal.id, {
        stage: "outreach",
        status: "waiting_human",
        humanReason: "Email did not send (SMTP missing or failed). Retry when mail is live.",
        events: addEvent(deal, "outreach", "Email not delivered — cadence not advanced", agentId),
      }) as Promise<AgenticDealFile>;
    }

    const nextTouch = (deal.outreachTouch || 0) + 1;
    const following = nextCadenceStep(stream, nextTouch);
    if (deal.prospectId) {
      await storage.createActivity(
        {
          prospectId: deal.prospectId,
          title: `Agent outreach ${nextTouch} sent`,
          description: deal.outreachSubject,
          activityType: "email",
        } as any,
        deal.ownerUserId
      );
    }
    if (step.queueCall) {
      const callPlaybook = renderCallForDeal(deal, process.env.STRATA_PHONE || process.env.STRATA_CALLBACK_NUMBER);
      return storage.updateAgenticDeal(deal.id, {
        stage: "human_call",
        status: "waiting_human",
        waitUntil: undefined,
        outreachTouch: nextTouch,
        outreachTouchId: step.touchId,
        callPlaybook,
        humanReason: "Stream A day 14 — SME close call",
        events: addEvent(deal, "human_call", note || "Approved email sent. Call script is on the file.", agentId),
      }) as Promise<AgenticDealFile>;
    }
    const waitDays = following?.delayDaysFromPrevious ?? 3;
    return storage.updateAgenticDeal(deal.id, {
      stage: "fulfilment",
      status: "waiting_timer",
      waitUntil: new Date(Date.now() + daysMs(waitDays)).toISOString(),
      outreachTouch: nextTouch,
      outreachTouchId: step.touchId,
      humanReason: undefined,
      events: addEvent(
        deal,
        nextTouch === 1 ? "outreach" : "fulfilment",
        note || `Day ${step.day} email to ${deal.email}: ${step.job}`,
        agentId
      ),
    }) as Promise<AgenticDealFile>;
  },

  async approveSmeQueue(): Promise<{ sent: number; held: number; deals: AgenticDealFile[] }> {
    const waiting = (await storage.listAgenticDeals()).filter((deal) => isWaitingSmeEmailApproval(deal));
    const deals: AgenticDealFile[] = [];
    let sent = 0;
    let held = 0;
    for (const deal of waiting) {
      const updated = await this.approveSmeSend(deal);
      deals.push(updated);
      if (isWaitingSmeEmailApproval(updated) || /did not send|SMTP|PECR|personal mailbox/i.test(updated.humanReason || "")) {
        held += 1;
      } else {
        sent += 1;
      }
    }
    return { sent, held, deals };
  },

  async resolveHuman(
    dealId: number,
    action: "call_done" | "approve_sterling" | "stop" | "linkedin_posted" | "retry_send" | "approve_send",
    note?: string
  ): Promise<AgenticDealFile> {
    const deal = await storage.getAgenticDeal(dealId);
    if (!deal) throw new Error("Deal file not found");

    if (action === "approve_send") {
      return this.approveSmeSend(deal, note);
    }

    if (action === "stop") {
      return storage.updateAgenticDeal(deal.id, {
        stage: "failed",
        status: "failed",
        events: addEvent(deal, "failed", note || "Stopped by human"),
      }) as Promise<AgenticDealFile>;
    }

    if (action === "retry_send") {
      const stream = dealStream(deal.source, deal.stream);
      const cleared = { ...deal, status: "running" as const, humanReason: undefined };
      if (stream === "introducer") {
        if (introducerWorkPaused()) {
          return storage.updateAgenticDeal(deal.id, {
            stage: "outreach",
            status: "waiting_human",
            humanReason: "Introducer outreach is paused until further notice.",
            events: addEvent(deal, "outreach", "Held — introducer outreach paused", "database-builder-se"),
          }) as Promise<AgenticDealFile>;
        }
        return this.promoteToIntroducerPipeline(cleared);
      }
      const step = nextCadenceStep(stream, cadenceRetryIndex(deal.outreachTouch));
      if (!step) return this.sendOutreach(cleared);
      return this.applyCadenceStep(cleared, stream, step);
    }

    if (action === "linkedin_posted") {
      const stream = dealStream(deal.source, deal.stream);
      const step = nextCadenceStep(stream, deal.outreachTouch || 0);
      const cleared = await storage.updateAgenticDeal(deal.id, {
        humanReason: undefined,
        events: addEvent(deal, "outreach", note || "LinkedIn marked posted — continuing cadence", "outreach-sales"),
      });
      if (!step) {
        return storage.updateAgenticDeal(cleared.id, {
          stage: "fulfilment",
          status: "waiting_timer",
          waitUntil: new Date(Date.now() + daysMs(3)).toISOString(),
        }) as Promise<AgenticDealFile>;
      }
      return this.applyCadenceStep(cleared, stream, step);
    }

    if (action === "call_done") {
      const inbound = deal.source === "strata_inbound";
      const stream = dealStream(deal.source, deal.stream);
      const packDocs = deal.packDocuments || [];
      const pipelineDocs = deal.prospectId ? await storage.listProspectDocuments(deal.prospectId) : [];
      const hasPack = packDocs.length > 0 || pipelineDocs.length > 0;
      if (stream === "introducer") {
        return this.completeIntroducer(deal, note || "Partner call done — Introducer pipeline Approved.");
      }
      if (hasPack) {
        const next = await storage.updateAgenticDeal(deal.id, {
          stage: "processing",
          status: "running",
          humanReason: undefined,
          events: addEvent(deal, "human_call", note || "Call completed — ingesting the pack"),
        });
        return this.runProcessing(next);
      }
      if (inbound) {
        return this.keepChasingPack({
          ...deal,
          events: addEvent(
            deal,
            "fulfilment",
            note || "Call completed with no pack — Sophie keeps chasing. Do not underwrite an empty file."
          ),
        });
      }
      return storage.updateAgenticDeal(deal.id, {
        stage: "fulfilment",
        status: "waiting_human",
        waitUntil: undefined,
        humanReason: "Call done and the pack is still missing. Chase or stop — do not park a live opportunity.",
        events: addEvent(
          deal,
          "fulfilment",
          note || "Call completed with no pack — holding for chase, not parking."
        ),
      }) as Promise<AgenticDealFile>;
    }

    if (deal.bbbEligibility?.status !== "pass") {
      throw new Error(bbbBlockMessage(deal.bbbEligibility) || "British Business Bank eligibility must pass before Sterling.");
    }

    const gate = evaluateSterlingCompleteness({
      documents: deal.packDocuments || [],
      fundingReason: deal.fundingReason,
      companyNumber: deal.companyNumber,
      sfpStatus: deal.sfp?.status || "PARTIAL",
    });
    if (!gate.ok) {
      throw new Error(
        `File is not complete for Sterling: ${gate.missing.map((item) => item.label).join("; ")}`
      );
    }
    if (!deal.prospectId) {
      throw new Error("Open a pipeline lead before sending this file to Sterling.");
    }

    const handoff = await ensureSterlingHandoff({
      prospectId: deal.prospectId,
      userId: deal.ownerUserId,
    });
    if (!handoff.ok) {
      throw new Error(handoff.reason || "Sterling portal not configured");
    }

    return storage.updateAgenticDeal(deal.id, {
      stage: "complete",
      status: "complete",
      sterlingHandoffId: handoff.handoff?.id,
      humanReason: undefined,
      events: addEvent(
        deal,
        "complete",
        note || "Director approved. Sterling handoff opened — David can download the complete pack."
      ),
    }) as Promise<AgenticDealFile>;
  },

  async confirmBbb(dealId: number, answers: Record<string, boolean>): Promise<AgenticDealFile> {
    const deal = await storage.getAgenticDeal(dealId);
    if (!deal) throw new Error("Deal file not found");
    const assessment = assessBbbEligibility({
      answers: { ...(deal.bbbEligibility?.answers || {}), ...answers },
      address: deal.placeAddress,
      loanAmountGbp: loanAmountGbp(deal),
    });
    const updated = await storage.updateAgenticDeal(deal.id, {
      bbbEligibility: assessment,
      humanReason: assessment.status === "pass" ? undefined : bbbBlockMessage(assessment),
      events: addEvent(
        deal,
        deal.stage,
        assessment.status === "pass"
          ? "British Business Bank eligibility confirmed — application may be considered"
          : `British Business Bank eligibility ${assessment.status}: ${assessment.reasons[0] || ""}`,
        "deal-processing-underwriter"
      ),
    });
    await persistBbbOnProspect(updated, assessment);
    if (assessment.status === "pass" && (deal.stage === "processing" || deal.stage === "human_review")) {
      return this.runProcessing(updated);
    }
    if (assessment.status === "fail" && deal.stage === "processing") {
      return storage.updateAgenticDeal(updated.id, {
        stage: "failed",
        status: "failed",
        events: addEvent(updated, "failed", "Stopped — not eligible for British Business Bank funding"),
      }) as Promise<AgenticDealFile>;
    }
    return updated;
  },

  async tick(): Promise<number> {
    const due = (await storage.listAgenticDeals()).filter(
      (deal) =>
        deal.status === "waiting_timer" &&
        deal.waitUntil &&
        new Date(deal.waitUntil).getTime() <= Date.now() &&
        (isSmeHuntContactRetry(deal) || shouldProcessAgenticTick(deal))
    );
    for (const deal of due) {
      try {
        if (isSmeHuntContactRetry(deal)) {
          await this.completeContact(deal);
          continue;
        }
        const kind = tickKindForDeal(deal);
        if (kind === "fulfilment") await this.runFulfilment(deal);
        if (kind === "introducer_retry") {
          const hunted = await this.completeContact(deal);
          await this.promoteToIntroducerPipeline(hunted);
        }
        if (kind === "outreach_retry") {
          const hunted = await this.completeContact(deal);
          await this.sendOutreach(hunted);
        }
      } catch (error) {
        console.error(`[Agentic] Tick failed for deal ${deal.id}:`, error);
      }
    }
    return due.length;
  },
};
