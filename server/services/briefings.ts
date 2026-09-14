import crypto from "crypto";
import fs from "fs";
import path from "path";
import { mailboxForAgent } from "@shared/agentMailboxes";
import { buildCoverEmail } from "@shared/briefingCover";
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
} from "@shared/briefingRender";
import { isDoNotContactOpener, type OpenerRecord } from "@shared/openers";
import { atomicWriteFileSync } from "../utils/atomicWriteJson";
import { sendEmail } from "./email";
import * as mailDesk from "./mailDesk";
import { getOpener, patchOpener } from "./openers";

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
  return {
    id: String(rec.id),
    token: String(rec.token),
    openerId: String(rec.openerId),
    companyName: String(rec.companyName || ""),
    status,
    slides,
    cover,
    sentAt: rec.sentAt,
    revokedAt: rec.revokedAt,
    dwellAt: rec.dwellAt,
    openedAt: rec.openedAt,
    slidesViewed: Array.isArray(rec.slidesViewed)
      ? rec.slidesViewed.filter((n): n is number => typeof n === "number")
      : [],
    createdAt: rec.createdAt || nowIso(),
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

function copyBlob(record: Pick<BriefingRecord, "cover" | "slides">): string {
  return [
    record.cover.subject,
    record.cover.html,
    ...record.slides.map(
      (slide) => `${slide.title}\n${slide.body}\n${slide.enquiryUrl || ""}\n${slide.veltroUrl || ""}`
    ),
  ].join("\n");
}

function assertCopyOk(record: Pick<BriefingRecord, "cover" | "slides">): void {
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

export function createDraftBriefing(
  opener: OpenerRecord & { lastDwellPath?: string }
): BriefingRecord {
  const companyName = opener.companyName || opener.email || "your company";
  const lastDwellPath = opener.lastDwellPath;
  const hypothesis = pickBriefingHypothesis({
    nonBankChargeCount: opener.nonBankChargeCount,
    sicCodes: opener.sicCodes,
    lastDwellPath,
    dwellCount: opener.dwellCount,
  });
  const slides = defaultBriefingSlides({
    companyName,
    dwellLine: dwellLine({ dwellCount: opener.dwellCount, lastDwellPath }),
    filingsLine: filingsLine({
      dateOfCreation: opener.dateOfCreation,
      sicCodes: opener.sicCodes,
      liveCharges: opener.liveCharges,
      nonBankChargeCount: opener.nonBankChargeCount,
    }),
    hypothesis,
    enquiryUrl: BRIEFING_ENQUIRY_URL,
  });
  const cover = buildCoverEmail({
    companyName,
    briefingUrl: DRAFT_COVER_URL,
  });
  const record: BriefingRecord = {
    id: crypto.randomUUID(),
    token: mintBriefingToken(),
    openerId: opener.id,
    companyName,
    status: "draft",
    slides,
    cover,
    slidesViewed: [],
    createdAt: nowIso(),
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
      slide.title === "Next step" || slide.enquiryUrl ? { ...slide, veltroUrl } : slide
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

export function briefingPublicUrl(token: string, baseUrl?: string): string {
  const base = String(
    baseUrl || process.env.PUBLIC_APP_URL || process.env.APP_URL || "http://localhost"
  ).replace(/\/$/, "");
  return `${base}/briefing/${token}`;
}

export async function generateOpenerBriefing(id: string): Promise<BriefingRecord> {
  const opener = requireOpenerRecord(id);
  if (opener.status !== "direct_outreach") {
    throw httpError("Only Direct Outreach cards can generate a briefing", 409);
  }
  const draft = createDraftBriefing(opener);
  patchOpener(opener.id, { briefingId: draft.id });
  return draft;
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

export async function sendOpenerBriefing(
  id: string,
  opts?: { publicBaseUrl?: string }
): Promise<BriefingRecord> {
  const opener = requireOpenerRecord(id);
  if (isDoNotContactOpener(opener) || mailDesk.mailIsSuppressed(opener.email, opener.companyNumber)) {
    throw httpError("Suppressed", 403);
  }
  const draft = openerBriefing(opener);
  if (!draft || draft.status === "revoked") throw httpError("Generate a briefing first", 409);
  const alreadyLive = draft.status === "live";
  const live = activateBriefing(draft.id);
  const mailbox = mailboxForAgent("director");
  const briefingUrl = briefingPublicUrl(live.token, opts?.publicBaseUrl);
  const built = buildCoverEmail({
    companyName: opener.companyName || opener.email,
    briefingUrl,
  });
  const cover = {
    subject: live.cover.subject || built.subject,
    html: (live.cover.html || built.html)
      .replaceAll("about:blank", briefingUrl)
      .replaceAll(`/briefing/${live.token}`, briefingUrl),
  };
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
    throw httpError("Send failed", 502);
  }
  return live;
}
