import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

// Initialize Firebase Admin SDK
// This automatically uses Application Default Credentials (ADC)
// - Locally: Uses your user credentials from `gcloud auth application-default login`
// - Cloud Run: Uses the default service account
if (!admin.apps.length) {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;

    if (!projectId) {
        console.error("FATAL: No Google Cloud Project ID found in environment");
        console.error("Please set GOOGLE_CLOUD_PROJECT in your .env file");
        process.exit(1);
    }

    console.log(`[Firebase] Initializing with project: ${projectId}`);

    admin.initializeApp({
        projectId: projectId,
        storageBucket: `${projectId}.firebasestorage.app`,
    });
}

export const db = getFirestore('veltrodb');
db.settings({
    ignoreUndefinedProperties: true,
});

export const auth = getAuth();
export const bucket = getStorage().bucket();

console.log("[Firebase] Firestore (veltrodb), Auth, and Storage initialized successfully");
