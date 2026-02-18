import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";

dotenv.config();

const projectId = process.env.GOOGLE_CLOUD_PROJECT || "veltro-prod";

async function check() {
    try {
        console.log(`Testing Firestore initialization for project: ${projectId}`);
        admin.initializeApp({ projectId });

        const dbDefault = getFirestore();
        console.log("Checking (default) database...");
        try {
            const collectionsDefault = await dbDefault.listCollections();
            console.log(`(default) database connected. Collections: ${collectionsDefault.map(c => c.id).join(", ")}`);
        } catch (e: any) {
            console.log(`(default) database check failed: ${e.message}`);
        }

        const dbVeltro = getFirestore('veltrodb');
        console.log("Checking 'veltrodb' database...");
        try {
            const collectionsVeltro = await dbVeltro.listCollections();
            console.log(`'veltrodb' database connected. Collections: ${collectionsVeltro.map(c => c.id).join(", ")}`);
        } catch (e: any) {
            console.log(`'veltrodb' database check failed: ${e.message}`);
        }

    } catch (e: any) {
        console.error("FATAL Firestore Error:", e.message);
    }
}

check();
