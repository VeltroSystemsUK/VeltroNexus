import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

const SANDBOX_BASE = "https://sandbox-b2b.revolut.com/api/1.0";
const PROD_BASE = "https://b2b.revolut.com/api/1.0";

function getBaseUrl(): string {
  return process.env.REVOLUT_SANDBOX === "false" ? PROD_BASE : SANDBOX_BASE;
}

function getTokenUrl(): string {
  return process.env.REVOLUT_SANDBOX === "false"
    ? "https://b2b.revolut.com/api/1.0/auth/token"
    : "https://sandbox-b2b.revolut.com/api/1.0/auth/token";
}

// In-memory token cache
let cachedToken: {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
} | null = null;

/**
 * Check if Revolut credentials are configured
 */
export function isRevolutConfigured(): boolean {
  return !!(process.env.REVOLUT_CLIENT_ID && process.env.REVOLUT_SECRET_KEY);
}

/**
 * Create a signed JWT assertion for Revolut's auth endpoint
 */
function createJwtAssertion(): string {
  const clientId = process.env.REVOLUT_CLIENT_ID!;
  const privateKey = process.env.REVOLUT_SECRET_KEY!;

  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: clientId,
    sub: clientId,
    aud: "https://revolut.com",
    iat: now,
    exp: now + 60, // 1 minute validity
    jti: uuidv4(),
  };

  return jwt.sign(payload, privateKey, { algorithm: "RS256" });
}

/**
 * Exchange JWT assertion for access_token + refresh_token
 */
async function exchangeToken(): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const assertion = createJwtAssertion();
  const tokenUrl = getTokenUrl();

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    client_id: process.env.REVOLUT_CLIENT_ID!,
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: assertion,
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Revolut token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in || 2400, // default 40 mins
  };
}

/**
 * Refresh an expired access_token using the refresh_token
 */
async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const tokenUrl = getTokenUrl();

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.REVOLUT_CLIENT_ID!,
    refresh_token: refreshToken,
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: createJwtAssertion(),
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Revolut token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: data.expires_in || 2400,
  };
}

/**
 * Get a valid access token, refreshing or re-authenticating as needed
 */
async function getAccessToken(): Promise<string> {
  // If we have a cached token that isn't expired (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.accessToken;
  }

  // Try to refresh if we have a refresh token
  if (cachedToken?.refreshToken) {
    try {
      const result = await refreshAccessToken(cachedToken.refreshToken);
      cachedToken = {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: Date.now() + result.expiresIn * 1000,
      };
      return cachedToken.accessToken;
    } catch {
      // Refresh failed, fall through to full re-auth
      cachedToken = null;
    }
  }

  // Full token exchange
  const result = await exchangeToken();
  cachedToken = {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresAt: Date.now() + result.expiresIn * 1000,
  };
  return cachedToken.accessToken;
}

/**
 * Make an authenticated request to the Revolut Business API
 */
export async function revolutFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token = await getAccessToken();
  const base = getBaseUrl();
  const url = `${base}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 401) {
    // Token expired mid-request — clear cache and retry once
    cachedToken = null;
    const newToken = await getAccessToken();
    const retry = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${newToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!retry.ok) {
      const text = await retry.text();
      throw new Error(`Revolut API error (${retry.status}): ${text}`);
    }
    return retry.json();
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Revolut API error (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Get all Revolut accounts with balances
 */
export async function getAccounts(): Promise<any[]> {
  return revolutFetch("/accounts");
}

/**
 * Get transactions with optional date filtering
 */
export async function getTransactions(
  from?: string,
  to?: string,
  count: number = 100
): Promise<any[]> {
  const params = new URLSearchParams({ count: String(count) });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return revolutFetch(`/transactions?${params.toString()}`);
}
