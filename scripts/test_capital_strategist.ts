import { capitalStrategist } from "../server/services/capitalStrategistService";

/**
 * Test The Capital Strategist Agent
 */

async function testCapitalStrategist() {
    console.log("=== Testing Capital Strategist Agent ===\n");

    const testProspect = {
        name: "James Robertson",
        company: "Highland Manufacturing Co",
        turnover: "£8.2M",
        sector: "Manufacturing",
        currentDebt: {
            monthly: 8000,
            term: 12,
            rate: 12,
        },
    };

    // Test 1: Generate initial outreach
    console.log("1. Generating Initial Outreach Email\n");
    const initialEmail = await capitalStrategist.generateOutreachEmail(testProspect);

    console.log("Subject:", initialEmail.subject);
    console.log("\nBody:");
    console.log(initialEmail.body);
    console.log("\n" + "=".repeat(60) + "\n");

    // Test 2: Calculate refinance scenario
    console.log("2. Calculating Refinance Scenario\n");
    const scenario = capitalStrategist.calculateRefinanceScenario(
        8000, // Current monthly
        12,   // Current rate
        12,   // Months remaining
        150000 // Loan amount
    );

    console.log("Current Monthly:", `£${scenario.currentMonthly.toLocaleString()}`);
    console.log("New Monthly:", `£${scenario.newMonthly.toLocaleString()}`);
    console.log("Cash Flow Gap:", `£${scenario.cashFlowGap.toLocaleString()}/month`);
    console.log("Annual Savings:", `£${scenario.annualSavings.toLocaleString()}`);
    console.log("Setup Fee:", `£${scenario.setupFee.toLocaleString()}`);
    console.log("Payback Period:", `${scenario.paybackMonths} months`);
    console.log("\n" + "=".repeat(60) + "\n");

    // Test 3: Generate follow-up with numbers
    console.log("3. Generating Follow-Up Email\n");
    const followUp = await capitalStrategist.generateFollowUpEmail(testProspect, scenario);

    console.log("Subject:", followUp.subject);
    console.log("\nBody:");
    console.log(followUp.body);
    console.log("\n" + "=".repeat(60) + "\n");

    // Test 4: Test objection handling
    console.log("4. Testing Objection Handling\n");

    const objections = [
        "I don't want to be locked in for 5 years",
        "The total interest is too high",
        "Your arrangement fees are expensive",
    ];

    for (const objection of objections) {
        console.log(`Objection: "${objection}"`);
        const reframe = capitalStrategist.handleObjection(objection);
        console.log(`Reframe: ${reframe}\n`);
    }

    // Test 5: Get 2026 benefits
    console.log("\n5. 2026 Benefit Pitches\n");
    console.log("Macro-Stability:", capitalStrategist.get2026BenefitPitch("macro"));
    console.log("\nEquity Release:", capitalStrategist.get2026BenefitPitch("equity"));
    console.log("\nOperational:", capitalStrategist.get2026BenefitPitch("operational"));
}

testCapitalStrategist().catch(console.error);
