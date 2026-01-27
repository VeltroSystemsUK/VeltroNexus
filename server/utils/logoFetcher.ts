import { TavilyResult } from "./tavilyClient";

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

    // Strategy 2: Tavily Search (Fallback if no website or failed)
    if (name) {
        try {
            const apiKey = process.env.TAVILY_API_KEY;
            if (!apiKey) throw new Error("TAVILY_API_KEY missing");

            const query = `"${name}" company logo square transparent`;

            const response = await fetch(TAVILY_API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    api_key: apiKey,
                    query: query,
                    search_depth: "basic",
                    include_images: true, // Request images
                    max_results: 3
                }),
            });

            if (!response.ok) throw new Error(`Tavily API error: ${response.status}`);

            const data = await response.json();
            const images = data.images || []; // Tavily returns 'images' array if include_images: true

            if (images.length > 0 && typeof images[0] === 'string') {
                return { logoUrl: images[0], source: 'tavily' };
            }

            // Fallback: Check results for image-like URLs if 'images' array is empty (legacy API behavior check)
            const results: TavilyResult[] = data.results || [];
            for (const result of results) {
                // Naive check for image in content/url
                if (result.url.match(/\.(png|jpg|jpeg|svg|webp)$/i)) {
                    return { logoUrl: result.url, source: 'tavily' };
                }
            }

        } catch (error) {
            console.error(`[LogoFetcher] Tavily search failed for ${name}:`, error);
        }
    }

    return { logoUrl: null, source: null };
}
