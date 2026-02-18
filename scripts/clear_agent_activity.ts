import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Manual environment setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../.env");

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf-8");
    envConfig.split("\n").forEach((line) => {
        const [key, val] = line.split("=");
        if (key && val) {
            process.env[key.trim()] = val.trim();
        }
    });
}

// Ensure Google Cloud Project ID is set
if (!process.env.GOOGLE_CLOUD_PROJECT) {
    process.env.GOOGLE_CLOUD_PROJECT = "veltro-prod";
}

/**
 * Cleanup Script: Delete All Agent Jobs and Mission Deviations
 * 
 * This script wipes the Firestore collections:
 * - agent_jobs (Live Activity)
 * - mission_deviations (Audit Trail)
 * 
 * Use this to start fresh with clean activity tracking.
 */

async function clearCollection(collectionName: string, db: any) {
    console.log(`\n🗑️  Clearing ${collectionName}...`);

    const snapshot = await db.collection(collectionName).get();

    if (snapshot.empty) {
        console.log(`   No documents found in ${collectionName}`);
        return;
    }

    console.log(`   Found ${snapshot.size} documents to delete`);

    const batch = db.batch();
    snapshot.docs.forEach((doc: any) => {
        batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`   ✅ Deleted ${snapshot.size} documents from ${collectionName}`);
}

async function main() {
    console.log("🧹 Agent Activity Cleanup");
    console.log("========================\n");

    try {
        // Dynamic import so env vars are loaded first
        const { db } = await import("../server/firebase.js");

        // Clear agent jobs (Live Activity)
        await clearCollection("agent_jobs", db);

        // Clear mission deviations (Audit Trail)
        await clearCollection("mission_deviations", db);

        console.log("\n✅ Cleanup complete! All agent activity data has been cleared.");
        console.log("   You can now start fresh with new agent interactions.\n");
    } catch (error) {
        console.error("\n❌ Cleanup failed:", error);
        process.exit(1);
    }

    process.exit(0);
}

main();
