import { describe, expect, it, vi } from "vitest";
import { jevRankLender, parseJevHarvestAnswers, parseJevLenderAnswers } from "../../services/jevHarvestRank";

describe("parseJevHarvestAnswers", () => {
  it("reads noul, score and skip class from a System One payload", () => {
    const rank = parseJevHarvestAnswers({
      harvest_now: { type: "noul", noul: 0.75 },
      sme_borrower: { type: "score", score: 3.05 },
      skip_class: { type: "choice", choice: "charge_sme" },
    });
    expect(rank.harvestNow).toBe(true);
    expect(rank.smeBorrower).toBe(3);
    expect(rank.skipClass).toBe("charge_sme");
  });

  it("treats a low noul as not harvest-now and unknown class as unsure", () => {
    const rank = parseJevHarvestAnswers({
      harvest_now: { type: "noul", noul: 0.2 },
      sme_borrower: { type: "score", score: 9 },
      skip_class: { type: "choice", choice: "banana" },
    });
    expect(rank.harvestNow).toBe(false);
    expect(rank.smeBorrower).toBe(4);
    expect(rank.skipClass).toBe("unsure");
  });
});

describe("parseJevLenderAnswers", () => {
  it("reads a cost band and maps a 0-4 score onto typical APR", () => {
    expect(
      parseJevLenderAnswers({
        lender_band: { type: "choice", choice: "mca" },
        typical_apr: { type: "score", score: 4 },
      }),
    ).toEqual({ band: "mca", typicalApr: 45 });
  });

  it("keeps an explicit APR when Jev returns a percentage", () => {
    expect(
      parseJevLenderAnswers({
        lender_band: { type: "choice", choice: "high_cost" },
        typical_apr: { type: "score", value: 32 },
      }),
    ).toEqual({ band: "high_cost", typicalApr: 32 });
  });

  it("falls back to unknown when the band is not a known class", () => {
    expect(parseJevLenderAnswers({ lender_band: { choice: "banana" } })).toEqual({
      band: "unknown",
      typicalApr: 0,
    });
  });
});

describe("jevRankLender", () => {
  it("classifies catalogued lenders without calling TypeSafe", async () => {
    const fetchImpl = vi.fn();
    const rank = await jevRankLender("Iwoca Limited", { TYPESAFE_API_KEY: "k" }, fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(rank.band).toBe("mca");
    expect(rank.typicalApr).toBe(49);
  });
});
