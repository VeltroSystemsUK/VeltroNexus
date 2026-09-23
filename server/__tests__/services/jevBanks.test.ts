import { describe, expect, it } from "vitest";
import { INBOUND_CONTACT_BANK, INBOUND_CONTACT_BANK_VERSION, questionsWithoutStakes } from "../../services/jevBanks";
import { noulCertainty, peakedness, routeFor } from "@shared/jevTriage";

describe("inbound.contact.v1 bank", () => {
  it("freezes version and the six question ids", () => {
    expect(INBOUND_CONTACT_BANK_VERSION).toBe("inbound.contact.v1");
    expect(Object.keys(INBOUND_CONTACT_BANK)).toEqual([
      "fit",
      "distress",
      "stacked_debt",
      "ready_to_talk",
      "regulated_risk",
      "queue",
    ]);
  });

  it("keeps stakes on the frozen bank and strips them for TypeSafe", () => {
    expect(INBOUND_CONTACT_BANK.fit.stakes).toBe("route");
    expect(INBOUND_CONTACT_BANK.distress.stakes).toBe("read");
    expect(INBOUND_CONTACT_BANK.stacked_debt.stakes).toBe("read");
    expect(INBOUND_CONTACT_BANK.ready_to_talk.stakes).toBe("write");
    expect(INBOUND_CONTACT_BANK.regulated_risk.stakes).toBe("irreversible");
    expect(INBOUND_CONTACT_BANK.queue.stakes).toBe("route");
    const sent = questionsWithoutStakes(INBOUND_CONTACT_BANK);
    expect(sent.fit).not.toHaveProperty("stakes");
    expect(sent.fit.type).toBe("choice");
    expect(sent.fit.instructions).toBe("What is the primary fit for this enquiry?");
    expect(sent.distress.criteria).toEqual([
      "Stable, shopping rates",
      "Stressed but trading",
      "Acute pressure — stacked cost, HMRC, or missed-payroll risk",
    ]);
  });

  it("does not ask Jev to compute payment-to-debt", () => {
    expect(JSON.stringify(INBOUND_CONTACT_BANK)).not.toMatch(/payment_to_debt/);
  });
});

describe("peakedness and routeFor", () => {
  it("is ~0 for a uniform 4-way choice", () => {
    expect(peakedness({ a: 0.25, b: 0.25, c: 0.25, d: 0.25 })).toBeCloseTo(0, 8);
  });

  it("is 1 when one option has all the mass", () => {
    expect(peakedness({ a: 1, b: 0, c: 0 })).toBeCloseTo(1, 8);
  });

  it("maps noul certainty and stakes thresholds", () => {
    expect(noulCertainty(0.5)).toBeCloseTo(0, 8);
    expect(noulCertainty(1)).toBeCloseTo(1, 8);
    expect(noulCertainty(0)).toBeCloseTo(1, 8);
    expect(routeFor(0.76, "route")).toBe("act");
    expect(routeFor(0.6, "route")).toBe("confirm");
    expect(routeFor(0.5, "route")).toBe("escalate");
    expect(routeFor(0.94, "irreversible")).toBe("confirm");
    expect(routeFor(0.95, "irreversible")).toBe("act");
  });
});
