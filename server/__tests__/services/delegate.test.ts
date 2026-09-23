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
    expect(ids).toContain("harvest");
    expect(ids).not.toContain("accounts-monitor");
    expect(ids).not.toContain("capital-strategist");
    expect(ids).not.toContain("database-builder-se");
    expect(ids).not.toContain("director");
  });

  it("gives each live desk a real job they can run", () => {
    for (const desk of liveDelegateDesks()) {
      expect(jobsForAgent(desk.agentId).length).toBeGreaterThan(0);
    }
  });

  it("lets any live desk run any job, with its typical job sorted first", () => {
    expect(getDelegateJob("outreach-sales", "hunt")?.label).toBe("Hunt opportunities");
    expect(getDelegateJob("database-builder", "hunt")?.label).toBe("Hunt opportunities");
    expect(jobsForAgent("database-builder")[0].id).toBe("hunt");
    expect(jobsForAgent("outreach-sales")[0].id).toBe("retry_send");
  });

  it("rejects jobs for hibernated desks", () => {
    expect(getDelegateJob("accounts-monitor", "hunt")).toBeUndefined();
    expect(getDelegateJob("capital-strategist", "process_pack")).toBeUndefined();
    expect(jobsForAgent("database-builder-se")).toEqual([]);
  });

  it("lists Casey, Isla, and Reporter as delegable content desks with their real jobs", () => {
    const ids = liveDelegateDesks().map((desk) => desk.agentId);
    expect(ids).toContain("content-scout");
    expect(ids).toContain("marketing-manager");
    expect(ids).toContain("reporter");
    expect(getDelegateJob("content-scout", "scan_week")?.label).toBe("Scan week for content");
    expect(getDelegateJob("marketing-manager", "compose_week")?.label).toBe("Compose week");
    expect(getDelegateJob("reporter", "news_digest")?.label).toBe("Run news digest");
    expect(jobsForAgent("content-scout")[0].id).toBe("scan_week");
    expect(jobsForAgent("marketing-manager")[0].id).toBe("compose_week");
    expect(jobsForAgent("reporter")[0].id).toBe("news_digest");
  });

  it("content jobs never take a deal file", () => {
    expect(isDealEligible("scan_week", deal())).toBe(false);
    expect(isDealEligible("compose_week", deal())).toBe(false);
    expect(isDealEligible("news_digest", deal())).toBe(false);
    expect(eligibleDeals("scan_week", [deal()])).toEqual([]);
  });

  it("hunt does not take a deal file", () => {
    expect(isDealEligible("hunt", deal())).toBe(false);
    expect(eligibleDeals("hunt", [deal()])).toEqual([]);
  });

  it("gives Harvest a mailbox job that runs across the book, not one file", () => {
    expect(getDelegateJob("harvest", "harvest_mailboxes")?.label).toBe("Harvest mailboxes");
    expect(isDealEligible("harvest_mailboxes", deal({ email: undefined }))).toBe(false);
    expect(eligibleDeals("harvest_mailboxes", [deal({ email: undefined })])).toEqual([]);
  });

  it("find-contact only on files missing email or phone", () => {
    expect(isDealEligible("find_contact", deal({ email: "a@b.com", phone: "0121" }))).toBe(false);
    expect(isDealEligible("find_contact", deal({ email: undefined, phone: "0121" }))).toBe(true);
    expect(isDealEligible("find_contact", deal({ status: "failed", email: undefined }))).toBe(false);
  });

  it("lets Maya and Sophie retry a send that did not leave the box", () => {
    expect(getDelegateJob("inbound-intake", "retry_send")?.id).toBe("retry_send");
    expect(getDelegateJob("fulfilment-manager", "retry_send")?.id).toBe("retry_send");
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
