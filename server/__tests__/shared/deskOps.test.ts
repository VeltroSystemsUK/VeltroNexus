import { describe, expect, it } from "vitest";
import { HIBERNATED_DESKS, deskForDeal, deskJobProgress, summariseDeskOps } from "@shared/deskOps";

describe("desk ops", () => {
  it("does not report hibernated desks", () => {
    expect(HIBERNATED_DESKS).toEqual(expect.arrayContaining(["accounts-monitor", "capital-strategist", "database-builder-se"]));
    const rows = summariseDeskOps({ deals: [], mail: [] });
    expect(rows.map((row) => row.agentId)).not.toEqual(
      expect.arrayContaining(["accounts-monitor", "capital-strategist", "director"])
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

  it("does not count a failed send as not-delivered after a later real send to that file", () => {
    const rows = summariseDeskOps({
      deals: [
        {
          id: 1,
          source: "distress_scan",
          stage: "outreach",
          status: "waiting_timer",
          companyName: "Acme Ltd",
          events: [],
        },
      ],
      mail: [
        {
          agentId: "outreach-sales",
          direction: "outbound",
          status: "failed",
          dealId: 1,
          to: "ops@acme.co.uk",
          createdAt: "2026-09-06T10:00:00.000Z",
        },
        {
          agentId: "outreach-sales",
          direction: "outbound",
          status: "sent",
          dealId: 1,
          to: "ops@acme.co.uk",
          createdAt: "2026-09-07T10:00:00.000Z",
        },
        {
          agentId: "outreach-sales",
          direction: "outbound",
          status: "failed",
          dealId: 2,
          to: "ops@stuck.co.uk",
          createdAt: "2026-09-07T11:00:00.000Z",
        },
      ],
    });
    const james = rows.find((row) => row.agentId === "outreach-sales");
    expect(james?.notDelivered).toBe(1);
  });

  it("counts mailed from Deal file send events when the mail log is empty or short", () => {
    const rows = summariseDeskOps({
      deals: [
        {
          id: 9,
          source: "distress_scan",
          stage: "outreach",
          status: "waiting_timer",
          companyName: "Works Ltd",
          events: [
            {
              at: "2026-09-01T09:41:26.000Z",
              stage: "outreach",
              agent: "outreach-sales",
              message: "Day 1 email to ops@works.co.uk: Debt service reduction — first email",
            },
            {
              at: "2026-09-03T04:54:15.000Z",
              stage: "fulfilment",
              agent: "outreach-sales",
              message: "sme_1 opened — quiz follow-up sent to ops@works.co.uk",
            },
            {
              at: "2026-09-01T09:40:00.000Z",
              stage: "outreach",
              agent: "outreach-sales",
              message: "Not emailed — fit 40/70",
            },
          ],
        },
      ],
      mail: [],
    });
    const james = rows.find((row) => row.agentId === "outreach-sales");
    expect(james?.mailed).toBe(2);
  });

  it("puts hunt files on Daniel and introducer files on Tom, not Maya", () => {
    expect(
      deskForDeal({
        stage: "ingest",
        source: "distress_scan",
        events: [
          { at: "2026-08-27T09:00:00.000Z", stage: "ingest", agent: "database-builder", message: "Hunt opened" },
        ],
      })
    ).toBe("database-builder");
    expect(
      deskForDeal({
        stage: "company_match",
        source: "distress_scan",
        stream: "introducer",
        events: [
          {
            at: "2026-08-27T09:00:00.000Z",
            stage: "ingest",
            agent: "database-builder-se",
            message: "Refer Agent find",
          },
        ],
      })
    ).toBe("database-builder-se");
  });

  it("gives Elena enrich, James hunt email, Maya inbound ack, Sophie chase", () => {
    expect(
      deskForDeal({
        stage: "enrich",
        source: "distress_scan",
        events: [],
      })
    ).toBe("contact-finder");
    expect(
      deskForDeal({
        stage: "outreach",
        source: "distress_scan",
        events: [],
      })
    ).toBe("outreach-sales");
    expect(
      deskForDeal({
        stage: "outreach",
        source: "strata_inbound",
        events: [],
      })
    ).toBe("inbound-intake");
    expect(
      deskForDeal({
        stage: "fulfilment",
        source: "strata_inbound",
        events: [],
      })
    ).toBe("fulfilment-manager");
  });

  it("puts SME files without an email on Harvest, including quarantine", () => {
    expect(
      deskForDeal({
        stage: "ingest",
        source: "distress_scan",
        hopper: "quarantine",
        events: [],
      })
    ).toBe("harvest");
    expect(
      deskForDeal({
        stage: "ingest",
        source: "distress_scan",
        hopper: "hunt_contact",
        events: [],
      })
    ).toBe("harvest");
    expect(
      deskForDeal({
        stage: "enrich",
        source: "strata_inbound",
        events: [],
      })
    ).toBe("contact-finder");
  });

  it("turns a running harvest job into a progress bar payload", () => {
    expect(
      deskJobProgress(
        [
          {
            agentId: "harvest",
            status: "running",
            totalSteps: 49,
            completedSteps: 12,
            currentStep: "ENSYGN LIMITED",
          },
        ],
        "harvest"
      )
    ).toEqual({
      pct: 24,
      label: "12 / 49",
      current: "ENSYGN LIMITED",
    });
    expect(deskJobProgress([], "harvest")).toBeNull();
  });

  it("shows the newest running harvest job when two passes overlap", () => {
    expect(
      deskJobProgress(
        [
          {
            agentId: "harvest",
            status: "running",
            totalSteps: 48,
            completedSteps: 3,
            currentStep: "GREAT GIDDING GREEN ENERGY LIMITED",
            startedAt: "2026-09-02T10:04:18.451Z",
          },
          {
            agentId: "harvest",
            status: "running",
            totalSteps: 48,
            completedSteps: 5,
            currentStep: "STEPHEN JAMES CONSULTING LIMITED",
            startedAt: "2026-09-02T10:05:49.620Z",
          },
        ],
        "harvest"
      )
    ).toEqual({
      pct: 10,
      label: "5 / 48",
      current: "STEPHEN JAMES CONSULTING LIMITED",
    });
  });
});
