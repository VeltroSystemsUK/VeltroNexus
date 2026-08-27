import { describe, expect, it } from "vitest";
import { HIBERNATED_DESKS, summariseDeskOps } from "@shared/deskOps";

describe("desk ops", () => {
  it("does not report hibernated desks", () => {
    expect(HIBERNATED_DESKS).toEqual(expect.arrayContaining(["accounts-monitor", "capital-strategist"]));
    const rows = summariseDeskOps({ deals: [], mail: [] });
    expect(rows.map((row) => row.agentId)).not.toEqual(
      expect.arrayContaining(["accounts-monitor", "capital-strategist"])
    );
  });

  it("counts open files, waits, and real vs mock mail", () => {
    const rows = summariseDeskOps({
      deals: [
        {
          id: 1,
          source: "distress_scan",
          stage: "outreach",
          status: "waiting_timer",
          companyName: "Acme Ltd",
          events: [{ at: "2026-08-27T10:00:00.000Z", stage: "outreach", agent: "outreach-sales", message: "Day 1 emailed" }],
        },
        {
          id: 2,
          source: "strata_inbound",
          stage: "human_review",
          status: "waiting_human",
          companyName: "Beta Ltd",
          events: [
            { at: "2026-08-27T11:00:00.000Z", stage: "human_review", agent: "deal-processing-underwriter", message: "SFP complete" },
          ],
        },
      ],
      mail: [
        { agentId: "outreach-sales", direction: "outbound", status: "sent" },
        { agentId: "outreach-sales", direction: "outbound", status: "mock" },
        { agentId: "inbound-intake", direction: "outbound", status: "failed" },
      ],
    });

    const james = rows.find((row) => row.agentId === "outreach-sales");
    const priya = rows.find((row) => row.agentId === "deal-processing-underwriter");
    const maya = rows.find((row) => row.agentId === "inbound-intake");

    expect(james?.open).toBe(1);
    expect(james?.mailed).toBe(1);
    expect(james?.notDelivered).toBe(1);
    expect(priya?.waitingYou).toBe(1);
    expect(priya?.open).toBe(1);
    expect(maya?.notDelivered).toBe(1);
  });
});
