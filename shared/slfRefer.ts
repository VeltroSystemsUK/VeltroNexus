import { isBrokerProspect, looksLikeIntroducer } from "./salesOs";
import { isPersonalMailbox } from "./pecrSend";
import { isRoleMailbox } from "./smeHopper";
import { padCompanyNumber } from "./slfAdapter";
import type { ListGrade } from "./slfList";

export type IntroducerType = "accountant" | "ip" | "solicitor" | "broker" | "other";

export type ReferHoldReason =
  | "no_company_number"
  | "unresolved_name"
  | "no_domain"
  | "no_published_mailbox"
  | "mailbox_not_grade_a"
  | "catch_all_only"
  | "personal_webmail"
  | "pecr_individual"
  | "same_entity_as_sme"
  | "own_firm"
  | "already_dnc"
  | "not_an_introducer"
  | "named_work_not_allowed";

export type ReferRecord = {
  schema: "slf.refer_record.v1";
  refer_id: string;
  introducer_company_number: string;
  introducer_name: string;
  introducer_type: IntroducerType | null;
  domain: string | null;
  reachable_corporate_contact: boolean;
  mailbox: string | null;
  mailbox_type: "role" | "named_work" | "personal_webmail" | "drop" | null;
  list_grade: ListGrade | null;
  pecr_category: "corporate_subscriber" | "individual_subscriber" | "unknown";
  pipeline: "introducer";
  related_sme: string[];
  related_sme_mode: "optional_context";
  hold_reason: ReferHoldReason | null;
  nexus_candidate_id?: string | null;
};

export type ReferInput = {
  introducerName: string;
  introducerNumber?: string;
  sicCodes?: string[];
  domain?: string | null;
  mailbox?: string | null;
  mailboxType?: "role" | "named_work" | "personal_webmail" | "drop" | "director";
  listGrade?: ListGrade | null;
  pecrCategory?: ReferRecord["pecr_category"];
  resolutionConfidence?: number;
  relatedSme?: string[];
  ownNumbers?: string[];
  dnc?: boolean;
  nexusCandidateId?: string | null;
  allowNamedWork?: boolean;
};

export function classifyIntroducer(input: { name: string; sicCodes?: string[] }): {
  type: IntroducerType | null;
  holdReason: ReferHoldReason | null;
} {
  if (isBrokerProspect(input.name, input.sicCodes)) {
    return { type: null, holdReason: "not_an_introducer" };
  }
  if (!looksLikeIntroducer(input.name, input.sicCodes)) {
    return { type: null, holdReason: "not_an_introducer" };
  }
  if (/\b(insolvency|turnaround|restructuring)\b/i.test(input.name)) return { type: "ip", holdReason: null };
  if (/\b(solicitor|law\s+firm)\b/i.test(input.name)) return { type: "solicitor", holdReason: null };
  return { type: "accountant", holdReason: null };
}

export function isReferReachable(input: ReferInput): { ok: boolean; reason: ReferHoldReason | null } {
  const classified = classifyIntroducer({ name: input.introducerName, sicCodes: input.sicCodes });
  if (classified.holdReason) return { ok: false, reason: classified.holdReason };

  const number = padCompanyNumber(input.introducerNumber || "");
  if (!number || (input.resolutionConfidence ?? 0) < 0.9) return { ok: false, reason: "no_company_number" };

  const own = (input.ownNumbers || []).map(padCompanyNumber);
  if (own.includes(number)) return { ok: false, reason: "own_firm" };

  const related = (input.relatedSme || []).map(padCompanyNumber);
  if (related.includes(number)) return { ok: false, reason: "same_entity_as_sme" };

  if (input.dnc) return { ok: false, reason: "already_dnc" };
  if (!input.domain) return { ok: false, reason: "no_domain" };
  if (!input.mailbox) return { ok: false, reason: "no_published_mailbox" };
  if (isPersonalMailbox(input.mailbox)) return { ok: false, reason: "personal_webmail" };

  const role = input.mailboxType === "role" || isRoleMailbox(input.mailbox);
  if (!role) {
    if (input.allowNamedWork) {
      /* named work still not Stream B v1 */
    }
    return { ok: false, reason: "named_work_not_allowed" };
  }

  if (input.listGrade === "C") return { ok: false, reason: "catch_all_only" };
  if (input.listGrade !== "A" && input.listGrade !== "A-role") return { ok: false, reason: "mailbox_not_grade_a" };
  if (input.pecrCategory === "individual_subscriber") return { ok: false, reason: "pecr_individual" };

  return { ok: true, reason: null };
}

export function buildReferRecord(input: ReferInput): ReferRecord {
  const classified = classifyIntroducer({ name: input.introducerName, sicCodes: input.sicCodes });
  const number = padCompanyNumber(input.introducerNumber || "");
  const reach = isReferReachable(input);
  const mailbox = input.mailbox || null;
  return {
    schema: "slf.refer_record.v1",
    refer_id: `ref_${number || "unknown"}`,
    introducer_company_number: number,
    introducer_name: input.introducerName,
    introducer_type: classified.type,
    domain: input.domain || null,
    reachable_corporate_contact: reach.ok,
    mailbox,
    mailbox_type:
      input.mailboxType === "director"
        ? "named_work"
        : input.mailboxType || (mailbox && isRoleMailbox(mailbox) ? "role" : mailbox ? "named_work" : null),
    list_grade: input.listGrade || null,
    pecr_category: input.pecrCategory || "unknown",
    pipeline: "introducer",
    related_sme: (input.relatedSme || []).map(padCompanyNumber),
    related_sme_mode: "optional_context",
    hold_reason: reach.reason,
    nexus_candidate_id: input.nexusCandidateId || null,
  };
}

export function validateReferRecord(record: ReferRecord & Record<string, unknown>): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (record.schema !== "slf.refer_record.v1") errors.push("schema");
  if (record.pipeline !== "introducer") errors.push("pipeline");
  if ("opening_line" in record || "hypothesis" in record) errors.push("sme_fields_leaked");
  if (record.reachable_corporate_contact) {
    if (!record.mailbox) errors.push("reachable_without_mailbox");
    if (!record.introducer_company_number) errors.push("reachable_without_number");
  }
  return { ok: errors.length === 0, errors };
}
