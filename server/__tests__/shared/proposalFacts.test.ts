import { describe, expect, it } from "vitest";
import { reconcileFacts } from "@shared/proposalFacts";

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
