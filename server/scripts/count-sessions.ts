import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";

dotenv.config();

const projectId = process.env.GOOGLE_CLOUD_PROJECT || "veltro-prod";

async function check() {
    try {
        admin.initializeApp({ projectId });
        const db = getFirestore('veltrodb');

        console.log("Counting sessions...");
        const snapshot = await db.collection("express-sessions").get();
        console.log(`Found ${snapshot.size} active sessions.`);

        // Show last 5 created/updated sessions
        snapshot.docs.slice(-5).forEach(doc => {
            console.log(`- Session ID: ${doc.id}`);
        });

    } catch (e: any) {
        console.error("Error:", e.message);
    }
}

check();
