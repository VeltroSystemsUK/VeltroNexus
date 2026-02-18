
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Manually load .env
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf-8");
    envConfig.split("\n").forEach((line) => {
        const [key, value] = line.split("=");
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
}

async function wipeLenders() {
    // Dynamic import to ensure env vars are loaded first
    const { storage } = await import("../server/storage");
    const { db } = await import("../server/firebase");

    console.log("Starting Lender Wipe Process...");

    // We need to delete all lenders. 
    // storage.listLenders gets us the list. 
    // We might need to handle pagination if there were thousands, but for ~300 it's fine.

    let targetUserId = "migration-script";
    try {
        const users = await storage.getAllUsers();
        if (users.length > 0) targetUserId = users[0].id; // Likely an admin
    } catch (e) { }

    // Direct wipe of the entire collection to ensure everything is gone
    const lendersSnap = await db.collection("lenders").get();
    console.log(`Found ${lendersSnap.size} lender documents to delete.`);

    let deletedCount = 0;
    const batchSize = 100;
    const chunks = [];
    const docs = lendersSnap.docs;

    for (let i = 0; i < docs.length; i += batchSize) {
        chunks.push(docs.slice(i, i + batchSize));
    }

    for (const chunk of chunks) {
        const batch = db.batch();
        chunk.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        deletedCount += chunk.length;
        console.log(`Deleted ${deletedCount} / ${lendersSnap.size} lenders`);
    }

    // Also wipe lender_products if any exist
    const productsSnap = await db.collection("lender_products").get();
    if (!productsSnap.empty) {
        console.log(`Found ${productsSnap.size} lender products to delete.`);
        const productChunks = [];
        const pDocs = productsSnap.docs;
        for (let i = 0; i < pDocs.length; i += batchSize) {
            productChunks.push(pDocs.slice(i, i + batchSize));
        }
        for (const chunk of productChunks) {
            const batch = db.batch();
            chunk.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
        console.log("Deleted all lender_products.");
    }

    console.log("\n--------------------------");
    console.log(`Wipe Complete.`);
    console.log(`Records Deleted: ${deletedCount}`);
    console.log("--------------------------");
}

wipeLenders().catch(console.error);
