import {
  canFirecrawlScrape,
  firecrawlAuthHeaders,
  firecrawlScrapeUrl,
} from "@shared/firecrawl";
import { joinAiBullets, toAiBullets } from "@shared/aiBullets";
import { xaiBearer } from "@shared/craftYaffle";

export type DeepResearchProfile = {
  companyName: string;
  companyDetails: {
    companyNumber?: string;
    status?: string;
    incorporationDate?: string;
    registeredOffice?: string;
    companyType?: string;
  };
  keyPeople: { name: string; role: string }[];
  businessProfile: string;
  sourceCommentary: string;
  sources: { url: string; title: string }[];
};

type Env = Record<string, string | undefined>;

export function normalizeWebsiteUrl(raw: string): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export function htmlToText(html: string): string {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchWebsiteText(url: string, env: Env = process.env): Promise<string> {
  const target = normalizeWebsiteUrl(url);
  if (!target) return "";

  if (canFirecrawlScrape(env)) {
    try {
      const resp = await fetch(firecrawlScrapeUrl(env), {
        method: "POST",
        headers: firecrawlAuthHeaders(env),
        body: JSON.stringify({ url: target, formats: ["markdown"] }),
        signal: AbortSignal.timeout(15000),
      });
      if (resp.ok) {
        const payload = (await resp.json()) as { data?: { markdown?: string }; markdown?: string };
        const markdown = String(payload?.data?.markdown || payload?.markdown || "").trim();
        if (markdown) return markdown.slice(0, 12000);
      }
    } catch {
      // fall through to a plain fetch
    }
  }

  const resp = await fetch(target, {
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
    headers: { "User-Agent": "Mozilla/5.0 StrataResearch/1.0" },
  });
  if (!resp.ok) throw new Error(`Could not read that website (${resp.status})`);
  return htmlToText(await resp.text()).slice(0, 12000);
}

const GROK_CHAT_URL = "https://api.x.ai/v1/chat/completions";
const GROK_RESEARCH_MODEL = "grok-4.6";

async function grokComplete(prompt: string, env: Env = process.env): Promise<string> {
  const key = xaiBearer(env);
  if (!key) throw new Error("XAI_API_KEY is not configured on the server");
  const model = env.XAI_MODEL?.trim() || GROK_RESEARCH_MODEL;
  const res = await fetch(GROK_CHAT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: "system",
          content: "You are Grok, researching a UK company for a commercial finance broker. Reply with JSON only.",
        },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    throw new Error((await res.text()).slice(0, 400) || `Grok chat failed (${res.status})`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Grok returned an empty response");
  return text;
}

function parseProfileJson(text: string): Record<string, unknown> {
  const cleaned = String(text || "")
    .replace(/^```(?:json)?\s*|\s*```$/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Research did not return a profile");
  }
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}

export async function enrichCompanyProfile(
  companyName: string,
  websiteUrl?: string,
  env: Env = process.env
): Promise<DeepResearchProfile> {
  const site = normalizeWebsiteUrl(websiteUrl || "");
  if (!site) throw new Error("Website URL is required");

  const page = await fetchWebsiteText(site, env);
  if (!page) throw new Error("That website returned no readable content");

  const raw = await grokComplete(
    `Company name: ${companyName}
Website: ${site}
Website text:
${page}

Return JSON only:
{"businessProfile":"4-6 short bullet points, one fact per line, of what the business does, who it serves, and anything relevant to refinance or working capital. No paragraphs.","sourceCommentary":"how reliable this website is as a source","keyPeople":[{"name":"","role":""}],"companyDetails":{"companyType":"","status":"","registeredOffice":""},"sources":[{"url":"","title":""}]}
Only use facts from the website text. Do not invent emails, phone numbers, or extra URLs.`,
    env
  );

  const parsed = parseProfileJson(raw);
  const details =
    parsed.companyDetails && typeof parsed.companyDetails === "object"
      ? (parsed.companyDetails as DeepResearchProfile["companyDetails"])
      : {};
  const keyPeople = Array.isArray(parsed.keyPeople)
    ? parsed.keyPeople
        .filter((person): person is { name?: unknown; role?: unknown } => !!person && typeof person === "object")
        .map((person) => ({ name: String(person.name || "").trim(), role: String(person.role || "").trim() }))
        .filter((person) => person.name)
    : [];
  const sources = Array.isArray(parsed.sources)
    ? parsed.sources
        .filter((source): source is { url?: unknown; title?: unknown } => !!source && typeof source === "object")
        .map((source) => ({ url: String(source.url || "").trim(), title: String(source.title || "").trim() }))
        .filter((source) => source.url)
    : [];
  if (!sources.some((source) => source.url === site)) {
    sources.unshift({ url: site, title: `${companyName} website` });
  }

  return {
    companyName,
    companyDetails: details,
    keyPeople,
    businessProfile:
      joinAiBullets(toAiBullets(String(parsed.businessProfile || "").trim() || page.slice(0, 1500), 6)),
    sourceCommentary:
      String(parsed.sourceCommentary || "").trim() || "Profile built from the company website.",
    sources,
  };
}
