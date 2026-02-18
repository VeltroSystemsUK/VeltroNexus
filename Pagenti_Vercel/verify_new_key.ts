import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

// Read .env.local manually to get the key
const envPath = path.resolve(process.cwd(), ".env.local");
let apiKey = "";

try {
    const envContent = fs.readFileSync(envPath, "utf-8");
    const match = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);
    if (match && match[1]) {
        apiKey = match[1].trim();
    } else {
        // Try other keys
        const match2 = envContent.match(/VITE_GOOGLE_API_KEY=(.*)/);
        if (match2 && match2[1]) apiKey = match2[1].trim();
    }
} catch (e) {
    console.error("Could not read .env.local");
}

if (!apiKey) {
    console.error("No API Key found in .env.local");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function checkModels() {
    try {
        console.log("Checking models with new key...");
        const response = await ai.models.list();

        const models = Array.isArray(response) ? response : (response.models || []);
        const modelNames = models.map((m: any) => m.name);

        console.log("Found", modelNames.length, "models.");

        // Check for specific high-value models
        const check = (name: string) => modelNames.some((n: string) => n.includes(name));

        console.log("gemini-3-flash-preview:", check("gemini-3-flash-preview"));
        console.log("gemini-2.0-flash:", check("gemini-2.0-flash"));
        console.log("gemini-1.5-pro:", check("gemini-1.5-pro"));
        console.log("gemini-1.5-flash:", check("gemini-1.5-flash"));

    } catch (error: any) {
        console.error("Error with new key:", error.message || error);
    }
}

checkModels();
