import { describe, it, expect } from "vitest";
import { assessBbbEligibility, BBB_QUESTIONS } from "@shared/bbbEligibility";

const allYes = Object.fromEntries(BBB_QUESTIONS.map((question) => [question.id, true]));

describe("British Business Bank eligibility", () => {
  it("passes only when every GGS criterion is yes", () => {
    const result = assessBbbEligibility({ answers: allYes });
    expect(result.status).toBe("pass");
    expect(result.isEligible).toBe(true);
  });

  it("holds the file when answers are missing", () => {
    const result = assessBbbEligibility({ answers: { uk_trading: true } });
    expect(result.status).toBe("incomplete");
    expect(result.isEligible).toBe(false);
  });

  it("fails a business in insolvency", () => {
    const result = assessBbbEligibility({
      answers: allYes,
      companyStatus: "liquidation",
    });
    expect(result.status).toBe("fail");
    expect(result.answers.not_in_difficulty).toBe(false);
  });

  it("fails property and finance SICs", () => {
    const result = assessBbbEligibility({
      answers: allYes,
      sicCodes: ["68100"],
    });
    expect(result.status).toBe("fail");
    expect(result.answers.legitimate_purpose).toBe(false);
  });

  it("fails turnover above the £45m cap", () => {
    const result = assessBbbEligibility({
      answers: allYes,
      turnoverGbp: 50_000_000,
    });
    expect(result.status).toBe("fail");
    expect(result.answers.turnover_cap).toBe(false);
  });

  it("fails a facility above £2m", () => {
    const result = assessBbbEligibility({
      answers: allYes,
      loanAmountGbp: 2_500_000,
    });
    expect(result.status).toBe("fail");
    expect(result.answers.facility_cap).toBe(false);
  });
});
