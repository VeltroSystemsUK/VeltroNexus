import { describe, expect, it } from "vitest";
import {
  pickBriefingHypothesis,
  dwellLine,
  briefingCopyOk,
} from "@shared/briefingHypothesis";
import { briefingGreetingName, buildCoverEmail } from "@shared/briefingCover";

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
  it("rejects we lend and invented late payers, and allows the Gemini house script", () => {
    expect(briefingCopyOk("We lend at 1.5% a month").ok).toBe(false);
    expect(briefingCopyOk("you have late payers").ok).toBe(false);
    expect(briefingCopyOk("Businesses with two live non-bank charges often have a cost-of-debt problem.").ok).toBe(true);
    expect(briefingCopyOk("High-value prospects dwell on your site and leave in silence.").ok).toBe(true);
    expect(briefingCopyOk("Our AI tracked your dwell time and built this bespoke playbook instantly").ok).toBe(true);
    expect(briefingCopyOk("we inject immediate cashflow runway").ok).toBe(true);
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

  it("spaces paragraphs and greets by first name", () => {
    const mail = buildCoverEmail({
      companyName: "Recruit Mint Ltd",
      firstName: "James",
      briefingUrl: "https://leads.example/briefing/tok",
    });
    expect(mail.html).toMatch(/Hi James,/);
    expect(mail.html).toMatch(/margin:0 0 16px/);
    expect(mail.html).not.toMatch(/>Hi,</);
  });

  it("Open your briefing opens in a new tab so preview and mail clients can follow it", () => {
    const mail = buildCoverEmail({
      companyName: "North Peak Ltd",
      firstName: "Nora",
      briefingUrl: "https://leads.example/briefing/tok",
    });
    expect(mail.html).toMatch(
      /<a href="https:\/\/leads\.example\/briefing\/tok" target="_blank" rel="noopener noreferrer">Open your briefing<\/a>/
    );
  });
});

describe("briefingGreetingName", () => {
  it("uses the Companies House forename, not SURNAME, Forename", () => {
    expect(briefingGreetingName([{ name: "PEAK, Nora" }])).toBe("Nora");
    expect(briefingGreetingName([{ name: "BEVAN, Kirsty Jane" }])).toBe("Kirsty");
    expect(briefingGreetingName([{ name: "James Mint" }])).toBe("James");
  });

  it("skips corporate officers and title prefixes", () => {
    expect(
      briefingGreetingName([
        { name: "NORTH PEAK HOLDINGS LIMITED" },
        { name: "Miss Kirsty Bevan" },
      ])
    ).toBe("Kirsty");
  });
});
