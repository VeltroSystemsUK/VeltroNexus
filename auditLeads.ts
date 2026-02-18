import { storage } from "./server/storage";
import dotenv from "dotenv";

dotenv.config();

async function auditLeads() {
    console.log("Auditing leads in Firestore...");
    const leads = await storage.listInternalLeads();
    console.log(`Total leads: ${leads.length}`);

    const charged = leads.filter(l => l.hasCharges);
    console.log(`Leads with hasCharges: true -> ${charged.length}`);

    console.log("\nSample Leads in DB:");
    leads.slice(0, 5).forEach(l => console.log(`- ${l.companyName} (${l.companyNumber}) [hasCharges: ${l.hasCharges}]`));

    if (charged.length > 0) {
        console.log("Sample charged lead:", charged[0].companyName);
    } else {
        console.log("No leads found with charges. This confirms the backend is failing to set the flag.");
    }
}

auditLeads();
