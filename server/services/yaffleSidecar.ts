import { YAFFLE_DEFAULT_URL, yaffleImagePayload } from "@shared/craftYaffle";
import { grokConfigured } from "./grokImages";

function baseUrl(): string {
  return (process.env.YAFFLE_URL || YAFFLE_DEFAULT_URL).replace(/\/$/, "");
}

async function yaffleFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${baseUrl()}${path}`;
  try {
    return await fetch(url, { ...init, signal: init?.signal ?? AbortSignal.timeout(8000) });
  } catch {
    throw new Error(`Yaffle sidecar is not reachable at ${baseUrl()}. Open Yaffle, then retry.`);
  }
}

export async function stillStatus(): Promise<{
  ok: boolean;
  provider: "grok" | "yaffle";
  url?: string;
  worker?: string;
  message: string;
}> {
  return { ok: grokConfigured(), provider: "grok", message: "" };
}

export async function yaffleStatus(): Promise<{
  ok: boolean;
  url: string;
  worker?: string;
  message: string;
}> {
  try {
    const health = await yaffleFetch("/health");
    if (!health.ok) {
      return { ok: false, url: baseUrl(), message: "Yaffle sidecar answered but is not ready." };
    }
    let worker = "unknown";
    try {
      const media = await yaffleFetch("/media/status");
      if (media.ok) {
        const body = (await media.json()) as { worker?: string; runtime?: { message?: string } };
        worker = body.worker || "unknown";
        if (worker === "offline") {
          return {
            ok: true,
            url: baseUrl(),
            worker,
            message: body.runtime?.message || "Yaffle is up. Media worker is offline — image gen needs the GPU sidecar.",
          };
        }
      }
    } catch {
      /* health is enough to talk */
    }
    return { ok: true, url: baseUrl(), worker, message: worker === "ready" ? "Yaffle media worker is ready." : "Yaffle sidecar is up." };
  } catch (err: any) {
    return { ok: false, url: baseUrl(), message: String(err?.message || err) };
  }
}

export async function yaffleStartImage(
  prompt: string,
  presetId?: string,
  stockId?: string,
): Promise<{ id: string; state: string; prompt: string }> {
  const payload = yaffleImagePayload(prompt, presetId, stockId);
  const res = await yaffleFetch("/generate/image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 409) {
    const detail = await res.text();
    throw new Error(detail || "Yaffle media worker needs GPU memory. Open Yaffle.");
  }
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Yaffle image start failed (${res.status}).`);
  }
  const job = (await res.json()) as { id?: string; state?: string };
  if (!job.id) throw new Error("Yaffle did not return a job id.");
  return { id: job.id, state: job.state || "queued", prompt: payload.prompt };
}

export async function yaffleJob(jobId: string): Promise<{
  id: string;
  state: string;
  progress?: number;
  message?: string;
  error?: string;
}> {
  const res = await yaffleFetch(`/jobs/${encodeURIComponent(jobId)}`, { signal: AbortSignal.timeout(8000) });
  if (res.status === 404) throw new Error("Unknown Yaffle job.");
  if (!res.ok) throw new Error(`Yaffle job failed (${res.status}).`);
  return (await res.json()) as { id: string; state: string; progress?: number; message?: string; error?: string };
}

export async function yaffleFileBuffer(jobId: string): Promise<{ mime: string; buffer: Buffer }> {
  const res = await yaffleFetch(`/jobs/${encodeURIComponent(jobId)}/file`, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error("Yaffle has no file for that job yet.");
  const mime = res.headers.get("content-type") || "image/png";
  const buffer = Buffer.from(await res.arrayBuffer());
  if (!buffer.length) throw new Error("Yaffle returned an empty image.");
  return { mime, buffer };
}
