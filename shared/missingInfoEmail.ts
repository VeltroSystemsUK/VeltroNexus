/**
 * Missing-info chase — one email, from Maya's desk (RES-2, inbound-intake),
 * naming every outstanding document and data field and linking the GOAF.
 * Same shape as the accounts-prep chase: one send per gap-set, drafted not
 * auto-sent (Maya's desk drafts; Shaun sends).
 */
import type { AgenticDealFile } from "./agenticWorkflow";
import { mailboxForAgent } from "./agentMailboxes";
import { firstName, signatureHtml, signatureText, htmlEmail, applyOnlineUrl, escapeHtml } from "./strataOutreach";
import { attachmentsFromDocuments, missingAttachments } from "./sterlingPortal";
import { applicationDataGapSummary, emptyApplicationData } from "./applicationDataFields";

export interface MissingInfoEmailCopy {
  subject: string;
  html: string;
  text: string;
  missingDocLabels: string[];
  missingDataLabels: string[];
}

const MAYA = mailboxForAgent("inbound-intake");

export function missingInfoGaps(deal: Pick<AgenticDealFile, "packDocuments" | "applicationData">): {
  missingDocLabels: string[];
  missingDataLabels: string[];
} {
  // AgenticDealFile.packDocuments uses string ids from the pack-upload pipeline;
  // attachmentsFromDocuments only needs numeric ids to dedupe, so re-key by index.
  const asSterlingDocs = (deal.packDocuments || []).map((d, i) => ({
    id: i,
    fileName: d.fileName,
    category: d.category,
  }));
  const docItems = attachmentsFromDocuments(asSterlingDocs);
  const missingDocLabels = missingAttachments(docItems).map((item) => item.label);
  const missingDataLabels = applicationDataGapSummary(deal.applicationData || emptyApplicationData());
  return { missingDocLabels, missingDataLabels };
}

/** Null when there is nothing to chase — caller should not send. */
export function missingInfoEmailCopy(
  deal: Pick<AgenticDealFile, "companyName" | "contactName" | "uploadToken" | "packDocuments" | "applicationData">,
): MissingInfoEmailCopy | null {
  const { missingDocLabels, missingDataLabels } = missingInfoGaps(deal);
  if (missingDocLabels.length === 0 && missingDataLabels.length === 0) return null;

  const url = applyOnlineUrl(deal.uploadToken);
  const name = firstName(deal.contactName);
  const subject = `${deal.companyName} — a few things still needed to complete your application`;

  const lines: string[] = [
    `Hi ${name},`,
    "",
    `To move ${deal.companyName}'s application forward we're still missing a few things.`,
  ];

  if (missingDataLabels.length) {
    lines.push("", "Information we need from you:", ...missingDataLabels.map((l) => `- ${l}`));
  }
  if (missingDocLabels.length) {
    lines.push("", "Documents still outstanding:", ...missingDocLabels.map((l) => `- ${l}`));
  }

  lines.push(
    "",
    url
      ? "Most of the form is already filled in from what you've told us — it should take about five minutes:"
      : "Please reply to this email with the details above.",
  );

  const buttonHtml = url
    ? `
<p style="margin:24px 0 10px 0;">
  <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#2E5096;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:700;font-family:Arial,Helvetica,sans-serif;font-size:14px;">Complete your application</a>
</p>
<p style="margin:0 0 16px 0;font-size:13px;line-height:1.45;color:#374151;font-family:Arial,Helvetica,sans-serif;">If the button does not work, use this link:<br/><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="color:#2E5096;word-break:break-all;">${escapeHtml(url)}</a></p>`.trim()
    : "";

  const html = `${htmlEmail(lines)}\n${buttonHtml}\n${signatureHtml(MAYA)}`;
  const text = [...lines, url || "", "", signatureText(MAYA)].filter(Boolean).join("\n");

  return { subject, html, text, missingDocLabels, missingDataLabels };
}
