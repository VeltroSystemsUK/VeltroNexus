import {
  APPLICATION_SECTIONS,
  DIRECTOR_SECTIONS,
  LENDER_LABELS,
  type ApplicationAnswers,
  type ApplicationDirector,
  type ApplicationSection,
  type LenderCode,
} from "./applicationDataFields";
import { STERLING_PAPER_CSS } from "./sterlingPaper";

export type ApplicationPreviewFile = {
  companyName?: string;
  companyNumber?: string;
  tradingName?: string;
  registeredAddress?: string;
  postcode?: string;
  website?: string;
  natureOfBusiness?: string;
  legalEntityType?: string;
  startDate?: string;
  loanAmount?: number | string | null;
  term?: number | string | null;
  loanPurpose?: string;
  existingBorrowing?: string;
  securityType?: string;
  employeeCount?: string | number | null;
};

export type ApplicationPreviewContact = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
};

function money(value: number | string | null | undefined): string {
  if (value == null || value === "") return "";
  const n = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n)) return String(value);
  return `£${Math.round(n).toLocaleString("en-GB")}`;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function sectionsForLender(lender: LenderCode): ApplicationSection[] {
  return APPLICATION_SECTIONS.map((section) => ({
    ...section,
    fields: section.fields.filter((field) => field.askedBy.includes(lender)),
  })).filter((section) => section.fields.length);
}

export function directorSectionsForLender(lender: LenderCode) {
  return DIRECTOR_SECTIONS.map((section) => ({
    ...section,
    fields: section.fields.filter((field) => field.askedBy.includes(lender)),
  })).filter((section) => section.fields.length);
}

export function answersFromSterlingFile(file: ApplicationPreviewFile): ApplicationAnswers {
  const answers: ApplicationAnswers = {};
  if (file.companyName) answers.legalName = file.companyName;
  if (file.tradingName) answers.tradingName = file.tradingName;
  if (file.companyNumber) answers.companyNumber = file.companyNumber;
  if (file.registeredAddress) answers.tradingAddress = file.registeredAddress;
  if (file.postcode) answers.postcode = file.postcode;
  if (file.website) answers.website = file.website;
  if (file.natureOfBusiness) answers.natureOfBusiness = file.natureOfBusiness;
  if (file.legalEntityType) answers.legalEntityType = file.legalEntityType;
  else if (file.companyNumber) answers.legalEntityType = "Limited company";
  if (file.startDate) answers.startDate = file.startDate;
  if (file.loanAmount != null && file.loanAmount !== "") answers.loanAmount = money(file.loanAmount);
  if (file.term != null && file.term !== "") answers.loanTerm = `${file.term} months`;
  if (file.loanPurpose) answers.loanPurpose = file.loanPurpose;
  if (file.existingBorrowing) answers.existingBorrowingDetail = file.existingBorrowing;
  if (file.securityType) answers.securityType = file.securityType;
  if (file.employeeCount != null && file.employeeCount !== "") answers.employeeCount = String(file.employeeCount);
  if (file.companyNumber) answers.niOrGbBorrower = "GB";
  return answers;
}

export function directorsFromContacts(contacts: ApplicationPreviewContact[]): ApplicationDirector[] {
  return contacts
    .map((contact, index) => {
      const fullName = String(contact.name || "").trim();
      if (!fullName) return null;
      const row: ApplicationDirector = { id: `c${index}`, fullName };
      if (contact.email) row.personalEmail = contact.email;
      if (contact.phone) row.personalPhone = contact.phone;
      if (contact.role) row.positionInBusiness = contact.role;
      return row;
    })
    .filter((row): row is ApplicationDirector => Boolean(row));
}

function fieldRow(label: string, value: string | undefined): string {
  const filled = String(value || "").trim();
  return `<tr>
    <th>${esc(label)}</th>
    <td>${filled ? esc(filled).replace(/\n/g, "<br>") : "&nbsp;"}</td>
  </tr>`;
}

export function applicationFormHtml(opts: {
  lenderId: LenderCode;
  companyName: string;
  answers: ApplicationAnswers;
  directors: ApplicationDirector[];
}): string {
  const lender = LENDER_LABELS[opts.lenderId];
  const sections = sectionsForLender(opts.lenderId)
    .map((section) => {
      const rows = section.fields.map((field) => fieldRow(field.label, opts.answers[field.id])).join("");
      return `<h2>${esc(section.title)}</h2><table>${rows}</table>`;
    })
    .join("");

  const directorHtml = (opts.directors.length ? opts.directors : [{ id: "none" } as ApplicationDirector])
    .map((director, index) => {
      const blocks = directorSectionsForLender(opts.lenderId)
        .map((section) => {
          const rows = section.fields.map((field) => fieldRow(field.label, director[field.id])).join("");
          return `<h3>${esc(section.title)}</h3><table>${rows}</table>`;
        })
        .join("");
      const heading = director.fullName || `Director ${index + 1}`;
      return `<h2>Director / applicant — ${esc(heading)}</h2>${blocks}`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="utf-8" />
  <title>${esc(lender)} application — ${esc(opts.companyName)}</title>
  <style>
    :root { --navy: #123a66; --ink: #10233f; --muted: #5b6b7c; --border: #d8dee6; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; color: var(--ink);
      font-family: "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif; }
    .banner { background: #fff8ee; border: 1px solid #e8c56b; color: #7a5208;
      font-size: 11px; font-weight: 600; padding: 8px 10px; margin: 0 0 16px; }
    h1 { font-size: 22px; margin: 0 0 4px; color: var(--navy); }
    .meta { color: var(--muted); font-size: 13px; margin: 0 0 18px; }
    h2 { font-size: 13px; letter-spacing: .06em; text-transform: uppercase; color: var(--navy); margin: 22px 0 8px; }
    h3 { font-size: 12px; color: var(--navy); margin: 14px 0 6px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { vertical-align: top; padding: 7px 8px; border-bottom: 1px solid #eef2f6; font-size: 12.5px; text-align: left; }
    th { width: 42%; font-weight: 600; color: var(--navy); background: #f7f9fb; }
    .blank { color: #8a96a3; font-weight: 600; font-size: 11px; letter-spacing: .04em; text-transform: uppercase; }
    ${STERLING_PAPER_CSS}
  </style>
</head>
<body>
  <div class="doc">
    <div class="banner">Preview only — filled from the Nexus file. Not for signature and not sent to the lender.</div>
    <h1>${esc(lender)} application form</h1>
    <p class="meta">${esc(opts.companyName)}</p>
    ${sections}
    ${directorHtml}
  </div>
</body>
</html>`;
}
