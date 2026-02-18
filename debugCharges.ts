import { databaseBuilderService } from "./server/services/databaseBuilder";
import { storage } from "./server/storage";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

async function testChargeDetection() {
    const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
    if (!apiKey) {
        console.error("API Key missing");
        return;
    }

    const testCompanies = [
        "00048839", // Barclays (Definitely has charges)
        "12345678", // Some random number
        "09641772", // Veltro (probably not, but let's see)
    ];

    const base64Auth = Buffer.from(`${apiKey.trim()}:`).toString("base64");

    console.log("Searching for Manufacturing companies in Leicester...");
    // SIC 25xx is manufacturing of metal products, usually has charges
    const searchUrl = `https://api.company-information.service.gov.uk/advanced-search/companies?location=Leicester&sic_codes=25110&size=50`;
    const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Basic ${base64Auth}` },
    });

    if (!searchRes.ok) {
        console.error("Search failed:", searchRes.status);
        return;
    }

    const searchData = await searchRes.json();
    const items = searchData.items || [];
    console.log(`Scanning ${items.length} companies...`);

    let chargedCount = 0;
    for (const item of items) {
        const num = item.company_number;
        try {
            const profileUrl = `https://api.company-information.service.gov.uk/company/${num}`;
            const profRes = await fetch(profileUrl, {
                headers: { Authorization: `Basic ${base64Auth}` },
            });
            if (profRes.ok) {
                const profData = await profRes.json();
                if (profData.links?.charges || profData.has_charges) {
                    console.log(`  [CHARGED] ${item.company_name} (${num}) - has_charges: ${profData.has_charges}, links.charges: ${!!profData.links?.charges}`);
                    chargedCount++;
                }
            }
        } catch (err) {
            // ignore
        }
    }
    console.log(`\nScan complete. Found ${chargedCount} companies with charges out of ${items.length}`);
}

testChargeDetection();
