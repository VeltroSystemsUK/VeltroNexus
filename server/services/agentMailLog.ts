import fs from "fs";
import path from "path";
import crypto from "crypto";
import { mailboxByAddress, mailboxForAgent } from "@shared/agentMailboxes";
import { storage } from "../storage";
import { upsertOpenerFromMail } from "./openers";

export type MailDirection = "outbound" | "inbound";

export type AgentMailItem = {
  id: string;
  direction: MailDirection;
  agentId?: string;
  agentName?: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  status: "sent" | "mock" | "failed" | "received";
  messageId?: string;
  dealId?: number;
  prospectId?: number;
  touchId?: string;
  createdAt: string;
  opens?: string[]; // ISO timestamp per tracking-pixel hit (noisy — see AgentMail.tsx tooltip)
  clicks?: Array<{ at: string; url: string }>;
  deskKind?: "stop" | "bounce" | "spam" | "responsive" | "other";
  deskNote?: string;
};

const DEFAULT_STORE = path.resolve(process.cwd(), "uploads", "agent_mail.json");
const BACKUP_KEEP_MS = 14 * 24 * 60 * 60 * 1000;
export const MAIL_BACKUP_HOUR_LONDON = 3;
let storeOverride: string | null = null;
let backupDirOverride: string | null = null;
let dailyBackupTimer: ReturnType<typeof setInterval> | null = null;

export function setAgentMailStorePathForTests(filePath: string | null) {
  storeOverride = filePath;
}

export function setAgentMailBackupDirForTests(dir: string | null) {
  backupDirOverride = dir;
}

export function defaultAgentMailBackupDir(): string {
  return process.env.AGENT_MAIL_BACKUP_DIR || path.resolve("F:/Shaun/Backups/nexus-mail");
}

function storePath(): string {
  return storeOverride || DEFAULT_STORE;
}

function backupDir(): string | null {
  if (backupDirOverride) return backupDirOverride;
  if (storeOverride) return null;
  return defaultAgentMailBackupDir();
}

function londonDayAndHour(at = new Date()): { day: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: parseInt(get("hour"), 10) || 0 };
}

export function dailyMailBackupName(at = new Date()): string {
  return `agent_mail-${londonDayAndHour(at).day}.json`;
}

function pruneMailBackups(dir: string) {
  const cutoff = Date.now() - BACKUP_KEEP_MS;
  for (const name of fs.readdirSync(dir)) {
    if (!name.startsWith("agent_mail-") || !name.endsWith(".json")) continue;
    const file = path.join(dir, name);
    try {
      if (fs.statSync(file).mtimeMs < cutoff) fs.unlinkSync(file);
    } catch {
      /* ignore a missing or locked file */
    }
  }
}

function snapshotLiveStore(next: AgentMailItem[]) {
  const file = storePath();
  if (!fs.existsSync(file)) return;
  let current: AgentMailItem[] = [];
  try {
    current = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return;
  }
  if (!Array.isArray(current) || current.length === 0) return;
  const nextIds = new Set(next.map((row) => row.id));
  const dropping = current.some((row) => !nextIds.has(row.id));
  if (dropping) {
    fs.copyFileSync(file, path.join(path.dirname(file), "agent_mail.prev.json"));
  }
}

export function backupAgentMailNow(at = new Date()): string | null {
  const file = storePath();
  if (!fs.existsSync(file)) return null;
  const dest = backupDir();
  if (!dest) return null;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const target = path.join(dest, dailyMailBackupName(at));
  if (fs.existsSync(target) && fs.statSync(file).size < fs.statSync(target).size) {
    console.warn("[AgentMail] skip daily backup — live store is smaller than today's copy");
    return target;
  }
  fs.copyFileSync(file, target);
  pruneMailBackups(dest);
  return target;
}

export function maybeRunDailyMailBackup(now = new Date()): string | null {
  const { hour } = londonDayAndHour(now);
  if (hour < MAIL_BACKUP_HOUR_LONDON) return null;
  const dest = backupDir();
  if (!dest) return null;
  const target = path.join(dest, dailyMailBackupName(now));
  if (fs.existsSync(target)) return null;
  return backupAgentMailNow(now);
}

export function startAgentMailDailyBackup(intervalMs = 60_000) {
  if (dailyBackupTimer) return;
  const tick = () => {
    try {
      const dest = maybeRunDailyMailBackup();
      if (dest) console.log(`[AgentMail] daily backup ${dest}`);
    } catch (error: any) {
      console.warn("[AgentMail] daily backup failed:", error?.message || error);
    }
  };
  tick();
  dailyBackupTimer = setInterval(tick, intervalMs);
}

function readAll(): AgentMailItem[] {
  const file = storePath();
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
}

function writeAll(items: AgentMailItem[]) {
  const file = storePath();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  try {
    snapshotLiveStore(items);
  } catch (error: any) {
    console.warn("[AgentMail] backup failed:", error?.message || error);
  }
  fs.writeFileSync(file, JSON.stringify(items, null, 2));
}

export function listAgentMail(limit = 200): AgentMailItem[] {
  return readAll()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function inboundMessageIds(): Set<string> {
  const ids = new Set<string>();
  for (const item of readAll()) {
    if (item.direction !== "inbound") continue;
    const id = String(item.messageId || "").trim();
    if (id) ids.add(id);
  }
  return ids;
}

export function loggedMessageIds(): Set<string> {
  const ids = new Set<string>();
  for (const item of readAll()) {
    const id = String(item.messageId || "").trim();
    if (id) ids.add(id);
  }
  return ids;
}

export function clearAgentMail() {
  if (!storeOverride) {
    throw new Error("clearAgentMail refused: live Agent Mail store is not test-writable");
  }
  writeAll([]);
}

export function getAgentMail(id: string): AgentMailItem | undefined {
  return readAll().find((item) => item.id === id);
}

export function patchAgentMail(id: string, updates: Partial<AgentMailItem>): AgentMailItem | undefined {
  const all = readAll();
  const item = all.find((row) => row.id === id);
  if (!item) return undefined;
  Object.assign(item, updates);
  writeAll(all);
  return item;
}

export function deleteAgentMail(id: string): boolean {
  const all = readAll();
  const next = all.filter((row) => row.id !== id);
  if (next.length === all.length) return false;
  writeAll(next);
  return true;
}

export function recordOpen(id: string): AgentMailItem | undefined {
  const all = readAll();
  const item = all.find((m) => m.id === id);
  if (!item) return undefined;
  item.opens = [...(item.opens || []), new Date().toISOString()];
  writeAll(all);
  try {
    upsertOpenerFromMail(item);
  } catch (error: any) {
    console.warn("[Openers] upsert after open failed:", error?.message || error);
  }
  return item;
}

export function recordClick(id: string, url: string): AgentMailItem | undefined {
  const all = readAll();
  const item = all.find((m) => m.id === id);
  if (!item) return undefined;
  item.clicks = [...(item.clicks || []), { at: new Date().toISOString(), url }];
  writeAll(all);
  return item;
}

function trackingBaseUrl(): string {
  return (process.env.PUBLIC_APP_URL || process.env.APP_URL || "http://127.0.0.1:5000").replace(/\/$/, "");
}

// Rewrites http(s) links to route through the click tracker, and appends an
// open-tracking pixel. Only worth doing for real HTML sends with a known id.
export function injectMailTracking(html: string, id: string): string {
  const base = trackingBaseUrl();
  const withClicks = html.replace(/href="(https?:\/\/[^"]+)"/gi, (_match, url: string) => {
    if (/^https:\/\/explore\.stratanexus\.co\.uk\/?$/i.test(url)) return `href="${url}"`;
    return `href="${base}/api/agent-mail/click/${id}?url=${encodeURIComponent(url)}"`;
  });
  const pixel = `<img src="${base}/api/agent-mail/track/${id}.gif" width="1" height="1" style="display:none" alt="" />`;
  return withClicks.includes("</body>") ? withClicks.replace("</body>", `${pixel}</body>`) : `${withClicks}${pixel}`;
}

export function logAgentMail(entry: Omit<AgentMailItem, "id" | "createdAt"> & { id?: string; createdAt?: string }): AgentMailItem {
  const item: AgentMailItem = {
    id: entry.id || crypto.randomUUID(),
    createdAt: entry.createdAt || new Date().toISOString(),
    ...entry,
  };
  const all = readAll();
  all.push(item);
  writeAll(all.slice(-2000));
  return item;
}

export async function recordInbound(payload: {
  from: string;
  to: string;
  subject?: string;
  text?: string;
  html?: string;
  messageId?: string;
  createdAt?: string;
}): Promise<AgentMailItem> {
  const mailbox = mailboxByAddress(payload.to) || mailboxByAddress(payload.from);
  const fromEmail = String(payload.from || "").trim().toLowerCase();
  const body = `${payload.subject || ""} ${payload.text || ""}`.toLowerCase();
  const isOptOut = /\b(stop|unsubscribe|do not contact|don't contact)\b/.test(body);
  let dealId: number | undefined;
  let prospectId: number | undefined;
  try {
    const deals = await storage.listAgenticDeals();
    const match = deals.find((deal) => (deal.email || "").trim().toLowerCase() === fromEmail);
    if (match) {
      dealId = match.id;
      prospectId = match.prospectId;
      if (isOptOut) {
        await storage.updateAgenticDeal(match.id, {
          stage: "failed",
          status: "failed",
          events: [
            ...(match.events || []),
            {
              at: new Date().toISOString(),
              stage: "failed",
              agent: mailbox?.agentId,
              message: `Inbound opt-out from ${payload.from}. Sequence stopped.`,
            },
          ],
        });
      } else {
        await storage.updateAgenticDeal(match.id, {
          events: [
            ...(match.events || []),
            {
              at: new Date().toISOString(),
              stage: match.stage,
              agent: mailbox?.agentId,
              message: `Inbound reply from ${payload.from}: ${payload.subject || "(no subject)"}`,
            },
          ],
        });
      }
    }
  } catch (error: any) {
    console.warn("[AgentMail] Could not attach inbound to a deal:", error?.message || error);
  }

  try {
    const { stopOpenerNurtureByEmail } = await import("./openers");
    stopOpenerNurtureByEmail(fromEmail, isOptOut ? "opt_out" : "reply");
  } catch {
    // opener stop is best-effort; inbound still logged
  }

  return logAgentMail({
    direction: "inbound",
    agentId: mailbox?.agentId,
    agentName: mailbox?.displayName,
    from: payload.from,
    to: payload.to,
    subject: payload.subject || "(no subject)",
    text: payload.text || "",
    html: payload.html,
    status: "received",
    messageId: payload.messageId,
    dealId,
    prospectId,
    createdAt: payload.createdAt,
  });
}
