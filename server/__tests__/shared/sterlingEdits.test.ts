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

  it("does not seed Auto Write slots; only David's saved edits and recommendation", () => {
    const seeded = seedSterlingCopy(
      {
        background: ["Old background."],
        theBusiness: ["Shop in Yate."],
        campari: { character: ["Sole director Kirsty Bevan."] },
        forecastCritique: ["Sheet is optimistic."],
        recommendation: "Approve with conditions.",
      },
      { background: "David rewrote background." },
    );
    expect(seeded.background).toBe("David rewrote background.");
    expect(seeded.theBusiness).toBe("");
    expect(seeded.character).toBe("");
    expect(seeded.forecastCritique).toBe("");
    expect(seeded.recommendation).toBe("Approve with conditions.");
    expect(STERLING_COPY_FIELDS).toContain("forecastCritique");
    expect(STERLING_COPY_FIELDS).toContain("financials");
    expect(STERLING_COPY_FIELDS).toContain("dealSummary");
  });

  it("leaves commentary blank when David has not written yet", () => {
    const seeded = seedSterlingCopy(
      {
        financials: ["Turnover £132,325 (2025)."],
        dealSummary: ["Refinance of stacked short-term debt."],
      },
      null,
    );
    expect(seeded.financials).toBe("");
    expect(seeded.dealSummary).toBe("");
    expect(seeded.recommendation).toBe("");
  });
});
