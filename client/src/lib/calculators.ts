export interface LoanCalculation {
  monthlyPayment: number;
  totalInterest: number;
  totalRepayment: number;
  facilityFee: number;
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
  termMonths: number
): LoanCalculation {
  const facilityFee = loanAmount * 0.035;

  if (interestRate === 0) {
    return {
      monthlyPayment: loanAmount / termMonths,
      totalInterest: 0,
      totalRepayment: loanAmount,
      facilityFee,
    };
  }

  const monthlyRate = interestRate / 100 / 12;
  const monthlyPayment =
    (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);

  const totalRepayment = monthlyPayment * termMonths;
  const totalInterest = totalRepayment - loanAmount;

  return {
    monthlyPayment,
    totalInterest,
    totalRepayment,
    facilityFee,
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

export function calculateAffordability(
  personalIncome: number,
  monthlyCommitments: number,
  loanPayment: number
): AffordabilityCalculation {
  const totalCommitments = monthlyCommitments + loanPayment;
  const ratio = personalIncome / totalCommitments;
  const status = ratio >= 1.25 ? "pass" : "fail";
  const disposableIncome = personalIncome - totalCommitments;

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
