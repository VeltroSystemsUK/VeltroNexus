import { describe, expect, it } from "vitest";
import { compiledHasStopLine, outreachEligibility, pipelineAllowsTouch } from "@shared/slfOutreach";

const smeDeal = {
  stream: "sme" as const,
  stage: "outreach" as const,
  status: "waiting_timer" as const,
  email: "jane.ellis@acme.co.uk",
  companyName: "Acme Joinery Limited",
  companyNumber: "01234567",
  contactName: "Jane Ellis",
  directorNames: ["Jane Ellis"],
  hopper: "queued" as const,
};

describe("compiledHasStopLine", () => {
  it("requires STOP on cold email", () => {
    expect(compiledHasStopLine("Hi Jane, call me.")).toBe(false);
    expect(
      compiledHasStopLine("Hi Jane.\n\nIf this isn't useful, reply stop and we won't email again.")
    ).toBe(true);
  });
});

describe("pipelineAllowsTouch", () => {
  it("blocks SME templates on introducer files and the reverse", () => {
    expect(pipelineAllowsTouch("sme", "sme_1")).toBe(true);
    expect(pipelineAllowsTouch("sme", "intro_1")).toBe(false);
    expect(pipelineAllowsTouch("introducer", "intro_1")).toBe(true);
    expect(pipelineAllowsTouch("introducer", "sme_1")).toBe(false);
  });
});

describe("outreachEligibility", () => {
  it("allows a Stream A sendable director mailbox", () => {
    const result = outreachEligibility({
      deal: smeDeal,
      touchId: "sme_1",
      compiledText: "Hi Jane.\nIf this isn't useful, reply stop and we won't email again.",
    });
    expect(result.ok).toBe(true);
  });

  it("holds packaging / won / dnc", () => {
    expect(
      outreachEligibility({
        deal: { ...smeDeal, stage: "processing" },
        touchId: "sme_1",
        compiledText: "stop",
      }).reason
    ).toBe("book_status_blocks");
  });

  it("holds personal gmail", () => {
    expect(
      outreachEligibility({
        deal: { ...smeDeal, email: "jane@gmail.com" },
        touchId: "sme_1",
        compiledText: "If this isn't useful, reply stop and we won't email again.",
      }).reason
    ).toBe("pecr_individual");
  });

  it("holds a missing stop line on cold email", () => {
    expect(
      outreachEligibility({
        deal: smeDeal,
        touchId: "sme_1",
        compiledText: "Hi Jane, just bumping this.",
      }).reason
    ).toBe("no_stop_line");
  });

  it("holds Stream B without refer reachability", () => {
    expect(
      outreachEligibility({
        deal: {
          ...smeDeal,
          stream: "introducer",
          reachableCorporateContact: false,
        },
        touchId: "intro_1",
        compiledText: "If this isn't useful, reply stop and we won't email again.",
      }).reason
    ).toBe("refer_contact_missing");
  });

  it("holds wrong pipeline pack", () => {
    expect(
      outreachEligibility({
        deal: smeDeal,
        touchId: "intro_1",
        compiledText: "If this isn't useful, reply stop and we won't email again.",
      }).reason
    ).toBe("wrong_pipeline_pack");
  });

  it("does not apply Hunt cold-email rules to inbound ack", () => {
    const result = outreachEligibility({
      deal: { ...smeDeal, stream: "inbound", email: "dave@gmail.com", source: "strata_inbound" as never },
      touchId: "inbound_ack",
      compiledText: "Thanks for getting in touch.",
    });
    expect(result.ok).toBe(true);
  });

  it("does not require a stop line on LinkedIn stage", () => {
    const result = outreachEligibility({
      deal: smeDeal,
      touchId: "sme_linkedin",
      compiledText: "Profile review then connection request",
      channel: "linkedin",
    });
    expect(result.ok).toBe(true);
  });
});
