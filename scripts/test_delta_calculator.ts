import { capitalStrategist } from "../server/services/capitalStrategistService";

/**
 * Test Delta-First Calculator
 */

async function testDeltaCalculator() {
    console.log("=== Testing Capital Strategist Delta-First Calculator ===\n");

    // Example Scenario: Business with £150k Short-Term Debt
    const inputs = {
        principal: 150000,   // £150k Total Balance
        monthly: 9500,       // £9.5k/month current repayment
        rate: 15             // 15% estimated rate
    };

    console.log("SCENARIO INPUTS:");
    console.log(`- Principal: £${inputs.principal.toLocaleString()}`);
    console.log(`- Current Monthly: £${inputs.monthly.toLocaleString()}`);
    console.log(`- Est. Rate: ${inputs.rate}%\n`);

    console.log("CALCULATING DELTA...\n");

    // NOTE: In a real app we'd import the calculator directly or expose it via service
    // For this test script, we can mock the service call if the method isn't fully typed yet
    // or use the logic directly. The service method was added in the previous step.
    const delta = capitalStrategist.calculateDelta(inputs);

    console.log("THE IMMEDIATE REVEAL:");
    console.log(`- New 5-Year Monthly: £${delta.refinanceMonthly.toLocaleString()} (at 8.5%)`);
    console.log(`- Monthly Saving (Delta): £${delta.monthlySaving.toLocaleString()}`);
    console.log(`- Annual Cash Gain: £${delta.annualSaving.toLocaleString()}`);
    console.log(`- Rate Reduction: ${delta.rateReduction}%\n`);

    console.log("VALUATION IMPACT (EBITDA Multiplier):");
    console.log(`- Low (5x): +£${delta.valuationImpact.low.toLocaleString()} to Valuation`);
    console.log(`- High (7x): +£${delta.valuationImpact.high.toLocaleString()} to Valuation\n`);

    console.log("DSCR ARGUMENT:");
    console.log(`- Current DSCR: ${delta.dscrImpact.currentDSCR}`);
    console.log(`- Projected DSCR: ${delta.dscrImpact.projectedDSCR}\n`);

    console.log("THE CLOSER:");
    console.log(`"${delta.closingLine}"\n`);

    console.log("HIDDEN REALITY POINTERS (2026):");
    const reality = capitalStrategist.getHiddenRealityTalkingPoints();
    console.log(`- Maturity Trap: ${reality.maturityTrap}`);
    console.log(`- Rate Hedge: ${reality.rateHedge}`);
    console.log(`- DSCR Argument: ${reality.dscr}`);

    console.log("\n=== Test Complete ===");
}

testDeltaCalculator().catch(console.error);
