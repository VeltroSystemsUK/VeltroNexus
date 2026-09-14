import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { inboundDeskForSource, inboundLoanAmountPence, isInboundLead } from "../../services/inboundPipeline";

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

  it("sends Tools enquiries to Maya and contact.html to the director", () => {
    expect(inboundDeskForSource("bbb")).toBe("maya");
    expect(inboundDeskForSource("refinance")).toBe("maya");
    expect(inboundDeskForSource("ttp")).toBe("maya");
    expect(inboundDeskForSource("debt")).toBe("maya");
    expect(inboundDeskForSource("commission")).toBe("maya");
    expect(inboundDeskForSource(undefined)).toBe("maya");
    expect(inboundDeskForSource("contact")).toBe("director");
    expect(inboundDeskForSource("CONTACT")).toBe("director");
  });

  it("wires Tools inbound to Maya ingest and contact.html to a director call", () => {
    const inbound = fs.readFileSync(path.resolve("server/routes/inbound.ts"), "utf8");
    expect(inbound).toMatch(/inboundDeskForSource/);
    expect(inbound).toMatch(/startFromContactPage/);
    expect(inbound).toMatch(/startFromInbound/);
    const workflow = fs.readFileSync(path.resolve("server/services/agenticWorkflow.ts"), "utf8");
    expect(workflow).toMatch(/startFromContactPage/);
    expect(workflow).toMatch(/Contact page enquiry/);
  });
});
