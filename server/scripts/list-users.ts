import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";

dotenv.config();

const projectId = process.env.GOOGLE_CLOUD_PROJECT || "veltro-prod";

async function check() {
    try {
        admin.initializeApp({ projectId });
        const db = getFirestore('veltrodb');

        console.log("Fetching users...");
        const snapshot = await db.collection("users").get();
        console.log(`Found ${snapshot.size} users.`);
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`- ID: ${doc.id}, Email/Username: ${data.username || data.email}, Role: ${data.role}`);
        });

    } catch (e: any) {
        console.error("Error:", e.message);
    }
}

check();
