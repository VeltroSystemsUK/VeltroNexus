/**
 * Generic Online Application Form (GOAF) field catalogue.
 *
 * Sourced field-by-field from the four Sterling lenders' real application forms:
 * server/templates/sterling/{bcrs,cwrt,ffe,firstent}/. `askedBy` names which
 * lender(s) actually ask each field — not a generic guess. See
 * docs/superpowers/specs/2026-09-08-missing-info-application-harvest-design.md.
 *
 * One source feeds the missing-info email, the public /apply/:token form, and
 * the per-CDFI applicationRequirements seed — they can't drift apart because
 * they all read this file.
 */

export type LenderCode = "bcrs" | "cwrt" | "ffe" | "firstent";

export const LENDER_LABELS: Record<LenderCode, string> = {
  bcrs: "BCRS",
  cwrt: "CWRT",
  ffe: "Finance For Enterprise",
  firstent: "First Enterprise",
};

export type ApplicationFieldType = "text" | "textarea" | "date" | "number" | "currency" | "yesno" | "select";

export interface ApplicationFieldDef {
  id: string;
  label: string;
  /** Guidance shown to the customer: what this is and/or why we need it. Only set where it isn't self-explanatory. */
  note?: string;
  type: ApplicationFieldType;
  options?: string[];
  /** Blocks the missing-info chase until answered. Everything else is "nice to have on file" but doesn't gate. */
  required?: boolean;
  askedBy: LenderCode[];
}

export interface ApplicationSection {
  id: string;
  title: string;
  /** Section-level guidance — why we're asking this whole group of questions. */
  note?: string;
  fields: ApplicationFieldDef[];
}

// ---- Company / business (single, not repeated) ----

export const COMPANY_SECTION: ApplicationSection = {
  id: "company",
  title: "Your business",
  note: "This confirms who is borrowing. Every lender cross-checks this against Companies House before they'll look at anything else, so it has to match exactly.",
  fields: [
    { id: "legalName", label: "Legal business name", type: "text", required: true, askedBy: ["bcrs", "cwrt", "ffe", "firstent"] },
    { id: "tradingName", label: "Trading name (if different)", type: "text", askedBy: ["firstent"] },
    { id: "companyNumber", label: "Company number", note: "Ltd companies and LLPs only.", type: "text", askedBy: ["bcrs", "firstent", "ffe"] },
    { id: "utrOrVat", label: "UTR / VAT number", note: "Sole traders and partnerships instead of a company number.", type: "text", askedBy: ["bcrs", "firstent"] },
    { id: "tradingAddress", label: "Trading address", note: "BCRS wants where you actually trade from, not your registered office address, if different.", type: "textarea", required: true, askedBy: ["bcrs", "firstent", "ffe"] },
    { id: "postcode", label: "Postcode", type: "text", required: true, askedBy: ["bcrs", "cwrt", "firstent"] },
    { id: "natureOfBusiness", label: "What does the business do?", type: "textarea", required: true, askedBy: ["bcrs", "cwrt", "ffe", "firstent"] },
    { id: "businessPhone", label: "Business telephone", type: "text", askedBy: ["bcrs", "ffe", "firstent"] },
    { id: "businessEmail", label: "Business email", type: "text", askedBy: ["ffe", "firstent"] },
    { id: "website", label: "Website (if you have one)", type: "text", askedBy: ["bcrs", "ffe", "firstent"] },
    {
      id: "legalEntityType",
      label: "Legal entity type",
      type: "select",
      options: ["Sole trader", "Partnership", "Limited company", "LLP", "CIC", "Social enterprise"],
      required: true,
      askedBy: ["bcrs", "cwrt", "ffe", "firstent"],
    },
    { id: "startDate", label: "Date trading started", note: "Not the incorporation date if the company sat dormant for a while first.", type: "date", required: true, askedBy: ["bcrs", "cwrt", "ffe", "firstent"] },
    { id: "localAuthority", label: "Local authority business rates are paid to", type: "text", askedBy: ["bcrs", "cwrt", "firstent"] },
    { id: "employeeCount", label: "Number of employees (including directors)", type: "number", required: true, askedBy: ["bcrs", "cwrt", "firstent"] },
    { id: "managementCount", label: "Number of management staff", type: "number", askedBy: ["cwrt"] },
    { id: "annualTurnover", label: "Annual turnover, most recent year", note: "Leave this if it's already on your accounts — we'll take it from there once they're on file.", type: "currency", askedBy: ["cwrt", "firstent", "ffe"] },
    { id: "vatRegistered", label: "VAT registered?", type: "yesno", askedBy: ["ffe"] },
    { id: "womenLed", label: "Is the business women-led?", note: "Used for lender impact reporting only — it has no bearing on the decision.", type: "yesno", askedBy: ["cwrt"] },
    { id: "bameLed", label: "Is the business BAME-led?", note: "Used for lender impact reporting only — it has no bearing on the decision.", type: "yesno", askedBy: ["cwrt"] },
    { id: "premisesOwnedOrRented", label: "Are your business premises owned or rented?", type: "select", options: ["Owned", "Rented"], askedBy: ["ffe"] },
    { id: "premisesDetail", label: "Premises detail", note: "If owned: value, outstanding mortgage, lender. If rented: rent, frequency, lease expiry.", type: "textarea", askedBy: ["ffe"] },
  ],
};

// ---- Facility requested ----

export const FACILITY_SECTION: ApplicationSection = {
  id: "facility",
  title: "The loan you're looking for",
  fields: [
    { id: "loanAmount", label: "Amount requested", type: "currency", required: true, askedBy: ["bcrs", "cwrt", "ffe", "firstent"] },
    { id: "loanTerm", label: "Term requested", note: "In months or years — whichever is easier.", type: "text", required: true, askedBy: ["bcrs", "cwrt", "ffe", "firstent"] },
    { id: "loanPurpose", label: "Purpose of the loan", note: "Write this in your own words — lenders read this, it isn't a tick-box.", type: "textarea", required: true, askedBy: ["bcrs", "cwrt", "ffe", "firstent"] },
    { id: "useOfFundsBreakdown", label: "Breakdown of how you'll use the loan", type: "textarea", askedBy: ["bcrs", "cwrt"] },
    { id: "ownFundsInvested", label: "Your own funds already invested or available", type: "currency", askedBy: ["cwrt"] },
    { id: "otherFundingObtained", label: "Other funding already obtained (grants etc.) and where from", type: "textarea", askedBy: ["cwrt"] },
    { id: "otherFundingNeeded", label: "Other funding still needed and where you hope to get it", type: "textarea", askedBy: ["cwrt"] },
    { id: "totalProjectCost", label: "Total project cost", type: "currency", askedBy: ["cwrt"] },
    { id: "arrangementFeePreference", label: "How would you prefer to pay the arrangement fee?", type: "select", options: ["Upfront", "Added to the loan", "Netted off the loan"], askedBy: ["firstent"] },
    { id: "independentLegalAdvice", label: "Independent legal advice", note: "Your solicitor's details, or confirm you're waiving this.", type: "text", askedBy: ["firstent"] },
  ],
};

// ---- Bank decline (CDFI eligibility gate) ----

export const BANK_DECLINE_SECTION: ApplicationSection = {
  id: "bankDecline",
  title: "Bank decline",
  note: "CDFIs only lend where a mainstream bank has already said no — CWRT can't process an application without this.",
  fields: [
    { id: "bankDeclineConfirmed", label: "Have you already been declined by a mainstream bank?", type: "yesno", required: true, askedBy: ["cwrt", "firstent"] },
    { id: "declineBankNames", label: "Which bank(s) declined you?", type: "text", askedBy: ["cwrt"] },
    { id: "declineDates", label: "Date(s) of decline", type: "text", askedBy: ["cwrt"] },
    { id: "declineReasons", label: "Reason(s) they gave", type: "textarea", askedBy: ["cwrt"] },
  ],
};

// ---- Bank & accountant relationship ----

export const BANK_ACCOUNTANT_SECTION: ApplicationSection = {
  id: "bankAccountant",
  title: "Your bank and accountant",
  fields: [
    { id: "bankNameBranch", label: "Bank name & branch", type: "text", askedBy: ["bcrs"] },
    { id: "bankManagerContact", label: "Business manager — name, phone, email", type: "text", askedBy: ["bcrs"] },
    { id: "accountantPracticeContact", label: "Accountancy practice & accountant — name, phone, email", type: "text", askedBy: ["bcrs"] },
  ],
};

// ---- Existing borrowing (business-level) ----

export const EXISTING_BORROWING_SECTION: ApplicationSection = {
  id: "existingBorrowing",
  title: "Existing business borrowing",
  fields: [
    { id: "existingBorrowingDetail", label: "Type, lender, limit/balance, term and monthly payment for each facility", type: "textarea", askedBy: ["bcrs", "ffe", "cwrt"] },
    { id: "otherLiabilities", label: "Any other potential liabilities, e.g. guarantees given", type: "textarea", askedBy: ["ffe"] },
  ],
};

// ---- State aid / subsidy history ----

export const STATE_AID_SECTION: ApplicationSection = {
  id: "stateAid",
  title: "State aid / subsidy history",
  note: "This is a regulatory check the lender has to run, not a judgement on your application. A Recovery Loan Scheme or Growth Guarantee Scheme facility both count as subsidy.",
  fields: [
    { id: "stateAidReceived", label: "Received any State Aid or subsidy in the last 3 years?", type: "yesno", askedBy: ["bcrs", "ffe", "firstent"] },
    { id: "stateAidDetail", label: "Amount, scheme, term and date drawn", type: "textarea", askedBy: ["bcrs", "firstent"] },
    { id: "niOrGbBorrower", label: "GB borrower or NI borrower?", type: "select", options: ["GB", "NI"], askedBy: ["bcrs", "firstent"] },
  ],
};

// ---- Jobs & social impact ----

export const JOBS_IMPACT_SECTION: ApplicationSection = {
  id: "jobsImpact",
  title: "Jobs and impact",
  fields: [
    { id: "jobsCreated", label: "Jobs this loan will create", type: "number", askedBy: ["bcrs", "ffe", "firstent"] },
    { id: "jobsProtected", label: "Jobs this loan will protect", type: "number", askedBy: ["bcrs", "ffe", "firstent"] },
    { id: "jobsImpactDetail", label: "How the loan protects these jobs/sales, and which roles", type: "textarea", askedBy: ["bcrs"] },
    { id: "lastQuarterTurnover", label: "Business turnover, last quarter", type: "currency", askedBy: ["bcrs"] },
  ],
};

// ---- Security offered ----

export const SECURITY_SECTION: ApplicationSection = {
  id: "security",
  title: "Security you can offer",
  fields: [
    { id: "securityType", label: "Type", note: "Debenture, personal guarantee, second charge, another asset — or none.", type: "text", askedBy: ["bcrs", "cwrt", "ffe"] },
    { id: "securityValueDetail", label: "Current value and details (address, model number, etc.)", type: "textarea", askedBy: ["cwrt"] },
    { id: "securityInWhoseName", label: "In whose name (or joint)", type: "text", askedBy: ["cwrt"] },
  ],
};

// ---- Consents & declarations ----

export const CONSENTS_SECTION: ApplicationSection = {
  id: "consents",
  title: "Consents and declaration",
  note: "Every lender needs these before they can hold or check your data — the wording differs slightly by lender but you only need to answer once.",
  fields: [
    { id: "consentHoldData", label: "I consent to the lender holding my/our data to assess, disburse and monitor this loan", type: "yesno", required: true, askedBy: ["bcrs", "cwrt", "ffe", "firstent"] },
    { id: "consentShareData", label: "I consent to the lender sharing this with its affiliated/funding organisations", type: "yesno", required: true, askedBy: ["bcrs", "cwrt", "ffe", "firstent"] },
    { id: "consentCreditCheck", label: "I authorise credit reference and other normal enquiries for this application", type: "yesno", required: true, askedBy: ["bcrs", "cwrt", "ffe", "firstent"] },
    { id: "consentPublicity", label: "The lender may use our name in its publicity material", type: "yesno", askedBy: ["bcrs", "cwrt", "firstent"] },
    { id: "consentOpenBanking", label: "I consent to read-only open banking access", note: "CWRT can't process your application without this one.", type: "yesno", askedBy: ["cwrt", "firstent"] },
    { id: "consentMarketing", label: "I'm happy to be contacted about related products and services", note: "Optional — this doesn't affect the loan decision either way.", type: "yesno", askedBy: ["bcrs", "cwrt", "firstent"] },
    { id: "preferredContactMethod", label: "Preferred contact method", type: "select", options: ["Post", "Email", "Telephone"], askedBy: ["bcrs", "cwrt"] },
    { id: "declarationTrue", label: "I/We confirm the information given is true, accurate and complete", type: "yesno", required: true, askedBy: ["bcrs", "cwrt", "ffe", "firstent"] },
  ],
};

export const APPLICATION_SECTIONS: ApplicationSection[] = [
  COMPANY_SECTION,
  FACILITY_SECTION,
  BANK_DECLINE_SECTION,
  BANK_ACCOUNTANT_SECTION,
  EXISTING_BORROWING_SECTION,
  STATE_AID_SECTION,
  JOBS_IMPACT_SECTION,
  SECURITY_SECTION,
  CONSENTS_SECTION,
];

// ---- Director / applicant — repeatable block, one per person ----

export const DIRECTOR_BASIC_FIELDS: ApplicationFieldDef[] = [
  { id: "fullName", label: "Full name", type: "text", required: true, askedBy: ["cwrt", "ffe", "firstent"] },
  { id: "dateOfBirth", label: "Date of birth", type: "date", required: true, askedBy: ["cwrt", "firstent"] },
  { id: "niNumber", label: "National Insurance number", type: "text", askedBy: ["cwrt", "firstent"] },
  { id: "nationality", label: "Nationality / British citizen?", note: "If not, your residency status — some lenders need evidence of leave to remain for at least the loan term.", type: "text", askedBy: ["ffe"] },
  { id: "homeAddress", label: "Home address, postcode", type: "textarea", required: true, askedBy: ["cwrt", "ffe", "firstent"] },
  { id: "timeAtAddress", label: "Time at current address", note: "If under 3 years, add your previous address below — lenders run a 3-year address history on the credit search either way.", type: "text", askedBy: ["cwrt", "ffe", "firstent"] },
  { id: "previousAddress", label: "Previous address (if under 3 years at current)", type: "textarea", askedBy: ["cwrt", "ffe", "firstent"] },
  { id: "homeOwnerOrTenant", label: "Home owner or tenant?", type: "select", options: ["Owner", "Tenant"], askedBy: ["cwrt"] },
  { id: "personalPhone", label: "Phone / mobile", type: "text", askedBy: ["cwrt", "ffe", "firstent"] },
  { id: "personalEmail", label: "Personal email", type: "text", askedBy: ["cwrt", "ffe", "firstent"] },
  { id: "shareholdingPercent", label: "Shareholding / share of the business (%)", type: "number", askedBy: ["ffe"] },
  { id: "yearsWithBusiness", label: "Years with the business", type: "number", askedBy: ["ffe"] },
  { id: "capitalIntroduced", label: "Your own capital introduced into the business", type: "currency", askedBy: ["ffe"] },
  { id: "positionInBusiness", label: "Position within the business", type: "text", askedBy: ["bcrs", "firstent"] },
  { id: "existingPersonalGuarantees", label: "Existing personal guarantees given, on this or other facilities", type: "textarea", askedBy: ["bcrs", "cwrt", "ffe"] },
];

export const DIRECTOR_CREDIT_FIELDS: ApplicationFieldDef[] = [
  {
    id: "everAssociatedWithFailedBusiness",
    label: "Ever been associated, personally or officially, with a failed business?",
    type: "yesno",
    required: true,
    askedBy: ["bcrs", "cwrt", "ffe", "firstent"],
  },
  { id: "failedBusinessDetail", label: "If yes, full details", type: "textarea", askedBy: ["bcrs", "cwrt", "ffe", "firstent"] },
  {
    id: "personalInsolvency",
    label: "Ever personally subject to insolvency (IVA, bankruptcy, CCJ, Debt Management Plan)?",
    type: "yesno",
    required: true,
    askedBy: ["bcrs", "cwrt", "ffe", "firstent"],
  },
  { id: "personalInsolvencyDetail", label: "If yes, full details", type: "textarea", askedBy: ["bcrs", "cwrt", "ffe", "firstent"] },
  { id: "convictedFraudOrDishonesty", label: "Ever convicted of fraud or an offence involving dishonesty?", type: "yesno", askedBy: ["ffe"] },
  { id: "removedFromBoard", label: "Ever removed from a company board?", type: "yesno", askedBy: ["ffe"] },
  { id: "hadGovGuaranteedLoan", label: "Ever had a loan under a Government Loan Guarantee / Enterprise Finance Guarantee scheme?", type: "yesno", askedBy: ["ffe"] },
  { id: "onDebtManagementProgramme", label: "Currently on a Debt Management Programme?", type: "yesno", askedBy: ["ffe"] },
  { id: "personalCcjDetail", label: "Personal CCJs — date, amount, lodged by, reason, status", note: "Include ones that are now satisfied, not just outstanding ones.", type: "textarea", askedBy: ["cwrt", "bcrs", "firstent"] },
];

export const DIRECTOR_ASSETS_FIELDS: ApplicationFieldDef[] = [
  { id: "propertyAssetsDetail", label: "Property: market value, mortgage outstanding, equity", type: "textarea", askedBy: ["ffe", "cwrt"] },
  { id: "otherAssetsDetail", label: "Other assets: life policies, savings, stocks/shares, anything else significant", type: "textarea", askedBy: ["ffe"] },
  { id: "personalLiabilitiesDetail", label: "Liabilities: overdraft, loans, credit cards, HP, tax due — lender, limit, balance", type: "textarea", askedBy: ["ffe", "cwrt"] },
  { id: "guaranteesGiven", label: "Guarantees given / contingent liabilities", type: "textarea", askedBy: ["ffe"] },
];

export const DIRECTOR_BUDGET_FIELDS: ApplicationFieldDef[] = [
  {
    id: "monthlyIncomeDetail",
    label: "Monthly income: drawings, salary/wages, dividends, benefits, pension",
    note: "Only asked in detail by CWRT — worth having ready regardless, it speeds up any lender's affordability check.",
    type: "textarea",
    askedBy: ["cwrt"],
  },
  { id: "monthlyOutgoingsDetail", label: "Monthly outgoings: mortgage/rent, utilities, phone, food, motoring, insurance, other", type: "textarea", askedBy: ["cwrt"] },
];

export const DIRECTOR_EDI_FIELDS: ApplicationFieldDef[] = [
  {
    id: "ethnicOrigin",
    label: "Ethnic origin",
    note: "For lender impact monitoring only. It is never used in the lending decision, and you can select \"prefer not to say.\"",
    type: "select",
    options: [
      "White British", "White Irish", "White (other)", "Black Caribbean", "Black African", "Black British",
      "Black (other)", "Indian", "Pakistani", "Bangladeshi", "Asian (other)", "Asian British", "Mixed (other)",
      "Chinese", "Other", "Prefer not to say",
    ],
    askedBy: ["cwrt", "firstent"],
  },
  {
    id: "disability",
    label: "Do you consider yourself to have a disability?",
    note: "For lender impact monitoring only. Tell your Investment Manager if you'd like extra support with the application.",
    type: "select",
    options: ["Yes", "No", "Prefer not to say"],
    askedBy: ["cwrt", "firstent"],
  },
  { id: "gender", label: "Gender", type: "select", options: ["Male", "Female", "Prefer not to say"], askedBy: ["cwrt"] },
];

export const DIRECTOR_SECTIONS: { id: string; title: string; note?: string; fields: ApplicationFieldDef[] }[] = [
  { id: "directorBasic", title: "About you", fields: DIRECTOR_BASIC_FIELDS },
  {
    id: "directorCredit",
    title: "Credit history",
    note: "Answer truthfully — the answer affects timing, not automatically the outcome, and lenders find out anyway via the credit search.",
    fields: DIRECTOR_CREDIT_FIELDS,
  },
  { id: "directorAssets", title: "Personal assets & liabilities", fields: DIRECTOR_ASSETS_FIELDS },
  { id: "directorBudget", title: "Personal budget", fields: DIRECTOR_BUDGET_FIELDS },
  { id: "directorEdi", title: "Equal opportunities monitoring (optional)", fields: DIRECTOR_EDI_FIELDS },
];

export type ApplicationAnswers = Record<string, string>;

export type ApplicationDirector = { id: string } & ApplicationAnswers;

export type ApplicationDataStatus = "not_sent" | "sent" | "partial" | "complete" | "signed";

export interface ApplicationDataState {
  status: ApplicationDataStatus;
  token?: string;
  sentAt?: string;
  submittedAt?: string;
  signedAt?: string;
  signedName?: string;
  signedTitle?: string;
  signedIp?: string;
  answers: ApplicationAnswers;
  directors: ApplicationDirector[];
}

export function emptyApplicationData(): ApplicationDataState {
  return { status: "not_sent", answers: {}, directors: [] };
}

export function parseApplicationData(raw: unknown): ApplicationDataState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyApplicationData();
  const rec = raw as Record<string, unknown>;
  const answers: ApplicationAnswers = {};
  if (rec.answers && typeof rec.answers === "object" && !Array.isArray(rec.answers)) {
    for (const [key, value] of Object.entries(rec.answers as Record<string, unknown>)) {
      if (typeof value === "string") answers[key] = value;
    }
  }
  const directors: ApplicationDirector[] = Array.isArray(rec.directors)
    ? rec.directors
        .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
        .map((row) => {
          const out: ApplicationDirector = { id: typeof row.id === "string" ? row.id : `d${Math.random().toString(36).slice(2, 8)}` };
          for (const [key, value] of Object.entries(row)) {
            if (key !== "id" && typeof value === "string") out[key] = value;
          }
          return out;
        })
    : [];
  const status = (
    ["not_sent", "sent", "partial", "complete", "signed"] as ApplicationDataStatus[]
  ).includes(rec.status as ApplicationDataStatus)
    ? (rec.status as ApplicationDataStatus)
    : emptyApplicationData().status;
  return {
    status: typeof rec.signedAt === "string" && rec.signedAt ? "signed" : status,
    token: typeof rec.token === "string" ? rec.token : undefined,
    sentAt: typeof rec.sentAt === "string" ? rec.sentAt : undefined,
    submittedAt: typeof rec.submittedAt === "string" ? rec.submittedAt : undefined,
    signedAt: typeof rec.signedAt === "string" ? rec.signedAt : undefined,
    signedName: typeof rec.signedName === "string" ? rec.signedName : undefined,
    signedTitle: typeof rec.signedTitle === "string" ? rec.signedTitle : undefined,
    signedIp: typeof rec.signedIp === "string" ? rec.signedIp : undefined,
    answers,
    directors,
  };
}

export function isApplicationSigned(data: ApplicationDataState | null | undefined): boolean {
  return Boolean(data?.signedAt && data.signedName);
}

export type ApplicationFileSeed = {
  companyName?: string;
  companyNumber?: string;
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
};

export function seedAnswersFromFile(file: ApplicationFileSeed, saved?: ApplicationAnswers): ApplicationAnswers {
  const seeded: ApplicationAnswers = {};
  if (file.companyName) seeded.legalName = file.companyName;
  if (file.companyNumber) seeded.companyNumber = file.companyNumber;
  if (file.registeredAddress) seeded.tradingAddress = file.registeredAddress;
  const postcode =
    file.postcode ||
    String(file.registeredAddress || "").match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i)?.[1];
  if (postcode) seeded.postcode = postcode.toUpperCase().replace(/\s+/, " ");
  if (file.website) seeded.website = file.website;
  if (file.natureOfBusiness) seeded.natureOfBusiness = file.natureOfBusiness;
  if (file.legalEntityType) {
    const raw = file.legalEntityType.toLowerCase();
    seeded.legalEntityType = /ltd|limited/.test(raw)
      ? "Limited company"
      : /llp/.test(raw)
        ? "LLP"
        : /sole/.test(raw)
          ? "Sole trader"
          : /partner/.test(raw)
            ? "Partnership"
            : file.legalEntityType;
  } else if (file.companyNumber) seeded.legalEntityType = "Limited company";
  if (file.startDate) seeded.startDate = file.startDate;
  if (file.loanAmount != null && file.loanAmount !== "") {
    const n = typeof file.loanAmount === "number" ? file.loanAmount : Number(String(file.loanAmount).replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(n)) seeded.loanAmount = `£${Math.round(n).toLocaleString("en-GB")}`;
  }
  if (file.term != null && file.term !== "") seeded.loanTerm = `${file.term} months`;
  if (file.loanPurpose) seeded.loanPurpose = file.loanPurpose;
  if (file.existingBorrowing) seeded.existingBorrowingDetail = file.existingBorrowing;
  if (file.securityType) seeded.securityType = file.securityType;
  if (file.companyNumber) seeded.niOrGbBorrower = "GB";
  return { ...seeded, ...(saved || {}) };
}

export function seedDirectorFromContact(
  contact: { id?: number | string; name?: string | null; email?: string | null; phone?: string | null; role?: string | null },
  saved?: ApplicationDirector,
): ApplicationDirector {
  const id = saved?.id || (contact.id != null ? `c${contact.id}` : `d${Math.random().toString(36).slice(2, 8)}`);
  return {
    id,
    fullName: saved?.fullName || contact.name || "",
    personalEmail: saved?.personalEmail || contact.email || "",
    personalPhone: saved?.personalPhone || contact.phone || "",
    positionInBusiness: saved?.positionInBusiness || contact.role || "",
    ...(saved || {}),
  };
}

export function applyApplicationSignature(
  data: ApplicationDataState,
  payload: { name: string; title?: string },
  meta: { at: string; ip?: string },
): ApplicationDataState {
  const name = String(payload.name || "").trim();
  if (!name) throw Object.assign(new Error("Sign with your name."), { status: 400 });
  if (!isApplicationDataComplete(data)) {
    throw Object.assign(new Error("Complete the required fields before signing."), { status: 400 });
  }
  return {
    ...data,
    status: "signed",
    submittedAt: data.submittedAt || meta.at,
    signedAt: meta.at,
    signedName: name,
    signedTitle: String(payload.title || "").trim() || undefined,
    signedIp: meta.ip,
  };
}

function isBlank(value: string | undefined): boolean {
  return !value || !value.trim();
}

/** Required fields on the single (non-repeated) sections — what gates the missing-info chase. */
export function missingRequiredFields(answers: ApplicationAnswers): ApplicationFieldDef[] {
  const missing: ApplicationFieldDef[] = [];
  for (const section of APPLICATION_SECTIONS) {
    for (const field of section.fields) {
      if (field.required && isBlank(answers[field.id])) missing.push(field);
    }
  }
  return missing;
}

/** At least one director is required; each director present must answer their required fields. */
export function missingRequiredDirectorFields(directors: ApplicationDirector[]): {
  noDirectors: boolean;
  perDirector: Array<{ directorId: string; missing: ApplicationFieldDef[] }>;
} {
  const requiredDirectorFields = DIRECTOR_SECTIONS.flatMap((s) => s.fields).filter((f) => f.required);
  if (directors.length === 0) {
    return { noDirectors: true, perDirector: [] };
  }
  return {
    noDirectors: false,
    perDirector: directors.map((d) => ({
      directorId: d.id,
      missing: requiredDirectorFields.filter((f) => isBlank(d[f.id])),
    })),
  };
}

export function isApplicationDataComplete(data: Pick<ApplicationDataState, "answers" | "directors">): boolean {
  if (missingRequiredFields(data.answers).length > 0) return false;
  const directorGaps = missingRequiredDirectorFields(data.directors);
  if (directorGaps.noDirectors) return false;
  return directorGaps.perDirector.every((d) => d.missing.length === 0);
}

/** Plain-English gap list for the missing-info email — not field IDs. */
export function applicationDataGapSummary(data: Pick<ApplicationDataState, "answers" | "directors">): string[] {
  const gaps = missingRequiredFields(data.answers).map((f) => f.label);
  const directorGaps = missingRequiredDirectorFields(data.directors);
  if (directorGaps.noDirectors) gaps.push("Details for at least one director/owner");
  else {
    for (const { missing } of directorGaps.perDirector) {
      for (const f of missing) if (!gaps.includes(f.label)) gaps.push(f.label);
    }
  }
  return gaps;
}
