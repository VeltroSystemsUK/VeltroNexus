import { LenderProfile } from "./highRateLenders";

/**
 * Capital Strategist Conversation Scripts & Frameworks
 */

// 1. Lender Displacement Script (Negative Cost Framework)
export const lenderDisplacementScript = {
    phases: {
        phase1_Disruption: {
            name: "The 'I Know You' Hook",
            template: `Hi [Name], I'm calling/emailing because I was reviewing [Company Name]'s recent filings on Companies House. I noticed the active charge you have with [Lender Name] from [Date].

Most directors I speak with took those facilities for speed, but in the current 2026 rate environment, those short-term 'bridge' rates are now costing you about 3x what a structured 5-year facility would. Have you looked at the exit cost of that charge recently?`,
        },
        phase2_EBITDADrain: {
            name: "The EBITDA Drain",
            template: `Right now, that facility is likely 'skimming' your daily cash flow. If we move that into a 60-month refinancing package, we aren't just lowering the interest rate from [Current Rate]% to around [New Rate]%.

We are actually increasing your paper profitability. Every £2,000 we save you in monthly interest adds roughly £120,000 to your business's valuation if you were to exit in the next few years. Does your current lender provide that kind of balance sheet scaling?`,
        },
        phase3_ObjectionHandling: {
            name: "Handling 'I'm Happy with Them'",
            template: `I understand. They were there when you needed the capital quickly. But there's a difference between 'Working Capital' and 'Anchor Capital.'

[Lender Name] is a high-speed tool, but it's designed to be temporary. Keeping it for 2+ years is like using a rental car for a 5-year commute—it's technically possible, but it's financially ruinous. We specialize in the 'Commuter' model—stable, long-term, and predictable.`,
        },
        phase4_LowFrictionClose: {
            name: "The Low-Friction Close",
            template: `I've already run a preliminary delta on your last filed accounts. I can show you exactly how much 'found money' is sitting in your debt stack within 5 minutes.

Would you prefer I send that comparison over email, or should we spend 10 minutes on Zoom on Thursday to look at the LTV on your assets?`,
        },
    },

    // "Kill List" Cheat Sheet - Attack Angles
    killListAttackAngles: {
        "YouLend": {
            keyword: "Revenue Skimming",
            angle: "They're taking a piece of every sale before you even pay your staff.",
        },
        "Liberis": {
            keyword: "Revenue Skimming",
            angle: "They're taking a piece of every sale before you even pay your staff.",
        },
        "iwoca": {
            keyword: "Compound Drag",
            angle: "The monthly roll-over is hiding the true annual cost of nearly 40%.",
        },
        "Fleximize": {
            keyword: "Compound Drag",
            angle: "The monthly roll-over is hiding the true annual cost of nearly 40%.",
        },
        "Together Money": {
            keyword: "Maturity Cliff",
            angle: "Your bridge is a ticking clock. Let's fix the rate for 5 years before it defaults.",
        },
        "Market Financial Solutions": {
            keyword: "Maturity Cliff",
            angle: "Your bridge is a ticking clock. Let's fix the rate for 5 years before it defaults.",
        },
        "Funding Circle": {
            keyword: "Platform Premium",
            angle: "You're paying a premium for a marketplace name. Let's get you 'Bank-Grade' rates.",
        },
    },
};

// 2. Rejection Counter-Matrix
export const rejectionCounterMatrix = {
    friction: {
        trigger: "I don't have time / don't want to provide bank statements",
        subtext: "I'm worried about the 'admin tax' of a long application process.",
        counter: `I completely get it—I'm not asking for a full box of files today. Because I've already audited your Companies House filings, I only need three specific data points to give you a 'Yes/No' on a 5-year fix. Most of our 2026 clients use Open Banking, which means the 'data pull' takes about 60 seconds. Would you rather spend 60 seconds on a link now, or keep overpaying £[Savings] every month?`,
    },
    defensive: {
        trigger: "I'm happy with my current bank/lender",
        subtext: "Loyalty (fear of switching hassle).",
        counter: `I'm glad they were there for you. But remember, the high-street banks and boutique lenders have very different risk appetites in 2026 than they did when you signed that deal. Being 'loyal' to a 14% interest rate isn't a business strategy; it's a donation. I'm not asking you to close your business bank account—I'm suggesting we swap out your most expensive debt for something that actually lets you breathe.`,
    },
    timing: {
        trigger: "Call me back in 6 months when rates drop",
        subtext: "I'm waiting for the Bank of England to do my work for me.",
        counter: `I hear that a lot. But here's the 2026 reality: While the base rate might tick down, Lender Margins are actually widening. Lenders are pricing in more risk now than they were last year. If you wait 6 months for a 0.5% base rate drop, you might find the arrangement fees have doubled or the LTV requirements have tightened. Securing a 5-year facility today is an insurance policy against the market moving the goalposts.`,
    },
    value: {
        trigger: "The fees (Arrangement/Legal) make it too expensive",
        subtext: "I'm looking at upfront cost instead of long-term gain.",
        counter: `It's a fair point. But let's look at the 'Cost of Inaction.' If the setup fee is £5,000, but the new package saves you £1,500 a month in interest, you've hit your 'break-even' point by month four. From month five through to month sixty, that's pure profit back into your cash flow. If I could show you an investment that pays for itself in 120 days and then yields 300% ROI, you'd take that deal every time, wouldn't you?`,
    },
    fear: {
        trigger: "I don't want a Personal Guarantee (PG)",
        subtext: "I'm scared of personal risk.",
        counter: `I hear you. In 2026, PG requirements are standard for unsecured debt, but because we are looking at a long-term structured refinance, we can often look at PG Insurance or 'capping' the guarantee to only a portion of the loan. Compare that to your current short-term debt, which likely has an 'unlimited' or 'hidden' PG in the fine print. Let's look at a structure that actually limits your personal exposure.`,
    },
};

// 3. Quick-Reference Pivot Table
export const pivotTable = [
    {
        trigger: "I'm too busy.",
        goal: "Lower the friction.",
        goldenSentence: "I've already done 80% of the work using your public filings. I just need 2 minutes to verify the last 20%.",
    },
    {
        trigger: "Our debt is fine.",
        goal: "Challenge the status quo.",
        goldenSentence: "Fine is expensive. In this market, 'fine' is usually costing businesses an extra 5% in margin they don't need to pay.",
    },
    {
        trigger: "We are debt-free.",
        goal: "Pivot to Asset Finance.",
        goldenSentence: "That's a great position. Most 'debt-free' firms I work with are now using Asset Refinancing to pull cash out of their equipment to fund R&D.",
    },
    {
        trigger: "I don't trust AI/Brokers.",
        goal: "Establish Peer Authority.",
        goldenSentence: "I'm not a broker; I'm a capital strategist. My job is to ensure your balance sheet is as efficient as your operations.",
    },
];

export function getAttackAngle(lenderName: string): { keyword: string; angle: string } | null {
    for (const [key, value] of Object.entries(lenderDisplacementScript.killListAttackAngles)) {
        if (lenderName.toLowerCase().includes(key.toLowerCase())) {
            return value;
        }
    }
    return null;
}

// 4. The "3-Question Delta" Calculator Script
export const deltaCalculatorScript = {
    intro: "I don't want to waste your time with a long application. I have a calculator here tuned for the 2026 BoE rates. If you give me three numbers, I can tell you exactly how much cash is 'trapped' in your current debt stack.",
    questions: [
        {
            id: "principal",
            text: "Roughly, what is the total balance of your outstanding short-term loans or merchant advances right now?",
            example: "e.g., £150,000"
        },
        {
            id: "monthly_payment",
            text: "What is your combined monthly repayment for those facilities?",
            example: "e.g., £9,500/mo"
        },
        {
            id: "estimated_rate",
            text: "And are those generally around the 12% to 15% mark, or higher like a Merchant Cash Advance?",
            example: "e.g., 15%"
        }
    ],
    reveal: {
        template: `By switching to a 60-month facility, we drop your monthly commitment by £[MonthlySavings]. That isn't just a saving; that is the salary of two senior staff members or the deposit on a new piece of machinery. Why are you gifting that money to your current lender every month?`
    }
};
