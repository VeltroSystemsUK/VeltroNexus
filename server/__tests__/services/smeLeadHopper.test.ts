import { describe, expect, it, vi } from "vitest";
import { SME_ATTACH_ATTEMPT_CAP } from "@shared/smeHopper";
import {
  ATTACH_FIRECRAWL_PATHS,
  GATED_SME_HUNT_HOLD,
  HARVEST_FLUSH_EVERY,
  HARVEST_PER_HOUR,
  HARVEST_RETRY_MS,
  attachOne,
  collectPageEmails,
  firecrawlTargetUrls,
  isExcludedFromSmeHunt,
  isHarvestCandidate,
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
    expect(shouldSendOutreachAfterSmeHunt({ hopper: "quarantine", source: "distress_scan" })).toBe(false);
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

  it("quarantines when attach finds no mailbox", async () => {
    const { dealPatch } = await attachOne(
      { attachAttempts: 0, hopper: "hunt_contact", companyName: "Pet Shop Ltd", companyNumber: "1" } as any,
      { officers: async () => ["Ada Lovelace"], places: async () => null, firecrawl: async () => [], mxValid: async () => false },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(dealPatch.hopper).toBe("quarantine");
    expect(dealPatch.status).toBe("waiting_human");
    expect(dealPatch.humanReason).toMatch(/no corporate mailbox/i);
  });

  it("marks sendable when director mailbox passes MX", async () => {
    const { dealPatch } = await attachOne(
      { attachAttempts: 0, hopper: "gated", companyName: "Pet Shop Ltd", companyNumber: "1" } as any,
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
    expect(dealPatch.mailboxGrade).toBe("director");
  });

  it("attaches email@ from contact-page markdown, not a newline-corrupted nemail@", async () => {
    const { dealPatch } = await attachOne(
      {
        attachAttempts: 0,
        hopper: "quarantine",
        companyName: "Heritage Trimmings Ltd",
        companyNumber: "1",
        website: "https://www.heritagetrimmings.co.uk",
        directorNames: ["Jacob Frank TAEE"],
      } as any,
      {
        officers: async () => [],
        places: async () => null,
        firecrawl: async () => ["email@heritagetrimmings.co.uk"],
        mxValid: async () => true,
        smtpValid: async () => false,
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(dealPatch.email).toBe("email@heritagetrimmings.co.uk");
    expect(dealPatch.hopper).toBe("sendable");
  });

  it("ignores a nursery directory URL and still uses Places for the real site", async () => {
    const places = vi.fn(async () => ({ website: "https://www.alphabethouse.co.uk" }));
    const firecrawl = vi.fn(async () => ["info@alphabethouse.co.uk"]);
    const { dealPatch } = await attachOne(
      {
        attachAttempts: 0,
        hopper: "quarantine",
        companyName: "Alphabet House Day Nurseries Limited",
        companyNumber: "1",
        website: "https://www.daynurseries.co.uk/daynursery.cfm/searchazref/50003020ALPD",
        directorNames: ["Anne-Marie TIERNEY"],
      } as any,
      {
        officers: async () => [],
        places,
        firecrawl,
        mxValid: async () => true,
        smtpValid: async () => false,
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(places).toHaveBeenCalled();
    expect(firecrawl).toHaveBeenCalledWith("https://www.alphabethouse.co.uk");
    expect(dealPatch.email).toBe("info@alphabethouse.co.uk");
    expect(dealPatch.website).toBe("https://www.alphabethouse.co.uk");
  });

  it("attaches a scraped company mailbox on MX even when SMTP handshake fails", async () => {
    const { dealPatch } = await attachOne(
      {
        attachAttempts: 0,
        hopper: "quarantine",
        companyName: "Pet Shop Ltd",
        companyNumber: "1",
        website: "https://petshop.co.uk",
        directorNames: ["Adam Taylor"],
      } as any,
      {
        officers: async () => [],
        places: async () => null,
        firecrawl: async () => ["info@petshop.co.uk"],
        mxValid: async () => true,
        smtpValid: async () => false,
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(dealPatch.hopper).toBe("sendable");
    expect(dealPatch.email).toBe("info@petshop.co.uk");
    expect(dealPatch.contactSource).toBe("firecrawl");
  });

  it("falls back to a role mailbox when no director inbox exists", async () => {
    const { dealPatch } = await attachOne(
      { attachAttempts: 0, hopper: "gated", companyName: "Pet Shop Ltd", companyNumber: "1" } as any,
      {
        officers: async () => ["Adam Taylor"],
        places: async () => ({ email: "info@petshop.co.uk", website: "https://petshop.co.uk" }),
        firecrawl: async () => [],
        mxValid: async () => true,
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(dealPatch.hopper).toBe("sendable");
    expect(dealPatch.email).toBe("info@petshop.co.uk");
    expect(dealPatch.mailboxGrade).toBe("role");
    expect(dealPatch.contactName).toBe("Adam Taylor");
  });

  it("still runs Places when stored email is a role mailbox so a director inbox can win", async () => {
    const places = vi.fn(async () => ({ email: "adam@petshop.co.uk" }));
    const { dealPatch } = await attachOne(
      {
        attachAttempts: 0,
        hopper: "gated",
        companyName: "Pet Shop Ltd",
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
      { attachAttempts: 0, hopper: "gated", companyName: "Pet Shop Ltd", companyNumber: "1" } as any,
      {
        officers: async () => ["Joanna Smith"],
        places: async () => ({ email: "ann@petshop.co.uk" }),
        firecrawl: async () => [],
        mxValid: async () => true,
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(dealPatch.hopper).toBe("sendable");
    expect(dealPatch.email).toBe("ann@petshop.co.uk");
    expect(dealPatch.contactName).not.toBe("Joanna Smith");
  });

  it("refuses a mailbox already on an inbound deal", async () => {
    const { dealPatch } = await attachOne(
      { attachAttempts: 0, hopper: "gated", companyName: "Pet Shop Ltd", companyNumber: "1" } as any,
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

  it("does not scrape Companies House or registry pages for a mailbox", async () => {
    const firecrawl = vi.fn(async () => ["enquiries@companieshouse.gov.uk"]);
    const { dealPatch } = await attachOne(
      {
        attachAttempts: 0,
        hopper: "gated",
        companyName: "IHSAN PHARMA LTD",
        companyNumber: "10312101",
        website: "https://find-and-update.company-information.service.gov.uk/company/10312101",
      } as any,
      {
        officers: async () => ["Jawad Moin MEHROOF"],
        places: async () => null,
        firecrawl,
        mxValid: async () => true,
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(firecrawl).not.toHaveBeenCalled();
    expect(dealPatch.email).not.toBe("enquiries@companieshouse.gov.uk");
    expect(dealPatch.hopper).not.toBe("sendable");
  });

  it("does not attach a mailbox that is not this company", async () => {
    const { dealPatch } = await attachOne(
      {
        attachAttempts: 0,
        hopper: "gated",
        companyName: "Phoenix C N C Engineering Ltd",
        companyNumber: "1",
      } as any,
      {
        officers: async () => ["Jamie Mackenzie"],
        places: async () => ({ email: "precision@amfengineering.co.uk" }),
        firecrawl: async () => [],
        mxValid: async () => true,
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(dealPatch.hopper).not.toBe("sendable");
    expect(dealPatch.email).not.toBe("precision@amfengineering.co.uk");
  });

  it("prefers a director mailbox over a role mailbox found first", async () => {
    const { dealPatch } = await attachOne(
      { attachAttempts: 0, hopper: "gated", companyName: "Pet Shop Ltd", companyNumber: "1" } as any,
      {
        officers: async () => ["Adam Taylor"],
        places: async () => ({ email: "ops@petshop.co.uk", website: "https://petshop.co.uk" }),
        firecrawl: async () => ["adam@petshop.co.uk"],
        mxValid: async () => true,
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(dealPatch.hopper).toBe("sendable");
    expect(dealPatch.email).toBe("adam@petshop.co.uk");
    expect(dealPatch.mailboxGrade).toBe("director");
  });

  it("keeps stored directorNames when officers fetch is empty", async () => {
    const { dealPatch } = await attachOne(
      {
        attachAttempts: 0,
        hopper: "gated",
        companyName: "Pet Shop Ltd",
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

  it("does not Firecrawl when a company-domain email is already on the file", async () => {
    const firecrawl = vi.fn(async () => ["info@petshop.co.uk"]);
    const { dealPatch } = await attachOne(
      {
        attachAttempts: 0,
        hopper: "hunt_contact",
        companyName: "Pet Shop Ltd",
        companyNumber: "1",
        website: "https://petshop.co.uk",
        email: "adam@petshop.co.uk",
        directorNames: ["Adam Taylor"],
      } as any,
      {
        officers: async () => [],
        places: async () => null,
        firecrawl,
        mxValid: async () => true,
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(firecrawl).not.toHaveBeenCalled();
    expect(dealPatch.email).toBe("adam@petshop.co.uk");
    expect(dealPatch.hopper).toBe("sendable");
  });

  it("still Firecrawls when the stored mailbox is personal", async () => {
    const firecrawl = vi.fn(async () => ["adam@petshop.co.uk"]);
    const { dealPatch } = await attachOne(
      {
        attachAttempts: 0,
        hopper: "hunt_contact",
        companyName: "Pet Shop Ltd",
        companyNumber: "1",
        website: "https://petshop.co.uk",
        email: "adam@gmail.com",
        directorNames: ["Adam Taylor"],
      } as any,
      {
        officers: async () => [],
        places: async () => null,
        firecrawl,
        mxValid: async () => true,
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(firecrawl).toHaveBeenCalledWith("https://petshop.co.uk");
    expect(dealPatch.email).toBe("adam@petshop.co.uk");
  });

  it("drops harvested addresses that are not on the company domain", async () => {
    const { dealPatch } = await attachOne(
      {
        attachAttempts: 0,
        hopper: "gated",
        companyName: "IHSAN PHARMA LTD",
        companyNumber: "1",
        website: "https://ihsanpharma.co.uk",
        directorNames: ["Jawad Moin MEHROOF"],
      } as any,
      {
        officers: async () => [],
        places: async () => null,
        firecrawl: async () => ["enquiries@companieshouse.gov.uk", "info@ihsanpharma.co.uk"],
        mxValid: async () => true,
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(dealPatch.email).toBe("info@ihsanpharma.co.uk");
    expect(dealPatch.hopper).toBe("sendable");
  });

  it("learns first.last from a harvested address and SMTP-checks that pattern for the director", async () => {
    const smtpValid = vi.fn(async (email: string) => email === "adam.taylor@petshop.co.uk");
    const { dealPatch } = await attachOne(
      {
        attachAttempts: 0,
        hopper: "gated",
        companyName: "Pet Shop Ltd",
        companyNumber: "1",
        website: "https://petshop.co.uk",
        directorNames: ["Adam Taylor"],
      } as any,
      {
        officers: async () => [],
        places: async () => null,
        firecrawl: async () => ["jane.smith@petshop.co.uk", "info@petshop.co.uk"],
        mxValid: async () => true,
        smtpValid,
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(dealPatch.email).toBe("adam.taylor@petshop.co.uk");
    expect(dealPatch.contactSource).toBe("domain");
    expect(smtpValid).toHaveBeenCalledWith("adam.taylor@petshop.co.uk");
    expect(smtpValid).not.toHaveBeenCalledWith("ataylor@petshop.co.uk");
  });

  it("matches a director to first.last on the company domain when the site has no mailbox", async () => {
    const smtpValid = vi.fn(async (email: string) => !email.startsWith("nx-no-box-"));
    const { dealPatch } = await attachOne(
      {
        attachAttempts: 0,
        hopper: "gated",
        companyName: "Pet Shop Ltd",
        companyNumber: "1",
        website: "https://petshop.co.uk",
        directorNames: ["Adam Taylor"],
      } as any,
      {
        officers: async () => [],
        places: async () => null,
        firecrawl: async () => [],
        mxValid: async () => true,
        smtpValid,
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(dealPatch.email).toBe("adam.taylor@petshop.co.uk");
    expect(dealPatch.contactSource).toBe("domain");
    expect(dealPatch.hopper).toBe("sendable");
  });

  it("does not permute when the catch-all SMTP probe is unknown", async () => {
    const smtpProbe = vi.fn(async () => "unknown" as const);
    const { dealPatch } = await attachOne(
      {
        attachAttempts: 0,
        hopper: "gated",
        companyName: "Pet Shop Ltd",
        companyNumber: "1",
        website: "https://petshop.co.uk",
        directorNames: ["Adam Taylor"],
      } as any,
      {
        officers: async () => [],
        places: async () => null,
        firecrawl: async () => [],
        mxValid: async () => true,
        smtpProbe,
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(dealPatch.hopper).not.toBe("sendable");
    expect(dealPatch.email).toBeUndefined();
    expect(smtpProbe.mock.calls.some((call) => String(call[0]).startsWith("nx-no-box-"))).toBe(true);
  });

  it("attaches an OSINT company mailbox when the file has no website", async () => {
    const firecrawl = vi.fn(async () => []);
    const { dealPatch } = await attachOne(
      {
        attachAttempts: 0,
        hopper: "quarantine",
        companyName: "RammSanderson Ecology Limited",
        companyNumber: "1",
        directorNames: ["Oliver James RAMM"],
      } as any,
      {
        officers: async () => [],
        places: async () => null,
        firecrawl,
        mxValid: async () => true,
        osint: async () => ({
          emails: ["info@rammsanderson.com"],
          website: "https://www.rammsanderson.com",
        }),
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(dealPatch.email).toBe("info@rammsanderson.com");
    expect(dealPatch.contactSource).toBe("osint");
    expect(dealPatch.mailboxConfidence).toBeGreaterThanOrEqual(75);
    expect(dealPatch.hopper).toBe("sendable");
    expect(dealPatch.website).toBe("https://www.rammsanderson.com");
  });

  it("uses Wayback when the live site scrape has no mailto", async () => {
    const { dealPatch } = await attachOne(
      {
        attachAttempts: 0,
        hopper: "quarantine",
        companyName: "Heritage Trimmings Ltd",
        companyNumber: "1",
        website: "https://www.heritagetrimmings.co.uk",
        directorNames: ["Jacob Frank TAEE"],
      } as any,
      {
        officers: async () => [],
        places: async () => null,
        firecrawl: async () => [],
        mxValid: async () => true,
        wayback: async () => ["email@heritagetrimmings.co.uk"],
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(dealPatch.email).toBe("email@heritagetrimmings.co.uk");
    expect(dealPatch.contactSource).toBe("wayback");
    expect(dealPatch.mailboxConfidence).toBeGreaterThanOrEqual(75);
    expect(dealPatch.hopper).toBe("sendable");
  });

  it("does not attach a guessed mailbox that fails SMTP even when MX is live", async () => {
    const { dealPatch } = await attachOne(
      {
        attachAttempts: 0,
        hopper: "gated",
        companyName: "Pet Shop Ltd",
        companyNumber: "1",
        website: "https://petshop.co.uk",
        directorNames: ["Adam Taylor"],
      } as any,
      {
        officers: async () => [],
        places: async () => null,
        firecrawl: async () => [],
        mxValid: async () => true,
        smtpValid: async () => false,
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(dealPatch.hopper).not.toBe("sendable");
    expect(dealPatch.email).toBeUndefined();
  });

  it("does not guess first.last when the domain is a catch-all", async () => {
    const { dealPatch } = await attachOne(
      {
        attachAttempts: 0,
        hopper: "gated",
        companyName: "Pet Shop Ltd",
        companyNumber: "1",
        website: "https://petshop.co.uk",
        directorNames: ["Adam Taylor"],
      } as any,
      {
        officers: async () => [],
        places: async () => null,
        firecrawl: async () => [],
        mxValid: async () => true,
        smtpValid: async () => true,
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(dealPatch.hopper).not.toBe("sendable");
    expect(dealPatch.email).not.toBe("adam.taylor@petshop.co.uk");
  });

  it("attaches first.last for the file's director on Google MX with no SMTP", async () => {
    const smtpProbe = vi.fn(async () => "unknown" as const);
    const { dealPatch } = await attachOne(
      {
        attachAttempts: 0,
        hopper: "gated",
        companyName: "Pet Shop Ltd",
        companyNumber: "1",
        website: "https://petshop.co.uk",
        directorNames: ["Adam Taylor"],
      } as any,
      {
        officers: async () => [],
        places: async () => null,
        firecrawl: async () => [],
        mxValid: async () => true,
        mxHosts: async () => ["aspmx.l.google.com"],
        smtpProbe,
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(dealPatch.email).toBe("adam.taylor@petshop.co.uk");
    expect(dealPatch.contactSource).toBe("domain");
    expect(dealPatch.hopper).toBe("sendable");
    expect(dealPatch.mailboxGrade).toBe("director");
    expect(dealPatch.mailboxConfidence).toBeGreaterThanOrEqual(75);
    expect(smtpProbe).not.toHaveBeenCalled();
  });

  it("skips a bounced first.last and attaches flast on the next mute-MX pass", async () => {
    const { dealPatch } = await attachOne(
      {
        attachAttempts: 0,
        hopper: "hunt_contact",
        companyName: "Pet Shop Ltd",
        companyNumber: "1",
        website: "https://petshop.co.uk",
        directorNames: ["Adam Taylor"],
      } as any,
      {
        officers: async () => [],
        places: async () => null,
        firecrawl: async () => [],
        mxValid: async () => true,
        mxHosts: async () => ["aspmx.l.google.com"],
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 },
      new Date(),
      new Set(["adam.taylor@petshop.co.uk"])
    );
    expect(dealPatch.email).toBe("ataylor@petshop.co.uk");
    expect(dealPatch.email).not.toBe("adam.taylor@petshop.co.uk");
  });

  it("does not guess when guessing is paused", async () => {
    const { dealPatch } = await attachOne(
      {
        attachAttempts: 0,
        hopper: "gated",
        companyName: "Pet Shop Ltd",
        companyNumber: "1",
        website: "https://petshop.co.uk",
        directorNames: ["Adam Taylor"],
      } as any,
      {
        officers: async () => [],
        places: async () => null,
        firecrawl: async () => [],
        mxValid: async () => true,
        mxHosts: async () => ["aspmx.l.google.com"],
        guessPaused: true,
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(dealPatch.hopper).not.toBe("sendable");
    expect(dealPatch.email).toBeUndefined();
  });

  it("skips Places and Companies House when the file already has a website and directors", async () => {
    const places = vi.fn();
    const officers = vi.fn();
    const { dealPatch } = await attachOne(
      {
        attachAttempts: 0,
        hopper: "gated",
        companyName: "Pet Shop Ltd",
        companyNumber: "1",
        website: "https://petshop.co.uk",
        directorNames: ["Adam Taylor"],
      } as any,
      {
        officers,
        places,
        firecrawl: async () => ["info@petshop.co.uk"],
        mxValid: async () => true,
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(places).not.toHaveBeenCalled();
    expect(officers).not.toHaveBeenCalled();
    expect(dealPatch.email).toBe("info@petshop.co.uk");
    expect(dealPatch.hopper).toBe("sendable");
  });

  it("targets /contact first, then /, /about, /team for Firecrawl", () => {
    expect(ATTACH_FIRECRAWL_PATHS).toEqual(["/contact", "/", "/about", "/team"]);
    expect(firecrawlTargetUrls("https://petshop.co.uk")).toEqual([
      "https://petshop.co.uk/contact",
      "https://petshop.co.uk/",
      "https://petshop.co.uk/about",
      "https://petshop.co.uk/team",
    ]);
  });

  it("pulls emails from a fetched contact page without Firecrawl Cloud", async () => {
    const fetched: string[] = [];
    const emails = await collectPageEmails(
      ["https://petshop.co.uk/contact", "https://petshop.co.uk/"],
      async (url) => {
        fetched.push(url);
        if (url.endsWith("/contact")) return "Mail us at adam@petshop.co.uk";
        return "no mailbox here";
      }
    );
    expect(emails).toEqual(["adam@petshop.co.uk"]);
    expect(fetched).toEqual(["https://petshop.co.uk/contact"]);
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
          companyName: "Pet Shop Ltd",
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
          companyName: "Pet Shop Ltd",
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
        { ...base, id: 1, companyName: "Pet Shop Ltd", companyNumber: "1" },
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
          companyName: "Pet Shop Ltd",
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

describe("Harvest agent loop", () => {
  const now = new Date("2026-09-02T10:00:00.000Z");

  it("takes quarantine, empty hopper, gated, and hunt-contact files without an email", () => {
    expect(isHarvestCandidate({ source: "distress_scan", hopper: "quarantine", companyName: "Pet Shop Ltd" }, now)).toBe(true);
    expect(isHarvestCandidate({ source: "distress_scan", companyName: "Pet Shop Ltd" }, now)).toBe(true);
    expect(isHarvestCandidate({ source: "distress_scan", hopper: "gated", companyName: "Pet Shop Ltd" }, now)).toBe(true);
    expect(isHarvestCandidate({ source: "distress_scan", hopper: "hunt_contact", companyName: "Pet Shop Ltd" }, now)).toBe(true);
  });

  it("skips noise, inbound, parked, sendable, and files that already have an email in quarantine", () => {
    expect(
      isHarvestCandidate({ source: "distress_scan", hopper: "quarantine", companyName: "Pack Upload Test Ltd" }, now)
    ).toBe(false);
    expect(
      isHarvestCandidate({ source: "strata_inbound", hopper: "hunt_contact", companyName: "Pet Shop Ltd" }, now)
    ).toBe(false);
    expect(
      isHarvestCandidate({ source: "distress_scan", hopper: "sendable", companyName: "Pet Shop Ltd", email: "a@b.co.uk" }, now)
    ).toBe(false);
    expect(
      isHarvestCandidate({ source: "distress_scan", hopper: "parked", companyName: "Pet Shop Ltd" }, now)
    ).toBe(false);
    expect(
      isHarvestCandidate(
        { source: "distress_scan", hopper: "quarantine", companyName: "Pet Shop Ltd", email: "info@petshop.co.uk" },
        now
      )
    ).toBe(false);
  });

  it("does not re-harvest a quarantine file still inside the retry hold", () => {
    expect(
      isHarvestCandidate(
        {
          source: "distress_scan",
          hopper: "quarantine",
          companyName: "Pet Shop Ltd",
          waitUntil: "2026-09-03T10:00:00.000Z",
        },
        now
      )
    ).toBe(false);
  });

  it("stops harvesting after six attach misses", () => {
    expect(SME_ATTACH_ATTEMPT_CAP).toBe(6);
    expect(
      isHarvestCandidate(
        { source: "distress_scan", hopper: "quarantine", companyName: "Pet Shop Ltd", attachAttempts: 6 },
        now
      )
    ).toBe(false);
    expect(
      isHarvestCandidate(
        { source: "distress_scan", hopper: "quarantine", companyName: "Pet Shop Ltd", attachAttempts: 5 },
        now
      )
    ).toBe(true);
  });

  it("refills from quarantine and empty hopper, skipping Pack Upload Test Ltd", async () => {
    const places = vi.fn(async () => null);
    const { patches } = await refillSendableHopper({
      deals: [
        {
          id: 1,
          source: "distress_scan" as const,
          hopper: "quarantine" as const,
          companyName: "Pet Shop Ltd",
          companyNumber: "1",
          website: "https://petshop.co.uk",
          directorNames: ["Adam Taylor"],
          ownerUserId: "u",
          stage: "ingest" as const,
          status: "waiting_human" as const,
          events: [],
          createdAt: "",
          updatedAt: "",
        },
        {
          id: 2,
          source: "distress_scan" as const,
          companyName: "Empty Hopper Ltd",
          companyNumber: "2",
          website: "https://emptyhopper.co.uk",
          directorNames: ["Ada Lovelace"],
          ownerUserId: "u",
          stage: "ingest" as const,
          status: "waiting_timer" as const,
          events: [],
          createdAt: "",
          updatedAt: "",
        },
        {
          id: 3,
          source: "distress_scan" as const,
          hopper: "quarantine" as const,
          companyName: "Pack Upload Test Ltd",
          companyNumber: "3",
          website: "https://packtest.example",
          directorNames: ["Test User"],
          ownerUserId: "pack-upload-test",
          stage: "ingest" as const,
          status: "waiting_human" as const,
          events: [],
          createdAt: "",
          updatedAt: "",
        },
      ] as any,
      deps: {
        officers: async () => [],
        places,
        firecrawl: async () => [],
        mxValid: async () => true,
        smtpValid: async (email: string) => !email.startsWith("nx-no-box-"),
      },
      now,
    });
    expect(places).not.toHaveBeenCalled();
    expect(patches.map((row) => row.id).sort()).toEqual([1, 2]);
    expect(patches.every((row) => row.patch.hopper === "sendable")).toBe(true);
    expect(patches.every((row) => row.patch.events?.some((event) => event.agent === "harvest"))).toBe(true);
  });

  it("reports each file before attach so a hang is visible on the progress bar", async () => {
    const seen: Array<{ phase: string; companyName: string; index: number; total: number }> = [];
    await refillSendableHopper({
      deals: [
        {
          id: 1,
          source: "distress_scan" as const,
          hopper: "quarantine" as const,
          companyName: "Slow SMTP Ltd",
          companyNumber: "1",
          website: "https://slowsmtp.co.uk",
          directorNames: ["Ada Lovelace"],
          ownerUserId: "u",
          stage: "ingest" as const,
          status: "waiting_human" as const,
          events: [],
          createdAt: "",
          updatedAt: "",
        },
      ] as any,
      deps: {
        officers: async () => [],
        places: async () => null,
        firecrawl: async () => [],
        mxValid: async () => true,
        smtpValid: async () => {
          expect(seen.some((row) => row.phase === "start" && row.companyName === "Slow SMTP Ltd")).toBe(true);
          return false;
        },
      },
      now,
      onProgress: async (row) => {
        seen.push({ phase: row.phase, companyName: row.companyName, index: row.index, total: row.total });
      },
    });
    expect(seen[0]).toEqual({ phase: "start", companyName: "Slow SMTP Ltd", index: 0, total: 1 });
    expect(seen.some((row) => row.phase === "done")).toBe(true);
  });

  it("grades a stored company-domain CSV mailbox without burning CH, Places or Firecrawl", async () => {
    const officers = vi.fn(async () => ["Ada Lovelace"]);
    const places = vi.fn();
    const firecrawl = vi.fn();
    const { dealPatch } = await attachOne(
      {
        hopper: "hunt_contact",
        companyName: "Pet Shop Ltd",
        companyNumber: "01234567",
        email: "adam@petshop.co.uk",
        website: "https://petshop.co.uk",
        contactName: "Adam",
      } as any,
      { officers, places, firecrawl, mxValid: async () => true },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(dealPatch.hopper).toBe("sendable");
    expect(dealPatch.email).toBe("adam@petshop.co.uk");
    expect(officers).not.toHaveBeenCalled();
    expect(places).not.toHaveBeenCalled();
    expect(firecrawl).not.toHaveBeenCalled();
  });

  it("still hunts a company mailbox when the CSV row is a personal address", async () => {
    const officers = vi.fn(async () => ["Ada Lovelace"]);
    const places = vi.fn(async () => ({ website: "https://petshop.co.uk" }));
    const firecrawl = vi.fn(async () => ["ada@petshop.co.uk"]);
    const { dealPatch } = await attachOne(
      {
        hopper: "hunt_contact",
        companyName: "Pet Shop Ltd",
        companyNumber: "1",
        email: "ada@gmail.com",
        contactName: "Ada",
      } as any,
      { officers, places, firecrawl, mxValid: async () => true },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
    );
    expect(places).toHaveBeenCalled();
    expect(firecrawl).toHaveBeenCalled();
    expect(dealPatch.hopper).toBe("sendable");
    expect(dealPatch.email).toBe("ada@petshop.co.uk");
  });

  it("stops after the hourly cap so a 3000-file hopper cannot become one job", async () => {
    expect(HARVEST_PER_HOUR).toBe(25);
    expect(HARVEST_FLUSH_EVERY).toBe(1);
    const base = {
      source: "distress_scan" as const,
      hopper: "hunt_contact" as const,
      ownerUserId: "u",
      stage: "ingest" as const,
      status: "waiting_timer" as const,
      events: [],
      createdAt: "",
      updatedAt: "",
    };
    const { patches } = await refillSendableHopper({
      deals: [
        { ...base, id: 1, companyName: "A Ltd", email: "a@a.co.uk", website: "https://a.co.uk", contactName: "Ada" },
        { ...base, id: 2, companyName: "B Ltd", email: "b@b.co.uk", website: "https://b.co.uk", contactName: "Ben" },
        { ...base, id: 3, companyName: "C Ltd", email: "c@c.co.uk", website: "https://c.co.uk", contactName: "Cat" },
      ] as any,
      deps: {
        officers: async () => [],
        places: async () => null,
        firecrawl: async () => [],
        mxValid: async () => true,
      },
      limit: 2,
      now,
    });
    expect(patches.map((row) => row.id)).toEqual([1, 2]);
  });

  it("quarantines a company that hangs past the attach timeout and keeps going", async () => {
    const { patches } = await refillSendableHopper({
      deals: [
        {
          id: 1,
          source: "distress_scan" as const,
          hopper: "hunt_contact" as const,
          companyName: "Hang Ltd",
          companyNumber: "1",
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
          hopper: "hunt_contact" as const,
          companyName: "Ok Ltd",
          email: "ok@ok.co.uk",
          website: "https://ok.co.uk",
          contactName: "Ada",
          ownerUserId: "u",
          stage: "ingest" as const,
          status: "waiting_timer" as const,
          events: [],
          createdAt: "",
          updatedAt: "",
        },
      ] as any,
      deps: {
        officers: async () => [],
        places: () => new Promise(() => {}),
        firecrawl: async () => [],
        mxValid: async () => true,
      },
      attachTimeoutMs: 30,
      now,
    });
    expect(patches.map((row) => row.id)).toEqual([1, 2]);
    expect(patches[0].patch.hopper).toBe("quarantine");
    expect(patches[1].patch.hopper).toBe("sendable");
  });

  it("hands each finished file to onPatch before starting the next so a crash keeps work already done", async () => {
    const order: string[] = [];
    const { patches } = await refillSendableHopper({
      deals: [
        {
          id: 1,
          source: "distress_scan" as const,
          hopper: "hunt_contact" as const,
          companyName: "A Ltd",
          email: "a@a.co.uk",
          website: "https://a.co.uk",
          contactName: "Ada",
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
          hopper: "hunt_contact" as const,
          companyName: "B Ltd",
          email: "b@b.co.uk",
          website: "https://b.co.uk",
          contactName: "Ben",
          ownerUserId: "u",
          stage: "ingest" as const,
          status: "waiting_timer" as const,
          events: [],
          createdAt: "",
          updatedAt: "",
        },
      ] as any,
      deps: {
        officers: async () => [],
        places: async () => null,
        firecrawl: async () => [],
        mxValid: async () => true,
      },
      onProgress: async (row) => {
        if (row.phase === "start") order.push(`start ${row.companyName}`);
      },
      onPatch: async (row) => {
        order.push(`patch ${row.id}`);
      },
    });
    expect(patches.map((row) => row.id)).toEqual([1, 2]);
    expect(order).toEqual(["start A Ltd", "patch 1", "start B Ltd", "patch 2"]);
  });

  it("holds a failed harvest for a day instead of burning budget every tick", async () => {
    const { dealPatch } = await attachOne(
      { attachAttempts: 2, hopper: "quarantine", companyName: "Pet Shop Ltd", companyNumber: "1" } as any,
      {
        officers: async () => ["Ada Lovelace"],
        places: async () => null,
        firecrawl: async () => [],
        mxValid: async () => false,
      },
      { ch: 10, places: 10, firecrawl: 10, smtp: 10 },
      now
    );
    expect(dealPatch.hopper).toBe("quarantine");
    expect(Date.parse(String(dealPatch.waitUntil))).toBe(now.getTime() + HARVEST_RETRY_MS);
    expect(dealPatch.events?.some((event) => event.agent === "harvest")).toBe(true);
  });

  it("keeps patches already attached when the job is stopped mid-harvest", async () => {
    const { JobStoppedError } = await import("../../services/agentJobTracker");
    const places = vi.fn(async () => ({ email: "adam@petshop.co.uk" }));
    let starts = 0;
    const { patches } = await refillSendableHopper({
      deals: [
        {
          id: 1,
          source: "distress_scan" as const,
          hopper: "gated" as const,
          companyName: "A Ltd",
          companyNumber: "1",
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
          companyName: "B Ltd",
          companyNumber: "2",
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
        firecrawl: async () => [],
        mxValid: async () => true,
      },
      budget: { ch: 10, places: 10, firecrawl: 0, smtp: 10 },
      onProgress: async (row) => {
        if (row.phase === "start") {
          starts += 1;
          if (starts > 1) throw new JobStoppedError();
        }
      },
    });
    expect(patches).toHaveLength(1);
    expect(patches[0].id).toBe(1);
    expect(places).toHaveBeenCalledTimes(1);
  });
});
