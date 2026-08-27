import { describe, expect, it } from "vitest";
import { attentionFromDeals } from "@shared/attention";

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
