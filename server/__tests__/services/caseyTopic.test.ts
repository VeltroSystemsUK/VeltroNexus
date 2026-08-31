import { describe, expect, it } from "vitest";
import { caseyHostAllowed, scanWeek } from "@shared/craftScout";
import { researchTopic } from "../../services/caseyScout";

describe("researchTopic", () => {
  it("passes the trimmed topic to crawl and keeps on-scope official notes", async () => {
    let seen = "";
    const result = await researchTopic("  HMRC Time to Pay SME arrears  ", async (query) => {
      seen = query;
      return [
        { title: "TTP guidance", url: "https://www.gov.uk/time-to-pay", snippet: "HMRC Time to Pay for SMEs in tax arrears." },
        { title: "Random blog", url: "https://random.blog/hero", snippet: "refinance stacked debt" },
        { title: "Crypto treasury", url: "https://www.bankofengland.co.uk/crypto", snippet: "bitcoin on the balance sheet" },
      ];
    });
    expect(seen).toBe("HMRC Time to Pay SME arrears");
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]!.url).toContain("gov.uk");
    expect(result.warning).toBeUndefined();
  });

  it("does not inject the Craft seed library when crawl is empty", async () => {
    const result = await researchTopic("UK SME stacked short-term loans refinance", async () => []);
    expect(result.notes).toEqual([]);
    expect(result.warning).toMatch(/No in-scope official sources landed/);
    expect(result.notes).not.toEqual(scanWeek(Date.now()).slice(0, 1));
  });

  it("throws when crawl throws", async () => {
    await expect(
      researchTopic("BoE hold", async () => {
        throw new Error("Firecrawl down");
      }),
    ).rejects.toThrow(/Firecrawl down/);
  });

  it("caps at 8 unique URLs", async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      title: `HMRC Time to Pay note ${i}`,
      url: `https://www.gov.uk/ttp-${i}`,
      snippet: "HMRC Time to Pay SME tax arrears refinance packager",
    }));
    many.push(many[0]!);
    const result = await researchTopic("HMRC Time to Pay", async () => many);
    expect(result.notes).toHaveLength(8);
  });
});

describe("caseyHostAllowed", () => {
  it("allows official UK hosts and drops others", () => {
    expect(caseyHostAllowed("https://www.bankofengland.co.uk/news")).toBe(true);
    expect(caseyHostAllowed("https://random.blog/hero")).toBe(false);
  });
});
