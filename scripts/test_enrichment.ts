import 'dotenv/config';
import { searchContactInfo } from '../server/utils/tavilyClient';

async function testEnrichment() {
    const companyName = process.argv[2] || "Veltro Limited";
    const companyNumber = process.argv[3] || "13436066"; // Example company number

    console.log(`\n=== Testing Enrichment for: ${companyName} (${companyNumber}) ===`);

    // 1. Test Companies House
    console.log("\n[1] Testing Companies House Charges API...");
    const chApiKey = process.env.COMPANIES_HOUSE_API_KEY;
    if (!chApiKey) {
        console.error("COMPANIES_HOUSE_API_KEY is missing!");
    } else {
        try {
            const base64Auth = Buffer.from(`${chApiKey.trim()}:`).toString("base64");
            const url = `https://api.company-information.service.gov.uk/company/${companyNumber}/charges`;
            const chResponse = await fetch(url, {
                headers: { Authorization: `Basic ${base64Auth}` },
            });

            if (chResponse.ok) {
                const data: any = await chResponse.json();
                const charges = data.items || [];
                console.log(`Found ${charges.length} total charges.`);

                const active = charges.filter((c: any) => c.status !== 'satisfied' && c.status !== 'fully-satisfied');
                console.log(`Found ${active.length} active (unsatisfied) charges.`);

                if (active.length > 0) {
                    const latest = active[0];
                    const lenders = latest.persons_entitled?.map((p: any) => p.name).join(", ");
                    console.log(`Latest Active Charge Holder: ${lenders || "None"}`);
                    console.log(`Created On: ${latest.created_on}`);
                }
            } else {
                console.error(`Companies House error: ${chResponse.status} - ${await chResponse.text()}`);
            }
        } catch (e) {
            console.error("Companies House test failed:", e);
        }
    }

    // 2. Test Tavily Search
    console.log("\n[2] Testing Tavily Contact Search...");
    const tavilyKey = process.env.TAVILY_API_KEY;
    if (!tavilyKey) {
        console.error("TAVILY_API_KEY is missing!");
    } else {
        try {
            console.log(`Searching Tavily for contacts at ${companyName}...`);
            const enrichment = await searchContactInfo(companyName, companyName);
            console.log(`Found ${enrichment.emails.length} emails, ${enrichment.phones.length} phones, and ${enrichment.linkedinUrls.length} LinkedIn URLs.`);

            if (enrichment.linkedinUrls.length > 0) {
                console.log("LinkedIn Profiles found:");
                enrichment.linkedinUrls.slice(0, 5).forEach(url => console.log(`- ${url}`));
            }
        } catch (e) {
            console.error("Tavily Search test failed:", e);
        }
    }

    console.log("\n=== Test Complete ===\n");
}

testEnrichment().catch(console.error);
