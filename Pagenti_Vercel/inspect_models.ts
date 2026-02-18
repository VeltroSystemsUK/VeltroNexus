import { GoogleGenAI } from "@google/genai";

const apiKey = "AIzaSyDnPAiz51lOkhhxbBsVtDk91bblHXPvtOw";
const ai = new GoogleGenAI({ apiKey });

async function inspectResponse() {
    try {
        const response = await ai.models.list();
        console.log("Type:", typeof response);
        console.log("Keys:", Object.keys(response));

        // Check if it has a 'models' property and what type it is
        if (response['models']) {
            console.log("Models property type:", typeof response['models']);
            console.log("Is Array?", Array.isArray(response['models']));
            console.log("Length:", response['models'].length);
            if (response['models'].length > 0) {
                console.log("First model:", JSON.stringify(response['models'][0], null, 2));
            }
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

inspectResponse();
