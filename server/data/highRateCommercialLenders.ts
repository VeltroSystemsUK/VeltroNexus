/**
 * High-Rate Commercial Lenders Blacklist
 * Used to identify expensive debt in Companies House charge data
 * UK Market - February 2026
 */

export interface HighRateLender {
    name: string;
    category: 'alternative' | 'mca' | 'bridging';
    typicalAPR: string;
    displacementAngle: string;
    aliases?: string[]; // Common variations in Companies House
}

export const HIGH_RATE_LENDERS: HighRateLender[] = [
    // --- Merchant Cash Advance (MCA) / Revenue-Based ---
    {
        name: "Iwoca",
        category: "mca",
        typicalAPR: "20-50%",
        displacementAngle: "You're paying for speed you no longer need. Let's swap this for 8%.",
        aliases: ["IWOCA LIMITED", "IWOCA"]
    },
    {
        name: "YouLend",
        category: "mca",
        typicalAPR: "30-50%",
        displacementAngle: "The daily 'skim' on your revenue is killing your ability to hire/stock.",
        aliases: ["YOULEND", "YOU LEND"]
    },
    {
        name: "Liberis",
        category: "mca",
        typicalAPR: "25-40%",
        displacementAngle: "Your daily repayments are eating into operating cash. Let's fix that.",
        aliases: ["LIBERIS"]
    },
    {
        name: "365 Business Finance",
        category: "mca",
        typicalAPR: "30-45%",
        displacementAngle: "Daily revenue skimming is unsustainable for growth. Move to monthly terms.",
        aliases: ["365 BUSINESS", "365 FINANCE"]
    },
    {
        name: "Revenu",
        category: "mca",
        typicalAPR: "25-40%",
        displacementAngle: "Revenue-based funding was the bridge. Now you need the permanent solution.",
        aliases: ["REVENU"]
    },
    {
        name: "Uncapped",
        category: "mca",
        typicalAPR: "20-35%",
        displacementAngle: "Your 'uncapped' growth is capped by this rate. Let's unlock it.",
        aliases: ["UNCAPPED"]
    },
    {
        name: "Wayflyer",
        category: "mca",
        typicalAPR: "25-40%",
        displacementAngle: "Great for launch, but you've outgrown merchant cash. Time for real terms.",
        aliases: ["WAYFLYER"]
    },
    {
        name: "PayPal Working Capital",
        category: "mca",
        typicalAPR: "20-35%",
        displacementAngle: "PayPal's convenience comes at a cost. Bank-grade rates are half this.",
        aliases: ["PAYPAL", "PAYPAL WORKING CAPITAL"]
    },
    {
        name: "Stripe Capital",
        category: "mca",
        typicalAPR: "15-30%",
        displacementAngle: "Stripe integration is convenient, but you're paying 2x market rate for it.",
        aliases: ["STRIPE", "STRIPE CAPITAL"]
    },

    // --- Alternative Unsecured / Fast Capital ---
    {
        name: "Capify",
        category: "alternative",
        typicalAPR: "20-45%",
        displacementAngle: "Short-term speed is costing you long-term growth. Let's restructure.",
        aliases: ["CAPIFY"]
    },
    {
        name: "Fleximize",
        category: "alternative",
        typicalAPR: "15-25%",
        displacementAngle: "You've proven your business now. Time for Tier 1 rates, not marketplace premiums.",
        aliases: ["FLEXIMIZE"]
    },
    {
        name: "Nucleus Commercial Finance",
        category: "alternative",
        typicalAPR: "8.5-15%",
        displacementAngle: "Arrangement fees are eating your margin. Let's get you a cleaner structure.",
        aliases: ["NUCLEUS", "NUCLEUS COMMERCIAL"]
    },
    {
        name: "Momenta Finance",
        category: "alternative",
        typicalAPR: "10-15%",
        displacementAngle: "SONIA + 7.5% was the emergency rate. In 2026, you qualify for SONIA + 3%.",
        aliases: ["MOMENTA"]
    },
    {
        name: "Love Finance",
        category: "alternative",
        typicalAPR: "12-18%",
        displacementAngle: "Time to trade 'fast approval' for 'sustainable terms'.",
        aliases: ["LOVE FINANCE"]
    },
    {
        name: "Funding Circle",
        category: "alternative",
        typicalAPR: "10-15%",
        displacementAngle: "You're an established firm now. You've outgrown 'marketplace' rates.",
        aliases: ["FUNDING CIRCLE"]
    },
    {
        name: "Boost Capital",
        category: "alternative",
        typicalAPR: "15-22%",
        displacementAngle: "Your 'boost' is now a burden. Let's refinance to something predictable.",
        aliases: ["BOOST", "BOOST CAPITAL"]
    },

    // --- Bridging & Specialist Property (High-Exit Risk) ---
    {
        name: "Together Commercial",
        category: "bridging",
        typicalAPR: "10-15% monthly 0.75-1.5%",
        displacementAngle: "Your bridge is expiring. If you don't exit now, the default rates are 3% per month.",
        aliases: ["TOGETHER", "TOGETHER COMMERCIAL", "TOGETHER PERSONAL"]
    },
    {
        name: "Market Financial Solutions",
        category: "bridging",
        typicalAPR: "9-15% annually",
        displacementAngle: "MFS is a sprint, not a marathon. Let's get you into a 5-year commercial mortgage.",
        aliases: ["MFS", "MARKET FINANCIAL"]
    },
    {
        name: "Glenhawk",
        category: "bridging",
        typicalAPR: "0.75-1.5% monthly",
        displacementAngle: "Glenhawk served its purpose. Now you need an exit before penalties kick in.",
        aliases: ["GLENHAWK"]
    },
    {
        name: "Roma Finance",
        category: "bridging",
        typicalAPR: "0.85-1.25% monthly",
        displacementAngle: "Bridge rates compound fast. Let's lock in a fixed 5-year commercial term.",
        aliases: ["ROMA", "ROMA FINANCE"]
    },
    {
        name: "Octane Capital",
        category: "bridging",
        typicalAPR: "0.75-1.5% monthly",
        displacementAngle: "Your development is complete. Time to exit to long-term financing.",
        aliases: ["OCTANE"]
    },
    {
        name: "LendInvest",
        category: "bridging",
        typicalAPR: "0.6-1.2% monthly",
        displacementAngle: "LendInvest was phase 1. Phase 2 is a sustainable commercial mortgage.",
        aliases: ["LENDINVEST", "LEND INVEST"]
    },
    {
        name: "West One Loans",
        category: "bridging",
        typicalAPR: "0.75-1.25% monthly",
        displacementAngle: "Your 12-month window is closing. Let's secure a 5-year exit now.",
        aliases: ["WEST ONE"]
    },
    {
        name: "United Trust Bank",
        category: "bridging",
        typicalAPR: "0.6-1.0% monthly",
        displacementAngle: "UTB is great for bridges, but you're past the temporary phase now.",
        aliases: ["UTB", "UNITED TRUST"]
    },
    {
        name: "Precise Mortgages",
        category: "bridging",
        typicalAPR: "0.7-1.3% monthly",
        displacementAngle: "Precise bridging needs a precise exit. Let's execute before rollover penalties.",
        aliases: ["PRECISE"]
    }
];

function tokens(value: string): string {
    return value.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

function nameMatches(chargeName: string, needle: string): boolean {
    const hay = tokens(chargeName);
    const pin = tokens(needle);
    if (!hay || !pin) return false;
    if (pin.length <= 3) {
        return new RegExp(`(?:^| )${pin}(?: |$)`).test(hay);
    }
    return hay.includes(pin);
}

// Utility function to check if a lender name matches the blacklist
export function isHighRateLender(lenderName: string): HighRateLender | null {
    if (!lenderName) return null;

    for (const lender of HIGH_RATE_LENDERS) {
        if (nameMatches(lenderName, lender.name)) {
            return lender;
        }
        if (lender.aliases) {
            for (const alias of lender.aliases) {
                if (nameMatches(lenderName, alias)) {
                    return lender;
                }
            }
        }
    }

    return null;
}

// Get all lender names for scraping/matching
export function getAllLenderNames(): string[] {
    const names: string[] = [];

    for (const lender of HIGH_RATE_LENDERS) {
        names.push(lender.name.toUpperCase());
        if (lender.aliases) {
            names.push(...lender.aliases);
        }
    }

    return names;
}
