import type { PolicyQuestion, AppSettings } from './types';

export const DEFAULT_INTEREST_RATE = 17.0;
export const DEFAULT_TERM_MONTHS = 60;
export const ARRANGEMENT_FEE_PERCENT = 3.5;
export const DSCR_THRESHOLD = 1.25;

export const ELIGIBILITY_QUESTIONS: PolicyQuestion[] = [
  {
    id: 'finance_refusal',
    text: 'Has the applicant been unable to raise finance from traditional sources (e.g., banks)?',
    requiredAnswer: true,
    category: 'eligibility'
  },
  {
    id: 'age',
    text: 'Is the applicant at least 18 years of age?',
    requiredAnswer: true,
    category: 'eligibility'
  },
  {
    id: 'location',
    text: 'Is the business located within the United Kingdom?',
    requiredAnswer: true,
    category: 'eligibility'
  },
  {
    id: 'legal',
    text: 'Is the business activity legal and compliant with UK laws?',
    requiredAnswer: true,
    category: 'eligibility'
  },
  {
    id: 'fca_credit',
    text: 'Is the business an FCA-regulated entity that directly offers/provides credit?',
    requiredAnswer: false,
    category: 'exclusion'
  },
  {
    id: 'crypto',
    text: 'Does the business deal with Crypto Currency or unregulated investments?',
    requiredAnswer: false,
    category: 'exclusion'
  },
  {
    id: 'property_dev',
    text: 'Is the business involved in property investment or development (excluding construction for others)?',
    requiredAnswer: false,
    category: 'exclusion'
  },
  {
    id: 'foreign_ownership',
    text: 'Does the business have significant foreign ownership (>20%)?',
    requiredAnswer: false,
    category: 'exclusion'
  },
  {
    id: 'complex_structure',
    text: 'Does the business have a complex ownership structure (Trusts, Offshore)?',
    requiredAnswer: false,
    category: 'exclusion'
  },
  {
    id: 'excluded_sectors',
    text: 'Is the business in an excluded sector (Gambling, Pornography, Weapons, Tobacco)?',
    requiredAnswer: false,
    category: 'exclusion'
  },
  {
    id: 'ethics',
    text: 'Does the business align with ethical standards?',
    requiredAnswer: true,
    category: 'eligibility'
  }
];

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'teal',
  currency: 'GBP',
  language: 'en',
  policyQuestions: ELIGIBILITY_QUESTIONS
};

export const THEME_CONFIG = {
  teal: { primary: 'bg-teal-600', hover: 'hover:bg-teal-700', text: 'text-teal-600', border: 'border-teal-500', bgSoft: 'bg-teal-50' },
  blue: { primary: 'bg-blue-600', hover: 'hover:bg-blue-700', text: 'text-blue-600', border: 'border-blue-500', bgSoft: 'bg-blue-50' },
  violet: { primary: 'bg-violet-600', hover: 'hover:bg-violet-700', text: 'text-violet-600', border: 'border-violet-500', bgSoft: 'bg-violet-50' },
  slate: { primary: 'bg-slate-700', hover: 'hover:bg-slate-800', text: 'text-slate-700', border: 'border-slate-600', bgSoft: 'bg-slate-100' },
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€'
};

export const PRODUCT_RULES: Record<string, { minAmount: number, maxAmount: number, minTerm: number, maxTerm: number }> = {
  RGF: { minAmount: 25000, maxAmount: 150000, minTerm: 12, maxTerm: 84 },
  ELEM2: { minAmount: 5000, maxAmount: 250000, minTerm: 12, maxTerm: 120 },
  MEIFII: { minAmount: 50000, maxAmount: 150000, minTerm: 36, maxTerm: 120 },
  STARTUP: { minAmount: 500, maxAmount: 25000, minTerm: 12, maxTerm: 60 }
};

export const EXCLUDED_PURPOSES = [
  "property development",
  "gambling",
  "pornography",
  "money lending"
];

export const SUMMARY_SECTIONS = [
  { key: "overview", title: "1 – Overview" },
  { key: "background", title: "2 – Background" },
  { key: "character", title: "C – Character" },
  { key: "ability", title: "A – Ability" },
  { key: "means", title: "M – Means" },
  { key: "purpose", title: "P – Purpose" },
  { key: "amount", title: "A – Amount" },
  { key: "repayment", title: "R – Repayment" },
  { key: "insurance", title: "I – Insurance" },
  { key: "bank", title: "10 – Bank Statement Summary" },
  { key: "swot", title: "11 – SWOT" },
  { key: "recommendation", title: "12 – Adviser Recommendation" }
];

export const CAMPARI_QUESTIONS: Record<string, string[]> = {
  character: [
    "Who are the owners/directors?",
    "What is their track record in business?",
    "How long has the business traded?",
    "Are there any CCJs, defaults, late filings, or governance concerns?",
    "What does the bank conduct show about reliability?",
    "Do credit reports (personal + business) show clean behaviour?",
    "Have statutory obligations (VAT, PAYE, CT) been met historically?",
    "Is management transparent and responsive to information requests?"
  ],
  ability: [
    "Does management have the skills and experience to run this business?",
    "What qualifications or industry experience do directors have?",
    "Is team capability sufficient to deliver contracts?",
    "What is the evidence of recurring revenue or proven delivery history?",
    "Are contracts, pipelines, or orders in place (and verified)?",
    "Are there operational or staffing gaps that impact delivery?"
  ],
  means: [
    "What is the business's current financial position (assets, liabilities, equity)?",
    "Do accounts show consistent profitability or deterioration?",
    "What does the balance sheet indicate (working capital, liquidity, gearing)?",
    "Are debtor, creditor, and stock levels reasonable?",
    "Are there related-party balances or intercompany exposures?",
    "Is the business over-leveraged or reliant on short-term debt?",
    "Does bank behaviour support the financial summaries?"
  ],
  purpose: [
    "What exactly is the loan for?",
    "Is the purpose permitted under policy?",
    "What evidence supports the requirement (invoices, quotes, lender statements)?",
    "For refinance: which lenders, what balances, what repayment savings?",
    "Does the purpose improve viability (e.g., reduce monthly outgoings)?",
    "Is the purpose business-related only (no private benefit)?"
  ],
  amount: [
    "How much funding is required, and how was this figure calculated?",
    "Does the amount reconcile to evidence?",
    "Is contribution required under policy, and is it verified?",
    "Is the loan size proportionate to turnover and balance-sheet strength?",
    "Could the same outcome be achieved with a smaller amount?"
  ],
  repayment: [
    "What are the historic cash inflows/outflows from bank statements?",
    "What will monthly repayment be under the loan?",
    "Is there sufficient free cashflow to service the loan?",
    "What is DSCR (base case and downside)?",
    "Are VAT/PAYE/CT obligations included in the cashflow forecast?",
    "Are forecasts realistic and tied to evidence?",
    "How will the business cope with shocks or revenue drops?"
  ],
  insurance: [
    "What insurance policies does the business hold (PL, EL, PI)?",
    "Are certificates valid and up to date?",
    "Is security available (debenture, PG, asset charge)?",
    "Are PG percentages compliant with fund policy?",
    "Are licences, accreditations, and regulatory requirements valid (e.g., ICO, CQC)?"
  ]
};
