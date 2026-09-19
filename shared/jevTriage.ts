export const JEV_NEXT_ACTIONS = ["qualify", "nurture", "drop"] as const;
export type JevNextAction = (typeof JEV_NEXT_ACTIONS)[number];

export const JEV_PRODUCTS = ["refinance", "working_capital", "time_to_pay", "other"] as const;
export type JevProduct = (typeof JEV_PRODUCTS)[number];

export type JevLeadTriage = {
  nextAction: JevNextAction;
  nextActionProbabilities?: Record<string, number>;
  product: JevProduct;
  stackedDebt: number;
  timeToPay: number;
  urgency: number;
  model: string;
  triagedAt: string;
};

export type JevLeadState = {
  companyName?: string | null;
  companyNumber?: string | null;
  companyStatus?: string | null;
  sicCode?: string | null;
  sicDescription?: string | null;
  notes?: string | null;
  background?: string | null;
  referralSource?: string | null;
  loanAmountGbp?: number | null;
  hasCharges?: boolean | null;
  totalChargesCount?: number | null;
  stage?: string | null;
  source?: string | null;
};

export function isJevNextAction(value: unknown): value is JevNextAction {
  return JEV_NEXT_ACTIONS.includes(value as JevNextAction);
}

export function isJevProduct(value: unknown): value is JevProduct {
  return JEV_PRODUCTS.includes(value as JevProduct);
}

export function suggestedPriorityFromTriage(triage: Pick<JevLeadTriage, "nextAction" | "urgency">): "high" | "medium" | "low" {
  if (triage.nextAction === "drop") return "low";
  if (triage.nextAction === "qualify" && triage.urgency >= 1.5) return "high";
  if (triage.nextAction === "qualify") return "medium";
  return "medium";
}
