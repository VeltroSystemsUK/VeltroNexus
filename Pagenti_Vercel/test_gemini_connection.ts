
import { GoogleGenAI } from "@google/genai";

const apiKey = "AIzaSyDnPAiz51lOkhhxbBsVtDk91bblHXPvtOw";
const MODEL_TO_TEST = "gemini-2.0-flash";

async function testConnection() {
    console.log(`🧪 Testing Key with Model: ${MODEL_TO_TEST}...`);
    try {
        const ai = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });
        const result = await ai.models.generateContent({
            model: MODEL_TO_TEST,
            contents: [{ parts: [{ text: "Hello" }] }]
        });

        console.log("✅ SUCCESS!");
        console.log("Response:", (result as any).text || "OK");

    } catch (e: any) {
        console.error("❌ FAILED:");
        console.error(e.message || e);
    }
}

testConnection();
