import { storage } from "../server/storage";

/**
 * Seed Scraped Lead for Dashboard Testing
 */

async function seed() {
    console.log("Seeding Scraped Lead...");

    try {
        const lead = await storage.createScrapedLead({
            companyName: "Acme Manufacturing Ltd",
            companyNumber: "01234567",
            sicCode: "25110",
            incorporationDate: "2019-05-15",
            score: 85,
            priority: "high",
            recommendedApproach: "Lender Displacement [Iwoca]",
            identifiedLender: "Iwoca",
            chargeDate: new Date("2024-03-10"),
            chargeAmount: 25000,
            cashAtBank: 12500,
            creditorsDue: 45000,
            netAssets: 150000,
            crisisRatio: 3.6,
            status: "new",
            emailDraftId: 1
        });

        console.log("✅ Seeded Lead:", lead);
    } catch (e) {
        console.error("Seeding failed:", e);
    }
}

seed().catch(console.error);
