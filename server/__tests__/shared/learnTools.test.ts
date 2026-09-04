import { describe, expect, it } from "vitest";
import {
  calculateDebtStress,
  calculateTtp,
  emptyOutgoings,
  monthlyFromFrequency,
  validateToolEmailRequest,
} from "@shared/learnTools";

describe("calculateTtp", () => {
  it("splits arrears evenly with no interest", () => {
    const result = calculateTtp({ arrears: 12000, periodMonths: 12, includeInterest: false, annualRatePercent: 0 });
    expect(result.monthlyInstalment).toBeCloseTo(1000, 5);
    expect(result.totalInterest).toBe(0);
    expect(result.totalRepayable).toBe(12000);
  });

  it("adds simple interest over the period when included", () => {
    const result = calculateTtp({ arrears: 10000, periodMonths: 6, includeInterest: true, annualRatePercent: 6 });
    expect(result.totalInterest).toBeCloseTo(10000 * 0.06 * 0.5, 5);
    expect(result.totalRepayable).toBeCloseTo(10300, 5);
    expect(result.monthlyInstalment).toBeCloseTo(10300 / 6, 5);
  });

  it("clamps a bad period to the 1-12 month range", () => {
    expect(calculateTtp({ arrears: 1000, periodMonths: 24, includeInterest: false, annualRatePercent: 0 }).monthlyInstalment).toBeCloseTo(
      1000 / 12,
      5,
    );
    expect(calculateTtp({ arrears: 1000, periodMonths: 0, includeInterest: false, annualRatePercent: 0 }).monthlyInstalment).toBeCloseTo(
      1000 / 12,
      5,
    );
  });
});

describe("monthlyFromFrequency", () => {
  it("normalises daily and weekly repayments to a monthly figure", () => {
    expect(monthlyFromFrequency(100, "daily")).toBe(3000);
    expect(monthlyFromFrequency(100, "weekly")).toBeCloseTo(100 * (52 / 12), 5);
    expect(monthlyFromFrequency(100, "monthly")).toBe(100);
  });
});

describe("calculateDebtStress", () => {
  it("flags stacking when two or more facilities debit daily or weekly", () => {
    const result = calculateDebtStress({
      monthlyIncome: 20000,
      outgoings: { ...emptyOutgoings(), payroll: 8000, rent: 2000 },
      debts: [
        { id: "a", label: "MCA A", balance: 15000, repaymentAmount: 150, frequency: "daily" },
        { id: "b", label: "MCA B", balance: 10000, repaymentAmount: 500, frequency: "weekly" },
      ],
    });
    expect(result.isStacking).toBe(true);
    expect(result.totalOutstandingDebt).toBe(25000);
    expect(result.totalMonthlyDebtService).toBeCloseTo(150 * 30 + 500 * (52 / 12), 2);
    expect(result.debtServiceRatio).toBeCloseTo(result.totalMonthlyDebtService / 20000, 5);
  });

  it("does not flag stacking with a single facility, and computes runway on a deficit", () => {
    const result = calculateDebtStress({
      monthlyIncome: 5000,
      outgoings: { ...emptyOutgoings(), payroll: 3000, rent: 1500, hmrcVat: 800 },
      debts: [{ id: "a", label: "Loan", balance: 20000, repaymentAmount: 600, frequency: "monthly" }],
      cashOnHand: 1000,
    });
    expect(result.isStacking).toBe(false);
    expect(result.netMonthlyPosition).toBeLessThan(0);
    expect(result.runwayMonths).toBeCloseTo(1000 / Math.abs(result.netMonthlyPosition), 5);
  });

  it("returns no runway figure when there is no deficit or no cash on hand", () => {
    const surplus = calculateDebtStress({
      monthlyIncome: 20000,
      outgoings: emptyOutgoings(),
      debts: [],
      cashOnHand: 5000,
    });
    expect(surplus.runwayMonths).toBeNull();

    const deficitNoCash = calculateDebtStress({
      monthlyIncome: 100,
      outgoings: { ...emptyOutgoings(), payroll: 5000 },
      debts: [],
      cashOnHand: 0,
    });
    expect(deficitNoCash.runwayMonths).toBeNull();
  });
});

describe("validateToolEmailRequest", () => {
  it("accepts a clean request", () => {
    const parsed = validateToolEmailRequest({ name: "Jordan Hale", email: "jordan@joinery.co.uk", tool: "ttp-calculator" });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.marketingOptIn).toBe(false);
  });

  it("rejects a bad email and an unknown tool", () => {
    expect(validateToolEmailRequest({ name: "Jordan", email: "not-an-email", tool: "ttp-calculator" }).ok).toBe(false);
    expect(validateToolEmailRequest({ name: "Jordan", email: "jordan@joinery.co.uk", tool: "nope" }).ok).toBe(false);
  });
});
