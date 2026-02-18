import 'dotenv/config';
import { LeadFinderAPI } from './server/Lead Agent/src/api.js';

async function verify() {
    const api = new LeadFinderAPI();

    // 1. Search for Veltro (should find us and enrich)
    console.log("Searching for Veltro...");
    const result = await api.search({
        query: "Veltro Ltd",
        maxResults: 1,
        enrich: true // This should trigger CH enrichment
    });

    if (result.leads.length === 0) {
        console.error("❌ No leads found");
        return;
    }

    const lead = result.leads[0];
    console.log("\nLead Data:");
    console.log(`Name: ${lead.name}`);
    console.log(`CH Number: ${lead.companyNumber}`);
    console.log(`Director: ${lead.contactName}`);
    console.log(`Charges: ${lead.hasCharges} (${lead.activeChargeCount})`);
    console.log(`Lenders: ${lead.lenderNames.join(', ')}`);

    if (lead.contactName) {
        console.log("✅ Contact Name found!");
    } else {
        console.error("❌ Contact Name NOT found");
    }
}

verify().catch(console.error);
