import { describe, expect, it } from "vitest";
import { decideAction, MockNexus } from "@shared/slfAdapter";

describe("decideAction", () => {
  it("creates only after a lookup miss for Lead Finder", () => {
    expect(decideAction({ actor: "slf.agent.v1", book: null, priority: "hot" })).toBe("create");
  });

  it("promotes a prospective book row on hot/warm", () => {
    expect(
      decideAction({
        actor: "slf.agent.v1",
        book: { nexusCandidateId: "deal:4418", companyNumber: "01234567", status: "prospective" },
        priority: "hot",
      })
    ).toBe("promote");
  });

  it("never creates from List Finder on a miss", () => {
    expect(decideAction({ actor: "slf.list.v1", book: null })).toBe("store_in_list_product_only");
  });

  it("attaches mailboxes on a book hit for List Finder", () => {
    expect(
      decideAction({
        actor: "slf.list.v1",
        book: { nexusCandidateId: "deal:4418", companyNumber: "01234567", status: "queued" },
      })
    ).toBe("attach_mailbox");
  });

  it("suppresses DNC", () => {
    expect(
      decideAction({
        actor: "slf.agent.v1",
        book: { nexusCandidateId: "deal:1", companyNumber: "01234567", status: "dnc", doNotContact: true },
        priority: "hot",
      })
    ).toBe("suppress");
  });

  it("uses intelligence_only on packaging", () => {
    expect(
      decideAction({
        actor: "slf.agent.v1",
        book: { nexusCandidateId: "deal:1", companyNumber: "01234567", status: "packaging" },
        priority: "hot",
      })
    ).toBe("intelligence_only");
  });
});

describe("MockNexus", () => {
  it("seeds deal:4418 / 01234567 and keeps the id on promote", () => {
    const nexus = MockNexus.seeded();
    const before = nexus.candidateCount();
    const result = nexus.write({
      action: "promote",
      actor: "slf.agent.v1",
      companyNumber: "01234567",
      idempotencyKey: "slf:01234567:aaaa1111",
      payload: { score: 91, primaryProduct: "hmrc_distress" },
    });
    expect(result.ok).toBe(true);
    expect(result.nexusCandidateId).toBe("deal:4418");
    expect(nexus.candidateCount()).toBe(before);
  });

  it("replays create with the same idempotency key", () => {
    const nexus = MockNexus.seeded();
    const first = nexus.write({
      action: "create",
      actor: "slf.agent.v1",
      companyNumber: "08881234",
      idempotencyKey: "slf:08881234:bbbb2222",
      payload: { name: "Hartley Units Ltd" },
    });
    const second = nexus.write({
      action: "create",
      actor: "slf.agent.v1",
      companyNumber: "08881234",
      idempotencyKey: "slf:08881234:bbbb2222",
      payload: { name: "Hartley Units Ltd" },
    });
    expect(first.nexusCandidateId).toBe(second.nexusCandidateId);
    expect(nexus.rowsFor("08881234")).toHaveLength(1);
  });

  it("rejects create when the number is already on the book", () => {
    const nexus = MockNexus.seeded();
    const result = nexus.write({
      action: "create",
      actor: "slf.agent.v1",
      companyNumber: "01234567",
      idempotencyKey: "slf:01234567:cccc3333",
      payload: { name: "Acme" },
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("409 book_hit");
  });

  it("attaches a director mailbox without creating a second candidate", () => {
    const nexus = MockNexus.seeded();
    const before = nexus.candidateCount();
    const result = nexus.write({
      action: "attach_mailbox",
      actor: "slf.list.v1",
      companyNumber: "01234567",
      idempotencyKey: "slf-list:01234567:jane.ellis@acme.co.uk:2026-09-07",
      payload: {
        email: "jane.ellis@acme.co.uk",
        mailboxType: "director",
        isPrimary: true,
        guessed: false,
      },
    });
    expect(result.ok).toBe(true);
    expect(nexus.candidateCount()).toBe(before);
    expect(nexus.lookup({ companyNumber: "01234567" }).hit?.email).toBe("jane.ellis@acme.co.uk");
  });

  it("rejects guessed info@ attaches", () => {
    const nexus = MockNexus.seeded();
    const result = nexus.write({
      action: "attach_mailbox",
      actor: "slf.list.v1",
      companyNumber: "01234567",
      idempotencyKey: "slf-list:01234567:info@acme.co.uk:2026-09-07",
      payload: { email: "info@acme.co.uk", mailboxType: "role", guessed: true },
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("422 pecr_blocked");
  });

  it("returns 404 when List Finder attaches to an unknown number", () => {
    const nexus = MockNexus.seeded();
    const result = nexus.write({
      action: "attach_mailbox",
      actor: "slf.list.v1",
      companyNumber: "00000001",
      idempotencyKey: "slf-list:00000001:a@b.co.uk:2026-09-07",
      payload: { email: "a@b.co.uk", mailboxType: "director", guessed: false },
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("404 not_on_book");
  });

  it("applies DNC dispositions to block later promotes", () => {
    const nexus = MockNexus.seeded();
    nexus.disposition({ companyNumber: "01234567", status: "dnc" });
    const action = decideAction({
      actor: "slf.agent.v1",
      book: nexus.lookup({ companyNumber: "01234567" }).hit,
      priority: "hot",
    });
    expect(action).toBe("suppress");
  });
});
