
import { generateText } from "../server/utils/geminiClient";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars from root
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function test() {
    console.log("Testing Gemini Connection...");
    console.log("Model: gemini-1.5-flash-latest");

    if (!process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
        console.error("❌ AI_INTEGRATIONS_GEMINI_API_KEY is not set in .env");
        return;
    }

    try {
        const result = await generateText("Hello, are you working? Reply with 'Yes, I am functional.'");
        console.log("✅ Response received:");
        console.log(result);
    } catch (error: any) {
        console.error("❌ Test Failed:", error.message);
        if (error.response) {
            console.error("Status:", error.status);
            console.error("Details:", JSON.stringify(error.response, null, 2));
        }
    }
}

test();
