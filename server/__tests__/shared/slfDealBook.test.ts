import { describe, expect, it } from "vitest";
import { canonicalStatusFromDeal, dealToCandidate, MemoryDealBook } from "@shared/slfDealBook";
import { GOLD_FIXTURES, acceptLead, createSlfStore, ingestSnapshot } from "@shared/slfRuntime";

const NOW = new Date("2026-09-07T12:00:00Z");

describe("dealToCandidate", () => {
  it("maps a gated SME deal to prospective", () => {
    const candidate = dealToCandidate({
      id: 12,
      stream: "sme",
      hopper: "gated",
      stage: "ingest",
      status: "waiting_timer",
      companyName: "Acme Joinery Limited",
      companyNumber: "1234567",
      source: "distress_scan",
      ownerUserId: "shaun",
      events: [],
      createdAt: "",
      updatedAt: "",
    });
    expect(candidate.nexusCandidateId).toBe("deal:12");
    expect(candidate.companyNumber).toBe("01234567");
    expect(candidate.status).toBe("prospective");
  });

  it("maps outreach to contacted", () => {
    expect(
      canonicalStatusFromDeal({
        hopper: "sendable",
        stage: "outreach",
        outreachTouch: 1,
      })
    ).toBe("contacted");
  });
});

describe("MemoryDealBook", () => {
  it("creates a gated Stream A deal on accept of a net-new name", async () => {
    const store = createSlfStore();
    const book = new MemoryDealBook();
    ingestSnapshot(store, GOLD_FIXTURES["09876543"], { now: NOW, generatedAt: NOW.toISOString() });
    const result = await acceptLead(store, "09876543", book);
    expect(result.ok).toBe(true);
    expect(book.deals).toHaveLength(1);
    const deal = book.deals[0];
    expect(deal.stream).toBe("sme");
    expect(deal.source).toBe("distress_scan");
    expect(deal.hopper).toBe("gated");
    expect(deal.stage).toBe("ingest");
    expect(deal.status).toBe("waiting_timer");
    expect(deal.companyNumber).toBe("09876543");
    expect(result.lead?.nexusCandidateId).toBe(`deal:${deal.id}`);
    expect(deal.events[0]?.message).toMatch(/hmrc_distress|petition/i);
  });

  it("promotes an existing SME deal without opening a second file", async () => {
    const book = new MemoryDealBook();
    book.createGatedSme({
      companyName: "Acme Joinery Limited",
      companyNumber: "01234567",
    });
    const store = createSlfStore();
    ingestSnapshot(store, GOLD_FIXTURES["01234567"], { now: NOW, generatedAt: NOW.toISOString() });
    // Lookup must see the live book, not only the mock seed.
    const result = await acceptLead(store, "01234567", book);
    expect(result.ok).toBe(true);
    expect(book.deals).toHaveLength(1);
    expect(book.deals[0].id).toBe(1);
    expect(book.deals[0].hopper).toBe("gated");
    expect(book.deals[0].fitScore).toBeGreaterThan(0);
    expect(book.deals[0].events.some((event) => /promote|high_cost_refi/i.test(event.message))).toBe(true);
  });

  it("does not create a duplicate for an inbound file with the same company number", async () => {
    const book = new MemoryDealBook();
    book.create({
      source: "strata_inbound",
      stream: "inbound",
      stage: "ingest",
      status: "running",
      ownerUserId: "shaun",
      companyName: "Oxbow Coldstores Limited",
      companyNumber: "09876543",
      events: [],
    });
    const store = createSlfStore();
    ingestSnapshot(store, GOLD_FIXTURES["09876543"], { now: NOW, generatedAt: NOW.toISOString() });
    const result = await acceptLead(store, "09876543", book);
    expect(result.ok).toBe(true);
    expect(book.deals).toHaveLength(1);
    expect(book.deals[0].source).toBe("strata_inbound");
    expect(book.deals[0].hopper).toBeUndefined();
  });

  it("attaches a mailbox without flipping hopper to sendable", () => {
    const book = new MemoryDealBook();
    book.createGatedSme({ companyName: "Acme Joinery Limited", companyNumber: "01234567" });
    const write = book.write({
      action: "attach_mailbox",
      actor: "slf.list.v1",
      companyNumber: "01234567",
      idempotencyKey: "slf-list:01234567:jane.ellis@acme.co.uk:2026-09-07",
      payload: { email: "jane.ellis@acme.co.uk", mailboxType: "director", guessed: false, contactName: "Jane Ellis" },
    });
    expect(write.ok).toBe(true);
    expect(book.deals).toHaveLength(1);
    expect(book.deals[0].email).toBe("jane.ellis@acme.co.uk");
    expect(book.deals[0].hopper).toBe("gated");
  });
});
