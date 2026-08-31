import { describe, expect, it } from "vitest";
import {
  MEDIA_CURATOR_PROMPT,
  aspectRatioFromSize,
  averageHash,
  bagEmbedding,
  curatorScanQueries,
  firecrawlQueriesFor,
  hammingDistance,
  huntsFromFirecrawlSearch,
  huntsFromOpenverse,
  huntsFromPexels,
  huntsFromUnsplash,
  hybridSearch,
  ingestAsset,
  isAllowedCuratorHost,
  isBlockedCuratorText,
  isNearDuplicate,
  mergeHunts,
  parseIngestRequest,
  pngSize,
  recordUsage,
  type CuratedAsset,
} from "@shared/mediaCurator";

function sample(partial: Partial<CuratedAsset> & Pick<CuratedAsset, "id" | "title">): CuratedAsset {
  return ingestAsset({
    id: partial.id,
    title: partial.title,
    description: partial.description ?? partial.title,
    altText: partial.altText ?? partial.title,
    originalUrl: partial.originalUrl ?? `/uploads/curator/${partial.id}.jpg`,
    width: partial.width ?? 1200,
    height: partial.height ?? 630,
    fileSizeBytes: partial.fileSizeBytes ?? 12_000,
    contentHash: partial.contentHash ?? partial.id,
    pHash: partial.pHash ?? "0".repeat(16),
    tags: partial.tags ?? ["office"],
    categories: partial.categories ?? ["business_corporate"],
    source: partial.source ?? "internal",
    license: partial.license ?? "internal",
    attribution: partial.attribution,
    buffer: Buffer.alloc(0),
  });
}

describe("Media Curator", () => {
  it("keeps Kit inside house policy", () => {
    expect(MEDIA_CURATOR_PROMPT).toMatch(/do not lend/i);
    expect(MEDIA_CURATOR_PROMPT).not.toMatch(/guaranteed funding/i);
    expect(MEDIA_CURATOR_PROMPT).toMatch(/Media Gallery/i);
  });

  it("reads PNG size and maps social aspect ratios", () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    expect(pngSize(png)).toEqual({ width: 1, height: 1 });
    expect(aspectRatioFromSize(1080, 1080)).toBe("1:1");
    expect(aspectRatioFromSize(1080, 1920)).toBe("9:16");
    expect(aspectRatioFromSize(1200, 630)).toBe("16:9");
    expect(aspectRatioFromSize(1080, 1350)).toBe("4:5");
    expect(aspectRatioFromSize(800, 600)).toBe("custom");
  });

  it("hashes a luminance grid and catches near-duplicates", () => {
    const base = Array.from({ length: 64 }, (_, i) => (i % 2 === 0 ? 30 : 200));
    const near = base.map((n, i) => (i === 3 ? 40 : n));
    const far = Array.from({ length: 64 }, (_, i) => (i % 2 === 0 ? 220 : 10));
    const a = averageHash(base);
    const b = averageHash(near);
    const c = averageHash(far);
    expect(a).toHaveLength(16);
    expect(hammingDistance(a, a)).toBe(0);
    expect(isNearDuplicate(a, b)).toBe(true);
    expect(isNearDuplicate(a, c)).toBe(false);
  });

  it("ingests an asset with variants, palette slots and a search embedding", () => {
    const asset = ingestAsset({
      id: "asset-1",
      title: "UK office desk",
      description: "Late afternoon oak desk, stacked files, empty chair.",
      altText: "Oak desk with files",
      originalUrl: "/uploads/curator/asset-1.jpg",
      width: 1200,
      height: 630,
      fileSizeBytes: 80_000,
      contentHash: "abc",
      pHash: averageHash(Array(64).fill(90)),
      tags: ["office", "desk"],
      categories: ["business_corporate"],
      source: "unsplash",
      license: "commercial",
      attribution: "Ada Cole",
      buffer: Buffer.alloc(0),
      dominantColors: ["#0f172a", "#c4a35a"],
    });
    expect(asset.aspectRatio).toBe("16:9");
    expect(asset.variants.thumbnail).toBe(asset.originalUrl);
    expect(asset.variants.landscape).toBe(asset.originalUrl);
    expect(asset.embeddingVector?.length).toBe(64);
    expect(asset.usageCount).toBe(0);
    expect(asset.campaignHistory).toEqual([]);
  });

  it("hybrid-searches by phrase, tag and aspect, then records usage", () => {
    const desk = sample({
      id: "desk",
      title: "Warm office desk",
      description: "oak desk coffee laptop late light",
      tags: ["office", "desk", "warm"],
      width: 1080,
      height: 1080,
    });
    const street = sample({
      id: "street",
      title: "Wet high street",
      description: "dusk pavement shop lights",
      tags: ["city", "dusk"],
      width: 1080,
      height: 1920,
    });
    const hits = hybridSearch([desk, street], { q: "warm office desk with coffee and laptop" });
    expect(hits[0]!.id).toBe("desk");
    const portrait = hybridSearch([desk, street], { aspectRatio: "9:16" });
    expect(portrait.map((item) => item.id)).toEqual(["street"]);
    const used = recordUsage(desk, { campaignId: "c1", channel: "email" });
    expect(used.usageCount).toBe(1);
    expect(used.campaignHistory[0]).toMatchObject({ campaignId: "c1", channel: "email" });
  });

  it("parses an ingest request from a URL", () => {
    const parsed = parseIngestRequest({
      url: "https://images.unsplash.com/photo-1",
      source: "unsplash",
      license: "commercial",
      title: "Desk",
    });
    expect(parsed.url).toContain("unsplash");
    expect(parsed.source).toBe("unsplash");
    expect(() => parseIngestRequest({})).toThrow(/url or file/i);
  });

  it("hunts a wide commercial-finance desk, not one office-desk phrase", () => {
    const queries = curatorScanQueries();
    expect(queries.length).toBeGreaterThanOrEqual(8);
    expect(queries.join(" ")).toMatch(/warehouse|high street|workshop|boardroom|construction/i);
    expect(queries.join(" ")).not.toMatch(/payday|luxury car|guaranteed funding/i);
    expect(curatorScanQueries("UK warehouse pallet racking")).toEqual(["UK warehouse pallet racking"]);
    expect(isBlockedCuratorText("payday loan shop front")).toBe(true);
    expect(isBlockedCuratorText("UK warehouse pallet racking")).toBe(false);
    expect(MEDIA_CURATOR_PROMPT).toMatch(/Firecrawl/i);
    expect(MEDIA_CURATOR_PROMPT).toMatch(/Openverse|Pexels/i);
  });

  it("parses Unsplash, Pexels, Openverse and Firecrawl stills and drops random hosts", () => {
    const unsplash = huntsFromUnsplash({
      results: [{ urls: { regular: "https://images.unsplash.com/photo-desk" }, alt_description: "Desk", user: { name: "Ada" } }],
    }, "desk");
    expect(unsplash[0]).toMatchObject({ url: "https://images.unsplash.com/photo-desk", source: "unsplash", attribution: "Ada" });

    const pexels = huntsFromPexels({
      photos: [{ src: { large: "https://images.pexels.com/photos/1/large.jpeg" }, alt: "Shop", photographer: "Bo" }],
    }, "shop");
    expect(pexels[0]).toMatchObject({ url: "https://images.pexels.com/photos/1/large.jpeg", source: "pexels", attribution: "Bo" });

    const openverse = huntsFromOpenverse({
      results: [{ url: "https://upload.wikimedia.org/file.jpg", title: "Mill", creator: "Pat", license: "cc0" }],
    });
    expect(openverse[0]).toMatchObject({ source: "openverse", license: "public-domain", attribution: "Pat" });

    const firecrawl = huntsFromFirecrawlSearch({
      data: {
        images: [
          { imageUrl: "https://images.unsplash.com/photo-wharf", title: "Wharf", url: "https://unsplash.com/photos/wharf" },
          { imageUrl: "https://evil.example/steal.jpg", title: "Nope" },
        ],
      },
    });
    expect(firecrawl.map((h) => h.url)).toEqual(["https://images.unsplash.com/photo-wharf"]);
    expect(isAllowedCuratorHost("https://random.blog/hero.png")).toBe(false);
    expect(isAllowedCuratorHost("https://images.pexels.com/photos/2.jpg")).toBe(true);
  });

  it("round-robins sources and caps the haul", () => {
    const merged = mergeHunts([
      huntsFromUnsplash({
        results: [
          { urls: { regular: "https://images.unsplash.com/a" }, alt_description: "A" },
          { urls: { regular: "https://images.unsplash.com/b" }, alt_description: "B" },
        ],
      }, "a"),
      huntsFromPexels({
        photos: [{ src: { large: "https://images.pexels.com/c.jpg" }, alt: "C", photographer: "C" }],
      }, "c"),
    ], 2);
    expect(merged).toHaveLength(2);
    expect(merged.map((h) => h.source).sort()).toEqual(["pexels", "unsplash"]);
    expect(firecrawlQueriesFor(["a", "b", "c", "d", "e", "f"])).toHaveLength(3);
  });
});

