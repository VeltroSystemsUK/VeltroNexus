import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
const auth = Buffer.from(`${apiKey}:`).toString("base64");
const targetLocation = "Leicester";

async function testLocationParam() {
    console.log(`[Test] Testing ?location=${targetLocation}&company_type=ltd parameter...`);
    const url = `https://api.company-information.service.gov.uk/advanced-search/companies?location=${encodeURIComponent(targetLocation)}&size=50&company_status=active&company_type=ltd`;

    const response = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    if (response.status === 400 || !response.ok) {
        console.log(`❌ FAILED: API returned ${response.status}. Parameter 'postal_code' might not be supported.`);
        return;
    }
    const data = await response.json();
    console.log(`✅ SUCCESS: Received ${data.items?.length || 0} items.`);

    data.items?.slice(0, 5).forEach((item: any, i: number) => {
        console.log(`\n[${i + 1}] ${item.company_name}`);
        console.log(`    Postcode: ${item.registered_office_address?.postal_code}`);
        console.log(`    Address:  ${JSON.stringify(item.registered_office_address)}`);
    });
}

testLocationParam();
