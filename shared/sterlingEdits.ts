export const STERLING_COPY_FIELDS = [
  "background",
  "theBusiness",
  "character",
  "ability",
  "means",
  "purpose",
  "amount",
  "repayment",
  "insurance",
  "financials",
  "dealSummary",
  "forecastCritique",
  "recommendation",
] as const;

export type SterlingCopyField = (typeof STERLING_COPY_FIELDS)[number];
export type SterlingCopyEdits = Partial<Record<SterlingCopyField, string>>;

export const STERLING_COPY_LABELS: Record<SterlingCopyField, string> = {
  background: "Background",
  theBusiness: "The business",
  character: "C – Character",
  ability: "A – Ability",
  means: "M – Means",
  purpose: "P – Purpose",
  amount: "A – Amount",
  repayment: "R – Repayment",
  insurance: "I – Insurance",
  financials: "Financials",
  dealSummary: "Deal summary",
  forecastCritique: "Forecast commentary",
  recommendation: "Recommendation",
};

export const STERLING_CAMPARI_FIELDS: SterlingCopyField[] = [
  "character",
  "ability",
  "means",
  "purpose",
  "amount",
  "repayment",
  "insurance",
];

export function linesFromSterlingEdit(text: string | null | undefined): string[] {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseSterlingCopyEdits(raw: unknown): SterlingCopyEdits {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const rec = raw as Record<string, unknown>;
  const out: SterlingCopyEdits = {};
  for (const key of STERLING_COPY_FIELDS) {
    if (typeof rec[key] === "string") out[key] = rec[key];
  }
  return out;
}

export function seedSterlingCopy(
  fromFile: {
    background?: string[];
    theBusiness?: string[];
    campari?: Partial<Record<string, string[]>>;
    forecastCritique?: string[];
    financials?: string[];
    dealSummary?: string[];
    recommendation?: string;
  },
  saved?: SterlingCopyEdits | null,
): SterlingCopyEdits {
  const seed: SterlingCopyEdits = {
    background: (fromFile.background || []).join("\n"),
    theBusiness: (fromFile.theBusiness || []).join("\n"),
    forecastCritique: (fromFile.forecastCritique || []).join("\n"),
    financials: (fromFile.financials || []).join("\n"),
    dealSummary: (fromFile.dealSummary || []).join("\n"),
    recommendation: fromFile.recommendation || "",
  };
  for (const key of STERLING_CAMPARI_FIELDS) {
    seed[key] = (fromFile.campari?.[key] || []).join("\n");
  }
  const overlay = parseSterlingCopyEdits(saved);
  for (const key of STERLING_COPY_FIELDS) {
    if (typeof overlay[key] === "string" && overlay[key]!.trim()) seed[key] = overlay[key];
  }
  return seed;
}

export function sterlingCopyForHandoff(
  handoff: { recommendation?: string | null; narrativeEdits?: unknown },
  diligence?: {
    proposal?: { slots?: any };
    cashflowForecast?: { critique?: string[] };
    accountsAnalysis?: { years?: Array<{ yearEnding: string; turnover: number | null; netProfit: number | null; netAssets: number | null }> };
  } | null,
): SterlingCopyEdits {
  const slots = diligence?.proposal?.slots || {};
  return seedSterlingCopy(
    {
      background: slots.background,
      theBusiness: slots.theBusiness,
      campari: slots.campari,
      forecastCritique: diligence?.cashflowForecast?.critique,
      financials: Array.isArray(slots.financials) ? slots.financials : [],
      dealSummary: Array.isArray(slots.dealSummary) ? slots.dealSummary : [],
      recommendation: handoff.recommendation || "",
    },
    parseSterlingCopyEdits(handoff.narrativeEdits),
  );
}
