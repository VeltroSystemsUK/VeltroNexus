import { describe, expect, it } from "vitest";
import {
  FILE_PACK_LENDER_ID,
  hasSterlingZip,
  lenderForPack,
  recommendationForPack,
  sterlingRailSucceeded,
} from "@shared/sterlingRail";

describe("sterling rail", () => {
  it("treats a handoff without packGeneratedAt as no zip", () => {
    expect(hasSterlingZip({})).toBe(false);
    expect(hasSterlingZip({ packGeneratedAt: "2026-09-15T08:00:00.000Z" })).toBe(true);
    expect(hasSterlingZip({ sterlingPackCompiledAt: "2026-09-15T08:00:00.000Z" })).toBe(true);
  });

  it("does not count complete-without-zip as success", () => {
    expect(sterlingRailSucceeded({ stage: "complete" })).toBe(false);
    expect(sterlingRailSucceeded({ stage: "human_review", packGeneratedAt: "2026-09-15T08:00:00.000Z" })).toBe(false);
    expect(
      sterlingRailSucceeded({ stage: "complete", sterlingPackCompiledAt: "2026-09-15T08:00:00.000Z" }),
    ).toBe(true);
  });

  it("prefers the handoff recommendation, then the director judgement", () => {
    expect(recommendationForPack({ handoffRecommendation: "  Supportable.  ", underwritingJudgement: "memo" })).toBe(
      "Supportable.",
    );
    expect(recommendationForPack({ underwritingJudgement: "Recommendation only." })).toBe("Recommendation only.");
    expect(recommendationForPack({})).toBe("");
  });

  it("uses David's lender, else the file-pack lender ffe", () => {
    expect(FILE_PACK_LENDER_ID).toBe("ffe");
    expect(lenderForPack({ requestedLenderId: "cwrt" })).toBe("cwrt");
    expect(lenderForPack({ approvedLenderId: "bcrs" })).toBe("bcrs");
    expect(lenderForPack({})).toBe("ffe");
    expect(lenderForPack({ requestedLenderId: "not-a-lender" })).toBe("ffe");
  });
});
