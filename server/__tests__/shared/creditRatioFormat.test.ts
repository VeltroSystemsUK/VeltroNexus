import { describe, expect, it } from "vitest";
import {
  formatCreditPercent,
  formatCreditRatio,
} from "@/components/AutomaticCreditAnalysis";

describe("credit ratio display", () => {
  it("returns N/A when a ratio is null instead of calling toFixed", () => {
    expect(formatCreditRatio(null)).toBe("N/A");
    expect(formatCreditRatio(undefined)).toBe("N/A");
    expect(formatCreditPercent(null)).toBe("N/A");
    expect(formatCreditPercent(undefined)).toBe("N/A");
  });

  it("formats real ratios", () => {
    expect(formatCreditRatio(1.25)).toBe("1.25");
    expect(formatCreditPercent(22.5)).toBe("22.5%");
  });
});
