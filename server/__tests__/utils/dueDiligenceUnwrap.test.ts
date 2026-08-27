import { describe, expect, it } from "vitest";
import { unwrapDueDiligence } from "@shared/dueDiligence";

describe("unwrapDueDiligence", () => {
  it("reads underwriting from the GET wrapper row", () => {
    const inner = {
      underwriting: {
        swotAnalysis: { strengths: ["Repeat trade"], summary: "Supportable." },
      },
    };
    expect(
      unwrapDueDiligence({
        id: 1,
        prospectId: 73,
        userId: "owner",
        data: inner,
      }).underwriting?.swotAnalysis?.summary
    ).toBe("Supportable.");
  });

  it("passes through an already-unwrapped payload", () => {
    const inner = { underwriting: { swotAnalysis: { summary: "Direct." } } };
    expect(unwrapDueDiligence(inner).underwriting?.swotAnalysis?.summary).toBe("Direct.");
  });

  it("returns {} for empty input", () => {
    expect(unwrapDueDiligence(null)).toEqual({});
    expect(unwrapDueDiligence(undefined)).toEqual({});
  });
});
