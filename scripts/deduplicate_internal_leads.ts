import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Manually load .env
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf-8");
    envConfig.split("\n").forEach((line) => {
        const [key, value] = line.split("=");
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
}

import { type InternalLead } from "../shared/schema";

// Helper to normalize strings for comparison
const normalize = (str: string | undefined | null) => {
    if (!str) return "";
    return str.toLowerCase().trim()
        .replace(/\s+/g, " ") // Collapse whitespace
        .replace(/^the\s+/, "") // Remove leading "the"
        .replace(/\s+(ltd|limited|plc|llp|inc|incorporated)$/, ""); // Remove common suffixes
};

async function deduplicate() {
    // Dynamic import to ensure env vars are loaded first
    const { storage } = await import("../server/storage");

    const dryRun = process.argv.includes("--dry-run");

    if (dryRun) {
        console.log("🔍 DRY RUN MODE - No changes will be made\n");
    }

    console.log("Starting Internal Leads Deduplication...");

    // 1. Fetch all internal leads
    const allLeads = await storage.listInternalLeads();
    console.log(`Fetched ${allLeads.length} internal leads to analyze.`);

    // 2. Grouping by normalized company name
    const groups: Map<string, InternalLead[]> = new Map();

    for (const lead of allLeads) {
        if (!lead.companyName) continue;

        // Primary key: normalized company name
        let key = normalize(lead.companyName);

        // If company number exists, use it as part of the key for better matching
        if (lead.companyNumber) {
            key = `${key}::${lead.companyNumber.trim()}`;
        }

        if (!key) continue;

        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(lead);
    }

    console.log(`Found ${groups.size} unique company entities.`);

    let duplicatesFound = 0;
    let recordsToDelete = 0;

    for (const [key, cluster] of groups) {
        if (cluster.length > 1) {
            duplicatesFound++;
            recordsToDelete += (cluster.length - 1);

            console.log(`\n📋 Duplicate Group: "${cluster[0].companyName}" - ${cluster.length} records`);
            if (cluster[0].companyNumber) {
                console.log(`   Company Number: ${cluster[0].companyNumber}`);
            }

            // 3. Scoring - based on number of non-null/non-empty fields
            const scored = cluster.map(lead => {
                const score = Object.values(lead).filter(v =>
                    v !== null &&
                    v !== "" &&
                    v !== undefined &&
                    v !== 0 &&
                    !(Array.isArray(v) && v.length === 0)
                ).length;
                return { lead, score };
            });

            // Sort descending by score
            scored.sort((a, b) => b.score - a.score);

            const masterWrapper = scored[0];
            const master = masterWrapper.lead;
            const others = scored.slice(1).map(x => x.lead);

            console.log(`  ✅ Master: ID ${master.id} (Score: ${masterWrapper.score})`);

            // 4. Merging
            let updated = false;
            const updates: Partial<InternalLead> = {};

            for (const other of others) {
                console.log(`  🔀 Merging & Deleting: ID ${other.id} (Score: ${scored.find(s => s.lead.id === other.id)?.score})`);

                // Merge fields
                for (const k in other) {
                    const key = k as keyof InternalLead;
                    const masterValue = master[key];
                    const otherValue = other[key];

                    // If master is empty/null and other has value, take it
                    const isMasterEmpty =
                        masterValue === null ||
                        masterValue === "" ||
                        masterValue === undefined ||
                        (Array.isArray(masterValue) && masterValue.length === 0);

                    const isOtherHasValue =
                        otherValue !== null &&
                        otherValue !== "" &&
                        otherValue !== undefined &&
                        !(Array.isArray(otherValue) && otherValue.length === 0);

                    if (isMasterEmpty && isOtherHasValue) {
                        // We need to update master
                        updates[key] = otherValue as any;
                        updated = true;
                        // Also update local master object so subsequent merges see it
                        (master as any)[key] = otherValue;
                    }
                }
            }

            // 5. Execution (Update Master, Delete Others)
            if (!dryRun) {
                if (updated) {
                    console.log(`  📝 Updating Master ${master.id} with new fields...`);
                    await storage.updateInternalLead(master.id!, updates);
                }

                for (const other of others) {
                    await storage.deleteInternalLead(other.id!);
                }
            } else {
                if (updated) {
                    console.log(`  📝 [DRY RUN] Would update Master ${master.id} with fields:`, Object.keys(updates));
                }
                for (const other of others) {
                    console.log(`  🗑️  [DRY RUN] Would delete ID ${other.id}`);
                }
            }
        }
    }

    console.log("\n--------------------------");
    if (dryRun) {
        console.log("DRY RUN Complete - No Changes Made");
    } else {
        console.log("Deduplication Complete");
    }
    console.log(`Total Groups: ${groups.size}`);
    console.log(`Duplicate Groups Found: ${duplicatesFound}`);
    console.log(`Records ${dryRun ? 'That Would Be' : ''} Deleted: ${recordsToDelete}`);
    console.log("--------------------------");

    if (dryRun) {
        console.log("\n💡 Run without --dry-run flag to execute deduplication");
    }
}

deduplicate().catch(console.error);
