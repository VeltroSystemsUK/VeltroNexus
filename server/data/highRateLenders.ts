/**
 * High-Rate Lender Blacklist (2026 UK Market)
 * 
 * Identifies companies using expensive debt that need refinancing
 */

export interface LenderProfile {
    name: string;
    category: "alternative-sme" | "mca-revenue" | "bridging-property" | "marketplace";
    typicalAPR: [number, number]; // [min, max]
    painPoint: string;
    refinancingPitch: string;
    priority: "high" | "medium";
    searchPatterns: string[]; // For matching in Companies House charges
}

// High-Rate Lender Database
export const highRateLenders: Record<string, LenderProfile> = {
    // Alternative SME Lenders
    iwoca: {
        name: "iwoca",
        category: "alternative-sme",
        typicalAPR: [20, 49],
        painPoint: "Flexi-Loans at 49% APR with 2% monthly rates",
        refinancingPitch: "You're paying for speed you no longer need. Let's swap this for 8%.",
        priority: "high",
        searchPatterns: ["iwoca", "IWOCA"],
    },
    fleximize: {
        name: "Fleximize",
        category: "alternative-sme",
        typicalAPR: [15, 25],
        painPoint: "Speed-focused lending at up to 25% APR",
        refinancingPitch: "You got the speed you needed. Now get the rate you deserve.",
        priority: "high",
        searchPatterns: ["fleximize", "Fleximize"],
    },
    nucleus: {
        name: "Nucleus Commercial Finance",
        category: "alternative-sme",
        typicalAPR: [8.5, 15],
        painPoint: "8.5-15% plus 5% arrangement fees on large unsecured",
        refinancingPitch: "Those arrangement fees alone could fund 2 years of interest savings.",
        priority: "high",
        searchPatterns: ["nucleus", "Nucleus Commercial"],
    },
    capify: {
        name: "Capify",
        category: "alternative-sme",
        typicalAPR: [20, 40],
        painPoint: "Short-term 3-12 month capital based on turnover",
        refinancingPitch: "Revenue-linked repayments sound flexible, but you're bleeding margin.",
        priority: "high",
        searchPatterns: ["capify", "Capify"],
    },
    momenta: {
        name: "Momenta Finance",
        category: "alternative-sme",
        typicalAPR: [10, 15],
        painPoint: "SONIA + 7.5% margin = double-digit rates",
        refinancingPitch: "Why pay SONIA+7.5% when you can lock in fixed 6.5%?",
        priority: "medium",
        searchPatterns: ["momenta", "Momenta Finance"],
    },

    // Merchant Cash Advance / Revenue-Based
    youlend: {
        name: "YouLend",
        category: "mca-revenue",
        typicalAPR: [30, 50],
        painPoint: "Daily skim on revenue via payment processors",
        refinancingPitch: "The daily 'skim' on your revenue is killing your ability to hire/stock.",
        priority: "high",
        searchPatterns: ["youlend", "YouLend", "YOU LEND"],
    },
    liberis: {
        name: "Liberis",
        category: "mca-revenue",
        typicalAPR: [30, 50],
        painPoint: "Percentage of daily takings (factor rate 1.2x+)",
        refinancingPitch: "Buy back your cash flow. Stop giving away 20% of every sale.",
        priority: "high",
        searchPatterns: ["liberis", "Liberis"],
    },
    "365finance": {
        name: "365 Business Finance",
        category: "mca-revenue",
        typicalAPR: [25, 45],
        painPoint: "Hospitality/retail focus with high effective rates",
        refinancingPitch: "Your business survived—now let it thrive without the daily drain.",
        priority: "high",
        searchPatterns: ["365 Business", "365 Finance"],
    },

    // Bridging & Property Lenders
    togetherMoney: {
        name: "Together Money",
        category: "bridging-property",
        typicalAPR: [10, 15],
        painPoint: "Tier 3 commercial property at 10-15%",
        refinancingPitch: "Tier 3 rates for a Tier 1 business. Let's fix that.",
        priority: "high",
        searchPatterns: ["together", "Together Money", "Together Commercial"],
    },
    mfs: {
        name: "Market Financial Solutions",
        category: "bridging-property",
        typicalAPR: [9, 15],
        painPoint: "0.75-1.25% monthly bridging (9-15% annual)",
        refinancingPitch: "Your bridge is expiring. If you don't exit now, default rates are 3% monthly.",
        priority: "high",
        searchPatterns: ["market financial", "MFS", "Market Financial Solutions"],
    },
    glenhawk: {
        name: "Glenhawk",
        category: "bridging-property",
        typicalAPR: [9, 15],
        painPoint: "Specialist refurb/complex property bridging",
        refinancingPitch: "The refurb is done. Time to exit the bridge.",
        priority: "medium",
        searchPatterns: ["glenhawk", "Glenhawk"],
    },
    roma: {
        name: "Roma Finance",
        category: "bridging-property",
        typicalAPR: [9, 15],
        painPoint: "Short-term property finance needing exit",
        refinancingPitch: "12-month bridges become 36-month anchors. Let's get you out.",
        priority: "medium",
        searchPatterns: ["roma finance", "Roma Finance"],
    },
    octopus: {
        name: "Octopus Real Estate",
        category: "bridging-property",
        typicalAPR: [8, 12],
        painPoint: "Large-scale bridging needing 2026 exit",
        refinancingPitch: "You need a clear exit strategy before Q4 2026.",
        priority: "medium",
        searchPatterns: ["octopus real estate", "Octopus RE"],
    },

    // Marketplace Lenders
    fundingCircle: {
        name: "Funding Circle",
        category: "marketplace",
        typicalAPR: [10, 15],
        painPoint: "Marketplace rates for established firms",
        refinancingPitch: "You're an established firm now. You've outgrown 'marketplace' rates.",
        priority: "medium",
        searchPatterns: ["funding circle", "Funding Circle"],
    },
};

// Quick lookup by search pattern
export function identifyLender(chargeHolderName: string): LenderProfile | null {
    const lowerName = chargeHolderName.toLowerCase();

    for (const lender of Object.values(highRateLenders)) {
        const match = lender.searchPatterns.some(pattern =>
            lowerName.includes(pattern.toLowerCase())
        );

        if (match) {
            return lender;
        }
    }

    return null;
}

// Lead Scoring Weights (2026 Specific)
export const leadScoringWeights = {
    chargeFromNonHighStreet: 30, // Likely paying 10%+ interest
    chargeOlderThan18Months: 20, // Nearing maturity/balloon payment
    creditorsIncreased: 20,       // Debt stacking
    positiveAssetsLowCash: 30,    // Perfect lead: assets but no liquidity
};

// Crisis Ratio Threshold
export const CRISIS_RATIO_THRESHOLD = 3.0; // Creditors / Cash > 3.0 = high priority

// Target SIC Codes by Sector
export const targetSICCodes = {
    manufacturing: [
        25011, 25120, 25210, // Fabricated metal products
        26110, 26200, 26300, // Electronics & electrical
        27110, 27200, 27900, // Electrical equipment
        28110, 28120, 28130, // Machinery
    ],
    construction: [
        41100, 41201, 41202, // Building construction
        42110, 42120, 42130, // Civil engineering
        43110, 43120, 43130, // Demolition & site prep
        43210, 43220, 43290, // Electrical, plumbing, other
    ],
    hospitality: [
        55100, 55201, 55202, // Hotels & accommodation
        55300, 55900,         // Camping & other
        56101, 56102, 56103, // Restaurants
        56210, 56290, 56301, // Catering & pubs
    ],
    retail: [
        47110, 47190, 47210, // Non-specialized & food stores
        47410, 47420, 47430, // Computers, telecom, audio/video
        47510, 47520, 47530, // Textiles, clothing, footwear
        47710, 47720, 47730, // Other retail
    ],
    logistics: [
        49410, 49420,        // Freight transport
        52101, 52102, 52103, // Warehousing & storage
        52210, 52220, 52240, // Service activities
    ],
};

// Get all target SIC codes
export function getAllTargetSICCodes(): number[] {
    return Object.values(targetSICCodes).flat();
}

// Get sector from SIC code
export function getSectorFromSIC(sicCode: number): string | null {
    for (const [sector, codes] of Object.entries(targetSICCodes)) {
        if (codes.includes(sicCode)) {
            return sector;
        }
    }
    return null;
}
