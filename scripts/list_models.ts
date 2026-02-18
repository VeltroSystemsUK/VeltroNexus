import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_API_KEY;

if (!apiKey) {
    console.error("No API key found in environment variables.");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function listModels() {
    console.log("Listing available Gemini models...");
    try {
        const response = await ai.models.list();

        if (Array.isArray(response)) {
            response.forEach((model: any) => {
                // log everything to be sure
                console.log(`- ${model.name} (${model.displayName})`);
            });
        } else {
            console.log("Response:", JSON.stringify(response, null, 2));
        }

    } catch (error: any) {
        console.error("Error listing models:", error.message || error);
    }
}

listModels();
