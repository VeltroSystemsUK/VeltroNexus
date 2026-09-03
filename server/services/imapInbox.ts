import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { imapConfigFromEnv, inboundAlreadyLogged, parseAddressList } from "@shared/imapInbox";
import { inboundMessageIds, listAgentMail, recordInbound } from "./agentMailLog";
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
    const lock = await client.getMailboxLock("INBOX");
    try {
      const known = inboundMessageIds();
      const existing = listAgentMail(2000);
      const unseen = (await client.search({ seen: false }, { uid: true })) || [];
      const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const recent = (await client.search({ since }, { uid: true })) || [];
      const uids = [...new Set([...unseen, ...recent])];
      for (const uid of uids) {
        fetched += 1;
        const msg = await client.fetchOne(uid, { envelope: true, source: true }, { uid: true });
        if (!msg) {
          skipped += 1;
          continue;
        }
        const parsed = await simpleParser(msg.source || Buffer.from(""));
        const messageId = String(parsed.messageId || msg.envelope?.messageId || "").trim();
        if (messageId && (known.has(messageId) || inboundAlreadyLogged(existing, messageId))) {
          skipped += 1;
          await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
          continue;
        }
        const from = addressesOf(parsed.from) || parseAddressList(msg.envelope?.from?.[0]?.address);
        const to =
          addressesOf(parsed.to) ||
          parseAddressList(msg.envelope?.to?.[0]?.address) ||
          cfg.user;
        if (!from || !to) {
          skipped += 1;
          continue;
        }
        await recordInbound({
          from,
          to,
          subject: parsed.subject || msg.envelope?.subject || "(no subject)",
          text: parsed.text || "",
          html: typeof parsed.html === "string" ? parsed.html : undefined,
          messageId: messageId || undefined,
          createdAt: (parsed.date || msg.envelope?.date || new Date()).toISOString(),
        });
        if (messageId) known.add(messageId);
        stored += 1;
        await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
      }
    } finally {
      lock.release();
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
  await processAgentInbox();
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
