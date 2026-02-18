import { leadScoring } from "../server/services/leadScoringService";

console.log("Starting test_lead_scoring.ts...");

const testCompanies = [
    {
        companyNumber: "13674550", // Velocity Business Finance
        companyName: "Velocity Business Finance Limited",
    },
    {
        companyNumber: "02050399", // Valid iXBRL company
        companyName: "NEXT PLC",
    },
    {
        companyNumber: "09446001", // Revolut Ltd
        companyName: "Revolut Ltd",
    },
];

async function testLeadScoring() {
    console.log("=== Testing Lead Scoring System ===\n");
    console.log("Checking for high-rate lender debt markers...\n");

    for (const company of testCompanies) {
        console.log(`\n${"=".repeat(60)}`);
        console.log(`Testing: ${company.companyName} (${company.companyNumber})`);
        console.log("=".repeat(60));

        const scoredLead = await leadScoring.qualifyLead(
            company.companyNumber,
            company.companyName
        );

        if (!scoredLead) {
            console.log("❌ Failed to qualify lead\n");
            continue;
        }

        console.log(`\n📊 SCORE: ${scoredLead.score}/100`);
        console.log(`🎯 PRIORITY: ${scoredLead.priority.toUpperCase()}`);

        console.log(`\n💰 DEBT MARKERS FOUND: ${scoredLead.chargeMarkers.length}`);
        for (const marker of scoredLead.chargeMarkers) {
            console.log(`\n  Charge #${marker.chargeNumber}`);
            console.log(`    Holder: ${marker.personEntitled}`);
            console.log(`    Age: ${marker.ageMonths} months`);
            console.log(`    Status: ${marker.status}`);

            if (marker.identifiedLender) {
                console.log(`    ⚠️  HIGH-RATE LENDER DETECTED: ${marker.identifiedLender.name}`);
                console.log(`    Typical APR: ${marker.identifiedLender.typicalAPR[0]}-${marker.identifiedLender.typicalAPR[1]}%`);
                console.log(`    Pitch: "${marker.identifiedLender.refinancingPitch}"`);
            }
        }

        console.log(`\n📈 SCORING BREAKDOWN:`);
        console.log(`  Charge Score: ${scoredLead.scoringBreakdown.chargeScore} pts`);
        console.log(`  Age Score: ${scoredLead.scoringBreakdown.ageScore} pts`);
        console.log(`  Creditor Score: ${scoredLead.scoringBreakdown.creditorScore} pts`);
        console.log(`  Asset Score: ${scoredLead.scoringBreakdown.assetScore} pts`);

        console.log(`\n💡 RECOMMENDED APPROACH:`);
        console.log(`  ${scoredLead.recommendedApproach}`);

        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log("Test Complete");
    console.log("=".repeat(60));
}

testLeadScoring().catch(console.error);
