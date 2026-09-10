import type { AgenticDealFile } from "./agenticWorkflow";
import { isLiveSigned } from "./engagementPack";
import { SME_FOLLOWUP_DELAY_MS } from "./smeOpenFollowUp";

export type FactoryNodeKind = "trigger" | "auto" | "human" | "gate" | "output" | "fail";

export type FactoryNodeDef = {
  id: string;
  label: string;
  desk: string;
  kind: FactoryNodeKind;
  detail: string;
  x: number;
  y: number;
};

export type FactoryEdgeDef = {
  id: string;
  source: string;
  target: string;
  label?: string;
};

/** The live Strata factory — one graph, same stages as Deal files. */
export const FACTORY_NODES: FactoryNodeDef[] = [
  { id: "inbound", label: "Inbound enquiry", desk: "Maya", kind: "trigger", detail: "stratafinance.co.uk", x: 0, y: 80 },
  { id: "hunt", label: "Hunt / Gazette", desk: "Daniel", kind: "trigger", detail: "Client Agent — CH + HMRC petitions, SME only", x: 0, y: 280 },
  { id: "hunt-introducer", label: "Hunt introducers", desk: "Tom", kind: "trigger", detail: "Refer Agent — accountants, CFOs, turnaround advisers", x: 0, y: 480 },
  { id: "introducer-contact", label: "No contact? Retry", desk: "Tom", kind: "gate", detail: "Needs an email or phone before it counts", x: 280, y: 480 },
  { id: "introducer-pipeline", label: "Introducer pipeline", desk: "ORC-1", kind: "output", detail: "Identified → Contacted → Approved", x: 560, y: 480 },
  { id: "fit", label: "Strata fit gate", desk: "ORC-1", kind: "gate", detail: "Score ≥ 70 · SIG-06 out", x: 280, y: 180 },
  { id: "reject", label: "Do not contact", desk: "ORC-1", kind: "fail", detail: "Broker / SIC / fit fail", x: 560, y: 420 },
  { id: "match", label: "Companies House match", desk: "Maya", kind: "auto", detail: "You pick if ambiguous", x: 560, y: 180 },
  { id: "contact", label: "Complete contact", desk: "Elena", kind: "auto", detail: "Places / scrape / officers", x: 840, y: 180 },
  { id: "pecr", label: "PECR check", desk: "James", kind: "gate", detail: "No personal mailboxes", x: 1120, y: 80 },
  { id: "email", label: "Cadence email", desk: "James", kind: "auto", detail: "SMTP must deliver", x: 1400, y: 80 },
  { id: "sme-open", label: "sme_open", desk: "James", kind: "auto", detail: "On open → Explore quiz", x: 1540, y: 160 },
  { id: "explore-gate", label: "Explore enquiry?", desk: "James", kind: "gate", detail: "Matching inbound skip", x: 1820, y: 160 },
  { id: "sme-followup", label: "sme_followup", desk: "James", kind: "auto", detail: "+2 days → Learn", x: 2100, y: 160 },
  { id: "linkedin", label: "LinkedIn copy", desk: "You", kind: "human", detail: "You post, then continue", x: 1680, y: 0 },
  { id: "smtp-hold", label: "Mail not delivered", desk: "You", kind: "fail", detail: "Mock or SMTP fail", x: 1680, y: 200 },
  { id: "pack", label: "Pack portal", desk: "Customer", kind: "auto", detail: "Required Sterling list", x: 1400, y: 280 },
  { id: "fulfil", label: "Chase / timer", desk: "Sophie", kind: "auto", detail: "Names the gaps", x: 1680, y: 360 },
  { id: "call", label: "Call queue", desk: "You", kind: "human", detail: "Script on the file", x: 1960, y: 480 },
  { id: "ingest", label: "Ingest → SFP", desk: "Priya", kind: "auto", detail: "No invented figures", x: 1960, y: 280 },
  { id: "partial", label: "SFP PARTIAL", desk: "Sophie", kind: "gate", detail: "Chase missing items", x: 2240, y: 160 },
  { id: "complete", label: "SFP COMPLETE", desk: "Priya", kind: "gate", detail: "Sourced numbers only", x: 2240, y: 360 },
  { id: "credit", label: "Credit memo", desk: "You", kind: "human", detail: "Approve recommendation", x: 2520, y: 360 },
  { id: "engagement", label: "Engagement letter", desk: "Customer", kind: "human", detail: "E-sign Sterling terms before the pack leaves", x: 2660, y: 360 },
  { id: "sterling", label: "Sterling zip", desk: "ORC-1", kind: "output", detail: "Blocked until signed", x: 2940, y: 360 },
  { id: "david", label: "David", desk: "Sterling", kind: "output", detail: "Lender recommendation", x: 3220, y: 360 },
  { id: "parked", label: "Parked / stopped", desk: "ORC-1", kind: "fail", detail: "Opt-out, no pack, BBB fail", x: 2240, y: 520 },
  { id: "brand-review", label: "Quarterly brand review", desk: "Isla", kind: "trigger", detail: "30-asset consistency audit against the gate · sets next quarter's brand decisions", x: 0, y: 560 },
  { id: "brand-system", label: "Govern brand & visual identity", desk: "Isla", kind: "auto", detail: "Logo, colour, type, imagery, motion — the standard every asset, and Frankie's feed, works to", x: 280, y: 560 },
  { id: "lead-magnet", label: "Design lead magnet", desk: "Isla", kind: "auto", detail: "Landing page, cover, 5-email sequence, conversion target", x: 560, y: 560 },
  { id: "mkt-scan", label: "Scan week", desk: "Casey", kind: "trigger", detail: "Strata desk only · stacked / HMRC TTP / CDFI · Firecrawl", x: 0, y: 700 },
  { id: "mkt-hunt", label: "Hunt stills", desk: "Kit", kind: "trigger", detail: "Unsplash · Pexels · Openverse · Firecrawl", x: 0, y: 880 },
  { id: "mkt-compose", label: "Compose week", desk: "Isla", kind: "auto", detail: "Craft queue · Unbounded hero · weekday look", x: 280, y: 700 },
  { id: "mkt-email", label: "Email template", desk: "Isla", kind: "auto", detail: "Same compositor · merge tags · My Uploads", x: 560, y: 880 },
  { id: "mkt-approve", label: "Marketing approve", desk: "You", kind: "human", detail: "Copy on /craft", x: 560, y: 700 },
  { id: "mkt-compliance", label: "Compliance sign-off", desk: "You", kind: "gate", detail: "Packager · no rates · no payday", x: 840, y: 700 },
  { id: "mkt-export", label: "Export pack", desk: "Isla", kind: "output", detail: "PNG / story / square / OG", x: 1120, y: 700 },
  { id: "mkt-post", label: "You post", desk: "You", kind: "human", detail: "Never auto-post", x: 1400, y: 700 },
  { id: "mkt-send", label: "You send campaign", desk: "You", kind: "human", detail: "Email stays draft until you send", x: 840, y: 880 },
  { id: "mkt-editorial-scan", label: "Topic scan", desk: "Casey", kind: "trigger", detail: "Editorial · Firecrawl official UK hosts", x: 0, y: 1060 },
  { id: "mkt-editorial-compose", label: "Compose article", desk: "Isla", kind: "auto", detail: "Blog / press release · Markdown", x: 280, y: 1060 },
  { id: "mkt-editorial-approve", label: "Marketing approve", desk: "You", kind: "human", detail: "Copy on /editorial", x: 560, y: 1060 },
  { id: "mkt-editorial-compliance", label: "Compliance sign-off", desk: "You", kind: "gate", detail: "Packager · no rates · no payday", x: 840, y: 1060 },
  { id: "mkt-editorial-export", label: "Export article", desk: "Isla", kind: "output", detail: "Markdown / HTML", x: 1120, y: 1060 },
  { id: "news-scan", label: "News digest scan", desk: "Reporter", kind: "trigger", detail: "06:00 daily · UK Finance / Economy / Politics · source-grounded, drafts only", x: 0, y: 1240 },
  { id: "social-scan", label: "Trend & inbox scan", desk: "Frankie", kind: "trigger", detail: "SOCIAL-1 · BrowserOS (read-only) + Firecrawl · sentiment, comments, DMs", x: 0, y: 1420 },
  { id: "social-draft", label: "Draft posts & replies", desk: "Frankie", kind: "auto", detail: "5 pillars · reply doctrine · connection scoring — never posts, replies, or connects live", x: 280, y: 1420 },
  { id: "social-post", label: "You post / reply / connect", desk: "You", kind: "human", detail: "Every LinkedIn / Reddit / Facebook / Instagram write action by hand", x: 560, y: 1420 },
];

export const FACTORY_EDGES: FactoryEdgeDef[] = [
  { id: "e-in-fit", source: "inbound", target: "fit", label: "always open" },
  { id: "e-hunt-fit", source: "hunt", target: "fit" },
  { id: "e-hunt-intro-contact", source: "hunt-introducer", target: "introducer-contact" },
  { id: "e-intro-contact-pipeline", source: "introducer-contact", target: "introducer-pipeline", label: "has email/phone" },
  { id: "e-intro-contact-retry", source: "introducer-contact", target: "hunt-introducer", label: "no contact, retry tomorrow" },
  { id: "e-fit-reject", source: "fit", target: "reject", label: "fail" },
  { id: "e-fit-match", source: "fit", target: "match", label: "pass" },
  { id: "e-match-contact", source: "match", target: "contact" },
  { id: "e-contact-pecr", source: "contact", target: "pecr" },
  { id: "e-pecr-email", source: "pecr", target: "email", label: "corporate" },
  { id: "e-pecr-hold", source: "pecr", target: "smtp-hold", label: "personal" },
  { id: "e-email-sme-open", source: "email", target: "sme-open", label: "on open" },
  { id: "e-sme-open-gate", source: "sme-open", target: "explore-gate", label: "after 2 days" },
  { id: "e-explore-followup", source: "explore-gate", target: "sme-followup", label: "no enquiry" },
  { id: "e-explore-inbound", source: "explore-gate", target: "inbound", label: "enquired" },
  { id: "e-email-li", source: "email", target: "linkedin", label: "day 4 / 5" },
  { id: "e-email-smtp", source: "email", target: "smtp-hold", label: "not sent" },
  { id: "e-in-pack", source: "inbound", target: "pack", label: "ack + link" },
  { id: "e-email-pack", source: "email", target: "pack" },
  { id: "e-li-fulfil", source: "linkedin", target: "fulfil", label: "posted" },
  { id: "e-pack-fulfil", source: "pack", target: "fulfil" },
  { id: "e-fulfil-call", source: "fulfil", target: "call", label: "queue call" },
  { id: "e-fulfil-ingest", source: "fulfil", target: "ingest", label: "files landed" },
  { id: "e-call-ingest", source: "call", target: "ingest", label: "pack on file" },
  { id: "e-call-park", source: "call", target: "parked", label: "no pack" },
  { id: "e-ingest-partial", source: "ingest", target: "partial" },
  { id: "e-ingest-complete", source: "ingest", target: "complete" },
  { id: "e-partial-fulfil", source: "partial", target: "fulfil", label: "chase" },
  { id: "e-complete-credit", source: "complete", target: "credit" },
  { id: "e-credit-engagement", source: "credit", target: "engagement" },
  { id: "e-engagement-sterling", source: "engagement", target: "sterling" },
  { id: "e-sterling-david", source: "sterling", target: "david" },
  { id: "e-mkt-scan-compose", source: "mkt-scan", target: "mkt-compose", label: "ammo" },
  { id: "e-mkt-hunt-compose", source: "mkt-hunt", target: "mkt-compose", label: "stills" },
  { id: "e-mkt-compose-approve", source: "mkt-compose", target: "mkt-approve" },
  { id: "e-mkt-compose-email", source: "mkt-compose", target: "mkt-email", label: "same engine" },
  { id: "e-mkt-approve-comp", source: "mkt-approve", target: "mkt-compliance" },
  { id: "e-mkt-comp-export", source: "mkt-compliance", target: "mkt-export" },
  { id: "e-mkt-export-post", source: "mkt-export", target: "mkt-post" },
  { id: "e-mkt-email-send", source: "mkt-email", target: "mkt-send" },
  { id: "e-mkt-ed-scan-compose", source: "mkt-editorial-scan", target: "mkt-editorial-compose", label: "notes" },
  { id: "e-mkt-ed-compose-approve", source: "mkt-editorial-compose", target: "mkt-editorial-approve" },
  { id: "e-mkt-ed-approve-comp", source: "mkt-editorial-approve", target: "mkt-editorial-compliance" },
  { id: "e-mkt-ed-comp-export", source: "mkt-editorial-compliance", target: "mkt-editorial-export" },
  { id: "e-mkt-ed-export-post", source: "mkt-editorial-export", target: "mkt-post", label: "you publish" },
  { id: "e-news-scan-approve", source: "news-scan", target: "mkt-editorial-approve", label: "daily digest" },
  { id: "e-social-scan-draft", source: "social-scan", target: "social-draft", label: "trend log" },
  { id: "e-social-draft-post", source: "social-draft", target: "social-post", label: "sign-off" },
  { id: "e-brand-review-system", source: "brand-review", target: "brand-system", label: "quarterly decisions" },
  { id: "e-brand-system-compose", source: "brand-system", target: "mkt-compose", label: "visual / tonal standard" },
  { id: "e-brand-system-social", source: "brand-system", target: "social-draft", label: "templates, hook style guide, OG sets" },
  { id: "e-lead-magnet-approve", source: "lead-magnet", target: "mkt-approve", label: "landing page + sequence" },
];

function smeSideTouchNode(
  deal: Partial<Pick<AgenticDealFile, "smeOpenFollowUpSentAt" | "smeFollowupSentAt">>
): "sme-open" | "sme-followup" | null {
  if (deal.smeFollowupSentAt) return null;
  const sentAt = Date.parse(String(deal.smeOpenFollowUpSentAt || ""));
  if (!Number.isFinite(sentAt)) return null;
  if (Date.now() - sentAt >= SME_FOLLOWUP_DELAY_MS) return "sme-followup";
  return "sme-open";
}

export function nodeForDeal(
  deal: Pick<AgenticDealFile, "stage" | "status" | "source" | "humanReason" | "sfp" | "stream"> &
    Partial<Pick<AgenticDealFile, "email" | "phone" | "sterlingHandoffId" | "smeOpenFollowUpSentAt" | "smeFollowupSentAt" | "engagement">>
): string {
  const reason = deal.humanReason || "";
  if (deal.status === "failed") {
    if (/fit|sig-06|broker|do not contact/i.test(reason)) return "reject";
    return "parked";
  }
  // Introducer-stream deals never touch the direct-borrower chain below — they exit
  // through their own three nodes, or "complete" here would wrongly collide with
  // "reached Sterling".
  if (deal.stream === "introducer") {
    if (deal.stage === "ingest" || deal.stage === "company_match") return "hunt-introducer";
    if (!deal.email && !deal.phone) return "introducer-contact";
    return "introducer-pipeline";
  }
  if (/pecr|personal mailbox/i.test(reason)) return "pecr";
  if (reason.includes("SMTP") || reason.includes("not send") || /not delivered/i.test(reason)) return "smtp-hold";
  if (reason.includes("LinkedIn")) return "linkedin";
  switch (deal.stage) {
    case "ingest":
    case "company_match":
      return deal.source === "strata_inbound" ? "inbound" : "hunt";
    case "enrich":
      return "contact";
    case "pipeline":
      return deal.source === "strata_inbound" ? "pack" : "contact";
    case "outreach":
      return smeSideTouchNode(deal) || "email";
    case "fulfilment":
      if (deal.sfp?.status === "PARTIAL") return "partial";
      if (deal.source === "strata_inbound") return "pack";
      return smeSideTouchNode(deal) || "fulfil";
    case "human_call":
      return "call";
    case "processing":
      return "ingest";
    case "underwriting":
      return "complete";
    case "human_review":
      return "credit";
    case "complete":
      if (deal.sterlingHandoffId) return "david";
      if (!isLiveSigned(deal.engagement)) return "engagement";
      return "sterling";
    default:
      return "parked";
  }
}

export function countDealsOnNodes(
  deals: Array<Parameters<typeof nodeForDeal>[0]>
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const node of FACTORY_NODES) counts[node.id] = 0;
  for (const deal of deals) {
    const id = nodeForDeal(deal);
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}
