import type { SlfPriority } from "./slfScore";

export type AdapterActor = "slf.agent.v1" | "slf.list.v1";
export type AdapterAction =
  | "create"
  | "promote"
  | "enrich"
  | "intelligence_only"
  | "attach_mailbox"
  | "suppress"
  | "store_in_list_product_only";

export type CanonicalStatus =
  | "prospective"
  | "queued"
  | "nurture"
  | "contacted"
  | "meeting"
  | "packaging"
  | "won"
  | "lost"
  | "dnc"
  | "invalid";

export type CanonicalCandidate = {
  nexusCandidateId: string;
  companyNumber: string;
  name?: string;
  status: CanonicalStatus;
  statusRaw?: string;
  source?: string;
  doNotContact?: boolean;
  lostDoNotRetry?: boolean;
  wonAt?: string | null;
  email?: string | null;
  mailboxType?: string | null;
  hopperSend?: boolean;
};

export function decideAction(input: {
  actor: AdapterActor;
  book: CanonicalCandidate | null;
  priority?: SlfPriority | string;
}): AdapterAction {
  if (input.actor === "slf.list.v1") {
    return input.book ? "attach_mailbox" : "store_in_list_product_only";
  }

  const book = input.book;
  if (!book) return "create";
  if (book.source === "strata_inbound") return "intelligence_only";
  if (book.doNotContact || book.lostDoNotRetry || book.status === "dnc") return "suppress";
  if (book.status === "meeting" || book.status === "packaging") return "intelligence_only";
  if (book.status === "won") return "intelligence_only";
  if (
    (book.status === "prospective" || book.status === "queued" || book.status === "nurture") &&
    (input.priority === "hot" || input.priority === "warm")
  ) {
    return "promote";
  }
  return "enrich";
}

export type AdapterWrite = {
  action: AdapterAction;
  actor: AdapterActor;
  companyNumber: string;
  idempotencyKey: string;
  payload?: Record<string, any>;
};

export type AdapterResult = {
  ok: boolean;
  nexusCandidateId?: string;
  code?: string;
  replayed?: boolean;
};

export function padCompanyNumber(value: string): string {
  const raw = String(value || "").trim().toUpperCase();
  if (/^\d+$/.test(raw) && raw.length < 8) return raw.padStart(8, "0");
  return raw;
}

export class MockNexus {
  private rows = new Map<string, CanonicalCandidate>();
  private byNumber = new Map<string, string>();
  private idempotency = new Map<string, AdapterResult>();
  private nextId = 5000;

  static seeded(): MockNexus {
    const nexus = new MockNexus();
    nexus.upsert({
      nexusCandidateId: "deal:4418",
      companyNumber: "01234567",
      name: "ACME JOINERY LIMITED",
      status: "prospective",
      statusRaw: "gated",
    });
    nexus.upsert({
      nexusCandidateId: "deal:4419",
      companyNumber: "01111111",
      name: "CONTACTED LTD",
      status: "contacted",
    });
    nexus.upsert({
      nexusCandidateId: "deal:4420",
      companyNumber: "02222222",
      name: "PACKAGING LTD",
      status: "packaging",
    });
    nexus.upsert({
      nexusCandidateId: "deal:4421",
      companyNumber: "03333333",
      name: "DNC LTD",
      status: "dnc",
      doNotContact: true,
    });
    return nexus;
  }

  upsert(row: CanonicalCandidate): void {
    const number = padCompanyNumber(row.companyNumber);
    const next = { ...row, companyNumber: number };
    this.rows.set(next.nexusCandidateId, next);
    this.byNumber.set(number, next.nexusCandidateId);
  }

  candidateCount(): number {
    return this.rows.size;
  }

  rowsFor(companyNumber: string): CanonicalCandidate[] {
    const id = this.byNumber.get(padCompanyNumber(companyNumber));
    if (!id) return [];
    const row = this.rows.get(id);
    return row ? [row] : [];
  }

  lookup(input: { nexusCandidateId?: string; companyNumber?: string }): {
    hit: CanonicalCandidate | null;
    confidence: number;
  } {
    if (input.nexusCandidateId && this.rows.has(input.nexusCandidateId)) {
      return { hit: this.rows.get(input.nexusCandidateId) || null, confidence: 1 };
    }
    if (input.companyNumber) {
      const id = this.byNumber.get(padCompanyNumber(input.companyNumber));
      if (id) return { hit: this.rows.get(id) || null, confidence: 1 };
    }
    return { hit: null, confidence: 0 };
  }

  disposition(input: { companyNumber: string; status: CanonicalStatus }): void {
    const found = this.lookup({ companyNumber: input.companyNumber }).hit;
    if (!found) return;
    found.status = input.status;
    if (input.status === "dnc") found.doNotContact = true;
    this.upsert(found);
  }

  toJSON(): { rows: CanonicalCandidate[]; nextId: number } {
    return { rows: [...this.rows.values()], nextId: this.nextId };
  }

  static fromJSON(state?: { rows?: CanonicalCandidate[]; nextId?: number }): MockNexus {
    const nexus = new MockNexus();
    if (state?.nextId) nexus.nextId = state.nextId;
    for (const row of state?.rows || []) nexus.upsert(row);
    if (!state?.rows?.length) return MockNexus.seeded();
    return nexus;
  }

  write(input: AdapterWrite): AdapterResult {
    const prior = this.idempotency.get(input.idempotencyKey);
    if (prior) return { ...prior, replayed: true };

    const number = padCompanyNumber(input.companyNumber);
    const existing = this.lookup({ companyNumber: number }).hit;

    if (input.action === "create") {
      if (existing) {
        const result: AdapterResult = { ok: false, code: "409 book_hit", nexusCandidateId: existing.nexusCandidateId };
        return result;
      }
      const id = `deal:${this.nextId++}`;
      this.upsert({
        nexusCandidateId: id,
        companyNumber: number,
        name: String(input.payload?.name || ""),
        status: "queued",
        statusRaw: "gated",
      });
      const result: AdapterResult = { ok: true, nexusCandidateId: id };
      this.idempotency.set(input.idempotencyKey, result);
      return result;
    }

    if (input.action === "attach_mailbox") {
      if (!existing) return { ok: false, code: "404 not_on_book" };
      if (input.payload?.guessed) return { ok: false, code: "422 pecr_blocked" };
      existing.email = String(input.payload?.email || existing.email || "");
      existing.mailboxType = String(input.payload?.mailboxType || "");
      existing.hopperSend = false;
      this.upsert(existing);
      const result: AdapterResult = { ok: true, nexusCandidateId: existing.nexusCandidateId };
      this.idempotency.set(input.idempotencyKey, result);
      return result;
    }

    if (!existing) return { ok: false, code: "404 not_on_book" };

    const result: AdapterResult = { ok: true, nexusCandidateId: existing.nexusCandidateId };
    this.idempotency.set(input.idempotencyKey, result);
    return result;
  }
}
