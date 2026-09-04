import fs from "fs";
import path from "path";
import { ImapFlow } from "imapflow";
import { imapConfigFromEnv } from "@shared/imapInbox";
import { mailboxForAgent } from "@shared/agentMailboxes";
import { parseAddressList } from "@shared/imapInbox";
import {
  classifyJamesInbound,
  composeJamesDraft,
  jamesPacketMarkdown,
  jamesReplySubject,
  jamesRfc822,
  jamesShouldDraft,
  type JamesClass,
} from "@shared/jamesInbound";
import { listAgentMail, patchAgentMail, type AgentMailItem } from "./agentMailLog";

export type JamesDraftAppender = (raw: string) => Promise<void>;

let queueDirOverride: string | null = null;
let appendOverride: JamesDraftAppender | null = null;

export function setJamesQueueDirForTests(dir: string | null) {
  queueDirOverride = dir;
}

export function setJamesDraftAppenderForTests(fn: JamesDraftAppender | null) {
  appendOverride = fn;
}

function queueDir(): string {
  return queueDirOverride || path.resolve(process.cwd(), "docs", "agentic-org", "strata-inbound", "inbox", "queue");
}

function stamp(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
}

function safeId(value?: string): string {
  const raw = String(value || "thread").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return raw.slice(0, 48) || "thread";
}

async function defaultAppendDraft(raw: string): Promise<void> {
  const cfg = imapConfigFromEnv();
  if (!cfg) {
    console.warn("[SAL-1] IMAP Drafts skip — no mailbox login");
    return;
  }
  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false,
  });
  await client.connect();
  try {
    let draftsPath = "Drafts";
    for await (const box of client.list()) {
      const special = String((box as { specialUse?: string }).specialUse || "");
      if (special === "\\Drafts" || /draft/i.test(box.path)) {
        draftsPath = box.path;
        break;
      }
    }
    await client.append(draftsPath, Buffer.from(raw, "utf8"), ["\\Draft"]);
  } finally {
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }
}

export async function draftJamesReply(item: AgentMailItem): Promise<{ cls: JamesClass; packetPath?: string; drafted: boolean }> {
  if (item.direction !== "inbound") return { cls: "K", drafted: false };
  if ((item as AgentMailItem & { jamesPacketPath?: string }).jamesPacketPath) {
    return { cls: "M", drafted: false };
  }

  const mail = {
    id: item.id,
    from: item.from,
    to: item.to,
    subject: item.subject,
    text: item.text,
    html: item.html,
    messageId: item.messageId,
    createdAt: item.createdAt,
  };
  const cls = classifyJamesInbound(mail);
  if (!jamesShouldDraft(cls)) return { cls, drafted: false };

  const prior = listAgentMail(2000)
    .filter((row) => row.direction === "outbound" && parseAddressList(row.to) === parseAddressList(item.from))
    .slice(0, 3)
    .map((row) => `${row.createdAt?.slice(0, 10) || ""} ${row.subject || ""}`.trim())
    .join("; ");

  const draft = composeJamesDraft(mail, cls);
  const now = new Date().toISOString();
  const md = jamesPacketMarkdown({
    mail,
    cls,
    draft,
    receivedAt: item.createdAt || now,
    draftReadyAt: now,
    sla: "met",
    prior: prior || undefined,
  });

  const dir = queueDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = `${stamp(now)}-${safeId(item.messageId || item.id)}.md`;
  const packetPath = path.join(dir, filename);
  fs.writeFileSync(packetPath, md, "utf8");

  const mailbox = mailboxForAgent("outreach-sales");
  const raw = jamesRfc822({
    fromAddress: mailbox.address,
    fromName: mailbox.fromName,
    to: parseAddressList(item.from),
    subject: jamesReplySubject(item.subject),
    body: draft,
    inReplyTo: item.messageId,
  });

  const append = appendOverride || defaultAppendDraft;
  await append(raw);

  patchAgentMail(item.id, {
    deskNote: `SAL-1 class ${cls}. Draft in IONOS Drafts. Packet ${filename}`,
    agentId: "inbound-enquiries",
    agentName: "James Hale",
  } as Partial<AgentMailItem>);

  return { cls, packetPath, drafted: true };
}
