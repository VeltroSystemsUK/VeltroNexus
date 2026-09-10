import { describe, expect, it } from "vitest";
import { fileResearchBullets, historicAccountsCommentary } from "@shared/reportCommentary";

describe("fileResearchBullets", () => {
  it("lists pack evidence, gaps, and abbreviated accounts — not an empty Research Hub", () => {
    const lines = fileResearchBullets({
      documents: [
        { id: 1, fileName: "10034885_aa_2026-04-03.pdf", category: "accounts" },
        { id: 2, fileName: "2026_August_Statement.pdf", category: "bank-statements" },
        { id: 3, fileName: "Home_Crafters_24_Month_Cash_Flow_Forecast_STRATA.xlsx", category: "cashflow" },
        { id: 4, fileName: "driving_licence_front_and_back.pdf", category: "id" },
      ],
      accountsType: "micro-entity",
      creditsafeScore: "A",
      hasCharges: false,
      insolvency: false,
      companyNumber: "10034885",
      companyStatus: "active",
    });
    const text = lines.join(" ");
    expect(text).toMatch(/micro.?entity|abbreviated/i);
    expect(text).toMatch(/no full audited/i);
    expect(text).toMatch(/on file/i);
    expect(text).toMatch(/missing/i);
    expect(text).toMatch(/Creditsafe A/i);
    expect(text).not.toMatch(/Research Hub not yet completed/i);
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines.length).toBeLessThanOrEqual(10);
  });
});

describe("historicAccountsCommentary", () => {
  it("comments on net-asset trend and missing P&L without inventing turnover", () => {
    const lines = historicAccountsCommentary({
      years: [
        { yearEnding: "2024-02-29", turnover: null, netProfit: null, netAssets: 52577 },
        { yearEnding: "2025-02-28", turnover: null, netProfit: null, netAssets: 40931 },
        { yearEnding: "2026-02-28", turnover: null, netProfit: null, netAssets: 59817 },
      ],
      accountsType: "micro-entity",
      hasAuditedAccounts: false,
    });
    const text = lines.join(" ");
    expect(text).toMatch(/net assets/i);
    expect(text).toMatch(/59,?817/);
    expect(text).toMatch(/P&L|profit and loss|turnover/i);
    expect(text).toMatch(/no full audited/i);
    expect(text.toLowerCase()).not.toMatch(/turnover of £/);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines.length).toBeLessThanOrEqual(8);
  });

  it("comments on turnover, profit swing, cash and debtors when those figures are on file", () => {
    const lines = historicAccountsCommentary({
      years: [
        {
          yearEnding: "2024-02-29",
          turnover: 121943,
          grossProfit: 66479,
          netProfit: 10174,
          netAssets: 52577,
          cashAndEquivalents: 0,
          debtors: 53313,
          totalAssets: 54119,
        },
        {
          yearEnding: "2025-02-28",
          turnover: 132325,
          grossProfit: 40195,
          netProfit: -31228,
          netAssets: 40931,
          cashAndEquivalents: 0,
          debtors: 62754,
          totalAssets: 63560,
        },
        {
          yearEnding: "2026-02-28",
          turnover: null,
          netProfit: null,
          netAssets: 59817,
          cashAndEquivalents: 0,
          debtors: 66469,
          totalAssets: 67275,
        },
      ],
      accountsType: "micro-entity",
      hasAuditedAccounts: false,
      pnlFromUpload: true,
    });
    const text = lines.join(" ");
    expect(text).toMatch(/121,?943/);
    expect(text).toMatch(/132,?325/);
    expect(text).toMatch(/10,?174/);
    expect(text).toMatch(/31,?228/);
    expect(text).toMatch(/cash/i);
    expect(text).toMatch(/debtor/i);
    expect(text).toMatch(/uploaded|management accounts|P&L/i);
    expect(text).not.toMatch(/do not state a P&L/);
    expect(lines.length).toBeGreaterThanOrEqual(5);
    expect(lines.length).toBeLessThanOrEqual(12);
  });
});
