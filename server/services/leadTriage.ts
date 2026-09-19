import { storage } from "../storage";
import { redactSensitiveData, logAiOperation } from "../utils/aiGovernance";
import { isJevConfigured, systemOne } from "../utils/jevClient";
import {
  isJevNextAction,
  isJevProduct,
  suggestedPriorityFromTriage,
  type JevLeadState,
  type JevLeadTriage,
} from "@shared/jevTriage";

const STACKED_THRESHOLD = 0.6;
const TTP_THRESHOLD = 0.6;

export function buildLeadTriageState(input: JevLeadState): Record<string, unknown> {
  const notes = redactSensitiveData(String(input.notes || "")).redacted.slice(0, 4000);
  const background = redactSensitiveData(String(input.background || "")).redacted.slice(0, 2000);

  return {
    companyName: input.companyName || null,
    companyNumber: input.companyNumber || null,
    companyStatus: input.companyStatus || null,
    sicCode: input.sicCode || null,
    sicDescription: input.sicDescription || null,
    referralSource: input.referralSource || null,
    loanAmountGbp: input.loanAmountGbp ?? null,
    hasCharges: Boolean(input.hasCharges),
    totalChargesCount: input.totalChargesCount ?? 0,
    stage: input.stage || "lead",
    source: input.source || "pipeline",
    notes,
    background,
  };
}

function mapTriage(raw: Awaited<ReturnType<typeof systemOne>>): JevLeadTriage {
  const next = raw.answers.next_action?.choice;
  const product = raw.answers.product?.choice;
  return {
    nextAction: isJevNextAction(next) ? next : "nurture",
    nextActionProbabilities: raw.answers.next_action?.probabilities,
    product: isJevProduct(product) ? product : "other",
    stackedDebt: Number(raw.answers.stacked_debt?.noul ?? 0),
    timeToPay: Number(raw.answers.time_to_pay?.noul ?? 0),
    urgency: Number(raw.answers.urgency?.score ?? 0),
    model: raw.model || "jev-latest",
    triagedAt: new Date().toISOString(),
  };
}

export async function evaluateLeadTriage(state: JevLeadState): Promise<JevLeadTriage> {
  const result = await systemOne({
    state: buildLeadTriageState(state),
    questions: {
      next_action: {
        type: "choice",
        instructions:
          "What should a UK commercial-finance broker do with this file? Qualify only if there is a real refinance, working-capital, or HMRC Time to Pay signal. Drop if it is not a commercial-finance fit.",
        criteria: {
          qualify: "Enough distress, refinance, tax-arrears or working-capital signal to book a call this week",
          nurture: "Possible later, missing facts, or not urgent",
          drop: "No commercial-finance fit (consumer, spam, dead company, wrong product)",
        },
      },
      product: {
        type: "choice",
        instructions: "Most likely product if this file is worked.",
        criteria: {
          refinance: "Replace existing expensive or stacked facilities",
          working_capital: "Cashflow, overdraft, invoice or asset finance",
          time_to_pay: "HMRC Time to Pay or tax arrears",
          other: "None of the above or unclear",
        },
      },
      stacked_debt: {
        type: "noul",
        instructions:
          "Is there evidence of stacked loans, multiple short-term facilities, MCAs, or high-cost bridging on top of existing debt?",
      },
      time_to_pay: {
        type: "noul",
        instructions: "Is there evidence of HMRC arrears, Time to Pay, VAT/PAYE debt, or tax enforcement risk?",
      },
      urgency: {
        type: "score",
        instructions: "How time-sensitive is this file for a broker?",
        criteria: [
          "Can wait weeks",
          "Handle this week",
          "Cash crisis or enforcement risk now",
        ],
      },
    },
  });

  return mapTriage(result);
}

export async function triageProspect(
  prospectId: number,
  userId: string,
  options: { persist?: boolean } = {}
): Promise<JevLeadTriage> {
  if (!isJevConfigured()) {
    throw new Error("TYPESAFE_API_KEY is not configured");
  }

  const prospect = await storage.getProspect(prospectId, userId);
  if (!prospect) throw new Error("Prospect not found");

  const company = (prospect as any).company;
  const loanPence = Number(prospect.loanAmount || 0);
  const triage = await evaluateLeadTriage({
    companyName: company?.companyName,
    companyNumber: company?.companyNumber,
    companyStatus: company?.companyStatus,
    sicCode: company?.sicCode,
    sicDescription: company?.sicDescription,
    notes: prospect.notes,
    background: prospect.background,
    referralSource: prospect.referralSource,
    loanAmountGbp: loanPence > 0 ? loanPence / 100 : null,
    hasCharges: undefined,
    stage: prospect.stage,
    source: "prospect",
  });

  logAiOperation({
    userId,
    prospectId,
    operation: "jev.triage_lead",
    dataType: "json",
    timestamp: new Date(),
    dataSizeBytes: Buffer.byteLength(JSON.stringify(prospect.notes || ""), "utf8"),
    consentGiven: true,
    redactionApplied: true,
  });

  if (options.persist !== false) {
    const existing =
      prospect.researchData && typeof prospect.researchData === "object" ? prospect.researchData : {};
    const priority = suggestedPriorityFromTriage(triage);
    await storage.updateProspect(prospectId, userId, {
      researchData: { ...existing, jevTriage: triage },
      priority,
    } as any);

    if (triage.stackedDebt >= STACKED_THRESHOLD || triage.timeToPay >= TTP_THRESHOLD) {
      try {
        await storage.createException({
          prospectId,
          source: "due_diligence",
          severity: triage.urgency >= 1.5 ? "high" : "medium",
          message: [
            triage.stackedDebt >= STACKED_THRESHOLD ? `Jev stacked-debt signal ${triage.stackedDebt.toFixed(2)}` : null,
            triage.timeToPay >= TTP_THRESHOLD ? `Jev HMRC/TTP signal ${triage.timeToPay.toFixed(2)}` : null,
          ]
            .filter(Boolean)
            .join("; "),
        });
      } catch (error) {
        console.warn("[Jev] verification exception write skipped:", error);
      }
    }
  }

  return triage;
}

export function triageProspectInBackground(prospectId: number, userId: string): void {
  if (!isJevConfigured()) {
    console.warn("[Jev] skip background triage — TYPESAFE_API_KEY is not set");
    return;
  }
  triageProspect(prospectId, userId).catch((error) => {
    console.error("[Jev] background lead triage failed:", error);
  });
}
