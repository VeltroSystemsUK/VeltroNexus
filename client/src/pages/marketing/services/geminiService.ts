
import { apiRequest } from "@/lib/queryClient";
import { SocialProfile } from "../types";

export const gemini = {
    analyzeCompanyData: async (companyName: string, sicCodes: string[]): Promise<string> => {
        try {
            const res = await apiRequest("/api/marketing/generate", "POST", {
                type: "company-analysis",
                params: { companyName, sicCodes }
            });
            const data = await res.json();
            return data.text;
        } catch (error) {
            console.error("AI Analysis failed", error);
            return "Unable to generate AI analysis at this time.";
        }
    },

    searchSocialProfiles: async (companyName: string): Promise<SocialProfile[]> => {
        try {
            const res = await apiRequest("/api/marketing/search-social", "POST", { companyName });
            const data = await res.json();
            return data.profiles || [];
        } catch (error) {
            console.error("Social search failed", error);
            return [];
        }
    },

    generateEmailDraft: async (params: { topic: string; companyName: string; contactName: string; tone: string }): Promise<string> => {
        try {
            const res = await apiRequest("/api/marketing/generate", "POST", {
                type: "email-draft",
                params
            });
            const data = await res.json();
            return data.text;
        } catch (error) {
            console.error("AI Email generation failed", error);
            return "Failed to generate AI draft.";
        }
    }
};
