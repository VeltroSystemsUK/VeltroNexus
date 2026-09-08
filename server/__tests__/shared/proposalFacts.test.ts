import { describe, expect, it } from "vitest";
import { calculateLoan } from "../../../client/src/lib/calculators";
import { deriveProposal, gradeFromDscr, reconcileFacts } from "@shared/proposalFacts";

describe("reconcileFacts", () => {
  it("collapses declared pence and pounds to one amount", () => {
    const result = reconcileFacts({
      loanAmountPence: 12_000_000,
      requirement: { loanAmountPounds: 120_000 },
      loanDetails: { amountPounds: 120_000 },
      calculator: { loanAmountPounds: 120_000 },
    });
    expect(result.facts.loanAmountPounds).toBe(120000);
    expect(result.conflicts).toEqual([]);
    expect(result.missing.find((row) => row.field === "loanAmountPounds")).toBeUndefined();
  });

  it("conflicts when requirement and loanDetails disagree", () => {
    const result = reconcileFacts({
      requirement: { loanAmountPounds: 120_000 },
      loanDetails: { amountPounds: 85_000 },
    });
    expect(result.facts.loanAmountPounds).toBeNull();
    expect(result.conflicts).toEqual([
      {
        field: "loanAmountPounds",
        values: [
          { origin: "requirement.loan_amount", value: "120000" },
          { origin: "loanDetails.amount", value: "85000" },
        ],
      },
    ]);
  });

  it("does not treat 120000 pence as pounds when prospect.loanAmount is the pence field", () => {
    const result = reconcileFacts({
      loanAmountPence: 120_000,
      requirement: { loanAmountPounds: 120_000 },
    });
    expect(result.conflicts.some((row) => row.field === "loanAmountPounds")).toBe(true);
  });

  it("treats empty sources as missing, not a conflict, and not zero", () => {
    const result = reconcileFacts({});
    expect(result.facts.loanAmountPounds).toBeNull();
    expect(result.conflicts).toEqual([]);
    expect(result.missing.map((row) => row.field)).toContain("loanAmountPounds");
    expect(result.facts.stackedMonthly).toBeNull();
    expect(result.facts.cashForDebt).toBeNull();
  });

  it("uses one use-of-funds list when they match, and conflicts when they differ", () => {
    const lines = [{ label: "Iwoca", amountPounds: 21823 }];
    const ok = reconcileFacts({
      allocation: lines,
      requirement: { useOfFunds: lines },
    });
    expect(ok.facts.useOfFunds).toEqual(lines);
    expect(ok.conflicts.find((row) => row.field === "useOfFunds")).toBeUndefined();

    const bad = reconcileFacts({
      allocation: lines,
      requirement: { useOfFunds: [{ label: "Iwoca", amountPounds: 1 }] },
    });
    expect(bad.conflicts.some((row) => row.field === "useOfFunds")).toBe(true);
    expect(bad.facts.useOfFunds).toEqual([]);
  });
});

describe("gradeFromDscr", () => {
  it("maps the spec table", () => {
    expect(gradeFromDscr(1.62, false)).toBe("A");
    expect(gradeFromDscr(1.25, false)).toBe("B");
    expect(gradeFromDscr(1.0, false)).toBe("C");
    expect(gradeFromDscr(0.87, false)).toBe("D");
    expect(gradeFromDscr(0.5, false)).toBe("E");
    expect(gradeFromDscr(null, false)).toBeNull();
  });

  it("notches both sides one grade for adverse conduct, floor E", () => {
    expect(gradeFromDscr(1.62, true)).toBe("B");
    expect(gradeFromDscr(0.87, true)).toBe("E");
    expect(gradeFromDscr(0.5, true)).toBe("E");
  });
});

describe("deriveProposal Home Crafters numbers", () => {
  const facts = reconcileFacts({
    requirement: { loanAmountPounds: 120_000, termMonths: 60 },
    loanDetails: { amountPounds: 120_000, termMonths: 60, interestRatePct: 18 },
    calculator: { loanAmountPounds: 120_000, termMonths: 60, interestRatePct: 18 },
    sweep: { financeMonthly: 5702.7, avgCredits: 20200.98, avgDebits: 20952.73, cashForDebt: 4950.95 },
  }).facts;

  it("uses calculateLoan monthly, not a stored LLM repayment", () => {
    const derived = deriveProposal(facts, {});
    const monthly = calculateLoan(120000, 18, 60).monthlyPayment;
    expect(derived.monthlyRepayment).toBeCloseTo(monthly, 2);
    expect(derived.dscrNow).toBeCloseTo(4950.95 / 5702.7, 2);
    expect(derived.dscrAfter).toBeCloseTo(4950.95 / monthly, 2);
    expect(derived.gradeNow).toBe("D");
    expect(derived.gradeAfter).toBe("A");
    expect(derived.headroomNow).toBeCloseTo(20200.98 - 20952.73, 2);
    expect(derived.headroomAfter).toBeCloseTo(derived.headroomNow! + derived.monthlySaving!, 2);
  });

  it("does not invent grade E when statements are missing", () => {
    const empty = reconcileFacts({
      requirement: { loanAmountPounds: 120_000, termMonths: 60 },
      loanDetails: { interestRatePct: 18 },
    }).facts;
    const derived = deriveProposal(empty, {});
    expect(derived.dscrNow).toBeNull();
    expect(derived.gradeNow).toBeNull();
    expect(derived.gradeAfter).toBeNull();
  });

  it("prints override as override and keeps the computed pair", () => {
    const derived = deriveProposal(facts, {
      overrides: { gradeNow: "B", gradeAfter: "A", by: "David", at: "2026-09-08" },
    });
    expect(derived.gradeNowComputed).toBe("D");
    expect(derived.gradeNow).toBe("B");
    expect(derived.gradeAfter).toBe("A");
  });

  it("ignores override when by is missing", () => {
    const derived = deriveProposal(facts, {
      overrides: { gradeNow: "A", gradeAfter: "A", by: null, at: null },
    });
    expect(derived.gradeNow).toBe("D");
  });
});
