import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { InsertLender } from "../shared/schema";
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

    const parseVal = (s: string) => {
        // Regex to find a number followed by optional k, m, million, etc.
        // We look for a pattern like "500", "500k", "500 m", "5 million"
        const match = s.match(/((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?)\s*([km]|[mb]illion)?/i);
        if (!match) return undefined;

        let numStr = match[1].replace(/,/g, "");
        let num = parseFloat(numStr);
        if (isNaN(num)) return undefined;

        const suffix = match[2]?.toLowerCase();
        if (suffix === "k") num *= 1000;
        if (suffix === "m" || suffix === "million") num *= 1000000;
        if (suffix === "billion") num *= 1000000000;

        return num;
    };

    const parts = range.split("-").map(s => s.trim());
    if (parts.length === 2) {
        return { min: parseVal(parts[0]), max: parseVal(parts[1]) };
    } else if (parts.length === 1) {
        const lower = range.toLowerCase();
        const val = parseVal(parts[0]);
        if (lower.includes("up to") || lower.includes("max")) return { max: val };
        if (lower.includes("from") || lower.includes("min") || lower.includes("starts")) return { min: val };
        return { min: val };
    }
    return {};
}

const PRODUCT_MAPPING: Record<string, string> = {
    "asset finance": "Asset Finance",
    "invoice finance": "Invoice Finance",
    "invoice discounting": "Invoice Finance",
    "invoice factoring": "Invoice Finance",
    "merchant cash advance": "Merchant Cash Advance",
    "commercial mortgages": "Commercial Mortgages",
    "commercial mortgage": "Commercial Mortgages",
    "bridging loans": "Bridging",
    "bridging": "Bridging",
    "development finance": "Development Finance",
    "property development finance": "Development Finance",
    "business loans": "Term Loan",
    "unsecured loans": "Unsecured Business Loans",
    "unsecured business loans": "Unsecured Business Loans",
    "term loans": "Term Loan",
    "term loan": "Term Loan",
    "revolving credit": "Revolving Credit",
    "revolving credit facilities": "Revolving Credit",
    "trade finance": "Trade Finance",
    "vehicle finance": "Vehicle Finance",
    "equipment leasing": "Equipment Leasing",
    "litigation funding": "Litigation Funding",
    "mezzanine": "Mezzanine",
    "equity release": "Equity Release",
    "working capital": "Working Capital",
    "working capital loans": "Working Capital",
    "vat loans": "VAT Loans",
    "tax loans": "Tax Loans",
};

function mapProducts(productStr: string): string[] {
    if (!productStr) return [];
    // Handle both comma and semicolon separators
    const raw = productStr.includes(";") ? productStr.split(";") : productStr.split(",");
    return raw
        .map(s => s.trim().toLowerCase())
        .map(p => {
            // Check for partial matches or exact mapping
            for (const [key, val] of Object.entries(PRODUCT_MAPPING)) {
                if (p === key || p.includes(key)) return val;
            }
            return p;
        })
        .filter((v, i, a) => v && a.indexOf(v) === i); // Unique & truthy
}

function mapToTier(category: string, companyName: string): number {
    const cat = category?.toLowerCase() || "";
    const name = companyName?.toLowerCase() || "";

    // Tier 1.0: Major Banks
    if (name.includes("barclays") || name.includes("hsbc") || name.includes("natwest") || name.includes("lloyds") || name.includes("santander")) {
        return 1.0;
    }

    // Tier 1.5: Challenger & Vendor
    if (cat.includes("bank") || name.includes("bank") || cat.includes("challenger")) {
        return 1.5;
    }

    // Tier 2.0: Alternative & CDFI
    if (cat.includes("alternative") || cat.includes("cdfi")) {
        return 2.0;
    }

    // Tier 2.5: Specialised Lenders
    if (cat.includes("specialised") || cat.includes("specialist")) {
        return 2.5;
    }

    // Tier 3.0: Sub Prime Lenders
    if (cat.includes("sub prime") || cat.includes("subprime") || cat.includes("high risk")) {
        return 3.0;
    }

    // Default to Tier 2.0 if unknown
    return 2.0;
}

async function run() {
    const { storage } = await import("../server/storage");

    console.log("Wiping existing lenders...");
    const systemUserId = "system";
    const existing = await storage.listLenders({ userId: systemUserId, includeGlobal: true });
    for (const l of existing) {
        await storage.deleteLender(l.id, l.userId);
    }
    console.log(`Deleted ${existing.length} lenders.`);

    console.log("Starting Tiered Lender Import...");
    let count = 0;

    for (const lender of initialLenders) {
        try {
            const { min, max } = parseLoanAmount(lender.loanSizeRange);
            // Prefer tier from source data if available, otherwise map from category
            const tier = (lender as any).tier !== undefined ? (lender as any).tier : mapToTier(lender.category || "", lender.companyName);

            const newLender: InsertLender = {
                institutionName: lender.companyName,
                website: lender.website,
                // logoUrl: undefined, // EXPLICITLY EXCLUDED
                lenderType: tier <= 1.5 ? "tier1" : tier <= 2.0 ? "tier2" : "tier3",
                tier: tier,
                email: lender.email || "",
                phone: lender.phone,
                notes: lender.notes,
                isGlobal: 1,
                productTypes: mapProducts(lender.products || ""),
                sectors: lender.sectorsServed ? lender.sectorsServed.split(",").map(s => s.trim()) : [],
                minLoanAmount: min,
                maxLoanAmount: max,
                regions: lender.geographicCoverage ? [lender.geographicCoverage] : [],
                panelStatus: "market",
                contactName: "",
                address: "",
                fcaReference: lender.fcaStatus,
                linkedinUrl: lender.linkedInTwitter?.split(";")[0]?.trim(),
                acceptsStartups: 0,
                isFavourite: 0,
                introducerAgreementSigned: 0,
                securityTypes: [],
                borrowerTypes: []
            };

            await storage.createLender(newLender, systemUserId);
            count++;
            if (count % 20 === 0) console.log(`Imported ${count} lenders...`);

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
