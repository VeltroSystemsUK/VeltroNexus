export type JevQuestion = {
  type: "noul" | "choice" | "score";
  instructions: string | Record<string, unknown> | unknown[];
  criteria?: unknown;
};

export type JevSystemOneResult =
  | { ok: true; answers: Record<string, unknown>; httpStatus: number; retried: boolean }
  | { ok: false; reason: "unavailable" | "http" | "network"; httpStatus?: number; retried: boolean };

function systemOneUrl(env: NodeJS.ProcessEnv): string {
  const base = (env.TYPESAFE_BASE_URL || "https://api.typesafe.ai").replace(/\/$/, "");
  return `${base}/v1/systemone`;
}

function timeoutMs(env: NodeJS.ProcessEnv): number {
  const raw = Number(env.JEV_TRIAGE_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 12000;
}

export async function jevSystemOne(
  input: { state: unknown; questions: Record<string, JevQuestion> },
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<JevSystemOneResult> {
  const key = env.TYPESAFE_API_KEY?.trim();
  if (!key) return { ok: false, reason: "unavailable", retried: false };

  const model = env.TYPESAFE_MODEL?.trim() || "jev-latest";
  const body = JSON.stringify({ model, state: input.state, questions: input.questions });
  let retried = false;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetchImpl(systemOneUrl(env), {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(timeoutMs(env)),
      });
      if (res.ok) {
        const payload = (await res.json()) as { answers?: Record<string, unknown> };
        return { ok: true, answers: payload?.answers || payload || {}, httpStatus: res.status, retried };
      }
      console.error("[Jev] System One HTTP", res.status);
      if (res.status < 500) return { ok: false, reason: "http", httpStatus: res.status, retried };
      if (attempt === 0) {
        retried = true;
        continue;
      }
      return { ok: false, reason: "http", httpStatus: res.status, retried };
    } catch (error) {
      const message = error instanceof Error ? error.message : "jev-failed";
      console.error("[Jev] System One failed:", message.replace(/Bearer\s+\S+/gi, "Bearer [redacted]"));
      if (attempt === 0) {
        retried = true;
        continue;
      }
      return { ok: false, reason: "network", retried };
    }
  }
  return { ok: false, reason: "network", retried };
}
