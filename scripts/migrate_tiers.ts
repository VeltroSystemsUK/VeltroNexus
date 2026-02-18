
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Manual environment setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../.env");

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf-8");
    envConfig.split("\n").forEach((line) => {
        const [key, val] = line.split("=");
        if (key && val) {
            process.env[key.trim()] = val.trim();
        }
    });
}

if (!process.env.GOOGLE_CLOUD_PROJECT) {
    process.env.GOOGLE_CLOUD_PROJECT = "veltro-prod";
}

async function run() {
    const { storage } = await import("../server/storage");
    console.log("Starting Tier Migration...");

    const lenders = await storage.listLenders({ includeGlobal: true });
    console.log(`Found ${lenders.length} lenders. Checking for missing tiers...`);

    let updatedCount = 0;
    for (const lender of lenders) {
        if (lender.tier === undefined || lender.tier === null) {
            let suggestedTier = 2.0;
            if (lender.lenderType === "tier1") suggestedTier = 1.0;
            else if (lender.lenderType === "tier2") suggestedTier = 2.0;
            else if (lender.lenderType === "tier3") suggestedTier = 3.0;

            console.log(`Updating ${lender.institutionName}: ${lender.lenderType} -> Tier ${suggestedTier}`);
            await storage.updateLender(lender.id, lender.userId, { tier: suggestedTier });
            updatedCount++;
        }
    }

    console.log(`Migration complete. Updated ${updatedCount} lenders.`);
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
