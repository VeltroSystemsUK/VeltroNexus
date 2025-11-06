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
    id: "application-validation",
    name: "Application Validation",
    items: [
      {
        id: "av-1",
        description: "Recorded under SOAR ref and priced BoE Base + margin per current pricing memo.",
      },
      {
        id: "av-2",
        description: "Applicant(s) aged 18+, business domiciled in England per §3.3.",
      },
      {
        id: "av-3",
        description: "Loan ≤ 70% of total project cost, contribution ≥ 10%.",
      },
      {
        id: "av-4",
        description: "Purpose not excluded (no property development, crypto, gambling, or lending activity).",
      },
    ],
  },
  {
    id: "documentation-kyc",
    name: "Documentation & KYC",
    items: [
      {
        id: "dk-1",
        description: "Full loan application and Adviser Summary completed.",
      },
      {
        id: "dk-2",
        description: "6 months bank statements (business/personal) reviewed with conduct commentary.",
      },
      {
        id: "dk-3",
        description: "Photographic ID and proof of address sighted and copied.",
      },
      {
        id: "dk-4",
        description: "Credit search (3 years) authorised and reviewed.",
      },
      {
        id: "dk-5",
        description: "Adverse data or voter-roll absence commented with mitigation.",
      },
    ],
  },
  {
    id: "financial-review",
    name: "Financial Review",
    items: [
      {
        id: "fr-1",
        description: "FY24–FY25 accounts reconciled; Notes 7–9 referenced.",
      },
      {
        id: "fr-2",
        description: "Management accounts (YTD) reviewed.",
      },
      {
        id: "fr-3",
        description: "Cashflow forecast includes VAT, PAYE, CT, and loan repayments.",
      },
      {
        id: "fr-4",
        description: "Debtor book ageing < 90 days (or mitigation explained).",
      },
      {
        id: "fr-5",
        description: "Associate balances explained and recoverable.",
      },
    ],
  },
  {
    id: "credit-governance",
    name: "Credit & Governance",
    items: [
      {
        id: "cg-1",
        description: "D&B / Experian corporate rating and PAYDEX obtained.",
      },
      {
        id: "cg-2",
        description: "Director(s) – no CCJs, verified via CRA.",
      },
      {
        id: "cg-3",
        description: "Bank conduct acceptable (no unpaid items, excesses, or persistent overdrafts).",
      },
    ],
  },
  {
    id: "capacity-contracts",
    name: "Capacity & Contracts",
    items: [
      {
        id: "cc-1",
        description: "Management experience documented (role & tenure).",
      },
      {
        id: "cc-2",
        description: "Active contracts tabled (Client | Value | Start | End | Status).",
      },
      {
        id: "cc-3",
        description: "Renewals evidenced as scope expansions, not new clients.",
      },
    ],
  },
  {
    id: "loan-structure-security",
    name: "Loan Structure & Security",
    items: [
      {
        id: "ls-1",
        description: "Loan fund type (RGF, ELEM 2, MEIF II) confirmed.",
      },
      {
        id: "ls-2",
        description: "Personal Guarantee % within policy (35–100%).",
      },
      {
        id: "ls-3",
        description: "Debenture or security justified if taken.",
      },
      {
        id: "ls-4",
        description: "Legal advice/waiver obtained from guarantor(s).",
      },
    ],
  },
  {
    id: "repayment-affordability",
    name: "Repayment & Affordability",
    items: [
      {
        id: "ra-1",
        description: "Forecast CFF reconciles to FY25 accounts and bank statements.",
      },
      {
        id: "ra-2",
        description: "DSCR ≥ 1.5× base; sensitivity –20% revenue ≥ 1.0×.",
      },
      {
        id: "ra-3",
        description: "Director personal income vs. commitments ratio ≥ 1.25×.",
      },
    ],
  },
  {
    id: "insurance-compliance",
    name: "Insurance & Compliance",
    items: [
      {
        id: "ic-1",
        description: "Public Liability £10m, Employer £10m, PI £2m, renewal date verified.",
      },
      {
        id: "ic-2",
        description: "VAT registration confirmed.",
      },
      {
        id: "ic-3",
        description: "Licence or certification (e.g., CAA) valid for loan term.",
      },
    ],
  },
  {
    id: "bank-statement-log",
    name: "Bank Statement Log",
    items: [
      {
        id: "bs-1",
        description: "Three-month bank narrative log completed.",
      },
      {
        id: "bs-2",
        description: "All recurring credits/debits categorised.",
      },
      {
        id: "bs-3",
        description: "Internal transfers (e.g., GC C1 Inarasystems) identified and flagged.",
      },
    ],
  },
  {
    id: "recommendation-integrity",
    name: "Recommendation Integrity",
    items: [
      {
        id: "ri-1",
        description: "Adviser conclusion signed and dated.",
      },
      {
        id: "ri-2",
        description: "Lending Committee comments recorded.",
      },
      {
        id: "ri-3",
        description: "Loan amount, term, and interest rate consistent with fund terms.",
      },
    ],
  },
];
