import {
  PACKAGER_IDENTITY,
  RATE_CLAIM,
  type ComplianceFinding,
  type ComplianceReview,
} from "./craftQueue";

export const DEFAULT_LEARN_HOST = "learn.stratanexus.co.uk";
export const LEARN_VIDEO_PUBLIC_PREFIX = "/uploads/learn/videos/";

const LEARN_BANNED =
  /\b(guaranteed|instant approval|0%\s*apr|apr\b|consumer loan|no credit check|guaranteed funding|we will lend|we lend)\b/i;

const STORED_LEARN_MP4 = /^\/uploads\/learn\/videos\/[A-Za-z0-9._-]+\.mp4$/;
const YOUTUBE_SOURCE =
  /^https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=[\w-]+|embed\/[\w-]+)|youtu\.be\/[\w-]+)/i;
const VIMEO_SOURCE = /^https?:\/\/(?:www\.)?vimeo\.com\/\d+/i;

export type LearnPieceSource = { desk: "editorial" | "learn-video"; id: number };

export type LearnPieceLike = {
  id?: number;
  slug: string;
  kind: "article" | "video";
  title: string;
  excerpt: string;
  heroImageUrl: string | null;
  body: string;
  videoUrl: string;
  transcript: string;
  pathPosition: number | null;
  durationLabel: string;
  thisHelped: number;
  source: LearnPieceSource;
  live: boolean;
  publishedAt: string;
  unpublishedAt: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type LearnPiecePublic = {
  slug: string;
  kind: "article" | "video";
  title: string;
  excerpt: string;
  heroImageUrl: string | null;
  body: string;
  videoUrl: string;
  transcript: string;
  pathPosition: number | null;
  durationLabel: string;
  thisHelped: number;
  publishedAt: string;
};

export type CanPublishLearnInput = {
  status: string;
  compliance: string;
  autoPublish: boolean;
  kind: "article" | "video";
  type?: string;
  videoUrl?: string;
  title: string;
  excerpt: string;
  body?: string;
  description?: string;
  transcript?: string;
};

export type SnapshotLearnInput = {
  kind: "article" | "video";
  slug: string;
  title: string;
  excerpt: string;
  body?: string;
  videoUrl?: string;
  transcript?: string;
  heroImageUrl?: string | null;
  durationLabel?: string;
  pathPosition?: number | null;
  source: LearnPieceSource;
  userId: string;
};

function hostWithoutPort(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, "");
}

export function isLearnHost(host?: string | null): boolean {
  if (!host) return false;
  const bare = hostWithoutPort(host);
  if (!bare) return false;
  if (bare === DEFAULT_LEARN_HOST || bare === "learn.localhost") return true;
  const extras = String(process.env.LEARN_HOST || "")
    .split(",")
    .map(hostWithoutPort)
    .filter(Boolean);
  return extras.includes(bare);
}

export function slugifyLearnTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isAllowedVideoSource(url: string): boolean {
  if (!url || url.includes("..") || /assets\.grok\.com/i.test(url)) return false;
  if (STORED_LEARN_MP4.test(url)) return true;
  if (YOUTUBE_SOURCE.test(url) || VIMEO_SOURCE.test(url)) return true;
  return false;
}

export function pathPositionTaken(
  live: Array<{ id?: number; live?: boolean; pathPosition?: number | null }>,
  position: number | null | undefined,
  exceptId?: number,
): boolean {
  if (position == null) return false;
  return live.some(
    (row) =>
      row.live !== false &&
      row.pathPosition === position &&
      (exceptId === undefined || row.id !== exceptId),
  );
}

export function reviewLearnCopy(text: string): ComplianceReview {
  const findings: ComplianceFinding[] = [];
  if (LEARN_BANNED.test(text) || RATE_CLAIM.test(text)) {
    findings.push({
      level: "block",
      code: "house_policy",
      message: "Copy fails house policy — no rates, guarantees, consumer-credit claims, or lending.",
    });
  }
  if (!PACKAGER_IDENTITY.test(text)) {
    findings.push({
      level: "block",
      code: "identity",
      message: "Say plainly that Strata packages and does not lend.",
    });
  }
  return { ok: findings.every((item) => item.level !== "block"), findings };
}

export function canPublishLearn(input: CanPublishLearnInput): { ok: boolean; error?: string } {
  if (input.status !== "approved") return { ok: false, error: "Marketing must approve before publish." };
  if (input.compliance !== "cleared") return { ok: false, error: "Compliance must clear before publish." };
  if (input.autoPublish !== false) return { ok: false, error: "Auto-publish is not allowed." };

  if (input.kind === "article") {
    if (input.type !== "blog") return { ok: false, error: "Only blog articles publish to Learn." };
    if (!reviewLearnCopy(input.body || "").ok) return { ok: false, error: "Article copy failed Learn review." };
    return { ok: true };
  }

  if (!isAllowedVideoSource(input.videoUrl || "")) {
    return { ok: false, error: "Video source must be a stored Learn mp4 or YouTube/Vimeo URL." };
  }
  const copy = [input.title, input.excerpt, input.description || "", input.transcript || ""].join(" ");
  if (!reviewLearnCopy(copy).ok) return { ok: false, error: "Video copy failed Learn review." };
  return { ok: true };
}

export function toLearnPublic(piece: LearnPieceLike): LearnPiecePublic {
  return {
    slug: piece.slug,
    kind: piece.kind,
    title: piece.title,
    excerpt: piece.excerpt,
    heroImageUrl: piece.heroImageUrl,
    body: piece.body,
    videoUrl: piece.videoUrl,
    transcript: piece.transcript,
    pathPosition: piece.pathPosition,
    durationLabel: piece.durationLabel,
    thisHelped: piece.thisHelped,
    publishedAt: piece.publishedAt,
  };
}

export function buildLearnHome(live: LearnPieceLike[]): {
  path: LearnPiecePublic[];
  library: LearnPiecePublic[];
} {
  const rows = live.filter((piece) => piece.live === true);
  const path = rows
    .filter((piece) => typeof piece.pathPosition === "number" && piece.pathPosition >= 1 && piece.pathPosition <= 6)
    .sort((a, b) => (a.pathPosition as number) - (b.pathPosition as number))
    .map(toLearnPublic);
  const library = rows
    .filter((piece) => piece.pathPosition == null)
    .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
    .map(toLearnPublic);
  return { path, library };
}

export function parseHelpedCookie(header: string | undefined): number[] {
  if (!header) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const part of header.split(",")) {
    const n = Number(part.trim());
    if (!Number.isInteger(n) || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export function helpedCookieValue(ids: number[]): string {
  return parseHelpedCookie(ids.join(",")).join(",");
}

export function snapshotLearnPiece(input: SnapshotLearnInput): LearnPieceLike {
  const now = new Date().toISOString();
  const isArticle = input.kind === "article";
  return {
    slug: input.slug,
    kind: input.kind,
    title: input.title,
    excerpt: input.excerpt,
    heroImageUrl: input.heroImageUrl ?? null,
    body: isArticle ? input.body || "" : "",
    videoUrl: isArticle ? "" : input.videoUrl || "",
    transcript: input.transcript || "",
    pathPosition: input.pathPosition ?? null,
    durationLabel: input.durationLabel || "",
    thisHelped: 0,
    source: input.source,
    live: true,
    publishedAt: now,
    unpublishedAt: null,
    userId: input.userId,
    createdAt: now,
    updatedAt: now,
  };
}
