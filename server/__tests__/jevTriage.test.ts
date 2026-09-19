import { describe, expect, it } from "vitest";
import { suggestedPriorityFromTriage } from "@shared/jevTriage";

describe("Jev lead triage", () => {
  it("maps qualify + urgency to high priority and drop to low", () => {
    expect(suggestedPriorityFromTriage({ nextAction: "qualify", urgency: 2 })).toBe("high");
    expect(suggestedPriorityFromTriage({ nextAction: "nurture", urgency: 2 })).toBe("medium");
    expect(suggestedPriorityFromTriage({ nextAction: "drop", urgency: 2 })).toBe("low");
  });
});
