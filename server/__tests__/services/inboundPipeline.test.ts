import { describe, expect, it } from "vitest";
import { inboundLoanAmountPence, isInboundLead } from "../../services/inboundPipeline";

describe("inbound pipeline promotion", () => {
  it("treats WEB- company numbers and the capital strategist as inbound", () => {
    expect(isInboundLead({ companyNumber: "WEB-123", assignedAgentId: null })).toBe(true);
    expect(isInboundLead({ companyNumber: "12345678", assignedAgentId: "capital-strategist" })).toBe(true);
    expect(isInboundLead({ companyNumber: "12345678", assignedAgentId: "database-builder" })).toBe(false);
  });

  it("reads current debt from the landing-page notes as pence", () => {
    expect(
      inboundLoanAmountPence({
        notes: JSON.stringify({ calculatorData: { currentDebt: 50000 } }),
      })
    ).toBe(5_000_000);
    expect(inboundLoanAmountPence({ notes: "plain text" })).toBeNull();
  });
});
