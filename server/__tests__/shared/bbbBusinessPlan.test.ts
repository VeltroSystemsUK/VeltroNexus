import { describe, expect, it } from "vitest";
import { BBB_BUSINESS_PLAN_SECTIONS, BBB_PLAN_DISCLAIMER } from "@shared/bbbBusinessPlan";

describe("BBB business plan format", () => {
  it("covers the sections an accredited BBB / CDFI lender expects", () => {
    const ids = BBB_BUSINESS_PLAN_SECTIONS.map((section) => section.id);
    expect(ids).toContain("executive-summary");
    expect(ids).toContain("use-of-funds");
    expect(ids).toContain("management-ownership");
    expect(ids).toContain("repayment-affordability");
    expect(ids).toContain("risks-mitigants");
    expect(ids).toContain("financial-highlights");
    expect(BBB_PLAN_DISCLAIMER).toMatch(/been invented/i);
    expect(BBB_PLAN_DISCLAIMER).toMatch(/British Business Bank/i);
  });
});
