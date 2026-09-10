import { describe, expect, it } from "vitest";
import { allowsSameOriginFrame } from "../strataEmbed";

describe("allowsSameOriginFrame", () => {
  it("lets Sterling proposal and handover HTML render in the portal iframe", () => {
    expect(allowsSameOriginFrame("/api/broker-portal/handoffs/1/report.html")).toBe(true);
    expect(allowsSameOriginFrame("/api/broker-portal/handoffs/12/handover.html")).toBe(true);
    expect(allowsSameOriginFrame("/api/broker-portal/handoffs/1/application.html")).toBe(true);
  });

  it("does not open other API routes to framing", () => {
    expect(allowsSameOriginFrame("/api/broker-portal/handoffs")).toBe(false);
    expect(allowsSameOriginFrame("/api/broker-portal/handoffs/1")).toBe(false);
    expect(allowsSameOriginFrame("/api/prospects/85/report")).toBe(false);
  });
});
