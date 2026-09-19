/**
 * TypeSafe Jev (System One) client.
 * Decisions only — choice / noul / score. No generated prose.
 * Key stays on the server. Never import this from client/.
 */
export type JevQuestionType = "noul" | "choice" | "score";

export type JevQuestion = {
  type: JevQuestionType;
  instructions: string;
  criteria?: Record<string, string | null> | string[];
};

export type JevAnswer = {
  type: JevQuestionType;
  choice?: string;
  score?: number;
  noul?: number;
  probabilities?: Record<string, number>;
  confidence?: number;
};

export type JevResponse = {
  model: string;
  answers: Record<string, JevAnswer>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const JEV_MODEL = process.env.JEV_MODEL || "jev-latest";

export function isJevConfigured(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY?.trim());
}

export async function systemOne(params: {
  state: unknown;
  questions: Record<string, JevQuestion>;
  model?: string;
}): Promise<JevResponse> {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("TYPESAFE_API_KEY is not configured");
  }

  const response = await fetch(JEV_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model || JEV_MODEL,
      state: params.state,
      questions: params.questions,
    }),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Jev ${response.status}: ${bodyText.slice(0, 400)}`);
  }

  const parsed = JSON.parse(bodyText) as JevResponse;
  if (!parsed?.answers || typeof parsed.answers !== "object") {
    throw new Error("Jev returned no answers");
  }
  return parsed;
}
