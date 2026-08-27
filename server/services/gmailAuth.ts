import { google } from "googleapis";
import type { Auth } from "googleapis";
import type { User } from "@shared/schema";
import { storage } from "../storage";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.settings.basic",
  "https://www.googleapis.com/auth/userinfo.email",
];

export class GmailConfigError extends Error {
  constructor(message = "Google OAuth is not configured") {
    super(message);
    this.name = "GmailConfigError";
  }
}

export class GmailNotConnectedError extends Error {
  constructor() {
    super("Gmail is not connected");
    this.name = "GmailNotConnectedError";
  }
}

export function gmailOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function gmailRedirectUri(req?: { protocol?: string; get?: (name: string) => string | undefined }): string {
  if (process.env.GOOGLE_OAUTH_REDIRECT_URI) return process.env.GOOGLE_OAUTH_REDIRECT_URI;
  const host = req?.get?.("host");
  if (host) {
    const proto = req.get?.("x-forwarded-proto") || req.protocol || "http";
    return `${proto}://${host}/api/gmail/callback`;
  }
  const base = (process.env.PUBLIC_APP_URL || process.env.APP_URL || "http://127.0.0.1:5000").replace(/\/$/, "");
  return `${base}/api/gmail/callback`;
}

export function createOAuthClient(req?: { protocol?: string; get?: (name: string) => string | undefined }): Auth.OAuth2Client {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw new GmailConfigError();
  return new google.auth.OAuth2(id, secret, gmailRedirectUri(req));
}

export function gmailAuthUrl(state: string, req?: { protocol?: string; get?: (name: string) => string | undefined }): string {
  const client = createOAuthClient(req);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
    login_hint: process.env.GMAIL_LOGIN_HINT || "shaun@veltro.co.uk",
  });
}

export async function gmailClientForUser(userId: string): Promise<ReturnType<typeof google.gmail>> {
  const user = await storage.getUser(userId);
  if (!user?.googleAccessToken) throw new GmailNotConnectedError();
  const client = createOAuthClient();
  client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken || undefined,
    expiry_date: user.googleTokenExpiry ? new Date(user.googleTokenExpiry).getTime() : undefined,
  });
  client.on("tokens", async (tokens) => {
    await storage.updateUser(userId, {
      googleAccessToken: tokens.access_token || user.googleAccessToken,
      googleRefreshToken: tokens.refresh_token || user.googleRefreshToken,
      googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : user.googleTokenExpiry,
      googleConnected: true,
    });
  });
  return google.gmail({ version: "v1", auth: client });
}

export async function saveGmailTokens(userId: string, client: Auth.OAuth2Client, code: string): Promise<User> {
  const existing = await storage.getUser(userId);
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  const oauth = google.oauth2({ version: "v2", auth: client });
  const me = await oauth.userinfo.get();
  const updated = await storage.updateUser(userId, {
    googleConnected: true,
    googleEmail: me.data.email || "shaun@veltro.co.uk",
    googleAccessToken: tokens.access_token || null,
    googleRefreshToken: tokens.refresh_token || existing?.googleRefreshToken || null,
    googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
  });
  if (!updated) throw new Error("Could not save Gmail tokens");
  return updated;
}

export async function disconnectGmail(userId: string): Promise<void> {
  await storage.updateUser(userId, {
    googleConnected: false,
    googleEmail: null,
    googleAccessToken: null,
    googleRefreshToken: null,
    googleTokenExpiry: null,
  });
}
