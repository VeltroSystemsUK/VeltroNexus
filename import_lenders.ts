
import { db } from "./server/firebase";
import { insertLenderSchema, type Lender } from "./shared/schema";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_FILE_PATH = path.join(__dirname, "attached_assets", "UK Commercial Lenders.csv");

// Helper to parse CSV line respecting quotes
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

// Map CSV Category/Type to our Schema LenderType
function mapLenderType(type: string): string {
    const t = type.toLowerCase();
    if (t.includes("bank")) return "bank";
    if (t.includes("challenger")) return "challenger_bank";
    if (t.includes("invoice")) return "specialist_lender";
    if (t.includes("asset")) return "specialist_lender";
    if (t.includes("p2p")) return "specialist_lender";
    return "other";
}

async function importLenders() {
    console.log("Starting Global Lenders Import...");

    if (!fs.existsSync(CSV_FILE_PATH)) {
        console.error(`CSV file not found at: ${CSV_FILE_PATH}`);
        process.exit(1);
    }

    const content = fs.readFileSync(CSV_FILE_PATH, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);

    // Skip header
    const dataLines = lines.slice(1);

    let successCount = 0;
    let errorCount = 0;

    for (const line of dataLines) {
        try {
            const cols = parseCSVLine(line);
            if (cols.length < 5) continue;

            // CSV Columns based on inspection:
            // 0: Company Name, 1: Website, 2: Logo, 3: Category, 4: Domain, 
            // 5: Type/Category, 6: Geo, 7: Loan Size, 8: Email/Phone, 9: Products, 10: Sectors

            const name = cols[0];
            const website = cols[1];
            const logoUrl = cols[2];
            const category = cols[3] || cols[5]; // Fallback to Type/Category if Category empty
            const products = cols[9] ? cols[9].split(',').map(s => s.trim()) : [];
            const sectors = cols[10] ? cols[10].split(',').map(s => s.trim()) : [];

            const lenderData = {
                userId: "system", // Global lender
                institutionName: name,
                website: website,
                logoUrl: logoUrl,
                lenderType: mapLenderType(category || ""),
                isGlobal: 1, // THE KEY FIELD
                productTypes: products,
                sectors: sectors,
                email: "info@veltro.com", // Placeholder as required by schema
                panelStatus: "market", // Default to Whole of Market
                // Parse other fields if needed
            };

            // Validate with Schema (allow loose parsing for some fields)
            const result = insertLenderSchema.safeParse(lenderData);

            if (result.success) {
                // Check for existing to avoid duplicates
                const existing = await db.collection('lenders')
                    .where('institutionName', '==', name)
                    .where('isGlobal', '==', 1)
                    .get();

                if (existing.empty) {
                    // Add new
                    await db.collection('lenders').add({
                        ...result.data,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                    console.log(`Imported: ${name}`);
                    successCount++;
                } else {
                    console.log(`Skipped (Duplicate): ${name}`);
                }
            } else {
                console.error(`Validation Failed for ${name}:`, result.error.flatten().fieldErrors);
                errorCount++;
            }

        } catch (err) {
            console.error(`Error processing line: ${line.substring(0, 50)}...`, err);
            errorCount++;
        }
    }

    console.log(`\nImport Complete.`);
    console.log(`Success: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    process.exit(0);
}

importLenders();
