const SECRET_KEYS = [
  "password",
  "googleAccessToken",
  "googleRefreshToken",
  "webhookApiKeyHash",
] as const;

export function toPublicUser<T extends Record<string, unknown> | null | undefined>(user: T): T {
  if (!user || typeof user !== "object") return user;
  const out = { ...user } as Record<string, unknown>;
  for (const key of SECRET_KEYS) {
    delete out[key];
  }
  return out as T;
}
