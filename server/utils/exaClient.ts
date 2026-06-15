import { groundedSearch } from "./geminiClient";

export async function searchExa(query: string, limit = 5, includeText = true): Promise<Array<{ title: string; url: string; text?: string; summary?: string }>> {
  try {
    const result = await groundedSearch(query, limit);
    const summaryText = result.bulletPoints.join("\n");
    return result.sources.map(s => ({
      title: s.title || "Web Search Result",
      url: s.url,
      text: summaryText,
      summary: summaryText
    }));
  } catch (error) {
    console.error("[Exa Mock] Grounded search failed:", error);
    return [];
  }
}
