import {
  noulCertainty,
  peakedness,
  routeFor,
  type JevFit,
  type JevOverallAction,
  type JevQueue,
  type JevRoute,
  type JevSituation,
  type JevStakes,
} from "@shared/jevTriage";
import { INBOUND_CONTACT_BANK, INBOUND_CONTACT_BANK_VERSION, questionsWithoutStakes } from "./jevBanks";
import { jevSystemOne } from "./jevClient";
import { storage as liveStorage } from "../storage";
import { resolvePipelineOwnerUserId } from "./inboundPipeline";

export type InboundTriagePayload = {
  companyName?: string;
  currentDebt?: number;
  monthlyPayment?: number;
  estimatedRate?: number;
  loanAmount?: number;
  source?: string;
  context?: Record<string, unknown>;
  situation?: string;
  notes?: string;
};

type QuestionJudgment = {
  id: string;
  stakes: JevStakes;
  certainty: number;
  route: JevRoute;
  value: unknown;
};

const FIT: JevFit[] = ["refinance", "time_to_pay", "cdfs", "not_a_fit"];
const QUEUE: JevQueue[] = [
  "diagnostic",
  "hmrc_first",
  "introducer",
  "decline_educate",
  "distress_human",
  "compliance_hold",
];

export function inferSituation(estimatedRate?: number, _context?: Record<string, unknown>): JevSituation {
  if (estimatedRate === 12) return "hmrc";
  if (estimatedRate === 18) return "refinance";
  if (estimatedRate === 20) return "decline";
  return "other";
}

export function buildInboundTriageState(
  payload: InboundTriagePayload,
  analysis?: Record<string, unknown>,
): Record<string, unknown> {
  const currentDebt = Number(payload.currentDebt ?? payload.loanAmount ?? 0) || 0;
  const monthlyPayment = Number(payload.monthlyPayment ?? 0) || 0;
  const situation =
    payload.situation === "hmrc" ||
    payload.situation === "refinance" ||
    payload.situation === "decline" ||
    payload.situation === "other"
      ? payload.situation
      : inferSituation(payload.estimatedRate, payload.context);
  return {
    source: payload.source ?? "contact",
    company_name: payload.companyName,
    situation,
    current_debt_gbp: currentDebt,
    monthly_payment_gbp: monthlyPayment,
    estimated_rate_pct: payload.estimatedRate,
    payment_to_debt_pct: currentDebt > 0 ? (monthlyPayment / currentDebt) * 100 : null,
    monthly_savings_gbp: analysis?.monthlySavings ?? null,
    five_year_savings_gbp: analysis?.fiveYearSavings ?? null,
    enquiry: payload.notes || payload.context || null,
    context_keys: payload.context ? Object.keys(payload.context) : [],
  };
}

function noulOf(answer: unknown): number {
  const row = answer as { noul?: unknown; value?: unknown } | null;
  const value = Number(row?.noul ?? row?.value);
  return Number.isFinite(value) ? value : 0.5;
}

function scoreOf(answer: unknown): number {
  const row = answer as { score?: unknown; value?: unknown } | null;
  const value = Number(row?.score ?? row?.value);
  return Number.isFinite(value) ? value : 0;
}

function choiceOf(answer: unknown): string {
  const row = answer as { choice?: unknown; value?: unknown } | null;
  return String(row?.choice ?? row?.value ?? "");
}

function probabilitiesOf(answer: unknown): Record<string, number> | null {
  const row = answer as { probabilities?: unknown } | null;
  if (!row?.probabilities || typeof row.probabilities !== "object") return null;
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(row.probabilities as Record<string, unknown>)) {
    const n = Number(value);
    if (Number.isFinite(n)) out[key] = n;
  }
  return Object.keys(out).length ? out : null;
}

function judgeQuestion(id: string, answer: unknown): QuestionJudgment {
  const question = INBOUND_CONTACT_BANK[id];
  const stakes = question.stakes;
  if (question.type === "noul") {
    const noul = noulOf(answer);
    const certainty = noulCertainty(noul);
    return { id, stakes, certainty, route: routeFor(certainty, stakes), value: noul };
  }
  const probs = probabilitiesOf(answer);
  const certainty = probs ? peakedness(probs) : 0;
  return {
    id,
    stakes,
    certainty,
    route: routeFor(certainty, stakes),
    value: question.type === "score" ? scoreOf(answer) : choiceOf(answer),
  };
}

function asFit(value: unknown): JevFit {
  return FIT.includes(value as JevFit) ? (value as JevFit) : "not_a_fit";
}

function asQueue(value: unknown): JevQueue {
  return QUEUE.includes(value as JevQueue) ? (value as JevQueue) : "diagnostic";
}

function worstRoute(routes: JevRoute[]): JevRoute {
  if (routes.includes("escalate")) return "escalate";
  if (routes.includes("confirm")) return "confirm";
  return "act";
}

export function decideContactTriage(
  answers: Record<string, unknown>,
  situation: JevSituation,
): {
  overallAction: JevOverallAction;
  queue: JevQueue;
  fit: JevFit;
  distress: number;
  ready: number;
  regulated: number;
  judgments: QuestionJudgment[];
  priority?: "P0" | "P1";
} {
  const judgments = Object.keys(INBOUND_CONTACT_BANK).map((id) => judgeQuestion(id, answers[id]));
  const byId = Object.fromEntries(judgments.map((row) => [row.id, row]));
  let queue = asQueue(byId.queue?.value);
  const fit = asFit(byId.fit?.value);
  const distress = Number(byId.distress?.value || 0);
  const stacked = Number(byId.stacked_debt?.value || 0);
  const ready = Number(byId.ready_to_talk?.value || 0);
  const regulated = Number(byId.regulated_risk?.value || 0);
  let overallAction: JevOverallAction = worstRoute(judgments.map((row) => row.route));
  let priority: "P0" | "P1" | undefined;

  if (regulated >= 0.5) {
    queue = "compliance_hold";
    overallAction = "escalate";
    priority = "P1";
  } else if (judgments.some((row) => row.stakes === "irreversible" && row.route !== "act")) {
    overallAction = "escalate";
  }

  if (
    overallAction !== "escalate" &&
    distress >= 1.5 &&
    (situation === "hmrc" || stacked >= 0.6) &&
    queue === "diagnostic"
  ) {
    queue = situation === "hmrc" ? "hmrc_first" : "distress_human";
  }

  if (queue === "distress_human") {
    overallAction = "escalate";
    priority = "P0";
  }
  if (queue === "compliance_hold") {
    overallAction = "escalate";
    priority = priority || "P1";
  }
  if (queue === "decline_educate" && (byId.queue?.certainty || 0) >= 0.85) {
    overallAction = "act";
  }

  return { overallAction, queue, fit, distress, ready, regulated, judgments, priority };
}

function appendTriageBlock(notes: string | undefined, body: Record<string, unknown>): string {
  const block = `[JEV_TRIAGE ${INBOUND_CONTACT_BANK_VERSION} ts=${new Date().toISOString()}]\n${JSON.stringify(body, null, 2)}`;
  return `${notes || ""}\n\n${block}`.trim();
}

function truncateEnquiry(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return text.length <= 240 ? text : `${text.slice(0, 240)}…`;
}

type TriageStorage = {
  getInternalLead(id: number): Promise<{ id?: number; notes?: string | null } | undefined>;
  updateInternalLead(id: number, updates: Record<string, unknown>): Promise<unknown>;
  getProspect?(id: number, userId: string): Promise<{ id?: number; notes?: string | null } | undefined>;
  updateProspect?(id: number, userId: string, updates: Record<string, unknown>): Promise<unknown>;
  getBrokerLead?(id: number): Promise<{ id?: number; notes?: string | null } | undefined>;
  updateBrokerLead?(id: number, updates: Record<string, unknown>): Promise<unknown>;
};

function shouldStartInbound(overallAction: JevOverallAction, queue: JevQueue): boolean {
  return overallAction === "act" && (queue === "diagnostic" || queue === "hmrc_first");
}

export async function triageInboundLead(
  input: {
    leadId: number;
    prospectId?: number;
    brokerLeadId?: number;
    desk?: "maya" | "director";
    payload: InboundTriagePayload;
    analysis?: Record<string, unknown>;
  },
  deps: {
    storage?: TriageStorage;
    startFromInbound?: (leadId: number, extras?: { loanAmount?: number; prospectId?: number; jev?: unknown }) => Promise<unknown>;
    sendEmail?: (...args: unknown[]) => Promise<unknown>;
    env?: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<{ overallAction: JevOverallAction; queue?: JevQueue }> {
  const started = Date.now();
  const store = deps.storage || (liveStorage as unknown as TriageStorage);
  const env = deps.env || process.env;
  const state = buildInboundTriageState(input.payload, input.analysis);
  const situation = state.situation as JevSituation;

  const persist = async (body: Record<string, unknown>, status?: string, assignedAgentId?: string) => {
    if (input.brokerLeadId && store.getBrokerLead && store.updateBrokerLead) {
      const broker = await store.getBrokerLead(input.brokerLeadId);
      if (broker) {
        await store.updateBrokerLead(input.brokerLeadId, {
          notes: appendTriageBlock(broker.notes || "", body),
        });
      }
      return;
    }
    const lead = await store.getInternalLead(input.leadId);
    if (lead?.id) {
      await store.updateInternalLead(lead.id, {
        notes: appendTriageBlock(lead.notes || "", body),
        ...(status ? { status } : {}),
        ...(assignedAgentId ? { assignedAgentId } : {}),
      });
    }
    if (input.prospectId && store.getProspect && store.updateProspect) {
      try {
        const userId = await resolvePipelineOwnerUserId();
        const prospect = await store.getProspect(input.prospectId, userId);
        if (prospect) {
          const line = `Jev queue=${body.queue || "none"} action=${body.overallAction} distress=${body.distress ?? ""}`;
          const extra =
            body.queue === "decline_educate"
              ? `${line}; priority=low`
              : body.overallAction === "confirm"
                ? `${line}; Jev unsure, needs a look`
                : line;
          await store.updateProspect(input.prospectId, userId, {
            notes: `${prospect.notes || ""}\n${extra}`.trim(),
          });
        }
      } catch {
        // tests without users
      }
    }
  };

  try {
    const result = await jevSystemOne(
      { state, questions: questionsWithoutStakes(INBOUND_CONTACT_BANK) },
      env,
      deps.fetchImpl || fetch,
    );
    const latencyMs = Date.now() - started;

    if (!result.ok) {
      const overallAction: JevOverallAction = result.reason === "unavailable" ? "unavailable" : "triage_failed";
      const body = {
        triageStatus: overallAction === "unavailable" ? "unavailable" : "failed",
        overallAction,
        bank: INBOUND_CONTACT_BANK_VERSION,
        model: env.TYPESAFE_MODEL || "jev-latest",
        httpStatus: result.httpStatus ?? null,
        latency_ms: latencyMs,
      };
      console.log(
        `[Jev triage] leadId=${input.leadId} bank=${INBOUND_CONTACT_BANK_VERSION} overallAction=${overallAction} queue= latency_ms=${latencyMs} http=${result.httpStatus ?? "none"}`,
      );
      await persist(body, overallAction === "unavailable" ? "triage_unavailable" : "triage_failed", "director");
      return { overallAction };
    }

    const decided = decideContactTriage(result.answers, situation);
    const body = {
      answers: result.answers,
      judgments: decided.judgments,
      overallAction: decided.overallAction,
      queue: decided.queue,
      fit: decided.fit,
      distress: decided.distress,
      ready: decided.ready,
      regulated: decided.regulated,
      priority: decided.priority,
      bank: INBOUND_CONTACT_BANK_VERSION,
      model: env.TYPESAFE_MODEL || "jev-latest",
      httpStatus: result.httpStatus,
      latency_ms: latencyMs,
      enquiryPreview: truncateEnquiry(state.enquiry),
    };
    console.log(
      `[Jev triage] leadId=${input.leadId} bank=${INBOUND_CONTACT_BANK_VERSION} overallAction=${decided.overallAction} queue=${decided.queue} latency_ms=${latencyMs} http=${result.httpStatus}`,
    );

    const status =
      decided.overallAction === "escalate"
        ? "triage_escalate"
        : decided.overallAction === "confirm"
          ? "triage_confirm"
          : undefined;
    const assign = decided.overallAction === "escalate" || decided.overallAction === "confirm" ? "director" : undefined;
    await persist(body, status, assign);

    if (shouldStartInbound(decided.overallAction, decided.queue)) {
      const start =
        deps.startFromInbound ||
        (await import("./agenticWorkflow")).agenticWorkflow.startFromInbound.bind(
          (await import("./agenticWorkflow")).agenticWorkflow,
        );
      const loanAmount = Math.round(Number(input.payload.currentDebt || input.payload.loanAmount || 0) * 100);
      await start(input.leadId, {
        loanAmount: loanAmount || undefined,
        prospectId: input.prospectId,
        jev: body,
      });
    }

    return { overallAction: decided.overallAction, queue: decided.queue };
  } catch {
    await persist(
      {
        triageStatus: "failed",
        overallAction: "triage_failed",
        bank: INBOUND_CONTACT_BANK_VERSION,
      },
      "triage_failed",
      "director",
    );
    return { overallAction: "triage_failed" };
  }
}
