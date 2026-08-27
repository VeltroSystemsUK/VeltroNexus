import { describe, expect, it } from "vitest";
import { FACTORY_EDGES, FACTORY_NODES, countDealsOnNodes, nodeForDeal } from "@shared/factoryGraph";

describe("factory graph", () => {
  it("is a connected process from origination to David", () => {
    const ids = new Set(FACTORY_NODES.map((node) => node.id));
    expect(ids.has("inbound")).toBe(true);
    expect(ids.has("hunt")).toBe(true);
    expect(ids.has("ingest")).toBe(true);
    expect(ids.has("credit")).toBe(true);
    expect(ids.has("david")).toBe(true);
    for (const edge of FACTORY_EDGES) {
      expect(ids.has(edge.source)).toBe(true);
      expect(ids.has(edge.target)).toBe(true);
    }
    expect(FACTORY_EDGES.some((edge) => edge.source === "credit" && edge.target === "sterling")).toBe(true);
  });

  it("puts live deals on the node that owns that stage", () => {
    const counts = countDealsOnNodes([
      { stage: "outreach", status: "waiting_timer", source: "distress_scan" },
      { stage: "human_review", status: "waiting_human", source: "strata_inbound", sfp: { status: "COMPLETE" } as any },
      { stage: "failed", status: "failed", source: "distress_scan" },
    ]);
    expect(counts.email).toBe(1);
    expect(counts.credit).toBe(1);
    expect(counts.parked).toBe(1);
    expect(nodeForDeal({ stage: "human_call", status: "waiting_human", source: "strata_inbound" })).toBe("call");
  });
});
