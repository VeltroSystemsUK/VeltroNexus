import 'dotenv/config';

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaOptions {
  model?: string;
  temperature?: number;
  format?: 'json';
}

/**
 * Ollama.ts
 * Simple utility for communicating with a local Ollama instance.
 */
export class Ollama {
  private baseUrl: string;

  constructor(baseUrl = process.env['OLLAMA_URL'] || 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  /**
   * Chat with the local model.
   * Supports basic chat completion. Tool support is model-dependent (e.g. Llama3.1)
   */
  async chat(messages: OllamaMessage[], options: OllamaOptions = {}) {
    const { model = 'llama3', temperature = 0.7, format } = options;

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        options: { temperature },
        format,
        stream: false,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Ollama Error: ${err}`);
    }

    const data = await response.json();
    return data.message.content;
  }

  /**
   * Check if Ollama is running and has the requested model.
   */
  async checkModel(modelName: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return false;
      const data = await response.json();
      return (data.models || []).some((m: any) => m.name.startsWith(modelName));
    } catch {
      return false;
    }
  }
}
