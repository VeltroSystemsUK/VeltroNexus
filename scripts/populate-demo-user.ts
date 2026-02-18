import { storage } from "../server/storage";
import { hashPassword } from "../server/auth";
import { db } from "../server/firebase";

async function populateDemo() {
    console.log("🚀 Starting Demo User Seeding...");

    const demoEmail = "demo@veltro.co.uk";
    const demoPassword = "demo123";

    try {
        // 1. Create or Find User
        let user = await storage.getUserByEmail(demoEmail);
        const hashedPassword = await hashPassword(demoPassword);

        if (user) {
            console.log(`[User] Found existing user: ${demoEmail}. Resetting data...`);
            // Cleanup existing data to ensure a fresh demo state
            await cleanupUserData(user.id);
            await storage.updateUser(user.id, {
                password: hashedPassword,
                firstName: "Demo",
                lastName: "Account",
                role: "broker",
                subscriptionTier: "team",
                prospectLimit: 100,
                hasUnderwritingAccess: 1
            });
        } else {
            console.log(`[User] Creating new user: ${demoEmail}`);
            user = await storage.createUser({
                email: demoEmail,
                password: hashedPassword,
                firstName: "Demo",
                lastName: "Account",
                role: "broker",
                subscriptionTier: "team",
                prospectLimit: 100,
                hasUnderwritingAccess: 1,
                trialTier: "team",
                trialEndsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365) // 1 year trial
            });
        }

        const userId = user.id;

        // 2. Mock Companies
        const mockCompanies = [
            { name: "Starlight Logistics Ltd", number: "12345678", address: "12 High St, London, EC1A 1AA", type: "ltd" },
            { name: "Green Horizon Energy", number: "87654321", address: "45 Solar Way, Bristol, BS1 1AB", type: "ltd" },
            { name: "TechFlow Solutions", number: "11223344", address: "8 Tech Park, Manchester, M1 1DE", type: "ltd" },
            { name: "The Rusty Anchor Pub", number: "55667788", address: "3 Harbour Rd, Plymouth, PL1 1GH", type: "pub" },
            { name: "Precision Manufacturing", number: "99001122", address: "1 Steel St, Birmingham, B1 1IJ", type: "ltd" }
        ];

        const companyRecords = [];
        for (const c of mockCompanies) {
            const existing = await storage.getCompanyByNumber(c.number);
            if (existing) {
                companyRecords.push(existing);
            } else {
                const created = await storage.createCompany({
                    companyName: c.name,
                    companyNumber: c.number,
                    registeredAddress: c.address,
                    companyType: c.type,
                    companyStatus: "active",
                    incorporationDate: "2018-05-15"
                });
                companyRecords.push(created);
            }
        }

        // 3. Mock Prospects
        const mockProspects = [
            { companyIndex: 0, stage: "submitted", loanAmount: 250000, term: 36, interestRate: "8.5%", priority: "high", background: "Funding for fleet expansion (3 new EV vans)." },
            { companyIndex: 1, stage: "underwriting", loanAmount: 500000, term: 60, interestRate: "7.2%", priority: "medium", background: "Working capital for new solar farm installation in Devon." },
            { companyIndex: 2, stage: "pre-qualified", loanAmount: 75000, term: 24, interestRate: "9.0%", priority: "low", background: "Software license renewals and hardware upgrades." },
            { companyIndex: 3, stage: "lead", loanAmount: 30000, term: 12, interestRate: "12.5%", priority: "medium", background: "Refurbishment of outdoor seating area for summer season." },
            { companyIndex: 4, stage: "approved", loanAmount: 120000, term: 48, interestRate: "6.8%", priority: "high", background: "New CNC machine purchase to increase production capacity." }
        ];

        for (const p of mockProspects) {
            const company = companyRecords[p.companyIndex];
            const prospect = await storage.createProspect({
                companyId: company.id!,
                stage: p.stage,
                loanAmount: p.loanAmount,
                term: p.term,
                interestRate: p.interestRate,
                priority: p.priority,
                background: p.background,
                notes: "Automated demo data."
            }, userId);

            // 4. Mock Activities
            await storage.createActivity({
                prospectId: prospect.id!,
                title: "Review Application Documents",
                description: "Checking company accounts and VAT returns for the last 2 years.",
                activityType: "task",
                priority: "medium",
                dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
                completed: 0
            }, userId);

            if (p.stage === "submitted" || p.stage === "approved") {
                await storage.createActivity({
                    prospectId: prospect.id!,
                    title: "Follow up with Lender",
                    description: "Confirm receipt of additional information requested by underwriter.",
                    activityType: "call",
                    priority: "high",
                    dueDate: new Date(),
                    completed: 1
                }, userId);
            }

            // 5. Mock Due Diligence (Selective)
            if (p.stage === "underwriting" || p.stage === "submitted" || p.stage === "approved") {
                await storage.upsertDueDiligence(prospect.id!, userId, {
                    checklist: [
                        { sectionId: "ID", itemId: "DIR_ID", description: "Director ID verified", completed: true, notes: "Verified via Jumio" },
                        { sectionId: "Financial", itemId: "VAT_RTN", description: "Last 3 VAT returns", completed: true, notes: "All filed on time" }
                    ],
                    underwriting: {
                        riskGrade: p.stage === "approved" ? "A" : "B",
                        financialAnalysis: {
                            summary: "Solid cash flow with consistent growth. Strong DSCR of 1.8x. No adverse history detected.",
                            averageMonthlyRevenue: p.loanAmount / 4,
                            riskScore: "A"
                        }
                    }
                });
            }
        }

        console.log(`\n✅ Seeding Complete for ${demoEmail}!`);
        console.log(`📧 Email: ${demoEmail}`);
        console.log(`🔑 Password: ${demoPassword}\n`);

    } catch (err) {
        console.error("❌ Seeding failed:", err);
    }
}

async function cleanupUserData(userId: string) {
    console.log(`[Cleanup] Removing existing data for user ${userId}...`);

    const collections = ["prospects", "activities", "due_diligence", "contacts", "prospect_documents"];
    for (const collName of collections) {
        const snap = await db.collection(collName).where("userId", "==", userId).get();
        const batch = db.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        if (snap.size > 0) console.log(`[Cleanup] Deleted ${snap.size} documents from ${collName}`);
    }
}

populateDemo();
