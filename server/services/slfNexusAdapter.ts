/**
 * nexus.adapter.v1 — the only Nexus client for SLF-2 and LST-2.
 * Field map: server/Lead Agent/config/nexus_map.yaml
 * Contract: docs/superpowers/specs/2026-09-07-nexus-adapter-design.md
 */
import type { AgenticDealFile } from "@shared/agenticWorkflow";
import {
  MockNexus,
  decideAction,
  padCompanyNumber,
  type AdapterAction,
  type AdapterActor,
  type AdapterResult,
  type AdapterWrite,
  type CanonicalCandidate,
} from "@shared/slfAdapter";
import {
  attachMailboxPatch,
  dealToCandidate,
  gatedSmeDraft,
  intelPatch,
  type DealBook,
} from "@shared/slfDealBook";
import { storage } from "../storage";

export {
  MockNexus,
  decideAction,
  type AdapterAction,
  type AdapterActor,
  type CanonicalCandidate,
};

type AgenticStorage = {
  listAgenticDeals(): Promise<AgenticDealFile[]>;
  createAgenticDeal(deal: Partial<AgenticDealFile>): Promise<AgenticDealFile>;
  updateAgenticDeal(id: number, updates: Partial<AgenticDealFile>): Promise<AgenticDealFile>;
  getAllUsers?(): Promise<Array<{ id: string; email?: string; role?: string }>>;
};

export class StorageDealBook implements DealBook {
  constructor(
    private db: AgenticStorage,
    private cache: AgenticDealFile[],
    private ownerUserId: string
  ) {}

  static async open(db: AgenticStorage = storage): Promise<StorageDealBook> {
    const cache = await db.listAgenticDeals();
    let ownerUserId = "slf.agent.v1";
    if (db.getAllUsers) {
      const users = await db.getAllUsers();
      const shaun = users.find((user) => (user.email || "").toLowerCase() === "shaun@veltro.co.uk");
      const admin = users.find((user) => user.role === "super_admin");
      ownerUserId = shaun?.id || admin?.id || users[0]?.id || ownerUserId;
    }
    return new StorageDealBook(db, cache, ownerUserId);
  }

  lookup(companyNumber: string): CanonicalCandidate | null {
    const number = padCompanyNumber(companyNumber);
    const deal = this.cache.find((row) => padCompanyNumber(String(row.companyNumber || "")) === number);
    return deal ? dealToCandidate(deal) : null;
  }

  async write(input: AdapterWrite): Promise<AdapterResult> {
    const number = padCompanyNumber(input.companyNumber);
    const existing = this.cache.find((row) => padCompanyNumber(String(row.companyNumber || "")) === number);

    if (input.action === "attach_mailbox") {
      if (!existing) return { ok: false, code: "404 not_on_book" };
      if (input.payload?.guessed) return { ok: false, code: "422 pecr_blocked" };
      const patch = attachMailboxPatch(existing, input.payload);
      const updated = await this.db.updateAgenticDeal(existing.id, patch);
      this.replace(updated);
      return { ok: true, nexusCandidateId: `deal:${updated.id}` };
    }

    if (input.action === "create") {
      if (existing) return { ok: false, code: "409 book_hit", nexusCandidateId: `deal:${existing.id}` };
      if (input.payload?.stream === "introducer") {
        const created = await this.db.createAgenticDeal({
          source: "distress_scan",
          stream: "introducer",
          hopper: "queued",
          stage: "outreach",
          status: "waiting_timer",
          ownerUserId: this.ownerUserId,
          companyName: String(input.payload?.name || ""),
          companyNumber: number,
          email: input.payload?.email,
          reachableCorporateContact: true,
          events: [
            {
              at: new Date().toISOString(),
              stage: "outreach",
              agent: "slf.refer.v1",
              message: "REF-2 reachable introducer — Stream B may enrol",
            },
          ],
        });
        this.replace(created);
        return { ok: true, nexusCandidateId: `deal:${created.id}` };
      }
      const draft = gatedSmeDraft({
        companyName: String(input.payload?.name || input.payload?.package?.account?.name || ""),
        companyNumber: number,
        ownerUserId: this.ownerUserId,
        package: input.payload?.package,
        liveNonBankCount: input.payload?.liveNonBankCount,
      });
      const created = await this.db.createAgenticDeal(draft);
      this.replace(created);
      return { ok: true, nexusCandidateId: `deal:${created.id}` };
    }

    if (!existing) return { ok: false, code: "404 not_on_book" };
    const patch = intelPatch(existing, input.action, input.payload);
    const updated = await this.db.updateAgenticDeal(existing.id, patch);
    this.replace(updated);
    return { ok: true, nexusCandidateId: `deal:${updated.id}` };
  }

  private replace(deal: AgenticDealFile): void {
    const index = this.cache.findIndex((row) => row.id === deal.id);
    if (index >= 0) this.cache[index] = deal;
    else this.cache.push(deal);
  }
}
