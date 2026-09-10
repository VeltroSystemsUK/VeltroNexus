import { describe, expect, it } from "vitest";
import {
  linesFromSterlingEdit,
  parseSterlingCopyEdits,
  seedSterlingCopy,
  STERLING_COPY_FIELDS,
} from "@shared/sterlingEdits";

describe("sterling copy edits", () => {
  it("keeps David's long lines and pound figures", () => {
    const lines = linesFromSterlingEdit(
      "Recommend approval of the £120,000 refinance over 60 months.\n\nSubject to a site visit.",
    );
    expect(lines).toEqual([
      "Recommend approval of the £120,000 refinance over 60 months.",
      "Subject to a site visit.",
    ]);
  });

  it("parses only known copy fields", () => {
    const parsed = parseSterlingCopyEdits({
      background: "Ten years trading in Yate.",
      junk: "nope",
      theBusiness: "Omnichannel craft retailer.",
    });
    expect(parsed.background).toBe("Ten years trading in Yate.");
    expect(parsed.theBusiness).toBe("Omnichannel craft retailer.");
    expect((parsed as any).junk).toBeUndefined();
  });

  it("seeds from proposal slots then overlays saved edits", () => {
    const seeded = seedSterlingCopy(
      {
        background: ["Old background."],
        theBusiness: ["Shop in Yate."],
        campari: { character: ["Sole director Kirsty Bevan."] },
        forecastCritique: ["Sheet is optimistic."],
        recommendation: "",
      },
      { background: "David rewrote background.", recommendation: "Approve with conditions." },
    );
    expect(seeded.background).toBe("David rewrote background.");
    expect(seeded.theBusiness).toBe("Shop in Yate.");
    expect(seeded.character).toBe("Sole director Kirsty Bevan.");
    expect(seeded.forecastCritique).toBe("Sheet is optimistic.");
    expect(seeded.recommendation).toBe("Approve with conditions.");
    expect(STERLING_COPY_FIELDS).toContain("forecastCritique");
    expect(STERLING_COPY_FIELDS).toContain("financials");
    expect(STERLING_COPY_FIELDS).toContain("dealSummary");
  });

  it("seeds financials commentary from accounts years", () => {
    const seeded = seedSterlingCopy(
      {
        financials: ["Turnover £132,325 (2025)."],
        dealSummary: ["Refinance of stacked short-term debt."],
      },
      null,
    );
    expect(seeded.financials).toBe("Turnover £132,325 (2025).");
    expect(seeded.dealSummary).toBe("Refinance of stacked short-term debt.");
  });
});
