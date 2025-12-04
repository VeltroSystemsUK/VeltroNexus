export interface ChecklistSection {
  id: string;
  name: string;
  items: {
    id: string;
    description: string;
  }[];
}

export const CHECKLIST_SECTIONS: ChecklistSection[] = [
  {
    id: "eligibility-criteria",
    name: "Eligibility & Loan Criteria",
    items: [
      {
        id: "ec-1",
        description: "Applicant/s aged over 18",
      },
      {
        id: "ec-2",
        description: "Applicant/s live in or have business in E Mids and have lived in E Mids min 18 months or business located/to be located in MEIF LEP areas (see LEP postcode document or question which local authority business rates are paid to)",
      },
      {
        id: "ec-3",
        description: "Loan amount criteria and security requirements met? (As per latest Loan Fund Update Document)",
      },
      {
        id: "ec-4",
        description: "Minimum contribution 15% for existing businesses",
      },
      {
        id: "ec-5",
        description: "Request not for excluded purpose (As per latest Loan Fund Update Document)",
      },
    ],
  },
  {
    id: "credit-checks",
    name: "Credit Checks",
    items: [
      {
        id: "cc-1",
        description: "Before proceeding further – credit searches obtained on all applicants on all addresses revealed over the last 3 years. Must not be more than a month old.",
      },
      {
        id: "cc-2",
        description: "If credit search reveals adverse information or not on voters roll then do not proceed further without investigating with applicant/s and obtaining a satisfactory explanation",
      },
    ],
  },
  {
    id: "kyc-identity",
    name: "KYC & Identity Verification",
    items: [
      {
        id: "kyc-1",
        description: "Copy photo ID - passport or if other ID obtain confirmation that UK citizen - certified by adviser or official that it is a copy of the original document",
      },
      {
        id: "kyc-2",
        description: "If non-EU, the passport must have written evidence of leave to remain in the UK for at least the term of the loan",
      },
      {
        id: "kyc-3",
        description: "Copy utility bill evidencing current address (note mobile phone bill not acceptable). If no utility bill, then refer to the loan fund manager for an acceptable alternative and note here.",
      },
    ],
  },
  {
    id: "application-documentation",
    name: "Application Documentation",
    items: [
      {
        id: "ad-1",
        description: "Signed and fully completed application form held with electronic signature",
      },
      {
        id: "ad-2",
        description: "Evidence of bank decline held",
      },
      {
        id: "ad-3",
        description: "Customer Charter given out",
      },
      {
        id: "ad-4",
        description: "Client Perception form given out",
      },
      {
        id: "ad-5",
        description: "Client details fully entered on the database and updated at each meeting (include Action Plan, notes, timesheet etc)",
      },
      {
        id: "ad-6",
        description: "Client Contact Form/s signed and completed and held in loan file (mandatory for the initial meeting but either a signed CCF or signed Action Plan is acceptable evidence for every subsequent client meeting) Or Copies of email chains with the client.",
      },
      {
        id: "ad-7",
        description: "Action plan completed (signed by the client if completed instead of CCF)",
      },
    ],
  },
  {
    id: "company-business-info",
    name: "Company & Business Information",
    items: [
      {
        id: "cb-1",
        description: "If the business is a Limited Co – then obtain a company search from Companies House. (Comment on results in adviser summary)",
      },
      {
        id: "cb-2",
        description: "Business plan",
      },
      {
        id: "cb-3",
        description: "CV for each director (if not included in the Business plan)",
      },
    ],
  },
  {
    id: "financial-documents",
    name: "Financial Documents",
    items: [
      {
        id: "fd-1",
        description: "Personal Statement of Asset & Liabilities for each Director",
      },
      {
        id: "fd-2",
        description: "One years cashflow forecast and Business Liabilities Form",
      },
      {
        id: "fd-3",
        description: "If existing business - 3 years trading accounts (or current management accounts if not traded that long)",
      },
      {
        id: "fd-4",
        description: "If existing business and no accounts available – recent copy tax return/s held to evidence turnover/drawings etc",
      },
      {
        id: "fd-5",
        description: "Full latest 6 months bank statements held (on business account if an existing business or personal account/s of all applicants if start-up). (Comment on bank account operation in adviser summary)",
      },
    ],
  },
  {
    id: "security-requirements",
    name: "Security Requirements",
    items: [
      {
        id: "sr-1",
        description: "If secured lending, then get mortgage statement to confirm borrowings against property offered",
      },
    ],
  },
  {
    id: "final-submission",
    name: "Final Submission",
    items: [
      {
        id: "fs-1",
        description: "Adviser summary form fully completed commenting on all the above – plus following attachments if RLS facility – Location Questionnaire and RLS Provisional Eligibility Assessment.",
      },
    ],
  },
];
