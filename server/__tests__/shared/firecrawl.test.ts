import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  FIRECRAWL_CLOUD,
  canFirecrawlScrape,
  firecrawlApiBase,
  firecrawlAuthHeaders,
  firecrawlScrapeUrl,
  firecrawlSearchUrl,
  parseFirecrawlSearchHits,
} from "@shared/firecrawl";

describe("firecrawl endpoints", () => {
  it("defaults scrape to the cloud v2 scrape URL", () => {
    expect(firecrawlApiBase({})).toBe(FIRECRAWL_CLOUD);
    expect(firecrawlScrapeUrl({})).toBe("https://api.firecrawl.dev/v2/scrape");
  });

  it("points scrape at a self-hosted API when FIRECRAWL_API_URL is set", () => {
    const env = { FIRECRAWL_API_URL: "http://127.0.0.1:3002/" };
    expect(firecrawlApiBase(env)).toBe("http://127.0.0.1:3002");
    expect(firecrawlScrapeUrl(env)).toBe("http://127.0.0.1:3002/v2/scrape");
  });

  it("defaults search to the cloud API", () => {
    expect(firecrawlSearchUrl({})).toBe("https://api.firecrawl.dev/v2/search");
  });

  it("points search at a self-hosted API when FIRECRAWL_API_URL is set, same as scrape", () => {
    expect(firecrawlSearchUrl({ FIRECRAWL_API_URL: "http://127.0.0.1:3002" })).toBe(
      "http://127.0.0.1:3002/v2/search"
    );
  });

  it("only treats a self-hosted URL as a scrape target, never the cloud key", () => {
    expect(canFirecrawlScrape({ FIRECRAWL_API_URL: "http://127.0.0.1:3002" })).toBe(true);
    expect(canFirecrawlScrape({})).toBe(false);
    expect(canFirecrawlScrape({ FIRECRAWL_API_KEY: "fc-test" })).toBe(false);
  });

  it("omits Authorization when no key is set", () => {
    expect(firecrawlAuthHeaders({})).toEqual({ "Content-Type": "application/json" });
    expect(firecrawlAuthHeaders({ FIRECRAWL_API_KEY: "fc-test" }).Authorization).toBe("Bearer fc-test");
  });

  it("reads local v2 search hits from data.web, not by iterating the data object", () => {
    const hits = parseFirecrawlSearchHits({
      success: true,
      data: {
        web: [
          { url: "https://jpd-services.co.uk", title: "JPD Maintenance", description: "Joinery and maintenance" },
          {
            url: "https://find-and-update.company-information.service.gov.uk/company/11353470",
            title: "Companies House",
          },
        ],
      },
    });
    expect(hits.map((row) => row.url)).toEqual([
      "https://jpd-services.co.uk",
      "https://find-and-update.company-information.service.gov.uk/company/11353470",
    ]);
  });
});

describe("harvest OSINT uses the local Firecrawl search URL", () => {
  it("does not call Firecrawl Cloud or Google Places from live attach", () => {
    const src = fs.readFileSync(path.resolve("server/services/smeLeadHopper.ts"), "utf8");
    expect(src).toMatch(/firecrawlSearchUrl\(\)/);
    expect(src).not.toMatch(/api\.firecrawl\.dev\/v1\/search/);
    expect(src).not.toMatch(/maps\.googleapis\.com\/maps\/api\/place/);
  });
});
