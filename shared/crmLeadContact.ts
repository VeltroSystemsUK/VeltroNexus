import { parseAddressList } from "./imapInbox";
import { isHardBounceReason, isSuppressed, type SuppressionRow } from "./mailDesk";
import { SME_ATTACH_ATTEMPT_CAP } from "./smeHopper";

export type CrmLeadContactProbe = {
  email?: string | null;
  companyNumber?: string | null;
  contactName?: string | null;
  contacts?: unknown;
  companyName?: string | null;
  website?: string | null;
  phone?: string | null;
  bounced?: boolean;
  doNotContact?: boolean;
};

export type CrmLeadContactRow = {
  name?: string;
  role?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
};

export type CrmLeadMailboxPatch = {
  changed: boolean;
  email?: string;
  contactName?: string;
  contacts: CrmLeadContactRow[];
  website?: string;
  phone?: string;
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

function contactRows(contacts: unknown): CrmLeadContactRow[] {
  let rows = contacts;
  if (typeof rows === "string") {
    try {
      rows = JSON.parse(rows);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => row && typeof row === "object");
}

function contactEmails(contacts: unknown): string[] {
  return contactRows(contacts).map((row) => normalizeEmail(row?.email)).filter(Boolean);
}

export function emailsOnCrmLead(lead: CrmLeadContactProbe): string[] {
  const emails = [normalizeEmail(lead.email), ...contactEmails(lead.contacts)];
  return [...new Set(emails.filter(Boolean))];
}

export function isCrmHarvestCandidate(
  lead: CrmLeadContactProbe,
  opts?: { now?: Date; attempts?: number; waitUntil?: string; cap?: number },
): boolean {
  if (lead.doNotContact) return false;
  if (!String(lead.companyNumber || "").trim()) return false;
  if (!String(lead.companyName || "").trim()) return false;
  const attempts = opts?.attempts || 0;
  const cap = opts?.cap ?? SME_ATTACH_ATTEMPT_CAP;
  if (attempts >= cap) return false;
  if (opts?.waitUntil && Date.parse(opts.waitUntil) > (opts.now || new Date()).getTime()) return false;
  if (emailsOnCrmLead(lead).length && !lead.bounced) return false;
  return true;
}

function contactNameKey(name?: string | null): string {
  return String(name || "")
    .trim()
    .toLowerCase();
}

export function applyHarvestToCrmLead(
  lead: CrmLeadContactProbe,
  harvest: {
    email?: string | null;
    contactName?: string | null;
    directorNames?: string[];
    website?: string | null;
    phone?: string | null;
  },
): CrmLeadMailboxPatch {
  const mailbox = applyMailboxToCrmLead(lead, {
    email: harvest.email,
    contactName: harvest.contactName,
  });
  let contacts = mailbox.contacts;
  let directorsAdded = false;
  for (const name of harvest.directorNames || []) {
    const trimmed = String(name || "").trim();
    if (!trimmed) continue;
    const key = contactNameKey(trimmed);
    if (contacts.some((row) => contactNameKey(row.name) === key)) continue;
    contacts = [...contacts, { name: trimmed, role: "Director" }];
    directorsAdded = true;
  }
  const website = String(lead.website || "").trim() || String(harvest.website || "").trim() || undefined;
  const phone = String(lead.phone || "").trim() || String(harvest.phone || "").trim() || undefined;
  const websiteChanged = Boolean(website && website !== String(lead.website || "").trim());
  const phoneChanged = Boolean(phone && phone !== String(lead.phone || "").trim());
  return {
    ...mailbox,
    contacts,
    website,
    phone,
    changed: mailbox.changed || directorsAdded || websiteChanged || phoneChanged,
  };
}

export function applyMailboxToCrmLead(
  lead: CrmLeadContactProbe,
  mailbox: { email?: string | null; contactName?: string | null },
): CrmLeadMailboxPatch {
  const contacts = contactRows(lead.contacts);
  const cardEmail = normalizeEmail(lead.email);
  const contactName = String(lead.contactName || "").trim() || undefined;
  const incoming = normalizeEmail(mailbox.email);
  const incomingName = String(mailbox.contactName || "").trim() || undefined;
  if (!incoming) {
    return { changed: false, email: cardEmail || undefined, contactName, contacts };
  }
  if (emailsOnCrmLead(lead).includes(incoming)) {
    if (!contactName && incomingName && (incoming === cardEmail || !cardEmail)) {
      return { changed: true, email: cardEmail || incoming, contactName: incomingName, contacts };
    }
    return { changed: false, email: cardEmail || undefined, contactName, contacts };
  }
  if (!cardEmail) {
    return {
      changed: true,
      email: incoming,
      contactName: contactName || incomingName,
      contacts,
    };
  }
  return {
    changed: true,
    email: cardEmail,
    contactName,
    contacts: [...contacts, { email: incoming, ...(incomingName ? { name: incomingName } : {}) }],
  };
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
