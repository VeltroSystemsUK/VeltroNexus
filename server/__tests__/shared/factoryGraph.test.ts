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
    expect(FACTORY_EDGES.some((edge) => edge.source === "credit" && edge.target === "engagement")).toBe(true);
    expect(FACTORY_EDGES.some((edge) => edge.source === "engagement" && edge.target === "sterling")).toBe(true);
  });

  it("plots the Editorial lane from Casey through Isla to Shaun", () => {
    const ids = new Set(FACTORY_NODES.map((node) => node.id));
    for (const id of [
      "mkt-editorial-scan",
      "mkt-editorial-compose",
      "mkt-editorial-approve",
      "mkt-editorial-compliance",
      "mkt-editorial-export",
      "mkt-post",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
    expect(FACTORY_NODES.find((node) => node.id === "mkt-editorial-scan")?.desk).toBe("Casey");
    expect(FACTORY_NODES.find((node) => node.id === "mkt-editorial-compose")?.desk).toBe("Isla");
    expect(FACTORY_EDGES.some((edge) => edge.source === "mkt-editorial-scan" && edge.target === "mkt-editorial-compose")).toBe(true);
    expect(FACTORY_EDGES.some((edge) => edge.source === "mkt-editorial-compose" && edge.target === "mkt-editorial-approve")).toBe(true);
    expect(FACTORY_EDGES.some((edge) => edge.source === "mkt-editorial-approve" && edge.target === "mkt-editorial-compliance")).toBe(true);
    expect(FACTORY_EDGES.some((edge) => edge.source === "mkt-editorial-compliance" && edge.target === "mkt-editorial-export")).toBe(true);
    expect(FACTORY_EDGES.some((edge) => edge.source === "mkt-editorial-export" && edge.target === "mkt-post")).toBe(true);
  });

  it("plots the Craft marketing lane from Casey and Kit through Isla to Shaun", () => {
    const ids = new Set(FACTORY_NODES.map((node) => node.id));
    for (const id of [
      "mkt-scan",
      "mkt-hunt",
      "mkt-compose",
      "mkt-email",
      "mkt-approve",
      "mkt-compliance",
      "mkt-export",
      "mkt-post",
      "mkt-send",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
    expect(FACTORY_NODES.find((node) => node.id === "mkt-scan")?.desk).toBe("Casey");
    expect(FACTORY_NODES.find((node) => node.id === "mkt-hunt")?.desk).toBe("Kit");
    expect(FACTORY_NODES.find((node) => node.id === "mkt-compose")?.desk).toBe("Isla");
    expect(FACTORY_EDGES.some((edge) => edge.source === "mkt-scan" && edge.target === "mkt-compose")).toBe(true);
    expect(FACTORY_EDGES.some((edge) => edge.source === "mkt-hunt" && edge.target === "mkt-compose")).toBe(true);
    expect(FACTORY_EDGES.some((edge) => edge.source === "mkt-approve" && edge.target === "mkt-compliance")).toBe(true);
    expect(FACTORY_EDGES.some((edge) => edge.source === "mkt-compliance" && edge.target === "mkt-export")).toBe(true);
    expect(
      nodeForDeal({ stage: "outreach", status: "waiting_timer", source: "distress_scan" }),
    ).not.toMatch(/^mkt-/);
  });

  it("plots sme_open and sme_followup off Cadence email", () => {
    const ids = new Set(FACTORY_NODES.map((node) => node.id));
    expect(ids.has("sme-open")).toBe(true);
    expect(ids.has("explore-gate")).toBe(true);
    expect(ids.has("sme-followup")).toBe(true);
    expect(FACTORY_NODES.find((node) => node.id === "sme-open")?.desk).toBe("James");
    expect(FACTORY_NODES.find((node) => node.id === "sme-followup")?.desk).toBe("James");
    expect(FACTORY_EDGES.some((edge) => edge.source === "email" && edge.target === "sme-open")).toBe(true);
    expect(FACTORY_EDGES.some((edge) => edge.source === "sme-open" && edge.target === "explore-gate")).toBe(true);
    expect(FACTORY_EDGES.some((edge) => edge.source === "explore-gate" && edge.target === "sme-followup")).toBe(true);
    expect(FACTORY_EDGES.some((edge) => edge.source === "explore-gate" && edge.target === "inbound")).toBe(true);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(
      nodeForDeal({
        stage: "outreach",
        status: "waiting_timer",
        source: "distress_scan",
        smeOpenFollowUpSentAt: oneHourAgo,
      })
    ).toBe("sme-open");
    expect(
      nodeForDeal({
        stage: "outreach",
        status: "waiting_timer",
        source: "distress_scan",
        smeOpenFollowUpSentAt: twoDaysAgo,
      })
    ).toBe("sme-followup");
    expect(
      nodeForDeal({
        stage: "outreach",
        status: "waiting_timer",
        source: "distress_scan",
        smeOpenFollowUpSentAt: twoDaysAgo,
        smeFollowupSentAt: oneHourAgo,
      })
    ).toBe("email");
  });

  it("plots Reporter's news digest into the Editorial approve step, and Frankie's SOCIAL-1 lane to a human write step", () => {
    const ids = new Set(FACTORY_NODES.map((node) => node.id));
    for (const id of ["news-scan", "social-scan", "social-draft", "social-post"]) {
      expect(ids.has(id)).toBe(true);
    }
    expect(FACTORY_NODES.find((node) => node.id === "news-scan")?.desk).toBe("Reporter");
    expect(FACTORY_NODES.find((node) => node.id === "social-scan")?.desk).toBe("Frankie");
    expect(FACTORY_NODES.find((node) => node.id === "social-post")?.desk).toBe("You");
    expect(FACTORY_EDGES.some((edge) => edge.source === "news-scan" && edge.target === "mkt-editorial-approve")).toBe(true);
    expect(FACTORY_EDGES.some((edge) => edge.source === "social-scan" && edge.target === "social-draft")).toBe(true);
    expect(FACTORY_EDGES.some((edge) => edge.source === "social-draft" && edge.target === "social-post")).toBe(true);
  });

  it("plots Isla's brand governance and lead-gen lane, handing standards to Frankie's feed", () => {
    const ids = new Set(FACTORY_NODES.map((node) => node.id));
    for (const id of ["brand-review", "brand-system", "lead-magnet"]) {
      expect(ids.has(id)).toBe(true);
      expect(FACTORY_NODES.find((node) => node.id === id)?.desk).toBe("Isla");
    }
    expect(FACTORY_EDGES.some((edge) => edge.source === "brand-review" && edge.target === "brand-system")).toBe(true);
    expect(FACTORY_EDGES.some((edge) => edge.source === "brand-system" && edge.target === "mkt-compose")).toBe(true);
    expect(FACTORY_EDGES.some((edge) => edge.source === "brand-system" && edge.target === "social-draft")).toBe(true);
    expect(FACTORY_EDGES.some((edge) => edge.source === "lead-magnet" && edge.target === "mkt-approve")).toBe(true);
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

  it("keeps introducers on their own three nodes and never on the SME chain", () => {
    expect(
      nodeForDeal({
        stage: "ingest",
        status: "running",
        source: "distress_scan",
        stream: "introducer",
      })
    ).toBe("hunt-introducer");
    expect(
      nodeForDeal({
        stage: "outreach",
        status: "waiting_timer",
        source: "distress_scan",
        stream: "introducer",
      })
    ).toBe("introducer-contact");
    expect(
      nodeForDeal({
        stage: "outreach",
        status: "waiting_timer",
        source: "distress_scan",
        stream: "introducer",
        email: "partner@hartleyaccountants.co.uk",
      })
    ).toBe("introducer-pipeline");
    expect(
      nodeForDeal({
        stage: "fulfilment",
        status: "waiting_timer",
        source: "distress_scan",
        stream: "introducer",
        email: "partner@hartleyaccountants.co.uk",
      })
    ).toBe("introducer-pipeline");
    expect(
      nodeForDeal({
        stage: "complete",
        status: "complete",
        source: "distress_scan",
        stream: "introducer",
        email: "partner@hartleyaccountants.co.uk",
      })
    ).toBe("introducer-pipeline");
  });

  it("sits inbound packs, PECR holds, SFP complete, and David on the nodes that own them", () => {
    expect(
      nodeForDeal({
        stage: "fulfilment",
        status: "waiting_timer",
        source: "strata_inbound",
      })
    ).toBe("pack");
    expect(
      nodeForDeal({
        stage: "fulfilment",
        status: "waiting_human",
        source: "strata_inbound",
        sfp: { status: "PARTIAL" } as any,
      })
    ).toBe("partial");
    expect(
      nodeForDeal({
        stage: "outreach",
        status: "waiting_human",
        source: "distress_scan",
        humanReason: "Will not send cold email: personal mailbox — PECR",
      })
    ).toBe("pecr");
    expect(
      nodeForDeal({
        stage: "outreach",
        status: "waiting_human",
        source: "distress_scan",
        humanReason: "Email did not send (SMTP missing or failed). Retry when mail is live.",
      })
    ).toBe("smtp-hold");
    expect(
      nodeForDeal({
        stage: "underwriting",
        status: "running",
        source: "strata_inbound",
        sfp: { status: "COMPLETE" } as any,
      })
    ).toBe("complete");
    expect(
      nodeForDeal({
        stage: "complete",
        status: "complete",
        source: "strata_inbound",
        sterlingHandoffId: 9,
      })
    ).toBe("david");
    expect(
      nodeForDeal({
        stage: "failed",
        status: "failed",
        source: "distress_scan",
        humanReason: "Not emailed — fit 40/70. SIG-06 out",
      })
    ).toBe("reject");
  });
});
