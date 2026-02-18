export interface LoanCalculation {
  monthlyPayment: number;
  totalInterest: number;
  totalRepayment: number;
  facilityFee: number;
  commissionAmount?: number;
  documentationFee?: number;
  legalFee?: number;
  totalCapitalBorrowed?: number;
}

export interface HirePurchaseCalculation {
  monthlyPayment: number;
  totalInterest: number;
  totalRepayment: number;
  commissionAmount?: number;
  optionToPurchaseFee: number;
}

export interface DSCRCalculation {
  dscr: number;
  status: "pass" | "warning" | "fail";
  sensitivityDSCR?: number;
  sensitivityStatus?: "pass" | "warning" | "fail";
}

export interface AffordabilityCalculation {
  ratio: number;
  status: "pass" | "fail";
  disposableIncome: number;
}

export interface FinancialRatios {
  currentRatio?: number;
  debtToEquity?: number;
  profitMargin?: number;
  roe?: number;
  assetTurnover?: number;
}

export function calculateLoan(
  loanAmount: number,
  interestRate: number,
  termMonths: number,
  commissionRate?: number,
  documentationFee: number = 0,
  addDocFeeToLoan: boolean = false,
  legalFee: number = 0
): LoanCalculation {
  const facilityFee = loanAmount * 0.035;
  const commissionAmount = commissionRate ? loanAmount * (commissionRate / 100) : 0;

  // Base capital for interest calculation
  const capitalForInterest = addDocFeeToLoan ? loanAmount + documentationFee : loanAmount;

  if (interestRate === 0) {
    const monthlyPayment = capitalForInterest / termMonths;
    return {
      monthlyPayment,
      totalInterest: 0,
      totalRepayment: capitalForInterest,
      facilityFee,
      commissionAmount,
      documentationFee,
      legalFee,
      totalCapitalBorrowed: capitalForInterest,
    };
  }

  const monthlyRate = interestRate / 100 / 12;
  const monthlyPayment =
    (capitalForInterest * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);

  const totalRepayment = monthlyPayment * termMonths;
  const totalInterest = totalRepayment - capitalForInterest;

  return {
    monthlyPayment,
    totalInterest,
    totalRepayment,
    facilityFee,
    commissionAmount,
    documentationFee,
    legalFee,
    totalCapitalBorrowed: capitalForInterest,
  };
}

export function calculateHirePurchase(
  assetPrice: number,
  deposit: number,
  interestRate: number,
  termMonths: number,
  commissionRate?: number
): HirePurchaseCalculation {
  const principal = assetPrice - deposit;
  const optionToPurchaseFee = 10; // Standard nominal fee
  const commissionAmount = commissionRate ? principal * (commissionRate / 100) : 0;

  if (interestRate === 0) {
    return {
      monthlyPayment: principal / termMonths,
      totalInterest: 0,
      totalRepayment: principal + optionToPurchaseFee,
      commissionAmount,
      optionToPurchaseFee,
    };
  }

  const monthlyRate = interestRate / 100 / 12;
  const monthlyPayment =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);

  const totalRepayment = (monthlyPayment * termMonths) + optionToPurchaseFee;
  const totalInterest = totalRepayment - principal;

  return {
    monthlyPayment,
    totalInterest,
    totalRepayment,
    commissionAmount,
    optionToPurchaseFee,
  };
}

export function calculateDSCR(
  annualNetOperatingIncome: number,
  annualDebtService: number,
  sensitivityRevenuePercent?: number
): DSCRCalculation {
  const dscr = annualNetOperatingIncome / annualDebtService;

  let status: "pass" | "warning" | "fail";
  if (dscr >= 1.5) {
    status = "pass";
  } else if (dscr >= 1.0) {
    status = "warning";
  } else {
    status = "fail";
  }

  if (sensitivityRevenuePercent !== undefined) {
    const adjustedIncome = annualNetOperatingIncome * (1 + sensitivityRevenuePercent / 100);
    const sensitivityDSCR = adjustedIncome / annualDebtService;

    let sensitivityStatus: "pass" | "warning" | "fail";
    if (sensitivityDSCR >= 1.5) {
      sensitivityStatus = "pass";
    } else if (sensitivityDSCR >= 1.0) {
      sensitivityStatus = "warning";
    } else {
      sensitivityStatus = "fail";
    }

    return { dscr, status, sensitivityDSCR, sensitivityStatus };
  }

  return { dscr, status };
}

export interface AffordabilityCalculation {
  ratio: number;
  status: "pass" | "fail";
  disposableIncome: number;
}

// ... existing code ...

export function calculateAffordability(
  annualRevenue: number,
  annualEbitda: number,
  monthlyLoanPayment: number,
  existingMonthlyDebt: number
): AffordabilityCalculation {
  const annualDebtService = (monthlyLoanPayment + existingMonthlyDebt) * 12;

  // Affordability Ratio based on EBITDA / Total Debt Service
  const ratio = annualDebtService > 0 ? annualEbitda / annualDebtService : 0;

  // Pass if EBITDA covers debt service by at least 1.25x
  const status = ratio >= 1.25 ? "pass" : "fail";

  // Surplus cash flow
  const disposableIncome = annualEbitda - annualDebtService;

  return { ratio, status, disposableIncome };
}

export function calculateFinancialRatios(data: {
  revenue?: number;
  costs?: number;
  currentAssets?: number;
  currentLiabilities?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  equity?: number;
}): FinancialRatios {
  const ratios: FinancialRatios = {};

  if (data.currentAssets && data.currentLiabilities && data.currentLiabilities > 0) {
    ratios.currentRatio = data.currentAssets / data.currentLiabilities;
  }

  if (data.totalLiabilities && data.equity && data.equity > 0) {
    ratios.debtToEquity = data.totalLiabilities / data.equity;
  }

  if (data.revenue && data.costs && data.revenue > 0) {
    const profit = data.revenue - data.costs;
    ratios.profitMargin = (profit / data.revenue) * 100;
  }

  if (data.revenue && data.costs && data.equity && data.equity > 0) {
    const profit = data.revenue - data.costs;
    ratios.roe = (profit / data.equity) * 100;
  }

  if (data.revenue && data.totalAssets && data.totalAssets > 0) {
    ratios.assetTurnover = data.revenue / data.totalAssets;
  }

  return ratios;
}

export function calculateCharacterScore(ratings: {
  managementExperience?: number;
  creditHistory?: number;
  bankConduct?: number;
  contracts?: number;
}): { score: number; maxScore: number; percentage: number; recommendation: string } {
  const validRatings = Object.values(ratings).filter((r) => r !== undefined) as number[];
  const score = validRatings.reduce((sum, r) => sum + r, 0);
  const maxScore = validRatings.length * 5;
  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;

  let recommendation: string;
  if (percentage >= 80) {
    recommendation = "Strong candidate - Recommend approval";
  } else if (percentage >= 60) {
    recommendation = "Good candidate - Approve with standard conditions";
  } else if (percentage >= 40) {
    recommendation = "Marginal - Additional due diligence required";
  } else {
    recommendation = "Weak candidate - Not recommended";
  }

  return { score, maxScore, percentage, recommendation };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatRatio(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}
