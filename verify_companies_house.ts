import 'dotenv/config';
import fetch from 'node-fetch';

const API_KEY = process.env['COMPANIES_HOUSE_API_KEY'];

if (!API_KEY) {
    console.error("❌ No COMPANIES_HOUSE_API_KEY found in environment");
    process.exit(1);
}

const BASE_URL = 'https://api.company-information.service.gov.uk';

async function searchCompany(name: string) {
    console.log(`Searching Companies House for: "${name}"...`);

    try {
        const encodedKey = Buffer.from(API_KEY + ':').toString('base64');
        const headers = { 'Authorization': `Basic ${encodedKey}` };

        // 1. Search for company
        const searchRes = await fetch(`${BASE_URL}/search/companies?q=${encodeURIComponent(name)}`, { headers });
        if (!searchRes.ok) throw new Error(`Search failed: ${searchRes.statusText}`);

        const searchData = await searchRes.json();
        if (!searchData.items || searchData.items.length === 0) {
            console.log("No company found.");
            return;
        }

        const company = searchData.items[0];
        console.log(`Found: ${company.title} (${company.company_number})`);

        // 2. Get Officers
        const officersRes = await fetch(`${BASE_URL}/company/${company.company_number}/officers`, { headers });
        if (!officersRes.ok) throw new Error(`Officers fetch failed: ${officersRes.statusText}`);

        const officersData = await officersRes.json();
        console.log(`Found ${officersData.items?.length || 0} officers.`);

        if (officersData.items) {
            const activeDirectors = officersData.items.filter((o: any) => !o.resigned_on && o.officer_role === 'director');
            console.log(`Active Directors: ${activeDirectors.length}`);
            activeDirectors.slice(0, 3).forEach((d: any) => {
                console.log(`- ${d.name} (${d.occupation})`);
            });
        }

    } catch (error) {
        console.error("❌ Error:", error);
    }
}

searchCompany("VELTRO LTD"); // Should find us
