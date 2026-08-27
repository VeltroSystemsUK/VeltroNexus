import type { AgenticDealFile } from "./agenticWorkflow";

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
  { id: "hunt", label: "Hunt / Gazette", desk: "Daniel", kind: "trigger", detail: "CH + HMRC petitions", x: 0, y: 280 },
  { id: "fit", label: "Strata fit gate", desk: "ORC-1", kind: "gate", detail: "Score ≥ 70 · SIG-06 out", x: 280, y: 180 },
  { id: "reject", label: "Do not contact", desk: "ORC-1", kind: "fail", detail: "Broker / SIC / fit fail", x: 560, y: 420 },
  { id: "match", label: "Companies House match", desk: "Maya", kind: "auto", detail: "You pick if ambiguous", x: 560, y: 180 },
  { id: "contact", label: "Complete contact", desk: "Elena", kind: "auto", detail: "Places / scrape / officers", x: 840, y: 180 },
  { id: "pecr", label: "PECR check", desk: "James", kind: "gate", detail: "No personal mailboxes", x: 1120, y: 80 },
  { id: "email", label: "Cadence email", desk: "James", kind: "auto", detail: "SMTP must deliver", x: 1400, y: 80 },
  { id: "linkedin", label: "LinkedIn copy", desk: "You", kind: "human", detail: "You post, then continue", x: 1680, y: 0 },
  { id: "smtp-hold", label: "Mail not delivered", desk: "You", kind: "fail", detail: "Mock or SMTP fail", x: 1680, y: 200 },
  { id: "pack", label: "Pack portal", desk: "Customer", kind: "auto", detail: "Required Sterling list", x: 1400, y: 280 },
  { id: "fulfil", label: "Chase / timer", desk: "Sophie", kind: "auto", detail: "Names the gaps", x: 1680, y: 360 },
  { id: "call", label: "Call queue", desk: "You", kind: "human", detail: "Script on the file", x: 1960, y: 480 },
  { id: "ingest", label: "Ingest → SFP", desk: "Priya", kind: "auto", detail: "No invented figures", x: 1960, y: 280 },
  { id: "partial", label: "SFP PARTIAL", desk: "Sophie", kind: "gate", detail: "Chase missing items", x: 2240, y: 160 },
  { id: "complete", label: "SFP COMPLETE", desk: "Priya", kind: "gate", detail: "Sourced numbers only", x: 2240, y: 360 },
  { id: "credit", label: "Credit memo", desk: "You", kind: "human", detail: "Approve recommendation", x: 2520, y: 360 },
  { id: "sterling", label: "Sterling zip", desk: "ORC-1", kind: "output", detail: "Blocked if incomplete", x: 2800, y: 360 },
  { id: "david", label: "David", desk: "Sterling", kind: "output", detail: "Lender recommendation", x: 3080, y: 360 },
  { id: "parked", label: "Parked / stopped", desk: "ORC-1", kind: "fail", detail: "Opt-out, no pack, BBB fail", x: 2240, y: 520 },
];

export const FACTORY_EDGES: FactoryEdgeDef[] = [
  { id: "e-in-fit", source: "inbound", target: "fit", label: "always open" },
  { id: "e-hunt-fit", source: "hunt", target: "fit" },
  { id: "e-fit-reject", source: "fit", target: "reject", label: "fail" },
  { id: "e-fit-match", source: "fit", target: "match", label: "pass" },
  { id: "e-match-contact", source: "match", target: "contact" },
  { id: "e-contact-pecr", source: "contact", target: "pecr" },
  { id: "e-pecr-email", source: "pecr", target: "email", label: "corporate" },
  { id: "e-pecr-hold", source: "pecr", target: "smtp-hold", label: "personal" },
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
  { id: "e-credit-sterling", source: "credit", target: "sterling" },
  { id: "e-sterling-david", source: "sterling", target: "david" },
];

export function nodeForDeal(deal: Pick<AgenticDealFile, "stage" | "status" | "source" | "humanReason" | "sfp">): string {
  if (deal.status === "failed") return "parked";
  if (deal.humanReason?.includes("SMTP") || deal.humanReason?.includes("not send")) return "smtp-hold";
  if (deal.humanReason?.includes("LinkedIn")) return "linkedin";
  if (deal.humanReason?.toLowerCase().includes("pecr") || deal.humanReason?.includes("personal mailbox")) return "smtp-hold";
  switch (deal.stage) {
    case "ingest":
    case "company_match":
      return deal.source === "strata_inbound" ? "inbound" : "hunt";
    case "enrich":
    case "pipeline":
      return "contact";
    case "outreach":
      return "email";
    case "fulfilment":
      return deal.sfp?.status === "PARTIAL" ? "partial" : "fulfil";
    case "human_call":
      return "call";
    case "processing":
    case "underwriting":
      return "ingest";
    case "human_review":
      return "credit";
    case "complete":
      return "sterling";
    default:
      return "parked";
  }
}

export function countDealsOnNodes(
  deals: Array<Pick<AgenticDealFile, "stage" | "status" | "source" | "humanReason" | "sfp">>
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const node of FACTORY_NODES) counts[node.id] = 0;
  for (const deal of deals) {
    const id = nodeForDeal(deal);
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}
