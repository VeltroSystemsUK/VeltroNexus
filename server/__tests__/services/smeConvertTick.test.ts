import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONVERT_SITE_ORIGIN } from "@shared/smeConvert";
import { enrolConvertOpener, normalizeOpener } from "@shared/openers";

vi.mock("../../storage", () => ({
  storage: {
    getAgenticDeal: vi.fn(),
    updateAgenticDeal: vi.fn(),
    listAgenticDeals: vi.fn(async () => []),
    getSystemSetting: vi.fn(async () => ({})),
    createActivity: vi.fn(),
  },
}));

vi.mock("../../services/email", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("../../services/mailDesk", () => ({
  mailIsSuppressed: vi.fn(() => false),
}));

const sme2CreatedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

vi.mock("../../services/agentMailLog", () => ({
  listAgentMail: vi.fn(() => [
    {
      id: "mail-sme1",
      touchId: "sme_1",
      direction: "outbound",
      status: "sent",
      dealId: 9,
      to: "david@acmejoinery.co.uk",
      opens: ["2026-09-01T10:00:00.000Z"],
      createdAt: "2026-09-01T09:00:00.000Z",
    },
    {
      id: "mail-sme2",
      touchId: "sme_2",
      direction: "outbound",
      status: "sent",
      dealId: 9,
      to: "david@acmejoinery.co.uk",
      opens: ["2026-09-08T10:00:00.000Z"],
      createdAt: sme2CreatedAt,
    },
  ]),
}));

const openerFiles: string[] = [];

afterEach(() => {
  for (const file of openerFiles) {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch {
      // ignore tmp cleanup
    }
  }
  openerFiles.length = 0;
});

function convertDeal(overrides: Record<string, unknown> = {}) {
  return {
    id: 9,
    email: "david@acmejoinery.co.uk",
    companyName: "Acme Joinery Limited",
    contactName: "David Cole",
    source: "distress_scan",
    stream: "sme",
    stage: "fulfilment",
    status: "waiting_timer",
    convertPlaybook: "sme_nurture",
    outreachTouch: 0,
    hopper: "parked",
    fitScore: 82,
    events: [],
    ...overrides,
  };
}

async function loadTick() {
  const { storage } = await import("../../storage");
  const { sendEmail } = await import("../../services/email");
  const { listAgentMail } = await import("../../services/agentMailLog");
  const { agenticWorkflow } = await import("../../services/agenticWorkflow");
  const openers = await import("../../services/openers");
  const openerFile = path.join(os.tmpdir(), `openers-tick-${process.pid}-${Date.now()}-${Math.random()}.json`);
  openerFiles.push(openerFile);
  openers.setOpenersStorePathForTests(openerFile);
  const seeded = enrolConvertOpener(
    normalizeOpener({
      id: "op-1",
      email: "david@acmejoinery.co.uk",
      companyName: "Acme Joinery Limited",
      status: "new",
      dealId: 9,
    })
  );
  openers.writeOpeners([seeded]);
  vi.mocked(storage.updateAgenticDeal).mockImplementation(async (id: number, patch: object) => ({
    id,
    ...convertDeal(),
    ...patch,
  }));
  vi.mocked(storage.getSystemSetting).mockResolvedValue({});
  vi.mocked(sendEmail).mockResolvedValue({ success: true, messageId: "mid-n1", id: "mail-n1" } as never);
  return { storage, sendEmail, listAgentMail, agenticWorkflow, openers };
}

describe("sendOutreach convert tick", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("sends sme_n1 on a parked hopper convert deal and advances outreachTouch", async () => {
    const { storage, sendEmail, agenticWorkflow, openers } = await loadTick();
    const updated = await agenticWorkflow.sendOutreach(convertDeal() as never);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ touchId: "sme_n1", dealId: 9 }),
      "david@acmejoinery.co.uk",
      expect.any(String),
      expect.any(String)
    );
    expect(storage.updateAgenticDeal).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        outreachTouch: 1,
        outreachTouchId: "sme_n1",
        status: "waiting_timer",
        stage: "outreach",
      })
    );
    expect(updated.outreachTouch).toBe(1);
    expect(openers.listOpeners()[0]?.nurture.n1MailId).toBe("mail-n1");
  });

  it("does not increment outreachTouch when SMTP is mock/undelivered", async () => {
    const { storage, sendEmail, agenticWorkflow, openers } = await loadTick();
    vi.mocked(sendEmail).mockResolvedValue({ success: true, mock: true, id: "mail-mock" } as never);
    const updated = await agenticWorkflow.sendOutreach(convertDeal() as never);
    expect(updated.outreachTouch).not.toBe(1);
    expect(storage.updateAgenticDeal).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        status: "waiting_human",
        humanReason: expect.stringMatching(/did not send|SMTP/i),
      })
    );
    expect(storage.updateAgenticDeal).not.toHaveBeenCalledWith(
      9,
      expect.objectContaining({ outreachTouch: 1 })
    );
    expect(openers.listOpeners()[0]?.nurture.n1At).toBeUndefined();
    expect(openers.listOpeners()[0]?.lastTouchAt).toBeUndefined();
  });

  it("skips N2 after a contact click and sets outreachTouch to 3 after N3", async () => {
    const { storage, sendEmail, listAgentMail, agenticWorkflow } = await loadTick();
    vi.mocked(listAgentMail).mockReturnValue([
      {
        id: "mail-sme1",
        touchId: "sme_1",
        direction: "outbound",
        status: "sent",
        dealId: 9,
        to: "david@acmejoinery.co.uk",
        createdAt: "2026-09-01T09:00:00.000Z",
        clicks: [{ at: "2026-09-09T10:00:00.000Z", url: `${CONVERT_SITE_ORIGIN}/?sf=n1#contact` }],
      },
    ] as never);
    vi.mocked(sendEmail).mockResolvedValue({ success: true, messageId: "mid-n3", id: "mail-n3" } as never);
    const updated = await agenticWorkflow.sendOutreach(
      convertDeal({ outreachTouch: 1 }) as never
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ touchId: "sme_n3_form" }),
      "david@acmejoinery.co.uk",
      expect.any(String),
      expect.any(String)
    );
    expect(storage.updateAgenticDeal).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ outreachTouch: 3, outreachTouchId: "sme_n3_form" })
    );
    expect(updated.outreachTouch).toBe(3);
  });

  it("queues the Openers closer without hunt callPlaybook", async () => {
    const { storage, sendEmail, agenticWorkflow, openers } = await loadTick();
    const n3At = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
    const [row] = openers.listOpeners();
    openers.writeOpeners([
      {
        ...row,
        nurture: { ...row.nurture, n3At, n3MailId: "mail-n3" },
      },
    ]);
    const updated = await agenticWorkflow.sendOutreach(
      convertDeal({ outreachTouch: 3 }) as never
    );
    expect(sendEmail).not.toHaveBeenCalled();
    expect(storage.updateAgenticDeal).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        status: "waiting_human",
        humanReason: "Convert closer due on Openers",
        callPlaybook: undefined,
      })
    );
    expect(updated.humanReason).toBe("Convert closer due on Openers");
    expect(updated.callPlaybook).toBeUndefined();
    expect(openers.listOpeners()[0]?.nurture.closerScript).toMatch(/Opened sme_1 and sme_2/);
  });

  it("holds N1 on the same London day as sme_2 without incrementing", async () => {
    const { storage, sendEmail, listAgentMail, agenticWorkflow } = await loadTick();
    vi.mocked(listAgentMail).mockReturnValue([
      {
        id: "mail-sme2",
        touchId: "sme_2",
        direction: "outbound",
        status: "sent",
        dealId: 9,
        to: "david@acmejoinery.co.uk",
        createdAt: new Date().toISOString(),
      },
    ] as never);
    const updated = await agenticWorkflow.sendOutreach(convertDeal() as never);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(storage.updateAgenticDeal).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        status: "waiting_timer",
        stage: "outreach",
      })
    );
    expect(updated.outreachTouch).not.toBe(1);
    expect(storage.updateAgenticDeal).not.toHaveBeenCalledWith(
      9,
      expect.objectContaining({ outreachTouch: 1 })
    );
    expect(updated.waitUntil).toBeTruthy();
  });

  it("still early-returns hopper hold for hunt deals", async () => {
    const { sendEmail, agenticWorkflow } = await loadTick();
    const hunt = convertDeal({ convertPlaybook: undefined, hopper: "parked", outreachTouch: 0 });
    const updated = await agenticWorkflow.sendOutreach(hunt as never);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(updated.hopper).toBe("parked");
    expect(updated.outreachTouch).toBe(0);
  });
});
