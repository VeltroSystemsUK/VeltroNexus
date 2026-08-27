import { describe, expect, it } from "vitest";
import { handoverPackHtml, resolveHandoverPack } from "@shared/handoverPack";

describe("handover pack", () => {
  it("includes every assessment question and maps a completed tick to Yes", () => {
    const pack = resolveHandoverPack([
      { itemId: "ec-1", completed: true, notes: "DOB 1984" },
      { itemId: "ec-2", answer: "no", notes: "Director lives in Ireland" },
    ]);
    const eligibility = pack.sections.find((s) => s.id === "eligibility-criteria");
    expect(eligibility?.items.length).toBeGreaterThan(2);
    const ec1 = eligibility?.items.find((i) => i.id === "ec-1");
    const ec2 = eligibility?.items.find((i) => i.id === "ec-2");
    const ec3 = eligibility?.items.find((i) => i.id === "ec-3");
    expect(ec1).toEqual(
      expect.objectContaining({ answer: "yes", notes: "DOB 1984", question: expect.stringMatching(/aged over 18/i) }),
    );
    expect(ec2?.answer).toBe("no");
    expect(ec3?.answer).toBe("");
    expect(pack.answered).toBe(2);
    expect(pack.total).toBeGreaterThan(2);
  });

  it("renders answers into the handover document that travels with the file", () => {
    const pack = resolveHandoverPack([{ itemId: "ec-1", answer: "yes", notes: "Passport seen" }]);
    const html = handoverPackHtml(pack, { companyName: "GEORGES TRADITION GROUP LIMITED" });
    expect(html).toContain("Handover pack");
    expect(html).toContain("GEORGES TRADITION GROUP LIMITED");
    expect(html).toContain("Yes");
    expect(html).toContain("Passport seen");
    expect(html).toMatch(/aged over 18/i);
  });
});
