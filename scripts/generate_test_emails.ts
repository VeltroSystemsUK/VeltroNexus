import { emailOutreach } from "../server/services/emailOutreach";

/**
 * Generate test outreach emails for demonstration
 */

const testProspects = [
    {
        id: "test_1",
        name: "Sarah Mitchell",
        company: "TechFlow Solutions Ltd",
        turnover: "£12.5M",
        sector: "Technology",
        needs: ["Working capital", "Equipment finance"],
    },
    {
        id: "test_2",
        name: "James Robertson",
        company: "Highland Manufacturing Co",
        turnover: "£8.2M",
        sector: "Manufacturing",
        needs: ["Business expansion", "Invoice finance"],
    },
    {
        id: "test_3",
        name: "Emma Williams",
        company: "Green Energy Consultants",
        turnover: "£5.7M",
        sector: "Renewable Energy",
        needs: ["Growth capital", "Property finance"],
    },
];

async function generateTestEmails() {
    console.log("Generating test outreach emails...");

    const userId = "test_user";

    for (const prospect of testProspects) {
        try {
            const email = await emailOutreach.generateOutreachEmail(
                prospect.id,
                {
                    name: prospect.name,
                    company: prospect.company,
                    turnover: prospect.turnover,
                    sector: prospect.sector,
                    needs: prospect.needs,
                },
                userId
            );

            console.log(`✓ Generated email for ${prospect.company}`);
            console.log(`  Subject: ${email.subject}`);
            console.log(`  Preview: ${email.body.substring(0, 100)}...`);
            console.log("");
        } catch (error) {
            console.error(`✗ Failed to generate email for ${prospect.company}:`, error);
        }
    }

    console.log("Test email generation complete!");
}

generateTestEmails().catch(console.error);
