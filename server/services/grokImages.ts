import fs from "fs";
import os from "os";
import path from "path";
import { grokImageRequest, xaiBearer } from "@shared/craftYaffle";

type GrokJob = { buffer: Buffer; mime: string; prompt: string };

const jobs = new Map<string, GrokJob>();

function grokAuthJson(): unknown {
  const home = process.env.USERPROFILE || os.homedir();
  const candidates = [
    process.env.GROK_AUTH_FILE?.trim(),
    path.join(home, ".grok", "auth.json"),
    path.join(os.homedir(), ".grok", "auth.json"),
  ].filter(Boolean) as string[];
  for (const file of [...new Set(candidates)]) {
    try {
      if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      /* try next */
    }
  }
  return undefined;
}

function grokKey(): string | undefined {
  return xaiBearer(process.env, grokAuthJson());
}

export function grokConfigured(): boolean {
  return Boolean(grokKey());
}

export function grokJob(jobId: string): { id: string; state: string; prompt: string } | undefined {
  const job = jobs.get(jobId);
  if (!job) return undefined;
  return { id: jobId, state: "ready", prompt: job.prompt };
}

export function grokFile(jobId: string): GrokJob | undefined {
  return jobs.get(jobId);
}

export async function grokGenerateStill(
  prompt: string,
  presetId?: string,
): Promise<{ id: string; state: "ready"; prompt: string; provider: "grok" }> {
  const key = grokKey();
  if (!key) throw new Error("No xAI credential. Set XAI_API_KEY or sign in to Grok.");
  const body = grokImageRequest(prompt, presetId);
  const res = await fetch("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail.slice(0, 400) || `Grok Images failed (${res.status}).`);
  }
  const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const first = json.data?.[0];
  let buffer: Buffer | null = null;
  let mime = "image/jpeg";
  if (first?.b64_json) {
    buffer = Buffer.from(first.b64_json, "base64");
  } else if (first?.url) {
    const file = await fetch(first.url, { signal: AbortSignal.timeout(30000) });
    if (!file.ok) throw new Error("Grok image URL could not be fetched.");
    mime = file.headers.get("content-type") || mime;
    buffer = Buffer.from(await file.arrayBuffer());
  }
  if (!buffer?.length) throw new Error("Grok Images returned no image.");
  const id = `grok_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  jobs.set(id, { buffer, mime, prompt: body.prompt });
  return { id, state: "ready", prompt: body.prompt, provider: "grok" };
}
