import fs from "fs";
import path from "path";
import {
  fillSiteTrafficWindow,
  mergeSiteTrafficDays,
  siteTrafficFromMail,
  type MailForSiteTraffic,
  type SiteTrafficDay,
} from "@shared/siteTraffic";
import { atomicWriteFileSync } from "../utils/atomicWriteJson";

const DEFAULT_STORE = path.resolve(process.cwd(), "uploads", "site_traffic.json");
const KEEP_DAYS = 90;
let storeOverride: string | null = null;

export function setSiteTrafficStorePathForTests(filePath: string | null) {
  storeOverride = filePath;
}

function storePath(): string {
  return storeOverride || DEFAULT_STORE;
}

function parseDay(row: unknown): SiteTrafficDay | null {
  if (!row || typeof row !== "object") return null;
  const day = String((row as { day?: unknown }).day || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const n = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0);
  return {
    day,
    clicks: n((row as { clicks?: unknown }).clicks),
    uniqueClickThroughs: n((row as { uniqueClickThroughs?: unknown }).uniqueClickThroughs),
    dwells: n((row as { dwells?: unknown }).dwells),
  };
}

function readDays(): SiteTrafficDay[] {
  const file = storePath();
  if (!fs.existsSync(file)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    const rows = Array.isArray(raw) ? raw : raw?.days;
    if (!Array.isArray(rows)) return [];
    return rows.map(parseDay).filter((row): row is SiteTrafficDay => Boolean(row));
  } catch {
    return [];
  }
}

function writeDays(days: SiteTrafficDay[]) {
  atomicWriteFileSync(storePath(), JSON.stringify({ days }));
}

export function snapshotSiteTraffic(mail: MailForSiteTraffic[], now: Date = new Date()): SiteTrafficDay[] {
  const live = siteTrafficFromMail(mail);
  const merged = mergeSiteTrafficDays(readDays(), live);
  const kept = fillSiteTrafficWindow(merged, now, KEEP_DAYS);
  writeDays(kept.filter((row) => row.clicks || row.uniqueClickThroughs || row.dwells));
  return fillSiteTrafficWindow(merged, now, 30);
}
