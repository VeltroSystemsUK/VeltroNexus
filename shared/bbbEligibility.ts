export const BBB_TURNOVER_CAP_GBP = 45_000_000;
export const BBB_FACILITY_CAP_GBP = 2_000_000;
export const BBB_SCHEME_NAME = "British Business Bank Growth Guarantee Scheme";
export const BBB_SCHEME_URL =
  "https://www.british-business-bank.co.uk/finance-options/debt-finance/growth-guarantee-scheme";

export type BbbStatus = "pass" | "fail" | "incomplete";

export type BbbQuestion = {
  id: string;
  text: string;
  help: string;
  requiredAnswer: true;
  category: "eligibility";
};

export const BBB_QUESTIONS: BbbQuestion[] = [
  {
    id: "uk_trading",
    text: "Is the business based in the UK and actively trading here?",
    help: "The borrower must carry out trading activity in the UK.",
    requiredAnswer: true,
    category: "eligibility",
  },
  {
    id: "trading_income",
    text: "Does more than 50% of its income come from trading activity?",
    help: "Investment, property rental, and holding-company income do not count as trading for most applicants.",
    requiredAnswer: true,
    category: "eligibility",
  },
  {
    id: "turnover_cap",
    text: "Is annual group turnover £45 million or less?",
    help: "Growth Guarantee Scheme limit. The announced £54m increase is not the live operational cap.",
    requiredAnswer: true,
    category: "eligibility",
  },
  {
    id: "facility_cap",
    text: "Is the requested facility £2 million or less?",
    help: "GGS generally supports up to £2m per business group (£1m if in scope of the Northern Ireland Protocol).",
    requiredAnswer: true,
    category: "eligibility",
  },
  {
    id: "not_in_difficulty",
    text: "Is the business solvent and not in insolvency proceedings?",
    help: "Must not be a 'business in difficulty', including relevant insolvency proceedings.",
    requiredAnswer: true,
    category: "eligibility",
  },
  {
    id: "viable",
    text: "Is there a viable business proposition that can afford additional debt?",
    help: "The lender must consider the borrower viable. We will not consider an application that fails this test.",
    requiredAnswer: true,
    category: "eligibility",
  },
  {
    id: "legitimate_purpose",
    text: "Are the funds for a legitimate business purpose (not personal use or property investment)?",
    help: "Cashflow, investment, refinance, and growth are permitted. Personal use and property investment are not.",
    requiredAnswer: true,
    category: "eligibility",
  },
  {
    id: "not_excluded_sector",
    text: "Is the business outside excluded sectors (gambling, weapons, pornography, tobacco, regulated credit)?",
    help: "These sectors are not eligible for this funding route.",
    requiredAnswer: true,
    category: "eligibility",
  },
  {
    id: "subsidy_room",
    text: "Can the business confirm this facility will not exceed its UK subsidy limit?",
    help: "GGS is a subsidy. Previous public support may reduce or block the amount available.",
    requiredAnswer: true,
    category: "eligibility",
  },
];

export type BbbInput = {
  answers?: Record<string, boolean | undefined>;
  companyStatus?: string;
  companyStatusDetail?: string;
  sicCodes?: string[];
  address?: string;
  turnoverGbp?: number;
  loanAmountGbp?: number;
};

export type BbbAssessment = {
  status: BbbStatus;
  isEligible: boolean;
  reasons: string[];
  answers: Record<string, boolean | undefined>;
  autoFlags: string[];
  assessedAt: string;
  scheme: string;
};

const EXCLUDED_SIC_PREFIXES = ["64", "65", "66", "920", "254", "120"];
const PROPERTY_SIC_PREFIXES = ["68"];

function digits(sic: string): string {
  return String(sic || "").replace(/\D/g, "");
}

function looksUk(address?: string): boolean | null {
  if (!address) return null;
  const text = address.toUpperCase();
  if (/\b(UNITED STATES|USA|FRANCE|GERMANY|SPAIN|IRELAND|DUBLIN|UAE|DUBAI|HONG KONG|SINGAPORE|AUSTRALIA)\b/.test(text)) {
    return false;
  }
  if (/\b(UNITED KINGDOM|GREAT BRITAIN|\bUK\b|\bENGLAND\b|\bSCOTLAND\b|\bWALES\b|NORTHERN IRELAND)\b/.test(text)) {
    return true;
  }
  if (/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/.test(text)) return true;
  return null;
}

function inInsolvency(status?: string, detail?: string): boolean {
  const text = `${status || ""} ${detail || ""}`.toLowerCase();
  return /liquidat|administ|receivership|insolvency|wound up|dissolved|moratorium/.test(text);
}

function sicExcluded(sicCodes: string[]): boolean {
  return sicCodes.some((sic) => {
    const code = digits(sic);
    return EXCLUDED_SIC_PREFIXES.some((prefix) => code.startsWith(prefix));
  });
}

function sicProperty(sicCodes: string[]): boolean {
  return sicCodes.some((sic) => {
    const code = digits(sic);
    return PROPERTY_SIC_PREFIXES.some((prefix) => code.startsWith(prefix));
  });
}

export function assessBbbEligibility(input: BbbInput): BbbAssessment {
  const answers: Record<string, boolean | undefined> = { ...(input.answers || {}) };
  const autoFlags: string[] = [];
  const reasons: string[] = [];

  if (inInsolvency(input.companyStatus, input.companyStatusDetail)) {
    answers.not_in_difficulty = false;
    autoFlags.push("Companies House status shows insolvency / not a going concern");
  }

  if (sicExcluded(input.sicCodes || [])) {
    answers.not_excluded_sector = false;
    autoFlags.push("SIC code is in a sector excluded from this funding route");
  }

  if (sicProperty(input.sicCodes || [])) {
    answers.trading_income = false;
    answers.legitimate_purpose = false;
    autoFlags.push("SIC code indicates property / non-trading activity");
  }

  const uk = looksUk(input.address);
  if (uk === false) {
    answers.uk_trading = false;
    autoFlags.push("Registered address does not look UK-based");
  } else if (uk === true && answers.uk_trading === undefined) {
    answers.uk_trading = true;
    autoFlags.push("UK registered address — treated as UK-based pending confirmation of trading activity");
  }

  if (typeof input.turnoverGbp === "number") {
    answers.turnover_cap = input.turnoverGbp <= BBB_TURNOVER_CAP_GBP;
    if (!answers.turnover_cap) {
      autoFlags.push(`Turnover £${input.turnoverGbp.toLocaleString()} exceeds the £45m GGS cap`);
    }
  }

  if (typeof input.loanAmountGbp === "number") {
    answers.facility_cap = input.loanAmountGbp <= BBB_FACILITY_CAP_GBP;
    if (!answers.facility_cap) {
      autoFlags.push(`Requested facility £${input.loanAmountGbp.toLocaleString()} exceeds the £2m GGS cap`);
    }
  }

  for (const question of BBB_QUESTIONS) {
    const answer = answers[question.id];
    if (answer === undefined) {
      reasons.push(`Not confirmed: ${question.text}`);
      continue;
    }
    if (answer !== question.requiredAnswer) {
      reasons.push(`Failed: ${question.text}`);
    }
  }

  const missing = BBB_QUESTIONS.some((question) => answers[question.id] === undefined);
  const failed = BBB_QUESTIONS.some((question) => answers[question.id] === false);
  const status: BbbStatus = failed ? "fail" : missing ? "incomplete" : "pass";

  return {
    status,
    isEligible: status === "pass",
    reasons,
    answers,
    autoFlags,
    assessedAt: new Date().toISOString(),
    scheme: BBB_SCHEME_NAME,
  };
}

export function bbbBlockMessage(assessment?: BbbAssessment | null): string {
  if (!assessment || assessment.status === "incomplete") {
    return "British Business Bank eligibility must be confirmed before this application can be considered.";
  }
  if (assessment.status === "fail") {
    return `Not eligible for ${BBB_SCHEME_NAME}. ${assessment.reasons[0] || "See the eligibility record."}`;
  }
  return "";
}
