export type SmtpProbe = "deliverable" | "user_unknown" | "unknown";
export type CatchAllStatus = "catch_all" | "not_catch_all" | "unknown";
export type MxFamily = "google" | "microsoft" | "mimecast" | "proofpoint" | "other";
export type MailboxEvidenceSource = "ch" | "places" | "firecrawl" | "domain" | "osint" | "wayback";

export const MAILBOX_SEND_FLOOR = 75;

export function mxFamily(mxHost?: string | null): MxFamily {
  const host = String(mxHost || "").toLowerCase();
  if (/google|googlemail|aspmx/.test(host)) return "google";
  if (/outlook|protection\.outlook|microsoft/.test(host)) return "microsoft";
  if (/mimecast/.test(host)) return "mimecast";
  if (/pphosted|proofpoint/.test(host)) return "proofpoint";
  return "other";
}

export function mxFamilyFromHosts(hosts: string[]): MxFamily {
  for (const host of hosts) {
    const family = mxFamily(host);
    if (family !== "other") return family;
  }
  return "other";
}

export function smtpTrusted(family: MxFamily): boolean {
  return family === "other";
}

export function catchAllStatus(probes: SmtpProbe[]): CatchAllStatus {
  if (probes.length < 2) return "unknown";
  if (probes.some((probe) => probe === "unknown")) return "unknown";
  if (probes.every((probe) => probe === "deliverable")) return "catch_all";
  if (probes.every((probe) => probe === "user_unknown")) return "not_catch_all";
  return "unknown";
}

export function mailboxConfidence(input: {
  source: MailboxEvidenceSource;
  mx: boolean;
  smtp?: SmtpProbe | null;
  catchAll?: CatchAllStatus | null;
  citedOnDomain: number;
  mxFamily?: MxFamily;
}): number {
  if (!input.mx) return 0;
  const cited = input.source !== "domain";
  if (cited) return 95;
  const mute = Boolean(input.mxFamily && !smtpTrusted(input.mxFamily));
  if (input.source === "domain" && mute) return 75;
  const smtp = input.mxFamily && !smtpTrusted(input.mxFamily) ? "unknown" : input.smtp || "unknown";
  const catchAll = input.mxFamily && !smtpTrusted(input.mxFamily) ? "unknown" : input.catchAll || "unknown";

  if (smtp === "user_unknown") return 10;
  if (smtp === "deliverable" && catchAll === "not_catch_all") return 95;
  if ((catchAll === "catch_all" || smtp === "unknown") && input.citedOnDomain >= 2) return 80;
  return 50;
}
