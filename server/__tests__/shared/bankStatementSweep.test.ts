import { describe, expect, it } from "vitest";
import { analyseBankStatements, sweepBankStatementText } from "@shared/bankStatementSweep";

const SAMPLE = `
01 Mar 2026  OPENING BALANCE                         2,140.22
02 Mar 2026  TFR  FROM SALES                         8,400.00
03 Mar 2026  DD  IWOca LTD                    1,250.00  UNPAID - REFER TO PAYER
04 Mar 2026  DD  HMRC VAT                             890.00
05 Mar 2026  CARD  WILLIAM HILL                         75.00
06 Mar 2026  CASH WITHDRAWAL ATM                      400.00
07 Mar 2026  DD  FUNDING CIRCLE                     2,100.00
08 Mar 2026  OD INTEREST UNAUTHORISED                  42.50
09 Mar 2026  DD  E.ON ENERGY                          180.00  RETURNED ITEM
10 Mar 2026  TFR  K BEVAN                             600.00
`;

describe("sweepBankStatementText", () => {
  it("flags bounced direct debits and returned items", () => {
    const findings = sweepBankStatementText(SAMPLE);
    const bounced = findings.filter((f) => f.kind === "bounced");
    expect(bounced.length).toBeGreaterThanOrEqual(2);
    expect(bounced.some((f) => /iwoca/i.test(f.evidence))).toBe(true);
    expect(bounced.some((f) => /e\.on|returned/i.test(f.evidence))).toBe(true);
  });

  it("flags short-term loan and MCA-style repayments", () => {
    const findings = sweepBankStatementText(SAMPLE);
    expect(findings.some((f) => (f.kind === "loan" || f.kind === "mca") && /funding circle/i.test(f.evidence))).toBe(true);
    expect(findings.some((f) => f.kind === "mca" && /iwoca/i.test(f.evidence))).toBe(true);
  });

  it("flags HMRC, gambling, cash and unauthorised overdraft", () => {
    const findings = sweepBankStatementText(SAMPLE);
    expect(findings.some((f) => f.kind === "hmrc")).toBe(true);
    expect(findings.some((f) => f.kind === "gambling")).toBe(true);
    expect(findings.some((f) => f.kind === "cash")).toBe(true);
    expect(findings.some((f) => f.kind === "overdraft")).toBe(true);
  });

  it("does not invent findings on a clean trading statement", () => {
    const findings = sweepBankStatementText(`
01 Mar 2026  SALES CARD TAKEAWAY    1,200.00
02 Mar 2026  DD  E.ON ENERGY          180.00
03 Mar 2026  DD  O2                   35.00
`);
    expect(findings.filter((f) => f.kind === "bounced" || f.kind === "gambling" || f.kind === "mca")).toEqual([]);
  });
});

const BOS = `
BUSINESS ACCOUNT. 01 March 2026 to 31 March 2026.
Money In. £21,489.34. Balance on 01 March 2026. -£4,033.31.
Money Out. £26,289.12. Balance on 31 March 2026. -£8,833.09.
Date
02 Mar 26.
Description
IWOCA HYDROGEN LTD
Type
FPO.
Money In (£)
blank.
Money Out (£)
600.00.
Balance (£)
-7,554.18.
Date
06 Mar 26.
Description
FUNDING CIRCLE WQKR637.
Type
DD.
Money In (£)
blank.
Money Out (£)
96.09.
Balance (£)
-8,141.33.
Date
02 Mar 26.
Description
NBS PERSONAL LOANS
Type
DD.
Money In (£)
blank.
Money Out (£)
328.78.
Balance (£)
-6,013.57.
Date
09 Mar 26.
Description
LOAN - 01873005BBL.
Type
PAY.
Money In (£)
blank.
Money Out (£)
201.11.
Balance (£)
424.76.
Date
02 Mar 26.
Description
STRIPE PAYMENTS UK
Type
FPI.
Money In (£)
1,200.00.
Money Out (£)
blank.
Balance (£)
-4,000.00.
`;

describe("analyseBankStatements", () => {
  it("reads Money In / Money Out from the Bank of Scotland period header", () => {
    const analysis = analyseBankStatements(BOS, { proposedMonthly: 1800 });
    expect(analysis.months).toHaveLength(1);
    expect(analysis.months[0].moneyIn).toBeCloseTo(21489.34, 2);
    expect(analysis.months[0].moneyOut).toBeCloseTo(26289.12, 2);
    expect(analysis.totals.avgIn).toBeCloseTo(21489.34, 2);
    expect(analysis.totals.avgOut).toBeCloseTo(26289.12, 2);
  });

  it("totals stacked loan / MCA repayments and shows refinance DSCR improving", () => {
    const analysis = analyseBankStatements(BOS, { proposedMonthly: 800 });
    expect(analysis.financeMonthly).toBeCloseTo(600 + 96.09 + 328.78 + 201.11, 2);
    expect(analysis.monthlySaving).toBeCloseTo(analysis.financeMonthly - 800, 2);
    expect(analysis.headroomAfter).toBeGreaterThan(analysis.headroomNow);
    expect(analysis.lenders.some((l) => /iwoca/i.test(l.name) && l.moneyOut === 600)).toBe(true);
  });

  it("does not double stacked finance when the same statements are attached twice", () => {
    const once = analyseBankStatements(BOS, { proposedMonthly: 800 });
    const twice = analyseBankStatements(`${BOS}\n${BOS}`, { proposedMonthly: 800 });
    expect(twice.months).toHaveLength(once.months.length);
    expect(twice.financeMonthly).toBeCloseTo(once.financeMonthly, 2);
    expect(twice.lenders.find((l) => /iwoca/i.test(l.name))?.moneyOut).toBe(600);
  });

  it("counts Capital on Tap, Shopify Capital and card DDs as finance, not PayPal shop spend", () => {
    const analysis = analyseBankStatements(`
BUSINESS ACCOUNT. 01 August 2026 to 31 August 2026.
Money In. £16,449.20. Balance on 01 August 2026. -£9,160.85.
Money Out. £15,832.15. Balance on 31 August 2026. -£8,543.80.
Date
21 Aug 26.
Description
CAPITAL ON TAP THE7JMY.
Type
DD.
Money In (£)
blank.
Money Out (£)
831.45.
Balance (£)
-100.00.
Date
04 Aug 26.
Description
SHOPIFY CAPITAL UK B2PIAPZQPRSC2Z1GLO.
Type
DD.
Money In (£)
blank.
Money Out (£)
23.61.
Balance (£)
-120.00.
Date
20 Aug 26.
Description
MBNA LIMITED 5230670044603778.
Type
DD.
Money In (£)
blank.
Money Out (£)
194.11.
Balance (£)
-300.00.
Date
04 Aug 26.
Description
PAYPAL *CRAFTSHOP
Type
DEB.
Money In (£)
blank.
Money Out (£)
72.98.
Balance (£)
-400.00.
`);
    expect(analysis.lenders.some((l) => /capital on tap/i.test(l.name))).toBe(true);
    expect(analysis.lenders.some((l) => /shopify capital/i.test(l.name))).toBe(true);
    expect(analysis.lenders.some((l) => /mbna/i.test(l.name))).toBe(true);
    expect(analysis.lenders.some((l) => /paypal/i.test(l.name))).toBe(false);
    expect(analysis.financeMonthly).toBeCloseTo(831.45 + 23.61 + 194.11, 2);
  });

  it("uses each facility's monthly debit, not the 6-month average of a loan that started late", () => {
    const analysis = analyseBankStatements(`
BUSINESS ACCOUNT. 01 March 2026 to 31 March 2026.
Money In. £10,000.00. Balance on 01 March 2026. £0.00.
Money Out. £5,000.00. Balance on 31 March 2026. £5,000.00.
Date
02 Mar 26.
Description
NBS PERSONAL LOANS
Type
DD.
Money In (£)
blank.
Money Out (£)
328.78.
Balance (£)
100.00.
BUSINESS ACCOUNT. 01 August 2026 to 31 August 2026.
Money In. £10,000.00. Balance on 01 August 2026. £0.00.
Money Out. £5,000.00. Balance on 31 August 2026. £5,000.00.
Date
03 Aug 26.
Description
NBS PERSONAL LOANS
Type
DD.
Money In (£)
blank.
Money Out (£)
328.78.
Balance (£)
100.00.
Date
27 Aug 26.
Description
FUNDING CIRCLE C687TTC.
Type
DD.
Money In (£)
blank.
Money Out (£)
211.85.
Balance (£)
200.00.
`);
    const nbs = analysis.lenders.find((l) => /nbs/i.test(l.name));
    const fc = analysis.lenders.find((l) => /funding circle/i.test(l.name));
    expect(nbs?.monthly).toBeCloseTo(328.78, 2);
    expect(fc?.monthly).toBeCloseTo(211.85, 2);
    expect(analysis.financeMonthly).toBeCloseTo(328.78 + 211.85, 2);
  });

  it("does not treat a mid-month stub as the stacked-debt month", () => {
    const analysis = analyseBankStatements(`
BUSINESS ACCOUNT. 01 August 2026 to 31 August 2026.
Money In. £16,449.20. Balance on 01 August 2026. -£9,160.85.
Money Out. £20,000.00. Balance on 31 August 2026. -£12,711.65.
Date
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
Date
21 Aug 26.
Description
CAPITAL ON TAP THE7JMY
Type
DD.
Money In (£)
blank.
Money Out (£)
831.45.
Balance (£)
0.00.
BUSINESS ACCOUNT. 01 September 2026 to 08 September 2026.
Money In. £9,339.36. Balance on 01 September 2026. -£8,543.80.
Money Out. £9,494.85. Balance on 08 September 2026. -£8,699.29.
Date
02 Sep 26.
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
`);
    expect(analysis.totals.months).toBe(1);
    expect(analysis.totals.avgNet).toBeCloseTo(16449.2 - 20000, 2);
    expect(analysis.financeMonthly).toBeCloseTo(600 + 831.45, 2);
    expect(analysis.lenders.find((l) => /capital on tap/i.test(l.name))?.monthly).toBeCloseTo(831.45, 2);
    expect(analysis.cashForDebt).toBeCloseTo(analysis.totals.avgNet + analysis.financeMonthly, 2);
    expect(analysis.cashForDebt).toBeLessThan(analysis.financeMonthly);
  });

  it("does not carry a one-off July facility into August stacked debt", () => {
    const analysis = analyseBankStatements(`
BUSINESS ACCOUNT. 01 July 2026 to 31 July 2026.
Money In. £10,000.00. Balance on 01 July 2026. £0.00.
Money Out. £8,000.00. Balance on 31 July 2026. £2,000.00.
Date
28 Jul 26.
Description
PAYPAL FUNDING 4UVJ2226ZG5U8
Type
DD.
Money In (£)
blank.
Money Out (£)
1550.00.
Balance (£)
0.00.
BUSINESS ACCOUNT. 01 August 2026 to 31 August 2026.
Money In. £10,000.00. Balance on 01 August 2026. £0.00.
Money Out. £8,000.00. Balance on 31 August 2026. £2,000.00.
Date
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
`);
    expect(analysis.lenders.find((l) => /paypal/i.test(l.name))?.monthly).toBe(0);
    expect(analysis.financeMonthly).toBeCloseTo(600, 2);
  });

  it("treats YouLend money-in as MCA remittances net of a 22% holdback", () => {
    const analysis = analyseBankStatements(`
BUSINESS ACCOUNT. 01 August 2026 to 31 August 2026.
Money In. £10,000.00. Balance on 01 August 2026. £0.00.
Money Out. £8,000.00. Balance on 31 August 2026. £2,000.00.
Date
03 Aug 26.
Description
YOULEND LIMITED YL60396877OUT
Type
FPI.
Money In (£)
780.00.
Money Out (£)
blank.
Balance (£)
780.00.
Date
04 Aug 26.
Description
IWOCA HYDROGEN LTD
Type
FPO.
Money In (£)
blank.
Money Out (£)
600.00.
Balance (£)
180.00.
BUSINESS ACCOUNT. 01 September 2026 to 08 September 2026.
Money In. £2,000.00. Balance on 01 September 2026. £0.00.
Money Out. £1,000.00. Balance on 08 September 2026. £1,000.00.
Date
02 Sep 26.
Description
YOULEND LIMITED YL60396877OUT
Type
FPI.
Money In (£)
200.00.
Money Out (£)
blank.
Balance (£)
200.00.
`);
    const youlend = analysis.lenders.find((l) => /youlend/i.test(l.name));
    expect(youlend?.kind).toBe("mca");
    expect(youlend?.moneyIn).toBeCloseTo(980, 2);
    expect(youlend?.monthly).toBeCloseTo((780 * 0.22) / 0.78, 2);
    expect(analysis.financeMonthly).toBeCloseTo(600 + (780 * 0.22) / 0.78, 2);
  });

  it("takes Shopify Capital as 17% of website and eBay sales, not less than the Capital DDs", () => {
    const analysis = analyseBankStatements(`
BUSINESS ACCOUNT. 01 August 2026 to 31 August 2026.
Money In. £20,000.00. Balance on 01 August 2026. £0.00.
Money Out. £8,000.00. Balance on 31 August 2026. £12,000.00.
Date
03 Aug 26.
Description
STRIPE PAYMENTS UK SHOPIFY XP0839281089112257
Type
FPI.
Money In (£)
1000.00.
Money Out (£)
blank.
Balance (£)
1000.00.
Date
04 Aug 26.
Description
EBAY COMMERCE UK LTD
Type
FPI.
Money In (£)
400.00.
Money Out (£)
blank.
Balance (£)
1400.00.
Date
05 Aug 26.
Description
SHOPIFY CAPITAL UK B2PIAPZQPRSC2Z1GLO
Type
DD.
Money In (£)
blank.
Money Out (£)
51.00.
Balance (£)
1349.00.
`);
    const shopify = analysis.lenders.find((l) => /shopify capital/i.test(l.name));
    expect(shopify?.kind).toBe("mca");
    expect(shopify?.monthly).toBeCloseTo(0.17 * (1000 + 400), 2);
    expect(analysis.financeMonthly).toBeCloseTo(0.17 * 1400, 2);
  });
});



