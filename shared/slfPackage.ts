import { createHash } from "crypto";
import { isPersonalMailbox } from "./pecrSend";
import type { SlfScoreResult } from "./slfScore";

export type SlfEvidence = {
  signalType: string;
  title: string;
  eventAt: string;
  url: string;
  excerpt?: string;
};

export type SlfPerson = {
  role?: string;
  name?: string;
  email?: string | null;
};

export type LeadPackage = {
  schema: "slf.lead_package.v1";
  package_id: string;
  generated_at: string;
  idempotency_key: string;
  action: "create" | "promote" | "enrich" | "intelligence_only";
  nexus_candidate_id?: string | null;
  book_lane: "existing_queue" | "net_new";
  account: {
    company_number: string;
    name: string;
    jurisdiction: "england-wales" | "scotland" | "northern-ireland";
    companies_house_url: string;
    sic?: string[];
  };
  fit: {
    score: number;
    priority: "hot" | "warm" | "watch";
    primary_product: "hmrc_distress" | "stacked_debt" | "high_cost_refi";
    hypothesis: string;
    why_us_now: string;
    urgency: "low" | "medium" | "high";
    possible_regulated?: boolean;
  };
  evidence: SlfEvidence[];
  people: SlfPerson[];
  outreach_brief: {
    channel_recommendation: Array<"phone" | "email" | "linkedin_official" | "introducer" | "none">;
    angle: string;
    opening_line: string;
    questions_to_ask: string[];
    compliance: {
      lawful_basis: "legitimate_interests_b2b" | "consent" | "not_established";
      pecr_category: "corporate_subscriber" | "individual_subscriber" | "unknown";
      soft_opt_in_applicable: boolean;
      suppression_checked_at: string;
      notes?: string;
    };
  };
  scoring: {
    total: number;
    breakdown: Record<string, number>;
    model_version: string;
  };
};

const YEAR_RE = /\b((?:19|20)\d{2})\b/g;

function evidenceBlob(evidence: SlfEvidence[]): string {
  return evidence
    .map((item) => `${item.title} ${item.excerpt || ""} ${item.eventAt} ${item.url}`)
    .join(" \n ");
}

function ungroundedDates(hypothesis: string, evidence: SlfEvidence[]): string[] {
  const blob = evidenceBlob(evidence);
  const years = [...(hypothesis.match(YEAR_RE) || [])];
  return [...new Set(years)].filter((year) => !blob.includes(year));
}

function packageHash(companyNumber: string, evidenceIds: string[], product: string): string {
  const body = `${companyNumber}|${[...evidenceIds].sort().join(",")}|${product}`;
  return createHash("sha1").update(body).digest("hex").slice(0, 8);
}

export function buildLeadPackage(input: {
  scored: SlfScoreResult;
  companyName: string;
  companyNumber: string;
  jurisdiction?: "england-wales" | "scotland" | "northern-ireland";
  action: LeadPackage["action"];
  bookLane: LeadPackage["book_lane"];
  nexusCandidateId?: string;
  evidence: SlfEvidence[];
  people?: SlfPerson[];
  hypothesis: string;
  whyUsNow: string;
  openingLine: string;
  questionsToAsk: string[];
  generatedAt: string;
}): LeadPackage {
  const people = input.people || [];
  const personalOnly =
    people.length > 0 && people.every((person) => person.email && isPersonalMailbox(person.email));
  const channels: LeadPackage["outreach_brief"]["channel_recommendation"] = personalOnly
    ? ["phone"]
    : ["phone", "email"];
  const product = input.scored.primaryProduct === "none" ? "high_cost_refi" : input.scored.primaryProduct;
  const hash = packageHash(
    input.companyNumber,
    input.evidence.map((item) => item.url),
    product
  );
  const priority = input.scored.priority === "hot" || input.scored.priority === "warm" || input.scored.priority === "watch"
    ? input.scored.priority
    : "watch";
  return {
    schema: "slf.lead_package.v1",
    package_id: `slf_${input.companyNumber}_${hash}`,
    generated_at: input.generatedAt,
    idempotency_key: `slf:${input.companyNumber}:${hash}`,
    action: input.action,
    nexus_candidate_id: input.nexusCandidateId || null,
    book_lane: input.bookLane,
    account: {
      company_number: input.companyNumber,
      name: input.companyName,
      jurisdiction: input.jurisdiction || "england-wales",
      companies_house_url: `https://find-and-update.company-information.service.gov.uk/company/${input.companyNumber}`,
    },
    fit: {
      score: input.scored.rank,
      priority,
      primary_product: product,
      hypothesis: input.hypothesis,
      why_us_now: input.whyUsNow,
      urgency: priority === "hot" ? "high" : priority === "warm" ? "medium" : "low",
    },
    evidence: input.evidence,
    people,
    outreach_brief: {
      channel_recommendation: channels,
      angle: product,
      opening_line: input.openingLine,
      questions_to_ask: input.questionsToAsk,
      compliance: {
        lawful_basis: "legitimate_interests_b2b",
        pecr_category: personalOnly ? "individual_subscriber" : "corporate_subscriber",
        soft_opt_in_applicable: false,
        suppression_checked_at: input.generatedAt,
        notes: personalOnly ? "no corporate mailbox on file" : undefined,
      },
    },
    scoring: {
      total: input.scored.rank,
      breakdown: input.scored.breakdown,
      model_version: "slf-score-stream-a-0.1",
    },
  };
}

export function validateLeadPackage(pkg: LeadPackage): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (pkg.schema !== "slf.lead_package.v1") errors.push("schema");
  if (!pkg.package_id?.startsWith("slf_")) errors.push("package_id");
  if (!pkg.account?.company_number || pkg.account.company_number.length < 6) errors.push("company_number");
  if (!pkg.evidence?.length) errors.push("evidence");
  if (!pkg.fit?.hypothesis || pkg.fit.hypothesis.length < 80) errors.push("hypothesis length");
  if (!["hmrc_distress", "stacked_debt", "high_cost_refi"].includes(pkg.fit?.primary_product)) {
    errors.push("primary_product");
  }
  if (pkg.book_lane === "existing_queue" && !pkg.nexus_candidate_id) {
    errors.push("nexus_candidate_id required on book-lane");
  }
  if (pkg.action === "create" && pkg.book_lane === "existing_queue") {
    errors.push("book-lane never create");
  }
  const missing = ungroundedDates(pkg.fit?.hypothesis || "", pkg.evidence || []);
  if (missing.length) errors.push(`grounding missing ${missing.join(", ")}`);
  const personalOnly =
    (pkg.people || []).length > 0 &&
    (pkg.people || []).every((person) => person.email && isPersonalMailbox(person.email));
  if (personalOnly && pkg.outreach_brief.channel_recommendation.includes("email")) {
    errors.push("PECR: email not allowed on personal gmail only");
  }
  if ((pkg.outreach_brief.questions_to_ask || []).length < 2) errors.push("questions_to_ask");
  return { ok: errors.length === 0, errors };
}
