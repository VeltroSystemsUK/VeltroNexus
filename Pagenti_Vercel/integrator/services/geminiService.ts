
import { GoogleGenAI } from "@google/genai";
import { SocialProfile } from "../types";

// Using corsproxy.io to bypass browser CORS restrictions for external APIs
const PROXY_URL = 'https://corsproxy.io/?';
const EXA_API_KEY = '5f958428-21f8-417d-8692-a16223758362';

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async generateEmailDraft(params: {
    topic: string;
    companyName: string;
    contactName: string;
    tone: 'professional' | 'urgent' | 'helpful';
  }) {
    const prompt = `Write a ${params.tone} B2B marketing email draft for a UK SME loan broker.
    Recipient Name: ${params.contactName}
    Recipient Company: ${params.companyName}
    Topic: ${params.topic}
    Include a professional subject line. Ensure it sounds UK-market specific. 
    Add merge tags like {{firstName}}, {{companyName}} appropriately.
    Do not include the footer as that is auto-generated.`;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      return response.text;
    } catch (error) {
      console.error("Gemini generation error:", error);
      return "Unable to generate draft at this time. Please write manually.";
    }
  }

  async analyzeCompanyData(companyName: string, sicCodes: string[]) {
    const prompt = `Explain the likely business activity and financing needs for a UK company named "${companyName}" with SIC codes: ${sicCodes.join(', ')}. Keep it under 100 words.`;
    
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      return response.text;
    } catch (error) {
      return "Analysis unavailable.";
    }
  }

  async searchSocialProfiles(companyName: string): Promise<SocialProfile[]> {
    if (!EXA_API_KEY) {
      console.warn("Exa API Key is missing.");
      return [];
    }

    try {
      const targetUrl = 'https://api.exa.ai/search';
      
      // Neural search works best with "completion" style queries
      const query = `Here is a list of LinkedIn profiles for the owners, directors, and founders of ${companyName} in the UK:`;
      
      const body = JSON.stringify({
        query: query,
        useAutoprompt: false, // Manual prompt is more reliable for specific entity types
        numResults: 10,
        type: "neural",
        includeDomains: ["linkedin.com"]
      });

      const proxyRequestUrl = `${PROXY_URL}${encodeURIComponent(targetUrl)}`;

      console.log(`Exa: Searching for ${companyName}...`);

      const response = await fetch(proxyRequestUrl, {
        method: 'POST',
        headers: {
          'x-api-key': EXA_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Exa API Error (${response.status}):`, errorText);
        return [];
      }

      const data = await response.json();
      console.log('Exa Data received:', data);
      
      if (!data.results || !Array.isArray(data.results)) {
        console.warn('Exa: No results array found in response.');
        return [];
      }

      // Filter specifically for LinkedIn personal profiles (/in/) to exclude company pages
      const profiles = data.results
        .filter((res: any) => res.url && res.url.includes('linkedin.com/in/'))
        .map((res: any) => ({
          name: (res.title || 'LinkedIn Profile')
            .split(' | ')[0]
            .replace(' - LinkedIn', '')
            .replace(' | LinkedIn', '')
            .replace(/[^a-zA-Z\s]/g, '')
            .trim(),
          url: res.url,
          id: res.id || Math.random().toString(36).substr(2, 9)
        }));

      console.log(`Exa: Found ${profiles.length} profiles.`);
      return profiles;
    } catch (error) {
      console.error("Exa Search Exception:", error);
      return [];
    }
  }
}

export const gemini = new GeminiService();
