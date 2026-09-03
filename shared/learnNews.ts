import { parseHelpedCookie } from "./learn";

export type LearnNewsCommentInput = {
  name?: string;
  email?: string;
  body?: string;
  marketingOptIn?: boolean;
};

export type LearnNewsCommentLike = {
  id?: number;
  pieceId: number;
  name: string;
  emailHash: string;
  body: string;
  marketingOptIn: boolean;
  live: boolean;
  createdAt: string;
};

export type LearnNewsCommentPublic = {
  id?: number;
  name: string;
  body: string;
  createdAt: string;
};

const URL_IN_BODY = /\bhttps?:\/\/|\bwww\./i;
const LOOKS_LIKE_EMAIL = /@/;

export function parseLikedCookie(header: string | undefined): number[] {
  return parseHelpedCookie(header);
}

export function likedCookieValue(ids: number[]): string {
  return parseLikedCookie(ids.join(",")).join(",");
}

export function validateLearnNewsComment(
  input: LearnNewsCommentInput,
): { ok: true; name: string; email: string; body: string; marketingOptIn: boolean } | { ok: false; error: string } {
  const name = String(input.name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const body = String(input.body || "").trim();
  if (name.length < 2 || name.length > 80) return { ok: false, error: "Name must be 2 to 80 characters." };
  if (LOOKS_LIKE_EMAIL.test(name)) return { ok: false, error: "Use a display name, not an email." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "A real email is required." };
  if (body.length < 20 || body.length > 800) return { ok: false, error: "Comment must be 20 to 800 characters." };
  if (URL_IN_BODY.test(body)) return { ok: false, error: "Comments cannot contain links." };
  return { ok: true, name, email, body, marketingOptIn: input.marketingOptIn === true };
}

export function canPostLearnNewsComment(
  existing: Array<{ emailHash: string; createdAt: string }>,
  emailHash: string,
  now: number,
  windowMs = 60 * 60 * 1000,
  max = 3,
): { ok: boolean; error?: string } {
  const recent = existing.filter(
    (row) => row.emailHash === emailHash && now - Date.parse(row.createdAt) < windowMs,
  );
  if (recent.length >= max) return { ok: false, error: "Too many comments this hour." };
  return { ok: true };
}

export function toLearnNewsCommentPublic(row: LearnNewsCommentLike): LearnNewsCommentPublic {
  return { id: row.id, name: row.name, body: row.body, createdAt: row.createdAt };
}

export function hideLearnNewsComment<T extends { live?: boolean }>(row: T): T & { live: false } {
  return { ...row, live: false };
}
