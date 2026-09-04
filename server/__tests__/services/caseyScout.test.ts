import { describe, expect, it } from "vitest";
import { scanWeek } from "@shared/craftScout";
import { researchWeek } from "../../services/caseyScout";

describe("Casey researchWeek", () => {
  it("uses live briefs when Casey returns seven JSON objects", async () => {
    const live = scanWeek(7);
    const ask = async () => JSON.stringify(live);
    const briefs = await researchWeek([], ask as never, new Date("2026-08-31"), async () => []);
    expect(briefs.map((brief) => brief.headline)).toEqual(live.map((brief) => brief.headline));
  });

  it("rotates the library when the live scan fails so the week is not identical", async () => {
    const previous = scanWeek(0);
    const ask = async () => {
      throw new Error("ANTHROPIC_API_KEY is not configured on the server");
    };
    const briefs = await researchWeek(previous, ask as never, new Date("2026-08-31"), async () => []);
    expect(briefs).toHaveLength(7);
    expect(briefs.map((brief) => brief.headline)).not.toEqual(previous.map((brief) => brief.headline));
  });

  it("grounds the live prompt in Firecrawl notes", async () => {
    let seen = "";
    const ask = async (prompt: string) => {
      seen = prompt;
      return JSON.stringify(scanWeek(7));
    };
    const crawl = async () => [
      {
        title: "Bank Rate held",
        url: "https://www.bankofengland.co.uk/news/rate",
        snippet: "The MPC held Bank Rate.",
      },
    ];
    await researchWeek([], ask, new Date("2026-08-31"), crawl);
    expect(seen).toMatch(/bankofengland\.co.uk/);
    expect(seen).toMatch(/The MPC held Bank Rate/);
    expect(seen).toMatch(/Firecrawl/i);
    expect(seen).toMatch(/stratafinance\.co\.uk/i);
    expect(seen).toMatch(/off the desk/i);
    expect(seen).toMatch(/HMRC|Time to Pay|stacked|CDFI/i);
  });

  it("keeps on-scope live briefs and fills the rest from the library", async () => {
    const ask = async () =>
      JSON.stringify([
        {
          id: "ammo-live-ttp",
          track: "borrower",
          headline: "HMRC time to pay is a pack",
          source: "HMRC Time to Pay guidance.",
          coreFact: "Tax arrears sit in front of refinance.",
          smeImpact: "We package the arrears file first. We do not lend.",
          trigger: "Fear of the brown envelope.",
          freshAngle: "Clear the tax file first.",
          dataBites: ["Missing: current HMRC late-payment rate."],
          socialAngle: "Tax arrears first. Then the refinance pack.",
          emailAngle: "A Time to Pay file is a pack. We do not lend.",
          stockId: "paper",
          imagePrompt: "UK desk, brown envelope, no people",
        },
        {
          id: "ammo-live-crypto",
          track: "borrower",
          headline: "Crypto treasury for SMEs",
          source: "A blog.",
          coreFact: "Bitcoin on the balance sheet as working capital.",
          smeImpact: "Directors should hold crypto.",
          trigger: "FOMO.",
          freshAngle: "Treasury is a token.",
          dataBites: ["No figure."],
          socialAngle: "Stack satoshi, not loans.",
          emailAngle: "A bitcoin pack.",
          stockId: "studio",
          imagePrompt: "neon",
        },
      ]);
    const briefs = await researchWeek([], ask as never, new Date("2026-08-31"), async () => []);
    expect(briefs).toHaveLength(7);
    expect(briefs[0]!.id).toBe("ammo-live-ttp");
    expect(briefs.some((row) => /crypto|bitcoin/i.test(row.headline))).toBe(false);
  });
});
