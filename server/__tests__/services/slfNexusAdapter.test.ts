import { describe, expect, it } from "vitest";
import { StorageDealBook } from "../../services/slfNexusAdapter";
import type { AgenticDealFile } from "@shared/agenticWorkflow";

function fakeStorage(seed: Partial<AgenticDealFile>[] = []) {
  const rows: AgenticDealFile[] = seed.map((row, i) => ({
    id: i + 1,
    source: "distress_scan",
    stream: "sme",
    stage: "ingest",
    status: "waiting_timer",
    ownerUserId: "shaun",
    companyName: "Seed",
    events: [],
    createdAt: "",
    updatedAt: "",
    ...row,
  })) as AgenticDealFile[];
  let next = rows.length + 1;
  return {
    rows,
    async listAgenticDeals() {
      return rows;
    },
    async createAgenticDeal(deal: Partial<AgenticDealFile>) {
      const created = { id: next++, events: [], ...deal } as AgenticDealFile;
      rows.push(created);
      return created;
    },
    async updateAgenticDeal(id: number, updates: Partial<AgenticDealFile>) {
      const index = rows.findIndex((row) => row.id === id);
      rows[index] = { ...rows[index], ...updates, id };
      return rows[index];
    },
    async getAllUsers() {
      return [{ id: "shaun", email: "shaun@veltro.co.uk", role: "super_admin" }];
    },
  };
}

describe("StorageDealBook", () => {
  it("creates a gated SME deal for a net-new accept", async () => {
    const db = fakeStorage();
    const book = await StorageDealBook.open(db);
    const result = await book.write({
      action: "create",
      actor: "slf.agent.v1",
      companyNumber: "09876543",
      idempotencyKey: "slf:09876543:test",
      payload: {
        name: "Oxbow Coldstores Limited",
        liveNonBankCount: 0,
        package: {
          fit: { score: 95, primary_product: "hmrc_distress", why_us_now: "Gazette petition." },
          evidence: [{ eventAt: "2026-09-06", url: "https://www.thegazette.co.uk/notice/1" }],
        },
      },
    });
    expect(result.ok).toBe(true);
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0].hopper).toBe("gated");
    expect(db.rows[0].stream).toBe("sme");
    expect(db.rows[0].companyNumber).toBe("09876543");
    expect(db.rows[0].petition?.kind).toBe("hmrc_winding_up");
  });

  it("refuses to create a second deal for a company already on the book", async () => {
    const db = fakeStorage([
      { companyName: "Acme Joinery Limited", companyNumber: "01234567", hopper: "gated", stream: "sme" },
    ]);
    const book = await StorageDealBook.open(db);
    const result = await book.write({
      action: "create",
      actor: "slf.agent.v1",
      companyNumber: "01234567",
      idempotencyKey: "slf:01234567:dup",
      payload: { name: "Acme Joinery Limited" },
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("409 book_hit");
    expect(db.rows).toHaveLength(1);
  });
});
