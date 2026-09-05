import { describe, expect, it } from "vitest";
import {
  FIRECRAWL_CLOUD,
  canFirecrawlScrape,
  firecrawlApiBase,
  firecrawlAuthHeaders,
  firecrawlScrapeUrl,
  firecrawlSearchUrl,
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
});
