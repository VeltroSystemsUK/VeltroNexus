import { parseAddressList } from "./imapInbox";

export type MailKind = "stop" | "bounce" | "spam" | "responsive" | "other";

export type MailClassification = {
  kind: MailKind;
  recipient?: string;
  reason?: string;
};

export type SuppressionRow = {
  email: string;
  companyNumber?: string;
  reason: string;
  at: string;
};

const OPERATOR_LOCALS = new Set(["shaun"]);
const OPERATOR_DOMAINS = new Set(["veltro.co.uk"]);

const SPAM_FROM = [
  /@ionos\./i,
  /mailer-daemon@/i,
  /noreply@/i,
  /no-reply@/i,
  /newsletter/i,
  /marketing@/i,
  /crypto/i,
  /promo@/i,
  /@companieshouse\.gov\.uk/i,
];

const SPAM_SUBJECT = [
  /welcome to mail/i,
  /mail basic/i,
  /weekly digest/i,
  /unsubscribe here/i,
  /you.?ve won/i,
  /viagra/i,
  /crypto digest/i,
];

const STOP_RE = /\b(stop|unsubscribe|opt[- ]?out|do not contact|don't contact|remove me)\b/i;
const RESPONSIVE_RE =
  /\b(interested|please call|give me a call|book a call|can we (talk|speak|meet)|let's talk|happy to (chat|talk)|send (the )?pack|documents? (attached|are ready)|yes please|sounds good|when can|happy to discuss|we need (funding|finance|cash)|refinance|facility)\b/i;

export function bounceRecipient(text?: string | null): string | undefined {
  const body = String(text || "");
  const starred = body.match(/\*\s*([^\s*<>]+@[^\s*<>]+)/);
  if (starred) return starred[1].trim().toLowerCase();
  const finalTo = body.match(/final-recipient:[^\n]*;?\s*([^\s]+@[^\s]+)/i);
  if (finalTo) return finalTo[1].trim().toLowerCase();
  const angled = body.match(/<([^\s<>]+@[^\s<>]+)>/);
  return angled ? angled[1].trim().toLowerCase() : undefined;
}

export function isHardBounce(reason: string): boolean {
  return /no longer exist|unknown user|user unknown|mailbox unavailable|550\s*5\.1\.1|does not exist|not a valid|rejected|blocked/i.test(
    reason
  );
}

function isOperator(from: string): boolean {
  const email = parseAddressList(from);
  const [local, domain] = email.split("@");
  return OPERATOR_DOMAINS.has(String(domain || "").toLowerCase()) || OPERATOR_LOCALS.has(String(local || "").toLowerCase());
}

function isBounceMail(input: { from?: string; subject?: string; text?: string }): boolean {
  const from = String(input.from || "");
  const subject = String(input.subject || "");
  const text = String(input.text || "");
  if (/mailer-daemon|postmaster@/i.test(from)) return true;
  if (/mail delivery failed|undeliverable|delivery status notification/i.test(subject)) return true;
  if (/could not be delivered|returned to sender/i.test(text.slice(0, 400))) return true;
  return false;
}

function isSpamMail(input: { from?: string; subject?: string; text?: string }): boolean {
  const from = String(input.from || "");
  const subject = String(input.subject || "");
  if (SPAM_FROM.some((re) => re.test(from))) {
    if (isBounceMail(input)) return false;
    return true;
  }
  if (SPAM_SUBJECT.some((re) => re.test(subject))) return true;
  return false;
}

function isStopMail(input: { subject?: string; text?: string }): boolean {
  const subject = String(input.subject || "");
  const text = String(input.text || "").trim();
  if (STOP_RE.test(subject)) return true;
  const head = text.slice(0, 400);
  if (STOP_RE.test(head) && text.length < 1200) return true;
  return false;
}

function isResponsiveMail(input: { subject?: string; text?: string }): boolean {
  const blob = `${input.subject || ""} ${String(input.text || "").slice(0, 1500)}`;
  if (RESPONSIVE_RE.test(blob)) return true;
  if (/\b(thank you for (contacting|your email)|a member of (the|our) team will)\b/i.test(blob)) return true;
  return false;
}

export function classifyInboundMail(input: {
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
}): MailClassification {
  const from = parseAddressList(input.from);
  const text = String(input.text || "").replace(/<[^>]+>/g, " ");
  const subject = String(input.subject || "");

  if (isBounceMail({ from, subject, text })) {
    const recipient = bounceRecipient(text);
    const reason = /no longer exist|unknown user/i.test(text)
      ? "hard bounce — address does not exist"
      : "delivery failed";
    return { kind: "bounce", recipient, reason };
  }

  if (isOperator(from)) return { kind: "other" };

  if (isSpamMail({ from, subject, text })) return { kind: "spam", reason: "unrelated or automated mail" };

  if (isStopMail({ subject, text })) return { kind: "stop", reason: "opt-out" };

  if (isResponsiveMail({ subject, text })) return { kind: "responsive" };

  return { kind: "other" };
}

export function isSuppressed(
  probe: { email?: string | null; companyNumber?: string | null },
  list: SuppressionRow[]
): boolean {
  const email = String(probe.email || "")
    .trim()
    .toLowerCase();
  const number = String(probe.companyNumber || "")
    .trim()
    .replace(/^0+/, "");
  return list.some((row) => {
    if (email && row.email && row.email.toLowerCase() === email) return true;
    const rowNumber = String(row.companyNumber || "").replace(/^0+/, "");
    if (number && rowNumber && rowNumber === number) return true;
    return false;
  });
}
