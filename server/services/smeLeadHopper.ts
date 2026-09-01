import type { AgenticDealFile } from "@shared/agenticWorkflow";
import { countLiveNonBankCharges, isP0 } from "@shared/chargeClassifier";
import { dealStream } from "@shared/salesOs";
import {
  SME_ATTACH_ATTEMPT_CAP,
  SME_HOPPER_TARGET,
  compareSendable,
  isSendableContact,
  sendableShortfall,
  type HopperDeal,
} from "@shared/smeHopper";
import { rejectBeforeCharges } from "./strataFit";

export type ChargeLike = {
  status?: string | null;
  personsEntitled?: string[];
  createdOn?: string;
};

export type SmeHuntInput = {
  companyName: string;
  companyNumber: string;
  companyStatus?: string;
  companyStatusDetail?: string;
  dateOfCreation?: string;
  sicCodes?: string[];
  alreadyOnBook?: boolean;
  charges?: ChargeLike[];
  hasPetition?: boolean;
};

export type SmeHuntResult =
  | { ok: true; liveNonBankChargeCount: number }
  | { ok: false; reason: string };

export const GATED_SME_HUNT_HOLD = {
  hopper: "gated" as const,
  stage: "ingest" as const,
  status: "waiting_timer" as const,
};

export function shouldSendOutreachAfterSmeHunt(deal: { hopper?: string | null; source?: string }): boolean {
  if (deal.source === "strata_inbound") return true;
  return deal.hopper !== "gated";
}

function normCompanyNumber(value?: string | null): string {
  const raw = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!raw) return "";
  if (/^\d+$/.test(raw) && raw.length <= 8) return raw.padStart(8, "0");
  return raw;
}

function setHasCompanyNumber(set: Set<string>, companyNumber?: string): boolean {
  const raw = String(companyNumber || "").trim();
  if (raw && set.has(raw)) return true;
  const number = normCompanyNumber(companyNumber);
  if (!number) return false;
  if (set.has(number)) return true;
  for (const item of set) {
    if (normCompanyNumber(item) === number) return true;
  }
  return false;
}

export function shouldEnterSmeHunt(input: SmeHuntInput): SmeHuntResult {
  if (!String(input.dateOfCreation || "").trim()) {
    return { ok: false, reason: "missing incorporation date" };
  }
  const early = rejectBeforeCharges({
    companyName: input.companyName,
    companyNumber: input.companyNumber,
    companyStatus: input.companyStatus,
    companyStatusDetail: input.companyStatusDetail,
    dateOfCreation: input.dateOfCreation,
    sicCodes: input.sicCodes,
    alreadyOnBook: input.alreadyOnBook,
  });
  if (early) return { ok: false, reason: early };

  const liveNonBankChargeCount = countLiveNonBankCharges(input.charges || []);
  if (!isP0({ hasPetition: input.hasPetition, liveNonBankChargeCount })) {
    return { ok: false, reason: "no P0 buying signal" };
  }
  return { ok: true, liveNonBankChargeCount };
}

export function isExcludedFromSmeHunt(
  deal: { source?: string; companyNumber?: string; email?: string },
  bookedNumbers: Set<string>,
  inboundNumbers: Set<string>,
  inboundEmails: Set<string>
): boolean {
  if (dealStream(deal.source) === "inbound") return true;
  if (setHasCompanyNumber(bookedNumbers, deal.companyNumber)) return true;
  if (setHasCompanyNumber(inboundNumbers, deal.companyNumber)) return true;
  const email = String(deal.email || "").trim().toLowerCase();
  if (email) {
    for (const item of inboundEmails) {
      if (String(item || "").trim().toLowerCase() === email) return true;
    }
  }
  return false;
}

export type AttachBudget = { ch: number; places: number; firecrawl: number; smtp: number };

export const DEFAULT_ATTACH_BUDGET: AttachBudget = { ch: 400, places: 100, firecrawl: 50, smtp: 50 };

export type AttachPlaceHit = { website?: string; email?: string; phone?: string };

export type AttachDeps = {
  officers(companyNumber: string): Promise<string[]>;
  places(companyName: string, address?: string): Promise<AttachPlaceHit | null>;
  firecrawl(website: string): Promise<string[]>;
  mxValid(email: string): Promise<boolean>;
  smtpValid?(email: string): Promise<boolean>;
};

export class SmeAttachRateLimitError extends Error {
  readonly code = "CH_429" as const;
  constructor() {
    super("Companies House rate limit");
    this.name = "SmeAttachRateLimitError";
  }
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PLACES_TEXT_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";

export const ATTACH_FIRECRAWL_PATHS = ["/", "/contact", "/about", "/team"] as const;

export function firecrawlTargetUrls(website: string): string[] {
  const raw = String(website || "").trim();
  if (!raw) return [];
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const origin = new URL(withScheme).origin;
    return ATTACH_FIRECRAWL_PATHS.map((path) => (path === "/" ? `${origin}/` : `${origin}${path}`));
  } catch {
    return [];
  }
}

function copyBudget(budget: AttachBudget): AttachBudget {
  return { ch: budget.ch, places: budget.places, firecrawl: budget.firecrawl, smtp: budget.smtp };
}

function isRateLimit(err: unknown): boolean {
  return err instanceof SmeAttachRateLimitError || (err as { code?: string })?.code === "CH_429";
}

function hopperRankFields(deal: AgenticDealFile): HopperDeal {
  const row = deal as AgenticDealFile & { hasPetition?: boolean; hearingAt?: string };
  return {
    id: deal.id,
    hopper: deal.hopper,
    source: deal.source,
    nonBankChargeCount: deal.nonBankChargeCount,
    lastSignalAt: deal.lastSignalAt,
    incorporatedAt: deal.incorporatedAt,
    hasPetition: Boolean(row.hasPetition || deal.petition),
    hearingAt: row.hearingAt || deal.petition?.hearingAt,
  };
}

function officerDisplayName(raw: string): string {
  const name = String(raw || "").trim();
  if (!name) return "";
  if (!name.includes(",")) return name;
  const [surname, forenames] = name.split(",").map((part) => part.trim());
  return [forenames, surname].filter(Boolean).join(" ");
}

function nameTokens(value: string): string[] {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((token) => token.length > 1);
}

function contactNameForEmail(email: string, directorNames: string[]): string | undefined {
  const local = String(email || "").split("@")[0] || "";
  const localTokens = nameTokens(local);
  if (!localTokens.length) return undefined;
  return directorNames.find((name) => {
    const tokens = nameTokens(name);
    if (!tokens.length) return false;
    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    return localTokens.includes(first) || localTokens.includes(last);
  });
}

async function mailboxPasses(
  email: string,
  contactName: string,
  directorNames: string[],
  deps: AttachDeps,
  budget: AttachBudget
): Promise<boolean> {
  if (!isSendableContact({ email, contactName, directorNames })) return false;
  if (!(await deps.mxValid(email))) return false;
  if (!deps.smtpValid || budget.smtp <= 0) return true;
  budget.smtp -= 1;
  return deps.smtpValid(email);
}

function failAttachPatch(
  deal: AgenticDealFile,
  extra: Partial<AgenticDealFile>,
  now: Date
): Partial<AgenticDealFile> {
  const attachAttempts = (deal.attachAttempts || 0) + 1;
  if (attachAttempts >= SME_ATTACH_ATTEMPT_CAP) {
    return {
      ...extra,
      attachAttempts,
      hopper: "parked",
      humanReason: "no director mailbox after 5 attach nights",
      stage: "failed",
      status: "failed",
    };
  }
  return {
    ...extra,
    attachAttempts,
    hopper: "hunt_contact",
    waitUntil: new Date(now.getTime() + ONE_DAY_MS).toISOString(),
  };
}

function sendableAttachPatch(
  extra: Partial<AgenticDealFile>,
  fields: {
    contactSource: NonNullable<AgenticDealFile["contactSource"]>;
    contactName?: string;
    email?: string;
    website?: string;
    phone?: string;
  }
): Partial<AgenticDealFile> {
  return {
    ...extra,
    hopper: "sendable",
    stage: "outreach",
    status: "waiting_timer",
    contactSource: fields.contactSource,
    contactName: fields.contactName,
    email: fields.email,
    website: fields.website,
    phone: fields.phone,
    waitUntil: undefined,
  };
}

export function inboundEmailsFromDeals(
  deals: Array<{ source?: string; email?: string | null }>
): Set<string> {
  const emails = new Set<string>();
  for (const deal of deals) {
    if (deal.source !== "strata_inbound") continue;
    const email = String(deal.email || "").trim().toLowerCase();
    if (email) emails.add(email);
  }
  return emails;
}

export async function attachOne(
  deal: AgenticDealFile,
  deps: AttachDeps,
  budget: AttachBudget,
  now: Date = new Date(),
  inboundEmails: Set<string> = new Set()
): Promise<{ dealPatch: Partial<AgenticDealFile>; budget: AttachBudget }> {
  const next = copyBudget(budget);
  const extra: Partial<AgenticDealFile> = {};
  let directorNames = [...(deal.directorNames || [])];
  let email = String(deal.email || "").trim() || undefined;
  let website = deal.website;
  let phone = deal.phone;
  let contactSource: AgenticDealFile["contactSource"] | undefined;
  let contactName = deal.contactName;

  if (deal.companyNumber && next.ch > 0) {
    next.ch -= 1;
    const fetched = await deps.officers(deal.companyNumber);
    if (fetched.length) directorNames = fetched;
  }
  if (directorNames.length) extra.directorNames = directorNames;

  const accept = async (
    candidate: string,
    source: NonNullable<AgenticDealFile["contactSource"]>
  ): Promise<boolean> => {
    if (isExcludedFromSmeHunt({ email: candidate }, new Set(), new Set(), inboundEmails)) return false;
    const name = contactNameForEmail(candidate, directorNames);
    if (!name) return false;
    if (!(await mailboxPasses(candidate, name, directorNames, deps, next))) return false;
    email = candidate;
    contactName = name;
    contactSource = source;
    return true;
  };

  if (email && (await accept(email, "ch"))) {
    return {
      dealPatch: sendableAttachPatch(extra, { contactSource: "ch", contactName, email, website, phone }),
      budget: next,
    };
  }

  if (next.places > 0) {
    next.places -= 1;
    let place: AttachPlaceHit | null = null;
    try {
      place = await deps.places(deal.companyName, deal.placeAddress);
    } catch {
      place = null;
    }
    if (place) {
      if (place.website && !website) website = place.website;
      if (place.phone && !phone) phone = place.phone;
      if (place.email) {
        extra.website = website;
        extra.phone = phone;
        if (await accept(place.email, "places")) {
          return {
            dealPatch: sendableAttachPatch(extra, {
              contactSource: "places",
              contactName,
              email,
              website,
              phone,
            }),
            budget: next,
          };
        }
      }
    }
  }

  if (!contactSource && website && next.firecrawl > 0) {
    next.firecrawl -= 1;
    let found: string[] = [];
    try {
      found = await deps.firecrawl(website);
    } catch {
      found = [];
    }
    for (const candidate of found) {
      if (await accept(candidate, "firecrawl")) {
        return {
          dealPatch: sendableAttachPatch(extra, {
            contactSource: "firecrawl",
            contactName,
            email,
            website,
            phone,
          }),
          budget: next,
        };
      }
    }
  }

  if (website) extra.website = website;
  if (phone) extra.phone = phone;
  return { dealPatch: failAttachPatch(deal, extra, now), budget: next };
}

export async function refillSendableHopper(opts: {
  deals: AgenticDealFile[];
  deps: AttachDeps;
  budget?: AttachBudget;
  target?: number;
  now?: Date;
  inboundEmails?: Set<string>;
}): Promise<{ patches: Array<{ id: number; patch: Partial<AgenticDealFile> }>; budget: AttachBudget }> {
  let budget = copyBudget(opts.budget || DEFAULT_ATTACH_BUDGET);
  const shortfall = sendableShortfall(opts.deals, opts.target ?? SME_HOPPER_TARGET);
  if (shortfall === 0) return { patches: [], budget };

  const now = opts.now || new Date();
  const nowMs = now.getTime();
  const inboundEmails = opts.inboundEmails ?? inboundEmailsFromDeals(opts.deals);
  const candidates = opts.deals
    .filter((deal) => {
      if (deal.source === "strata_inbound") return false;
      if (deal.hopper !== "gated" && deal.hopper !== "hunt_contact") return false;
      if (deal.waitUntil && Date.parse(deal.waitUntil) > nowMs) return false;
      return true;
    })
    .sort((a, b) => compareSendable(hopperRankFields(a), hopperRankFields(b)));

  const patches: Array<{ id: number; patch: Partial<AgenticDealFile> }> = [];
  let remaining = shortfall;

  for (const deal of candidates) {
    if (remaining <= 0) break;
    if (!canAttachWithBudget(deal, budget)) continue;
    try {
      const result = await attachOne(deal, opts.deps, budget, now, inboundEmails);
      budget = result.budget;
      patches.push({ id: deal.id, patch: result.dealPatch });
      if (result.dealPatch.hopper === "sendable") remaining -= 1;
    } catch (err) {
      if (isRateLimit(err)) return { patches, budget };
      throw err;
    }
  }

  return { patches, budget };
}

function canAttachWithBudget(deal: AgenticDealFile, budget: AttachBudget): boolean {
  const hasNames = (deal.directorNames || []).length > 0;
  if (!hasNames && budget.ch <= 0) return false;

  const email = String(deal.email || "").trim();
  if (email) return true;

  if (budget.places > 0) return true;
  if (deal.website && budget.firecrawl > 0) return true;
  return false;
}

function placesApiKey(): string | undefined {
  return process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_PLACES_API || process.env.GOOGLE_MAPS_API_KEY;
}

export function liveAttachDeps(): AttachDeps {
  return {
    async officers(companyNumber: string) {
      try {
        const { chFetch } = await import("../utils/companiesHouseClient");
        const res = await chFetch(`/company/${encodeURIComponent(companyNumber)}/officers`);
        if (res.status === 429) throw new SmeAttachRateLimitError();
        if (!res.ok) return [];
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        return items
          .filter((officer: { resigned_on?: string | null }) => !officer.resigned_on)
          .map((officer: { name?: string }) => officerDisplayName(officer.name || ""))
          .filter((name: string) => name.length > 1);
      } catch (err) {
        if (isRateLimit(err)) throw err;
        return [];
      }
    },
    async places(companyName: string, address?: string) {
      const key = placesApiKey();
      if (!key) return null;
      const query = [companyName, address].filter(Boolean).join(" ");
      const response = await fetch(`${PLACES_TEXT_URL}?query=${encodeURIComponent(query)}&key=${key}`);
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
      return { website, phone };
    },
    async firecrawl(website: string) {
      const key = process.env.FIRECRAWL_API_KEY?.trim();
      if (!key || !website) return [];
      const emails = new Set<string>();
      for (const url of firecrawlTargetUrls(website)) {
        try {
          const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({ url, formats: ["markdown", "html"] }),
          });
          if (!resp.ok) continue;
          const found = JSON.stringify(await resp.json()).match(EMAIL_RE) || [];
          for (const item of found) emails.add(item.toLowerCase());
        } catch {
          // skip this path
        }
      }
      return [...emails];
    },
    async mxValid(email: string) {
      const domain = String(email || "").split("@")[1];
      if (!domain) return false;
      try {
        const { resolveMx } = await import("dns/promises");
        const records = await resolveMx(domain);
        return Array.isArray(records) && records.length > 0;
      } catch {
        return false;
      }
    },
  };
}
