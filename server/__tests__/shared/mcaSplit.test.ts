import { describe, expect, it } from "vitest";
import { parseMcaMinsFromText, parseMcaRatesFromText, resolveMcaRate, splitHoldback } from "@shared/mcaSplit";
import { analyseBankStatements } from "@shared/bankStatementSweep";

describe("parseMcaRatesFromText", () => {
  it("reads split percentages off a debt schedule", () => {
    const rates = parseMcaRatesFromText(`
YouLend Merchant cash advance £18,120.67 22% of daily card and eBay sales
Shopify Capital Merchant cash advance 17% of daily website sales, including eBay
PayPal Working Capital 30% of PayPal sales
Liberis 20% of card sales
`);
    expect(rates.YouLend).toBeCloseTo(0.22, 4);
    expect(rates["Shopify Capital"]).toBeCloseTo(0.17, 4);
    expect(rates["PayPal Working Capital"]).toBeCloseTo(0.3, 4);
    expect(rates.Liberis).toBeCloseTo(0.2, 4);
  });
});

describe("resolveMcaRate", () => {
  it("uses a parsed rate over the product default", () => {
    expect(resolveMcaRate("YouLend", { YouLend: 0.18 })).toBeCloseTo(0.18, 4);
    expect(resolveMcaRate("YouLend", {})).toBeCloseTo(0.22, 4);
    expect(resolveMcaRate("Liberis", {})).toBeNull();
    expect(resolveMcaRate("Liberis", { Liberis: 0.2 })).toBeCloseTo(0.2, 4);
  });
});

describe("parseMcaMinsFromText", () => {
  it("reads a PayPal Working Capital quarterly minimum off a debt schedule", () => {
    const mins = parseMcaMinsFromText(`
PayPal Working Capital Working capital / sales-linked
finance £23,650.19 30% of PayPal sales; minimum £2,978 every 3
months Active
`);
    expect(mins["PayPal Working Capital"]?.amount).toBe(2978);
    expect(mins["PayPal Working Capital"]?.months).toBe(3);
  });
});

describe("splitHoldback", () => {
  it("turns net remittances back into the withheld cut", () => {
    expect(splitHoldback(780, 0.22)).toBeCloseTo((780 * 0.22) / 0.78, 2);
  });
});

function bosMonth(body: string) {
  return `
BUSINESS ACCOUNT. 01 August 2026 to 31 August 2026.
Money In. £10,000.00. Balance on 01 August 2026. £0.00.
Money Out. £4,000.00. Balance on 31 August 2026. £6,000.00.
${body}`;
}

function bosTx(date: string, description: string, moneyIn: string, moneyOut: string) {
  return `Date
${date}.
Description
${description}
Type
FPI.
Money In (£)
${moneyIn}.
Money Out (£)
${moneyOut}.
Balance (£)
0.00.
`;
}

describe("analyseBankStatements MCA splits", () => {
  it("applies a Liberis holdback when the schedule states the split", () => {
    const analysis = analyseBankStatements(
      bosMonth(bosTx("03 Aug 26", "LIBERIS LTD", "780.00", "blank")),
      { rateText: "Liberis 20% of daily card sales" },
    );
    const liberis = analysis.lenders.find((l) => /liberis/i.test(l.name));
    expect(liberis?.kind).toBe("mca");
    expect(liberis?.monthly).toBeCloseTo((780 * 0.2) / 0.8, 2);
    expect(liberis?.splitRate).toBeCloseTo(0.2, 4);
  });

  it("does not invent a Liberis monthly cut when no split is known", () => {
    const analysis = analyseBankStatements(bosMonth(bosTx("03 Aug 26", "LIBERIS LTD", "780.00", "blank")));
    const liberis = analysis.lenders.find((l) => /liberis/i.test(l.name));
    expect(liberis?.monthly || 0).toBe(0);
  });

  it("applies Capify and Wayflyer holdbacks from the debt schedule, not visible DDs", () => {
    const analysis = analyseBankStatements(
      bosMonth(
        bosTx("03 Aug 26", "CAPIFY LTD", "800.00", "blank") +
          bosTx("04 Aug 26", "WAYFLYER UK LTD", "900.00", "blank"),
      ),
      { rateText: "Capify 15% of card sales\nWayflyer 12% of revenue" },
    );
    expect(analysis.lenders.find((l) => /capify/i.test(l.name))?.monthly).toBeCloseTo((800 * 0.15) / 0.85, 2);
    expect(analysis.lenders.find((l) => /wayflyer/i.test(l.name))?.monthly).toBeCloseTo((900 * 0.12) / 0.88, 2);
  });

  it("applies a sales split to an MCA brand that is not in the default catalog when the schedule states the %", () => {
    const analysis = analyseBankStatements(
      bosMonth(bosTx("03 Aug 26", "NORTHSTAR ADVANCE MCA", "850.00", "blank")),
      { rateText: "Northstar Advance 15% of card sales" },
    );
    const northstar = analysis.lenders.find((l) => /northstar/i.test(l.name));
    expect(northstar?.kind).toBe("mca");
    expect(northstar?.monthly).toBeCloseTo((850 * 0.15) / 0.85, 2);
    expect(northstar?.splitRate).toBeCloseTo(0.15, 4);
  });

  it("does not invent Shopify Capital from website sales when the product is not on the file", () => {
    const analysis = analyseBankStatements(
      bosMonth(bosTx("03 Aug 26", "STRIPE PAYMENTS UK SHOPIFY XP0839", "1000.00", "blank")),
    );
    expect(analysis.lenders.some((l) => /shopify capital/i.test(l.name))).toBe(false);
    expect(analysis.financeMonthly).toBe(0);
  });

  it("does not invent PayPal Working Capital from ordinary PayPal receipts", () => {
    const analysis = analyseBankStatements(
      bosMonth(bosTx("03 Aug 26", "PAYPAL EUROPE S A R L ET CIE", "400.00", "blank")),
    );
    expect(analysis.lenders.some((l) => /paypal/i.test(l.name))).toBe(false);
    expect(analysis.financeMonthly).toBe(0);
  });

  it("takes PayPal Working Capital as 30% of PayPal sales, not less than £2,978 every 3 months", () => {
    const quiet = analyseBankStatements(bosMonth(bosTx("03 Aug 26", "PAYPAL FUNDING 4UVJ2226ZG5U8", "blank", "0.00")), {
      rateText: "PayPal Working Capital 30% of PayPal sales; minimum £2,978 every 3 months",
    });
    expect(quiet.lenders.find((l) => /paypal working capital/i.test(l.name))?.monthly).toBeCloseTo(2978 / 3, 2);

    const busy = analyseBankStatements(
      bosMonth(bosTx("03 Aug 26", "PAYPAL EUROPE S A R L ET CIE", "5000.00", "blank")),
      { rateText: "PayPal Working Capital 30% of PayPal sales; minimum £2,978 every 3 months" },
    );
    expect(busy.lenders.find((l) => /paypal working capital/i.test(l.name))?.monthly).toBeCloseTo(0.3 * 5000, 2);
  });

  it("leaves Iwoca as an instalment debit even if a percentage appears on the schedule", () => {
    const analysis = analyseBankStatements(
      bosMonth(`Date
03 Aug 26.
Description
IWOCA HYDROGEN LTD
Type
FPO.
Money In (£)
blank.
Money Out (£)
600.00.
Balance (£)
0.00.
`),
      { rateText: "Iwoca 20% of sales" },
    );
    const iwoca = analysis.lenders.find((l) => /iwoca/i.test(l.name));
    expect(iwoca?.monthly).toBeCloseTo(600, 2);
    expect(iwoca?.splitRate).toBeUndefined();
  });
});
