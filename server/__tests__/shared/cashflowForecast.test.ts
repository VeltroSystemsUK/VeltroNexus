import { describe, expect, it } from "vitest";
import {
  applyFindings,
  parseWithExtract,
  readyToPrint,
  withoutFromSweep,
  emptyForecast,
  pickCashflowDocument,
  sanitizeForecastBullets,
  statementAfterDscr,
  improvedFromStatements,
} from "@shared/cashflowForecast";

const sweep = {
  totals: { avgIn: 20200, avgOut: 20953, avgNet: -753 },
  financeMonthly: 5703,
  cashForDebt: 4951,
};

describe("improvedFromStatements", () => {
  it("keeps statement credits and opex, swaps in the proposed monthly, and recomputes DSCR", () => {
    const without = withoutFromSweep(sweep);
    const improved = improvedFromStatements(without, 3047);
    expect(improved.creditsAvg).toBe(20200);
    expect(improved.opexAvg).toBe(20953 - 5703);
    expect(improved.debtServiceAvg).toBe(3047);
    expect(improved.dscr).toBeCloseTo((20200 - (20953 - 5703)) / 3047, 2);
  });
});

describe("withoutFromSweep", () => {
  it("rebuilds without-facility from statements and ignores a sheet base-case", () => {
    const without = withoutFromSweep(sweep);
    expect(without.creditsAvg).toBe(20200);
    expect(without.debtServiceAvg).toBe(5703);
    expect(without.opexAvg).toBe(20953 - 5703);
    expect(without.netAvg).toBe(-753);
    expect(without.dscr).toBeCloseTo(4951 / 5703, 2);
  });
});

describe("parseWithExtract", () => {
  it("keeps null rather than coercing blank to 0, and rejects all-null", () => {
    expect(parseWithExtract({ creditsAvg: "nope", opexAvg: null })).toBeNull();
    const parsed = parseWithExtract({
      creditsAvg: 24000,
      opexAvg: 18000,
      debtServiceAvg: 3047,
      netAvg: 2953,
    });
    expect(parsed?.with.creditsAvg).toBe(24000);
    expect(parseWithExtract({})).toBeNull();
  });
});

describe("applyFindings", () => {
  const without = withoutFromSweep(sweep);
  it("fires sales_stepup at +15% and not at +10%", () => {
    const hot = applyFindings({
      without,
      with: { creditsAvg: 20200 * 1.16, opexAvg: 15250, debtServiceAvg: 3047, netAvg: 1000, dscr: 1.8 },
      ledgerMonthly: 3047,
      flattenedText: "VAT PAYE directors drawings",
    });
    expect(hot.some((line) => /above statement run-rate/.test(line))).toBe(true);
    const mild = applyFindings({
      without,
      with: { creditsAvg: 20200 * 1.1, opexAvg: 15250, debtServiceAvg: 3047, netAvg: 1000, dscr: 1.8 },
      ledgerMonthly: 3047,
      flattenedText: "VAT PAYE directors drawings",
    });
    expect(mild.some((line) => /above statement run-rate/.test(line))).toBe(false);
  });

  it("computes statement-based after DSCR from cash for debt over proposed monthly", () => {
    expect(statementAfterDscr(4951, 3047)).toBeCloseTo(4951 / 3047, 2);
    expect(statementAfterDscr(4951, null)).toBeNull();
    expect(statementAfterDscr(null, 3047)).toBeNull();
  });

  it("fires when sheet DSCR is materially above statement-based after", () => {
    const lines = applyFindings({
      without,
      with: { creditsAvg: 28000, opexAvg: 12000, debtServiceAvg: 3047, netAvg: 12953, dscr: 5.2 },
      ledgerMonthly: 3047,
      ledgerAfterDscr: 1.62,
      flattenedText: "VAT PAYE drawings",
    });
    expect(lines.some((line) => /Sheet DSCR/.test(line) && /5\.20/.test(line) && /1\.62/.test(line))).toBe(
      true,
    );
  });

  it("fires debt_mismatch when sheet monthly disagrees with the ledger", () => {
    const lines = applyFindings({
      without,
      with: { creditsAvg: 20200, opexAvg: 15250, debtServiceAvg: 2800, netAvg: 0, dscr: 1.3 },
      ledgerMonthly: 3047,
      flattenedText: "VAT PAYE drawings",
    });
    expect(lines.some((line) => /Forecast debt service/.test(line) && /3,047/.test(line))).toBe(true);
  });
});

describe("readyToPrint", () => {
  it("prints when the with-column has numbers, without a confirm click", () => {
    const blank = emptyForecast();
    expect(readyToPrint(blank)).toBe(false);
    expect(
      readyToPrint({ ...blank, confirmed: false, with: { ...blank.with, creditsAvg: 24000 } }),
    ).toBe(true);
    expect(readyToPrint({ ...blank, extractable: false, with: { ...blank.with, creditsAvg: 24000 } })).toBe(
      false,
    );
  });
});

describe("pickCashflowDocument", () => {
  it("picks the latest cashflow or forecast file", () => {
    expect(
      pickCashflowDocument([
        { id: 1, fileName: "statements.pdf", category: "bank-statements" },
        { id: 2, fileName: "24-month-cashflow.xlsx", category: "accounts" },
        { id: 3, fileName: "cashflow-v2.xlsx", category: "cashflow" },
      ])?.id,
    ).toBe(3);
    expect(pickCashflowDocument([{ id: 1, fileName: "id.pdf", category: "id" }])).toBeNull();
  });
});

describe("sanitizeForecastBullets", () => {
  it("keeps numbers and drops working-notes", () => {
    const out = sanitizeForecastBullets([
      "Credits in the sheet are 39% above the £20,201 statement run-rate.",
      "Note on scope: the document provided is incomplete.",
      "A",
    ]);
    expect(out.some((line) => /39%/.test(line))).toBe(true);
    expect(out.join(" ").toLowerCase()).not.toContain("note on scope");
  });
});
