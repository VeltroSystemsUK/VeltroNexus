import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorialWebScan } from "../../services/caseyScout";

describe("editorialWebScan", () => {
  const originalFirecrawlKey = process.env.FIRECRAWL_API_KEY;
  const originalTavilyKey = process.env.TAVILY_API_KEY;

  beforeEach(() => {
    process.env.FIRECRAWL_API_KEY = "fc-test";
    process.env.TAVILY_API_KEY = "tvly-test";
  });

  afterEach(() => {
    process.env.FIRECRAWL_API_KEY = originalFirecrawlKey;
    process.env.TAVILY_API_KEY = originalTavilyKey;
    vi.unstubAllGlobals();
  });

  it("falls back to Tavily instead of throwing when Firecrawl is out of credit (402)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("firecrawl")) {
          return { ok: false, status: 402 } as Response;
        }
        return {
          ok: true,
          json: async () => ({
            results: [{ url: "https://example.com/a", title: "A", content: "snippet" }],
          }),
        } as Response;
      }),
    );

    const notes = await editorialWebScan("HMRC time to pay");
    expect(notes).toEqual([{ title: "A", url: "https://example.com/a", snippet: "snippet" }]);
  });

  it("returns an empty list, not a thrown error, when every source fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 402 }) as Response),
    );

    await expect(editorialWebScan("HMRC time to pay")).resolves.toEqual([]);
  });
});
