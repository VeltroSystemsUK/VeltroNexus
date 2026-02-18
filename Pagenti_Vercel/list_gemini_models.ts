
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.VITE_GOOGLE_API_KEY;

if (!apiKey) {
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });

async function list() {
    try {
        const response = await (ai as any).models.list();
        const models = response.models || [];

        console.log("--- START MODEL LIST ---");
        models.forEach((m: any) => {
            // Just print the name cleanly
            console.log(m.name.replace('models/', ''));
        });
        console.log("--- END MODEL LIST ---");

    } catch (e) {
        console.error("Error", e);
    }
}

list();
