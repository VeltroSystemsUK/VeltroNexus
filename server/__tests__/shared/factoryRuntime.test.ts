import { describe, expect, it } from "vitest";
import {
  cadenceRetryIndex,
  introducerPipelineStatus,
  packMissingDisposition,
  shouldReprocessPack,
  tickKindForDeal,
} from "@shared/agenticWorkflow";

describe("tickKindForDeal", () => {
  it("retries introducer contact instead of starting James's email cadence", () => {
    expect(
      tickKindForDeal({
        stage: "outreach",
        status: "waiting_timer",
        source: "distress_scan",
        stream: "introducer",
      })
    ).toBe("introducer_retry");
    expect(
      tickKindForDeal({
        stage: "outreach",
        status: "waiting_timer",
        source: "distress_scan",
        stream: "sme",
      })
    ).toBe("outreach_retry");
    expect(
      tickKindForDeal({
        stage: "fulfilment",
        status: "waiting_timer",
        source: "strata_inbound",
      })
    ).toBe("fulfilment");
  });
});

describe("cadenceRetryIndex", () => {
  it("retries the failed touch, not day-1", () => {
    expect(cadenceRetryIndex(undefined)).toBe(0);
    expect(cadenceRetryIndex(0)).toBe(0);
    expect(cadenceRetryIndex(2)).toBe(2);
  });
});

describe("packMissingDisposition", () => {
  it("never parks inbound or a PARTIAL pack — those stay in chase", () => {
    expect(packMissingDisposition({ source: "strata_inbound" })).toBe("keep_chasing");
    expect(packMissingDisposition({ source: "distress_scan", sfp: { status: "PARTIAL" } as any })).toBe(
      "keep_chasing"
    );
    expect(packMissingDisposition({ source: "distress_scan", stream: "introducer" })).toBe(
      "approve_introducer"
    );
    expect(packMissingDisposition({ source: "distress_scan", stream: "sme" })).toBe("wait_human");
  });
});

describe("shouldReprocessPack", () => {
  it("re-ingests only when new files arrived, so PARTIAL does not loop", () => {
    expect(shouldReprocessPack({ packDocuments: [{}, {}], extraDocCount: 0 })).toBe(true);
    expect(
      shouldReprocessPack({
        packDocuments: [{}, {}],
        extraDocCount: 0,
        sfp: { status: "PARTIAL", documents: [{}, {}] },
      })
    ).toBe(false);
    expect(
      shouldReprocessPack({
        packDocuments: [{}, {}, {}],
        extraDocCount: 0,
        sfp: { status: "PARTIAL", documents: [{}, {}] },
      })
    ).toBe(true);
  });
});

describe("introducerPipelineStatus", () => {
  it("is Identified until a send, Contacted once James has emailed, Approved when the cadence is done", () => {
    expect(introducerPipelineStatus({ hasContact: false })).toBe("none");
    expect(introducerPipelineStatus({ hasContact: true, outreachTouch: 0 })).toBe("new");
    expect(introducerPipelineStatus({ hasContact: true, outreachTouch: 1 })).toBe("contacted");
    expect(
      introducerPipelineStatus({ hasContact: true, outreachTouch: 1, stage: "complete" })
    ).toBe("approved");
    expect(
      introducerPipelineStatus({ hasContact: true, outreachTouch: 3, stage: "human_call", callDone: true })
    ).toBe("approved");
  });
});
