import { describe, expect, it } from "vitest";
import { caseyHostAllowed, scanWeek } from "@shared/craftScout";
import { researchTopic } from "../../services/caseyScout";

describe("researchTopic", () => {
  it("passes the trimmed topic to crawl and keeps open-web notes, including off-desk hosts", async () => {
    let seen = "";
    const result = await researchTopic("  Hidden commission in UK commercial finance  ", async (query) => {
      seen = query;
      return [
        { title: "TTP guidance", url: "https://www.gov.uk/time-to-pay", snippet: "HMRC Time to Pay for SMEs in tax arrears." },
        { title: "Broker commissions", url: "https://www.ft.com/content/broker-fees", snippet: "Packagers take large fees on stacked facilities." },
        { title: "Trade blog", url: "https://random.blog/hero", snippet: "Hidden commission in bad loans." },
      ];
    });
    expect(seen).toBe("Hidden commission in UK commercial finance");
    expect(result.notes).toHaveLength(3);
    expect(result.notes.map((note) => note.url)).toEqual([
      "https://www.gov.uk/time-to-pay",
      "https://www.ft.com/content/broker-fees",
      "https://random.blog/hero",
    ]);
    expect(result.warning).toBeUndefined();
  });

  it("does not inject the Craft seed library when crawl is empty", async () => {
    const result = await researchTopic("UK SME stacked short-term loans refinance", async () => []);
    expect(result.notes).toEqual([]);
    expect(result.warning).toBe("No sources landed");
    expect(result.notes).not.toEqual(scanWeek(Date.now()).slice(0, 1));
  });

  it("throws when crawl throws", async () => {
    await expect(
      researchTopic("BoE hold", async () => {
        throw new Error("Firecrawl down");
      }),
    ).rejects.toThrow(/Firecrawl down/);
  });

  it("caps at 12 unique URLs", async () => {
    const many = Array.from({ length: 16 }, (_, i) => ({
      title: `Commission note ${i}`,
      url: `https://news.example/commission-${i}`,
      snippet: "Broker commission on UK commercial finance.",
    }));
    many.push(many[0]!);
    const result = await researchTopic("broker commission", async () => many);
    expect(result.notes).toHaveLength(12);
  });
});

describe("caseyHostAllowed", () => {
  it("allows official UK hosts and drops others", () => {
    expect(caseyHostAllowed("https://www.bankofengland.co.uk/news")).toBe(true);
    expect(caseyHostAllowed("https://random.blog/hero")).toBe(false);
  });
});
