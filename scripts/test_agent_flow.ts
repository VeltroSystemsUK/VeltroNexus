import 'dotenv/config';
import { LeadFinderAgent } from '../server/Lead Agent/src/agent';

async function main() {
    const instruction = "Find manufacturing SMEs in Leicester, UK. Minimum 4 stars.";
    console.log(`\nTesting LeadFinderAgent Flow with instruction: "${instruction}"`);
    console.log("----------------------------------------------------------------");

    try {
        const agent = new LeadFinderAgent();
        const result = await agent.run(instruction);

        console.log("\n----------------------------------------------------------------");
        console.log("AGENT RESPONSE:\n", result.agentResponse);
    } catch (e) {
        console.error("Agent Flow Failed:", e);
    }
}

main();
