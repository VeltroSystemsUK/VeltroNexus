import { describe, expect, it } from "vitest";
import {
  assessIntroducerFit,
  classifyProspectStream,
  excludedSectorReason,
  isBrokerProspect,
  isBrokerSearchQuery,
  nextCadenceStep,
  scoreSignals,
} from "@shared/salesOs";

describe("Nexus Sales OS guardrails", () => {
  it("blocks broker search queries and broker-named companies", () => {
    expect(isBrokerSearchQuery("Find commercial finance brokers in Leeds")).toBe(true);
    expect(isBrokerSearchQuery("manufacturing SMEs in Leicester")).toBe(false);
    expect(isBrokerProspect("Midlands Commercial Finance Brokers Ltd")).toBe(true);
    expect(isBrokerProspect("Acme Joinery Limited", ["43320"])).toBe(false);
    expect(isBrokerProspect("Packaging Solutions Ltd", ["82920"])).toBe(false);
  });

  it("excludes property development, gambling, and tobacco", () => {
    expect(excludedSectorReason(["41100"])).toMatch(/wrong sector/i);
    expect(excludedSectorReason(["92000"])).toMatch(/wrong sector/i);
    expect(excludedSectorReason(["12000"])).toMatch(/wrong sector/i);
    expect(excludedSectorReason(["41201"])).toBeNull();
  });

  it("classifies Stream A vs Stream B", () => {
    expect(
      classifyProspectStream({
        companyName: "Acme Joinery Limited",
        sicCodes: ["43320"],
        hasHighCostDebt: true,
      }).stream
    ).toBe("sme");
    expect(
      classifyProspectStream({
        companyName: "Hartley & Co Chartered Accountants",
        sicCodes: ["69201"],
        hasHighCostDebt: false,
      }).stream
    ).toBe("introducer");
    expect(
      classifyProspectStream({
        companyName: "NACFB Member Brokers Ltd",
        hasHighCostDebt: true,
      }).stream
    ).toBeNull();
  });
});

describe("SIG scoring matrix", () => {
  it("scores stacked MCA charges as SIG-01 P0", () => {
    const result = scoreSignals({
      companyName: "Acme Joinery Limited",
      outstandingHighCostChargeCount: 3,
    });
    expect(result.disqualified).toBe(false);
    expect(result.priority).toBe("P0");
    expect(result.signals.some((s) => s.code === "SIG-01" && s.weight === 40)).toBe(true);
  });

  it("treats an HMRC petition as the primary P0 buying signal", () => {
    const result = scoreSignals({
      companyName: "Acme Joinery Limited",
      hmrcTtp: true,
    });
    expect(result.priority).toBe("P0");
    expect(result.signals.some((s) => s.code === "SIG-02" && s.weight === 50)).toBe(true);
  });

  it("disqualifies SIG-06 consumer / sub-£100k files", () => {
    const result = scoreSignals({
      companyName: "Personal Loan Ltd",
      turnoverGbp: 80_000,
    });
    expect(result.disqualified).toBe(true);
    expect(result.signals[0]?.code).toBe("SIG-06");
  });
});

describe("cadence", () => {
  it("runs Stream A across 14 days", () => {
    expect(nextCadenceStep("sme", 0)?.touchId).toBe("sme_1");
    expect(nextCadenceStep("sme", 1)?.touchId).toBe("sme_linkedin");
    expect(nextCadenceStep("sme", 2)?.touchId).toBe("sme_2");
    expect(nextCadenceStep("sme", 3)?.touchId).toBe("sme_close");
    expect(nextCadenceStep("sme", 3)?.queueCall).toBe(true);
    expect(nextCadenceStep("sme", 4)).toBeNull();
  });

  it("runs Stream B across 10 days", () => {
    expect(nextCadenceStep("introducer", 0)?.touchId).toBe("intro_1");
    expect(nextCadenceStep("introducer", 1)?.channel).toBe("linkedin");
    expect(nextCadenceStep("introducer", 2)?.queueCall).toBe(true);
  });
});

describe("introducer fit", () => {
  it("passes an established accountancy practice", () => {
    const result = assessIntroducerFit({
      companyName: "Hartley & Co Chartered Accountants",
      sicCodes: ["69201"],
      companyStatus: "active",
      dateOfCreation: "2015-01-01",
    });
    expect(result.pass).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(30);
  });

  it("rejects brokers even with an accountancy-looking name", () => {
    const result = assessIntroducerFit({
      companyName: "City Finance Broker Accountants Ltd",
      sicCodes: ["64921"],
      companyStatus: "active",
      dateOfCreation: "2015-01-01",
    });
    expect(result.pass).toBe(false);
  });
});
