import ExcelJS from 'exceljs';
import { findLogoUrl } from '../server/utils/logoFetcher';
import path from 'path';

const filePath = 'c:/Users/Shaun/Downloads/Veltro/Veltro/attached_assets/UK Commercial Lenders.csv';

async function enrichCsv() {
    console.log('Starting CSV logo enrichment...');

    const workbook = new ExcelJS.Workbook();

    try {
        await workbook.csv.readFile(filePath);
        const worksheet = workbook.getWorksheet(1);

        if (!worksheet) {
            throw new Error('No worksheet found');
        }

        const rowCount = worksheet.rowCount;
        console.log(`Processing ${rowCount - 1} rows...`); // -1 for header

        let updated = 0;
        let processed = 0;
        let failed = 0;

        // Iterate rows, starting from 2 (1 is header)
        for (let i = 2; i <= rowCount; i++) {
            const row = worksheet.getRow(i);

            // Columns: 1=Name, 2=Website, 3=Logo URL (empty)
            const name = row.getCell(1).text;
            const website = row.getCell(2).text; // text handles hyperlinks if any
            let logoUrl = row.getCell(3).text;

            processed++;

            if (logoUrl && logoUrl.trim().length > 0) {
                // Already has content, skip? User said "values that have had clearbit removed". 
                // I cleared ALL of them, so this should be empty. 
                // If checking explicitly:
                if (!logoUrl.includes('clearbit')) {
                    // Keep existing non-clearbit logos if any?
                    // But I cleared everything. So just proceed.
                }
            }

            console.log(`[${processed}/${rowCount - 1}] Finding logo for: ${name} (${website})`);

            try {
                // Small delay to be polite
                await new Promise(r => setTimeout(r, 200));

                const result = await findLogoUrl({ name, website });

                if (result.logoUrl) {
                    row.getCell(3).value = result.logoUrl;
                    updated++;
                    console.log(`   -> Found: ${result.logoUrl}`);
                } else {
                    console.log(`   -> No logo found.`);
                }
            } catch (err) {
                console.error(`   -> Error:`, err);
                failed++;
            }

            // Save intermediate progress every 50 rows? No, just save at end.
        }

        await workbook.csv.writeFile(filePath);
        console.log('------------------------------------------------');
        console.log('Enrichment Complete.');
        console.log(`Total Rows: ${rowCount - 1}`);
        console.log(`Updated: ${updated}`);
        console.log(`Failed: ${failed}`);
        console.log('------------------------------------------------');

    } catch (error) {
        console.error('Failed to process CSV:', error);
        process.exit(1);
    }
}

// Check api key
if (!process.env.TAVILY_API_KEY) {
    console.warn("WARNING: TAVILY_API_KEY is not set.");
}

enrichCsv();
