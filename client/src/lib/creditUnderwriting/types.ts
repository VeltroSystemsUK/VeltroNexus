export enum LoanStatus {
  PENDING = 'PENDING',
  ELIGIBLE = 'ELIGIBLE',
  INELIGIBLE = 'INELIGIBLE',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  MANUAL_REVIEW = 'MANUAL_REVIEW'
}

export interface PolicyQuestion {
  id: string;
  text: string;
  requiredAnswer: boolean;
  category: 'eligibility' | 'exclusion';
}

export interface MonthlyMetric {
  month: string;
  income: number;
  expenses: number;
  net: number;
  closingBalance: number;
}

export interface RiskFlag {
  label: string;
  isActive: boolean;
}

export interface TransactionFinding {
  date: string;
  description: string;
  amount: number;
  type: 'LOAN_REPAYMENT' | 'TRANSFER' | 'ANOMALY';
  details: string;
}

export enum AccountCategory {
  SALES = 'Sales / Revenue',
  OTHER_INCOME = 'Other Income',
  COST_OF_SALES = 'Cost of Sales',
  WAGES = 'Wages & Salaries',
  RENT_RATES = 'Rent & Rates',
  UTILITIES = 'Utilities',
  MARKETING = 'Marketing & Advertising',
  INSURANCE = 'Insurance',
  PROFESSIONAL_FEES = 'Professional Fees',
  BANK_FEES = 'Bank Fees & Interest',
  VEHICLE = 'Vehicle & Travel',
  OFFICE = 'Office Costs',
  SUNDRY = 'Sundry / General',
  FINANCE_COSTS = 'Loan Repayments',
  DRAWINGS = 'Directors Drawings / Divs',
  TAX = 'Tax / VAT / PAYE',
  UNCATEGORIZED = 'Uncategorized'
}

export interface ProfitAndLoss {
  turnover: number;
  costOfSales: number;
  grossProfit: number;
  expenses: Record<string, number>;
  totalExpenses: number;
  netProfit: number;
  periodMonths: number;
}

export interface FinancialAnalysis {
  averageMonthlyRevenue: number;
  averageMonthlyExpenses: number;
  netDisposableIncome: number;
  dscr: number;
  redFlags: RiskFlag[];
  riskScore: string;
  summary: string;
  monthlyBreakdown: MonthlyMetric[];
  transactionCount?: number;
  profitAndLoss: ProfitAndLoss;
  excludedTransferValue: number;
  excludedTransferCount: number;
  preliminaryFindings: {
    loans: TransactionFinding[];
    transfers: TransactionFinding[];
    anomalies: TransactionFinding[];
  };
}

export interface LinkedCompany {
  companyName: string;
  companyNumber: string;
  companyStatus: string;
  relationType: string;
  adverseMediaCheck?: string;
}

export interface YearEndAccountsAnalysis {
  yearEnding: string;
  turnover: number;
  netAssets: number;
  shareholderFunds: number;
  notesAnalysis: string;
  redFlags: string[];
}

export interface Officer {
  name: string;
  role: string;
  appointed: string;
}

export interface PSC {
  name: string;
  nature: string;
}

export interface Charge {
  created_on: string;
  persons_entitled: { name: string }[];
  status: string;
}

export interface Filing {
  date: string;
  type: string;
  description: string;
}

export interface DueDiligenceResult {
  companyName: string;
  registrationNumber: string;
  registeredAddress?: string;
  incorporationDate?: string;
  companyStatus?: string;
  sicCodes?: string[];
  summary: string;
  webSummary?: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  flags: string[];
  sources: { title: string; uri: string }[];
  linkedCompanies: LinkedCompany[];
  accountsAnalysis?: YearEndAccountsAnalysis;
  officers?: Officer[];
  pscs?: PSC[];
  charges?: Charge[];
  filingHistory?: Filing[];
}

export interface LoanDetails {
  amount: number;
  termMonths: number;
  interestRate: number;
  monthlyRepayment: number;
}

export type ThemeOption = 'teal' | 'blue' | 'violet' | 'slate';
export type CurrencyOption = 'GBP' | 'USD' | 'EUR';
export type LanguageOption = 'en' | 'es' | 'fr';

export interface AppSettings {
  theme: ThemeOption;
  currency: CurrencyOption;
  language: LanguageOption;
  policyQuestions: PolicyQuestion[];
}

export interface AdviserSummaryData {
  soarRef: string;
  businessName: string;
  product: string;
  amount: number;
  term: number;
  region: string;
  legalStructure: string;
  sector: string;
  purpose: string;
  sections: Record<string, string>;
  questionnaire: Record<string, 'Yes' | 'No' | 'N/A' | undefined>;
}

export interface UnderwritingState {
  step: number;
  loanDetails: LoanDetails;
  eligibilityAnswers: Record<string, boolean>;
  isEligible: boolean;
  financialData: string | null;
  analysis: FinancialAnalysis | null;
  dueDiligence: DueDiligenceResult | null;
  isAnalyzing: boolean;
  refinanceAmount: number;
  projectedRevenueGrowth: number;
  adviserSummary: AdviserSummaryData;
}

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface AuditedAccountYear {
  yearEnding: string;
  turnover: number;
  grossProfit: number;
  netProfit: number;
  totalAssets: number;
  totalLiabilities: number;
  netAssets: number;
  shareholderFunds: number;
  cashAndEquivalents: number;
  debtors: number;
  creditors: number;
  bankLoans: number;
}

export interface AccountsRatios {
  grossProfitMargin: number;
  netProfitMargin: number;
  currentRatio: number;
  quickRatio: number;
  debtToEquity: number;
  interestCover: number;
  debtorDays: number;
  creditorDays: number;
  returnOnCapitalEmployed: number;
}

export interface AccountsConcern {
  category: 'going_concern' | 'contingent_liability' | 'related_party' | 'auditor_opinion' | 'subsequent_event' | 'other';
  description: string;
  severity: 'low' | 'medium' | 'high';
  yearEnding: string;
}

export interface AuditedAccountsAnalysis {
  years: AuditedAccountYear[];
  ratios: {
    year: string;
    ratios: AccountsRatios;
  }[];
  trends: {
    turnoverGrowth: number[];
    profitGrowth: number[];
    netAssetGrowth: number[];
    trend: 'improving' | 'stable' | 'declining';
    summary: string;
  };
  dscr: {
    historical: number[];
    average: number;
    trend: 'improving' | 'stable' | 'declining';
  };
  concerns: AccountsConcern[];
  auditorOpinion: string;
  summary: string;
  riskAssessment: 'low' | 'medium' | 'high';
}
