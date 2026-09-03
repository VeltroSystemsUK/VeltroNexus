import crypto from "crypto";
import fs from "fs";
import path from "path";
import { firecrawlAuthHeaders, firecrawlSearchUrl } from "@shared/firecrawl";
import {
  curatorScanQueries,
  findDuplicate,
  firecrawlQueriesFor,
  huntsFromFirecrawlSearch,
  huntsFromOpenverse,
  huntsFromPexels,
  huntsFromUnsplash,
  hybridSearch,
  imageSize,
  ingestAsset,
  mergeHunts,
  pHashFromBuffer,
  parseIngestRequest,
  recordUsage,
  tagsFromText,
  type CuratedAsset,
  type CuratorChannel,
  type CuratorCollection,
  type CuratorHunt,
} from "@shared/mediaCurator";

const INDEX_FILE = path.resolve(process.cwd(), "uploads", "curator_index.json");

type Index = { assets: CuratedAsset[]; collections: CuratorCollection[] };

function empty(): Index {
  return { assets: [], collections: [] };
}

function readIndex(): Index {
  try {
    if (!fs.existsSync(INDEX_FILE)) return empty();
    const raw = JSON.parse(fs.readFileSync(INDEX_FILE, "utf8"));
    return {
      assets: Array.isArray(raw.assets) ? raw.assets : [],
      collections: Array.isArray(raw.collections) ? raw.collections : [],
    };
  } catch {
    return empty();
  }
}

function writeIndex(index: Index) {
  const dir = path.dirname(INDEX_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
}

function formatFromMime(mime: string): CuratedAsset["format"] {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("avif")) return "avif";
  if (mime.includes("gif")) return "gif";
  return "jpeg";
}

function sampleColors(buffer: Buffer): string[] {
  if (buffer.length < 3) return [];
  const at = [0, Math.floor(buffer.length / 2), Math.max(0, buffer.length - 3)];
  return at.map((i) => {
    const slice = buffer.subarray(i, i + 3);
    return `#${[...slice].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  });
}

function saveFile(userId: string, id: string, ext: string, buffer: Buffer): string {
  const rel = path.join("curator", userId, `${id}.${ext}`).replace(/\\/g, "/");
  const full = path.resolve(process.cwd(), "uploads", rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buffer);
  return `/uploads/${rel}`;
}

export async function ingestFromUrl(userId: string, input: unknown): Promise<{ asset: CuratedAsset; duplicate: boolean }> {
  const parsed = parseIngestRequest(input);
  if (!parsed.url) throw new Error("Provide a url or file buffer.");
  const res = await fetch(parsed.url, { headers: { Accept: "image/*" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error("Could not fetch that image.");
  const mime = res.headers.get("content-type") || "image/jpeg";
  if (!mime.startsWith("image/") || mime.includes("svg")) throw new Error("Only raster images can be curated.");
  const buffer = Buffer.from(await res.arrayBuffer());
  const attribution =
    input && typeof input === "object" && typeof (input as { attribution?: unknown }).attribution === "string"
      ? (input as { attribution: string }).attribution
      : undefined;
  return catalogBuffer(userId, buffer, mime, parsed, attribution);
}

export function ingestFromBuffer(
  userId: string,
  buffer: Buffer,
  mime: string,
  meta: { source?: string; license?: CuratedAsset["license"]; title?: string; attribution?: string } = {},
): { asset: CuratedAsset; duplicate: boolean } {
  return catalogBuffer(userId, buffer, mime, {
    url: undefined,
    source: meta.source ?? "internal",
    license: meta.license ?? "internal",
    title: meta.title,
  }, meta.attribution);
}

function catalogBuffer(
  userId: string,
  buffer: Buffer,
  mime: string,
  parsed: ReturnType<typeof parseIngestRequest>,
  attribution?: string,
): { asset: CuratedAsset; duplicate: boolean } {
  const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");
  const pHash = pHashFromBuffer(buffer);
  const index = readIndex();
  const dup = findDuplicate(index.assets, contentHash, pHash);
  if (dup) return { asset: dup, duplicate: true };
  const size = imageSize(buffer) ?? { width: 0, height: 0 };
  const id = crypto.randomUUID();
  const ext = formatFromMime(mime) === "jpeg" ? "jpg" : formatFromMime(mime);
  const url = saveFile(userId, id, ext, buffer);
  const title = parsed.title || "Curated still";
  const description = title;
  const asset = ingestAsset({
    id,
    title,
    description,
    altText: title,
    originalUrl: url,
    width: size.width,
    height: size.height,
    fileSizeBytes: buffer.length,
    contentHash,
    pHash,
    tags: tagsFromText(`${title} ${parsed.source}`),
    categories: ["business_corporate"],
    source: parsed.source,
    license: parsed.license,
    attribution,
    buffer,
    format: formatFromMime(mime),
    dominantColors: sampleColors(buffer),
  });
  index.assets.unshift(asset);
  if (parsed.collectionId) {
    index.collections = index.collections.map((col) =>
      col.id === parsed.collectionId ? { ...col, assetIds: [...col.assetIds, asset.id] } : col,
    );
  }
  writeIndex(index);
  return { asset, duplicate: false };
}

export function searchAssets(query: { q?: string; tags?: string[]; aspectRatio?: CuratedAsset["aspectRatio"]; color?: string }) {
  return hybridSearch(readIndex().assets, query);
}

export function getAsset(id: string): CuratedAsset | undefined {
  return readIndex().assets.find((asset) => asset.id === id);
}

export function listAssets(): CuratedAsset[] {
  return readIndex().assets;
}

export function useAsset(id: string, event: { campaignId: string; channel: CuratorChannel }): CuratedAsset {
  const index = readIndex();
  const current = index.assets.find((asset) => asset.id === id);
  if (!current) throw new Error("Asset not found");
  const next = recordUsage(current, event);
  index.assets = index.assets.map((asset) => (asset.id === id ? next : asset));
  writeIndex(index);
  return next;
}

export function listCollections(): CuratorCollection[] {
  return readIndex().collections;
}

export function createCollection(name: string): CuratorCollection {
  const col: CuratorCollection = {
    id: crypto.randomUUID(),
    name: name.trim() || "Untitled board",
    assetIds: [],
    createdAt: new Date().toISOString(),
  };
  const index = readIndex();
  index.collections.unshift(col);
  writeIndex(index);
  return col;
}

async function jsonGet(url: string, headers: Record<string, string> = {}): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "NEXUS-KitLang/1.0", ...headers },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function runDeskScan(
  userId: string,
  query?: string,
): Promise<{ ingested: number; skipped: number; sources: string[] }> {
  const queries = curatorScanQueries(query);
  if (!queries.length) return { ingested: 0, skipped: 0, sources: [] };

  const unsplash: CuratorHunt[] = [];
  const pexels: CuratorHunt[] = [];
  const openverse: CuratorHunt[] = [];
  const firecrawl: CuratorHunt[] = [];
  const pexelsKey = process.env.PEXELS_API_KEY?.trim();
  const firecrawlKey = process.env.FIRECRAWL_API_KEY?.trim();

  for (let i = 0; i < queries.length; i += 4) {
    const batch = queries.slice(i, i + 4);
    await Promise.all(
      batch.map(async (q) => {
        const [u, p, o] = await Promise.all([
          jsonGet(`https://unsplash.com/napi/search/photos?query=${encodeURIComponent(q)}&per_page=20&content_filter=high`),
          pexelsKey
            ? jsonGet(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=15`, {
                Authorization: pexelsKey,
              })
            : Promise.resolve(null),
          jsonGet(
            `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license_type=commercial&page_size=20`,
          ),
        ]);
        if (u) unsplash.push(...huntsFromUnsplash(u, q));
        if (p) pexels.push(...huntsFromPexels(p, q));
        if (o) openverse.push(...huntsFromOpenverse(o));
      }),
    );
  }

  if (firecrawlKey) {
    await Promise.all(
      firecrawlQueriesFor(queries).map(async (q) => {
        try {
          const res = await fetch(firecrawlSearchUrl(), {
            method: "POST",
            headers: firecrawlAuthHeaders(),
            body: JSON.stringify({ query: q, limit: 15, sources: ["images"], country: "GB" }),
            signal: AbortSignal.timeout(30000),
          });
          if (res.ok) firecrawl.push(...huntsFromFirecrawlSearch(await res.json()));
        } catch {
          /* skip this Firecrawl hunt */
        }
      }),
    );
  }

  const hunts = mergeHunts([unsplash, pexels, openverse, firecrawl], 60);
  let ingested = 0;
  let skipped = 0;
  for (const item of hunts) {
    try {
      const result = await ingestFromUrl(userId, {
        url: item.url,
        source: item.source,
        license: item.license,
        title: item.title,
        attribution: item.attribution,
      });
      if (result.duplicate) skipped += 1;
      else ingested += 1;
    } catch {
      skipped += 1;
    }
  }
  return { ingested, skipped, sources: [...new Set(hunts.map((item) => item.source))] };
}
