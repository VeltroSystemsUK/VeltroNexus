import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildHealthcheckLeadNotice, parseHealthcheckAnswers, parseHealthcheckMail } from "../../services/healthcheckMail";

const { createInternalLead, sendEmail, promote, triage } = vi.hoisted(() => ({
  createInternalLead: vi.fn(async (lead: any) => ({ id: 42, ...lead })),
  sendEmail: vi.fn(async (..._args: any[]) => ({ success: true, id: "m1" })),
  promote: vi.fn(),
  triage: vi.fn(),
}));
vi.mock("../../storage", () => ({ storage: { createInternalLead } }));
vi.mock("../../services/email", () => ({ sendEmail }));
vi.mock("../../services/openers", () => ({ stopConvertAndPromote: vi.fn(async () => undefined) }));
vi.mock("../../services/inboundPipeline", () => ({
  inboundDeskForSource: () => "maya",
  isInboundLead: () => true,
  promoteInternalLeadToPipeline: promote,
}));
vi.mock("../../services/jevInboundTriage", () => ({ triageInboundLead: triage }));

const { default: inboundRouter } = await import("../../routes/inbound");

const body = {
  email: "director@example.com",
  company: "Acme <Ltd>",
  balance: 50000,
  monthly: 2500,
  lenders: ["Iwoca", "Funding Circle"],
  brokerNote: "Went direct.",
  answers: {
    cards: [
      { id: "hmrc", title: "HMRC arrears", yes: true },
      { id: "rent", title: "Commercial rent", yes: false },
    ],
    heat: "demands",
    intent: "rescue",
    broker: { arranged: "yes", name: "QuickCash Brokers", fee: "no", told: "none" },
    visitorToken: "hmrc",
    page: "/?d=hmrc",
  },
};

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/inbound", inboundRouter);
  return a;
}

describe("Business Check capture", () => {
  beforeEach(() => vi.clearAllMocks());

  it("parses every answer and tolerates a missing answers block", () => {
    const a = parseHealthcheckAnswers(body);
    expect(a.cards).toEqual(body.answers.cards);
    expect(a.broker.name).toBe("QuickCash Brokers");
    expect(a.heat).toBe("demands");
    expect(parseHealthcheckAnswers({ email: "x@y.co" }).cards).toEqual([]);
  });

  it("notice lists every answer, escaped", () => {
    const parsed = parseHealthcheckMail(body);
    if (!parsed.ok) throw new Error("parse");
    const { html } = buildHealthcheckLeadNotice(parsed.value, parseHealthcheckAnswers(body), 42);
    for (const text of ["#42", "HMRC arrears", "Commercial rent", "Not an issue", "QuickCash Brokers", "Level 2", "Rescue &amp; rebuild", "?d=hmrc", "Acme &lt;Ltd&gt;"]) {
      expect(html).toContain(text);
    }
  });

  it("route stores a CRM lead with all answers, mails visitor and director, never promotes", async () => {
    const res = await request(app()).post("/api/inbound/healthcheck").send(body);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const lead = createInternalLead.mock.calls[0][0];
    expect(lead).toMatchObject({ email: "director@example.com", companyName: "Acme <Ltd>", status: "new" });
    const notes = JSON.parse(lead.notes);
    expect(notes.answers.cards).toHaveLength(2);
    expect(notes.answers.intent).toBe("rescue");
    expect(notes.calculatorData.currentDebt).toBe(50000);

    const recipients = sendEmail.mock.calls.map((call) => call[1]);
    expect(recipients).toEqual(expect.arrayContaining(["director@example.com", "shaun@veltro.co.uk"]));
    expect(promote).not.toHaveBeenCalled();
    expect(triage).not.toHaveBeenCalled();
  });

  it("still emails the visitor when the CRM write fails", async () => {
    createInternalLead.mockRejectedValueOnce(new Error("db down"));
    const res = await request(app()).post("/api/inbound/healthcheck").send(body);
    expect(res.status).toBe(200);
    expect(sendEmail.mock.calls.map((call) => call[1])).toContain("director@example.com");
  });
});
