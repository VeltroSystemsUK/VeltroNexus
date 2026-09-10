import { MockNexus, type CanonicalCandidate } from "./slfAdapter";
import { resolveSlfAction, type DealBook } from "./slfDealBook";
import { buildLeadPackage, validateLeadPackage, type LeadPackage, type SlfEvidence } from "./slfPackage";
import { scoreCompanySnapshot, type SlfCharge, type SlfScoreResult, type SlfSnapshot } from "./slfScore";
import { decideListAttach, gradeListRow, refuseListFile, type ListGrade } from "./slfList";
import { buildReferRecord, type ReferInput, type ReferRecord } from "./slfRefer";

export type SlfLeadStatus =
  | "scored"
  | "queued"
  | "accepted"
  | "rejected"
  | "pushed"
  | "suppressed"
  | "unresolved"
  | "noise";

export type SlfLeadRecord = {
  companyNumber: string;
  companyName: string;
  status: SlfLeadStatus;
  bookLane: "existing_queue" | "net_new";
  nexusCandidateId?: string;
  score: SlfScoreResult;
  package?: LeadPackage;
  rejectReason?: string;
};

export type SlfStore = {
  leads: Record<string, SlfLeadRecord>;
  refers: Record<string, ReferRecord>;
  nexus: MockNexus;
};

export function createSlfStore(nexus = MockNexus.seeded()): SlfStore {
  return { leads: {}, refers: {}, nexus };
}

export function mapChCharges(raw: any): SlfCharge[] {
  const items = Array.isArray(raw) ? raw : raw?.items || [];
  return items.map((item: any) => ({
    status: item.status || item.charge_status,
    createdOn: item.created_on || item.createdOn,
    satisfiedOn: item.satisfied_on || item.satisfiedOn,
    personsEntitled: (item.persons_entitled || item.personsEntitled || []).map((person: any) =>
      typeof person === "string" ? person : person?.name
    ),
  }));
}

function templateHypothesis(input: { name: string; number: string; score: SlfScoreResult; evidence: SlfEvidence[] }): string {
  const product = input.score.primaryProduct;
  const first = input.evidence[0];
  const when = first?.eventAt || "the public file";
  if (product === "hmrc_distress") {
    return `${input.name} (${input.number}) has a Gazette winding-up petition dated ${when}. The company is still on the register. Highest-probability need is a refinance or standstill conversation while the petition is live.`;
  }
  if (product === "stacked_debt") {
    return `${input.name} (${input.number}) has ${input.score.liveNonBankCount} live non-bank charges on Companies House, including ${first?.excerpt || "specialist lenders"}. That stack is a Stream A timing signal for a CDFI refinance conversation now.`;
  }
  return `${input.name} (${input.number}) still has an outstanding non-bank charge recorded ${when}. ${first?.excerpt || "The person entitled is a specialist lender."} That is a Stream A high-cost refinance signal, not a company-exists lead.`;
}

function templateOpening(score: SlfScoreResult, evidence: SlfEvidence[]): string {
  if (score.primaryProduct === "hmrc_distress") {
    return "Wanted to check whether you are running a refinance or standstill conversation while the petition is live — happy to look at options if useful.";
  }
  const excerpt = evidence[0]?.excerpt || "the live non-bank charge";
  return `Saw ${excerpt} on the public file — are you looking at a term refinance of that facility?`;
}

export function ingestSnapshot(
  store: SlfStore,
  snapshot: SlfSnapshot,
  opts?: { now?: Date; generatedAt?: string; dealBook?: DealBook }
): SlfLeadRecord {
  const now = opts?.now || new Date();
  const generatedAt = opts?.generatedAt || now.toISOString();
  const score = scoreCompanySnapshot(snapshot, now);
  const number = String(snapshot.companyNumber || "").trim();
  const book = opts?.dealBook?.lookup(number) || store.nexus.lookup({ companyNumber: number }).hit;
  const bookLane = book ? "existing_queue" : "net_new";

  let status: SlfLeadStatus = "queued";
  if (score.gate === "drop") status = "noise";
  else if (score.gate === "suppress") status = "suppressed";
  else if (score.gate === "unresolved") status = "unresolved";
  else if (score.gate === "noise") status = "noise";

  const evidence: SlfEvidence[] = score.signals.map((signal) => ({
    signalType: signal.signalType,
    title: signal.signalType,
    eventAt: signal.eventAt || generatedAt.slice(0, 10),
    url:
      signal.signalType.startsWith("gazette")
        ? `https://www.thegazette.co.uk/notice/${number || "unresolved"}`
        : `https://find-and-update.company-information.service.gov.uk/company/${number || "unknown"}/charges`,
    excerpt: signal.signalType.replace(/\./g, " "),
  }));

  const record: SlfLeadRecord = {
    companyNumber: number || snapshot.companyName,
    companyName: snapshot.companyName,
    status,
    bookLane,
    nexusCandidateId: book?.nexusCandidateId,
    score,
  };

  if (status === "queued" && number) {
    const pkg = buildLeadPackage({
      scored: score,
      companyName: snapshot.companyName,
      companyNumber: number,
      action: book ? "promote" : "create",
      bookLane,
      nexusCandidateId: book?.nexusCandidateId,
      evidence: evidence.length
        ? evidence
        : [
            {
              signalType: "manual.operator_flag",
              title: "ingest",
              eventAt: generatedAt.slice(0, 10),
              url: `https://find-and-update.company-information.service.gov.uk/company/${number}`,
              excerpt: "operator ingest",
            },
          ],
      hypothesis: templateHypothesis({
        name: snapshot.companyName,
        number,
        score,
        evidence,
      }),
      whyUsNow: score.primaryProduct === "hmrc_distress" ? "Gazette petition on the public file." : "Live non-bank charge on Companies House.",
      openingLine: templateOpening(score, evidence),
      questionsToAsk: ["What facilities are live?", "Is HMRC Time to Pay already in place?", "Who is the incumbent lender?"],
      generatedAt,
    });
    record.package = pkg;
  }

  store.leads[record.companyNumber] = record;
  return record;
}

export function listQueue(store: SlfStore, priority?: string): SlfLeadRecord[] {
  return Object.values(store.leads)
    .filter((lead) => lead.status === "queued")
    .filter((lead) => !priority || lead.score.priority === priority)
    .sort((a, b) => b.score.rank - a.score.rank);
}

export async function acceptLead(
  store: SlfStore,
  companyNumber: string,
  dealBook?: DealBook
): Promise<{ ok: boolean; error?: string; lead?: SlfLeadRecord }> {
  const lead = store.leads[companyNumber];
  if (!lead) return { ok: false, error: "not found" };
  if (lead.status !== "queued" || !lead.package) return { ok: false, error: "not queued" };
  const check = validateLeadPackage(lead.package);
  if (!check.ok) return { ok: false, error: check.errors.join("; ") };

  const live = dealBook?.lookup(companyNumber) || store.nexus.lookup({ companyNumber }).hit;
  const action = resolveSlfAction({
    actor: "slf.agent.v1",
    book: live,
    priority: lead.score.priority,
  });
  if (action === "suppress") {
    lead.status = "suppressed";
    return { ok: false, error: "suppressed", lead };
  }
  if (action === "create" && (lead.bookLane === "existing_queue" || live)) {
    return { ok: false, error: "book-lane never create", lead };
  }

  const payload = {
    name: lead.companyName,
    package: lead.package,
    liveNonBankCount: lead.score.liveNonBankCount,
  };
  const writeInput = {
    action: action === "create" || action === "promote" || action === "enrich" || action === "intelligence_only" ? action : "enrich",
    actor: "slf.agent.v1" as const,
    companyNumber,
    idempotencyKey: lead.package.idempotency_key,
    payload,
  };
  const write = await Promise.resolve((dealBook || store.nexus).write(writeInput));
  if (!write.ok) return { ok: false, error: write.code, lead };
  if (dealBook) await Promise.resolve(store.nexus.write(writeInput));
  lead.status = "pushed";
  lead.nexusCandidateId = write.nexusCandidateId;
  lead.package.nexus_candidate_id = write.nexusCandidateId;
  lead.package.action = writeInput.action;
  return { ok: true, lead };
}

export function rejectLead(store: SlfStore, companyNumber: string, reason: string): SlfLeadRecord | null {
  const lead = store.leads[companyNumber];
  if (!lead) return null;
  lead.status = "rejected";
  lead.rejectReason = reason;
  return lead;
}

export type ListIngestRow = {
  email?: string;
  companyNumber?: string;
  name?: string;
  contactName?: string;
};

export function ingestListRows(
  store: SlfStore,
  filename: string,
  rows: ListIngestRow[],
  directorsByNumber: Record<string, string[]> = {},
  dealBook?: DealBook
): {
  refused: boolean;
  blockedClass?: string;
  attached: number;
  stored: number;
  grades: Record<string, number>;
} {
  const refusal = refuseListFile(filename, rows);
  if (refusal.refused) {
    return { refused: true, blockedClass: refusal.blockedClass, attached: 0, stored: 0, grades: {} };
  }
  const grades: Record<string, number> = {};
  let attached = 0;
  let stored = 0;
  for (const row of rows) {
    if (!row.email) continue;
    const book = row.companyNumber
      ? dealBook?.lookup(row.companyNumber) || store.nexus.lookup({ companyNumber: row.companyNumber }).hit
      : null;
    const graded = gradeListRow({
      email: row.email,
      companyNumber: row.companyNumber,
      contactName: row.contactName,
      directorNames: row.companyNumber ? directorsByNumber[row.companyNumber] : undefined,
      companyName: row.name,
      verificationStatus: "deliverable",
      guessed: false,
      hasDirectorMailbox: false,
    });
    grades[graded.grade] = (grades[graded.grade] || 0) + 1;
    const action = decideListAttach({ onBook: !!book, grade: graded.grade as ListGrade });
    if (action === "attach_mailbox" && row.companyNumber && graded.attach) {
      const writeInput = {
        action: "attach_mailbox" as const,
        actor: "slf.list.v1" as const,
        companyNumber: row.companyNumber,
        idempotencyKey: `slf-list:${row.companyNumber}:${row.email.toLowerCase()}:${new Date().toISOString().slice(0, 10)}`,
        payload: {
          email: row.email,
          mailboxType: graded.mailboxType,
          guessed: false,
          isPrimary: graded.isPrimary,
          contactName: row.contactName,
        },
      };
      const write = (dealBook || store.nexus).write(writeInput);
      if (dealBook && write.ok) store.nexus.write(writeInput);
      if (write.ok) attached += 1;
      else stored += 1;
    } else {
      stored += 1;
    }
  }
  return { refused: false, attached, stored, grades };
}

export const GOLD_FIXTURES: Record<string, SlfSnapshot> = {
  "01234567": {
    companyName: "Acme Joinery Limited",
    companyNumber: "01234567",
    companyStatus: "active",
    dateOfCreation: "2019-04-01",
    sicCodes: ["43320"],
    resolutionConfidence: 1,
    charges: [{ status: "outstanding", createdOn: "2025-01-15", personsEntitled: ["IWOCA LIMITED"] }],
  },
  "09876543": {
    companyName: "Oxbow Coldstores Limited",
    companyNumber: "09876543",
    companyStatus: "active",
    dateOfCreation: "2014-02-01",
    sicCodes: ["52103"],
    resolutionConfidence: 1,
    hasPetition: true,
    petitionAt: "2026-09-06",
    charges: [],
  },
  "07777777": {
    companyName: "Stacked Haulage Ltd",
    companyNumber: "07777777",
    companyStatus: "active",
    dateOfCreation: "2016-01-01",
    sicCodes: ["49410"],
    resolutionConfidence: 1,
    charges: [
      { status: "outstanding", createdOn: "2024-01-01", personsEntitled: ["IWOCA LIMITED"] },
      { status: "outstanding", createdOn: "2024-06-01", personsEntitled: ["YOULEND LIMITED"] },
      { status: "outstanding", createdOn: "2025-02-01", personsEntitled: ["FLEXIMIZE LIMITED"] },
    ],
  },
};

export const GOLD_REFER: Record<string, ReferInput> = {
  "04440000": {
    introducerName: "Hartley Accountants Ltd",
    introducerNumber: "04440000",
    sicCodes: ["69201"],
    domain: "hartleyaccountants.co.uk",
    mailbox: "enquiries@hartleyaccountants.co.uk",
    mailboxType: "role",
    listGrade: "A-role",
    pecrCategory: "corporate_subscriber",
    resolutionConfidence: 1,
  },
};

export function ingestRefer(store: SlfStore, input: ReferInput): ReferRecord {
  const record = buildReferRecord(input);
  const key = record.introducer_company_number || record.introducer_name;
  store.refers[key] = record;
  return record;
}

export async function acceptRefer(
  store: SlfStore,
  companyNumber: string,
  dealBook?: DealBook
): Promise<{ ok: boolean; error?: string; record?: ReferRecord; nexusCandidateId?: string }> {
  const record = store.refers[companyNumber];
  if (!record) return { ok: false, error: "not found" };
  if (!record.reachable_corporate_contact) return { ok: false, error: record.hold_reason || "not reachable" };

  const existing = dealBook?.lookup(companyNumber);
  if (existing?.source && existing.source !== "distress_scan" && existing.source === "strata_inbound") {
    return { ok: false, error: "same_entity_or_inbound" };
  }
  if (existing && String(existing.source) !== "slf_refer" && existing.status && existing.status !== "prospective" && existing.status !== "queued" && existing.status !== "nurture") {
    /* still enrich mailbox, do not re-enrol */
  }

  if (!dealBook) {
    return { ok: true, record, nexusCandidateId: record.nexus_candidate_id || undefined };
  }

  const live = dealBook.lookup(companyNumber);
  if (live) {
    const write = await Promise.resolve(
      dealBook.write({
        action: "attach_mailbox",
        actor: "slf.list.v1",
        companyNumber,
        idempotencyKey: `slf-refer:${companyNumber}:${record.mailbox}:${new Date().toISOString().slice(0, 10)}`,
        payload: { email: record.mailbox, mailboxType: "role", guessed: false },
      })
    );
    record.nexus_candidate_id = write.nexusCandidateId || live.nexusCandidateId;
    return { ok: write.ok, error: write.code, record, nexusCandidateId: record.nexus_candidate_id || undefined };
  }

  const created = await Promise.resolve(
    dealBook.write({
      action: "create",
      actor: "slf.agent.v1",
      companyNumber,
      idempotencyKey: `slf-refer-create:${companyNumber}`,
      payload: {
        name: record.introducer_name,
        stream: "introducer",
        email: record.mailbox,
        reachableCorporateContact: true,
      },
    })
  );
  if (!created.ok) return { ok: false, error: created.code, record };
  record.nexus_candidate_id = created.nexusCandidateId;
  return { ok: true, record, nexusCandidateId: created.nexusCandidateId };
}

export function lookupBook(store: SlfStore, companyNumber: string): CanonicalCandidate | null {
  return store.nexus.lookup({ companyNumber }).hit;
}
