import { describe, expect, it, vi } from "vitest";
import {
  GATED_SME_HUNT_HOLD,
  attachOne,
  isExcludedFromSmeHunt,
  refillSendableHopper,
  shouldEnterSmeHunt,
  shouldSendOutreachAfterSmeHunt,
} from "../../services/smeLeadHopper";

describe("SME hunt gate", () => {
  it("accepts a 13-month-old ltd with one live Iwoca charge", () => {
    const created = new Date();
    created.setMonth(created.getMonth() - 13);
    const result = shouldEnterSmeHunt({
      companyName: "Acme Joinery Limited",
      companyNumber: "01234567",
      companyStatus: "active",
      dateOfCreation: created.toISOString().slice(0, 10),
      sicCodes: ["16230"],
      charges: [{ status: "outstanding", personsEntitled: ["IWOCA LIMITED"] }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.liveNonBankChargeCount).toBe(1);
  });

  it("rejects a high-street-bank-only charge book", () => {
    const result = shouldEnterSmeHunt({
      companyName: "Acme Joinery Limited",
      companyNumber: "01234567",
      companyStatus: "active",
      dateOfCreation: "2018-01-01",
      sicCodes: ["16230"],
      charges: [{ status: "outstanding", personsEntitled: ["HSBC BANK PLC"] }],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects companies younger than 12 months even with a petition", () => {
    const created = new Date();
    created.setMonth(created.getMonth() - 6);
    const result = shouldEnterSmeHunt({
      companyName: "Newco Limited",
      companyNumber: "09999999",
      companyStatus: "active",
      dateOfCreation: created.toISOString().slice(0, 10),
      sicCodes: ["16230"],
      hasPetition: true,
      charges: [],
    });
    expect(result.ok).toBe(false);
  });

  it("excludes inbound company numbers and emails", () => {
    expect(
      isExcludedFromSmeHunt(
        { source: "distress_scan", companyNumber: "01234567", email: "a@b.co.uk" },
        new Set(),
        new Set(["01234567"]),
        new Set()
      )
    ).toBe(true);
  });

  it("holds gated P0s in the waiting room instead of sending", () => {
    expect(GATED_SME_HUNT_HOLD).toEqual({ hopper: "gated", stage: "ingest", status: "waiting_timer" });
    expect(shouldSendOutreachAfterSmeHunt({ hopper: "gated", source: "distress_scan" })).toBe(false);
    expect(shouldSendOutreachAfterSmeHunt({ hopper: "sendable", source: "distress_scan" })).toBe(true);
    expect(shouldSendOutreachAfterSmeHunt({ source: "strata_inbound" })).toBe(true);
  });
});

describe("SME attach waterfall", () => {
  it("does not call Places when hopper is already at 250 sendable", async () => {
    const places = vi.fn();
    const deals = Array.from({ length: 250 }, (_, i) => ({
      id: i + 1,
      source: "distress_scan" as const,
      stream: "sme" as const,
      hopper: "sendable" as const,
      companyName: `Co ${i}`,
      ownerUserId: "u",
      stage: "outreach" as const,
      status: "waiting_timer" as const,
      events: [],
      createdAt: "",
      updatedAt: "",
    }));
    const { patches } = await refillSendableHopper({
      deals: deals as any,
      deps: { officers: async () => [], places, firecrawl: async () => [], mxValid: async () => false },
    });
    expect(patches).toEqual([]);
    expect(places).not.toHaveBeenCalled();
  });

  it("parks on the 5th failed attach", async () => {
    const { dealPatch } = await attachOne(
      { attachAttempts: 4, hopper: "hunt_contact", companyName: "X Ltd", companyNumber: "1" } as any,
      { officers: async () => ["Ada Lovelace"], places: async () => null, firecrawl: async () => [], mxValid: async () => false },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(dealPatch.hopper).toBe("parked");
    expect(dealPatch.attachAttempts).toBe(5);
  });

  it("marks sendable when director mailbox passes MX", async () => {
    const { dealPatch } = await attachOne(
      { attachAttempts: 0, hopper: "gated", companyName: "X Ltd", companyNumber: "1" } as any,
      {
        officers: async () => ["Adam Taylor"],
        places: async () => ({ email: "adam@petshop.co.uk" }),
        firecrawl: async () => [],
        mxValid: async () => true,
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(dealPatch.hopper).toBe("sendable");
    expect(dealPatch.email).toBe("adam@petshop.co.uk");
    expect(dealPatch.contactSource).toBe("places");
  });
});
