import "dotenv/config";
import { agentRunner } from "../services/agentRunner";

async function simulateObjection() {
    console.log("--- SIMULATION START: Capital Strategist Objection Handling ---");

    const mockContext = {
        prospect: {
            companyName: "Acme Logistics Ltd",
            currentDebt: [
                { lender: "Iwoca", amount: 50000, type: "MCA", interestRate: "Factor 1.3 (60% APR)", monthlyPayment: 8000 }
            ],
            proposedRefinance: {
                amount: 100000,
                rate: "12% APR",
                term: "5 Years",
                monthlyPayment: 2200
            },
            cashFlowDelta: "+£5,800/month",
            year1Savings: "£69,600"
        }
    };

    const agentId = "capital-strategist";
    const userId = "dev-simulation-user";

    // The client's objection
    const objection = "I appreciate the offer, but 12% feels really high. My mortgage is 5%. I think I'll just wait for the base rate to drop next year before doing anything.";

    console.log(`\n[Client]: "${objection}"`);
    console.log(`\n... AGENT THINKING ...\n`);

    try {
        const response = await agentRunner.runInstruction(
            agentId,
            userId,
            `Address this strategic concern. Use empathy and data. Do NOT use hard sales tactics: "${objection}"`,
            mockContext
        );

        console.log(`[Capital Strategist]:\n${response}`);

    } catch (error) {
        console.error("Simulation failed:", error);
    }
}

// execute if running directly
// execute if running directly
simulateObjection().catch(console.error);
