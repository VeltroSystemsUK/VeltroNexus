import type { AgenticDealFile, AgenticEvent } from "./agenticWorkflow";
import {
  decideAction,
  padCompanyNumber,
  type AdapterResult,
  type AdapterWrite,
  type CanonicalCandidate,
  type CanonicalStatus,
} from "./slfAdapter";

export type DealLike = Partial<AgenticDealFile> & {
  id?: number;
  companyName?: string;
  companyNumber?: string;
  hopper?: AgenticDealFile["hopper"];
  stage?: AgenticDealFile["stage"];
  status?: AgenticDealFile["status"];
  stream?: AgenticDealFile["stream"];
  source?: AgenticDealFile["source"] | string;
  outreachTouch?: number | null;
  events?: AgenticEvent[];
};

export function canonicalStatusFromDeal(deal: DealLike): CanonicalStatus {
  const stage = String(deal.stage || "");
  const hopper = String(deal.hopper || "");
  if (stage === "complete") return "won";
  if (stage === "failed") return "lost";
  if (stage === "human_call") return "meeting";
  if (["fulfilment", "processing", "underwriting", "human_review"].includes(stage)) return "packaging";
  if (stage === "outreach" || (deal.outreachTouch || 0) >= 1) return "contacted";
  if (hopper === "parked") return "nurture";
  if (hopper === "sendable" || hopper === "queued") return "queued";
  return "prospective";
}

export function dealToCandidate(deal: DealLike): CanonicalCandidate {
  const id = deal.id ?? 0;
  return {
    nexusCandidateId: `deal:${id}`,
    companyNumber: padCompanyNumber(String(deal.companyNumber || "")),
    name: deal.companyName,
    status: canonicalStatusFromDeal(deal),
    statusRaw: deal.hopper || deal.stage,
    source: deal.source,
    email: deal.email,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function slfEvent(stage: AgenticDealFile["stage"], message: string): AgenticEvent {
  return { at: nowIso(), stage, agent: "slf.agent.v1", message };
}

export class MemoryDealBook {
  deals: AgenticDealFile[] = [];
  private nextId = 1;
  private idempotency = new Map<string, AdapterResult>();

  lookup(companyNumber: string): CanonicalCandidate | null {
    const number = padCompanyNumber(companyNumber);
    const deal = this.deals.find((row) => padCompanyNumber(String(row.companyNumber || "")) === number);
    return deal ? dealToCandidate(deal) : null;
  }

  create(fields: Partial<AgenticDealFile>): AgenticDealFile {
    const id = this.nextId++;
    const deal = {
      source: "distress_scan" as const,
      stage: "ingest" as const,
      status: "waiting_timer" as const,
      ownerUserId: "slf.agent.v1",
      companyName: "",
      events: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...fields,
      id,
      companyNumber: fields.companyNumber ? padCompanyNumber(fields.companyNumber) : fields.companyNumber,
    } as AgenticDealFile;
    this.deals.push(deal);
    return deal;
  }

  createGatedSme(input: { companyName: string; companyNumber: string }): AgenticDealFile {
    return this.create({
      source: "distress_scan",
      stream: "sme",
      hopper: "gated",
      stage: "ingest",
      status: "waiting_timer",
      ownerUserId: "slf.agent.v1",
      companyName: input.companyName,
      companyNumber: padCompanyNumber(input.companyNumber),
      events: [],
    });
  }

  write(input: AdapterWrite): AdapterResult {
    const prior = this.idempotency.get(input.idempotencyKey);
    if (prior) return { ...prior, replayed: true };

    const number = padCompanyNumber(input.companyNumber);
    const existing = this.deals.find((row) => padCompanyNumber(String(row.companyNumber || "")) === number);

    if (input.action === "attach_mailbox") {
      if (!existing) return { ok: false, code: "404 not_on_book" };
      if (input.payload?.guessed) return { ok: false, code: "422 pecr_blocked" };
      existing.email = String(input.payload?.email || existing.email || "");
      existing.contactName = input.payload?.contactName || existing.contactName;
      if (input.payload?.mailboxType === "director" || input.payload?.mailboxType === "role") {
        existing.mailboxGrade = input.payload.mailboxType;
      }
      existing.updatedAt = nowIso();
      existing.events = [
        ...(existing.events || []),
        slfEvent(existing.stage, `LST-2 attached ${existing.email} (${input.payload?.mailboxType || "mailbox"})`),
      ];
      const result = { ok: true, nexusCandidateId: `deal:${existing.id}` };
      this.idempotency.set(input.idempotencyKey, result);
      return result;
    }

    if (input.action === "create") {
      if (existing) return { ok: false, code: "409 book_hit", nexusCandidateId: `deal:${existing.id}` };
      if (input.payload?.stream === "introducer") {
        const deal = this.create({
          source: "distress_scan",
          stream: "introducer",
          hopper: "queued",
          stage: "outreach",
          status: "waiting_timer",
          ownerUserId: "slf.refer.v1",
          companyName: String(input.payload?.name || ""),
          companyNumber: number,
          email: input.payload?.email,
          reachableCorporateContact: true,
          events: [slfEvent("outreach", "REF-2 reachable introducer — Stream B may enrol")],
        });
        const result = { ok: true, nexusCandidateId: `deal:${deal.id}` };
        this.idempotency.set(input.idempotencyKey, result);
        return result;
      }
      const pkg = input.payload?.package;
      const deal = this.createGatedSme({
        companyName: String(input.payload?.name || pkg?.account?.name || ""),
        companyNumber: number,
      });
      deal.fitScore = pkg?.fit?.score;
      deal.fitSummary = pkg?.fit?.why_us_now;
      deal.fitReasons = [pkg?.fit?.primary_product, pkg?.fit?.hypothesis].filter(Boolean);
      deal.nonBankChargeCount = input.payload?.liveNonBankCount;
      if (pkg?.fit?.primary_product === "hmrc_distress") {
        deal.petition = {
          kind: "hmrc_winding_up",
          publishedAt: pkg?.evidence?.[0]?.eventAt || nowIso(),
          gazetteUrl: pkg?.evidence?.[0]?.url,
        };
      }
      deal.events = [slfEvent("ingest", `SLF-2 create ${pkg?.fit?.primary_product || ""} — ${pkg?.fit?.why_us_now || "accepted"}`)];
      const result = { ok: true, nexusCandidateId: `deal:${deal.id}` };
      this.idempotency.set(input.idempotencyKey, result);
      return result;
    }

    if (!existing) return { ok: false, code: "404 not_on_book" };

    const pkg = input.payload?.package;
    existing.updatedAt = nowIso();
    if (input.action !== "intelligence_only") {
      if (pkg?.fit?.score != null) existing.fitScore = pkg.fit.score;
      if (pkg?.fit?.why_us_now) existing.fitSummary = pkg.fit.why_us_now;
    }
    existing.events = [
      ...(existing.events || []),
      slfEvent(
        existing.stage,
        `SLF-2 ${input.action} ${pkg?.fit?.primary_product || ""} — ${pkg?.fit?.why_us_now || input.action}`
      ),
    ];
    const result = { ok: true, nexusCandidateId: `deal:${existing.id}` };
    this.idempotency.set(input.idempotencyKey, result);
    return result;
  }
}

export type DealBook = {
  lookup(companyNumber: string): CanonicalCandidate | null;
  write(input: AdapterWrite): AdapterResult | Promise<AdapterResult>;
};

export function gatedSmeDraft(input: {
  companyName: string;
  companyNumber: string;
  ownerUserId?: string;
  package?: any;
  liveNonBankCount?: number;
}): Partial<AgenticDealFile> {
  const pkg = input.package;
  const draft: Partial<AgenticDealFile> = {
    source: "distress_scan",
    stream: "sme",
    hopper: "gated",
    stage: "ingest",
    status: "waiting_timer",
    ownerUserId: input.ownerUserId || "slf.agent.v1",
    companyName: input.companyName,
    companyNumber: padCompanyNumber(input.companyNumber),
    fitScore: pkg?.fit?.score,
    fitSummary: pkg?.fit?.why_us_now,
    fitReasons: [pkg?.fit?.primary_product, pkg?.fit?.hypothesis].filter(Boolean),
    nonBankChargeCount: input.liveNonBankCount,
    events: [slfEvent("ingest", `SLF-2 create ${pkg?.fit?.primary_product || ""} — ${pkg?.fit?.why_us_now || "accepted"}`)],
  };
  if (pkg?.fit?.primary_product === "hmrc_distress") {
    draft.petition = {
      kind: "hmrc_winding_up",
      publishedAt: pkg?.evidence?.[0]?.eventAt || nowIso(),
      gazetteUrl: pkg?.evidence?.[0]?.url,
    };
  }
  return draft;
}

export function attachMailboxPatch(deal: DealLike, payload: Record<string, any> | undefined): Partial<AgenticDealFile> {
  const email = String(payload?.email || deal.email || "");
  const mailboxType = payload?.mailboxType;
  return {
    email,
    contactName: payload?.contactName || deal.contactName,
    mailboxGrade: mailboxType === "director" || mailboxType === "role" ? mailboxType : deal.mailboxGrade,
    events: [
      ...(deal.events || []),
      slfEvent((deal.stage as AgenticDealFile["stage"]) || "ingest", `LST-2 attached ${email} (${mailboxType || "mailbox"})`),
    ],
  };
}

export function intelPatch(deal: DealLike, action: string, payload: Record<string, any> | undefined): Partial<AgenticDealFile> {
  const pkg = payload?.package;
  const patch: Partial<AgenticDealFile> = {
    events: [
      ...(deal.events || []),
      slfEvent(
        (deal.stage as AgenticDealFile["stage"]) || "ingest",
        `SLF-2 ${action} ${pkg?.fit?.primary_product || ""} — ${pkg?.fit?.why_us_now || action}`
      ),
    ],
  };
  if (action !== "intelligence_only") {
    if (pkg?.fit?.score != null) patch.fitScore = pkg.fit.score;
    if (pkg?.fit?.why_us_now) patch.fitSummary = pkg.fit.why_us_now;
  }
  return patch;
}

export function resolveSlfAction(input: {
  actor: AdapterWrite["actor"];
  book: CanonicalCandidate | null;
  priority?: string;
}): AdapterWrite["action"] {
  let action = decideAction({ actor: input.actor, book: input.book, priority: input.priority });
  if (action === "create" && input.book) action = "promote";
  return action;
}
