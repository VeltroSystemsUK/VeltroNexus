import { describe, expect, it } from "vitest";
import { attentionFromDeals, attentionFromHopper, attentionFromMail } from "@shared/attention";

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

  it("does not ask Shaun to post LinkedIn before the next email can send", () => {
    const items = attentionFromDeals([
      {
        id: 12,
        companyName: "Acme Joinery Limited",
        stage: "outreach",
        status: "waiting_human",
        ownerUserId: "shaun",
        source: "distress_scan",
        stream: "sme",
        outreachTouchId: "sme_linkedin",
        humanReason: "Post the LinkedIn copy, then mark it posted. The next email will not send until you do.",
        updatedAt: "2026-09-06T10:00:00.000Z",
        createdAt: "2026-09-01T09:00:00.000Z",
        events: [],
      },
    ] as any);
    expect(items).toHaveLength(0);
  });

  it("does not ask Shaun to approve a staged SME first-touch", () => {
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
    expect(items).toHaveLength(0);
  });

  it("flags a dry hopper only during the weekday send window", () => {
    const dry = [
      {
        id: 8,
        companyName: "Hunt Ltd",
        stage: "ingest",
        status: "running",
        ownerUserId: "shaun",
        source: "distress_scan",
        stream: "sme",
        hopper: "hunt_contact",
        updatedAt: "2026-09-07T08:00:00.000Z",
        createdAt: "2026-09-07T08:00:00.000Z",
        events: [],
      },
    ] as any;
    const during = attentionFromHopper(dry, new Date("2026-09-07T08:00:00.000Z"));
    expect(during).toHaveLength(1);
    expect(during[0].task).toMatch(/harvest is dry/i);
    expect(during[0].to).toBe("/workforce");
    expect(attentionFromHopper(dry, new Date("2026-09-05T10:00:00.000Z"))).toHaveLength(0);
    expect(
      attentionFromHopper(
        [{ ...dry[0], hopper: "sendable", email: "ops@ready.co.uk" }],
        new Date("2026-09-07T08:00:00.000Z")
      )
    ).toHaveLength(0);
  });

  it("does not ask Shaun to inspect quarantined no-mailbox files", () => {
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
    expect(items).toHaveLength(0);
  });

  it("does not ask Shaun to work a hard bounce or a wrong-company mailbox", () => {
    const items = attentionFromDeals([
      {
        id: 6,
        companyName: "O-I Glass Limited",
        stage: "outreach",
        status: "waiting_human",
        ownerUserId: "shaun",
        source: "distress_scan",
        humanReason: "Bounce: hard bounce — address does not exist for steve.holden@o-i.com. Address suppressed.",
        updatedAt: "2026-09-06T08:15:00.000Z",
        createdAt: "2026-09-01T09:00:00.000Z",
        events: [],
      },
      {
        id: 7,
        companyName: "Manchester Precision Engineering Ltd",
        stage: "fulfilment",
        status: "waiting_human",
        ownerUserId: "shaun",
        source: "distress_scan",
        humanReason: "Will not send cold email: mailbox is not this company",
        updatedAt: "2026-09-02T07:22:00.000Z",
        createdAt: "2026-09-01T09:00:00.000Z",
        events: [],
      },
    ] as any);
    expect(items).toHaveLength(0);
  });

  it("does not treat an automatic reply as Shaun's thread", () => {
    const items = attentionFromDeals([
      {
        id: 8,
        companyName: "VAN WONDEREN FLOWERS LTD",
        stage: "fulfilment",
        status: "waiting_human",
        ownerUserId: "shaun",
        source: "distress_scan",
        humanReason: "They replied — you own the thread. Open Agent Mail.",
        updatedAt: "2026-09-10T08:04:00.000Z",
        createdAt: "2026-09-01T09:00:00.000Z",
        events: [
          {
            at: "2026-09-10T08:04:00.000Z",
            stage: "fulfilment",
            message: "Customer reply: Automatic reply: Restructuring VAN WONDEREN FLOWERS LTD",
          },
        ],
      },
    ] as any);
    expect(items).toHaveLength(0);
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
        id: "m-auto",
        direction: "inbound",
        deskKind: "responsive",
        from: "accounts@vwflowers.co.uk",
        subject: "Automatic reply: Restructuring VAN WONDEREN FLOWERS LTD",
        deskNote: "Customer reply — waiting on you",
        createdAt: "2026-09-10T08:04:00.000Z",
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
