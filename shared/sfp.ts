import { evaluateSterlingCompleteness, type PackDocRef } from "./sterlingCompleteness";

export type SourcedFigure = {
  value: number;
  source: string;
};

export type SfpFigures = {
  turnoverGbp?: SourcedFigure;
  netProfitGbp?: SourcedFigure;
  [key: string]: SourcedFigure | undefined;
};

export type StandardFinancialProfile = {
  status: "COMPLETE" | "PARTIAL";
  missing: string[];
  documents: Array<{ fileName?: string; category?: string | null }>;
  fundingReason?: string;
  figures: SfpFigures;
};

export function buildSfp(input: {
  documents?: PackDocRef[];
  fundingReason?: string;
  companyNumber?: string | null;
  extracted?: SfpFigures;
}): StandardFinancialProfile {
  const completeness = evaluateSterlingCompleteness({
    ...input,
    sfpStatus: "COMPLETE",
  });
  const figures: SfpFigures = {};
  const missing = completeness.missing.map((item) => item.label);
  const extracted = input.extracted || {};

  for (const [key, figure] of Object.entries(extracted)) {
    if (!figure) continue;
    if (!figure.source?.trim()) {
      missing.push(`${key} has no source document`);
      continue;
    }
    if (typeof figure.value !== "number" || Number.isNaN(figure.value)) {
      missing.push(`${key} is not a sourced number`);
      continue;
    }
    figures[key] = { value: figure.value, source: figure.source.trim() };
  }

  const hasSourcedFigures = Object.keys(figures).length > 0;
  if (completeness.missing.length === 0 && !hasSourcedFigures) {
    missing.push("no sourced figures from the pack");
  }

  return {
    status: missing.length === 0 ? "COMPLETE" : "PARTIAL",
    missing,
    documents: input.documents || [],
    fundingReason: input.fundingReason,
    figures,
  };
}
