import { describe, expect, it } from "vitest";
import {
  pickBriefingHypothesis,
  dwellLine,
  briefingCopyOk,
} from "@shared/briefingHypothesis";
import { buildCoverEmail } from "@shared/briefingCover";

describe("pickBriefingHypothesis", () => {
  it("uses stacked debt when non-bank charges are 2+", () => {
    const h = pickBriefingHypothesis({ nonBankChargeCount: 2, sicCodes: ["41201"], dwellCount: 5 });
    expect(h.id).toBe("stacked_debt");
    expect(h.body.toLowerCase()).not.toMatch(/you have late payers/);
    expect(h.mechanism.toLowerCase()).toMatch(/packag/);
    expect(h.mechanism.toLowerCase()).not.toMatch(/we lend/);
  });

  it("frames construction as sector culture, not their invoices", () => {
    const h = pickBriefingHypothesis({ nonBankChargeCount: 0, sicCodes: ["41201"], dwellCount: 5 });
    expect(h.id).toBe("sector_late_pay");
    expect(h.body.toLowerCase()).toMatch(/sector|construction|trade/);
    expect(h.body.toLowerCase()).not.toMatch(/you have late payers/);
  });

  it("uses working capital when they dwelled on tools", () => {
    const h = pickBriefingHypothesis({
      nonBankChargeCount: 0,
      sicCodes: ["62012"],
      lastDwellPath: "/#tools",
      dwellCount: 5,
    });
    expect(h.id).toBe("working_capital");
  });
});

describe("dwellLine", () => {
  it("never mentions opened email", () => {
    const line = dwellLine({ dwellCount: 5, lastDwellPath: "/#tools" });
    expect(line.toLowerCase()).not.toMatch(/opened our email/);
    expect(line.toLowerCase()).toMatch(/site|tools/);
  });
});

describe("copy guard", () => {
  it("rejects we lend and invented late payers", () => {
    expect(briefingCopyOk("We lend at 1.5% a month").ok).toBe(false);
    expect(briefingCopyOk("you have late payers").ok).toBe(false);
    expect(briefingCopyOk("Businesses with two live non-bank charges often have a cost-of-debt problem.").ok).toBe(true);
  });
});

describe("buildCoverEmail", () => {
  it("cover subject does not mention Veltro and includes a private link", () => {
    const mail = buildCoverEmail({
      companyName: "North Peak Ltd",
      briefingUrl: "https://leads.example/briefing/tok",
    });
    expect(mail.subject.toLowerCase()).not.toMatch(/veltro/);
    expect(mail.html).toMatch(/briefing\/tok/);
    expect(mail.html.toLowerCase()).toMatch(/isn't published|is not published|isn't on the internet/);
    expect(mail.html).toMatch(/reply stop/i);
  });
});
