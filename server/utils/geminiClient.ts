import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export const DEFAULT_GEMINI_MODEL = "claude-opus-4-1"; // Using Claude Opus for compatibility

export async function generateText(prompt: string, model = DEFAULT_GEMINI_MODEL, systemInstruction?: string): Promise<string> {
  const client = getClient();

  try {
    // Map legacy Gemini model names to Claude equivalents
    const claudeModel = model.includes("gemini") ? "claude-opus-4-1" : model;

    const fullPrompt = systemInstruction
      ? `[SYSTEM INSTRUCTION]\n${systemInstruction}\n\n[USER REQUEST]\n${prompt}`
      : prompt;

    const response = await client.messages.create({
      model: claudeModel,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: fullPrompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === "text") {
      return content.text.trim();
    }
    return "";
  } catch (error: any) {
    console.error(`Claude API Error (${model}):`, error.message || error);
    throw error;
  }
}

export async function groundedSearch(query: string): Promise<string> {
  const client = getClient();

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-1",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Search and provide information about: ${query}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === "text") {
      return content.text.trim();
    }
    return "";
  } catch (error: any) {
    console.error("Claude Search Error:", error.message || error);
    throw error;
  }
}

// Additional helper functions - all now Anthropic-based
export async function calculateRiskGrade(data: any): Promise<string> {
  const prompt = `Analyze this company data and provide a risk grade (A-F): ${JSON.stringify(data)}`;
  try {
    return await generateText(prompt);
  } catch {
    return "D"; // Default to moderate risk if API unavailable
  }
}

export async function researchCompany(companyName: string): Promise<string> {
  const prompt = `Research and provide information about the company: ${companyName}`;
  try {
    return await generateText(prompt);
  } catch {
    return `Research unavailable for ${companyName}`;
  }
}

export async function searchCompanyInfo(companyName: string): Promise<string> {
  return researchCompany(companyName);
}

export async function searchAdverseMedia(query: string): Promise<string> {
  const prompt = `Search for adverse media information about: ${query}`;
  try {
    return await generateText(prompt);
  } catch {
    return `No adverse media search available for: ${query}`;
  }
}

export async function repairJson(jsonString: string): Promise<any> {
  try {
    return JSON.parse(jsonString);
  } catch {
    const prompt = `Fix this invalid JSON and return only valid JSON: ${jsonString}`;
    try {
      const fixed = await generateText(prompt);
      return JSON.parse(fixed);
    } catch {
      return {};
    }
  }
}

export async function analyzeFinancials(data: any): Promise<string> {
  const prompt = `Analyze these financial statements and provide insights: ${JSON.stringify(data)}`;
  try {
    return await generateText(prompt);
  } catch {
    return "Financial analysis unavailable";
  }
}

export async function analyzeFinancialsFromPdf(pdfData: any): Promise<string> {
  return analyzeFinancials(pdfData);
}

export async function analyzeAuditedAccounts(data: any): Promise<string> {
  const prompt = `Analyze these audited accounts and provide insights: ${JSON.stringify(data)}`;
  try {
    return await generateText(prompt);
  } catch {
    return "Audit analysis unavailable";
  }
}

export async function analyzeManagementAccounts(data: any): Promise<string> {
  const prompt = `Analyze these management accounts and provide insights: ${JSON.stringify(data)}`;
  try {
    return await generateText(prompt);
  } catch {
    return "Management account analysis unavailable";
  }
}

export async function generateSwotAnalysis(companyData: any): Promise<string> {
  const prompt = `Generate a SWOT analysis for this company: ${JSON.stringify(companyData)}`;
  try {
    return await generateText(prompt);
  } catch {
    return "SWOT analysis unavailable";
  }
}

export async function generateCampariSection(data: any): Promise<string> {
  const prompt = `Generate a comparative analysis (Campari) section based on: ${JSON.stringify(data)}`;
  try {
    return await generateText(prompt);
  } catch {
    return "Comparative analysis unavailable";
  }
}

// Stub for backward compatibility - maintains old API
export const ai = {
  models: {
    generateContent: async (params: any) => {
      const prompt = params.contents[0]?.parts[0]?.text || "";
      const text = await generateText(prompt, params.model);
      return { text };
    },
  },
};
