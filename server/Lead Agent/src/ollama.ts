export class Ollama {
  private readonly baseUrl: string;

  constructor(baseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async chat(
    messages: Array<{ role: string; content: string }>,
    options: { model: string; temperature?: number; format?: "json"; timeoutMs?: number }
  ): Promise<string> {
    const timeoutMs = options.timeoutMs ?? Number(process.env.OLLAMA_TIMEOUT_MS || 60000);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          model: options.model,
          messages,
          stream: false,
          ...(options.format ? { format: options.format } : {}),
          options: { temperature: options.temperature ?? 0.2 },
        }),
      });
    } catch (error: any) {
      const cause = error?.cause?.code || error?.code;
      if (error?.name === "AbortError" || /aborted|timeout/i.test(error?.message || "")) {
        throw new Error(`Ollama timed out at ${this.baseUrl} (model ${options.model}).`);
      }
      if (cause === "ECONNREFUSED" || /ECONNREFUSED|fetch failed/i.test(error?.message || "")) {
        throw new Error(`Ollama is not running at ${this.baseUrl}. Start Ollama and pull ${options.model}.`);
      }
      throw error;
    }

    const payload = await response.json().catch(() => ({})) as { message?: { content?: string }; error?: string };
    if (!response.ok) throw new Error(payload.error || `Ollama request failed with status ${response.status}`);
    const text = payload.message?.content?.trim();
    if (!text) throw new Error("Ollama returned an empty response");
    return text;
  }
}
