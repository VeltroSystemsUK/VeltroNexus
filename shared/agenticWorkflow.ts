export const AGENTIC_STAGES = [
  "ingest",
  "company_match",
  "enrich",
  "pipeline",
  "outreach",
  "fulfilment",
  "human_call",
  "processing",
  "underwriting",
  "human_review",
  "complete",
  "failed",
] as const;

export type AgenticStage = (typeof AGENTIC_STAGES)[number];

export type AgenticStatus = "running" | "waiting_human" | "waiting_timer" | "complete" | "failed";

export type AgenticSource = "strata_inbound" | "distress_scan";
export type AgenticStream = "sme" | "introducer" | "inbound";

export interface AgenticCompanyCandidate {
  companyName: string;
  companyNumber: string;
  companyStatus: string;
  address?: string;
}

export interface AgenticEvent {
  at: string;
  stage: AgenticStage;
  agent?: string;
  message: string;
}

export type PackDocumentCategory =
  | "bank_statements"
  | "audited_accounts"
  | "other"
  | "bank-statements"
  | "accounts"
  | "management-accounts"
  | "cashflow"
  | "debt-schedule"
  | "id"
  | "proof-of-address"
  | "company-search"
  | "application-form"
  | "sal"
  | "use-of-funds"
  | "hmrc"
  | "insurance"
  | "business-plan";

export interface PackDocument {
  id: string;
  category: PackDocumentCategory;
  fileName: string;
  fileSize: number;
  fileType: string;
  storagePath: string;
  uploadedAt: string;
}

export interface AgenticDealFile {
  id: number;
  source: AgenticSource;
  stream?: AgenticStream;
  stage: AgenticStage;
  status: AgenticStatus;
  ownerUserId: string;
  internalLeadId?: number;
  prospectId?: number;
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  loanAmount?: number;
  companyNumber?: string;
  companyCandidates?: AgenticCompanyCandidate[];
  placeName?: string;
  placeAddress?: string;
  website?: string;
  waitUntil?: string;
  humanReason?: string;
  outreachSubject?: string;
  outreachBody?: string;
  outreachTouch?: number;
  outreachTouchId?: string;
  smeOpenFollowUpSentAt?: string;
  smeFollowupSentAt?: string;
  socialPlaybook?: { network: "linkedin"; action: string; message: string };
  callPlaybook?: import("./strataOutreach").CallPlaybook;
  bbbEligibility?: import("./bbbEligibility").BbbAssessment;
  processingSummary?: string;
  underwritingJudgement?: string;
  fitScore?: number;
  fitReasons?: string[];
  fitSummary?: string;
  petition?: {
    kind: "hmrc_winding_up";
    publishedAt: string;
    hearingAt?: string;
    presentedAt?: string;
    gazetteUrl?: string;
    caseNumber?: string;
  };
  hopper?: "gated" | "hunt_contact" | "sendable" | "parked" | "queued" | "quarantine";
  reachableCorporateContact?: boolean;
  mailboxGrade?: "director" | "role";
  attachAttempts?: number;
  nonBankChargeCount?: number;
  chargeHolders?: string[];
  lastSignalAt?: string;
  contactSource?: "ch" | "places" | "firecrawl" | "domain" | "osint" | "wayback";
  mailboxConfidence?: number;
  directorNames?: string[];
  incorporatedAt?: string;
  uploadToken?: string;
  packDocuments?: PackDocument[];
  fundingReason?: string;
  packReceivedAt?: string;
  sfp?: import("./sfp").StandardFinancialProfile;
  sterlingHandoffId?: number;
  engagement?: import("./engagementPack").EngagementState;
  applicationData?: import("./applicationDataFields").ApplicationDataState;
  events: AgenticEvent[];
  createdAt: string;
  updatedAt: string;
}

export function isNoiseDeal(deal: Pick<AgenticDealFile, "companyName" | "ownerUserId">): boolean {
  const owner = String(deal.ownerUserId || "").toLowerCase();
  if (owner === "pack-upload-test" || owner.startsWith("test-") || owner === "system-test") return true;
  return /pack upload test|mock deal|\bscratch\b|seed test/i.test(String(deal.companyName || ""));
}

export const STAGE_LABELS: Record<AgenticStage, string> = {
  ingest: "Inbound review",
  company_match: "Companies House match",
  enrich: "Google Places enrich",
  pipeline: "Prospect Pipeline",
  outreach: "Sales outreach",
  fulfilment: "Fulfilment chase",
  human_call: "Warm call on a live inbound",
  processing: "Processing analysis",
  underwriting: "Underwriting judgement",
  human_review: "Review before Sterling",
  complete: "Complete",
  failed: "Stopped",
};

export const STAGE_AGENT: Partial<Record<AgenticStage, string>> = {
  ingest: "inbound-intake",
  company_match: "inbound-intake",
  enrich: "contact-finder",
  pipeline: "inbound-intake",
  outreach: "outreach-sales",
  fulfilment: "fulfilment-manager",
  processing: "deal-processing-underwriter",
  underwriting: "deal-processing-underwriter",
};

export type TickKind = "fulfilment" | "introducer_retry" | "outreach_retry";

export function tickKindForDeal(
  deal: Pick<AgenticDealFile, "stage" | "status"> & Partial<Pick<AgenticDealFile, "stream" | "source">>
): TickKind | null {
  if (deal.status !== "waiting_timer") return null;
  if (deal.stage === "fulfilment") return "fulfilment";
  if (deal.stage === "outreach") {
    return deal.stream === "introducer" ? "introducer_retry" : "outreach_retry";
  }
  return null;
}

export function cadenceRetryIndex(outreachTouch?: number | null): number {
  return outreachTouch || 0;
}

export type PackMissingDisposition = "keep_chasing" | "approve_introducer" | "wait_human";

export function packMissingDisposition(
  deal: Partial<Pick<AgenticDealFile, "source" | "stream" | "sfp" | "packDocuments">>
): PackMissingDisposition {
  if (deal.stream === "introducer") return "approve_introducer";
  if (deal.source === "strata_inbound") return "keep_chasing";
  if (deal.sfp?.status === "PARTIAL") return "keep_chasing";
  if ((deal.packDocuments || []).length > 0) return "keep_chasing";
  return "wait_human";
}

export function shouldReprocessPack(deal: {
  packDocuments?: Array<unknown>;
  extraDocCount?: number;
  sfp?: { status?: string; documents?: Array<unknown> } | null;
}): boolean {
  const fileCount = (deal.packDocuments?.length || 0) + (deal.extraDocCount || 0);
  if (fileCount <= 0) return false;
  if (deal.sfp?.status === "COMPLETE") return true;
  const seen = deal.sfp?.documents?.length || 0;
  if (fileCount > seen) return true;
  return deal.sfp?.status !== "PARTIAL";
}

export type IntroducerPipelineStatus = "none" | "new" | "contacted" | "approved";

export function introducerPipelineStatus(input: {
  hasContact: boolean;
  outreachTouch?: number | null;
  stage?: string | null;
  callDone?: boolean;
}): IntroducerPipelineStatus {
  if (!input.hasContact) return "none";
  if (input.stage === "complete" || input.callDone) return "approved";
  if ((input.outreachTouch || 0) >= 1) return "contacted";
  return "new";
}
