
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

    console.log(`Total Lenders: ${lenders.length}`);
    lenders.slice(0, 5).forEach(l => {
        console.log("---");
        console.log(`ID: ${l.id}`);
        console.log(`Name: ${l.institutionName}`);
        console.log(`Tier: ${l.lenderType}`);
        console.log(`Products: ${JSON.stringify(l.productTypes)} (Type: ${typeof l.productTypes})`);
        console.log(`Min: ${l.minLoanAmount}, Max: ${l.maxLoanAmount}`);
    });

    process.exit(0);
}

run().catch(console.error);
