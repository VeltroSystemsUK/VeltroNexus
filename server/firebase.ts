import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// Initialize Firebase Admin SDK
// This automatically uses Application Default Credentials (ADC)
// - Locally: Uses your user credentials from `gcloud auth application-default login`
// - Cloud Run: Uses the default service account
if (!admin.apps.length) {
    admin.initializeApp();
}

export const db = getFirestore();
export const auth = getAuth();
