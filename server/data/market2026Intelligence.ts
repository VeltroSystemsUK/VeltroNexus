/**
 * 2026 UK Market Intelligence for Capital Strategist
 */

export const market2026Intelligence = {
    // Macro-Economic Landscape
    macroEconomic: {
        economicPhase: "Stabilization Phase following 2023-2025 volatility",
        baseRate: 3.75,
        baseRateContext: "Down from 5.25% peak (2024), but 3x higher than 0.1-0.75% growth era",
        maturityWall: "£150 billion in mid-market debt maturing 2025-2027",
        insolvencies2025: 24000,
        insolvencyCause: "Debt serviceability, not lack of sales",
        keyPressures: [
            "High short-term interest rates",
            "Rising National Insurance costs",
            "Wage cost inflation",
            "12-month extension 'kicking the can' strategies expiring",
        ],
    },

    // Sector Pain Points & Refinancing Angles
    sectorPainPoints: {
        hospitality: {
            pain: "79% still haven't paid off pandemic facilities (highest Covid debt carryover)",
            refinancingAngle: "Consolidate bounce-back loans into 5-year growth facility",
            priority: "High",
            insolvencyRate: "High",
            messaging: "The hospitality sector is carrying the heaviest pandemic debt burden—79% still haven't cleared bounce-back facilities. Those 12-month extensions are running out, and renewal rates have jumped 4-6%. A 5-year consolidation now locks in certainty before the next wave of rate adjustments.",
        },
        construction: {
            pain: "15% insolvency share, fixed-price contracts under pressure",
            refinancingAngle: "Asset-backed refinancing to unlock plant/machinery equity",
            priority: "High",
            insolvencyRate: "15% of all UK insolvencies",
            messaging: "Construction represents 15% of all UK insolvencies in 2026—not because of lack of work, but because of capital tied up in plant and machinery while servicing high-interest short-term debt. Asset-backed refinancing lets you unlock that equity at 6-8% instead of 12-15% unsecured rates.",
        },
        retail: {
            pain: "Online transition, high rent/overhead, merchant cash advance traps",
            refinancingAngle: "Consolidate MCAs into single monthly payment at 70% lower APR",
            priority: "Medium-High",
            insolvencyRate: "Medium",
            messaging: "Many retailers got caught in the Merchant Cash Advance trap during the online transition. If you're paying 25-40% effective APR with daily repayments, you're bleeding margin. A 5-year facility at 8.5% APR saves you nearly 70% in interest costs annually—that's working capital you can reinvest in digital marketing or inventory.",
        },
        manufacturing: {
            pain: "Tariff uncertainties, 15%+ energy cost increases",
            refinancingAngle: "5-year fixed-rate for budget certainty against utility spikes",
            priority: "High",
            insolvencyRate: "Medium-High",
            messaging: "Manufacturing is facing the double squeeze of tariff uncertainty and energy costs up 15%+. The key isn't just cheaper debt—it's budget certainty. A 5-year fixed-rate facility means you can quote on contracts 18 months out without wondering if your cost base will spike.",
        },
    },

    // Debt Benchmarks (Kill Chart)
    debtBenchmarks: {
        merchantCashAdvances: {
            typicalAPR: [25, 40],
            refinanceAPR: 8.5,
            savingsPercentage: 70,
            pitch: "You're paying daily for a facility that's eating margins. 5-year refi at 8.5% saves 70% in annual interest.",
        },
        unsecuredShortTerm: {
            typicalAPR: [11, 15],
            refinanceAPR: [6, 8],
            savingsPercentage: 45,
            pitch: "Why pay unsecured rates when you have unencumbered assets?",
        },
        assetBacked: {
            currentAPR: [10, 12],
            refinanceAPR: [5, 7],
            savingsPercentage: 40,
            pitch: "Your vehicles/property/equipment can secure 6% debt vs 15% unsecured.",
        },
        logicGap: "Many businesses using 15% unsecured debt while sitting on assets that could secure 6% debt",
    },

    // Hidden Benefits (Beyond Interest)
    hiddenBenefits: {
        ebitdaMultiplier: {
            title: "The EBITDA Multiplier",
            calculation: "Every £1,000/month saved = £50k-£70k added business valuation",
            multiplier: [5, 7],
            pitch: "I'm not just saving you interest; I'm increasing your company's exit value by £{calculated}.",
        },
        lenderFatigue: {
            title: "Cure 'Lender Fatigue'",
            problem: "Multiple loans = messy credit file = no bank wants to add more capital",
            solution: "Consolidation into one 5-year facility",
            pitch: "Consolidating into one 5-year facility cleans your balance sheet, making you 'bankable' again for R&D grants and expansion capital.",
        },
        taxShielding: {
            title: "Tax-Efficient Growth Capital",
            benefit: "Interest remains tax-deductible in 2026",
            pitch: "You're not just lowering rates; you're converting high-cost 'stress capital' into tax-efficient 'growth capital'.",
        },
    },

    // Trigger Statistics (Authority Builders)
    triggerStatistics: {
        approvalDisparity: "Only 44% of traditional bank loans succeed, but 96% of Asset Finance applications are approved",
        costOfWaiting: "Base rate may drop to 3.25% by late 2026, but lender spreads are widening 2%—waiting could cost you more",
        maturityCrisis: "£150bn debt wall 2025-2027 means refinancing competition will intensify",
        insolvencyDriver: "24,000 insolvencies in 2025—primary cause was debt serviceability, not revenue",
        covidDebtHospitality: "79% of hospitality sector still carrying pandemic debt",
        constructionInsolvency: "15% of all UK insolvencies are construction companies",
        lenderSpreads: "Lender spreads widening by 2% despite potential 0.5% base rate drop",
    },
};

/**
 * Get sector-specific messaging
 */
export function getSectorMessaging(sector: string): string {
    const lowerSector = sector.toLowerCase();

    if (lowerSector.includes("hospitality") || lowerSector.includes("restaurant") || lowerSector.includes("hotel")) {
        return market2026Intelligence.sectorPainPoints.hospitality.messaging;
    }

    if (lowerSector.includes("construction") || lowerSector.includes("building") || lowerSector.includes("contractor")) {
        return market2026Intelligence.sectorPainPoints.construction.messaging;
    }

    if (lowerSector.includes("retail") || lowerSector.includes("ecommerce") || lowerSector.includes("shop")) {
        return market2026Intelligence.sectorPainPoints.retail.messaging;
    }

    if (lowerSector.includes("manufacturing") || lowerSector.includes("factory") || lowerSector.includes("production")) {
        return market2026Intelligence.sectorPainPoints.manufacturing.messaging;
    }

    return `With the UK base rate at 3.75% but still 3x higher than the growth era of 2020-2021, many businesses are stuck servicing debt that made sense at 0.5% but is crushing at current rates. A 5-year refinance isn't about lowering rates—it's about creating predictability in an uncertain macro environment.`;
}

/**
 * Calculate Total Cost of Capital comparison
 */
export function calculateTCC(
    currentRate: number,
    newRate: number,
    loanAmount: number,
    termYears: number = 5
): {
    currentTotalCost: number;
    newTotalCost: number;
    savings: number;
    savingsPercentage: number;
} {
    const monthlyRate1 = currentRate / 100 / 12;
    const monthlyRate2 = newRate / 100 / 12;
    const months = termYears * 12;

    const currentMonthly =
        (loanAmount * monthlyRate1 * Math.pow(1 + monthlyRate1, months)) /
        (Math.pow(1 + monthlyRate1, months) - 1);

    const newMonthly =
        (loanAmount * monthlyRate2 * Math.pow(1 + monthlyRate2, months)) /
        (Math.pow(1 + monthlyRate2, months) - 1);

    const currentTotalCost = (currentMonthly * months) - loanAmount;
    const newTotalCost = (newMonthly * months) - loanAmount;
    const savings = currentTotalCost - newTotalCost;
    const savingsPercentage = (savings / currentTotalCost) * 100;

    return {
        currentTotalCost: Math.round(currentTotalCost),
        newTotalCost: Math.round(newTotalCost),
        savings: Math.round(savings),
        savingsPercentage: Math.round(savingsPercentage * 10) / 10,
    };
}

/**
 * Calculate EBITDA valuation impact
 */
export function calculateEBITDAImpact(monthlySavings: number): {
    annualSavings: number;
    valuationImpactLow: number;
    valuationImpactHigh: number;
} {
    const annualSavings = monthlySavings * 12;
    const valuationImpactLow = annualSavings * 5; // 5x EBITDA
    const valuationImpactHigh = annualSavings * 7; // 7x EBITDA

    return {
        annualSavings,
        valuationImpactLow,
        valuationImpactHigh,
    };
}
