import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";

dotenv.config();

const projectId = process.env.GOOGLE_CLOUD_PROJECT || "veltro-prod";

async function check() {
    try {
        admin.initializeApp({ projectId });
        const db = getFirestore('veltrodb');

        const id = "Auond2MCDRlSuiOXZQDo";
        console.log(`Fetching user document: ${id}`);
        const doc = await db.collection("users").doc(id).get();
        if (doc.exists) {
            console.log("User data:", JSON.stringify(doc.data(), null, 2));
        } else {
            console.log("User document NOT FOUND");
        }

    } catch (e: any) {
        console.error("Error:", e.message);
    }
}

check();
