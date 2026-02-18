

const TAVILY_API_URL = "https://api.tavily.com/search";

interface LogoSearchResult {
    logoUrl: string | null;
    source: 'google' | 'tavily' | null;
}

export async function findLogoUrl(searchParams: { website?: string; name?: string }): Promise<LogoSearchResult> {
    const { website, name } = searchParams;

    // Strategy 1: Google Favicon (Best if website is known)
    if (website) {
        try {
            const domain = new URL(website.startsWith('http') ? website : `https://${website}`).hostname;
            const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

            // Verify the image exists and is big enough (Google sometimes returns a default globe icon)
            // For now, we trust Google returns *something* valid. 
            // To connect to a robust production system, we might HEAD check content-length.
            // But for this MVP, we return it as a high-confidence candidate.

            return { logoUrl: googleFaviconUrl, source: 'google' };
        } catch (e) {
            console.warn(`[LogoFetcher] Failed to parse domain from ${website}`);
        }
    }

    // Strategy 2: Gemini Search (Fallback if no website or failed)
    if (name) {
        try {
            const query = `"${name}" company logo square transparent image URL`;
            const prompt = `Find a high-quality square logo image URL for the UK company "${name}".
            Return JSON: { "logoUrl": "string" }`;

            const { ai, DEFAULT_GEMINI_MODEL } = await import("./geminiClient");
            const response = await ai.models.generateContent({
                model: "gemini-2.0-flash",
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: {
                    tools: [{ googleSearch: {} }],
                    responseMimeType: "application/json",
                }
            } as any);

            const text = response.text?.trim() || "{}";
            const data = JSON.parse(text);

            if (data.logoUrl) {
                return { logoUrl: data.logoUrl, source: 'tavily' as any }; // Keep source name or change to gemini
            }
        } catch (error) {
            console.error(`[LogoFetcher] Gemini logo search failed for ${name}:`, error);
        }
    }

    return { logoUrl: null, source: null };
}
