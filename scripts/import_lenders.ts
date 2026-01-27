import { db } from "../server/firebase";
import ExcelJS from 'exceljs';
import path from 'path';

const filePath = 'c:/Users/Shaun/Downloads/Veltro/Veltro/attached_assets/UK Commercial Lenders.csv';

function parseLoanAmount(str: string): number | undefined {
    if (!str) return undefined;
    // Remove "£", ",", " "
    let clean = str.toLowerCase().replace(/[£,\s]/g, '');
    let multiplier = 1;
    if (clean.endsWith('k')) {
        multiplier = 1000;
        clean = clean.slice(0, -1);
    } else if (clean.endsWith('m')) {
        multiplier = 1000000;
        clean = clean.slice(0, -1);
    } else if (clean.endsWith('b')) {
        multiplier = 1000000000;
        clean = clean.slice(0, -1);
    }

    const val = parseFloat(clean);
    return isNaN(val) ? undefined : val * multiplier;
}

function parseRange(str: string): { min?: number, max?: number } {
    if (!str) return {};
    const parts = str.split('-').map(s => s.trim());
    if (parts.length === 2) {
        return {
            min: parseLoanAmount(parts[0]),
            max: parseLoanAmount(parts[1])
        };
    }
    return {};
}

function extractEmail(str: string): string | undefined {
    if (!str) return undefined;
    const match = str.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
    return match ? match[0] : undefined;
}

function extractPhone(str: string): string | undefined {
    if (!str) return undefined;
    // Basic phone regex (UK-centric but broad enough)
    const match = str.match(/((?:\+44|0)[0-9\s-]{9,})/);
    return match ? match[0].trim() : undefined;
}

async function importLenders() {
    console.log("Starting Lender Import...");

    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.csv.readFile(filePath);
        const worksheet = workbook.getWorksheet(1);
        if (!worksheet) throw new Error("No worksheet");

        const rowCount = worksheet.rowCount;
        console.log(`Processing ${rowCount - 1} rows...`);

        let updated = 0;
        let created = 0;
        let errors = 0;

        for (let i = 2; i <= rowCount; i++) {
            const row = worksheet.getRow(i);

            // Map columns
            const name = row.getCell(1).text.trim();
            const website = row.getCell(2).text.trim();
            const logoUrl = row.getCell(3).text.trim();
            const category = row.getCell(4).text.trim(); // Category
            const geo = row.getCell(8).text.trim(); // Geographic Coverage
            const loanRange = row.getCell(9).text.trim(); // Loan Size Range
            const contactInfo = row.getCell(10).text.trim(); // Email/Phone
            const products = row.getCell(11).text.trim(); // Products

            if (!name) continue;

            const email = extractEmail(contactInfo);
            const phone = extractPhone(contactInfo);
            const { min, max } = parseRange(loanRange);

            // Find existing lender by namme
            const lendersRef = db.collection("lenders");
            const snapshot = await lendersRef.where("institutionName", "==", name).get();

            const lenderData: any = {
                institutionName: name,
                website: website || undefined,
                updatedAt: new Date().toISOString(),
                // Only update logo if we have one from CSV
                ...(logoUrl ? { logoUrl } : {}),
                ...(email ? { email } : {}),
                ...(phone ? { phone } : {}),
                ...(min ? { minLoanAmount: min } : {}),
                ...(max ? { maxLoanAmount: max } : {}),
                // Just put geographic info in address for now if not structured?
                // Or maybe 'regions'? Schema has 'regions' (json).
                ...(geo ? { regions: [geo] } : {}),
                ...(products ? { productTypes: products.split(',').map(s => s.trim()) } : {}),
                // isGlobal defaults to 1 for this import? It's "Global Lenders" technically?
                // User said "Scrape all the logos...". These are "UK Commercial Lenders".
                // I will set isGlobal=1 for these "system" lenders.
                isGlobal: 1
            };

            if (!snapshot.empty) {
                // Update first match
                const doc = snapshot.docs[0];
                await doc.ref.update(lenderData);
                updated++;
                // console.log(`Updated: ${name}`);
            } else {
                // Create new
                await lendersRef.add({
                    ...lenderData,
                    createdAt: new Date().toISOString(),
                    userId: "system", // System owned
                    isFavourite: 0,
                    status: "active"
                });
                created++;
                // console.log(`Created: ${name}`);
            }
        }

        console.log("--------------------------------");
        console.log(`Import Complete.`);
        console.log(`Updated: ${updated}`);
        console.log(`Created: ${created}`);
        console.log("--------------------------------");

    } catch (err) {
        console.error("Import failed:", err);
    } finally {
        // process.exit(0); // Let wait for promises? No, logic is sequential.
        process.exit(0);
    }
}

importLenders();
