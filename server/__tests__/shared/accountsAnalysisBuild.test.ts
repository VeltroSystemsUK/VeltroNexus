import { describe, expect, it } from "vitest";
import {
  buildAccountsAnalysis,
  isPdfTextBlank,
  notesCommentary,
  yearsFromAccountsText,
  yearsFromCreditsafe,
} from "@shared/accountsAnalysisBuild";

const statements = [
  {
    yearEndDate: "2026-02-28T00:00:00Z",
    profitAndLoss: { depreciation: 0 },
    balanceSheet: {
      totalAssets: 67275,
      totalLiabilities: 7458,
      totalShareholdersEquity: 59817,
      cash: 0,
      totalReceivables: 66469,
      totalCurrentLiabilities: 7458,
      bankLiabilities: 0,
      otherLoansOrFinance: 0,
    },
    ratios: { currentRatio: 8.91, liquidityRatioOrAcidTest: 8.91, gearing: 0 },
  },
  {
    yearEndDate: "2022-02-28T00:00:00Z",
    profitAndLoss: {},
    balanceSheet: {
      totalAssets: 38426,
      totalLiabilities: 70634,
      totalShareholdersEquity: -32208,
      cash: 0,
      totalReceivables: 37392,
      totalCurrentLiabilities: 70634,
      bankLiabilities: 0,
      otherLoansOrFinance: 0,
    },
    ratios: { currentRatio: 0.53, liquidityRatioOrAcidTest: 0.53, gearing: 0 },
  },
];

describe("isPdfTextBlank", () => {
  it("treats Companies House page-joiner-only extraction as blank", () => {
    expect(isPdfTextBlank("-- 1 of 4 --\n\n\n\n-- 2 of 4 --\n\n\n\n-- 3 of 4 --\n\n\n\n-- 4 of 4 --")).toBe(true);
    expect(isPdfTextBlank("Balance sheet\nCalled up share capital 100")).toBe(false);
  });
});

describe("yearsFromCreditsafe", () => {
  it("maps balance sheet figures and leaves unfiled P&L as null, not zero", () => {
    const years = yearsFromCreditsafe(statements);
    expect(years[0].yearEnding).toBe("2026-02-28");
    expect(years[0].turnover).toBeNull();
    expect(years[0].netProfit).toBeNull();
    expect(years[0].netAssets).toBe(59817);
    expect(years[0].cashAndEquivalents).toBe(0);
    expect(years[0].debtors).toBe(66469);
    expect(years[0].bankLoans).toBe(0);
  });
});

describe("notesCommentary", () => {
  it("flags case-note debt that is missing from the filed balance sheet", () => {
    const items = notesCommentary({
      caseNotes: JSON.stringify({
        calculatorData: { currentDebt: 85000, monthlyPayment: 8500 },
      }),
      years: yearsFromCreditsafe(statements),
      financeMonthly: 2882,
      loanPounds: 85000,
    });
    expect(items.some((item) => item.assessment === "inconsistent" && /bank liabilities/i.test(item.accountsEvidence))).toBe(
      true
    );
    expect(items.some((item) => /8,500|8500/.test(item.note) && /2,882|2882/.test(item.accountsEvidence))).toBe(true);
  });
});

describe("buildAccountsAnalysis", () => {
  it("keeps Creditsafe figures when the AI returned blank years", () => {
    const built = buildAccountsAnalysis({
      statements,
      caseNotes: "currentDebt 85000",
      financeMonthly: 2882,
      loanPounds: 85000,
      ai: {
        years: [{ yearEnding: "2026-04-03", turnover: 0, netAssets: 0 }],
        ratios: [],
        notesToAccounts: [
          {
            note: "No accounts data available to assess turnover",
            accountsEvidence: "zero extractable content",
            assessment: "not_found",
            severity: "high",
            action: "re-run OCR",
          },
        ],
        auditorOpinion: "no auditor's report or opinion text could be extracted",
        summary: "PDFs blank",
        riskAssessment: "high",
      },
    });
    expect(built.years[0].netAssets).toBe(59817);
    expect(built.years[0].turnover).toBeNull();
    expect(built.notesToAccounts.length).toBeGreaterThan(0);
    expect(built.summary).toMatch(/net assets/i);
    expect(built.summary).not.toMatch(/PDFs blank/);
    expect(built.auditorOpinion).toMatch(/micro-entity/i);
    expect(built.notesToAccounts.every((item) => !/zero extractable/i.test(item.accountsEvidence))).toBe(true);
  });

  it("fills Creditsafe null P&L from uploaded accounts years for the matching year", () => {
    const built = buildAccountsAnalysis({
      statements,
      pdfYears: [
        {
          yearEnding: "2026-02-28",
          turnover: 132325,
          grossProfit: 40195,
          netProfit: -31228,
          totalAssets: null,
          totalLiabilities: null,
          netAssets: null,
          shareholderFunds: null,
          cashAndEquivalents: null,
          debtors: null,
          creditors: null,
          bankLoans: null,
        },
      ],
    });
    expect(built.years[0].yearEnding).toBe("2026-02-28");
    expect(built.years[0].turnover).toBe(132325);
    expect(built.years[0].grossProfit).toBe(40195);
    expect(built.years[0].netProfit).toBe(-31228);
    expect(built.years[0].netAssets).toBe(59817);
    expect(built.years[0].cashAndEquivalents).toBe(0);
    expect(built.summary).not.toMatch(/no turnover/i);
    expect(built.source).toBe("mixed");
  });

  it("merges stored accounts years when pdfYears is omitted", () => {
    const built = buildAccountsAnalysis({
      statements,
      ai: {
        years: [
          {
            yearEnding: "2026-02-28",
            turnover: 132325,
            grossProfit: 40195,
            netProfit: -31228,
            totalAssets: null,
            totalLiabilities: null,
            netAssets: null,
            shareholderFunds: null,
            cashAndEquivalents: null,
            debtors: null,
            creditors: null,
            bankLoans: null,
          },
        ],
      },
    });
    expect(built.years[0].turnover).toBe(132325);
    expect(built.years[0].netAssets).toBe(59817);
  });
});

const XERO_PNL = `Profit & Loss
Home Crafters
Accounting Year 2023/24
Debit Credit
Turnover 121,943
Sales 121,943
less Cost of Sales 55,463
Gross Profit 66,479
Operating Profit £10,174
Retained Profit this period: £1,896
Distributable Reserves / Retained Profit carried forward: £52,577`;

describe("yearsFromAccountsText", () => {
  it("reads turnover and profit from a yearly P&L PDF", () => {
    const years = yearsFromAccountsText(
      XERO_PNL,
      "Home Crafters yearly profit and loss 2023-03-01 to 2024-02-29 (1).pdf",
    );
    expect(years).toHaveLength(1);
    expect(years[0].yearEnding).toBe("2024-02-29");
    expect(years[0].turnover).toBe(121943);
    expect(years[0].grossProfit).toBe(66479);
    expect(years[0].netProfit).toBe(10174);
  });

  it("uses the period-end date when the filename has underscores", () => {
    const years = yearsFromAccountsText(
      XERO_PNL,
      "1788970866744_Home_Crafters_yearly_profit_and_loss_2023-03-01_to_2024-02-29__1_.pdf",
    );
    expect(years[0].yearEnding).toBe("2024-02-29");
  });

  it("parses a negative operating profit", () => {
    const years = yearsFromAccountsText(
      "Profit & Loss\nAccounting Year 2024/25\nTurnover 132,325\nGross Profit 40,195\nOperating Profit -£31,228\n",
      "Home Crafters yearly profit and loss 2024-03-01 to 2025-02-28.pdf",
    );
    expect(years[0].yearEnding).toBe("2025-02-28");
    expect(years[0].turnover).toBe(132325);
    expect(years[0].netProfit).toBe(-31228);
  });
});
