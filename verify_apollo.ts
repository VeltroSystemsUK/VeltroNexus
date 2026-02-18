import 'dotenv/config';
import fetch from 'node-fetch';

const API_KEY = process.env['APOLLO_API_KEY'];

if (!API_KEY) {
    console.error("❌ No APOLLO_API_KEY found in environment");
    process.exit(1);
}

async function searchApollo() {
    console.log("Testing Apollo API...");
    const domain = "veltro.co.uk"; // Self-test or use a known entity
    const url = "https://api.apollo.io/v1/mixed_people/search";

    const body = {
        q_organization_domains: [domain],
        page: 1,
        per_page: 3,
        person_titles: ["Director", "Founder", "CEO", "Owner", "Partner", "Managing Director"]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'X-Api-Key': API_KEY
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            console.error(`❌ API Error: ${response.status} ${response.statusText}`);
            console.error(await response.text());
            return;
        }

        const data = await response.json();
        console.log("✅ Apollo API Success!");
        console.log(`Found ${data.pagination?.total_entries} contacts for ${domain}`);

        if (data.people && data.people.length > 0) {
            const person = data.people[0];
            console.log("\nSample Contact:");
            console.log(`Name: ${person.first_name} ${person.last_name}`);
            console.log(`Title: ${person.title}`);
            console.log(`Email: ${person.email || "N/A"}`);
            console.log(`Linkedin: ${person.linkedin_url || "N/A"}`);
        } else {
            console.log("No people found with those titles.");
        }

    } catch (error) {
        console.error("❌ Request failed:", error);
    }
}

searchApollo();
