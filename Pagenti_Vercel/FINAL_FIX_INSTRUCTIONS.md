/// <reference types="vite/client" />
import { GoogleGenAI } from "@google/genai";
import { AresTrainingManifest, UselessnessReport, AresInterviewQuestion, AresInterviewState, DeploymentReadinessReport } from "../types";

// ... [all existing code remains the same until line 571] ...

/**
 * Extract and structure company DNA from uploaded documents
 */
export const extractCompanyDNA = async (documents: { name: string; content: string }[]): Promise<any> => {
  try {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.VITE_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || "";
    if (!apiKey) throw new Error("Missing API Key");
    const ai = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });

    const combinedContent = documents.map(doc => `[${doc.name}]\n${doc.content}`).join('\n\n');

    const prompt = `
        Extract key company information from these documents and structure it as JSON.
        
        DOCUMENTS:
        ${combinedContent}
        
        Extract:
        - Company name
        - Products/services
        - Pricing information
        - Contact details
        - Tools/systems mentioned
        - Brand tone/voice
        - Key procedures or workflows
        
        Return ONLY valid JSON starting with { and ending with }.
        
        {
          "companyName": "string",
          "products": ["string"],
          "pricing": "string or object",
          "contact": { "email": "string", "phone": "string" },
          "tools": ["string"],
          "brandVoice": "string",
          "workflows": ["string"]
        }
        `;

    const result = await withRetry(() => ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ parts: [{ text: prompt }] }]
    }));

    const responseText = (result as any).text || "{}";
    return cleanAndParseJSON(responseText);
  } catch (e) {
    console.error("Company DNA extraction failed:", e);
    return {
      companyName: "Unknown",
      products: [],
      pricing: "Not specified",
      contact: {},
      tools: [],
      brandVoice: "Professional",
      workflows: []
    };
  }
};
