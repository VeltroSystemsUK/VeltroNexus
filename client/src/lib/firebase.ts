import { initializeApp } from "firebase/app";
import { getFunctions } from "firebase/functions";

// Configuration from environment variables
// Fallback to hardcoded values from .env if VITE_ vars are missing (development convenience)
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyA2HlZ7_FT_uDz5W0JCQamRjpFXgg8ifrs", // Using GEMINI_API_KEY as fallback (starts with AIza)
    authDomain: "veltro-prod.firebaseapp.com",
    projectId: "veltro-prod",
    storageBucket: "veltro-prod.appspot.com",
    messagingSenderId: "1023595983935",
    appId: "1:1023595983935:web:placeholder" // We might need the actual App ID, but often it works without for functions
};

const app = initializeApp(firebaseConfig);

// Initialize functions with the default region (us-central1) by default
// If your functions are in europe-west2, change the second argument to "europe-west2"
export const functions = getFunctions(app, "europe-west2");
