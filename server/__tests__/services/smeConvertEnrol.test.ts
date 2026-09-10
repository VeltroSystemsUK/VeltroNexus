import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeOpener } from "@shared/openers";

vi.mock("../../storage", () => ({
  storage: {
    getAgenticDeal: vi.fn(),
    updateAgenticDeal: vi.fn(async (_id: number, patch: object) => ({ id: 9, ...patch })),
    listAgenticDeals: vi.fn(async () => []),
  },
}));

vi.mock("../../services/mailDesk", () => ({
  mailIsSuppressed: vi.fn(() => false),
}));

vi.mock("../../services/agentMailLog", () => ({
  listAgentMail: vi.fn(() => [
    {
      id: "mail-sme1",
      touchId: "sme_1",
      direction: "outbound",
      status: "sent",
      dealId: 9,
      to: "ops@acme.test",
      opens: ["2026-09-01T10:00:00.000Z"],
      createdAt: "2026-09-01T09:00:00.000Z",
    },
    {
      id: "mail-sme2",
      touchId: "sme_2",
      direction: "outbound",
      status: "sent",
      dealId: 9,
      to: "ops@acme.test",
      opens: ["2026-09-08T10:00:00.000Z"],
      createdAt: "2026-09-08T09:00:00.000Z",
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

const sme2Item = {
  id: "mail-sme2",
  touchId: "sme_2",
  direction: "outbound",
  status: "sent",
  dealId: 9,
  to: "ops@acme.test",
  opens: ["2026-09-08T10:00:00.000Z"],
  createdAt: "2026-09-08T09:00:00.000Z",
} as never;

const outreachDeal = {
  id: 9,
  email: "ops@acme.test",
  companyName: "Acme Ltd",
  status: "outreach",
  stage: "outreach",
  outreachTouch: 3,
  events: [],
};

async function loadEnrol() {
  const { storage } = await import("../../storage");
  vi.mocked(storage.getAgenticDeal).mockResolvedValue(outreachDeal as never);
  vi.mocked(storage.listAgenticDeals).mockResolvedValue([]);
  const openers = await import("../../services/openers");
  const openerFile = path.join(os.tmpdir(), `openers-enrol-${process.pid}-${Date.now()}.json`);
  openerFiles.push(openerFile);
  openers.setOpenersStorePathForTests(openerFile);
  openers.writeOpeners([normalizeOpener({ id: "op-1", email: "ops@acme.test", status: "new", dealId: 9 })]);
  return { storage, ...openers };
}

describe("enrolConvertFromMail", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });
  it("applies the convert patch when dual-open is eligible", async () => {
    const { storage, enrolConvertFromMail } = await loadEnrol();
    await enrolConvertFromMail(sme2Item);
    expect(storage.updateAgenticDeal).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ convertPlaybook: "sme_nurture", outreachTouch: 0 })
    );
  });

  it("does not double-increment convertCycle when a second enrol is already in flight", async () => {
    const { storage, enrolConvertFromMail, listOpeners } = await loadEnrol();
    let entered = 0;
    let releaseDeal!: () => void;
    const dealGate = new Promise<void>((resolve) => {
      releaseDeal = resolve;
    });
    vi.mocked(storage.getAgenticDeal).mockImplementation(async () => {
      entered += 1;
      await dealGate;
      return outreachDeal as never;
    });
    const first = enrolConvertFromMail(sme2Item);
    for (let i = 0; i < 30 && entered === 0; i++) await Promise.resolve();
    const second = enrolConvertFromMail(sme2Item);
    for (let i = 0; i < 30; i++) await Promise.resolve();
    releaseDeal();
    await Promise.all([first, second]);
    expect(entered).toBe(1);
    expect(storage.updateAgenticDeal).toHaveBeenCalledTimes(1);
    expect(listOpeners()[0]?.nurture.convertCycle).toBe(1);
  });

  it("skips updateAgenticDeal when inboundDeals strata_inbound matches the email", async () => {
    const { storage, enrolConvertFromMail } = await loadEnrol();
    vi.mocked(storage.listAgenticDeals).mockResolvedValue([
      { id: 99, source: "strata_inbound", email: "ops@acme.test" },
    ] as never);
    await enrolConvertFromMail(sme2Item);
    expect(storage.updateAgenticDeal).not.toHaveBeenCalled();
  });
});
