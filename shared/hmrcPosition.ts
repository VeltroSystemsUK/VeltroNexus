import type { DueDiligenceData } from "./schema";

export type HmrcPositionFields = {
  narrative: string;
  ttpRequired: boolean;
  arrangementsCommentary: string;
};

function trimText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function resolveHmrcPosition(
  data?: Pick<DueDiligenceData, "hmrcPosition" | "hmrcTimeToPay"> | null,
): HmrcPositionFields {
  const pos = data?.hmrcPosition;
  if (pos) {
    return {
      narrative: trimText(pos.narrative),
      ttpRequired: Boolean(pos.ttpRequired),
      arrangementsCommentary: trimText(pos.arrangementsCommentary),
    };
  }
  const legacy = data?.hmrcTimeToPay;
  return {
    narrative: "",
    ttpRequired: false,
    arrangementsCommentary: legacy === "active" ? "Active" : legacy === "historic" ? "Historic" : "",
  };
}

export function hmrcPositionHasContent(position: HmrcPositionFields): boolean {
  return Boolean(position.narrative || position.arrangementsCommentary || position.ttpRequired);
}

export const CREDIT_TOOLS_SCRATCH_KEY = "credit-tools-data";

export type SeededHmrcPosition = HmrcPositionFields & { fromScratch: boolean };

export function seedHmrcPositionForFile(
  file?: Pick<DueDiligenceData, "hmrcPosition" | "hmrcTimeToPay"> | null,
  scratchRaw?: string | null,
): SeededHmrcPosition {
  const fromFile = resolveHmrcPosition(file);
  if (hmrcPositionHasContent(fromFile)) return { ...fromFile, fromScratch: false };
  try {
    const parsed = scratchRaw ? JSON.parse(scratchRaw) : null;
    const fromScratch = resolveHmrcPosition(parsed);
    if (hmrcPositionHasContent(fromScratch)) return { ...fromScratch, fromScratch: true };
  } catch {
    // ignore unreadable Credit Tools scratch
  }
  return { ...fromFile, fromScratch: false };
}

export function ttpRequiredNewlyTicked(
  existing?: Pick<DueDiligenceData, "hmrcPosition" | "hmrcTimeToPay"> | null,
  next?: Pick<DueDiligenceData, "hmrcPosition" | "hmrcTimeToPay"> | null,
): boolean {
  return Boolean(next?.hmrcPosition?.ttpRequired) && !existing?.hmrcPosition?.ttpRequired;
}
