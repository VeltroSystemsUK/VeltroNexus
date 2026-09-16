import crypto from "crypto";
import fs from "fs";
import path from "path";
import { mailboxForAgent } from "@shared/agentMailboxes";
import { briefingGreetingName, buildCoverEmail } from "@shared/briefingCover";
import { signatureHtml } from "@shared/strataOutreach";
import {
  briefingCopyOk,
  dwellLine,
  filingsLine,
  pickBriefingHypothesis,
} from "@shared/briefingHypothesis";
import {
  BRIEFING_ENQUIRY_URL,
  defaultBriefingSlides,
  privateWallHtml,
  renderBriefingHtml,
  type BriefingRecord,
  type BriefingSlide,
  type FilledSlide,
} from "@shared/briefingRender";
import {
  MIRROR_PORTAL_TRACK_ID,
  fillMirrorPortal,
  slidesFromFilled,
} from "@shared/briefingTracks/mirrorPortal";
import { MAIL_DWELL_MS, shouldRecordMailTracking } from "@shared/mailTracking";
import {
  canPromoteOpener,
  isDoNotContactOpener,
  sendableIndustry,
  stopNurture,
  type BriefingHoldReason,
  type OpenerRecord,
} from "@shared/openers";
import { fillOutreachPackHtml, refillOutreachPackIndustry, siteCopyToBullets } from "@shared/briefingCraft";
import { helloPublicOrigin } from "@shared/helloHost";
import { inConvertSendWindow, londonDateKey } from "@shared/smeConvert";
import { SME_DAILY_FIRST_TOUCH_CAP } from "@shared/smeOutreach";
import {
  assertBriefingPackLinks,
  checkBriefingHttpLinks,
  collectBriefingLinks,
} from "@shared/briefingLinks";
import { atomicWriteFileSync } from "../utils/atomicWriteJson";
import { fetchWebsiteText, normalizeWebsiteUrl } from "../utils/companyEnrichment";
import { listAgentMail } from "./agentMailLog";
import { sendEmail } from "./email";
import * as mailDesk from "./mailDesk";
import { getOpener, listOpeners, onOpenerUnsubscribed, patchOpener, promoteOpener } from "./openers";

export type { BriefingRecord, BriefingSlide };
export { defaultBriefingSlides, privateWallHtml, renderBriefingHtml, BRIEFING_ENQUIRY_URL };

export const BRIEFINGS_STORE = path.resolve(process.cwd(), "uploads", "briefings.json");

const DRAFT_COVER_URL = "about:blank";

let storePathForTests: string | null = null;

export function setBriefingsStorePathForTests(filePath: string | null): void {
  storePathForTests = filePath;
}

function storePath(): string {
  return storePathForTests || process.env.BRIEFINGS_PATH || BRIEFINGS_STORE;
}

function httpError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

function nowIso(): string {
  return new Date().toISOString();
}

function asSlide(row: unknown): BriefingSlide | undefined {
  if (!row || typeof row !== "object") return undefined;
  const slide = row as Partial<BriefingSlide>;
  if (!slide.title || !slide.body) return undefined;
  return {
    title: String(slide.title),
    body: String(slide.body),
    enquiryUrl: slide.enquiryUrl ? String(slide.enquiryUrl) : undefined,
    veltroUrl: slide.veltroUrl ? String(slide.veltroUrl) : undefined,
  };
}

function asFilledSlide(row: unknown): FilledSlide | undefined {
  if (!row || typeof row !== "object") return undefined;
  const slide = row as Partial<FilledSlide>;
  if (!slide.slideId || !slide.title || slide.body == null) return undefined;
  const filled: FilledSlide = {
    slideId: String(slide.slideId),
    theme: String(slide.theme || ""),
    title: String(slide.title),
    body: String(slide.body),
    visualNote: String(slide.visualNote || ""),
  };
  if (Array.isArray(slide.links)) {
    const links = slide.links
      .filter(
        (link): link is { label: string; href: string } =>
          Boolean(link && typeof link === "object" && link.label && link.href)
      )
      .map((link) => ({ label: String(link.label), href: String(link.href) }));
    if (links.length) filled.links = links;
  }
  return filled;
}

function normalizeBriefing(row: unknown): BriefingRecord | undefined {
  if (!row || typeof row !== "object") return undefined;
  const rec = row as Partial<BriefingRecord>;
  if (!rec.id || !rec.token || !rec.openerId) return undefined;
  const status = rec.status === "live" || rec.status === "revoked" ? rec.status : "draft";
  const slides = Array.isArray(rec.slides)
    ? rec.slides.map(asSlide).filter((slide): slide is BriefingSlide => Boolean(slide))
    : [];
  const cover =
    rec.cover && typeof rec.cover === "object"
      ? { subject: String(rec.cover.subject || ""), html: String(rec.cover.html || "") }
      : { subject: "", html: "" };
  const filledSlides = Array.isArray(rec.filledSlides)
    ? rec.filledSlides.map(asFilledSlide).filter((slide): slide is FilledSlide => Boolean(slide))
    : undefined;
  return {
    id: String(rec.id),
    token: String(rec.token),
    openerId: String(rec.openerId),
    companyName: String(rec.companyName || ""),
    status,
    slides,
    packHtml: rec.packHtml ? String(rec.packHtml) : undefined,
    cover,
    sentAt: rec.sentAt,
    revokedAt: rec.revokedAt,
    dwellAt: rec.dwellAt,
    openedAt: rec.openedAt,
    slidesViewed: Array.isArray(rec.slidesViewed)
      ? rec.slidesViewed.filter((n): n is number => typeof n === "number")
      : [],
    createdAt: rec.createdAt || nowIso(),
    trackId: rec.trackId ? String(rec.trackId) : undefined,
    filledSlides,
    generatedAt: rec.generatedAt ? String(rec.generatedAt) : undefined,
    coverSentAt: rec.coverSentAt ? String(rec.coverSentAt) : undefined,
  };
}

function readBriefings(): BriefingRecord[] {
  const file = storePath();
  if (!fs.existsSync(file)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeBriefing).filter((row): row is BriefingRecord => Boolean(row));
  } catch {
    return [];
  }
}

function writeBriefings(items: BriefingRecord[]): void {
  atomicWriteFileSync(storePath(), JSON.stringify(items, null, 2));
}

export function mintBriefingToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function copyBlob(record: Pick<BriefingRecord, "cover" | "slides" | "filledSlides">): string {
  const filled = record.filledSlides || [];
  const bodies = filled.length
    ? filled.flatMap((slide) => [
        slide.body,
        ...(slide.links || []).map((link) => `${link.label}\n${link.href}`),
      ])
    : record.slides.map(
        (slide) => `${slide.title}\n${slide.body}\n${slide.enquiryUrl || ""}\n${slide.veltroUrl || ""}`
      );
  return [record.cover.subject, record.cover.html, ...bodies].join("\n");
}

function assertCopyOk(record: Pick<BriefingRecord, "cover" | "slides" | "filledSlides">): void {
  const guard = briefingCopyOk(copyBlob(record));
  if (!guard.ok) throw httpError("Briefing copy failed guard", 400);
}

export function getBriefing(id: string): BriefingRecord | undefined {
  return readBriefings().find((row) => row.id === id);
}

export function getLiveBriefingByToken(token: string): BriefingRecord | undefined {
  if (!token) return undefined;
  return readBriefings().find((row) => row.token === token && row.status === "live");
}

const OUTREACH_PACK_PATH = path.resolve(process.cwd(), "customer-visual-aids.html");

function housePackHtml(bind: { companyName: string; industry: string }): string {
  const template = fs.readFileSync(OUTREACH_PACK_PATH, "utf8");
  return fillOutreachPackHtml(template, {
    companyName: bind.companyName,
    industry: bind.industry,
  });
}

function bindFromOpener(opener: OpenerRecord) {
  const companyName = opener.companyName || opener.email || "your company";
  return {
    companyName,
    industry: sendableIndustry(opener) || "your trade",
    dwellLine: dwellLine({ dwellCount: opener.dwellCount, lastDwellPath: opener.lastDwellPath }),
    filingsLine: filingsLine({
      dateOfCreation: opener.dateOfCreation,
      sicCodes: opener.sicCodes,
      liveCharges: opener.liveCharges,
      nonBankChargeCount: opener.nonBankChargeCount,
    }),
    hypothesis: pickBriefingHypothesis({
      nonBankChargeCount: opener.nonBankChargeCount,
      sicCodes: opener.sicCodes,
      lastDwellPath: opener.lastDwellPath,
      dwellCount: opener.dwellCount,
    }),
    enquiryUrl: BRIEFING_ENQUIRY_URL,
  };
}

export function createDraftBriefing(opener: OpenerRecord): BriefingRecord {
  const token = mintBriefingToken();
  const bind = { ...bindFromOpener(opener), veltroUrl: `/veltro?b=${token}` };
  const filled = fillMirrorPortal(bind);
  const slides = slidesFromFilled(filled);
  const cover = buildCoverEmail({
    companyName: bind.companyName,
    firstName: briefingGreetingName(opener.directors),
    briefingUrl: DRAFT_COVER_URL,
  });
  const at = nowIso();
  const record: BriefingRecord = {
    id: crypto.randomUUID(),
    token,
    openerId: opener.id,
    companyName: bind.companyName,
    status: "draft",
    slides,
    filledSlides: filled,
    packHtml: housePackHtml(bind),
    trackId: MIRROR_PORTAL_TRACK_ID,
    generatedAt: at,
    cover,
    slidesViewed: [],
    createdAt: at,
  };
  assertCopyOk(record);
  const all = readBriefings();
  all.push(record);
  writeBriefings(all);
  return record;
}

function withLiveUrls(row: BriefingRecord): BriefingRecord {
  const briefingPath = `/briefing/${row.token}`;
  const veltroUrl = `/veltro?b=${row.token}`;
  return {
    ...row,
    status: "live",
    sentAt: row.sentAt || nowIso(),
    cover: {
      ...row.cover,
      html: row.cover.html.replaceAll(DRAFT_COVER_URL, briefingPath),
    },
    slides: row.slides.map((slide) =>
      slide.title === "Outreach" || slide.title === "Next step" || Boolean(slide.veltroUrl)
        ? { ...slide, veltroUrl }
        : slide
    ),
  };
}

export function activateBriefing(id: string): BriefingRecord {
  const all = readBriefings();
  const idx = all.findIndex((row) => row.id === id);
  if (idx < 0) throw httpError("Briefing not found", 404);
  if (all[idx].status === "revoked") throw httpError("Briefing revoked", 409);
  const next = withLiveUrls(all[idx]);
  assertCopyOk(next);
  all[idx] = next;
  writeBriefings(all);
  return next;
}

function revokeRow(row: BriefingRecord, at: string): BriefingRecord {
  if (row.status === "revoked") return row;
  return { ...row, status: "revoked", revokedAt: at };
}

export function revokeBriefing(idOrTokenOrOpenerId: string): void {
  if (!idOrTokenOrOpenerId) return;
  const all = readBriefings();
  let changed = false;
  const at = nowIso();
  const next = all.map((row) => {
    const hit =
      row.id === idOrTokenOrOpenerId ||
      row.token === idOrTokenOrOpenerId ||
      row.openerId === idOrTokenOrOpenerId;
    if (!hit || row.status === "revoked") return row;
    changed = true;
    return revokeRow(row, at);
  });
  if (changed) writeBriefings(next);
}

export function revokeBriefingsForOpener(openerId: string): void {
  if (!openerId) return;
  const all = readBriefings();
  let changed = false;
  const at = nowIso();
  const next = all.map((row) => {
    if (row.openerId !== openerId || row.status === "revoked") return row;
    changed = true;
    return revokeRow(row, at);
  });
  if (changed) writeBriefings(next);
}

function requireOpenerRecord(id: string): OpenerRecord {
  const opener = getOpener(id);
  if (!opener) throw httpError("Opener not found", 404);
  return opener;
}

function openerBriefing(opener: OpenerRecord): BriefingRecord | undefined {
  return opener.briefingId ? getBriefing(opener.briefingId) : undefined;
}

export function openerBriefingIsDesigned(opener: OpenerRecord): boolean {
  const briefing = openerBriefing(opener);
  return Boolean(briefing && briefing.status !== "revoked" && briefing.packHtml);
}

export function briefingPublicUrl(token: string, baseUrl?: string): string {
  const base = String(baseUrl || helloPublicOrigin()).replace(/\/$/, "");
  return `${base}/briefing/${token}`;
}

export function openerBriefingBind(opener: OpenerRecord): ReturnType<typeof bindFromOpener> {
  return bindFromOpener(opener);
}

export const BRIEFING_TICK_SEND_CAP = 10;

let smtpReadyForTests: boolean | null = null;

export function setBriefingSmtpReadyForTests(value: boolean | null): void {
  smtpReadyForTests = value;
}

function briefingSmtpReady(): boolean {
  if (smtpReadyForTests != null) return smtpReadyForTests;
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return true;
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return true;
  return false;
}

function holdOpener(opener: OpenerRecord, reason: BriefingHoldReason, detail?: string): void {
  patchOpener(opener.id, {
    briefingHold: { reason, at: nowIso(), ...(detail ? { detail } : {}) },
  });
}

function clearBriefingHold(openerId: string): void {
  patchOpener(openerId, { briefingHold: undefined });
}

function hasCoverSend(opener: OpenerRecord, briefing?: BriefingRecord): boolean {
  if (briefing?.coverSentAt) return true;
  const email = opener.email;
  return listAgentMail(5000).some(
    (row) =>
      row.direction === "outbound" &&
      row.touchId === "direct_outreach" &&
      (row.status === "sent" || row.status === "mock") &&
      String(row.to || "").toLowerCase().includes(email)
  );
}

function directorSendsToday(now: Date): number {
  const day = londonDateKey(now.toISOString());
  const mailbox = mailboxForAgent("director").address.toLowerCase();
  return listAgentMail(5000).filter((row) => {
    if (row.direction !== "outbound" || row.status !== "sent") return false;
    if (!String(row.from || "").toLowerCase().includes(mailbox)) return false;
    return londonDateKey(row.createdAt) === day;
  }).length;
}

function ensureDraftBriefing(opener: OpenerRecord): BriefingRecord {
  const existing = openerBriefing(opener);
  if (existing && existing.status !== "revoked") return existing;
  const draft = createDraftBriefing(opener);
  patchOpener(opener.id, { briefingId: draft.id });
  return draft;
}

function refillBriefingIndustry(briefing: BriefingRecord, opener: OpenerRecord, industry: string): BriefingRecord {
  const bind = { ...bindFromOpener(opener), industry, veltroUrl: `/veltro?b=${briefing.token}` };
  const filled = fillMirrorPortal(bind);
  const packHtml = briefing.packHtml
    ? refillOutreachPackIndustry(briefing.packHtml, industry)
    : housePackHtml(bind);
  const next: BriefingRecord = {
    ...briefing,
    filledSlides: filled,
    slides: slidesFromFilled(filled),
    packHtml,
  };
  const all = readBriefings();
  const idx = all.findIndex((row) => row.id === briefing.id);
  if (idx >= 0) {
    all[idx] = next;
    writeBriefings(all);
  }
  return next;
}

async function assertPackLinksLive(packHtml: string): Promise<void> {
  const origin = helloPublicOrigin();
  const structural = assertBriefingPackLinks(packHtml, origin);
  if (!structural.ok) {
    throw httpError(structural.failures[0]?.href || "link_dead", 409);
  }
  const { hrefs } = collectBriefingLinks(packHtml);
  const http = await checkBriefingHttpLinks(hrefs, { origin });
  if (!http.ok) throw httpError(http.failures[0]?.href || "link_dead", 409);
}

function packContainsIndustry(packHtml: string | undefined, industry: string): boolean {
  if (!packHtml) return false;
  return packHtml.includes(industry);
}

function isHousePack(html?: string): boolean {
  return Boolean(
    html &&
      html.includes('data-id="slide_1"') &&
      html.includes("briefing-pack") &&
      html.includes('data-pack-nav="v3"')
  );
}

function withHousePack(row: BriefingRecord, opener: OpenerRecord): BriefingRecord {
  const bind = bindFromOpener(opener);
  return { ...row, packHtml: housePackHtml(bind) };
}

export async function generateOpenerBriefing(id: string): Promise<BriefingRecord> {
  const opener = requireOpenerRecord(id);
  if (opener.status !== "direct_outreach") {
    throw httpError("Only Direct Outreach cards can generate a briefing", 409);
  }
  const existing = openerBriefing(opener);
  if (existing && existing.status !== "revoked") {
    if (isHousePack(existing.packHtml)) return existing;
    const next = withHousePack(existing, opener);
    const all = readBriefings();
    const idx = all.findIndex((row) => row.id === existing.id);
    if (idx >= 0) {
      all[idx] = next;
      writeBriefings(all);
    }
    return next;
  }
  const draft = createDraftBriefing(opener);
  patchOpener(opener.id, { briefingId: draft.id });
  return draft;
}

export async function fetchOpenerBriefingSite(
  id: string,
  rawUrl: string
): Promise<{ url: string; bullets: string[] }> {
  requireDirectOutreach(id);
  const url = normalizeWebsiteUrl(rawUrl);
  if (!url) throw httpError("Website URL is required", 400);
  const text = await fetchWebsiteText(url);
  const bullets = siteCopyToBullets(text);
  if (!bullets.length) throw httpError("That website returned no usable copy", 422);
  return { url, bullets };
}

export function saveOpenerBriefingHtml(id: string, html: string): BriefingRecord {
  const opener = requireDirectOutreach(id);
  const briefing = openerBriefing(opener);
  if (!briefing || briefing.status === "revoked") throw httpError("Generate a briefing first", 409);
  const packHtml = String(html || "").trim();
  if (!packHtml.includes("briefing-pack")) throw httpError("Pack HTML is missing", 400);
  const all = readBriefings();
  const idx = all.findIndex((row) => row.id === briefing.id);
  if (idx < 0) throw httpError("Briefing not found", 404);
  const next: BriefingRecord = { ...briefing, packHtml };
  assertCopyOk(next);
  all[idx] = next;
  writeBriefings(all);
  return next;
}

export function publishOpenerBriefingPage(
  id: string,
  opts?: { publicBaseUrl?: string }
): { briefing: BriefingRecord; pageUrl: string } {
  const opener = requireDirectOutreach(id);
  if (isDoNotContactOpener(opener) || mailDesk.mailIsSuppressed(opener.email, opener.companyNumber)) {
    throw httpError("Suppressed", 403);
  }
  const draft = openerBriefing(opener);
  if (!draft || draft.status === "revoked") throw httpError("Generate a briefing first", 409);
  if (!draft.packHtml) throw httpError("Convert to HTML first", 409);
  const live = activateBriefing(draft.id);
  return { briefing: live, pageUrl: briefingPublicUrl(live.token, opts?.publicBaseUrl) };
}

function requireDirectOutreach(id: string): OpenerRecord {
  const opener = requireOpenerRecord(id);
  if (opener.status !== "direct_outreach") {
    throw httpError("Only Direct Outreach cards can generate a briefing", 409);
  }
  return opener;
}

export function previewOpenerBriefingHtml(id: string): string {
  const opener = requireOpenerRecord(id);
  const briefing = openerBriefing(opener);
  if (!briefing || briefing.status === "revoked") throw httpError("Generate a briefing first", 409);
  return renderBriefingHtml(briefing, { live: false });
}

export function updateOpenerBriefing(
  id: string,
  patch: { coverSubject?: string; coverHtml?: string; slides?: unknown[] }
): BriefingRecord {
  const opener = requireOpenerRecord(id);
  const briefing = openerBriefing(opener);
  if (!briefing || briefing.status === "revoked") throw httpError("Generate a briefing first", 409);
  const all = readBriefings();
  const idx = all.findIndex((row) => row.id === briefing.id);
  if (idx < 0) throw httpError("Briefing not found", 404);
  const slides =
    patch.slides === undefined
      ? briefing.slides
      : (Array.isArray(patch.slides) ? patch.slides : [])
          .map(asSlide)
          .filter((slide): slide is BriefingSlide => Boolean(slide));
  const next: BriefingRecord = {
    ...briefing,
    cover: {
      subject: patch.coverSubject != null ? String(patch.coverSubject) : briefing.cover.subject,
      html: patch.coverHtml != null ? String(patch.coverHtml) : briefing.cover.html,
    },
    slides,
  };
  assertCopyOk(next);
  all[idx] = next;
  writeBriefings(all);
  return next;
}

function requireDesignedBriefing(id: string): { opener: OpenerRecord; briefing: BriefingRecord } {
  const opener = requireOpenerRecord(id);
  if (isDoNotContactOpener(opener) || mailDesk.mailIsSuppressed(opener.email, opener.companyNumber)) {
    throw httpError("Suppressed", 403);
  }
  const briefing = openerBriefing(opener);
  if (!briefing || briefing.status === "revoked") throw httpError("Generate a briefing first", 409);
  if (!briefing.packHtml) throw httpError("Design the briefing and convert to HTML before sending", 409);
  return { opener, briefing };
}

function signedCoverFor(
  opener: OpenerRecord,
  briefing: BriefingRecord,
  briefingUrl: string
): { subject: string; html: string } {
  const mailbox = mailboxForAgent("director");
  const built = buildCoverEmail({
    companyName: opener.companyName || opener.email,
    firstName: briefingGreetingName(opener.directors),
    briefingUrl,
  });
  return {
    subject: briefing.cover.subject || built.subject,
    html: `${built.html}\n${signatureHtml(mailbox)}`,
  };
}

export function previewOpenerBriefingSend(
  id: string,
  opts?: { publicBaseUrl?: string }
): { subject: string; html: string; packHtml: string } {
  const { opener, briefing } = requireDesignedBriefing(id);
  const cover = signedCoverFor(opener, briefing, briefingPublicUrl(briefing.token, opts?.publicBaseUrl));
  return {
    subject: cover.subject,
    html: cover.html,
    packHtml: briefing.packHtml as string,
  };
}

function holdError(reason: BriefingHoldReason, detail?: string): Error {
  return Object.assign(new Error(detail || reason), { status: 409, holdReason: reason, detail });
}

export async function sendOpenerBriefing(
  id: string,
  opts?: { publicBaseUrl?: string }
): Promise<BriefingRecord> {
  const { opener, briefing: draft } = requireDesignedBriefing(id);
  const industry = sendableIndustry(opener);
  if (!industry) throw holdError("industry_unknown", opener.sicCodes[0] ? `SIC ${opener.sicCodes[0]}` : undefined);
  let briefing = draft;
  if (!packContainsIndustry(briefing.packHtml, industry)) {
    briefing = refillBriefingIndustry(briefing, opener, industry);
  }
  if (!packContainsIndustry(briefing.packHtml, industry)) {
    throw holdError("industry_unknown", industry);
  }
  try {
    await assertPackLinksLive(String(briefing.packHtml || ""));
  } catch (error) {
    const href = error instanceof Error ? error.message : "link_dead";
    throw holdError("link_dead", href);
  }
  const alreadyLive = briefing.status === "live";
  const live = activateBriefing(briefing.id);
  const mailbox = mailboxForAgent("director");
  const coverUrl = briefingPublicUrl(live.token, opts?.publicBaseUrl);
  const coverCheck = await checkBriefingHttpLinks([coverUrl], { origin: helloPublicOrigin() });
  if (!coverCheck.ok) {
    if (!alreadyLive) revokeBriefing(live.id);
    throw holdError("link_dead", coverUrl);
  }
  const cover = signedCoverFor(opener, live, coverUrl);
  const result = await sendEmail(
    {
      agentId: mailbox.agentId,
      fromName: mailbox.fromName,
      fromEmail: mailbox.address,
      touchId: "direct_outreach",
    },
    opener.email,
    cover.subject,
    cover.html
  );
  if (!result.success) {
    if (!alreadyLive) revokeBriefing(live.id);
    if (result.blocked === "suppressed") throw httpError("Suppressed", 403);
    throw holdError("smtp");
  }
  const sent: BriefingRecord = { ...live, coverSentAt: nowIso() };
  const all = readBriefings();
  const idx = all.findIndex((row) => row.id === live.id);
  if (idx >= 0) {
    all[idx] = sent;
    writeBriefings(all);
  }
  clearBriefingHold(opener.id);
  return sent;
}

export async function tickDirectOutreachBriefings(now: Date = new Date()): Promise<number> {
  if (!inConvertSendWindow(now)) return 0;
  let sent = 0;
  for (const opener of listOpeners()) {
    if (opener.status !== "direct_outreach") continue;
    try {
      if (isDoNotContactOpener(opener) || mailDesk.mailIsSuppressed(opener.email, opener.companyNumber)) {
        const stopped = stopNurture(opener, "opt_out");
        patchOpener(opener.id, stopped);
        onOpenerUnsubscribed(opener.id);
        continue;
      }
      const current = getOpener(opener.id) || opener;
      const briefing = current.briefingId ? getBriefing(current.briefingId) : undefined;
      if (hasCoverSend(current, briefing)) continue;
      if (!current.email) {
        holdOpener(current, "no_mailbox");
        continue;
      }
      if (!briefingSmtpReady()) {
        holdOpener(current, "smtp");
        continue;
      }
      if (directorSendsToday(now) >= SME_DAILY_FIRST_TOUCH_CAP) {
        holdOpener(current, "volume_cap");
        continue;
      }
      if (sent >= BRIEFING_TICK_SEND_CAP) continue;
      const draft = ensureDraftBriefing(current);
      if (!draft.packHtml || !draft.packHtml.includes("briefing-pack")) {
        holdOpener(current, "pack_missing");
        continue;
      }
      await sendOpenerBriefing(current.id, { publicBaseUrl: helloPublicOrigin() });
      sent += 1;
    } catch (error) {
      const reason = (error as { holdReason?: BriefingHoldReason }).holdReason;
      const detail = (error as { detail?: string }).detail;
      if (reason) holdOpener(opener, reason, detail);
      else if (error instanceof Error && /guard/i.test(error.message)) holdOpener(opener, "copy_guard");
      else holdOpener(opener, "smtp", error instanceof Error ? error.message : undefined);
    }
  }
  return sent;
}

export type BriefingTrackOpts = { staffSession?: boolean; referer?: string };

function briefingDwellScript(token: string): string {
  const safe = JSON.stringify(String(token || ""));
  return `<script>
(() => {
  try {
    const token = ${safe};
    const sentKey = "sf_briefing_dwell_sent_" + token;
    if (sessionStorage.getItem(sentKey)) return;
    setTimeout(() => {
      if (sessionStorage.getItem(sentKey)) return;
      sessionStorage.setItem(sentKey, "1");
      const img = new Image();
      img.src = "/api/briefing/" + encodeURIComponent(token) + "/dwell.gif";
    }, ${MAIL_DWELL_MS});
    document.querySelectorAll("[data-testid^='briefing-slide-']").forEach((el, index) => {
      const io = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        fetch("/api/briefing/" + encodeURIComponent(token) + "/slide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ index }),
          keepalive: true,
        }).catch(() => {});
      }, { threshold: 0.5 });
      io.observe(el);
    });
  } catch (e) {}
})();
</script>`;
}

export function briefingHtmlForToken(token: string): string {
  const live = getLiveBriefingByToken(token);
  if (!live) return privateWallHtml();
  const html = renderBriefingHtml(live, { live: true });
  return html.replace("</body>", `${briefingDwellScript(live.token)}</body>`);
}

export function recordBriefingDwell(
  token: string,
  opts: BriefingTrackOpts = {}
): { recorded: boolean; already?: boolean } {
  if (!shouldRecordMailTracking({ staffSession: opts.staffSession, referer: opts.referer })) {
    return { recorded: false };
  }
  const all = readBriefings();
  const idx = all.findIndex((row) => row.token === token && row.status === "live");
  if (idx < 0) return { recorded: false };
  if (all[idx].dwellAt) return { recorded: false, already: true };
  const at = nowIso();
  all[idx] = { ...all[idx], dwellAt: at, openedAt: all[idx].openedAt || at };
  writeBriefings(all);
  return { recorded: true };
}

export async function recordBriefingDwellAndPromote(
  token: string,
  opts: BriefingTrackOpts & { userId?: string } = {}
): Promise<{ recorded: boolean; already?: boolean; promoted: boolean }> {
  const dwell = recordBriefingDwell(token, opts);
  if (!dwell.recorded) return { ...dwell, promoted: false };
  const live = getLiveBriefingByToken(token);
  const opener = live ? getOpener(live.openerId) : undefined;
  if (!opener || !canPromoteOpener(opener) || isDoNotContactOpener(opener)) {
    return { recorded: true, promoted: false };
  }
  try {
    await promoteOpener(opener.id, opts.userId || "");
    return { recorded: true, promoted: true };
  } catch {
    return { recorded: true, promoted: false };
  }
}

export function recordVeltroInterest(token: string): { flagged: boolean } {
  const live = getLiveBriefingByToken(token);
  if (!live) return { flagged: false };
  const opener = patchOpener(live.openerId, { veltroInterestAt: nowIso() });
  return { flagged: Boolean(opener) };
}

export function recordBriefingSlide(
  token: string,
  index: unknown,
  opts: BriefingTrackOpts = {}
): { recorded: boolean } {
  if (!shouldRecordMailTracking({ staffSession: opts.staffSession, referer: opts.referer })) {
    return { recorded: false };
  }
  const slideIndex = typeof index === "number" ? index : Number(index);
  if (!Number.isInteger(slideIndex) || slideIndex < 0) return { recorded: false };
  const all = readBriefings();
  const idx = all.findIndex((row) => row.token === token && row.status === "live");
  if (idx < 0) return { recorded: false };
  const viewed = new Set(all[idx].slidesViewed);
  viewed.add(slideIndex);
  const at = nowIso();
  all[idx] = {
    ...all[idx],
    slidesViewed: [...viewed].sort((a, b) => a - b),
    openedAt: all[idx].openedAt || at,
  };
  writeBriefings(all);
  return { recorded: true };
}
