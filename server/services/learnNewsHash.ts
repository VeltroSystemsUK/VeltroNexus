import { createHash } from "crypto";

export function hashLearnCommentEmail(email: string, pepper: string): string {
  return createHash("sha256").update(`${pepper}:${email.trim().toLowerCase()}`).digest("hex");
}
