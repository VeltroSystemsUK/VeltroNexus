import { describe, expect, it } from "vitest";
import {
  applyLoanAmountToRequirementData,
  applyLoanAmountToUnderwriting,
  penceFromPounds,
  poundsFromPence,
} from "@shared/loanAmountEdit";

describe("penceFromPounds / poundsFromPence", () => {
  it("round-trips a facility amount", () => {
    expect(penceFromPounds(85000)).toBe(8_500_000);
    expect(poundsFromPence(8_500_000)).toBe(85000);
  });

  it("treats blank as clearing the amount", () => {
    expect(penceFromPounds("")).toBeNull();
    expect(penceFromPounds(0)).toBeNull();
  });
});

describe("applyLoanAmountToRequirementData", () => {
  it("writes the pounds amount onto a business-loan requirement", () => {
    const next = applyLoanAmountToRequirementData(
      { product_type: "BUSINESS_LOAN", product_details: { loan_amount: 10000, term_months: 60 } },
      85000,
    );
    expect(next?.product_details.loan_amount).toBe(85000);
    expect(next?.product_details.term_months).toBe(60);
    expect(next?.use_of_funds.total_request_amount).toBe(85000);
  });
});

describe("applyLoanAmountToUnderwriting", () => {
  it("updates loanDetails.amount without dropping term", () => {
    const next = applyLoanAmountToUnderwriting({ loanDetails: { amount: 10000, termMonths: 60 } }, 85000);
    expect(next.loanDetails.amount).toBe(85000);
    expect(next.loanDetails.termMonths).toBe(60);
  });
});
