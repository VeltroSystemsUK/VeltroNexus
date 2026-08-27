import crypto from "crypto";
import fs from "fs";
import path from "path";
import { storage } from "../storage";
import { searchCompanies, companiesHouseClient, chFetch } from "../utils/companiesHouseClient";
import { sendEmail } from "./email";
import { renderCallForDeal, renderOutreachEmail } from "@shared/strataOutreach";
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
import { assessBbbEligibility, bbbBlockMessage, type BbbAssessment } from "@shared/bbbEligibility";
import { mailboxForAgent, inboundMailbox } from "@shared/agentMailboxes";
import { listLeadFinderCandidates } from "./leadFinderPool";
import { isDistressHuntRow } from "./huntCandidates";
import { harvestHmrcPetitions } from "./signalHarvest";
import { toDealPetition, type HmrcMarker } from "@shared/distressSignals";
import { searchIntroducerDirectory } from "./introducerDirectory";
import type {
  AgenticCompanyCandidate,
  AgenticDealFile,
  AgenticEvent,
  AgenticSource,
  AgenticStage,
} from "@shared/agenticWorkflow";

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

async function assessCompanyFit(item: any, booked: Set<string>): Promise<StrataFitResult> {
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
      };
    }
    if (result.ok) charges = result.data?.items || [];
  } catch {
    charges = [];
  }

  return assessStrataFit({
    companyName,
    companyNumber,
    companyStatus: item.company_status,
    companyStatusDetail: item.company_status_detail,
    dateOfCreation: item.date_of_creation,
    sicCodes,
    alreadyOnBook: false,
    charges: charges.map((charge) => ({
      status: charge.status,
      createdOn: charge.created_on,
      personsEntitled: (charge.persons_entitled || []).map((person: any) => person.name || "").filter(Boolean),
    })),
  });
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

  async startFromDistressScan(limit = DISTRESS_SCAN_LIMIT): Promise<DistressHuntResult> {
    const opened: AgenticDealFile[] = [];
    const rejected: Record<string, number> = {};
    let chargeOpened = 0;
    const existing = await storage.listAgenticDeals();
    const seen = new Set(existing.map((deal) => deal.companyNumber).filter(Boolean));
    const ownerUserId = await resolveOwnerUserId();
    const booked = await loadBookedCompanyNumbers(ownerUserId);
    let scanned = 0;

    const gazetteByNumber = new Map<string, HmrcMarker>();
    try {
      const petitions = await harvestHmrcPetitions({ days: 21, limit: 30 });
      for (const marker of petitions) {
        if (!marker.companyNumber) continue;
        gazetteByNumber.set(marker.companyNumber, marker);
        if (opened.length >= GAZETTE_HMRC_LIMIT) continue;
        if (seen.has(marker.companyNumber) || booked.has(marker.companyNumber)) continue;
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
        if (!fit.pass) {
          bumpReject(rejected, fit.rejectReason || "HMRC petition did not meet Strata fit");
          continue;
        }
        const deal = await storage.createAgenticDeal({
          source: "distress_scan",
          stream: "sme",
          stage: "ingest",
          status: "running",
          ownerUserId,
          companyName,
          companyNumber: marker.companyNumber,
          fitScore: fit.score,
          fitReasons: fit.reasons,
          fitSummary: fit.summary,
          petition: toDealPetition(marker),
          events: [
            {
              at: nowIso(),
              stage: "ingest",
              agent: "database-builder",
              message: `SIG-02 Gazette HMRC petition: ${companyName} — ${marker.note}`,
            },
          ],
        });
        const address = profile?.registered_office_address
          ? [profile.registered_office_address.address_line_1, profile.registered_office_address.locality, profile.registered_office_address.postal_code]
              .filter(Boolean)
              .join(", ")
          : undefined;
        opened.push(
          await this.applyCompany(deal, {
            companyName,
            companyNumber: marker.companyNumber,
            companyStatus: profile?.company_status || "active",
            address,
          })
        );
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
      const fit = assessStrataFit({
        companyName: candidate.companyName,
        companyNumber,
        sicCodes: candidate.sicCode ? [candidate.sicCode] : [],
        dateOfCreation: candidate.incorporationDate,
        alreadyOnBook: false,
        hmrcTtp: gazetteByNumber.has(companyNumber),
        charges: liveLenders.map((lender) => ({
          status: "outstanding",
          createdOn: candidate.lastChargeDate,
          personsEntitled: [lender],
        })),
      });
      if (!fit.pass) {
        const intro = assessIntroducerFit({
          companyName: candidate.companyName,
          sicCodes: candidate.sicCode ? [candidate.sicCode] : [],
          dateOfCreation: candidate.incorporationDate,
          alreadyOnBook: booked.has(companyNumber),
        });
        if (!intro.pass) {
          bumpReject(rejected, fit.rejectReason || intro.rejectReason || "did not meet Strata fit");
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
              agent: "database-builder",
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
      const deal = await storage.createAgenticDeal({
        source: "distress_scan",
        stream: "sme",
        stage: "ingest",
        status: "running",
        ownerUserId,
        companyName: candidate.companyName,
        companyNumber,
        contactName: candidate.contactName,
        email: candidate.email,
        phone: candidate.phone,
        website: candidate.website,
        fitScore: fit.score,
        fitReasons: fit.reasons,
        fitSummary: fit.summary,
        petition: gazetteByNumber.has(companyNumber)
          ? toDealPetition(gazetteByNumber.get(companyNumber)!)
          : undefined,
        events: [
          {
            at: nowIso(),
            stage: "ingest",
            agent: "database-builder",
            message: `Strata fit ${fit.score}/100 from Lead Finder: ${candidate.companyName} — ${fit.reasons.join("; ")}`,
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
      chargeOpened += 1;
    }

    const localLeads = await storage.listInternalLeads();

    for (const lead of localLeads) {
      if (chargeOpened >= limit) break;
      const companyNumber = String(lead.companyNumber || "");
      const companyName = lead.companyName;
      if (!companyNumber || companyNumber.startsWith("WEB-") || seen.has(companyNumber)) continue;
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
      const fit = assessStrataFit({
        companyName,
        companyNumber,
        sicCodes: lead.sicCode ? [String(lead.sicCode)] : [],
        dateOfCreation: lead.incorporationDate,
        alreadyOnBook: booked.has(companyNumber),
        hmrcTtp: gazetteByNumber.has(companyNumber),
        charges: liveCharge
          ? [{ status: "outstanding", createdOn: lead.chargeDate, personsEntitled: [lender] }]
          : [],
      });
      if (!fit.pass) {
        bumpReject(rejected, fit.rejectReason || "did not meet Strata fit");
        continue;
      }

      const deal = await storage.createAgenticDeal({
        source: "distress_scan",
        stream: "sme",
        stage: "ingest",
        status: "running",
        ownerUserId,
        companyName,
        companyNumber,
        contactName: lead.contactName || undefined,
        email: lead.email || undefined,
        phone: lead.phone || undefined,
        website: lead.website || undefined,
        fitScore: fit.score,
        fitReasons: fit.reasons,
        fitSummary: fit.summary,
        petition: gazetteByNumber.has(companyNumber)
          ? toDealPetition(gazetteByNumber.get(companyNumber)!)
          : undefined,
        events: [
          {
            at: nowIso(),
            stage: "ingest",
            agent: "database-builder",
            message: `Strata fit ${fit.score}/100 from local book: ${companyName} — ${fit.reasons.join("; ")}`,
          },
        ],
      });
      opened.push(
        await this.applyCompany(deal, {
          companyName,
          companyNumber,
          companyStatus: "active",
          address: [lead.address, lead.city].filter(Boolean).join(", ") || undefined,
        })
      );
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
            seen.add(companyNumber);
            scanned += 1;
            const fit = await assessCompanyFit(item, booked);
            if (!fit.pass) {
              if (fit.rejectReason?.includes("rate limit")) {
                const until = setChCooldown();
                bumpReject(
                  rejected,
                  `Companies House rate limit — cooling off until ${new Date(until).toLocaleTimeString("en-GB")}`
                );
                return { deals: opened, scanned, rejected };
              }
              const intro = assessIntroducerFit({
                companyName,
                sicCodes: item.sic_codes || [],
                companyStatus: item.company_status,
                dateOfCreation: item.date_of_creation,
                alreadyOnBook: booked.has(companyNumber),
              });
              if (!intro.pass) {
                bumpReject(rejected, fit.rejectReason || intro.rejectReason || "did not meet Strata fit");
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
                    agent: "database-builder",
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
            const deal = await storage.createAgenticDeal({
              source: "distress_scan",
              stream: "sme",
              stage: "ingest",
              status: "running",
              ownerUserId,
              companyName,
              companyNumber,
              fitScore: fit.score,
              fitReasons: fit.reasons,
              fitSummary: fit.summary,
              events: [
                {
                  at: nowIso(),
                  stage: "ingest",
                  agent: "database-builder",
                  message: `Strata fit ${fit.score}/100: ${companyName} — ${fit.reasons.join("; ")}`,
                },
              ],
            });
            const address = item.registered_office_address
              ? [item.registered_office_address.address_line_1, item.registered_office_address.locality, item.registered_office_address.postal_code]
                  .filter(Boolean)
                  .join(", ")
              : undefined;
            opened.push(
              await this.applyCompany(deal, {
                companyName,
                companyNumber,
                companyStatus: item.company_status || "active",
                address,
              })
            );
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

    if (!chCooldownUntil()) {
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
                agent: "database-builder",
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

    console.log(
      `[Agentic] Hunt scanned ${scanned}, opened ${opened.length}, rejected ${JSON.stringify(rejected)}`
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

    const place = await searchPlaces(match.companyName, address || undefined);
    if (place) {
      updated = await storage.updateAgenticDeal(deal.id, {
        placeName: place.placeName,
        placeAddress: place.placeAddress,
        website: place.website,
        phone: updated.phone || place.phone,
        events: addEvent(
          updated,
          "enrich",
          `Places: ${place.placeName} — ${place.placeAddress}${place.phone ? ` · ${place.phone}` : ""}`,
          "inbound-intake"
        ),
      });
    } else {
      updated = await storage.updateAgenticDeal(deal.id, {
        events: addEvent(updated, "enrich", "No Google Places listing found", "inbound-intake"),
      });
    }

    if (missingContact(updated)) {
      updated = await this.completeContact(updated);
    }

    return this.promoteToPipeline(updated, address);
  },

  async completeContact(deal: AgenticDealFile): Promise<AgenticDealFile> {
    const found = await findMissingContact(deal);
    const parts: string[] = [];
    if (found.contactName && found.contactName !== deal.contactName) parts.push(`name ${found.contactName}`);
    if (found.email) parts.push(`email ${found.email}`);
    if (found.phone) parts.push(`phone ${found.phone}`);

    const merged = {
      contactName: found.contactName || deal.contactName,
      email: found.email || deal.email,
      phone: found.phone || deal.phone,
      website: found.website || deal.website,
    };

    if (deal.internalLeadId && (found.email || found.phone || found.contactName)) {
      await storage.updateInternalLead(deal.internalLeadId, {
        contactName: merged.contactName,
        email: merged.email,
        phone: merged.phone,
      });
    }

    return storage.updateAgenticDeal(deal.id, {
      ...merged,
      events: addEvent(
        deal,
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
          referralSource: deal.source === "strata_inbound" ? "Strata" : "Agent",
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
        `Created pipeline lead #${prospectId} marked ${deal.source === "strata_inbound" ? "Strata" : "Agent"}`,
        deal.source === "strata_inbound" ? "inbound-intake" : "database-builder"
      ),
    });

    return this.sendOutreach(promoted);
  },

  async sendOutreach(deal: AgenticDealFile): Promise<AgenticDealFile> {
    const stream = dealStream(deal.source, deal.stream);
    if (stream === "sme" && (deal.fitScore ?? 0) < MIN_FIT_SCORE) {
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

    const step = nextCadenceStep(stream, 0);
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
    const script = renderOutreachEmail(deal, step.touchId, mailbox);
    const nextTouch = (deal.outreachTouch || 0) + 1;
    const following = nextCadenceStep(stream, nextTouch);
    const isLinkedIn = step.channel === "linkedin";

    const pecrReason = coldEmailBlockedReason(deal.email, stream);
    let delivered = !step.autoSend || isLinkedIn;
    if (step.autoSend && !isLinkedIn && pecrReason) {
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
    });

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
    if (docs.length > 0 || packDocs.length > 0) {
      const count = docs.length || packDocs.length;
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
        events: addEvent(deal, "fulfilment", `${count} document(s) on file — ingesting`, "fulfilment-manager"),
      });
      return this.runProcessing(ready);
    }

    const stream = dealStream(deal.source, deal.stream);
    const step = nextCadenceStep(stream, deal.outreachTouch || 0);
    if (!step) {
      return storage.updateAgenticDeal(deal.id, {
        stage: "failed",
        status: "failed",
        waitUntil: undefined,
        events: addEvent(deal, "failed", "Cadence complete. File parked.", "fulfilment-manager"),
      }) as Promise<AgenticDealFile>;
    }
    return this.applyCadenceStep(deal, stream, step);
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
        status: "waiting_human",
        waitUntil: undefined,
        processingSummary: `SFP PARTIAL. Missing: ${gaps}. Will not underwrite from the event log.`,
        humanReason: `Pack is incomplete: ${gaps}`,
        events: addEvent(
          deal,
          "processing",
          `Held — SFP PARTIAL. ${gaps}`,
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

  async resolveHuman(
    dealId: number,
    action: "call_done" | "approve_sterling" | "stop" | "linkedin_posted" | "retry_send",
    note?: string
  ): Promise<AgenticDealFile> {
    const deal = await storage.getAgenticDeal(dealId);
    if (!deal) throw new Error("Deal file not found");

    if (action === "stop") {
      return storage.updateAgenticDeal(deal.id, {
        stage: "failed",
        status: "failed",
        events: addEvent(deal, "failed", note || "Stopped by human"),
      }) as Promise<AgenticDealFile>;
    }

    if (action === "retry_send") {
      return this.sendOutreach({
        ...deal,
        status: "running",
        humanReason: undefined,
      });
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
      const packDocs = deal.packDocuments || [];
      const pipelineDocs = deal.prospectId ? await storage.listProspectDocuments(deal.prospectId) : [];
      const hasPack = packDocs.length > 0 || pipelineDocs.length > 0;
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
        return storage.updateAgenticDeal(deal.id, {
          stage: "fulfilment",
          status: "waiting_human",
          humanReason: "Warm call done — pack still missing. Do not underwrite an empty file.",
          events: addEvent(
            deal,
            "fulfilment",
            note || "Call completed with no pack — waiting for documents, not processing."
          ),
        }) as Promise<AgenticDealFile>;
      }
      return storage.updateAgenticDeal(deal.id, {
        stage: "failed",
        status: "failed",
        humanReason: undefined,
        events: addEvent(
          deal,
          "failed",
          note || "Call completed with no pack — cadence closed. File parked."
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
      (deal) => deal.status === "waiting_timer" && deal.waitUntil && new Date(deal.waitUntil).getTime() <= Date.now()
    );
    for (const deal of due) {
      try {
        if (deal.stage === "fulfilment") await this.runFulfilment(deal);
        if (deal.stage === "outreach") {
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
