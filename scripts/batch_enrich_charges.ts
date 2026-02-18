import 'dotenv/config';
import { storage } from '../server/storage';

async function batchEnrichCharges() {
    console.log("\n=== Starting Batch Charge Enrichment ===\n");

    const chApiKey = process.env.COMPANIES_HOUSE_API_KEY;
    if (!chApiKey) {
        console.error("Error: COMPANIES_HOUSE_API_KEY is not configured in .env");
        process.exit(1);
    }

    try {
        const leads = await storage.listInternalLeads();
        console.log(`Total leads found: ${leads.length}`);

        // Filter for leads that HAVE charges but NO identified lender
        const targetLeads = leads.filter(l => l.hasCharges && !l.identifiedLender && l.companyNumber);
        console.log(`Leads to process: ${targetLeads.length}\n`);

        if (targetLeads.length === 0) {
            console.log("No leads require enrichment at this time.");
            return;
        }

        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        for (const lead of targetLeads) {
            console.log(`Processing: ${lead.companyName} (${lead.companyNumber})...`);

            try {
                const base64Auth = Buffer.from(`${chApiKey.trim()}:`).toString("base64");
                const url = `https://api.company-information.service.gov.uk/company/${lead.companyNumber}/charges`;

                const response = await fetch(url, {
                    headers: { Authorization: `Basic ${base64Auth}` },
                });

                if (!response.ok) {
                    console.warn(`  - Companies House API error: ${response.status} for ${lead.companyName}`);
                    errorCount++;
                    continue;
                }

                const data: any = await response.json();
                const charges = data.items || [];

                if (charges.length === 0) {
                    console.log(`  - No charges found in API response (Data inconsistency)`);
                    skipCount++;
                    continue;
                }

                // Filter for active (not satisfied) charges and sort by date descending
                const activeCharges = charges
                    .filter((c: any) => c.status !== 'satisfied' && c.status !== 'fully-satisfied')
                    .sort((a: any, b: any) => {
                        const dateA = new Date(a.delivered_on || a.created_on || 0).getTime();
                        const dateB = new Date(b.delivered_on || b.created_on || 0).getTime();
                        return dateB - dateA;
                    });

                if (activeCharges.length === 0) {
                    console.log(`  - No active charges found for ${lead.companyName}`);
                    skipCount++;
                } else {
                    const latestCharge = activeCharges[0];
                    const lenders = latestCharge.persons_entitled?.map((p: any) => p.name).filter(Boolean).join(", ");
                    const chargeDate = latestCharge.delivered_on || latestCharge.created_on;

                    if (lenders) {
                        console.log(`  - Found Charge Holder: ${lenders}`);
                        await storage.updateInternalLead(lead.id, {
                            identifiedLender: lenders,
                            chargeDate: chargeDate || undefined,
                        });
                        successCount++;
                    } else {
                        console.log(`  - No persons entitled found in charge record.`);
                        skipCount++;
                    }
                }
            } catch (err) {
                console.error(`  - Failed to process ${lead.companyName}:`, err);
                errorCount++;
            }

            // Respect rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log("\n=== Enrichment Summary ===");
        console.log(`Total Target: ${targetLeads.length}`);
        console.log(`Successfully Updated: ${successCount}`);
        console.log(`Skipped (No Active Charges): ${skipCount}`);
        console.log(`Errors: ${errorCount}`);
        console.log("==========================\n");

    } catch (error) {
        console.error("Batch enrichment failed:", error);
    }
}

batchEnrichCharges().catch(console.error);
