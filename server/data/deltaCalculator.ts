/**
 * Delta-First Calculator Logic (2026 UK Market)
 * 
 * Calculates the "Hidden Cost of Waiting" and "Found Money"
 */

export interface DeltaInputs {
    principal: number;       // "Roughly, what is the total balance?"
    currentMonthly: number;  // "What is your combined monthly repayment?"
    currentRate: number;     // "Are those around 12-15% or higher?"
}

export interface DeltaOutput {
    refinanceMonthly: number;
    monthlySaving: number;
    annualSaving: number;
    rateReduction: number;
    valuationImpact: {
        low: number; // 5x EBITDA
        high: number; // 7x EBITDA
    };
    dscrImpact: {
        currentDSCR: string; // "Likely < 1.0x"
        projectedDSCR: string; // "Target > 1.25x"
    };
    closingLine: string;
}

export const deltaCalculator = {
    // 2026 Base Rate Context
    baseRate: 3.75,
    targetRefinanceRate: 8.5, // 2026 Structured 5-Year Rate
    targetTermMonths: 60,

    /**
     * Calculate the Delta (Savings & Value)
     */
    calculate(inputs: DeltaInputs): DeltaOutput {
        // 1. Calculate New Monthly Payment (Amortized 5-year)
        const monthlyRate = deltaCalculator.targetRefinanceRate / 100 / 12;
        const termMonths = deltaCalculator.targetTermMonths;

        const refinanceMonthly =
            (inputs.principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
            (Math.pow(1 + monthlyRate, termMonths) - 1);

        // 2. Calculate Savings
        const monthlySaving = inputs.currentMonthly - refinanceMonthly;
        const annualSaving = monthlySaving * 12;
        const rateReduction = inputs.currentRate - deltaCalculator.targetRefinanceRate;

        // 3. Calculate Valuation Impact (EBITDA Multiplier)
        const valuationImpact = {
            low: annualSaving * 5,
            high: annualSaving * 7,
        };

        // 4. DSCR Narrative
        // Assumption: High interest compresses DSCR
        const dscrImpact = {
            currentDSCR: "Likely Suppressed (< 1.0x)",
            projectedDSCR: "Bankable (> 1.25x)",
        };

        // 5. Generate Closing Line
        const closingLine = `By switching to a 60-month facility, we drop your monthly commitment by £${Math.round(monthlySaving).toLocaleString()}. That isn't just a saving; that is the salary of two senior staff members or the deposit on a new piece of machinery. Why are you gifting that money to your current lender every month?`;

        return {
            refinanceMonthly: Math.round(refinanceMonthly),
            monthlySaving: Math.round(monthlySaving),
            annualSaving: Math.round(annualSaving),
            rateReduction: Math.round(rateReduction * 10) / 10,
            valuationImpact,
            dscrImpact,
            closingLine,
        };
    },

    /**
     * The "3-Question Delta" Script Template
     */
    script: {
        setup: "I don't want to waste your time with a long application. I have a calculator here tuned for the 2026 BoE rates. If you give me three numbers, I can tell you exactly how much cash is 'trapped' in your current debt stack.",
        question1: "Roughly, what is the total balance of your outstanding short-term loans or merchant advances right now?",
        question2: "What is your combined monthly repayment for those facilities?",
        question3: "And are those generally around the 12% to 15% mark, or higher like a Merchant Cash Advance?",
        closer: (monthlySaving: number) => `By switching to a 60-month facility, we drop your monthly commitment by £${monthlySaving.toLocaleString()}. That isn't just a saving; that is the salary of two senior staff members or the deposit on a new piece of machinery. Why are you gifting that money to your current lender every month?`
    },

    /**
     * DSCR Argument for CFO/Accountants
     */
    dscrArgument: `In 2026, lenders are looking for a DSCR of 1.25x or higher. Your current high-interest payments are likely suppressing your DSCR toward 1.0x or lower, which makes you 'unbankable' for future growth. By refinancing into a 5-year term, we lower your annual debt service, which instantly improves your credit score and makes you eligible for cheaper Tier-1 bank capital in 2027.`,

    /**
     * 2026 Hidden Reality Arguments
     */
    hiddenReality: {
        maturityTrap: "Many 2024-era loans have 'balloon payments' coming due this year.",
        rateHedge: "With inflation still slightly above target at 3.4% (as of Feb 2026), locking in a fixed rate now protects you if the Bank of England has to hike rates agian due to wage pressure."
    }
};
