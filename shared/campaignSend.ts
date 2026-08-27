import { mailboxForAgent } from "./agentMailboxes";
import { coldEmailBlockedReason } from "./pecrSend";

export const CAMPAIGN_AGENT_ID = "outreach-sales";

export function campaignMailbox() {
  return mailboxForAgent(CAMPAIGN_AGENT_ID);
}

export function campaignUnsubscribeUrl(baseUrl: string, recipientId: number): string {
  return `${baseUrl.replace(/\/$/, "")}/api/email-tracking/unsubscribe/${recipientId}`;
}

function campaignOpenPixelUrl(baseUrl: string, recipientId: number): string {
  return `${baseUrl.replace(/\/$/, "")}/api/email-tracking/open/${recipientId}`;
}

function applyTags(
  content: string,
  recipient: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    companyName?: string | null;
  },
  unsubscribeUrl: string
): string {
  const mailbox = campaignMailbox();
  return content
    .replace(/\{\{firstName\}\}/g, recipient.firstName || "there")
    .replace(/\{\{lastName\}\}/g, recipient.lastName || "")
    .replace(/\{\{companyName\}\}/g, recipient.companyName || "your company")
    .replace(/\{\{email\}\}/g, recipient.email)
    .replace(/\{\{senderName\}\}/g, mailbox.displayName)
    .replace(/\{\{senderCompany\}\}/g, "Strata Finance")
    .replace(/\{\{currentDate\}\}/g, new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }))
    .replace(/\{\{unsubscribeLink\}\}/g, unsubscribeUrl);
}

export function prepareCampaignSend(opts: {
  subject: string;
  content: string;
  recipient: {
    id: number;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    companyName?: string | null;
    verificationStatus?: string | null;
    status?: string | null;
  };
  baseUrl: string;
}):
  | { skipReason: string }
  | {
      skipReason: null;
      to: string;
      subject: string;
      html: string;
      credentials: {
        agentId: string;
        fromEmail: string;
        fromName: string;
        replyTo: string;
      };
    } {
  if (opts.recipient.verificationStatus === "invalid") {
    return { skipReason: "Skipped: email verification marked as invalid" };
  }
  const pecr = coldEmailBlockedReason(opts.recipient.email, "sme");
  if (pecr) return { skipReason: pecr };

  const mailbox = campaignMailbox();
  const unsubscribeUrl = campaignUnsubscribeUrl(opts.baseUrl, opts.recipient.id);
  const pixel = `<img src="${campaignOpenPixelUrl(opts.baseUrl, opts.recipient.id)}" width="1" height="1" style="display:none" alt="" />`;
  let html = applyTags(opts.content, opts.recipient, unsubscribeUrl);
  if (html.includes("</body>")) html = html.replace("</body>", `${pixel}</body>`);
  else html += pixel;

  return {
    skipReason: null,
    to: opts.recipient.email,
    subject: applyTags(opts.subject, opts.recipient, unsubscribeUrl),
    html,
    credentials: {
      agentId: CAMPAIGN_AGENT_ID,
      fromEmail: mailbox.address,
      fromName: mailbox.fromName,
      replyTo: mailbox.replyTo,
    },
  };
}
