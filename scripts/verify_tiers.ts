
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

async function run() {
    const { storage } = await import("../server/storage");
    const lenders = await storage.listLenders({ userId: "system", includeGlobal: true });

    const tiers = {
        tier1: 0,
        tier2: 0,
        tier3: 0,
        other: 0
    };

    lenders.forEach(l => {
        if (l.lenderType === "tier1") tiers.tier1++;
        else if (l.lenderType === "tier2") tiers.tier2++;
        else if (l.lenderType === "tier3") tiers.tier3++;
        else tiers.other++;
    });

    console.log("Tier Distribution:");
    console.log(`Tier 1: ${tiers.tier1}`);
    console.log(`Tier 2: ${tiers.tier2}`);
    console.log(`Tier 3: ${tiers.tier3}`);
    console.log(`Other/Unknown: ${tiers.other}`);
    console.log(`Total: ${lenders.length}`);

    // Check for logos
    const withLogos = lenders.filter(l => l.logoUrl && l.logoUrl !== "").length;
    console.log(`Lenders with logos: ${withLogos}`);

    process.exit(0);
}

run().catch(console.error);
