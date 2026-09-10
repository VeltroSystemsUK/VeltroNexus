import { gradeMailbox, isRoleMailbox } from "./smeHopper";
import { isPersonalMailbox } from "./pecrSend";

const DROP_LOCALS = new Set(["noreply", "donotreply", "no-reply", "postmaster", "abuse", "mailer-daemon"]);
const DUMP_NAME_RE = /fullz|combo|leaked|breach|10m_emails|linkedin_scrape|uk_emails_10m/i;

export type ListRowInput = {
  email: string;
  companyNumber?: string;
  contactName?: string | null;
  directorNames?: string[];
  companyName?: string | null;
  verificationStatus?: "deliverable" | "catch_all" | "unknown" | "invalid" | "guessed_unverified";
  catchAll?: boolean;
  guessed?: boolean;
  hasDirectorMailbox?: boolean;
};

export type ListGrade = "A" | "A-role" | "B" | "C" | "D" | "F";

export function normaliseEmail(raw: string): string | null {
  let value = String(raw || "").trim().toLowerCase();
  value = value.replace(/^mailto:/, "").replace(/[>,;]+$/g, "").replace(/\.+$/, "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
  const local = value.split("@")[0];
  if (DROP_LOCALS.has(local)) return null;
  return value;
}

export function refuseListFile(
  filename: string,
  rows: Array<{ email?: string; companyNumber?: string }>
): { refused: boolean; blockedClass?: string; reason?: string } {
  if (DUMP_NAME_RE.test(filename)) {
    return { refused: true, blockedClass: "scrape_shop", reason: "filename looks like a dump" };
  }
  if (!rows.length) return { refused: false };
  const withEmail = rows.filter((row) => row.email);
  const webmail = withEmail.filter((row) => isPersonalMailbox(row.email)).length;
  const numbered = rows.filter((row) => row.companyNumber).length;
  const webmailShare = withEmail.length ? webmail / withEmail.length : 0;
  if (webmailShare >= 0.5 && numbered / Math.max(rows.length, 1) < 0.2) {
    return { refused: true, blockedClass: "scrape_shop", reason: "webmail majority without company numbers" };
  }
  return { refused: false };
}

export function gradeListRow(input: ListRowInput): {
  grade: ListGrade;
  mailboxType: "director" | "role" | "named_work" | "personal_webmail" | "drop";
  attach: boolean;
  isPrimary: boolean;
} {
  const email = normaliseEmail(input.email) || "";
  if (!email || isPersonalMailbox(email)) {
    return { grade: "F", mailboxType: "personal_webmail", attach: false, isPrimary: false };
  }
  if (input.guessed) {
    return { grade: input.catchAll ? "C" : "F", mailboxType: "role", attach: false, isPrimary: false };
  }
  if (!input.companyNumber) {
    return { grade: "D", mailboxType: isRoleMailbox(email) ? "role" : "named_work", attach: false, isPrimary: false };
  }
  if (input.verificationStatus === "invalid") {
    return { grade: "F", mailboxType: "drop", attach: false, isPrimary: false };
  }
  if (input.catchAll || input.verificationStatus === "catch_all" || input.verificationStatus === "unknown") {
    return { grade: "C", mailboxType: isRoleMailbox(email) ? "role" : "named_work", attach: false, isPrimary: false };
  }

  const mailbox = gradeMailbox({
    email,
    contactName: input.contactName,
    directorNames: input.directorNames,
    companyName: input.companyName,
  });
  if (mailbox === "reject") {
    return { grade: "F", mailboxType: "drop", attach: false, isPrimary: false };
  }
  if (mailbox === "role") {
    return {
      grade: "A-role",
      mailboxType: "role",
      attach: true,
      isPrimary: !input.hasDirectorMailbox,
    };
  }
  return { grade: "A", mailboxType: "director", attach: true, isPrimary: true };
}

export function decideListAttach(input: { onBook: boolean; grade: ListGrade }): "attach_mailbox" | "store_in_list_product_only" {
  if (!input.onBook) return "store_in_list_product_only";
  if (input.grade === "A" || input.grade === "A-role") return "attach_mailbox";
  return "store_in_list_product_only";
}
