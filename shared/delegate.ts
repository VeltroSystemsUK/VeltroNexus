import { AGENT_DIRECTORY } from "./agentMailboxes";
import type { AgenticDealFile } from "./agenticWorkflow";
import { HIBERNATED_DESKS } from "./deskOps";

export const DELEGATE_JOB_IDS = [
  "hunt",
  "match_company",
  "find_contact",
  "harvest_mailboxes",
  "triage_inbox",
  "retry_send",
  "chase_pack",
  "process_pack",
  "scan_week",
  "compose_week",
  "news_digest",
] as const;

export type DelegateJobId = (typeof DELEGATE_JOB_IDS)[number];

export type DelegateJob = {
  id: DelegateJobId;
  agentIds: string[];
  label: string;
  description: string;
  needsDeal: boolean;
};

export type DelegateDeal = Pick<
  AgenticDealFile,
  "id" | "stage" | "status" | "email" | "phone" | "humanReason" | "companyName"
>;

export const DELEGATE_JOBS: DelegateJob[] = [
  {
    id: "hunt",
    agentIds: ["database-builder", "database-builder-se"],
    label: "Hunt opportunities",
    description: "Queue up to 50 personalised SME first-touch drafts from Leads for director approval. Introducer hunt is paused.",
    needsDeal: false,
  },
  {
    id: "match_company",
    agentIds: ["inbound-intake"],
    label: "Match inbound company",
    description: "Run Companies House search on an inbound file that is still unmatched.",
    needsDeal: true,
  },
  {
    id: "find_contact",
    agentIds: ["contact-finder"],
    label: "Find contact",
    description: "Fill missing director name, email or phone on a file.",
    needsDeal: true,
  },
  {
    id: "harvest_mailboxes",
    agentIds: ["harvest"],
    label: "Harvest mailboxes",
    description: "Find and SMTP-verify company mailboxes on every real lead without an email.",
    needsDeal: false,
  },
  {
    id: "triage_inbox",
    agentIds: ["mailbox-clerk"],
    label: "Triage inbox",
    description: "Read the shared inbox. STOP is law. Bounces get a reason. Live replies go to Shaun.",
    needsDeal: false,
  },
  {
    id: "retry_send",
    agentIds: ["outreach-sales", "inbound-intake", "fulfilment-manager"],
    label: "Retry email send",
    description: "Try SMTP again on a file whose last send did not leave the box.",
    needsDeal: true,
  },
  {
    id: "chase_pack",
    agentIds: ["fulfilment-manager"],
    label: "Chase pack",
    description: "Send the next chase, or ingest if documents have already arrived.",
    needsDeal: true,
  },
  {
    id: "process_pack",
    agentIds: ["deal-processing-underwriter"],
    label: "Process pack",
    description: "Run the numbers and write a recommendation from sourced figures.",
    needsDeal: true,
  },
  {
    id: "scan_week",
    agentIds: ["content-scout"],
    label: "Scan week for content",
    description: "Refresh this week's Creative Ammo Briefs from the Strata desk and news.",
    needsDeal: false,
  },
  {
    id: "compose_week",
    agentIds: ["marketing-manager"],
    label: "Compose week",
    description: "Queue next week's Craft posts from the current briefs.",
    needsDeal: false,
  },
  {
    id: "news_digest",
    agentIds: ["reporter"],
    label: "Run news digest",
    description: "Draft today's UK Finance / Economy / Politics digests into Editorial.",
    needsDeal: false,
  },
];

// Casey, Isla, and Reporter run their own zero-arg Craft / Editorial jobs, not the
// deal-file pipeline, so they aren't in AGENT_DIRECTORY (the CRM mailbox roster).
const CONTENT_DESKS: Array<{ agentId: string; displayName: string; role: string }> = [
  { agentId: "content-scout", displayName: "Casey Wren", role: "Content Scout (MKT-3)" },
  { agentId: "marketing-manager", displayName: "Isla Quinn", role: "Marketing Director (MKT-2)" },
  { agentId: "reporter", displayName: "Reporter", role: "News Curator" },
];

function isHibernated(agentId: string): boolean {
  return HIBERNATED_DESKS.includes(agentId as (typeof HIBERNATED_DESKS)[number]);
}

export function liveDelegateDesks() {
  return [...AGENT_DIRECTORY.filter((desk) => !isHibernated(desk.agentId)), ...CONTENT_DESKS];
}

// Any live desk can run any job — agentIds on DELEGATE_JOBS is only a sort
// hint so a desk's usual job appears first in the picker.
export function jobsForAgent(agentId: string): DelegateJob[] {
  if (isHibernated(agentId)) return [];
  return [...DELEGATE_JOBS].sort((a, b) => {
    const aTypical = a.agentIds.includes(agentId) ? 0 : 1;
    const bTypical = b.agentIds.includes(agentId) ? 0 : 1;
    return aTypical - bTypical;
  });
}

export function getDelegateJob(agentId: string, jobId: string): DelegateJob | undefined {
  if (isHibernated(agentId)) return undefined;
  return DELEGATE_JOBS.find((job) => job.id === jobId);
}

export function isDealEligible(jobId: DelegateJobId, deal: DelegateDeal): boolean {
  if (deal.status === "complete" || deal.status === "failed") return false;
  switch (jobId) {
    case "hunt":
      return false;
    case "match_company":
      return deal.stage === "ingest" || deal.stage === "company_match";
    case "find_contact":
      return !deal.email || !deal.phone;
    case "harvest_mailboxes":
      return false;
    case "triage_inbox":
      return false;
    case "retry_send":
      return /smtp|did not send/i.test(deal.humanReason || "");
    case "chase_pack":
      return deal.stage === "fulfilment";
    case "process_pack":
      return (
        (deal.stage === "processing" || deal.stage === "underwriting") &&
        deal.status !== "waiting_human"
      );
    case "scan_week":
    case "compose_week":
    case "news_digest":
      return false;
  }
}

export function eligibleDeals(jobId: DelegateJobId, deals: DelegateDeal[]): DelegateDeal[] {
  if (!DELEGATE_JOBS.some((job) => job.id === jobId && job.needsDeal)) return [];
  return deals.filter((deal) => isDealEligible(jobId, deal));
}
