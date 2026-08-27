import { describe, expect, it } from "vitest";
import {
  eligibleDeals,
  getDelegateJob,
  isDealEligible,
  jobsForAgent,
  liveDelegateDesks,
  type DelegateDeal,
} from "@shared/delegate";

function deal(overrides: Partial<DelegateDeal> = {}): DelegateDeal {
  return {
    id: 1,
    stage: "outreach",
    status: "running",
    companyName: "Acme Joinery Ltd",
    ...overrides,
  };
}

describe("delegate jobs", () => {
  it("lists live desks and hides hibernated ones", () => {
    const ids = liveDelegateDesks().map((desk) => desk.agentId);
    expect(ids).toContain("database-builder");
    expect(ids).toContain("contact-finder");
    expect(ids).not.toContain("accounts-monitor");
    expect(ids).not.toContain("capital-strategist");
  });

  it("gives each live desk a real job they can run", () => {
    for (const desk of liveDelegateDesks()) {
      expect(jobsForAgent(desk.agentId).length).toBeGreaterThan(0);
    }
  });

  it("rejects jobs that do not belong to the desk", () => {
    expect(getDelegateJob("outreach-sales", "hunt")).toBeUndefined();
    expect(getDelegateJob("database-builder", "hunt")?.label).toBe("Hunt opportunities");
  });

  it("hunt does not take a deal file", () => {
    expect(isDealEligible("hunt", deal())).toBe(false);
    expect(eligibleDeals("hunt", [deal()])).toEqual([]);
  });

  it("find-contact only on files missing email or phone", () => {
    expect(isDealEligible("find_contact", deal({ email: "a@b.com", phone: "0121" }))).toBe(false);
    expect(isDealEligible("find_contact", deal({ email: undefined, phone: "0121" }))).toBe(true);
    expect(isDealEligible("find_contact", deal({ status: "failed", email: undefined }))).toBe(false);
  });

  it("retry-send only when SMTP actually failed", () => {
    expect(
      isDealEligible(
        "retry_send",
        deal({
          status: "waiting_human",
          humanReason: "Email did not send (SMTP missing or failed). Retry when mail is live.",
        })
      )
    ).toBe(true);
    expect(
      isDealEligible(
        "retry_send",
        deal({ status: "waiting_human", humanReason: "Warm call on a live inbound" })
      )
    ).toBe(false);
  });

  it("chase-pack only on fulfilment files", () => {
    expect(isDealEligible("chase_pack", deal({ stage: "fulfilment" }))).toBe(true);
    expect(isDealEligible("chase_pack", deal({ stage: "outreach" }))).toBe(false);
  });

  it("process-pack skips files waiting on the director", () => {
    expect(isDealEligible("process_pack", deal({ stage: "processing", status: "running" }))).toBe(true);
    expect(
      isDealEligible("process_pack", deal({ stage: "processing", status: "waiting_human" }))
    ).toBe(false);
    expect(isDealEligible("process_pack", deal({ stage: "underwriting", status: "running" }))).toBe(true);
  });

  it("match-company only on unmatched inbound", () => {
    expect(isDealEligible("match_company", deal({ stage: "ingest" }))).toBe(true);
    expect(isDealEligible("match_company", deal({ stage: "company_match" }))).toBe(true);
    expect(isDealEligible("match_company", deal({ stage: "outreach" }))).toBe(false);
  });
});
