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
        const match2 = envContent.match(/VITE_GOOGLE_API_KEY=(.*)/);
        if (match2 && match2[1]) apiKey = match2[1].trim();
    }
} catch (e) {
    console.error("Could not read .env.local");
}

if (!apiKey) {
    console.error("No API Key found");
    process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

async function checkModels() {
    try {
        console.log("Checking via raw fetch...");
        const response = await fetch(url);

        if (response.status !== 200) {
            console.log("Error Status:", response.status);
            const err = await response.text();
            console.log("Error Body:", err);
            return;
        }

        const data = await response.json();

        if (data.models) {
            console.log("Model Count:", data.models.length);
            const modelNames = data.models.map((m: any) => m.name);

            const check = (name: string) => modelNames.some((n: string) => n.includes(name));

            console.log("gemini-3-flash-preview:", check("gemini-3-flash-preview"));
            console.log("gemini-2.0-flash:", check("gemini-2.0-flash"));
            console.log("gemini-1.5-pro:", check("gemini-1.5-pro"));
            console.log("gemini-1.5-flash:", check("gemini-1.5-flash"));
        } else {
            console.log("No 'models' field in response");
        }
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

checkModels();
