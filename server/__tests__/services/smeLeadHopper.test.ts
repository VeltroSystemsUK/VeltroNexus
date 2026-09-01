import { describe, expect, it, vi } from "vitest";
import {
  ATTACH_FIRECRAWL_PATHS,
  GATED_SME_HUNT_HOLD,
  attachOne,
  firecrawlTargetUrls,
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

  it("rejects missing incorporation date so young shops cannot sneak in", () => {
    const result = shouldEnterSmeHunt({
      companyName: "Newco Limited",
      companyNumber: "09999999",
      companyStatus: "active",
      sicCodes: ["16230"],
      hasPetition: true,
      charges: [],
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
    expect(dealPatch.stage).toBe("outreach");
    expect(dealPatch.status).toBe("waiting_timer");
    expect(dealPatch.email).toBe("adam@petshop.co.uk");
    expect(dealPatch.contactSource).toBe("places");
  });

  it("still runs Places when stored email is not sendable", async () => {
    const places = vi.fn(async () => ({ email: "adam@petshop.co.uk" }));
    const { dealPatch } = await attachOne(
      {
        attachAttempts: 0,
        hopper: "gated",
        companyName: "X Ltd",
        companyNumber: "1",
        directorNames: ["Adam Taylor"],
        email: "info@petshop.co.uk",
      } as any,
      {
        officers: async () => ["Adam Taylor"],
        places,
        firecrawl: async () => [],
        mxValid: async () => true,
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(places).toHaveBeenCalled();
    expect(dealPatch.hopper).toBe("sendable");
    expect(dealPatch.email).toBe("adam@petshop.co.uk");
    expect(dealPatch.contactSource).toBe("places");
  });

  it("does not match Ann local-part to director Joanna", async () => {
    const { dealPatch } = await attachOne(
      { attachAttempts: 0, hopper: "gated", companyName: "X Ltd", companyNumber: "1" } as any,
      {
        officers: async () => ["Joanna Smith"],
        places: async () => ({ email: "ann@petshop.co.uk" }),
        firecrawl: async () => [],
        mxValid: async () => true,
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(dealPatch.hopper).not.toBe("sendable");
  });

  it("refuses a mailbox already on an inbound deal", async () => {
    const { dealPatch } = await attachOne(
      { attachAttempts: 0, hopper: "gated", companyName: "X Ltd", companyNumber: "1" } as any,
      {
        officers: async () => ["Adam Taylor"],
        places: async () => ({ email: "adam@petshop.co.uk" }),
        firecrawl: async () => [],
        mxValid: async () => true,
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 },
      new Date(),
      new Set(["adam@petshop.co.uk"])
    );
    expect(dealPatch.hopper).not.toBe("sendable");
    expect(dealPatch.email).not.toBe("adam@petshop.co.uk");
  });

  it("does not mark ops@ sendable just because officers include a director", async () => {
    const { dealPatch } = await attachOne(
      { attachAttempts: 0, hopper: "gated", companyName: "X Ltd", companyNumber: "1" } as any,
      {
        officers: async () => ["Adam Taylor"],
        places: async () => ({ email: "ops@petshop.co.uk", website: "https://petshop.co.uk" }),
        firecrawl: async () => ["finance@petshop.co.uk"],
        mxValid: async () => true,
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(dealPatch.hopper).not.toBe("sendable");
    expect(dealPatch.email).not.toBe("ops@petshop.co.uk");
    expect(dealPatch.email).not.toBe("finance@petshop.co.uk");
  });

  it("keeps stored directorNames when officers fetch is empty", async () => {
    const { dealPatch } = await attachOne(
      {
        attachAttempts: 0,
        hopper: "gated",
        companyName: "X Ltd",
        companyNumber: "1",
        directorNames: ["Adam Taylor"],
        email: "adam@petshop.co.uk",
      } as any,
      {
        officers: async () => [],
        places: async () => null,
        firecrawl: async () => [],
        mxValid: async () => true,
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(dealPatch.directorNames).toEqual(["Adam Taylor"]);
    expect(dealPatch.hopper).toBe("sendable");
    expect(dealPatch.stage).toBe("outreach");
    expect(dealPatch.status).toBe("waiting_timer");
    expect(dealPatch.email).toBe("adam@petshop.co.uk");
  });

  it("targets /, /contact, /about, /team for Firecrawl", () => {
    expect(ATTACH_FIRECRAWL_PATHS).toEqual(["/", "/contact", "/about", "/team"]);
    expect(firecrawlTargetUrls("https://petshop.co.uk")).toEqual([
      "https://petshop.co.uk/",
      "https://petshop.co.uk/contact",
      "https://petshop.co.uk/about",
      "https://petshop.co.uk/team",
    ]);
  });

  it("skips attach when Places and Firecrawl budgets cannot produce an email", async () => {
    const places = vi.fn();
    const officers = vi.fn(async () => ["Adam Taylor"]);
    const firecrawl = vi.fn();
    const { patches } = await refillSendableHopper({
      deals: [
        {
          id: 1,
          source: "distress_scan" as const,
          hopper: "gated" as const,
          companyName: "X Ltd",
          companyNumber: "1",
          ownerUserId: "u",
          stage: "ingest" as const,
          status: "waiting_timer" as const,
          events: [],
          createdAt: "",
          updatedAt: "",
        },
      ] as any,
      deps: { officers, places, firecrawl, mxValid: async () => true },
      budget: { ch: 10, places: 0, firecrawl: 0, smtp: 10 },
    });
    expect(patches).toEqual([]);
    expect(officers).not.toHaveBeenCalled();
    expect(places).not.toHaveBeenCalled();
    expect(firecrawl).not.toHaveBeenCalled();
  });

  it("still firecrawls when Places budget is 0 but a website is known", async () => {
    const places = vi.fn();
    const firecrawl = vi.fn(async () => ["adam@petshop.co.uk"]);
    const { patches } = await refillSendableHopper({
      deals: [
        {
          id: 1,
          source: "distress_scan" as const,
          hopper: "gated" as const,
          companyName: "X Ltd",
          companyNumber: "1",
          website: "https://petshop.co.uk",
          ownerUserId: "u",
          stage: "ingest" as const,
          status: "waiting_timer" as const,
          events: [],
          createdAt: "",
          updatedAt: "",
        },
      ] as any,
      deps: {
        officers: async () => ["Adam Taylor"],
        places,
        firecrawl,
        mxValid: async () => true,
      },
      budget: { ch: 10, places: 0, firecrawl: 10, smtp: 10 },
    });
    expect(places).not.toHaveBeenCalled();
    expect(firecrawl).toHaveBeenCalledWith("https://petshop.co.uk");
    expect(patches).toHaveLength(1);
    expect(patches[0].patch.hopper).toBe("sendable");
    expect(patches[0].patch.stage).toBe("outreach");
    expect(patches[0].patch.contactSource).toBe("firecrawl");
  });

  it("shares one Places budget across refill candidates", async () => {
    const places = vi.fn(async () => ({ email: "adam@petshop.co.uk" }));
    const base = {
      source: "distress_scan" as const,
      hopper: "gated" as const,
      ownerUserId: "u",
      stage: "ingest" as const,
      status: "waiting_timer" as const,
      events: [],
      createdAt: "",
      updatedAt: "",
    };
    const { patches } = await refillSendableHopper({
      deals: [
        { ...base, id: 1, companyName: "A Ltd", companyNumber: "1" },
        { ...base, id: 2, companyName: "B Ltd", companyNumber: "2" },
      ] as any,
      deps: {
        officers: async () => ["Adam Taylor"],
        places,
        firecrawl: async () => [],
        mxValid: async () => true,
      },
      budget: { ch: 10, places: 1, firecrawl: 0, smtp: 10 },
    });
    expect(places).toHaveBeenCalledTimes(1);
    expect(patches.filter((row) => row.patch.hopper === "sendable")).toHaveLength(1);
  });

  it("does not mark sendable an email already on an inbound file", async () => {
    const { patches } = await refillSendableHopper({
      deals: [
        {
          id: 1,
          source: "strata_inbound" as const,
          companyName: "Inbound Ltd",
          email: "adam@petshop.co.uk",
          ownerUserId: "u",
          stage: "ingest" as const,
          status: "waiting_timer" as const,
          events: [],
          createdAt: "",
          updatedAt: "",
        },
        {
          id: 2,
          source: "distress_scan" as const,
          hopper: "gated" as const,
          companyName: "X Ltd",
          companyNumber: "1",
          ownerUserId: "u",
          stage: "ingest" as const,
          status: "waiting_timer" as const,
          events: [],
          createdAt: "",
          updatedAt: "",
        },
      ] as any,
      deps: {
        officers: async () => ["Adam Taylor"],
        places: async () => ({ email: "adam@petshop.co.uk" }),
        firecrawl: async () => [],
        mxValid: async () => true,
      },
    });
    expect(patches).toHaveLength(1);
    expect(patches[0].id).toBe(2);
    expect(patches[0].patch.hopper).not.toBe("sendable");
  });
});
