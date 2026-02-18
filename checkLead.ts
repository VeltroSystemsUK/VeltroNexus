import { storage } from "./server/storage";
import dotenv from "dotenv";

dotenv.config();

async function checkSpecificLead() {
    const leads = await storage.listInternalLeads();
    const lead = leads.find(l => l.companyName.includes("ADI-REP"));

    if (lead) {
        console.log("Full Lead Data for ADI-REP:");
        console.log(JSON.stringify(lead, null, 2));
    } else {
        console.log("Lead not found");
    }
}

checkSpecificLead();
