


const EXA_API_KEY = process.env.EXA_API_KEY;

interface ExaSearchResult {
    title: string;
    url: string;
    id: string;
    score: number;
    publishedDate?: string;
    author?: string;
    text?: string;
    highlights?: string[];
    summary?: string;
}

interface ExaResponse {
    results: ExaSearchResult[];
}

export async function searchExa(query: string, numResults: number = 5, useAutoprompt: boolean = true): Promise<ExaSearchResult[]> {
    if (!EXA_API_KEY) {
        console.warn("EXA_API_KEY is not set. Returning empty results.");
        return [];
    }

    try {
        const response = await fetch('https://api.exa.ai/search', {
            method: 'POST',
            headers: {
                'x-api-key': EXA_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                query: query,
                useAutoprompt: useAutoprompt,
                numResults: numResults,
                contents: {
                    text: true,
                    highlights: true
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Exa API Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json() as ExaResponse;
        return data.results || [];

    } catch (error) {
        console.error("Exa Search Failed:", error);
        throw error;
    }
}
export async function searchExaPeople(query: string, numResults: number = 10): Promise<ExaSearchResult[]> {
    if (!EXA_API_KEY) {
        console.warn("EXA_API_KEY is not set. Returning empty results.");
        return [];
    }

    try {
        console.log(`[Exa People Search] Query: ${query}`);
        const response = await fetch('https://api.exa.ai/search', {
            method: 'POST',
            headers: {
                'x-api-key': EXA_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                query: query,
                category: "people",
                numResults: numResults,
                contents: {
                    text: true,
                    highlights: true
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Exa API Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json() as ExaResponse;
        return data.results || [];

    } catch (error) {
        console.error("Exa People Search Failed:", error);
        return [];
    }
}
