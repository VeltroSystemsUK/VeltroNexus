import { parseAddressList } from "./imapInbox";
import { isHardBounceReason, isSuppressed, type SuppressionRow } from "./mailDesk";

export type CrmLeadContactProbe = {
  email?: string | null;
  companyNumber?: string | null;
  contacts?: unknown;
};

export type CrmMailContactEvent = {
  direction?: string | null;
  status?: string | null;
  to?: string | null;
};

export type CrmCampaignContactEvent = {
  email?: string | null;
  status?: string | null;
};

const CONTACTED_CAMPAIGN_STATUSES = new Set([
  "sent",
  "delivered",
  "opened",
  "clicked",
  "unsubscribed",
  "bounced",
]);

function normalizeEmail(value?: string | null): string {
  const email = parseAddressList(value);
  return email.includes("@") ? email : "";
}

function contactEmails(contacts: unknown): string[] {
  let rows = contacts;
  if (typeof rows === "string") {
    try {
      rows = JSON.parse(rows);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => normalizeEmail(row?.email)).filter(Boolean);
}

export function emailsOnCrmLead(lead: CrmLeadContactProbe): string[] {
  const emails = [normalizeEmail(lead.email), ...contactEmails(lead.contacts)];
  return [...new Set(emails.filter(Boolean))];
}

export function campaignRecipientCountsAsContacted(status?: string | null): boolean {
  return CONTACTED_CAMPAIGN_STATUSES.has(String(status || ""));
}

function contactedEmailsFromMail(mail: CrmMailContactEvent[]): Set<string> {
  const emails = new Set<string>();
  for (const item of mail) {
    if (item.direction !== "outbound") continue;
    if (item.status !== "sent" && item.status !== "mock") continue;
    const email = normalizeEmail(item.to);
    if (email) emails.add(email);
  }
  return emails;
}

function contactedEmailsFromCampaigns(recipients: CrmCampaignContactEvent[]): Set<string> {
  const emails = new Set<string>();
  for (const row of recipients) {
    if (!campaignRecipientCountsAsContacted(row.status)) continue;
    const email = normalizeEmail(row.email);
    if (email) emails.add(email);
  }
  return emails;
}

function unsubscribedEmailsFromCampaigns(recipients: CrmCampaignContactEvent[]): Set<string> {
  const emails = new Set<string>();
  for (const row of recipients) {
    if (row.status !== "unsubscribed") continue;
    const email = normalizeEmail(row.email);
    if (email) emails.add(email);
  }
  return emails;
}

export function annotateCrmLeads<T extends CrmLeadContactProbe>(
  leads: T[],
  opts: {
    mail: CrmMailContactEvent[];
    recipients: CrmCampaignContactEvent[];
    suppression: SuppressionRow[];
  },
): Array<T & { contacted: boolean; doNotContact: boolean; bounced: boolean; bounceReason?: string }> {
  const contactedEmails = new Set([
    ...contactedEmailsFromMail(opts.mail),
    ...contactedEmailsFromCampaigns(opts.recipients),
  ]);
  const unsubscribedEmails = unsubscribedEmailsFromCampaigns(opts.recipients);
  const bounceRows = opts.suppression.filter((row) => isHardBounceReason(row.reason));
  const dncRows = opts.suppression.filter((row) => !isHardBounceReason(row.reason));
  const bounceByEmail = new Map(
    bounceRows
      .map((row) => [normalizeEmail(row.email), row.reason] as const)
      .filter(([email]) => Boolean(email)),
  );

  return leads.map((lead) => {
    const emails = emailsOnCrmLead(lead);
    const contacted = emails.some((email) => contactedEmails.has(email));
    const bounceReason = emails.map((email) => bounceByEmail.get(email)).find(Boolean);
    const bounced = Boolean(bounceReason);
    const doNotContact =
      emails.some((email) => unsubscribedEmails.has(email) || isSuppressed({ email, companyNumber: lead.companyNumber }, dncRows))
      || isSuppressed({ companyNumber: lead.companyNumber }, dncRows);
    return { ...lead, contacted, doNotContact, bounced, ...(bounceReason ? { bounceReason } : {}) };
  });
}
