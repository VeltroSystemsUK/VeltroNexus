import { GoogleGenAI } from "@google/genai";

const apiKey = "AIzaSyDnPAiz51lOkhhxbBsVtDk91bblHXPvtOw";
const ai = new GoogleGenAI({ apiKey });

async function listModels() {
    try {
        console.log("Fetching available models...");
        // Using the lower-level API access if possible, or standard list
        const response = await ai.models.list();

        console.log("--- RAW RESPONSE ---");
        // Iterate if it's an async iterable or array
        if (Array.isArray(response)) {
            response.forEach(m => console.log(m.name));
        } else {
            // It might be an object with 'models' property or similar in this SDK version
            console.log(JSON.stringify(response, null, 2));
        }

    } catch (error: any) {
        console.error("CRITICAL ERROR:", error.message || error);
        if (error.statusDetails) {
            console.error("Details:", JSON.stringify(error.statusDetails, null, 2));
        }
    }
}

listModels();
