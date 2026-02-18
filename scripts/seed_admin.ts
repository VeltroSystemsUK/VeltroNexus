import { db } from "../server/firebase";
import { scryptAsync } from "@noble/hashes/scrypt";
import { randomBytes } from "crypto";
import { promisify } from "util";

async function hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, { N: 16384, r: 8, p: 1, dkLen: 64 })) as Uint8Array;
    return `${buf.toString("hex")}.${salt}`;
}

const ADMIN_USER = {
    id: "dev-admin-id", // Matching the ID from storage.ts
    email: "admin@veltro.com",
    role: "super_admin",
    firstName: "Dev",
    lastName: "Admin",
    subscriptionTier: "lender",
    prospectLimit: 1000000,
    hasUnderwritingAccess: 1,
    onboardingEnabled: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    suspended: false,
    // Required fields
    brandingLogoUrl: null,
    brandingPrimaryColor: null,
    brandingAccentColor: null,
    brandingBackgroundColor: null,
    brandingSidebarColor: null,
    gocardlessCustomerId: null,
    gocardlessMandateId: null,
    gocardlessSubscriptionId: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    trialEndsAt: null,
    trialTier: null,
    currency: "GBP",
    timezone: "Europe/London",
    quotaUsed: 0,
    lastLoginAt: new Date(),
    emailVerified: true
};

async function seedAdmin() {
    try {
        console.log("Seeding Super Admin user...");

        // Hash password "admin123"
        const hashedPassword = await hashPassword("admin123");

        const userWithAuth = {
            ...ADMIN_USER,
            password: hashedPassword
        };

        const userRef = db.collection("users").doc(ADMIN_USER.id);
        await userRef.set(userWithAuth);

        console.log("----------------------------------------");
        console.log("✅ Super Admin user created successfully!");
        console.log("Email: admin@veltro.com");
        console.log("Password: admin123");
        console.log("----------------------------------------");

        process.exit(0);
    } catch (error) {
        console.error("Error seeding admin:", error);
        process.exit(1);
    }
}

seedAdmin();
