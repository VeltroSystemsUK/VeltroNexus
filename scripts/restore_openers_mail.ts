import fs from "fs";
import path from "path";
import { withJsonFileLock } from "../server/utils/jsonFileLock";
import { atomicWriteFileSync, readJsonArrayFile } from "../server/utils/atomicWriteJson";
import { hydrateFromAgentMail } from "../server/services/openers";
import type { AgentMailItem } from "../server/services/agentMailLog";

const LIVE = path.resolve("uploads", "agent_mail.json");
const SOURCES = [
  LIVE,
  path.resolve("uploads", "agent_mail.prev.json"),
  path.resolve("uploads", "agent_mail.restored-full.json"),
  path.resolve("F:/Shaun/Backups/nexus-mail/agent_mail-2026-09-12.json"),
  path.resolve("F:/Shaun/Backups/nexus-mail/agent_mail-2026-09-11.json"),
  path.resolve("F:/Shaun/Backups/nexus-mail/agent_mail-2026-09-08.json"),
  path.resolve("F:/Shaun/Backups/nexus-mail/agent_mail-2026-09-07.json"),
];

function uniq<T>(rows: T[], key: (row: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const k = key(row);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(row);
  }
  return out;
}

function mergeItem(a: AgentMailItem, b: AgentMailItem): AgentMailItem {
  const opens = uniq([...(a.opens || []), ...(b.opens || [])], (x) => String(x));
  const clicks = uniq([...(a.clicks || []), ...(b.clicks || [])], (c) => `${c.at}|${c.url}`);
  const dwells = uniq([...(a.dwells || []), ...(b.dwells || [])], (d) => `${d.at}|${d.path || ""}|${d.sf || ""}`);
  const aAtt = a.attachments?.length || 0;
  const bAtt = b.attachments?.length || 0;
  const richer = (b.html?.length || 0) > (a.html?.length || 0) ? b : a;
  return {
    ...richer,
    opens: opens.length ? opens : undefined,
    clicks: clicks.length ? clicks : undefined,
    dwells: dwells.length ? dwells : undefined,
    attachments: bAtt > aAtt ? b.attachments : a.attachments,
  };
}

function mergeStores(stores: AgentMailItem[][]): AgentMailItem[] {
  const byId = new Map<string, AgentMailItem>();
  for (const items of stores) {
    for (const item of items) {
      if (!item?.id) continue;
      const prev = byId.get(item.id);
      byId.set(item.id, prev ? mergeItem(prev, item) : item);
    }
  }
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function stats(items: AgentMailItem[]) {
  let opens = 0;
  let clicks = 0;
  let withOpens = 0;
  let withClicks = 0;
  for (const item of items) {
    const o = item.opens?.length || 0;
    const c = item.clicks?.length || 0;
    opens += o;
    clicks += c;
    if (o) withOpens++;
    if (c) withClicks++;
  }
  return { count: items.length, withOpens, opens, withClicks, clicks };
}

function load(file: string): AgentMailItem[] {
  const raw = readJsonArrayFile(file);
  if (!raw) {
    console.log(`skip ${file}`);
    return [];
  }
  const items = raw as AgentMailItem[];
  console.log(`load ${path.basename(file)} ${JSON.stringify(stats(items))}`);
  return items;
}

const stores = SOURCES.map(load);
const merged = mergeStores(stores);
console.log(`merged ${JSON.stringify(stats(merged))}`);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const safety = path.resolve("uploads", `agent_mail.pre-restore-${stamp}.json`);
withJsonFileLock(LIVE, () => {
  if (fs.existsSync(LIVE)) fs.copyFileSync(LIVE, safety);
  const liveNow = (readJsonArrayFile(LIVE) as AgentMailItem[] | null) || [];
  const final = mergeStores([merged, liveNow]);
  atomicWriteFileSync(LIVE, JSON.stringify(final, null, 2));
  console.log(`wrote live ${JSON.stringify(stats(final))} (safety ${path.basename(safety)})`);
});

const written = (readJsonArrayFile(LIVE) as AgentMailItem[]) || [];
hydrateFromAgentMail(written);
const openers = (readJsonArrayFile(path.resolve("uploads", "openers.json")) as Array<{ clickCount?: number; openCount?: number }>) || [];
const clickCards = openers.filter((row) => (row.clickCount || 0) > 0).length;
const openSum = openers.reduce((n, row) => n + (row.openCount || 0), 0);
const clickSum = openers.reduce((n, row) => n + (row.clickCount || 0), 0);
console.log(`openers cards=${openers.length} withClicks=${clickCards} openSum=${openSum} clickSum=${clickSum}`);
