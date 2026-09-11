import { parseAddressList } from "./imapInbox";
import { isOpenedOutboundMail } from "./mailTracking";
import { isPersonalMailbox } from "./pecrSend";

export type MailKind = "stop" | "bounce" | "spam" | "responsive" | "other";

export type AgentMailFolder = "inbox" | "sent" | "opened" | "all" | "quarantine";

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

const STOP_RE =
  /\b(stop|unsubscribe|opt[- ]?out|do not contact|don't contact|remove me|not interested|wrong (company|email|address|person)|do not (email|mail|write)|don't (email|mail|write)|not to contact|don't require this|take (me|us) off)\b/i;
const RESPONSIVE_RE =
  /\b(interested|please call|give me a call|book a call|can we (talk|speak|meet)|let's talk|happy to (chat|talk)|send (the )?pack|documents? (attached|are ready)|yes please|sounds good|when can|happy to discuss|we need (funding|finance|cash)|refinance|facility)\b/i;

function cleanBounceEmail(value?: string | null): string | undefined {
  const email = String(value || "")
    .replace(/^mailto:/i, "")
    .replace(/[>;,]+$/g, "")
    .trim()
    .toLowerCase();
  return email.includes("@") ? email : undefined;
}

export function bounceRecipient(text?: string | null): string | undefined {
  const body = String(text || "");
  const patterns = [
    /your message to\s+([^\s<>]+@[^\s<>]+)/i,
    /mailto:([^\s<>]+@[^\s<>]+)/i,
    /(?:final-recipient|original-recipient)[^\n]*;?\s*(?:rfc822;?\s*)?([^\s]+@[^\s]+)/i,
    /^\s*\*\s*([^\s*<>]+@[^\s*<>]+)/m,
    /addressed to email address\s*:\s*(?:--\s*)?([^\s]+@[^\s]+)/i,
    /(?:rcpt to:|<)([a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,})(?:>)/i,
    /following address(?:es)? failed:\s*([^\s]+@[^\s]+)/i,
  ];
  for (const re of patterns) {
    const hit = cleanBounceEmail(body.match(re)?.[1]);
    if (hit) return hit;
  }
  return cleanBounceEmail(body.match(/<([a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,})>/i)?.[1]);
}

function isSoftBounce(reason: string): boolean {
  return /mailbox is full|over quota|4\.2\.2|temporarily unavailable|try again later|connection refused|refused to accept a connection|greylist/i.test(
    reason
  );
}

export function isHardBounce(reason: string): boolean {
  if (isSoftBounce(reason)) return false;
  if (/sender blocked|5\.7\.1|spamhaus|blacklist|blocked by/i.test(reason)) return false;
  return /no longer exist|unknown user|user unknown|mailbox unavailable|550\s*5\.1\.1|5\.1\.1\b|5\.1\.10|does not exist|not a valid|wasn't found|couldn'?t be found|unknown to address|recipient (address )?is possibly incorrect|no such user|invalid recipient|recipient not found/i.test(
    reason
  );
}

export function hardBounceReason(text?: string | null): string {
  const blob = String(text || "").replace(/\s+/g, " ").trim();
  const hit = blob.match(
    /550\s*5\.1\.\d[^.]{0,80}|wasn't found[^.]{0,80}|couldn'?t be found[^.]{0,80}|no longer exist[^.]{0,40}|unknown (?:user|to address)[^.]{0,40}|does not exist[^.]{0,40}|no such user[^.]{0,40}|recipient not found[^.]{0,40}/i,
  );
  const snippet = (hit?.[0] || "address does not exist").trim();
  return `hard bounce — ${snippet}`.slice(0, 180);
}

export function isMailerDaemonAddress(from?: string | null): boolean {
  return /mailer-daemon/i.test(String(from || ""));
}

export function agentMailInFolder(
  item: { from?: string; direction?: string; opens?: string[] },
  folder: AgentMailFolder,
): boolean {
  const quarantined = isMailerDaemonAddress(item.from);
  if (folder === "quarantine") return quarantined;
  if (quarantined) return false;
  if (folder === "inbox") return item.direction === "inbound";
  if (folder === "sent") return item.direction === "outbound";
  if (folder === "opened") return isOpenedOutboundMail(item);
  return true;
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

function replyHead(text?: string): string {
  const raw = String(text || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const cut = raw.split(/\sOn .+wrote:/i)[0] || raw;
  return cut.slice(0, 600);
}

function isStopMail(input: { subject?: string; text?: string }): boolean {
  const subject = String(input.subject || "");
  if (STOP_RE.test(subject)) return true;
  return STOP_RE.test(replyHead(input.text));
}

export function isAutoReplyText(blob?: string | null): boolean {
  return /\b(out of office|automatic reply|auto-?reply|autoreply|automatic response|automated response|not always at (our|the) pc|response within 24 hours|thanks for your email \[automated)\b/i.test(
    String(blob || "")
  );
}

function isResponsiveMail(input: { subject?: string; text?: string }): boolean {
  const blob = `${input.subject || ""} ${String(input.text || "").slice(0, 1500)}`;
  if (isAutoReplyText(blob)) return false;
  if (RESPONSIVE_RE.test(blob)) return true;
  if (/\b(thank you for (contacting|your email)|thanks for your email|a member of (the|our) team will)\b/i.test(blob)) return true;
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
  const text = String(input.text || input.html || "").replace(/<[^>]+>/g, " ");
  const subject = String(input.subject || "");

  if (isBounceMail({ from, subject, text })) {
    const recipient = bounceRecipient(text);
    const reason = isHardBounce(text)
      ? hardBounceReason(text)
      : "delivery failed";
    return { kind: "bounce", recipient, reason };
  }

  if (isOperator(from)) return { kind: "other" };

  if (isSpamMail({ from, subject, text })) return { kind: "spam", reason: "unrelated or automated mail" };

  if (isStopMail({ subject, text })) return { kind: "stop", reason: "opt-out" };

  if (isAutoReplyText(`${subject} ${text}`)) return { kind: "other", reason: "auto-reply" };

  if (isResponsiveMail({ subject, text })) return { kind: "responsive" };

  return { kind: "other" };
}

export function factoryParkReleasePatch(
  deal: {
    status?: string | null;
    humanReason?: string | null;
    events?: Array<{ message?: string }>;
  },
  _now: Date = new Date()
): {
  email?: string;
  hopper?: "hunt_contact";
  status: "waiting_timer";
  waitUntil?: undefined;
  humanReason: undefined;
} | null {
  if (deal.status !== "waiting_human") return null;
  const reason = String(deal.humanReason || "");
  if (/^Bounce:/i.test(reason) || /hard bounce/i.test(reason) || /mailbox is not this company/i.test(reason)) {
    return {
      email: "",
      hopper: "hunt_contact",
      status: "waiting_timer",
      waitUntil: undefined,
      humanReason: undefined,
    };
  }
  if (/they replied/i.test(reason)) {
    const blob = [reason, ...(deal.events || []).map((event) => event.message || "")].join(" ");
    if (isAutoReplyText(blob)) {
      return { status: "waiting_timer", waitUntil: undefined, humanReason: undefined };
    }
  }
  return null;
}

const NEVER_CONTACT_EMAILS = new Set([
  "admin@musicindustrygroup.com",
  "accounts@musicindustrygroup.com",
]);
const NEVER_CONTACT_COMPANIES = new Set(["OC421480"]);

export function isHardBounceReason(reason?: string | null): boolean {
  return /hard bounce/i.test(String(reason || ""));
}

export function isHardBounceMailbox(
  email: string | null | undefined,
  list: SuppressionRow[]
): boolean {
  const target = String(email || "").trim().toLowerCase();
  if (!target) return false;
  return list.some(
    (row) =>
      String(row.email || "").trim().toLowerCase() === target && isHardBounceReason(row.reason)
  );
}

export function isOptOutSuppressed(
  probe: { email?: string | null; companyNumber?: string | null },
  list: SuppressionRow[]
): boolean {
  return isSuppressed(
    probe,
    list.filter((row) => !isHardBounceReason(row.reason))
  );
}

export function normalizeSuppression(list: SuppressionRow[]): SuppressionRow[] {
  return list.map((row) => {
    if (!isHardBounceReason(row.reason) || !row.companyNumber) return row;
    const { companyNumber: _dropped, ...rest } = row;
    return rest;
  });
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
  const companyKey = String(probe.companyNumber || "")
    .trim()
    .toUpperCase();
  if (email && NEVER_CONTACT_EMAILS.has(email)) return true;
  if (companyKey && NEVER_CONTACT_COMPANIES.has(companyKey)) return true;
  const probeDomain = email.includes("@") ? email.split("@")[1] : "";
  return list.some((row) => {
    const rowEmail = String(row.email || "").trim().toLowerCase();
    if (email && rowEmail && rowEmail === email) return true;
    if (isHardBounceReason(row.reason)) return false;
    const rowNumber = String(row.companyNumber || "").replace(/^0+/, "");
    if (number && rowNumber && rowNumber === number) return true;
    if (email && rowEmail && !isPersonalMailbox(email) && !isPersonalMailbox(rowEmail)) {
      const rowDomain = rowEmail.split("@")[1] || "";
      if (probeDomain && rowDomain && probeDomain === rowDomain) return true;
    }
    return false;
  });
}
