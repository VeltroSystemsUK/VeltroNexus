import { describe, expect, it } from "vitest";
import { summariseDeskFunctions, WORKING_WINDOW_MS } from "@shared/deskOps";

const specs = [
  {
    agentId: "database-builder",
    name: "Daniel Crowe",
    role: "Client Agent",
    job: "Find Stream A SME borrowers.",
    duties: ["Hunt Gazette", "Open deal files that pass fit"],
  },
  {
    agentId: "outreach-sales",
    name: "James Hale",
    role: "Business Consultant",
    job: "Run hunt email cadences.",
    duties: ["Send Stream A email", "Hold on PECR"],
  },
  {
    agentId: "accounts-monitor",
    name: "Oliver Grant",
    role: "Finance Monitor",
    job: "Track commissions.",
    duties: ["Reconcile receipts"],
  },
];

describe("summariseDeskFunctions", () => {
  it("marks a desk working when it owns a running file or just wrote an event", () => {
    const now = "2026-08-27T12:00:00.000Z";
    const rows = summariseDeskFunctions({
      specs,
      deals: [
        {
          id: 1,
          source: "distress_scan",
          stage: "ingest",
          status: "running",
          companyName: "Acme Joinery Ltd",
          events: [
            {
              at: "2026-08-27T11:59:50.000Z",
              stage: "ingest",
              agent: "database-builder",
              message: "Strata fit 82/100",
            },
          ],
        },
      ],
      nowMs: Date.parse(now),
    });
    const daniel = rows.find((row) => row.agentId === "database-builder")!;
    expect(daniel.state).toBe("working");
    expect(daniel.workingOn).toBe("Acme Joinery Ltd");
    expect(daniel.lastEvent).toMatch(/Strata fit/);
  });

  it("marks James waiting on you for a LinkedIn hold, not working", () => {
    const rows = summariseDeskFunctions({
      specs,
      deals: [
        {
          id: 2,
          source: "distress_scan",
          stage: "outreach",
          status: "waiting_human",
          companyName: "Beta Ltd",
          events: [
            {
              at: "2026-08-27T10:00:00.000Z",
              stage: "outreach",
              agent: "outreach-sales",
              message: "LinkedIn copy staged",
            },
          ],
        },
      ],
      nowMs: Date.parse("2026-08-27T12:00:00.000Z"),
    });
    expect(rows.find((row) => row.agentId === "outreach-sales")?.state).toBe("waiting_you");
  });

  it("treats a running agent job as live work even with no deal file", () => {
    const rows = summariseDeskFunctions({
      specs,
      deals: [],
      runningJobAgentIds: ["database-builder"],
      nowMs: Date.parse("2026-08-27T12:00:00.000Z"),
    });
    expect(rows.find((row) => row.agentId === "database-builder")?.state).toBe("working");
  });

  it("keeps hibernated desks listed as hibernated and sorts working first", () => {
    const rows = summariseDeskFunctions({
      specs,
      deals: [
        {
          id: 1,
          source: "distress_scan",
          stage: "ingest",
          status: "running",
          companyName: "Acme Ltd",
          events: [
            {
              at: "2026-08-27T11:59:00.000Z",
              stage: "ingest",
              agent: "database-builder",
              message: "Hunt opened",
            },
          ],
        },
      ],
      nowMs: Date.parse("2026-08-27T12:00:00.000Z"),
    });
    expect(rows[0].agentId).toBe("database-builder");
    expect(rows.find((row) => row.agentId === "accounts-monitor")?.state).toBe("hibernated");
    expect(rows.find((row) => row.agentId === "accounts-monitor")?.job).toBe("Track commissions.");
  });

  it("does not treat a stale event as working — the timer sits on Sophie's desk", () => {
    const now = Date.parse("2026-08-27T12:00:00.000Z");
    const stale = new Date(now - WORKING_WINDOW_MS - 1).toISOString();
    const rows = summariseDeskFunctions({
      specs: [
        ...specs,
        {
          agentId: "fulfilment-manager",
          name: "Sophie Reed",
          role: "New Business Manager",
          job: "Chase the pack.",
          duties: ["Watch the timer"],
        },
      ],
      deals: [
        {
          id: 3,
          source: "distress_scan",
          stage: "fulfilment",
          status: "waiting_timer",
          companyName: "Gamma Ltd",
          waitUntil: "2026-08-27T15:00:00.000Z",
          events: [
            {
              at: stale,
              stage: "outreach",
              agent: "outreach-sales",
              message: "Day 1 emailed",
            },
          ],
        },
      ],
      nowMs: now,
    });
    expect(rows.find((row) => row.agentId === "outreach-sales")?.state).toBe("idle");
    const sophie = rows.find((row) => row.agentId === "fulfilment-manager")!;
    expect(sophie.state).toBe("waiting_timer");
    expect(sophie.nextDue).toBe("2026-08-27T15:00:00.000Z");
  });
});
