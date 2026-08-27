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
  uploadToken?: string;
  packDocuments?: PackDocument[];
  fundingReason?: string;
  packReceivedAt?: string;
  sfp?: import("./sfp").StandardFinancialProfile;
  sterlingHandoffId?: number;
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
