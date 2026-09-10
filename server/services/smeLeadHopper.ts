import { isNoiseDeal, type AgenticDealFile } from "@shared/agenticWorkflow";
import { countLiveNonBankCharges, isP0 } from "@shared/chargeClassifier";
import { dealStream } from "@shared/salesOs";
import {
  compareSendable,
  directorForEmail,
  gradeMailbox,
  isProtectedFromQuarantine,
  isRoleMailbox,
  isSendableContact,
  SME_ATTACH_ATTEMPT_CAP,
  type HopperDeal,
} from "@shared/smeHopper";
import { rejectBeforeCharges } from "./strataFit";
import { suppressionSets } from "./mailSuppression";
import { emailMatchesCompany, isBlockedOutreachHost, isPersonalMailbox, outreachHost } from "@shared/pecrSend";
import { canFirecrawlScrape, firecrawlAuthHeaders, firecrawlScrapeUrl } from "@shared/firecrawl";
import {
  companyDomainFromWebsite,
  contactMailboxGuesses,
  domainCandidatesFromCompanyName,
  emailOnCompanyDomain,
  emailsFromScrapedText,
  inferMailboxPattern,
} from "@shared/companyMailbox";
import {
  MAILBOX_SEND_FLOOR,
  catchAllStatus,
  mailboxConfidence,
  mxFamilyFromHosts,
  smtpTrusted,
  type CatchAllStatus,
  type MailboxEvidenceSource,
  type SmtpProbe,
} from "@shared/mailboxScore";
import { isJobStoppedError } from "./agentJobTracker";
import { isGuessPaused } from "./harvestGuessStore";

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

export const HARVEST_AGENT_ID = "harvest";
export const HARVEST_RETRY_MS = 24 * 60 * 60 * 1000;
export const HARVEST_ATTACH_TIMEOUT_MS = 45 * 1000;
export const HARVEST_PER_HOUR = 25;
export const HARVEST_FLUSH_EVERY = 1;

export function isHarvestCandidate(
  deal: {
    source?: string;
    hopper?: string | null;
    email?: string | null;
    companyName?: string;
    ownerUserId?: string;
    waitUntil?: string;
    stream?: string;
    outreachTouch?: number | null;
    sterlingHandoffId?: number | null;
    packDocuments?: Array<unknown> | null;
    stage?: string;
    attachAttempts?: number | null;
  },
  now: Date = new Date()
): boolean {
  if (isNoiseDeal({ companyName: deal.companyName || "", ownerUserId: deal.ownerUserId || "" })) return false;
  if (deal.source === "strata_inbound") return false;
  if (isProtectedFromQuarantine(deal)) return false;
  if ((deal.attachAttempts || 0) >= SME_ATTACH_ATTEMPT_CAP) return false;
  const hopper = deal.hopper;
  if (hopper === "sendable" || hopper === "queued" || hopper === "parked") return false;
  const hasEmail = Boolean(String(deal.email || "").trim());
  if (hopper === "quarantine") {
    if (hasEmail) return false;
    if (deal.waitUntil && Date.parse(deal.waitUntil) > now.getTime()) return false;
    return true;
  }
  if (hopper === "gated" || hopper === "hunt_contact") return true;
  if (!hopper) return !hasEmail;
  return false;
}

export function shouldSendOutreachAfterSmeHunt(deal: { hopper?: string | null; source?: string }): boolean {
  if (deal.source === "strata_inbound") return true;
  return deal.hopper === "sendable" || deal.hopper === "queued";
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

export const DEFAULT_ATTACH_BUDGET: AttachBudget = { ch: 800, places: 400, firecrawl: 400, smtp: 150 };

export type AttachPlaceHit = { website?: string; email?: string; phone?: string };

export type AttachDeps = {
  officers(companyNumber: string): Promise<string[]>;
  places(companyName: string, address?: string): Promise<AttachPlaceHit | null>;
  firecrawl(website: string): Promise<string[]>;
  mxValid(email: string): Promise<boolean>;
  smtpValid?(email: string): Promise<boolean>;
  smtpProbe?(email: string): Promise<SmtpProbe>;
  osint?(companyName: string, address?: string): Promise<{ emails: string[]; website?: string }>;
  wayback?(website: string): Promise<string[]>;
  mxHosts?(domain: string): Promise<string[]>;
  guessPaused?: boolean;
};

async function probeSmtp(deps: AttachDeps, email: string): Promise<SmtpProbe> {
  if (deps.smtpProbe) return deps.smtpProbe(email);
  if (!deps.smtpValid) return "unknown";
  return (await deps.smtpValid(email)) ? "deliverable" : "user_unknown";
}

export class SmeAttachRateLimitError extends Error {
  readonly code = "CH_429" as const;
  constructor() {
    super("Companies House rate limit");
    this.name = "SmeAttachRateLimitError";
  }
}

const PLACES_TEXT_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";

export const ATTACH_FIRECRAWL_PATHS = ["/contact", "/", "/about", "/team"] as const;

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

export async function collectPageEmails(
  urls: string[],
  fetchText: (url: string) => Promise<string | null>
): Promise<string[]> {
  const emails = new Set<string>();
  for (const url of urls) {
    let text: string | null = null;
    try {
      text = await fetchText(url);
    } catch {
      text = null;
    }
    for (const item of emailsFromScrapedText(text)) emails.add(item);
    if (emails.size) break;
  }
  return [...emails];
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

async function mailboxPasses(
  email: string,
  contactName: string,
  directorNames: string[],
  deps: AttachDeps,
  budget: AttachBudget,
  companyName?: string | null,
  requireSmtp = false
): Promise<boolean> {
  if (!isSendableContact({ email, contactName, directorNames, companyName })) return false;
  if (!(await deps.mxValid(email))) return false;
  if (!requireSmtp) return true;
  if (budget.smtp <= 0) return false;
  budget.smtp -= 1;
  return (await probeSmtp(deps, email)) === "deliverable";
}

function harvestEvent(
  deal: AgenticDealFile,
  message: string,
  now: Date,
  stage?: AgenticDealFile["stage"]
): NonNullable<AgenticDealFile["events"]>[number] {
  return {
    at: now.toISOString(),
    stage: stage || deal.stage || "ingest",
    agent: HARVEST_AGENT_ID,
    message,
  };
}

function failAttachPatch(
  deal: AgenticDealFile,
  extra: Partial<AgenticDealFile>,
  now: Date
): Partial<AgenticDealFile> {
  const attachAttempts = (deal.attachAttempts || 0) + 1;
  const events = [
    ...(deal.events || []),
    harvestEvent(deal, "Harvest: no verified company mailbox", now),
  ];
  if (isProtectedFromQuarantine(deal)) {
    return { ...extra, attachAttempts, events };
  }
  return {
    ...extra,
    attachAttempts,
    hopper: "quarantine",
    status: "waiting_human",
    humanReason: "no corporate mailbox — inspect before delete",
    waitUntil: new Date(now.getTime() + HARVEST_RETRY_MS).toISOString(),
    events,
  };
}

function sendableAttachPatch(
  deal: AgenticDealFile,
  extra: Partial<AgenticDealFile>,
  fields: {
    contactSource: NonNullable<AgenticDealFile["contactSource"]>;
    contactName?: string;
    email?: string;
    website?: string;
    phone?: string;
    mailboxGrade: NonNullable<AgenticDealFile["mailboxGrade"]>;
    mailboxConfidence: number;
  },
  now: Date
): Partial<AgenticDealFile> {
  const mailbox = fields.email || "mailbox";
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
    mailboxGrade: fields.mailboxGrade,
    mailboxConfidence: fields.mailboxConfidence,
    waitUntil: undefined,
    events: [
      ...(deal.events || []),
      harvestEvent(deal, `Harvest attached ${fields.mailboxGrade} mailbox ${mailbox}`, now, "outreach"),
    ],
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
  let website = isBlockedOutreachHost(outreachHost(deal.website)) ? undefined : deal.website;
  let phone = deal.phone;
  const found: Array<{ email: string; source: NonNullable<AgenticDealFile["contactSource"]> }> = [];

  const stored = String(deal.email || "").trim();
  const storedDomain = companyDomainFromWebsite(website);
  if (
    stored &&
    !isPersonalMailbox(stored) &&
    !isRoleMailbox(stored) &&
    (!storedDomain || emailOnCompanyDomain(stored, storedDomain)) &&
    !isExcludedFromSmeHunt({ email: stored }, new Set(), new Set(), inboundEmails)
  ) {
    const name = deal.contactName || directorNames[0] || "Director";
    if (await mailboxPasses(stored, name, directorNames, deps, next, deal.companyName, false)) {
      extra.website = website;
      extra.phone = phone;
      if (directorNames.length) extra.directorNames = directorNames;
      return {
        dealPatch: sendableAttachPatch(
          deal,
          extra,
          {
            contactSource: "ch",
            contactName: name,
            email: stored,
            website,
            phone,
            mailboxGrade: "director",
            mailboxConfidence: mailboxConfidence({
              source: "ch",
              mx: true,
              smtp: "unknown",
              catchAll: "unknown",
              citedOnDomain: 1,
            }),
          },
          now
        ),
        budget: next,
      };
    }
  }

  if (deal.companyNumber && next.ch > 0 && directorNames.length === 0) {
    next.ch -= 1;
    const fetched = await deps.officers(deal.companyNumber);
    if (fetched.length) directorNames = fetched;
  }
  if (directorNames.length) extra.directorNames = directorNames;

  if (stored) found.push({ email: stored, source: "ch" });

  if (next.places > 0 && !website) {
    next.places -= 1;
    let place: AttachPlaceHit | null = null;
    try {
      place = await deps.places(deal.companyName, deal.placeAddress);
    } catch {
      place = null;
    }
    if (place) {
      if (place.website && !website && !isBlockedOutreachHost(outreachHost(place.website))) {
        website = place.website;
      }
      if (place.phone && !phone) phone = place.phone;
      if (place.email) found.push({ email: place.email, source: "places" });
    }
  }

  let domain = companyDomainFromWebsite(website);

  if (website && next.firecrawl > 0 && (!stored || isPersonalMailbox(stored))) {
    next.firecrawl -= 1;
    let scraped: string[] = [];
    try {
      scraped = await deps.firecrawl(website);
    } catch {
      scraped = [];
    }
    for (const candidate of scraped) found.push({ email: candidate, source: "firecrawl" });
  }

  if (website && deps.wayback && !found.some((item) => item.source === "firecrawl")) {
    try {
      for (const candidate of await deps.wayback(website)) found.push({ email: candidate, source: "wayback" });
    } catch {
      // archive is optional
    }
  }

  if (deps.osint && (!domain || !found.length)) {
    try {
      const hit = await deps.osint(deal.companyName, deal.placeAddress);
      if (hit.website && !website && !isBlockedOutreachHost(outreachHost(hit.website))) {
        website = hit.website;
        domain = companyDomainFromWebsite(website);
      }
      for (const candidate of hit.emails || []) found.push({ email: candidate, source: "osint" });
    } catch {
      // search is optional
    }
  }

  if (!domain) {
    for (const host of domainCandidatesFromCompanyName(deal.companyName)) {
      if (!emailMatchesCompany(`mailbox@${host}`, deal.companyName)) continue;
      let ok = false;
      if (deps.mxHosts) ok = (await deps.mxHosts(host)).length > 0;
      else ok = await deps.mxValid(`mailbox@${host}`);
      if (!ok) continue;
      domain = host;
      website = `https://${host}`;
      extra.website = website;
      break;
    }
  }

  if (domain) {
    const onDomain = found.filter((item) => emailOnCompanyDomain(item.email, domain as string));
    found.length = 0;
    found.push(...onDomain);
  }

  const citedOnDomain = found.filter((item) => item.source !== "domain").length;
  let catchAll: CatchAllStatus = "unknown";
  let family = mxFamilyFromHosts(domain && deps.mxHosts ? await deps.mxHosts(domain) : []);
  const guessPaused = Boolean(deps.guessPaused);
  if (domain && directorNames.length && !guessPaused) {
    if (smtpTrusted(family) && next.smtp > 0) {
      const probes: SmtpProbe[] = [];
      for (const box of [`nx-no-box-strata@${domain}`, `nx-no-box-strata-b@${domain}`]) {
        if (next.smtp <= 0) break;
        next.smtp -= 1;
        probes.push(await probeSmtp(deps, box));
      }
      catchAll = catchAllStatus(probes);
      if (catchAll === "not_catch_all") {
        const pattern = inferMailboxPattern(
          found.map((item) => item.email),
          directorNames
        );
        for (const email of contactMailboxGuesses(domain, directorNames, pattern)) {
          if (found.some((item) => item.email === email)) continue;
          found.push({ email, source: "domain" });
        }
      }
    } else if (!smtpTrusted(family)) {
      const pattern = inferMailboxPattern(
        found.map((item) => item.email),
        directorNames
      );
      for (const email of contactMailboxGuesses(domain, directorNames, pattern)) {
        if (found.some((item) => item.email === email)) continue;
        found.push({ email, source: "domain" });
      }
    }
  }

  extra.website = website;
  extra.phone = phone;

  const tryGrade = async (want: "director" | "role"): Promise<Partial<AgenticDealFile> | null> => {
    const ranked = [...found].sort((a, b) => {
      if (a.source === "domain" && b.source === "domain") return 0;
      const am = directorForEmail(a.email, directorNames) ? 0 : 1;
      const bm = directorForEmail(b.email, directorNames) ? 0 : 1;
      return am - bm;
    });
    for (const item of ranked) {
      if (isExcludedFromSmeHunt({ email: item.email }, new Set(), new Set(), inboundEmails)) continue;
      const matched = directorForEmail(item.email, directorNames);
      const grade = gradeMailbox({
        email: item.email,
        contactName: matched || deal.contactName,
        directorNames,
        companyName: deal.companyName,
      });
      if (grade !== want) continue;
      const name =
        want === "director"
          ? matched || deal.contactName || "Director"
          : directorNames[0] || deal.contactName || "Director";
      if (
        !(await mailboxPasses(
          item.email,
          name || "Director",
          directorNames,
          deps,
          next,
          deal.companyName,
          false
        ))
      ) {
        continue;
      }
      const smtp =
        item.source === "domain" && smtpTrusted(family) && next.smtp > 0
          ? ((next.smtp -= 1), await probeSmtp(deps, item.email))
          : "unknown";
      const score = mailboxConfidence({
        source: (item.source || "firecrawl") as MailboxEvidenceSource,
        mx: true,
        smtp,
        catchAll,
        citedOnDomain,
        mxFamily: family,
      });
      if (item.source === "domain" && smtp !== "deliverable" && score < MAILBOX_SEND_FLOOR) continue;
      if (score < MAILBOX_SEND_FLOOR) continue;
      return sendableAttachPatch(
        deal,
        extra,
        {
          contactSource: item.source,
          contactName: name,
          email: item.email,
          website,
          phone,
          mailboxGrade: want,
          mailboxConfidence: score,
        },
        now
      );
    }
    return null;
  };

  const directorHit = await tryGrade("director");
  if (directorHit) return { dealPatch: directorHit, budget: next };
  const roleHit = await tryGrade("role");
  if (roleHit) return { dealPatch: roleHit, budget: next };

  const fail = failAttachPatch(deal, extra, now);
  const domainGuesses = found.filter((item) => item.source === "domain");
  if (
    domainGuesses.length > 0 &&
    domainGuesses.every((item) =>
      isExcludedFromSmeHunt({ email: item.email }, new Set(), new Set(), inboundEmails)
    )
  ) {
    fail.attachAttempts = SME_ATTACH_ATTEMPT_CAP;
  }
  return { dealPatch: fail, budget: next };
}

export type HarvestProgress = {
  index: number;
  total: number;
  companyName: string;
  phase: "start" | "done" | "skip";
  email?: string;
  hopper?: string;
};

export async function refillSendableHopper(opts: {
  deals: AgenticDealFile[];
  deps: AttachDeps;
  budget?: AttachBudget;
  target?: number;
  now?: Date;
  inboundEmails?: Set<string>;
  onProgress?: (row: HarvestProgress) => void | Promise<void>;
  onPatch?: (row: { id: number; patch: Partial<AgenticDealFile> }) => void | Promise<void>;
  attachTimeoutMs?: number;
  limit?: number;
}): Promise<{ patches: Array<{ id: number; patch: Partial<AgenticDealFile> }>; budget: AttachBudget }> {
  let budget = copyBudget(opts.budget || DEFAULT_ATTACH_BUDGET);
  const now = opts.now || new Date();
  const inboundEmails = opts.inboundEmails ?? inboundEmailsFromDeals(opts.deals);
  for (const email of suppressionSets().emails) inboundEmails.add(email);
  const candidates = opts.deals
    .filter((deal) => isHarvestCandidate(deal, now))
    .sort((a, b) => compareSendable(hopperRankFields(a), hopperRankFields(b)))
    .slice(0, opts.limit ?? Number.POSITIVE_INFINITY);

  const patches: Array<{ id: number; patch: Partial<AgenticDealFile> }> = [];
  const total = candidates.length;

  for (let i = 0; i < candidates.length; i++) {
    const deal = candidates[i];
    try {
      await opts.onProgress?.({
        index: i,
        total,
        companyName: deal.companyName,
        phase: "start",
      });
      if (!canAttachWithBudget(deal, budget)) {
        await opts.onProgress?.({
          index: i + 1,
          total,
          companyName: deal.companyName,
          phase: "skip",
        });
        continue;
      }
      const timeoutMs = opts.attachTimeoutMs ?? HARVEST_ATTACH_TIMEOUT_MS;
      let result: { dealPatch: Partial<AgenticDealFile>; budget: AttachBudget };
      try {
        result = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("harvest attach timed out")), timeoutMs);
          attachOne(deal, opts.deps, budget, now, inboundEmails).then(
            (value) => {
              clearTimeout(timer);
              resolve(value);
            },
            (err) => {
              clearTimeout(timer);
              reject(err);
            }
          );
        });
      } catch (err) {
        if (!(err instanceof Error && err.message === "harvest attach timed out")) throw err;
        result = { dealPatch: failAttachPatch(deal, {}, now), budget };
      }
      budget = result.budget;
      const row = { id: deal.id, patch: result.dealPatch };
      patches.push(row);
      await opts.onPatch?.(row);
      await opts.onProgress?.({
        index: i + 1,
        total,
        companyName: deal.companyName,
        phase: "done",
        email: result.dealPatch.email,
        hopper: result.dealPatch.hopper,
      });
    } catch (err) {
      if (isRateLimit(err)) return { patches, budget };
      if (isJobStoppedError(err)) return { patches, budget };
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
  if (deal.website && (budget.firecrawl > 0 || budget.smtp > 0)) return true;
  if (!deal.website && (hasNames || budget.ch > 0)) return true;
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
      const response = await fetch(`${PLACES_TEXT_URL}?query=${encodeURIComponent(query)}&key=${key}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return null;
      const data = await response.json();
      const top = data.results?.[0];
      if (!top) return null;
      let phone: string | undefined;
      let website: string | undefined;
      if (top.place_id) {
        try {
          const detailsRes = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(top.place_id)}&fields=formatted_phone_number,international_phone_number,website&key=${key}`,
            { signal: AbortSignal.timeout(8000) }
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
      if (!website) return [];
      const urls = firecrawlTargetUrls(website);
      if (canFirecrawlScrape()) {
        const fromApi = await collectPageEmails(urls, async (url) => {
          const resp = await fetch(firecrawlScrapeUrl(), {
            method: "POST",
            headers: firecrawlAuthHeaders(),
            body: JSON.stringify({ url, formats: ["markdown", "html"] }),
            signal: AbortSignal.timeout(5000),
          });
          if (!resp.ok) return null;
          const payload = await resp.json();
          return [payload?.data?.markdown, payload?.data?.html, payload?.data?.content]
            .filter(Boolean)
            .join("\n");
        });
        if (fromApi.length) return fromApi;
      }
      return collectPageEmails(urls, async (url) => {
        const resp = await fetch(url, {
          redirect: "follow",
          signal: AbortSignal.timeout(8000),
          headers: { "User-Agent": "Mozilla/5.0 StrataHarvest/1.0" },
        });
        if (!resp.ok) return null;
        return resp.text();
      });
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
    async smtpValid(email: string) {
      return (await this.smtpProbe(email)) === "deliverable";
    },
    async smtpProbe(email: string) {
      try {
        const { EmailVerificationService } = await import("./emailVerification");
        return await new EmailVerificationService().probeMailbox(email);
      } catch {
        return "unknown" as const;
      }
    },
    async mxHosts(domain: string) {
      try {
        const { resolveMx } = await import("dns/promises");
        const records = await resolveMx(domain);
        return (records || []).sort((a, b) => a.priority - b.priority).map((row) => row.exchange);
      } catch {
        return [];
      }
    },
    async osint(companyName: string) {
      const { companyEmailSearchQuery, harvestFromSearchSnippets } = await import("@shared/mailboxOsint");
      const query = companyEmailSearchQuery(companyName);
      const snippets: string[] = [];
      const key = process.env.FIRECRAWL_API_KEY?.trim();
      if (key) {
        try {
          const resp = await fetch("https://api.firecrawl.dev/v1/search", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({ query, limit: 5 }),
            signal: AbortSignal.timeout(12000),
          });
          if (resp.ok) {
            const payload = await resp.json();
            const rows = payload?.data || payload?.web || [];
            for (const row of rows) {
              snippets.push([row.title, row.description, row.url, row.markdown].filter(Boolean).join("\n"));
            }
          }
        } catch {
          // search is optional
        }
      }
      if (!snippets.length) {
        try {
          const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
            signal: AbortSignal.timeout(10000),
            headers: { "User-Agent": "Mozilla/5.0 StrataHarvest/1.0" },
          });
          if (resp.ok) snippets.push(await resp.text());
        } catch {
          // ignore
        }
      }
      const hit = harvestFromSearchSnippets({ companyName, snippets });
      return { emails: hit.emails, website: hit.websites[0] };
    },
    async wayback(website: string) {
      const emails = new Set<string>();
      for (const url of firecrawlTargetUrls(website).slice(0, 2)) {
        try {
          const cdx = await fetch(
            `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&fl=timestamp,original&filter=statuscode:200&limit=2`,
            { signal: AbortSignal.timeout(10000) }
          );
          if (!cdx.ok) continue;
          const rows = await cdx.json();
          const hits = Array.isArray(rows) ? rows.slice(1) : [];
          for (const row of hits) {
            const ts = row[0];
            const original = row[1];
            if (!ts || !original) continue;
            const snap = await fetch(`https://web.archive.org/web/${ts}id_/${original}`, {
              signal: AbortSignal.timeout(10000),
            });
            if (!snap.ok) continue;
            for (const item of emailsFromScrapedText(await snap.text())) emails.add(item);
            if (emails.size) break;
          }
        } catch {
          // archive is optional
        }
        if (emails.size) break;
      }
      return [...emails];
    },
    guessPaused: isGuessPaused(),
  };
}
