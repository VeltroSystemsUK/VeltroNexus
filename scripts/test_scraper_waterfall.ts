import 'dotenv/config';
import { findEmail } from '../server/Lead Agent/src/scrapers/emailFinder';
import { initDb } from '../server/Lead Agent/src/database/db';

async function main() {
    console.log("Initializing DB for context...");
    initDb();

    const domain = "vantagefinance.com";
    const contactName = "Joe Jones";

    console.log(`\nTesting 3-Stage Scraper for: ${domain} (Contact: ${contactName})`);
    console.log("----------------------------------------------------------------");

    try {
        const result = await findEmail(domain, contactName);
        console.log("\n----------------------------------------------------------------");
        console.log("FINAL RESULT:", result);
    } catch (e) {
        console.error("Scraper Failed:", e);
    }
}

main();
