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

// import { storage } from "../server/storage"; // Removed static import
import { type Lender } from "../shared/schema";

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

    console.log("Starting Deduplication Process...");

    // 1. Fetch all lenders
    // We use a dummy ID to get started, but we'll try to get ALL via listLenders({ includeGlobal: true })
    // which usually fetches global + user specific.
    // To be safe, we might need to iterate over users if listLenders is scoped.
    // However, duplicates are likely in the "global" set or for a specific user.
    // Let's assume we are fixing the "Global" duplicates primarily.

    let targetUserId = "migration-script";
    try {
        const users = await storage.getAllUsers();
        if (users.length > 0) targetUserId = users[0].id; // Likely an admin
    } catch (e) { }

    // Fetching "all" might be tricky if they are private to users. 
    // But duplicates are likely from the recent global import (userId="migration-script" or similar).

    // Iterate all users to get their lenders? No, too expensive.
    // Let's rely on listLenders returning global + local. 
    // If we run this as "admin", we see global. 
    // If duplicates are global, we will find them.
    const allLenders = await storage.listLenders({ userId: targetUserId, includeGlobal: true });
    console.log(`Fetched ${allLenders.length} lenders to analyze.`);

    // 2. Grouping
    // Key: "normalized_name::user_id"
    const groups: Map<string, Lender[]> = new Map();

    for (const lender of allLenders) {
        if (!lender.institutionName) continue;
        const normName = normalize(lender.institutionName);
        if (!normName) continue;

        // Group by Name AND Owner to avoid merging different users' private lenders
        const key = `${normName}::${lender.userId}`;

        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(lender);
    }

    console.log(`Found ${groups.size} unique lender entities (Name + User).`);

    let duplicatesFound = 0;
    let recordsToDelete = 0;

    for (const [key, cluster] of groups) {
        if (cluster.length > 1) {
            duplicatesFound++;
            recordsToDelete += (cluster.length - 1);

            const [name, uid] = key.split("::");
            console.log(`\nDuplicate Group: "${name}" (User: ${uid}) - ${cluster.length} records`);

            // 3. Scoring
            // Score based on number of keys with values
            const scored = cluster.map(l => {
                const score = Object.values(l).filter(v => v !== null && v !== "" && v !== 0 && v !== undefined).length;
                return { lender: l, score };
            });

            // Sort descending by score
            scored.sort((a, b) => b.score - a.score);

            const masterWrapper = scored[0];
            const master = masterWrapper.lender;
            const others = scored.slice(1).map(x => x.lender);

            console.log(`  -> Master: ID ${master.id} (Score: ${masterWrapper.score})`);

            // 4. Merging
            let updated = false;
            const updates: Partial<Lender> = {};

            for (const other of others) {
                console.log(`  -> Merging & Deleting: ID ${other.id}`);

                // Merge fields
                for (const k in other) {
                    const key = k as keyof Lender;
                    const masterValue = master[key];
                    const otherValue = other[key];

                    // If master is empty/null/zero and other has value, take it.
                    const isMasterEmpty = masterValue === null || masterValue === "" || masterValue === undefined;
                    const isOtherHasValue = otherValue !== null && otherValue !== "" && otherValue !== undefined;

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
            if (updated) {
                console.log(`  -> Updating Master ${master.id} with new fields...`);
                // Pass userId for authorization/verification
                await storage.updateLender(master.id!, master.userId, updates);
            }

            for (const other of others) {
                // Pass userId for authorization/verification
                await storage.deleteLender(other.id!, other.userId);
            }
        }
    }

    console.log("\n--------------------------");
    console.log(`Deduplication Complete.`);
    console.log(`Processed Groups: ${groups.size}`);
    console.log(`Duplicate Groups Found: ${duplicatesFound}`);
    console.log(`Records Deleted: ${recordsToDelete}`);
    console.log("--------------------------");
}

deduplicate().catch(console.error);
