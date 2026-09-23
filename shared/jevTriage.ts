export type JevStakes = "read" | "route" | "write" | "irreversible";
export type JevRoute = "act" | "confirm" | "escalate";
export type JevOverallAction = "act" | "confirm" | "escalate" | "triage_failed" | "unavailable";
export type JevQueue =
  | "diagnostic"
  | "hmrc_first"
  | "introducer"
  | "decline_educate"
  | "distress_human"
  | "compliance_hold";
export type JevFit = "refinance" | "time_to_pay" | "cdfs" | "not_a_fit";
export type JevSituation = "hmrc" | "refinance" | "decline" | "other";

export const JEV_STAKES_THRESHOLDS: Record<JevStakes, { confirm_at: number; act_at: number }> = {
  read: { confirm_at: 0.4, act_at: 0.6 },
  route: { confirm_at: 0.55, act_at: 0.75 },
  write: { confirm_at: 0.65, act_at: 0.85 },
  irreversible: { confirm_at: 0.8, act_at: 0.95 },
};

export function peakedness(probabilities: Record<string, number> | number[]): number {
  const values = Array.isArray(probabilities) ? probabilities : Object.values(probabilities);
  const n = values.length;
  if (n <= 1) return 1;
  const maxP = Math.max(...values.map((value) => Number(value) || 0));
  const baseline = 1 / n;
  const denom = 1 - baseline;
  if (denom <= 0) return 0;
  return Math.max(0, Math.min(1, (maxP - baseline) / denom));
}

export function noulCertainty(noul: number): number {
  if (!Number.isFinite(noul)) return 0;
  return Math.abs(noul - 0.5) * 2;
}

export function routeFor(certainty: number, stakes: JevStakes): JevRoute {
  const { confirm_at, act_at } = JEV_STAKES_THRESHOLDS[stakes];
  if (certainty >= act_at) return "act";
  if (certainty >= confirm_at) return "confirm";
  return "escalate";
}
