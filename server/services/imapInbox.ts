import { randomUUID } from "crypto";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import {
  IMAP_QUARANTINE_FALLBACKS,
  imapConfigFromEnv,
  inboundAlreadyLogged,
  parseAddressList,
  pickMailboxPath,
} from "@shared/imapInbox";
import { mailNeedsAttachmentBackfill, shouldKeepMailAttachment } from "@shared/agentMailAttachments";
import {
  getAgentMail,
  inboundMessageIds,
  listAgentMail,
  logAgentMail,
  loggedMessageIds,
  patchAgentMail,
  recordInbound,
  type AgentMailItem,
} from "./agentMailLog";
import { persistMailAttachments } from "./agentMailAttachments";
import { mailboxByAddress } from "@shared/agentMailboxes";
import { isMailerDaemonAddress } from "@shared/mailDesk";
import { processAgentInbox } from "./mailDesk";

let running = false;

function addressesOf(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return parseAddressList(value);
  if (Array.isArray(value)) {
    const first = value[0] as { address?: string; text?: string } | string | undefined;
    if (!first) return "";
    if (typeof first === "string") return parseAddressList(first);
    return parseAddressList(first.address || first.text);
  }
  const row = value as { value?: Array<{ address?: string }>; text?: string };
  const addr = row.value?.[0]?.address || row.text;
  return parseAddressList(addr);
}

function parsedAttachments(parsed: { attachments?: Parameters<typeof persistMailAttachments>[1] }) {
  return parsed.attachments || [];
}

function keepableCount(parsed: { attachments?: Parameters<typeof persistMailAttachments>[1] }) {
  return parsedAttachments(parsed).filter(shouldKeepMailAttachment).length;
}

function backfillAttachmentsIfNeeded(
  item: AgentMailItem | undefined,
  parsed: { attachments?: Parameters<typeof persistMailAttachments>[1] },
): boolean {
  if (!item || !mailNeedsAttachmentBackfill(item, keepableCount(parsed))) return false;
  const attachments = persistMailAttachments(item.id, parsedAttachments(parsed));
  if (!attachments.length) return false;
  patchAgentMail(item.id, { attachments });
  item.attachments = attachments;
  return true;
}

function trackingIdFromHtml(html?: string): string | undefined {
  const match = String(html || "").match(
    /\/api\/agent-mail\/track\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.gif/i,
  );
  return match?.[1];
}

async function resolveMailbox(client: ImapFlow, specialUse: string, fallbacks: string[]): Promise<string | null> {
  try {
    const boxes = await client.list();
    const hit = pickMailboxPath(boxes, specialUse, fallbacks);
    if (hit) return hit;
  } catch {
    /* list can fail on some hosts */
  }
  for (const name of fallbacks) {
    try {
      const lock = await client.getMailboxLock(name);
      lock.release();
      return name;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function ensureQuarantinePath(client: ImapFlow): Promise<string> {
  try {
    const boxes = await client.list();
    const hit = pickMailboxPath(boxes, "", IMAP_QUARANTINE_FALLBACKS);
    if (hit) return hit;
  } catch {
    /* list can fail on some hosts */
  }
  const created = await client.mailboxCreate("Quarantine");
  return created.path || "Quarantine";
}

export async function pollImapInbox(): Promise<{ fetched: number; stored: number; skipped: number }> {
  const cfg = imapConfigFromEnv();
  if (!cfg) {
    return { fetched: 0, stored: 0, skipped: 0 };
  }
  if (running) return { fetched: 0, stored: 0, skipped: 0 };
  running = true;

  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false,
  });

  let fetched = 0;
  let stored = 0;
  let skipped = 0;

  try {
    await client.connect();
    const existing = listAgentMail(2000);
    const inboxLock = await client.getMailboxLock("INBOX");
    try {
      const known = inboundMessageIds();
      const unseen = (await client.search({ seen: false }, { uid: true })) || [];
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const recent = (await client.search({ since }, { uid: true })) || [];
      const daemon = (await client.search({ from: "mailer-daemon" }, { uid: true })) || [];
      const uids = [...new Set([...unseen, ...recent, ...daemon])];
      const quarantineUids = new Set<number>();
      for (const uid of uids) {
        fetched += 1;
        const msg = await client.fetchOne(uid, { envelope: true, source: true }, { uid: true });
        if (!msg) {
          skipped += 1;
          continue;
        }
        const parsed = await simpleParser(msg.source || Buffer.from(""));
        const messageId = String(parsed.messageId || msg.envelope?.messageId || "").trim();
        const from = addressesOf(parsed.from) || parseAddressList(msg.envelope?.from?.[0]?.address);
        if (isMailerDaemonAddress(from)) quarantineUids.add(uid);
        if (messageId && (known.has(messageId) || inboundAlreadyLogged(existing, messageId))) {
          const logged = existing.find(
            (item) => item.direction === "inbound" && String(item.messageId || "").trim() === messageId,
          );
          if (backfillAttachmentsIfNeeded(logged, parsed)) stored += 1;
          else skipped += 1;
          await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
          continue;
        }
        const to =
          addressesOf(parsed.to) ||
          parseAddressList(msg.envelope?.to?.[0]?.address) ||
          cfg.user;
        if (!from || !to) {
          skipped += 1;
          continue;
        }
        const id = randomUUID();
        const item = await recordInbound({
          id,
          from,
          to,
          subject: parsed.subject || msg.envelope?.subject || "(no subject)",
          text: parsed.text || "",
          html: typeof parsed.html === "string" ? parsed.html : undefined,
          messageId: messageId || undefined,
          createdAt: (parsed.date || msg.envelope?.date || new Date()).toISOString(),
          attachments: persistMailAttachments(id, parsedAttachments(parsed)),
        });
        existing.push(item);
        if (messageId) known.add(messageId);
        stored += 1;
        await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
      }
      if (quarantineUids.size) {
        try {
          const dest = await ensureQuarantinePath(client);
          const moved = await client.messageMove([...quarantineUids], dest, { uid: true });
          if (moved) {
            console.log(`[AgentMail] moved ${quarantineUids.size} mailer-daemon message(s) to ${dest}`);
          } else {
            console.warn(`[AgentMail] could not move ${quarantineUids.size} mailer-daemon message(s) to ${dest}`);
          }
        } catch (error: any) {
          console.warn("[AgentMail] quarantine move failed:", error?.message || error);
        }
      }
    } finally {
      inboxLock.release();
    }

    const sentPath = await resolveMailbox(client, "\\Sent", ["Sent", "Sent Items", "INBOX.Sent"]);
    if (!sentPath) {
      console.warn("[AgentMail] IMAP Sent mailbox not found — outbound history cannot be rebuilt from IONOS");
    } else {
      console.log(`[AgentMail] IMAP Sent mailbox: ${sentPath}`);
    }
    if (sentPath) {
      const sentLock = await client.getMailboxLock(sentPath);
      try {
        const known = loggedMessageIds();
        const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const uids = (await client.search({ since }, { uid: true })) || [];
        for (const uid of uids) {
          fetched += 1;
          const msg = await client.fetchOne(uid, { envelope: true, source: true }, { uid: true });
          if (!msg) {
            skipped += 1;
            continue;
          }
          const parsed = await simpleParser(msg.source || Buffer.from(""));
          const messageId = String(parsed.messageId || msg.envelope?.messageId || "").trim();
          if (messageId && known.has(messageId)) {
            const logged = existing.find((item) => String(item.messageId || "").trim() === messageId);
            if (backfillAttachmentsIfNeeded(logged, parsed)) stored += 1;
            else skipped += 1;
            continue;
          }
          const from = addressesOf(parsed.from) || parseAddressList(msg.envelope?.from?.[0]?.address) || cfg.user;
          const to = addressesOf(parsed.to) || parseAddressList(msg.envelope?.to?.[0]?.address);
          if (!from || !to) {
            skipped += 1;
            continue;
          }
          const html = typeof parsed.html === "string" ? parsed.html : undefined;
          const reusedId = trackingIdFromHtml(html);
          if (reusedId && getAgentMail(reusedId)) {
            const logged = getAgentMail(reusedId);
            if (backfillAttachmentsIfNeeded(logged, parsed)) stored += 1;
            else skipped += 1;
            continue;
          }
          const mailbox = mailboxByAddress(from);
          const id = reusedId || randomUUID();
          logAgentMail({
            id,
            direction: "outbound",
            agentId: mailbox?.agentId,
            agentName: mailbox?.displayName,
            from,
            to,
            subject: parsed.subject || msg.envelope?.subject || "(no subject)",
            text: parsed.text || "",
            html,
            status: "sent",
            messageId: messageId || undefined,
            createdAt: (parsed.date || msg.envelope?.date || new Date()).toISOString(),
            attachments: persistMailAttachments(id, parsedAttachments(parsed)),
          });
          if (messageId) known.add(messageId);
          stored += 1;
        }
      } finally {
        sentLock.release();
      }
    }

    await client.logout();
  } catch (error: any) {
    console.error("[AgentMail] IMAP poll failed:", error?.message || error);
  } finally {
    running = false;
  }

  if (stored || fetched) {
    console.log(`[AgentMail] IMAP poll fetched ${fetched}, stored ${stored}, skipped ${skipped}`);
  }
  try {
    await processAgentInbox();
  } catch (error: any) {
    console.error("[AgentMail] inbox process failed:", error?.message || error);
  }
  return { fetched, stored, skipped };
}

export function startImapInboxPoll(intervalMs = 30_000) {
  if (!imapConfigFromEnv()) {
    console.log("[AgentMail] IMAP poll skipped — no SMTP/IMAP mailbox login");
    return;
  }
  console.log("[AgentMail] IMAP inbox poll started (same IONOS mailbox as SMTP send)");
  void pollImapInbox().then(() => processAgentInbox());
  setInterval(() => {
    void pollImapInbox();
  }, intervalMs);
}
