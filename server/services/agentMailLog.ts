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

export function clearAgentMail() {
  writeAll([]);
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
  });
}
