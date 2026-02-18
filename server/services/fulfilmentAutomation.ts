import { storage } from "../storage";
import { agentRunner } from "./agentRunner";

export const fulfilmentAutomation = {
    /**
     * Run the daily chase routine for all active prospects in 'lead' or 'onboarding' stage.
     * This triggers the Fulfilment Manager agent to check requirements and send emails.
     */
    async runDailyChase() {
        console.log("[Fulfilment] Starting Daily Chase Routine...");

        // 1. Get all users (to process their prospects)
        // In a real app, we might batch this or run per-user triggers.
        // For now, we'll iterate all users to find their prospects.
        const users = await storage.getAllUsers();

        for (const user of users) {
            if (user.id === "dev-admin-id") continue; // Skip mock admin for now or handle appropriately

            try {
                const prospects = await storage.listProspects(user.id);

                // Filter for prospects that need chasing (e.g., waiting for docs)
                // Stage: "lead" (initial) or maybe a specific "awaiting_documents" stage if we had one.
                // We'll stick to "lead" for now as per user flow.
                const activeProspects = prospects.filter(p => p.stage === "lead");

                for (const prospect of activeProspects) {
                    // Fire and forget agent instruction
                    // The agent will use 'getProspectRequirementStatus' 
                    // and then 'sendEmail' if things are missing.

                    console.log(`[Fulfilment] Triggering chase for Prospect ${prospect.id} (User: ${user.id})`);

                    await agentRunner.runInstruction(
                        "fulfilment-manager",
                        user.id,
                        `Review the document requirements for Prospect ${prospect.id} (${prospect.company.companyName}). 
              If there are missing "Required" documents (status: pending), draft and send a polite yet firm chasing email to the contact. 
              The email should list the missing items clearly. 
              If all documents are present, update the notes to say "Ready for Strategy" and do not send an email.`,
                        { prospectId: prospect.id }
                    );
                }

            } catch (err) {
                console.error(`[Fulfilment] Error processing user ${user.id}:`, err);
            }
        }

        console.log("[Fulfilment] Daily Chase Routine Completed.");
    }
};
