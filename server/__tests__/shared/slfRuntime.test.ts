import { describe, expect, it } from "vitest";
import {
  GOLD_FIXTURES,
  acceptLead,
  createSlfStore,
  ingestListRows,
  ingestSnapshot,
  listQueue,
  mapChCharges,
} from "@shared/slfRuntime";

const NOW = new Date("2026-09-07T12:00:00Z");

describe("slf runtime", () => {
  it("maps Companies House charge payloads", () => {
    expect(
      mapChCharges({
        items: [
          {
            status: "outstanding",
            created_on: "2025-01-15",
            persons_entitled: [{ name: "IWOCA LIMITED" }],
          },
        ],
      })
    ).toEqual([
      { status: "outstanding", createdOn: "2025-01-15", satisfiedOn: undefined, personsEntitled: ["IWOCA LIMITED"] },
    ]);
  });

  it("ingests Acme onto the seeded book as promote, not create", async () => {
    const store = createSlfStore();
    const lead = ingestSnapshot(store, GOLD_FIXTURES["01234567"], { now: NOW, generatedAt: NOW.toISOString() });
    expect(lead.bookLane).toBe("existing_queue");
    expect(lead.score.primaryProduct).toBe("high_cost_refi");
    expect(lead.package?.action).toBe("promote");
    const accepted = await acceptLead(store, "01234567");
    expect(accepted.ok).toBe(true);
    expect(accepted.lead?.nexusCandidateId).toBe("deal:4418");
    expect(store.nexus.candidateCount()).toBe(4);
  });

  it("creates Oxbow as a net-new gated candidate on accept", async () => {
    const store = createSlfStore();
    const before = store.nexus.candidateCount();
    ingestSnapshot(store, GOLD_FIXTURES["09876543"], { now: NOW, generatedAt: NOW.toISOString() });
    const accepted = await acceptLead(store, "09876543");
    expect(accepted.ok).toBe(true);
    expect(accepted.lead?.bookLane).toBe("net_new");
    expect(accepted.lead?.score.primaryProduct).toBe("hmrc_distress");
    expect(store.nexus.candidateCount()).toBe(before + 1);
    expect(listQueue(store)).toHaveLength(0);
  });

  it("attaches a director mailbox on the book and stores net-new rows", () => {
    const store = createSlfStore();
    const result = ingestListRows(
      store,
      "operator_book.csv",
      [
        { email: "jane.ellis@acme.co.uk", companyNumber: "01234567", contactName: "Jane Ellis", name: "Acme Joinery Limited" },
        { email: "bob@newco.co.uk", companyNumber: "05555555", contactName: "Bob Smith", name: "Newco Ltd" },
      ],
      { "01234567": ["Jane Ellis"] }
    );
    expect(result.refused).toBe(false);
    expect(result.attached).toBe(1);
    expect(result.stored).toBe(1);
    expect(store.nexus.lookup({ companyNumber: "01234567" }).hit?.email).toBe("jane.ellis@acme.co.uk");
    expect(store.nexus.lookup({ companyNumber: "05555555" }).hit).toBeNull();
  });
});
