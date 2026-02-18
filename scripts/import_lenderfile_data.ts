
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { InsertLender } from "../shared/schema.js";
import { initialLenders } from "./lenderDataSource";

// Manual environment setup since we are running as a script
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

// Ensure Google Cloud Project ID is set
if (!process.env.GOOGLE_CLOUD_PROJECT) {
    process.env.GOOGLE_CLOUD_PROJECT = "veltro-prod";
}

function parseLoanAmount(range: string): { min?: number; max?: number } {
    if (!range) return {};

    const clean = (s: string) => s.replace(/[^0-9kKmM\.]/g, "").toLowerCase();
    const parseVal = (s: string) => {
        let mult = 1;
        if (s.includes("k")) mult = 1000;
        if (s.includes("m")) mult = 1000000;
        const num = parseFloat(s.replace(/[km]/g, ""));
        return isNaN(num) ? undefined : num * mult;
    };

    const parts = range.split("-").map(s => s.trim());
    if (parts.length === 2) {
        return { min: parseVal(clean(parts[0])), max: parseVal(clean(parts[1])) };
    } else if (parts.length === 1) {
        // Try to guess if "Up to X" or "From X"
        if (range.toLowerCase().includes("up to")) return { max: parseVal(clean(parts[0])) };
        if (range.toLowerCase().includes("from")) return { min: parseVal(clean(parts[0])) };
        // fallback
        return { min: parseVal(clean(parts[0])) };
    }
    return {};
}

async function run() {
    // Dynamic import so env vars are loaded first
    const { storage } = await import("../server/storage");

    console.log("Starting Lender Import...");
    let count = 0;

    // Use a default system user ID or admin ID. 
    // Since we wiped everything, we might not have users. 
    // But storage methods require userId. 
    // We'll use a placeholder "system_import" or fetch the first user if possible.
    // For now "system_import" and we can re-assign later if needed.
    // Actually, typically resources are owned by the platform (global=1) or a specific user.
    // The user requested Global Lenders to have correct ownership.
    // We'll set them as Global (isGlobal=1) and userId="system".

    const systemUserId = "system";

    for (const lender of initialLenders) {
        try {
            // Parse Loan Amounts
            const { min, max } = parseLoanAmount(lender.loanSizeRange);

            // Map to InsertLender schema
            const newLender: InsertLender = {
                institutionName: lender.companyName,
                website: lender.website,
                // logoUrl: lender.logoUrl, // EXCLUDED explicitly
                lenderType: lender.category, // You might want to map this loop to simpler types like 'bank', 'alternative' etc.
                email: lender.email || "",
                phone: lender.phone,
                notes: lender.notes,
                isGlobal: 1, // Defaulting everything to Global for this import
                productTypes: lender.products ? lender.products.split(",").map(s => s.trim()) : [],
                sectors: lender.sectorsServed ? lender.sectorsServed.split(",").map(s => s.trim()) : [],
                minLoanAmount: min,
                maxLoanAmount: max,
                regions: lender.geographicCoverage ? [lender.geographicCoverage] : [],
                panelStatus: "market", // Default
                contactName: "", // Not in source
                address: "", // Not in source
                fcaReference: lender.fcaStatus, // Storing the full status string here for reference
                linkedinUrl: lender.linkedInTwitter?.split(";")[0]?.trim(), // First link
                // defaults
                acceptsStartups: 0,
                isFavourite: 0,
                introducerAgreementSigned: 0,
                securityTypes: [],
                borrowerTypes: []
            };

            await storage.createLender(newLender, systemUserId);
            count++;
            if (count % 10 === 0) console.log(`Imported ${count} lenders...`);

        } catch (e) {
            console.error(`Failed to import ${lender.companyName}:`, e);
        }
    }

    console.log(`Import complete. Total imported: ${count}`);
    process.exit(0);
}

run().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
