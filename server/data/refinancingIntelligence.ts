/**
 * 2026 Refinancing Market Intelligence
 * Data and calculations for the Capital Strategist Agent
 */

export const MARKET_CONTEXT_2026 = {
    macro: {
        baseRate: 3.75, // Bank of England Base Rate (Feb 2026)
        inflation: 3.4, // CPI
        insolvencyRate: "Highest in a decade (approx. 24,000 corporate insolvencies in 2025)",
        maturityWall: "£150bn in mid-market debt maturing 2025-2027"
    },
    benchmarks: {
        tier1Bank: { min: 6.5, max: 7.5 },
        tier2Challenger: { min: 7.8, max: 9.5 },
        assetFinance: { min: 5.0, max: 10.0 },
        unsecuredLoan: { min: 11.0, max: 15.0 },
        merchantCashAdvance: { min: 25.0, max: 50.0 } // Effective APR
    },
    fees: {
        standardArrangement: 0.02, // 2%
        brokerFee: 0.015, // 1.5%
        legalCosts: 2500 // Estimated £2.5k
    }
};

export const SECTOR_PAIN_POINTS = {
    "Hospitality": {
        pain: "Highest 'Covid Debt' carryover; 79% still paying off pandemic facilities.",
        angle: "Move 'bounce-back' style debt into a 5-year consolidated growth loan."
    },
    "Construction": {
        pain: "Grappling with fixed-price contracts and 15% insolvency share.",
        angle: "Asset-backed refinancing to unlock capital tied up in plant/machinery."
    },
    "Retail": {
        pain: "Transitioning to online-only models; high rent/overhead pressure.",
        angle: "Consolidating merchant cash advances (MCAs) into a single monthly payment."
    },
    "Manufacturing": {
        pain: "Hit by tariff uncertainties and high energy costs.",
        angle: "5-year fixed-rate facilities to provide 'budget certainty' against utility spikes."
    }
};

/**
 * Calculates the Debt Service Coverage Ratio (DSCR)
 * @param annualEBITDA Earnings Before Interest, Taxes, Depreciation, Amortization
 * @param annualDebtService Total annual principal + interest payments
 */
export function calculateDSCR(annualEBITDA: number, annualDebtService: number): number {
    if (annualDebtService === 0) return 0;
    return Number((annualEBITDA / annualDebtService).toFixed(2));
}

/**
 * Estimates the increase in enterprise valuation based on monthly savings
 * Valuation = EBITDA * Multiple. Savings directly increase EBITDA.
 * @param monthlySavings Amount saved per month
 * @param multiple Typical EBITDA multiple (default 5x)
 */
export function calculateValuationImpact(monthlySavings: number, multiple: number = 5): number {
    const annualIncrease = monthlySavings * 12;
    return annualIncrease * multiple;
}

/**
 * Calculates the monthly payment for a loan
 * @param principal Loan amount
 * @param annualRate Annual interest rate (percentage, e.g., 8.5)
 * @param termMonths Loan term in months
 */
export function calculateMonthlyPayment(principal: number, annualRate: number, termMonths: number): number {
    if (annualRate === 0) return principal / termMonths;

    const monthlyRate = (annualRate / 100) / 12;
    const payment = (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);

    return Number(payment.toFixed(2));
}

/**
 * Generates a comparison between current high-cost debt and a refinancing options
 */
export function identifyOpportunity(
    currentDebt: { principal: number; monthlyPayment: number },
    refinanceRate: number = 8.5, // Conservative 2026 estimate
    termMonths: number = 60
) {
    const newMonthlyPayment = calculateMonthlyPayment(currentDebt.principal, refinanceRate, termMonths);
    const monthlySavings = currentDebt.monthlyPayment - newMonthlyPayment;
    const annualSavings = monthlySavings * 12;
    const valuationBoost = calculateValuationImpact(monthlySavings);

    // Estimate current implicit rate (iterative approximation or simplification)
    // roughly: (Monthly * 12) / Principal - (1/Term) ... for short term it's high. 
    // We'll just return the delta.

    return {
        newMonthlyPayment,
        monthlySavings,
        annualSavings,
        fiveYearSavings: annualSavings * 5,
        valuationBoost,
        isViable: monthlySavings > 0
    };
}
