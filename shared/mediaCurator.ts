export const MEDIA_CURATOR_PROMPT = `Role Identifier: MediaCurator_Indexer_v1
You are Kit Lang, Media Curator (MKT-4) at Strata Finance. You ingest, dedupe, tag, and index stills for Isla (MKT-2) and the Media Gallery. You do not write ad copy. You do not post.

House policy:
- Strata packages. We do not lend.
- No payday, consumer-credit, distressed-people porn, luxury-cliché cars, or invented rates on pictures or tags.
- Capture license and attribution at ingest. Never strip a photographer credit.
- Never auto-publish. Never buy ads.
- Hunt Unsplash, Pexels, Openverse (CC commercial) and Firecrawl image search. Only keep rasters from those hosts — never scrape a site we do not have rights to.

Work:
1. Ingest from URL, upload, Unsplash, Pexels, Openverse, or Firecrawl.
2. Hash (content + perceptual) and skip near-duplicates.
3. Record width, height, aspect, format, palette.
4. Tag theme / industry / mood. Write a short description and alt text.
5. Serve square, story, landscape and thumbnail slots for Craft and email.`;

export type CuratorLicense = "public-domain" | "commercial" | "internal" | "restricted";
export type CuratorAspect = "1:1" | "16:9" | "9:16" | "4:5" | "custom";
export type CuratorChannel = "email" | "social_linkedin" | "social_x" | "social_meta";

export type CuratedAsset = {
  id: string;
  title: string;
  description: string;
  altText: string;
  originalUrl: string;
  cdnUrl: string;
  variants: {
    thumbnail: string;
    square: string;
    landscape: string;
    story: string;
  };
  format: "webp" | "png" | "jpeg" | "avif" | "gif";
  width: number;
  height: number;
  aspectRatio: CuratorAspect;
  fileSizeBytes: number;
  contentHash: string;
  pHash: string;
  dominantColors: string[];
  tags: string[];
  categories: string[];
  embeddingVector?: number[];
  source: string;
  license: CuratorLicense;
  attribution?: string;
  usageCount: number;
  lastUsedAt?: string;
  campaignHistory: Array<{ campaignId: string; channel: CuratorChannel; usedAt: string }>;
  createdAt: string;
  updatedAt: string;
};

export type CuratorCollection = {
  id: string;
  name: string;
  assetIds: string[];
  createdAt: string;
};

export function pngSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  if (buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4e || buffer[3] !== 0x47) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

export function jpegSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1]!;
    if (marker === 0xc0 || marker === 0xc2) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    const size = buffer.readUInt16BE(offset + 2);
    offset += 2 + size;
  }
  return null;
}

export function imageSize(buffer: Buffer): { width: number; height: number } | null {
  return pngSize(buffer) ?? jpegSize(buffer);
}

export function aspectRatioFromSize(width: number, height: number): CuratorAspect {
  if (!width || !height) return "custom";
  const r = width / height;
  if (Math.abs(r - 1) < 0.04) return "1:1";
  if (Math.abs(r - 16 / 9) < 0.08 || Math.abs(r - 1.91) < 0.08) return "16:9";
  if (Math.abs(r - 9 / 16) < 0.04) return "9:16";
  if (Math.abs(r - 4 / 5) < 0.04) return "4:5";
  return "custom";
}

export function averageHash(pixels: number[]): string {
  const cells = pixels.length ? pixels.slice(0, 64) : Array(64).fill(0);
  while (cells.length < 64) cells.push(0);
  const avg = cells.reduce((sum, n) => sum + n, 0) / 64;
  let bits = "";
  for (const n of cells) bits += n >= avg ? "1" : "0";
  let hex = "";
  for (let i = 0; i < 64; i += 4) {
    hex += Number.parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

export function pHashFromBuffer(buffer: Buffer): string {
  const samples = Array.from({ length: 64 }, (_, i) => {
    if (!buffer.length) return 0;
    const index = Math.floor((i * buffer.length) / 64);
    return buffer[index] ?? 0;
  });
  return averageHash(samples);
}

export function hammingDistance(a: string, b: string): number {
  const n = Math.max(a.length, b.length);
  let d = 0;
  for (let i = 0; i < n; i++) if ((a[i] ?? "") !== (b[i] ?? "")) d += 1;
  return d;
}

export function isNearDuplicate(a: string, b: string, max = 8): boolean {
  return hammingDistance(a, b) <= max;
}

export function bagEmbedding(text: string, dim = 64): number[] {
  const vec = Array(dim).fill(0);
  const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  for (const token of tokens) {
    let h = 0;
    for (let i = 0; i < token.length; i++) h = (h * 31 + token.charCodeAt(i)) | 0;
    const slot = Math.abs(h) % dim;
    vec[slot] += 1;
  }
  const mag = Math.sqrt(vec.reduce((s, n) => s + n * n, 0)) || 1;
  return vec.map((n) => n / mag);
}

function cosine(a: number[] = [], b: number[] = []): number {
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  let dot = 0;
  for (let i = 0; i < n; i++) dot += (a[i] ?? 0) * (b[i] ?? 0);
  return dot;
}

export type IngestDraft = {
  id: string;
  title: string;
  description: string;
  altText: string;
  originalUrl: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  contentHash: string;
  pHash: string;
  tags: string[];
  categories: string[];
  source: string;
  license: CuratorLicense;
  attribution?: string;
  buffer: Buffer;
  format?: CuratedAsset["format"];
  dominantColors?: string[];
  now?: string;
};

export function ingestAsset(draft: IngestDraft): CuratedAsset {
  const now = draft.now ?? new Date().toISOString();
  const url = draft.originalUrl;
  const text = `${draft.title} ${draft.description} ${draft.tags.join(" ")}`;
  return {
    id: draft.id,
    title: draft.title,
    description: draft.description,
    altText: draft.altText,
    originalUrl: url,
    cdnUrl: url,
    variants: {
      thumbnail: url,
      square: url,
      landscape: url,
      story: url,
    },
    format: draft.format ?? "jpeg",
    width: draft.width,
    height: draft.height,
    aspectRatio: aspectRatioFromSize(draft.width, draft.height),
    fileSizeBytes: draft.fileSizeBytes,
    contentHash: draft.contentHash,
    pHash: draft.pHash,
    dominantColors: draft.dominantColors ?? [],
    tags: [...draft.tags],
    categories: [...draft.categories],
    embeddingVector: bagEmbedding(text),
    source: draft.source,
    license: draft.license,
    attribution: draft.attribution,
    usageCount: 0,
    campaignHistory: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function findDuplicate(existing: CuratedAsset[], contentHash: string, pHash: string): CuratedAsset | undefined {
  return existing.find((asset) => asset.contentHash === contentHash || isNearDuplicate(asset.pHash, pHash));
}

export function hybridSearch(
  assets: CuratedAsset[],
  query: { q?: string; tags?: string[]; aspectRatio?: CuratorAspect; color?: string },
): CuratedAsset[] {
  let pool = assets;
  if (query.aspectRatio) pool = pool.filter((asset) => asset.aspectRatio === query.aspectRatio);
  if (query.tags?.length) {
    const want = new Set(query.tags.map((t) => t.toLowerCase()));
    pool = pool.filter((asset) => asset.tags.some((tag) => want.has(tag.toLowerCase())));
  }
  if (query.color) {
    const c = query.color.toLowerCase();
    pool = pool.filter((asset) => asset.dominantColors.some((hex) => hex.toLowerCase() === c));
  }
  const q = query.q?.trim().toLowerCase();
  if (!q) return pool;
  const qVec = bagEmbedding(q);
  return [...pool].sort((a, b) => {
    const blobA = `${a.title} ${a.description} ${a.tags.join(" ")}`.toLowerCase();
    const blobB = `${b.title} ${b.description} ${b.tags.join(" ")}`.toLowerCase();
    const textA = blobA.includes(q) ? 2 : q.split(/\s+/).filter((w) => w.length > 2 && blobA.includes(w)).length;
    const textB = blobB.includes(q) ? 2 : q.split(/\s+/).filter((w) => w.length > 2 && blobB.includes(w)).length;
    const scoreA = textA + cosine(qVec, a.embeddingVector);
    const scoreB = textB + cosine(qVec, b.embeddingVector);
    return scoreB - scoreA;
  });
}

export function recordUsage(
  asset: CuratedAsset,
  event: { campaignId: string; channel: CuratorChannel; at?: string },
): CuratedAsset {
  const usedAt = event.at ?? new Date().toISOString();
  return {
    ...asset,
    usageCount: asset.usageCount + 1,
    lastUsedAt: usedAt,
    campaignHistory: [...asset.campaignHistory, { campaignId: event.campaignId, channel: event.channel, usedAt }],
    updatedAt: usedAt,
  };
}

export function parseIngestRequest(input: unknown): {
  url?: string;
  source: string;
  license: CuratorLicense;
  title?: string;
  collectionId?: string;
} {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const url = typeof raw.url === "string" ? raw.url.trim() : "";
  if (!url && !raw.file) throw new Error("Provide a url or file buffer.");
  const license: CuratorLicense =
    raw.license === "public-domain" || raw.license === "commercial" || raw.license === "restricted"
      ? raw.license
      : "internal";
  return {
    url: url || undefined,
    source: typeof raw.source === "string" && raw.source.trim() ? raw.source.trim() : "internal",
    license,
    title: typeof raw.title === "string" ? raw.title.trim() : undefined,
    collectionId: typeof raw.collectionId === "string" ? raw.collectionId : undefined,
  };
}

export function tagsFromText(text: string): string[] {
  const stop = new Set(["the", "and", "with", "from", "that", "this", "for"]);
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !stop.has(t));
  return Array.from(new Set(tokens)).slice(0, 12);
}

export const CURATOR_DESK_QUERIES = [
  "UK SME office desk files",
  "British high street independent shop interior",
  "UK warehouse pallet racking",
  "empty UK boardroom late afternoon",
  "workshop van tools UK trades",
  "construction site UK commercial building",
  "independent cafe kitchen UK",
  "factory floor UK manufacturing",
  "farm outbuilding UK rural business",
  "London commercial street architecture",
  "accountant paperwork ledger UK office",
  "retail stockroom UK shop",
];

const BLOCKED_CURATOR = /payday|guaranteed funding|\bapr\b|luxury car|distressed|consumer credit/i;

const SAFE_HOST_SUFFIXES = [
  "images.unsplash.com",
  "plus.unsplash.com",
  "images.pexels.com",
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "staticflickr.com",
  "cdn.pixabay.com",
  "pixabay.com",
  "openverse.org",
];

export type CuratorHunt = {
  url: string;
  title: string;
  attribution?: string;
  source: string;
  license: CuratorLicense;
};

export function curatorScanQueries(userQuery?: string): string[] {
  const q = userQuery?.trim();
  if (q) return isBlockedCuratorText(q) ? [] : [q];
  return [...CURATOR_DESK_QUERIES];
}

export function firecrawlQueriesFor(queries: string[]): string[] {
  if (queries.length <= 3) return queries;
  const last = queries.length - 1;
  const mid = Math.floor(queries.length / 2);
  return [queries[0]!, queries[mid]!, queries[last]!];
}

export function isBlockedCuratorText(text: string): boolean {
  return BLOCKED_CURATOR.test(text);
}

export function isAllowedCuratorHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return SAFE_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function hunt(url: string, title: string, source: string, license: CuratorLicense, attribution?: string): CuratorHunt | null {
  if (!url || !isAllowedCuratorHost(url) || isBlockedCuratorText(`${title} ${url}`)) return null;
  return { url, title: title || source, source, license, attribution };
}

export function huntsFromUnsplash(data: unknown, query: string): CuratorHunt[] {
  const results = asRecord(data)?.results;
  if (!Array.isArray(results)) return [];
  const out: CuratorHunt[] = [];
  for (const item of results) {
    const row = asRecord(item);
    const urls = asRecord(row?.urls);
    const user = asRecord(row?.user);
    const title =
      (typeof row?.alt_description === "string" && row.alt_description) ||
      (typeof row?.description === "string" && row.description) ||
      query;
    const found = hunt(
      typeof urls?.regular === "string" ? urls.regular : "",
      title,
      "unsplash",
      "commercial",
      typeof user?.name === "string" ? user.name : undefined,
    );
    if (found) out.push(found);
  }
  return out;
}

export function huntsFromPexels(data: unknown, query: string): CuratorHunt[] {
  const photos = asRecord(data)?.photos;
  if (!Array.isArray(photos)) return [];
  const out: CuratorHunt[] = [];
  for (const item of photos) {
    const row = asRecord(item);
    const src = asRecord(row?.src);
    const title = (typeof row?.alt === "string" && row.alt) || query;
    const found = hunt(
      typeof src?.large === "string" ? src.large : typeof src?.original === "string" ? src.original : "",
      title,
      "pexels",
      "commercial",
      typeof row?.photographer === "string" ? row.photographer : undefined,
    );
    if (found) out.push(found);
  }
  return out;
}

export function huntsFromOpenverse(data: unknown): CuratorHunt[] {
  const results = asRecord(data)?.results;
  if (!Array.isArray(results)) return [];
  const out: CuratorHunt[] = [];
  for (const item of results) {
    const row = asRecord(item);
    const licenseRaw = typeof row?.license === "string" ? row.license.toLowerCase() : "";
    const license: CuratorLicense = licenseRaw.includes("cc0") || licenseRaw.includes("pdm") ? "public-domain" : "commercial";
    const found = hunt(
      typeof row?.url === "string" ? row.url : "",
      typeof row?.title === "string" ? row.title : "Openverse still",
      "openverse",
      license,
      typeof row?.creator === "string" ? row.creator : undefined,
    );
    if (found) out.push(found);
  }
  return out;
}

export function huntsFromFirecrawlSearch(data: unknown): CuratorHunt[] {
  const root = asRecord(data);
  const nested = asRecord(root?.data);
  const images = Array.isArray(root?.images)
    ? root.images
    : Array.isArray(nested?.images)
      ? nested.images
      : [];
  const out: CuratorHunt[] = [];
  for (const item of images) {
    const row = asRecord(item);
    const url =
      (typeof row?.imageUrl === "string" && row.imageUrl) ||
      (typeof row?.url === "string" && row.url) ||
      "";
    const title = typeof row?.title === "string" ? row.title : "Firecrawl still";
    const found = hunt(url, title, "firecrawl", "commercial");
    if (found) out.push(found);
  }
  return out;
}

export function mergeHunts(groups: CuratorHunt[][], cap = 60): CuratorHunt[] {
  const seen = new Set<string>();
  const queues = groups.map((group) => [...group]);
  const out: CuratorHunt[] = [];
  while (out.length < cap) {
    let added = false;
    for (const queue of queues) {
      while (queue.length) {
        const next = queue.shift()!;
        if (seen.has(next.url)) continue;
        seen.add(next.url);
        out.push(next);
        added = true;
        break;
      }
      if (out.length >= cap) break;
    }
    if (!added) break;
  }
  return out;
}
