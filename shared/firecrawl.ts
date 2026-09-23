export const FIRECRAWL_CLOUD = "https://api.firecrawl.dev";

type Env = Record<string, string | undefined>;

export function firecrawlApiBase(env: Env = process.env): string {
  return String(env.FIRECRAWL_API_URL || FIRECRAWL_CLOUD).replace(/\/$/, "");
}

export function firecrawlScrapeUrl(env: Env = process.env): string {
  return `${firecrawlApiBase(env)}/v2/scrape`;
}

export function firecrawlSearchUrl(env: Env = process.env): string {
  return `${firecrawlApiBase(env)}/v2/search`;
}

export function canFirecrawlScrape(env: Env = process.env): boolean {
  return Boolean(env.FIRECRAWL_API_URL?.trim());
}

export function firecrawlAuthHeaders(env: Env = process.env): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = env.FIRECRAWL_API_KEY?.trim();
  if (key) headers.Authorization = `Bearer ${key}`;
  return headers;
}

export type FirecrawlSearchHit = {
  url?: string;
  title?: string;
  description?: string;
  markdown?: string;
};

export function parseFirecrawlSearchHits(payload: unknown): FirecrawlSearchHit[] {
  if (!payload || typeof payload !== "object") return [];
  const body = payload as { data?: unknown; web?: unknown };
  if (Array.isArray(body.data)) return body.data as FirecrawlSearchHit[];
  if (body.data && typeof body.data === "object" && Array.isArray((body.data as { web?: unknown }).web)) {
    return (body.data as { web: FirecrawlSearchHit[] }).web;
  }
  if (Array.isArray(body.web)) return body.web as FirecrawlSearchHit[];
  return [];
}
