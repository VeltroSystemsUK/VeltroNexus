import { xaiBearer } from "@shared/craftYaffle";

const TAVILY_API_URL = "https://api.tavily.com/search";
const GROK_RESPONSES_URL = "https://api.x.ai/v1/responses";
const GROK_SEARCH_MODEL = "grok-4.6";
const GROK_EXCLUDED_DOMAINS = [
  "company-information.service.gov.uk",
  "find-and-update.company-information.service.gov.uk",
  "endole.co.uk",
  "open.endole.co.uk",
  "companycheck.co.uk",
];

const LEGAL_SUFFIXES =
  /\b(limited|ltd\.?|plc|llp|llc|inc\.?|holdings?|group|company|co\.?|uk|cic|cio)\b/gi;

export const REGISTRY_HOSTS = [
  "company-information.service.gov.uk",
  "find-and-update.company-information.service.gov.uk",
  "companieshouse.gov.uk",
  "endole.co.uk",
  "open.endole.co.uk",
  "companycheck.co.uk",
  "duedil.com",
  "opencorporates.com",
  "northdata.com",
  "creditsafe.com",
  "creditgate.com",
  "companynewsevents.co.uk",
  "uk.companydir.com",
  "bymetric.com",
  "rooplex.co.uk",
  "jars.lt",
  "companiesintheuk.co.uk",
  "dnb.com",
  "globaldatabase.com",
  "uk.globaldatabase.com",
  "procurement.co.uk",
];

const NEWS_HOSTS = [
  "bbc.co.uk",
  "bbc.com",
  "theguardian.com",
  "telegraph.co.uk",
  "independent.co.uk",
  "ft.com",
  "reuters.com",
  "sky.com",
  "news.sky.com",
  "dailymail.co.uk",
  "mirror.co.uk",
  "express.co.uk",
  "standard.co.uk",
  "thetimes.co.uk",
  "thisismoney.co.uk",
  "cityam.com",
  "insidermedia.com",
  "business-sale.com",
  "thegazette.co.uk",
  "derbytelegraph.co.uk",
  "nottinghampost.com",
  "leicestermercury.co.uk",
  "birminghammail.co.uk",
  "manchestereveningnews.co.uk",
  "yorkshirepost.co.uk",
  "liverpoolecho.co.uk",
  "chroniclelive.co.uk",
  "walesonline.co.uk",
  "edinburghlive.co.uk",
  "glasgowtimes.co.uk",
];

const ADVERSE_TERMS = [
  "administration",
  "administrator",
  "insolvency",
  "liquidation",
  "wound up",
  "winding up",
  "winding-up",
  "gone bust",
  "collapsed",
  "county court",
  "ccj",
  "fraud",
  "investigation",
  "arson",
  "fire",
  "strike off",
  "struck off",
  "compulsory",
  "receivership",
];

export type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
};

export type RankedWebResult = TavilyResult & {
  url: string;
  title: string;
  content: string;
  score: number;
  kind: "news" | "adverse" | "other";
};

export type CompanyWebSearchQuery = {
  id: string;
  query: string;
  topic: "general" | "news";
  search_depth: "basic" | "advanced";
};

export function tradingNames(legalName: string): string[] {
  const out: string[] = [];
  const add = (value: string) => {
    const trimmed = value.replace(/\s+/g, " ").trim();
    if (trimmed && !out.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) {
      out.push(trimmed);
    }
  };

  add(legalName);
  add(legalName.replace(LEGAL_SUFFIXES, " ").replace(/[()]/g, " "));

  const stripped = out[out.length - 1] || legalName;
  const parts = stripped.split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (first && /[A-Za-z]s$/i.test(first) && !first.includes("'")) {
    add([`${first.slice(0, -1)}'s`, ...parts.slice(1)].join(" "));
  }

  return out;
}

export function localityHint(address?: string | null): string {
  if (!address) return "";
  const withoutPostcode = address.replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, "");
  const parts = withoutPostcode
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.slice(-2).join(" ");
}

export function buildCompanyWebSearchQueries(input: {
  companyName: string;
  companyNumber?: string | null;
  registeredAddress?: string | null;
}): CompanyWebSearchQuery[] {
  const names = tradingNames(input.companyName);
  const quoted = names.map((name) => `"${name}"`).join(" OR ");
  const location = localityHint(input.registeredAddress);
  const loc = location ? ` ${location}` : "";

  const queries: CompanyWebSearchQuery[] = [
    {
      id: "press",
      query: `${quoted}${loc} (news OR BBC OR newspaper OR "local news")`,
      topic: "general",
      search_depth: "advanced",
    },
    {
      id: "adverse",
      query: `${quoted} (administration OR insolvency OR liquidation OR "winding up" OR "county court" OR CCJ OR fire OR fraud OR investigation OR collapse)`,
      topic: "general",
      search_depth: "advanced",
    },
    {
      id: "recent-news",
      query: `${quoted}${loc}`,
      topic: "news",
      search_depth: "advanced",
    },
  ];

  if (input.companyNumber) {
    queries.push({
      id: "company-number",
      query: `"${input.companyNumber}" ${names[0]} (news OR administration OR insolvency)`,
      topic: "general",
      search_depth: "basic",
    });
  }

  return queries;
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function isRegistryHost(host: string): boolean {
  const normalised = host.replace(/^www\./, "").toLowerCase();
  return REGISTRY_HOSTS.some(
    (blocked) => normalised === blocked || normalised.endsWith(`.${blocked}`)
  );
}

export function isNewsHost(host: string): boolean {
  const normalised = host.replace(/^www\./, "").toLowerCase();
  return NEWS_HOSTS.some(
    (news) => normalised === news || normalised.endsWith(`.${news}`)
  );
}

function mentionsAdverse(text: string): boolean {
  const lower = text.toLowerCase();
  return ADVERSE_TERMS.some((term) => lower.includes(term));
}

function resultKind(result: { url: string; title: string; content: string }): RankedWebResult["kind"] {
  const text = `${result.title} ${result.content}`;
  if (mentionsAdverse(text)) return "adverse";
  if (isNewsHost(hostnameOf(result.url))) return "news";
  return "other";
}

function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function mentionsCompany(result: { title: string; content: string; url: string }, names: string[]): boolean {
  const needles = names.map(compact).filter((name) => name.length >= 8);
  if (needles.length === 0) return true;
  const hay = compact(`${result.title} ${result.content} ${result.url}`);
  return needles.some((name) => hay.includes(name));
}

export function canonicalResultUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    let host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "bbc.com") host = "bbc.co.uk";
    parsed.hostname = host;
    parsed.protocol = "https:";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.replace(/\/$/, "");
  }
}

export function rankCompanyWebResults(
  results: TavilyResult[],
  names: string[],
  companyNumber?: string | null
): RankedWebResult[] {
  const seen = new Set<string>();
  const ranked: RankedWebResult[] = [];
  const number = (companyNumber || "").replace(/\s+/g, "").toLowerCase();

  for (const result of results) {
    const url = (result.url || "").trim();
    if (!url) continue;

    const normalised = canonicalResultUrl(url);
    if (seen.has(normalised)) continue;
    seen.add(normalised);

    const host = hostnameOf(url);
    if (!host || isRegistryHost(host)) continue;
    if (number && url.toLowerCase().includes(number) && !isNewsHost(host)) continue;

    const title = (result.title || "").trim() || host;
    const content = (result.content || "").trim();
    if (!mentionsCompany({ title, content, url }, names)) continue;

    const text = `${title} ${content}`.toLowerCase();
    let score = Number(result.score) || 0;
    if (isNewsHost(host)) score += 0.35;
    if (mentionsAdverse(text)) score += 0.25;
    score += 0.1;

    ranked.push({
      title,
      url,
      content,
      score,
      kind: resultKind({ url, title, content }),
    });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, 15);
}

async function tavilySearch(
  apiKey: string,
  spec: CompanyWebSearchQuery
): Promise<{ answer: string; results: TavilyResult[] }> {
  const response = await fetch(TAVILY_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query: spec.query,
      topic: spec.topic,
      search_depth: spec.search_depth,
      include_answer: true,
      include_raw_content: false,
      max_results: 8,
      exclude_domains: REGISTRY_HOSTS,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tavily API returned ${response.status}: ${errorText || response.statusText}`);
  }

  const data = (await response.json()) as { answer?: string; results?: TavilyResult[] };
  return { answer: data.answer || "", results: data.results || [] };
}

type Env = Record<string, string | undefined>;

export type CompanyWebSearchResult = {
  answer: string;
  results: RankedWebResult[];
  query: string;
  queries: string[];
};

function citationUrl(entry: unknown): { url: string; title: string; content: string } | null {
  if (typeof entry === "string" && /^https?:\/\//i.test(entry)) {
    return { url: entry, title: hostnameOf(entry) || entry, content: "" };
  }
  if (!entry || typeof entry !== "object") return null;
  const rec = entry as Record<string, unknown>;
  const url = String(rec.url || rec.uri || "").trim();
  if (!/^https?:\/\//i.test(url)) return null;
  return {
    url,
    title: String(rec.title || rec.name || hostnameOf(url) || url).trim(),
    content: String(rec.content || rec.snippet || rec.text || "").trim(),
  };
}

function collectGrokCitations(payload: Record<string, unknown>): TavilyResult[] {
  const found: TavilyResult[] = [];
  const push = (entry: unknown) => {
    const row = citationUrl(entry);
    if (row) found.push(row);
  };
  if (Array.isArray(payload.citations)) payload.citations.forEach(push);
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const content = Array.isArray(rec.content) ? rec.content : [];
    for (const block of content) {
      if (!block || typeof block !== "object") continue;
      const annotations = Array.isArray((block as Record<string, unknown>).annotations)
        ? ((block as Record<string, unknown>).annotations as unknown[])
        : [];
      annotations.forEach(push);
    }
    const action = rec.action && typeof rec.action === "object" ? (rec.action as Record<string, unknown>) : null;
    if (action && Array.isArray(action.sources)) action.sources.forEach(push);
  }
  return found;
}

function grokOutputText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const output = Array.isArray(payload.output) ? payload.output : [];
  const parts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? ((item as Record<string, unknown>).content as unknown[])
      : [];
    for (const block of content) {
      if (!block || typeof block !== "object") continue;
      const text = (block as Record<string, unknown>).text;
      if (typeof text === "string" && text.trim()) parts.push(text.trim());
    }
  }
  return parts.join("\n\n");
}

export function parseGrokWebSearchResponse(payload: unknown): { answer: string; results: TavilyResult[] } {
  const rec = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  return {
    answer: grokOutputText(rec),
    results: collectGrokCitations(rec),
  };
}

export async function grokSearchCompanyWeb(input: {
  companyName: string;
  companyNumber?: string | null;
  registeredAddress?: string | null;
  env?: Env;
}): Promise<CompanyWebSearchResult> {
  const env = input.env || process.env;
  const key = xaiBearer(env);
  if (!key) throw new Error("XAI_API_KEY is not configured on the server");
  const names = tradingNames(input.companyName);
  const location = localityHint(input.registeredAddress);
  const query = [
    `UK company news and adverse media for ${names.join(" / ")}`,
    input.companyNumber ? `company number ${input.companyNumber}` : "",
    location,
    "Exclude Companies House and company-directory listings. Prefer local press, BBC, and insolvency/news coverage.",
  ]
    .filter(Boolean)
    .join(". ");

  const res = await fetch(GROK_RESPONSES_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.XAI_MODEL?.trim() || GROK_SEARCH_MODEL,
      input: [{ role: "user", content: query }],
      tools: [
        {
          type: "web_search",
          filters: { excluded_domains: GROK_EXCLUDED_DOMAINS },
        },
      ],
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) {
    throw new Error((await res.text()).slice(0, 400) || `Grok web search failed (${res.status})`);
  }
  const parsed = parseGrokWebSearchResponse(await res.json());
  const withSnippets = parsed.results.map((row) => ({
    ...row,
    content: `${input.companyName}. ${row.content || parsed.answer.slice(0, 400)}`.trim(),
  }));
  return {
    answer: parsed.answer,
    results: rankCompanyWebResults(withSnippets, names, input.companyNumber),
    query,
    queries: [query],
  };
}

export async function searchCompanyWeb(input: {
  apiKey?: string;
  companyName: string;
  companyNumber?: string | null;
  registeredAddress?: string | null;
  env?: Env;
}): Promise<CompanyWebSearchResult> {
  const env = input.env || process.env;
  let grokError: unknown;
  if (xaiBearer(env)) {
    try {
      return await grokSearchCompanyWeb({
        companyName: input.companyName,
        companyNumber: input.companyNumber,
        registeredAddress: input.registeredAddress,
        env,
      });
    } catch (error) {
      console.warn("[WebSearch] Grok search failed, trying Tavily:", error);
      grokError = error;
    }
  }
  const tavilyKey = input.apiKey?.trim();
  if (!tavilyKey) {
    if (grokError instanceof Error) throw grokError;
    throw new Error("XAI_API_KEY is not configured on the server");
  }
  const names = tradingNames(input.companyName);
  const queries = buildCompanyWebSearchQueries(input);

  const settled = await Promise.allSettled(queries.map((spec) => tavilySearch(tavilyKey, spec)));

  const answers: string[] = [];
  const rawResults: TavilyResult[] = [];
  const errors: string[] = [];

  settled.forEach((item, index) => {
    if (item.status === "fulfilled") {
      if (item.value.answer) answers.push(item.value.answer);
      rawResults.push(...item.value.results);
    } else {
      const reason = item.reason instanceof Error ? item.reason.message : String(item.reason);
      errors.push(`${queries[index].id}: ${reason}`);
      console.error(`Company web search query ${queries[index].id} failed:`, reason);
    }
  });

  if (settled.every((item) => item.status === "rejected")) {
    throw new Error(errors[0] || "Tavily search failed");
  }

  const uniqueAnswers = [...new Set(answers.map((answer) => answer.trim()).filter(Boolean))];

  return {
    answer: uniqueAnswers.join("\n\n"),
    results: rankCompanyWebResults(rawResults, names, input.companyNumber),
    query: queries[0]?.query || input.companyName,
    queries: queries.map((spec) => spec.query),
  };
}
