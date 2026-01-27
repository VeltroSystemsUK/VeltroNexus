
import { db } from "../server/firebase";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

// --- Password Hashing (Matched to server/auth.ts) ---
const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
}

async function resetUsers() {
    console.log("Starting user reset...");

    // 1. Delete all existing users
    const usersRef = db.collection("users");
    const snapshot = await usersRef.get();

    if (snapshot.empty) {
        console.log("No existing users found to delete.");
    } else {
        console.log(`Deleting ${snapshot.size} users...`);
        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        console.log("All existing users deleted.");
    }

    // 2. Create Master User
    const email = "admin@veltro.com";
    const password = "adminVeltro2025!" + Math.floor(Math.random() * 1000).toString(); // Secure-ish default
    const hashedPassword = await hashPassword(password);

    const newUserRef = usersRef.doc();
    const newUser = {
        id: newUserRef.id,
        email,
        password: hashedPassword,
        firstName: "Master",
        lastName: "Admin",
        role: "broker", // Default role
        subscriptionTier: "team", // Give them a good tier
        prospectLimit: 1000,
        createdAt: new Date(),
        updatedAt: new Date(),
        prospectsCreatedCount: 0,
        onboardingEnabled: 1,
        verified: true // If applicable
    };

    await newUserRef.set(newUser);

    console.log("\n============================================");
    console.log("SUCCESS: Database Users Reset");
    console.log("--------------------------------------------");
    console.log(`Master Email:    ${email}`);
    console.log(`Master Password: ${password}`);
    console.log("============================================\n");

    process.exit(0);
}

// Handle errors
resetUsers().catch((error) => {
    console.error("FATAL ERROR running reset-users script:", error);
    process.exit(1);
});
