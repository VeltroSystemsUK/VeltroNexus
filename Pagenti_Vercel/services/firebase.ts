import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, query, onSnapshot } from 'firebase/firestore';

// Configuration via Environment Variables
// (You will get these from the Firebase Console)
const firebaseConfig = {
    apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
    authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
// We wrap in a try-catch to allow the app to partially load even if config is missing
let db: any = null;

try {
    if (firebaseConfig.apiKey) {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        console.log("🔥 Firebase initialized successfully");
    } else {
        console.warn("⚠️ Firebase keys missing. Running in OFFLINE mode.");
    }
} catch (e) {
    console.error("Firebase init failed:", e);
}

export { db };

// Helper Types
export const AGENTS_COLLECTION = 'agents';
export const DIRECTIVES_COLLECTION = 'directives_logs';
export const ARES_PROPOSALS_COLLECTION = 'ares_proposals';
export const ARES_LOGS_COLLECTION = 'ares_logs';
export const ARES_ANALYTICS_COLLECTION = 'ares_analytics';
export const ARES_CONFIG_COLLECTION = 'ares_config';
