import { describe, expect, it, vi } from "vitest";
import { INBOUND_CONTACT_BANK_VERSION } from "../../services/jevBanks";
import {
  buildInboundTriageState,
  inferSituation,
  triageInboundLead,
} from "../../services/jevInboundTriage";

function peakedChoice(choice: string, keys: string[], mass = 0.96) {
  const rest = (1 - mass) / Math.max(1, keys.length - 1);
  const probabilities = Object.fromEntries(keys.map((key) => [key, key === choice ? mass : rest]));
  return { type: "choice", choice, probabilities };
}

const FIT = ["refinance", "time_to_pay", "cdfs", "not_a_fit"];
const QUEUE = ["diagnostic", "hmrc_first", "introducer", "decline_educate", "distress_human", "compliance_hold"];

const actAnswers = {
  fit: peakedChoice("refinance", FIT),
  distress: { type: "score", score: 1.0, probabilities: { "0": 0.05, "1": 0.9, "2": 0.05 } },
  stacked_debt: { type: "noul", noul: 0.8 },
  ready_to_talk: { type: "noul", noul: 0.95 },
  regulated_risk: { type: "noul", noul: 0.01 },
  queue: peakedChoice("diagnostic", QUEUE),
};

function harness() {
  const lead = { id: 11, notes: JSON.stringify({ source: "Landing Page" }), status: "converted" };
  const prospect = { id: 22, notes: "", userId: "u1" };
  const storage = {
    getInternalLead: vi.fn(async () => lead),
    updateInternalLead: vi.fn(async (_id: number, updates: Record<string, unknown>) => {
      Object.assign(lead, updates);
      return lead;
    }),
    getProspect: vi.fn(async () => prospect),
    updateProspect: vi.fn(async () => prospect),
    getBrokerLead: vi.fn(async () => undefined),
    updateBrokerLead: vi.fn(async () => undefined),
  };
  const startFromInbound = vi.fn(async () => ({ id: 99 }));
  const sendEmail = vi.fn(async () => ({ ok: true }));
  return { storage, startFromInbound, sendEmail, lead };
}

describe("state builder", () => {
  it("computes payment_to_debt_pct in code and infers situation from estimatedRate", () => {
    expect(inferSituation(12)).toBe("hmrc");
    expect(inferSituation(18)).toBe("refinance");
    expect(inferSituation(20)).toBe("decline");
    expect(inferSituation(15)).toBe("other");
    const state = buildInboundTriageState(
      { companyName: "Acme Ltd", currentDebt: 50000, monthlyPayment: 2000, estimatedRate: 18, notes: "MCA stack" },
      { monthlySavings: 400, fiveYearSavings: 24000 },
    );
    expect(state.payment_to_debt_pct).toBeCloseTo(4, 5);
    expect(state.company_name).toBe("Acme Ltd");
    expect(state).not.toHaveProperty("email");
    expect(state).not.toHaveProperty("phone");
    expect(state.situation).toBe("refinance");
    expect(JSON.stringify(state)).not.toMatch(/"email"/);
  });
});

describe("triageInboundLead", () => {
  it("calls startFromInbound once for diagnostic when every irreversible question is act", async () => {
    const { storage, startFromInbound, sendEmail } = harness();
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ answers: actAnswers }), { status: 200 }));
    const result = await triageInboundLead(
      {
        leadId: 11,
        prospectId: 22,
        payload: { companyName: "Acme Ltd", currentDebt: 40000, source: "refinance" },
        analysis: { monthlySavings: 100, fiveYearSavings: 6000 },
      },
      {
        storage: storage as never,
        startFromInbound,
        sendEmail,
        env: { TYPESAFE_API_KEY: "k" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    );
    expect(result.overallAction).toBe("act");
    expect(result.queue).toBe("diagnostic");
    expect(startFromInbound).toHaveBeenCalledTimes(1);
    expect(startFromInbound).toHaveBeenCalledWith(11, expect.objectContaining({ prospectId: 22, jev: expect.anything() }));
    expect(sendEmail).not.toHaveBeenCalled();
    expect(String(storage.updateInternalLead.mock.calls[0][1].notes)).toMatch(
      new RegExp(`\\[JEV_TRIAGE ${INBOUND_CONTACT_BANK_VERSION}`),
    );
  });

  it("blocks startFromInbound when regulated_risk is 0.7", async () => {
    const { storage, startFromInbound } = harness();
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ answers: { ...actAnswers, regulated_risk: { type: "noul", noul: 0.7 } } }), {
          status: 200,
        }),
    );
    const result = await triageInboundLead(
      { leadId: 11, prospectId: 22, payload: { companyName: "Acme Ltd" } },
      {
        storage: storage as never,
        startFromInbound,
        env: { TYPESAFE_API_KEY: "k" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    );
    expect(result.queue).toBe("compliance_hold");
    expect(result.overallAction).toBe("escalate");
    expect(startFromInbound).not.toHaveBeenCalled();
  });

  it("does not call startFromInbound for decline_educate with high peakedness", async () => {
    const { storage, startFromInbound } = harness();
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ answers: { ...actAnswers, queue: peakedChoice("decline_educate", QUEUE, 0.95) } }),
          { status: 200 },
        ),
    );
    const result = await triageInboundLead(
      { leadId: 11, prospectId: 22, payload: { companyName: "Acme Ltd" } },
      {
        storage: storage as never,
        startFromInbound,
        env: { TYPESAFE_API_KEY: "k" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    );
    expect(result.queue).toBe("decline_educate");
    expect(result.overallAction).toBe("act");
    expect(startFromInbound).not.toHaveBeenCalled();
  });

  it("persists unavailable and does not fetch when TYPESAFE_API_KEY is missing", async () => {
    const { storage, startFromInbound } = harness();
    const fetchImpl = vi.fn();
    const result = await triageInboundLead(
      { leadId: 11, payload: { companyName: "Acme Ltd" } },
      { storage: storage as never, startFromInbound, env: {}, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(result.overallAction).toBe("unavailable");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(startFromInbound).not.toHaveBeenCalled();
    expect(storage.updateInternalLead.mock.calls[0][1].status).toBe("triage_unavailable");
    expect(String(storage.updateInternalLead.mock.calls[0][1].notes)).toMatch(/triageStatus": "unavailable"/);
  });

  it("retries TypeSafe 500 once then persists triage_failed", async () => {
    const { storage, startFromInbound } = harness();
    const fetchImpl = vi.fn(async () => new Response("down", { status: 500 }));
    const result = await triageInboundLead(
      { leadId: 11, payload: { companyName: "Acme Ltd" } },
      {
        storage: storage as never,
        startFromInbound,
        env: { TYPESAFE_API_KEY: "k" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.overallAction).toBe("triage_failed");
    expect(startFromInbound).not.toHaveBeenCalled();
    expect(storage.updateInternalLead.mock.calls[0][1].status).toBe("triage_failed");
  });

  it("still persists when Jev throws", async () => {
    const { storage, startFromInbound } = harness();
    const fetchImpl = vi.fn(async () => {
      throw new Error("socket hang up");
    });
    const result = await triageInboundLead(
      { leadId: 11, payload: { companyName: "Acme Ltd" } },
      {
        storage: storage as never,
        startFromInbound,
        env: { TYPESAFE_API_KEY: "k" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    );
    expect(result.overallAction).toBe("triage_failed");
    expect(storage.updateInternalLead).toHaveBeenCalled();
    expect(startFromInbound).not.toHaveBeenCalled();
  });
});
