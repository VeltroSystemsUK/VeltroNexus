import { storage } from "./server/storage";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
const base64Auth = Buffer.from(`${apiKey?.trim()}:`).toString("base64");

async function patchCharges() {
    console.log("Starting Retro-Patch for Internal Lead Charges...");
    const leads = await storage.listInternalLeads();
    console.log(`Found ${leads.length} leads to check.`);

    let updatedCount = 0;
    let failCount = 0;
    let rateLimitCount = 0;

    for (let i = 0; i < leads.length; i++) {
        const lead = leads[i];

        // Skip leads that already have charges marked or were converted
        if (lead.hasCharges || lead.status === "converted") continue;

        if (i % 10 === 0) console.log(`Processing lead ${i}/${leads.length}...`);

        try {
            const profileUrl = `https://api.company-information.service.gov.uk/company/${lead.companyNumber}`;
            const res = await fetch(profileUrl, {
                headers: { Authorization: `Basic ${base64Auth}` },
            });

            if (res.status === 429) {
                console.warn("Rate limit hit! Resting for 15s...");
                rateLimitCount++;
                await new Promise(r => setTimeout(r, 15000));
                i--; // retry this index
                continue;
            }

            if (res.ok) {
                const data = await res.json();
                const hasCharges = !!data.links?.charges;

                if (hasCharges) {
                    await storage.updateInternalLead(lead.id, {
                        hasCharges: true,
                        notes: (lead.notes || "") + "\n[System] Charge status updated via retro-patch."
                    });
                    updatedCount++;
                }
            } else {
                failCount++;
            }
        } catch (err) {
            failCount++;
        }

        // Small delay to be nice to API
        await new Promise(r => setTimeout(r, 250));
    }

    console.log("\nPatch Complete!");
    console.log(`Updated: ${updatedCount} leads marked with charges.`);
    console.log(`Failed/Skipped: ${failCount}`);
    console.log(`Rate limits hit: ${rateLimitCount}`);
}

patchCharges().catch(console.error);
