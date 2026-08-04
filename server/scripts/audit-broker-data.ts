import "dotenv/config";
import { storage } from "../storage";
import { enrichLead } from "../services/leadEnrichmentService";

async function run() {
    const leads = await storage.listBrokerLeads();
    
    console.log(`[Audit] Starting comprehensive database audit for ${leads.length} broker leads.`);
    
    let updatedCount = 0;
    let failedCount = 0;
    let emailFoundCount = 0;
    let nameFoundCount = 0;

    const BATCH_SIZE = 5;
    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
        const batch = leads.slice(i, i + BATCH_SIZE);
        console.log(`[Audit] Processing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(leads.length/BATCH_SIZE)}...`);
        
        await Promise.all(batch.map(async (lead: any) => {
            try {
                // Perform deep enrichment (Gemini Grounded Search)
                const result = await enrichLead(lead as any);
                
                const updates: any = {};
                let changed = false;

                // 1. UPDATE CONTACT NAME
                // If current is "Unknown" or generic, and we found a real name, update it.
                if (result.contacts && result.contacts.length > 0 && result.contacts[0].name) {
                    const newName = result.contacts[0].name;
                    if (!lead.contactName || lead.contactName === "Unknown" || lead.contactName.toLowerCase().includes("contact") || lead.contactName !== newName) {
                        updates.contactName = newName;
                        nameFoundCount++;
                        changed = true;
                    }
                }

                // 2. UPDATE EMAIL (Prefer Direct over Generic)
                if (result.emails && result.emails.length > 0) {
                    const bestEmail = result.emails[0];
                    const currentEmail = lead.email;
                    
                    const isGeneric = (email: string) => /^(info|contact|admin|hello|sales|support|enquiries|office)@/i.test(email);

                    // Update if current is empty, or current is generic and new is better (not generic), or new is just different and better data is requested
                    if (!currentEmail || (isGeneric(currentEmail) && !isGeneric(bestEmail)) || (bestEmail !== currentEmail)) {
                        updates.email = bestEmail;
                        emailFoundCount++;
                        changed = true;
                    }
                }

                // 3. UPDATE PHONE
                if (result.phones && result.phones.length > 0 && result.phones[0] !== lead.phone) {
                    updates.phone = result.phones[0];
                    changed = true;
                }

                // 4. UPDATE OTHER METADATA
                if (result.linkedinUrl && result.linkedinUrl !== lead.linkedinUrl) {
                    updates.linkedinUrl = result.linkedinUrl;
                    changed = true;
                }
                if (result.website && result.website !== lead.website) {
                    updates.website = result.website;
                    changed = true;
                }

                // Always update notes with fresh context
                if (result.businessOverview) {
                    updates.notes = `[AUDIT ENRICHMENT - ${new Date().toLocaleDateString()}]\n${result.businessOverview}\n\n${lead.notes || ''}`;
                    changed = true;
                }

                if (changed) {
                    await storage.updateBrokerLead(lead.id, updates);
                    console.log(`[Audit] Updated ${lead.companyName}: ${updates.contactName || lead.contactName} (${updates.email || lead.email})`);
                    updatedCount++;
                }
            } catch (error) {
                console.error(`[Audit] Error processing ${lead.companyName}:`, error);
                failedCount++;
            }
        }));

        // Respectful pause for API rates
        if (i + BATCH_SIZE < leads.length) {
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    console.log(`\n[Audit Complete]`);
    console.log(`Total Processed: ${leads.length}`);
    console.log(`Records Updated: ${updatedCount}`);
    console.log(`Names Found/Verified: ${nameFoundCount}`);
    console.log(`Emails Found/Verified: ${emailFoundCount}`);
    console.log(`Failures: ${failedCount}`);
    
    process.exit(0);
}

run().catch(console.error);
