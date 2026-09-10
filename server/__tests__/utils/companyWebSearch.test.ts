import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCompanyWebSearchQueries,
  grokSearchCompanyWeb,
  localityHint,
  parseGrokWebSearchResponse,
  rankCompanyWebResults,
  searchCompanyWeb,
  tradingNames,
} from "../../utils/companyWebSearch";

describe("tradingNames", () => {
  it("strips legal suffixes and adds a possessive first-word variant", () => {
    expect(tradingNames("Georges Tradition Group Limited")).toEqual([
      "Georges Tradition Group Limited",
      "Georges Tradition",
      "George's Tradition",
    ]);
  });

  it("leaves names without a possessive first word alone", () => {
    expect(tradingNames("Sterling Commercial Finance Ltd")).toEqual([
      "Sterling Commercial Finance Ltd",
      "Sterling Commercial Finance",
    ]);
  });
});

describe("localityHint", () => {
  it("takes the last two address parts after stripping the postcode", () => {
    expect(
      localityHint(
        "Unit 1 Erewash Court Manners Avenue, Manners Industrial Estate, Ilkeston, Derbyshire, DE7 8EF"
      )
    ).toBe("Ilkeston Derbyshire");
  });
});

describe("buildCompanyWebSearchQueries", () => {
  it("does not use the generic 'UK company' phrasing that surfaces Companies House", () => {
    const queries = buildCompanyWebSearchQueries({
      companyName: "Georges Tradition Group Limited",
      companyNumber: "13774324",
      registeredAddress: "Ilkeston, Derbyshire, DE7 8EF",
    });

    expect(queries.map((q) => q.id)).toEqual(["press", "adverse", "recent-news", "company-number"]);
    for (const spec of queries) {
      expect(spec.query.toLowerCase()).not.toContain("uk company");
    }
    expect(queries.find((q) => q.id === "press")?.query).toContain("George's Tradition");
    expect(queries.find((q) => q.id === "press")?.query).toContain("Ilkeston Derbyshire");
    expect(queries.find((q) => q.id === "adverse")?.query).toContain("administration");
    expect(queries.find((q) => q.id === "recent-news")?.topic).toBe("news");
    expect(queries.find((q) => q.id === "company-number")?.query).toContain("13774324");
  });
});

describe("rankCompanyWebResults", () => {
  const names = tradingNames("Georges Tradition Group Limited");

  it("drops Companies House / Endole listings and ranks the BBC story first", () => {
    const ranked = rankCompanyWebResults(
      [
        {
          title: "GEORGES TRADITION GROUP LIMITED - Overview",
          url: "https://find-and-update.company-information.service.gov.uk/company/13774324",
          content: "Companies House filing history for Georges Tradition Group Limited",
          score: 0.98,
        },
        {
          title: "Georges Tradition Group Limited - Company Profile - Endole",
          url: "https://open.endole.co.uk/insight/company/13774324-georges-tradition-group-limited",
          content: "Active company incorporated in Ilkeston, Derbyshire",
          score: 0.9,
        },
        {
          title: "Jobs saved as managers buy popular East Midlands chip shop chain",
          url: "https://www.bbc.co.uk/news/uk-england-derbyshire-59698046",
          content:
            "George's Tradition has six takeaways across Nottinghamshire and Derbyshire. More than 100 jobs were put at risk when administrators were appointed.",
          score: 0.55,
        },
        {
          title: "Failed George's Tradition fish and chip shops saved by new owners",
          url: "https://www.derbytelegraph.co.uk/whats-on/food-drink/failed-georges-tradition-fish-chip-6355009",
          content: "George's Tradition went into administration last month due to historical debts.",
          score: 0.5,
        },
      ],
      names
    );

    expect(ranked.map((r) => r.url)).toEqual([
      "https://www.bbc.co.uk/news/uk-england-derbyshire-59698046",
      "https://www.derbytelegraph.co.uk/whats-on/food-drink/failed-georges-tradition-fish-chip-6355009",
    ]);
    expect(ranked[0].kind).toBe("adverse");
    expect(ranked.some((r) => r.url.includes("company-information.service.gov.uk"))).toBe(false);
    expect(ranked.some((r) => r.url.includes("endole"))).toBe(false);
  });

  it("drops company-number directory pages that are not news", () => {
    const ranked = rankCompanyWebResults(
      [
        {
          title: "Georges Tradition Group Limited",
          url: "https://www.bymetric.com/company/13774324/georges-tradition-group-limited",
          content: "Georges Tradition Group Limited company profile",
          score: 0.8,
        },
        {
          title: "Jobs saved as managers buy popular East Midlands chip shop chain",
          url: "https://www.bbc.co.uk/news/uk-england-derbyshire-59698046",
          content: "George's Tradition has six takeaways. Administrators were appointed.",
          score: 0.55,
        },
      ],
      names,
      "13774324"
    );
    expect(ranked.map((r) => r.url)).toEqual([
      "https://www.bbc.co.uk/news/uk-england-derbyshire-59698046",
    ]);
  });

  it("deduplicates the same URL with and without a trailing slash", () => {
    const ranked = rankCompanyWebResults(
      [
        {
          title: "Jobs saved",
          url: "https://www.bbc.co.uk/news/uk-england-derbyshire-59698046/",
          content: "George's Tradition",
          score: 0.4,
        },
        {
          title: "Jobs saved",
          url: "https://www.bbc.co.uk/news/uk-england-derbyshire-59698046",
          content: "George's Tradition",
          score: 0.6,
        },
      ],
      names
    );
    expect(ranked).toHaveLength(1);
  });

  it("treats bbc.com and bbc.co.uk as the same article", () => {
    const ranked = rankCompanyWebResults(
      [
        {
          title: "Jobs saved",
          url: "https://www.bbc.com/news/uk-england-derbyshire-59698046",
          content: "George's Tradition",
          score: 0.5,
        },
        {
          title: "Jobs saved",
          url: "https://www.bbc.co.uk/news/uk-england-derbyshire-59698046",
          content: "George's Tradition",
          score: 0.6,
        },
      ],
      names
    );
    expect(ranked).toHaveLength(1);
  });

  it("drops unrelated hits that never mention the company", () => {
    const ranked = rankCompanyWebResults(
      [
        {
          title: "Supreme Court confirms scope of liability in fraudulent trading claims",
          url: "https://www.pinsentmasons.com/out-law/news/supreme-court-liability-fraudulent-trading-claims",
          content: "The Supreme Court considered fraudulent trading under the Insolvency Act.",
          score: 0.8,
        },
      ],
      names
    );
    expect(ranked).toHaveLength(0);
  });
});

describe("parseGrokWebSearchResponse", () => {
  it("maps Grok output_text and citations into Associations web-search rows", () => {
    const parsed = parseGrokWebSearchResponse({
      output_text: "George's Tradition was bought out of administration; more than 100 jobs were saved.",
      citations: [
        "https://www.bbc.co.uk/news/uk-england-derbyshire-59698046",
        { url: "https://www.derbytelegraph.co.uk/food", title: "Local press" },
      ],
    });
    expect(parsed.answer).toMatch(/administration/);
    expect(parsed.results.map((row) => row.url)).toEqual([
      "https://www.bbc.co.uk/news/uk-england-derbyshire-59698046",
      "https://www.derbytelegraph.co.uk/food",
    ]);
    expect(parsed.results[1].title).toBe("Local press");
  });
});

describe("grokSearchCompanyWeb", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls Grok Responses API with web_search enabled", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.x.ai/v1/responses");
      const body = JSON.parse(String(init?.body || "{}"));
      expect(body.model).toBe("grok-4.6");
      expect(body.tools).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: "web_search" })])
      );
      expect(JSON.stringify(body.input)).toMatch(/THE HOME CRAFTERS/);
      return {
        ok: true,
        json: async () => ({
          output_text: "Home Crafters is a kitchen fitter in Bristol.",
          citations: ["https://www.bbc.co.uk/news/uk-england-bristol-home-crafters"],
        }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await grokSearchCompanyWeb({
      companyName: "THE HOME CRAFTERS LTD.",
      companyNumber: "10034885",
      registeredAddress: "Bristol",
      env: { XAI_API_KEY: "xai-test-key" },
    });

    expect(result.answer).toMatch(/kitchen fitter/);
    expect(result.results[0].url).toContain("bbc.co.uk");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("searchCompanyWeb", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses Grok web_search for Associations even when a Tavily key is present", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(String(url)).toBe("https://api.x.ai/v1/responses");
      return {
        ok: true,
        json: async () => ({
          output_text: "Home Crafters fits kitchens in Bristol.",
          citations: ["https://www.bbc.co.uk/news/uk-england-bristol-home-crafters"],
        }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchCompanyWeb({
      apiKey: "tvly-should-not-be-used",
      companyName: "THE HOME CRAFTERS LTD.",
      companyNumber: "10034885",
      env: { XAI_API_KEY: "xai-test-key" },
    });

    expect(result.answer).toMatch(/kitchens/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rethrows the Grok error when Tavily is not configured", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        text: async () => "quota exceeded",
      }) as Response)
    );

    await expect(
      searchCompanyWeb({
        companyName: "THE HOME CRAFTERS LTD.",
        env: { XAI_API_KEY: "xai-test-key" },
      })
    ).rejects.toThrow(/quota exceeded/);
  });
});
