import { describe, it, expect } from "vitest";
import { isHighRateLender } from "../../data/highRateCommercialLenders";
import { assessStrataFit, MIN_FIT_SCORE } from "../../services/strataFit";

const tradingSme = {
  companyName: "Acme Joinery Limited",
  companyNumber: "12345678",
  companyStatus: "active",
  dateOfCreation: "2019-04-01",
  sicCodes: ["43320"],
};

describe("isHighRateLender matching", () => {
  it("matches a full Companies House charge name", () => {
    expect(isHighRateLender("IWOCA LIMITED")?.name).toBe("Iwoca");
    expect(isHighRateLender("TOGETHER COMMERCIAL FINANCE LIMITED")?.name).toBe("Together Commercial");
    expect(isHighRateLender("UNITED TRUST BANK LIMITED")?.name).toBe("United Trust Bank");
  });

  it("does not match short aliases inside unrelated names", () => {
    expect(isHighRateLender("NATIONAL WESTMINSTER BANK PLC")).toBeNull();
    expect(isHighRateLender("HMFS HOLDINGS LIMITED")).toBeNull();
    expect(isHighRateLender("SOUTHBANK PLC")).toBeNull();
  });
});

describe("assessStrataFit", () => {
  it("passes a trading SME on a live MCA", () => {
    const result = assessStrataFit({
      ...tradingSme,
      charges: [
        {
          status: "outstanding",
          createdOn: "2024-06-01",
          personsEntitled: ["IWOCA LIMITED"],
        },
      ],
    });
    expect(result.pass).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(MIN_FIT_SCORE);
    expect(result.lenders).toContain("Iwoca");
  });

  it("passes a stacked high-cost alternative case", () => {
    const result = assessStrataFit({
      ...tradingSme,
      charges: [
        { status: "outstanding", createdOn: "2024-01-01", personsEntitled: ["CAPIFY"] },
        { status: "outstanding", createdOn: "2024-08-01", personsEntitled: ["FLEXIMIZE"] },
      ],
    });
    expect(result.pass).toBe(true);
    expect(result.reasons.some((line) => line.includes("stacked"))).toBe(true);
  });

  it("rejects a lone property-style bridge", () => {
    const result = assessStrataFit({
      companyName: "Park Lane Property Investment Limited",
      companyNumber: "87654321",
      companyStatus: "active",
      dateOfCreation: "2018-01-01",
      sicCodes: ["68100"],
      charges: [
        { status: "outstanding", createdOn: "2024-03-01", personsEntitled: ["LENDINVEST LIMITED"] },
      ],
    });
    expect(result.pass).toBe(false);
    expect(result.rejectReason).toMatch(/wrong sector|property/i);
  });

  it("rejects a single bridge even in a trading sector", () => {
    const result = assessStrataFit({
      ...tradingSme,
      charges: [
        { status: "outstanding", createdOn: "2024-03-01", personsEntitled: ["LENDINVEST LIMITED"] },
      ],
    });
    expect(result.pass).toBe(false);
    expect(result.rejectReason).toMatch(/bridge/i);
  });

  it("rejects companies already on the book", () => {
    const result = assessStrataFit({
      ...tradingSme,
      alreadyOnBook: true,
      charges: [{ status: "outstanding", personsEntitled: ["IWOCA LIMITED"] }],
    });
    expect(result.pass).toBe(false);
    expect(result.rejectReason).toBe("already on the book");
  });

  it("rejects companies that are too new", () => {
    const result = assessStrataFit({
      ...tradingSme,
      dateOfCreation: new Date().toISOString().slice(0, 10),
      charges: [{ status: "outstanding", personsEntitled: ["IWOCA LIMITED"] }],
    });
    expect(result.pass).toBe(false);
    expect(result.rejectReason).toMatch(/too new/);
  });

  it("rejects finance and holding SICs", () => {
    const result = assessStrataFit({
      ...tradingSme,
      sicCodes: ["64921"],
      charges: [{ status: "outstanding", personsEntitled: ["IWOCA LIMITED"] }],
    });
    expect(result.pass).toBe(false);
    expect(result.rejectReason).toMatch(/wrong sector|broker/i);
  });

  it("rejects gambling, tobacco, and property development", () => {
    expect(
      assessStrataFit({
        ...tradingSme,
        sicCodes: ["92000"],
        charges: [{ status: "outstanding", personsEntitled: ["IWOCA LIMITED"] }],
      }).pass
    ).toBe(false);
    expect(
      assessStrataFit({
        ...tradingSme,
        sicCodes: ["41100"],
        charges: [{ status: "outstanding", personsEntitled: ["IWOCA LIMITED"] }],
      }).rejectReason
    ).toMatch(/wrong sector/i);
  });

  it("rejects commercial finance brokers by name", () => {
    const result = assessStrataFit({
      ...tradingSme,
      companyName: "Leeds Commercial Finance Brokers Limited",
      charges: [{ status: "outstanding", personsEntitled: ["IWOCA LIMITED"] }],
    });
    expect(result.pass).toBe(false);
    expect(result.rejectReason).toMatch(/broker/i);
  });

  it("rejects when there is no high-cost charge", () => {
    const result = assessStrataFit({
      ...tradingSme,
      charges: [{ status: "outstanding", personsEntitled: ["BARCLAYS BANK PLC"] }],
    });
    expect(result.pass).toBe(false);
    expect(result.rejectReason).toMatch(/no high-cost/);
  });
});
