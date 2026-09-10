export type ImapConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
};

export function imapHostFromSmtp(smtpHost?: string): string {
  const host = String(smtpHost || "").trim().toLowerCase();
  if (!host) return "imap.ionos.co.uk";
  if (host.startsWith("smtp.")) return `imap.${host.slice(5)}`;
  return host;
}

export function imapConfigFromEnv(env: Record<string, string | undefined> = process.env): ImapConfig | null {
  const user = env.IMAP_USER || env.SMTP_USER;
  const pass = env.IMAP_PASS || env.SMTP_PASS;
  if (!user || !pass) return null;
  const port = parseInt(env.IMAP_PORT || "993", 10);
  return {
    host: env.IMAP_HOST || imapHostFromSmtp(env.SMTP_HOST),
    port: Number.isFinite(port) ? port : 993,
    secure: port !== 143,
    user,
    pass,
  };
}

export function inboundAlreadyLogged(
  existing: Array<{ messageId?: string; direction?: string }>,
  messageId?: string | null
): boolean {
  const id = String(messageId || "").trim();
  if (!id) return false;
  return existing.some((item) => item.direction === "inbound" && String(item.messageId || "").trim() === id);
}

export const IMAP_QUARANTINE_FALLBACKS = ["Quarantine", "INBOX.Quarantine"];

export function pickMailboxPath(
  boxes: Array<{ path: string; name?: string; specialUse?: string }>,
  specialUse: string,
  fallbacks: string[],
): string | null {
  const bySpecial = boxes.find((box) => String(box.specialUse || "") === specialUse);
  if (bySpecial) return bySpecial.path;
  const names = fallbacks.map((name) => name.toLowerCase());
  const byName = boxes.find((box) => {
    const path = box.path.toLowerCase();
    const leaf = String(box.name || path.split(/[./]/).pop() || "").toLowerCase();
    return names.includes(path) || names.includes(leaf);
  });
  return byName?.path || null;
}

export function parseAddressList(value?: string | null): string {
  const raw = String(value || "").trim();
  const angle = raw.match(/<([^>]+)>/);
  if (angle) return angle[1].trim().toLowerCase();
  const email = raw.match(/[^\s<>]+@[^\s<>]+/);
  return email ? email[0].trim().toLowerCase() : raw.toLowerCase();
}
