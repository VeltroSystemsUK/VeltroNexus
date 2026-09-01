import { describe, expect, it } from "vitest";
import { isDistressHuntRow } from "../../services/huntCandidates";

describe("isDistressHuntRow", () => {
  it("does not treat the property dump as hunt candidates", () => {
    expect(
      isDistressHuntRow({
        companyName: "Midlands Lets Ltd",
        sicCodes: ["68209"],
        lenders: [],
      })
    ).toBe(false);
    expect(
      isDistressHuntRow({
        companyName: "A Trading Ltd",
        sicCodes: ["56101"],
        lenders: [],
      })
    ).toBe(false);
  });

  it("keeps high-cost charges, HMRC petitions, and introducers", () => {
    expect(
      isDistressHuntRow({
        companyName: "Cafe Ltd",
        sicCodes: ["56101"],
        lenders: ["Iwoca"],
      })
    ).toBe(true);
    expect(
      isDistressHuntRow({
        companyName: "Works Ltd",
        sicCodes: ["43210"],
        hmrc: true,
      })
    ).toBe(true);
    expect(
      isDistressHuntRow({
        companyName: "Smith & Partners Accountants",
        sicCodes: ["69201"],
      })
    ).toBe(true);
    expect(
      isDistressHuntRow({
        companyName: "Joinery Ltd",
        sicCodes: ["16230"],
        lenders: ["SIEMENS FINANCIAL SERVICES LIMITED"],
      })
    ).toBe(true);
    expect(
      isDistressHuntRow({
        companyName: "Joinery Ltd",
        sicCodes: ["16230"],
        lenders: ["HSBC BANK PLC"],
      })
    ).toBe(false);
  });
});
