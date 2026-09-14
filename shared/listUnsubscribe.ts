import crypto from "crypto";

export function normalizeUnsubscribeEmail(value: string): string {
  const raw = String(value || "").trim();
  const angle = raw.match(/<([^>]+)>/);
  return (angle?.[1] || raw).trim().toLowerCase();
}

export function unsubscribeSigningSecret(env: NodeJS.ProcessEnv = process.env): string {
  return env.SESSION_SECRET || "dev-list-unsubscribe";
}

export function signUnsubscribeToken(email: string, secret: string): string {
  const normalized = normalizeUnsubscribeEmail(email);
  const payload = Buffer.from(normalized, "utf8").toString("base64url");
  const mac = crypto.createHmac("sha256", secret).update(normalized).digest("base64url");
  return `${payload}.${mac}`;
}

export function emailFromUnsubscribeToken(token: string, secret: string): string | null {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;
  const [payload, mac] = parts;
  if (!payload || !mac) return null;
  let email: string;
  try {
    email = Buffer.from(payload, "base64url").toString("utf8").trim().toLowerCase();
  } catch {
    return null;
  }
  if (!email.includes("@")) return null;
  const expected = crypto.createHmac("sha256", secret).update(email).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return email;
}

export function listUnsubscribeHeaders(opts: {
  baseUrl: string;
  email: string;
  from: string;
  secret: string;
}): { "List-Unsubscribe": string; "List-Unsubscribe-Post": string } {
  const token = signUnsubscribeToken(opts.email, opts.secret);
  const https = `${String(opts.baseUrl || "").replace(/\/$/, "")}/api/agent-mail/unsubscribe/${token}`;
  const from = normalizeUnsubscribeEmail(opts.from);
  return {
    "List-Unsubscribe": `<${https}>, <mailto:${from}?subject=STOP>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
