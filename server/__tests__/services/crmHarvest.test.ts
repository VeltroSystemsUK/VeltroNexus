import { beforeEach, describe, expect, it, vi } from "vitest";
import { cacheCrmHarvestRanks, harvestCrmLeads, type CrmHarvestStore } from "../../services/crmHarvest";
import { SmeAttachRateLimitError } from "../../services/smeLeadHopper";

function memoryStore(): CrmHarvestStore & { rows: Map<number, { attempts: number; waitUntil?: string; directorNames?: string[] }> } {
  const rows = new Map<number, { attempts: number; waitUntil?: string; directorNames?: string[] }>();
  return {
    rows,
    read(id) {
      return rows.get(id) || { attempts: 0 };
    },
    write(id, row) {
      rows.set(id, row);
    },
  };
}

const blankLead = {
  id: 9,
  companyName: "Pet Shop Ltd",
  companyNumber: "1",
  contacts: [] as Array<{ name?: string; role?: string; email?: string }>,
};

function seedRank(store: ReturnType<typeof memoryStore>, id = 9) {
  store.write(id, { attempts: 0, harvestNow: true, smeBorrower: 3, skipClass: "ok_sme" });
}

describe("harvestCrmLeads", () => {
  let store: ReturnType<typeof memoryStore>;

  beforeEach(() => {
    store = memoryStore();
  });

  it("does not Firecrawl a lead until Jev (or the ranker) has scored it", async () => {
    const osint = vi.fn(async () => ({ emails: ["adam@petshop.co.uk"], website: "https://petshop.co.uk" }));
    const updateLead = vi.fn();
    await harvestCrmLeads({
      leads: [blankLead],
      deps: {
        officers: async () => ["Adam Taylor"],
        places: async () => null,
        firecrawl: async () => [],
        osint,
        mxValid: async () => true,
      },
      updateLead,
      store,
    });
    expect(osint).not.toHaveBeenCalled();
    expect(updateLead).not.toHaveBeenCalled();
  });

  it("stops the pass when Companies House returns 429", async () => {
    store.write(9, { attempts: 0, harvestNow: true, smeBorrower: 3, skipClass: "ok_sme" });
    store.write(10, { attempts: 0, harvestNow: true, smeBorrower: 3, skipClass: "ok_sme" });
    const officers = vi.fn(async () => {
      throw new SmeAttachRateLimitError();
    });
    const updateLead = vi.fn();
    const result = await harvestCrmLeads({
      leads: [
        { ...blankLead, id: 9, companyNumber: "1" },
        { ...blankLead, id: 10, companyName: "Other Ltd", companyNumber: "2" },
      ],
      deps: {
        officers,
        places: async () => null,
        firecrawl: async () => [],
        mxValid: async () => true,
      },
      updateLead,
      store,
    });
    expect(officers).toHaveBeenCalledTimes(1);
    expect(updateLead).not.toHaveBeenCalled();
    expect(result.attempted).toBe(1);
  });

  it("guesses a director mailbox from name and domain when the site has no mailto", async () => {
    seedRank(store);
    const updateLead = vi.fn(async (id: number, patch: Record<string, unknown>) => ({ ...blankLead, id, ...patch }));
    await harvestCrmLeads({
      leads: [blankLead],
      deps: {
        officers: async () => ["Adam Taylor"],
        places: async () => null,
        firecrawl: async () => [],
        osint: async () => ({ website: "https://petshop.co.uk", emails: [] }),
        mxValid: async () => true,
        smtpValid: async (email: string) => !/nx-no-box/.test(email),
        guessPaused: false,
      },
      updateLead,
      store,
    });
    expect(updateLead).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        email: "adam.taylor@petshop.co.uk",
        contacts: expect.arrayContaining([expect.objectContaining({ name: "Adam Taylor", role: "Director" })]),
      }),
    );
  });

  it("writes Harper's mailbox and directors onto a Clients lead without creating a hopper file", async () => {
    seedRank(store);
    const updateLead = vi.fn(async (id: number, patch: Record<string, unknown>) => ({ ...blankLead, id, ...patch }));
    const createDeal = vi.fn();
    const { updated } = await harvestCrmLeads({
      leads: [blankLead],
      deps: {
        officers: async () => ["Adam Taylor"],
        places: async () => null,
        firecrawl: async () => [],
        osint: async () => ({ emails: ["adam@petshop.co.uk"], website: "https://petshop.co.uk" }),
        mxValid: async () => true,
      },
      updateLead,
      createDeal,
      store,
    });
    expect(updated).toBe(1);
    expect(createDeal).not.toHaveBeenCalled();
    expect(updateLead).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        email: "adam@petshop.co.uk",
        contactName: "Adam Taylor",
        contacts: expect.arrayContaining([expect.objectContaining({ name: "Adam Taylor", role: "Director" })]),
      }),
    );
  });

  it("harvests an expensive MCA card before a high-street bank when the hourly cap is 1", async () => {
    store.write(1, { attempts: 0, harvestNow: true, smeBorrower: 2, skipClass: "ok_sme" });
    store.write(2, { attempts: 0, harvestNow: true, smeBorrower: 2, skipClass: "ok_sme" });
    const officers = vi.fn(async () => ["Ada Cole"]);
    await harvestCrmLeads({
      leads: [
        {
          id: 2,
          companyName: "Bank Shop Ltd",
          companyNumber: "2",
          identifiedLender: "Barclays Bank PLC",
          hasCharges: true,
          contacts: [],
        },
        {
          id: 1,
          companyName: "Hot Shop Ltd",
          companyNumber: "1",
          identifiedLender: "Iwoca Limited",
          hasCharges: true,
          contacts: [],
        },
      ],
      deps: {
        officers,
        places: async () => null,
        firecrawl: async () => [],
        osint: async () => ({ website: "https://hotshop.co.uk", emails: [] }),
        mxValid: async () => true,
        smtpValid: async (email: string) => !/nx-no-box/.test(email),
        guessPaused: false,
      },
      updateLead: vi.fn(),
      store,
      limit: 1,
    });
    expect(officers).toHaveBeenCalledTimes(1);
    expect(officers.mock.calls[0][0]).toBe("1");
  });

  it("skips do-not-contact and leads that already have a mailbox", async () => {
    const updateLead = vi.fn();
    await harvestCrmLeads({
      leads: [
        { ...blankLead, id: 1, doNotContact: true },
        { ...blankLead, id: 2, email: "ops@petshop.co.uk" },
      ],
      deps: {
        officers: async () => ["Adam Taylor"],
        places: async () => null,
        firecrawl: async () => [],
        osint: async () => ({ emails: ["adam@petshop.co.uk"], website: "https://petshop.co.uk" }),
        mxValid: async () => true,
      },
      updateLead,
      store,
    });
    expect(updateLead).not.toHaveBeenCalled();
  });

  it("hunts a director mailbox after a hard bounce instead of re-attaching the bounced address", async () => {
    seedRank(store);
    const updateLead = vi.fn(async (id: number, patch: Record<string, unknown>) => ({ ...blankLead, id, ...patch }));
    await harvestCrmLeads({
      leads: [{ ...blankLead, email: "gone@petshop.co.uk", bounced: true }],
      skipEmails: new Set(["gone@petshop.co.uk"]),
      deps: {
        officers: async () => ["Adam Taylor"],
        places: async () => null,
        firecrawl: async () => [],
        osint: async () => ({ emails: ["adam@petshop.co.uk"], website: "https://petshop.co.uk" }),
        mxValid: async () => true,
      },
      updateLead,
      store,
    });
    expect(updateLead).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        email: "gone@petshop.co.uk",
        contacts: expect.arrayContaining([expect.objectContaining({ email: "adam@petshop.co.uk" })]),
      }),
    );
  });

  it("stops after six misses", async () => {
    const updateLead = vi.fn();
    store.write(9, { attempts: 6 });
    await harvestCrmLeads({
      leads: [blankLead],
      deps: {
        officers: async () => ["Ada Lovelace"],
        places: async () => null,
        firecrawl: async () => [],
        mxValid: async () => false,
      },
      updateLead,
      store,
    });
    expect(updateLead).not.toHaveBeenCalled();
  });

  it("harvests a charged SME before a diocesan board and does not scrape the skip", async () => {
    seedRank(store, 2);
    const osint = vi.fn(async (name: string) => ({
      emails: name.includes("Pet") ? ["adam@petshop.co.uk"] : ["x@diocesan.org"],
      website: "https://petshop.co.uk",
    }));
    const updateLead = vi.fn(async (id: number, patch: Record<string, unknown>) => ({ id, ...patch }));
    await harvestCrmLeads({
      leads: [
        { id: 1, companyName: "CHESTER DIOCESAN BOARD OF FINANCE", companyNumber: "00007826", contacts: [] },
        { id: 2, companyName: "Pet Shop Ltd", companyNumber: "1", hasCharges: true, contacts: [] },
      ],
      deps: {
        officers: async () => ["Adam Taylor"],
        places: async () => null,
        firecrawl: async () => [],
        osint,
        mxValid: async () => true,
      },
      updateLead,
      store,
      limit: 1,
    });
    expect(osint).toHaveBeenCalledTimes(1);
    expect(osint).toHaveBeenCalledWith("Pet Shop Ltd", undefined);
    expect(updateLead).toHaveBeenCalledTimes(1);
    expect(updateLead).toHaveBeenCalledWith(2, expect.objectContaining({ email: "adam@petshop.co.uk" }));
    expect(store.read(1).skipClass).toBe("charity_public");
  });

  it("calls Jev once for an ambiguous SME and reuses the cached rank", async () => {
    const rank = vi.fn(async () => ({ harvestNow: true, smeBorrower: 3, skipClass: "ok_sme" as const }));
    const updateLead = vi.fn(async (id: number, patch: Record<string, unknown>) => ({ id, ...patch }));
    const deps = {
      officers: async () => ["Adam Taylor"],
      places: async () => null,
      firecrawl: async () => [],
      osint: async () => ({ emails: ["adam@petshop.co.uk"], website: "https://petshop.co.uk" }),
      mxValid: async () => true,
    };
    await harvestCrmLeads({
      leads: [blankLead],
      deps,
      rank,
      updateLead,
      store,
    });
    await harvestCrmLeads({
      leads: [{ ...blankLead, email: undefined, contacts: [] }],
      deps,
      rank,
      updateLead,
      store,
    });
    expect(rank).toHaveBeenCalledTimes(1);
  });

  it("harvests with a synthetic rank if Jev never returns", async () => {
    // inline rank is test-only; live Harper does not call TypeSafe
    const rank = vi.fn(() => new Promise(() => {}));
    const updateLead = vi.fn(async (id: number, patch: Record<string, unknown>) => ({ id, ...patch }));
    const started = Date.now();
    await harvestCrmLeads({
      leads: [blankLead],
      deps: {
        officers: async () => ["Adam Taylor"],
        places: async () => null,
        firecrawl: async () => [],
        osint: async () => ({ emails: ["adam@petshop.co.uk"], website: "https://petshop.co.uk" }),
        mxValid: async () => true,
      },
      rank,
      rankTimeoutMs: 40,
      updateLead,
      store,
    });
    expect(Date.now() - started).toBeLessThan(1500);
    expect(updateLead).toHaveBeenCalledWith(9, expect.objectContaining({ email: "adam@petshop.co.uk" }));
  });
});

describe("cacheCrmHarvestRanks", () => {
  it("codes-skips a diocesan board and only calls Jev for a trading SME", async () => {
    const store = memoryStore();
    const rank = vi.fn(async () => ({ harvestNow: true, smeBorrower: 3, skipClass: "ok_sme" as const }));
    const out = await cacheCrmHarvestRanks({
      leads: [
        { id: 1, companyName: "CHESTER DIOCESAN BOARD OF FINANCE", companyNumber: "00007826", contacts: [] },
        { id: 10, companyName: "Old Joinery Ltd", companyNumber: "2", contacts: [] },
        { id: 2, companyName: "Pet Shop Ltd", companyNumber: "1", hasCharges: true, contacts: [] },
      ],
      store,
      rank,
    });
    expect(out.obvious).toBe(1);
    expect(out.jev).toBe(2);
    expect(rank.mock.calls.map((call) => call[0].id)).toEqual([10, 2]);
    expect(store.read(1).skipClass).toBe("charity_public");
    expect(store.read(2).skipClass).toBe("ok_sme");
  });
});
