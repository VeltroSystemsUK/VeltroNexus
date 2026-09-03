import fs from "fs";
import path from "path";
import crypto from "crypto";
import { mailboxByAddress, mailboxForAgent } from "@shared/agentMailboxes";
import { storage } from "../storage";

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
  createdAt: string;
  opens?: string[]; // ISO timestamp per tracking-pixel hit (noisy — see AgentMail.tsx tooltip)
  clicks?: Array<{ at: string; url: string }>;
  deskKind?: "stop" | "bounce" | "spam" | "responsive" | "other";
  deskNote?: string;
};

const STORE = path.resolve(process.cwd(), "uploads", "agent_mail.json");

function readAll(): AgentMailItem[] {
  if (!fs.existsSync(STORE)) return [];
  try {
    return JSON.parse(fs.readFileSync(STORE, "utf8"));
  } catch {
    return [];
  }
}

function writeAll(items: AgentMailItem[]) {
  const dir = path.dirname(STORE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE, JSON.stringify(items, null, 2));
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

export function clearAgentMail() {
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
  const withClicks = html.replace(/href="(https?:\/\/[^"]+)"/gi, (_match, url) =>
    `href="${base}/api/agent-mail/click/${id}?url=${encodeURIComponent(url)}"`
  );
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
  let dealId: number | undefined;
  let prospectId: number | undefined;
  try {
    const deals = await storage.listAgenticDeals();
    const match = deals.find((deal) => (deal.email || "").trim().toLowerCase() === fromEmail);
    if (match) {
      dealId = match.id;
      prospectId = match.prospectId;
      const body = `${payload.subject || ""} ${payload.text || ""}`.toLowerCase();
      if (/\b(stop|unsubscribe|do not contact|don't contact)\b/.test(body)) {
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
