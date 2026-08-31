import Anthropic from "@anthropic-ai/sdk";
import {
  CASEY_FIRECRAWL_QUERIES,
  caseyNotesFromFirecrawlSearch,
  caseyTextModel,
  editorialNotesFromFirecrawlSearch,
  editorialNotesFromTavilySearch,
  formatCaseyNotes,
  MARKET_RESEARCHER_PROMPT,
  parseCaseyBriefs,
  scanWeek,
  STRATA_CASEY_SCOPE,
  type CaseyNote,
  type CaseyTextEngine,
  type CreativeAmmoBrief,
} from "@shared/craftScout";
import { xaiBearer } from "@shared/craftYaffle";

type CaseyAsk = (prompt: string, model?: string, system?: string) => Promise<string>;

function caseyUserPrompt(exclude: string[], today: string, notes: CaseyNote[] = []): string {
  const skip = exclude.length
    ? `Do not repeat these headlines:\n${exclude.map((line) => `- ${line}`).join("\n")}`
    : "Do not reuse last week's headlines.";
  const crawled = formatCaseyNotes(notes);
  const ground = crawled
    ? `Use ONLY these Firecrawl notes for facts and source URLs. If a number is not in the notes, write missing — never invent.\nNOTES:\n${crawled}`
    : "No Firecrawl notes landed. Do not invent a live URL. Mark missing numbers as missing.";
  return `Today is ${today} (UK). ${STRATA_CASEY_SCOPE} Return EXACTLY 7 Creative Ammo Briefs as a JSON array. Alternate borrower and introducer. ${skip}

Each object keys: id, track ("borrower"|"introducer"), headline, source, coreFact, smeImpact, trigger, freshAngle, dataBites (2-3 strings), socialAngle, emailAngle, stockId ("desk"|"paper"|"city"|"hands"|"studio"), imagePrompt.

${ground}

House policy: packager not lender. No rates, APR, guarantees, payday, consumer-credit, or "we lend". If a number is missing, say missing — never invent. JSON array only.`;
}

async function anthropicChat(prompt: string, system: string, model: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY is not configured on the server");
  const client = new Anthropic({ apiKey: key });
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("Anthropic returned an empty response");
  return text;
}

async function xaiChat(prompt: string, system: string, model: string): Promise<string> {
  const key = xaiBearer(process.env);
  if (!key) throw new Error("XAI_API_KEY is not configured on the server");
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error((await res.text()).slice(0, 400) || `xAI chat failed (${res.status})`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("xAI returned an empty response");
  return text;
}

export async function houseAskWithEngine(
  prompt: string,
  model?: string,
  systemInstruction?: string,
): Promise<{ text: string; engine: CaseyTextEngine }> {
  const system = systemInstruction || MARKET_RESEARCHER_PROMPT;
  const errors: string[] = [];
  if (process.env.ANTHROPIC_API_KEY?.trim()) {
    try {
      const engine = caseyTextModel({
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
      });
      const text = await anthropicChat(prompt, system, model?.startsWith("claude-") ? model : engine.model);
      return { text, engine };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (xaiBearer(process.env)) {
    try {
      const engine = caseyTextModel({
        XAI_API_KEY: process.env.XAI_API_KEY,
        XAI_MODEL: process.env.XAI_MODEL,
      });
      const text = await xaiChat(prompt, system, engine.model);
      return { text, engine };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(errors[0] || "Casey needs ANTHROPIC_API_KEY or XAI_API_KEY");
}

export async function houseAsk(
  prompt: string,
  model?: string,
  systemInstruction?: string,
): Promise<string> {
  return (await houseAskWithEngine(prompt, model, systemInstruction)).text;
}

export async function caseyFirecrawlScan(): Promise<CaseyNote[]> {
  const key = process.env.FIRECRAWL_API_KEY?.trim();
  if (!key) return [];
  const notes: CaseyNote[] = [];
  for (const query of CASEY_FIRECRAWL_QUERIES) {
    try {
      const res = await fetch("https://api.firecrawl.dev/v2/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit: 5, sources: ["web"], country: "GB" }),
        signal: AbortSignal.timeout(25000),
      });
      if (!res.ok) continue;
      notes.push(...caseyNotesFromFirecrawlSearch(await res.json()));
    } catch {
      /* skip this query */
    }
  }
  const seen = new Set<string>();
  return notes.filter((note) => {
    if (seen.has(note.url)) return false;
    seen.add(note.url);
    return true;
  }).slice(0, 8);
}

export async function caseyFirecrawlTopicScan(query: string): Promise<CaseyNote[]> {
  const key = process.env.FIRECRAWL_API_KEY?.trim();
  if (!key) return [];
  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit: 8, sources: ["web"], country: "GB" }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`Firecrawl topic scan failed (${res.status})`);
  return editorialNotesFromFirecrawlSearch(await res.json());
}

export async function tavilyTopicScan(query: string): Promise<CaseyNote[]> {
  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key) return [];
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: "basic",
      include_answer: false,
      include_raw_content: false,
      max_results: 8,
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) return [];
  return editorialNotesFromTavilySearch(await res.json());
}

export async function editorialWebScan(query: string): Promise<CaseyNote[]> {
  const fire = await caseyFirecrawlTopicScan(query);
  let extra: CaseyNote[] = [];
  try {
    extra = await tavilyTopicScan(query);
  } catch {
    extra = [];
  }
  return [...fire, ...extra];
}

export async function researchTopic(
  topic: string,
  crawl: (query: string) => Promise<CaseyNote[]> = editorialWebScan,
): Promise<{ notes: CaseyNote[]; warning?: string }> {
  const query = topic.trim();
  if (!query) return { notes: [], warning: "No sources landed" };
  const raw = await crawl(query);
  const seen = new Set<string>();
  const notes: CaseyNote[] = [];
  for (const note of raw) {
    if (!note.url) continue;
    if (seen.has(note.url)) continue;
    seen.add(note.url);
    notes.push(note);
    if (notes.length >= 12) break;
  }
  if (!notes.length) return { notes: [], warning: "No sources landed" };
  return { notes };
}

export async function researchWeek(
  previous: CreativeAmmoBrief[] = [],
  ask: CaseyAsk = houseAsk,
  now: Date = new Date(),
  crawl: () => Promise<CaseyNote[]> = caseyFirecrawlScan,
): Promise<CreativeAmmoBrief[]> {
  const exclude = previous.map((brief) => brief.headline).filter(Boolean);
  try {
    const notes = await crawl();
    const engine = caseyTextModel(process.env);
    const text = await ask(
      caseyUserPrompt(exclude, now.toISOString().slice(0, 10), notes),
      engine.model,
      MARKET_RESEARCHER_PROMPT,
    );
    const live = parseCaseyBriefs(text);
    if (live.length >= 7) return live.slice(0, 7);
    if (live.length > 0) {
      const fill = scanWeek(now.getTime(), [...exclude, ...live.map((brief) => brief.headline)]);
      const seen = new Set(live.map((brief) => brief.id));
      for (const brief of fill) {
        if (live.length >= 7) break;
        if (seen.has(brief.id)) continue;
        live.push(brief);
        seen.add(brief.id);
      }
      return live.slice(0, 7);
    }
  } catch (error) {
    console.warn("[Casey] live scan failed, rotating the library", error);
  }
  return scanWeek(now.getTime(), exclude);
}
