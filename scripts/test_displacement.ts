import { capitalStrategist } from "../server/services/capitalStrategistService";

/**
 * Test Capital Strategist Lender Displacement & Counter-Matrix
 */

async function testDisplacement() {
    console.log("=== Testing Capital Strategist Lender Displacement ===\n");

    const testProspects = [
        {
            name: "Sarah Jenkins",
            company: "Nexus Logistics Ltd",
            sector: "Logistics",
            identifiedLender: "iwoca",
            chargeDate: "March 2024",
            turnover: "£2.5M"
        },
        {
            name: "David Miller",
            company: "Miller Retail Group",
            sector: "Retail",
            identifiedLender: "YouLend",
            chargeDate: "Jan 2025",
            turnover: "£1.2M"
        }
    ];

    console.log("1. Generating Displacement Emails\n");
    for (const p of testProspects) {
        console.log(`Prospect: ${p.company} (Lender: ${p.identifiedLender})`);
        const email = await capitalStrategist.generateOutreachEmail(p);
        console.log(`Subject: ${email.subject}`);
        console.log(`Body Snippet: ${email.body.substring(0, 150)}...\n`);
        console.log("-".repeat(40));
    }

    console.log("\n2. Testing Rejection Counter-Matrix\n");
    const objections = [
        "I don't have time to dig out bank statements right now.",
        "We've been with our current lender for 5 years, I'm happy.",
        "Call me back in 6 months when interest rates go down.",
        "I'm not doing anything with a personal guarantee."
    ];

    for (const obj of objections) {
        console.log(`Objection: "${obj}"`);
        const counter = capitalStrategist.handleObjection(obj);
        console.log(`Counter: ${counter}\n`);
    }

    console.log("=== Test Complete ===");
}

testDisplacement().catch(console.error);
