import { emailFromUnsubscribeToken, unsubscribeSigningSecret } from "@shared/listUnsubscribe";
import { applyOptOut } from "./mailDesk";

export const UNSUBSCRIBE_OK_HTML =
  "<!doctype html><title>Unsubscribed</title><p>You've been unsubscribed from Strata Finance emails.</p>";
export const UNSUBSCRIBE_INVALID_HTML =
  "<!doctype html><title>Unsubscribe</title><p>This unsubscribe link is not valid.</p>";

export async function processMailUnsubscribe(token: string): Promise<"ok" | "invalid"> {
  const email = emailFromUnsubscribeToken(token, unsubscribeSigningSecret());
  if (!email) return "invalid";
  await applyOptOut(email);
  return "ok";
}
