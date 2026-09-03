import { describe, expect, it } from "vitest";
import { attentionFromDeals, attentionFromMail } from "@shared/attention";

describe("attentionFromDeals", () => {
  it("only lists work waiting on Shaun", () => {
    const items = attentionFromDeals([
      {
        id: 1,
        companyName: "Acme Joinery Limited",
        stage: "human_call",
        status: "waiting_human",
        ownerUserId: "shaun",
        source: "strata_inbound",
        updatedAt: "2026-08-27T10:00:00.000Z",
        createdAt: "2026-08-27T09:00:00.000Z",
        events: [{ at: "2026-08-27T10:00:00.000Z", stage: "human_call", message: "Call script is on the file." }],
      },
      {
        id: 2,
        companyName: "Timer Co",
        stage: "fulfilment",
        status: "waiting_timer",
        ownerUserId: "shaun",
        source: "distress_scan",
        updatedAt: "2026-08-27T10:00:00.000Z",
        createdAt: "2026-08-27T09:00:00.000Z",
        events: [],
      },
    ] as any);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Acme Joinery Limited");
    expect(items[0].task).toMatch(/call/i);
    expect(items[0].to).toBe("/workforce");
  });

  it("asks Shaun to approve a staged SME first-touch", () => {
    const items = attentionFromDeals([
      {
        id: 3,
        companyName: "Acme Joinery Limited",
        stage: "outreach",
        status: "waiting_human",
        ownerUserId: "shaun",
        source: "distress_scan",
        stream: "sme",
        humanReason: "Approve this email to ops@acmejoinery.co.uk before it sends.",
        updatedAt: "2026-09-01T10:00:00.000Z",
        createdAt: "2026-09-01T09:00:00.000Z",
        events: [],
      },
    ] as any);
    expect(items).toHaveLength(1);
    expect(items[0].task).toMatch(/approve this first-touch email/i);
  });

  it("asks Shaun to inspect quarantined leads before delete", () => {
    const items = attentionFromDeals([
      {
        id: 4,
        companyName: "No Inbox Ltd",
        stage: "ingest",
        status: "waiting_human",
        ownerUserId: "shaun",
        source: "distress_scan",
        stream: "sme",
        hopper: "quarantine",
        humanReason: "no corporate mailbox — inspect before delete",
        updatedAt: "2026-09-02T10:00:00.000Z",
        createdAt: "2026-09-02T09:00:00.000Z",
        events: [],
      },
    ] as any);
    expect(items).toHaveLength(1);
    expect(items[0].task).toMatch(/inspect this lead before delete/i);
  });

  it("sends a they-replied deal to Agent Mail", () => {
    const items = attentionFromDeals([
      {
        id: 5,
        companyName: "Acme Joinery Limited",
        stage: "fulfilment",
        status: "waiting_human",
        ownerUserId: "shaun",
        source: "distress_scan",
        stream: "sme",
        humanReason: "They replied — you own the thread. Open Agent Mail.",
        updatedAt: "2026-09-02T10:00:00.000Z",
        createdAt: "2026-09-02T09:00:00.000Z",
        events: [],
      },
    ] as any);
    expect(items[0].to).toBe("/agent-mail");
    expect(items[0].tone).toBe("accent");
  });

  it("puts a customer reply at the top of attention and sends Shaun to Agent Mail", () => {
    const items = attentionFromMail([
      {
        id: "m1",
        direction: "inbound",
        deskKind: "responsive",
        from: "ops@joinery.co.uk",
        subject: "Can we book a call",
        deskNote: "Customer reply — waiting on you",
        createdAt: "2026-09-02T10:00:00.000Z",
      },
      {
        id: "m2",
        direction: "inbound",
        deskKind: "spam",
        from: "support@ionos.co.uk",
        subject: "Welcome",
        createdAt: "2026-09-02T10:00:00.000Z",
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].to).toBe("/agent-mail");
    expect(items[0].tone).toBe("accent");
    expect(items[0].task).toMatch(/customer reply/i);
  });

  it("drops test files", () => {
    const items = attentionFromDeals([
      {
        id: 9,
        companyName: "Pack Upload Test Ltd",
        stage: "human_review",
        status: "waiting_human",
        ownerUserId: "pack-upload-test",
        source: "strata_inbound",
        updatedAt: "2026-08-27T10:00:00.000Z",
        createdAt: "2026-08-27T09:00:00.000Z",
        events: [],
      },
    ] as any);
    expect(items).toHaveLength(0);
  });
});
