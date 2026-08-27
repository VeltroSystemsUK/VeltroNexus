import { describe, expect, it } from "vitest";
import {
  extractCompanyNumber,
  isHmrcPetitioner,
  mentionsHmrcPressure,
  parseCcjMention,
  parseGbpAmount,
} from "@shared/distressSignals";
import { assessStrataFit, MIN_FIT_SCORE } from "../../services/strataFit";
import { scoreSignals } from "@shared/salesOs";
import { INTRODUCER_SIC_CODES } from "../../services/introducerDirectory";

describe("HMRC / Gazette parsers", () => {
  it("detects HMRC as petitioner", () => {
    expect(isHmrcPetitioner("COMMISSIONERS FOR HM REVENUE AND CUSTOMS")).toBe(true);
    expect(isHmrcPetitioner("the Commissioners for His Majesty's Revenue and Customs")).toBe(true);
    expect(isHmrcPetitioner("Barclays Bank PLC")).toBe(false);
  });

  it("extracts a Companies House number from notice text", () => {
    expect(extractCompanyNumber("In the Matter of ACME JOINERY LIMITED (Company Number 12345678)")).toBe("12345678");
    expect(extractCompanyNumber("company number: SC123456")).toBe("SC123456");
  });

  it("flags HMRC winding-up petition language", () => {
    expect(
      mentionsHmrcPressure(
        "A Petition to wind up presented by the COMMISSIONERS FOR HM REVENUE AND CUSTOMS"
      )
    ).toBe(true);
  });
});

describe("CCJ parsers", () => {
  it("parses a CCJ mention with amount", () => {
    const ccj = parseCcjMention(
      "County Court Judgment entered for £4,250 on the claim",
      "2026-03-01",
      "test"
    );
    expect(ccj).not.toBeNull();
    expect(ccj?.amountGbp).toBe(4250);
    expect(parseGbpAmount("£15,000.00")).toBe(15000);
  });

  it("parses a CCJ mention without amount", () => {
    const ccj = parseCcjMention("A CCJ was registered against the company", "2026-04-01", "test");
    expect(ccj).not.toBeNull();
    expect(ccj?.amountGbp).toBeNull();
  });

  it("does not use CCJs for origination scoring", () => {
    const result = scoreSignals({
      companyName: "Acme Joinery Limited",
      ccjs: [{ amountGbp: 4000, registeredAt: new Date().toISOString() }],
    });
    expect(result.signals.some((s) => s.code === "SIG-03")).toBe(false);
  });
});

describe("HMRC petition as Stream A qualifier", () => {
  it("passes a trading SME with an HMRC petition and no MCA charge", () => {
    const result = assessStrataFit({
      companyName: "Acme Joinery Limited",
      companyNumber: "12345678",
      companyStatus: "active",
      dateOfCreation: "2019-04-01",
      sicCodes: ["43320"],
      hmrcTtp: true,
      charges: [],
    });
    expect(result.pass).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(MIN_FIT_SCORE);
    expect(result.reasons.some((line) => /HMRC/i.test(line))).toBe(true);
  });

  it("still rejects a file with neither high-cost charges nor HMRC pressure", () => {
    const result = assessStrataFit({
      companyName: "Acme Joinery Limited",
      companyNumber: "12345678",
      companyStatus: "active",
      dateOfCreation: "2019-04-01",
      sicCodes: ["43320"],
      charges: [{ status: "outstanding", personsEntitled: ["BARCLAYS BANK PLC"] }],
    });
    expect(result.pass).toBe(false);
  });
});

describe("introducer directory", () => {
  it("targets ICAEW/ACCA accountancy SICs", () => {
    expect(INTRODUCER_SIC_CODES).toEqual(["69201", "69202", "69203"]);
  });
});
