import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.VITE_GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

async function findModels() {
    try {
        const response = await ai.models.list();
        console.log("--- GENERATE CONTENT MODELS ---");

        for await (const m of response) {
            if (m.supportedActions && m.supportedActions.includes("generateContent")) {
                console.log(m.name);
            }
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

findModels();
