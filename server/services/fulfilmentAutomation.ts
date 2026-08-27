import { agenticWorkflow } from "./agenticWorkflow";

export const fulfilmentAutomation = {
    async runDailyChase() {
        console.log("[Fulfilment] Running agentic deal-file tick...");
        const due = await agenticWorkflow.tick();
        console.log(`[Fulfilment] ${due} deal file(s) advanced.`);
    }
};
