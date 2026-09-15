import { isSterlingLenderId, STERLING_LENDERS } from "./sterlingPortal";

export const FILE_PACK_LENDER_ID = STERLING_LENDERS[0].id;

export function hasSterlingZip(input: {
  packGeneratedAt?: string | null;
  sterlingPackCompiledAt?: string | null;
}): boolean {
  return Boolean(String(input.packGeneratedAt || input.sterlingPackCompiledAt || "").trim());
}

export function sterlingRailSucceeded(deal: {
  stage?: string;
  packGeneratedAt?: string | null;
  sterlingPackCompiledAt?: string | null;
}): boolean {
  return deal.stage === "complete" && hasSterlingZip(deal);
}

export function recommendationForPack(opts: {
  handoffRecommendation?: string | null;
  underwritingJudgement?: string | null;
}): string {
  const fromHandoff = String(opts.handoffRecommendation || "").trim();
  if (fromHandoff) return fromHandoff;
  return String(opts.underwritingJudgement || "").trim();
}

export function lenderForPack(opts: {
  requestedLenderId?: string | null;
  approvedLenderId?: string | null;
}): string {
  const requested = String(opts.requestedLenderId || "").trim();
  if (isSterlingLenderId(requested)) return requested;
  const approved = String(opts.approvedLenderId || "").trim();
  if (isSterlingLenderId(approved)) return approved;
  return FILE_PACK_LENDER_ID;
}
