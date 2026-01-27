
import { storage } from "../server/storage";
import { hashPassword } from "../server/auth";

async function createAdmin() {
    const email = "admin@veltro.com";
    const password = "admin123";

    console.log(`Setting up admin user: ${email}`);

    try {
        let user = await storage.getUserByUsername(email);
        const hashedPassword = await hashPassword(password);

        const adminData = {
            role: "underwriter",
            subscriptionTier: "lender",
            hasUnderwritingAccess: 1,
            prospectLimit: 1000000,
            onboardingEnabled: 0,
            emailVerified: 1,
        } as const;

        if (user) {
            console.log("User exists, updating permissions...");
            await storage.updateUser(user.id, {
                ...adminData,
                password: hashedPassword // Reset password to be sure
            });
            console.log("User updated successfully.");
        } else {
            console.log("User does not exist, creating new admin user...");
            // We need to match InsertUser schema manually or via spreading
            await storage.createUser({
                email,
                password: hashedPassword,
                username: email, // If schema requires username field, but userSchema seems to use email/id. 
                // Wait, getUserByUsername uses 'email' field in FirestoreStorage. And schema has `email`.
                // But let's check input arguments for createUser. It expects InsertUser.

                firstName: "Super",
                lastName: "Admin",

                ...adminData,

                // Defaults that we might need to be explicit about if not using Zod parse here
                theme: "light",
                currency: "GBP",
                timezone: "Europe/London",
                dateFormat: "DD/MM/YYYY",
                aiDataConsent: 0,
                prospectsCreatedCount: 0,
                trialEndsAt: null,
            } as any);
            console.log("User created successfully.");
        }

        console.log("\n============================================");
        console.log("Admin Access Created!");
        console.log(`Email:    ${email}`);
        console.log(`Password: ${password}`);
        console.log("============================================\n");

    } catch (e) {
        console.error("Error creating/updating admin user:", e);
    }
    process.exit(0);
}

createAdmin();
