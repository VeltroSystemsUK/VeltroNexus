import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convertReasonFromInboundKind, enrolConvertOpener, normalizeOpener } from "@shared/openers";

vi.mock("../../storage", () => ({
  storage: {
    listAgenticDeals: vi.fn(async () => []),
    updateAgenticDeal: vi.fn(async (id: number, patch: object) => ({ id, ...patch })),
    getAgenticDeal: vi.fn(),
  },
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

async function loadPromote() {
  const { storage } = await import("../../storage");
  const openers = await import("../../services/openers");
  const openerFile = path.join(os.tmpdir(), `openers-promote-${process.pid}-${Date.now()}.json`);
  openerFiles.push(openerFile);
  openers.setOpenersStorePathForTests(openerFile);
  return { storage, ...openers };
}

function convertRow(over: Record<string, unknown> = {}) {
  return enrolConvertOpener(
    normalizeOpener({
      id: "op-1",
      email: "ops@acme.test",
      dealId: 9,
      status: "nurturing",
      ...over,
    })
  );
}

const promoteDeps = {
  async getCompanyByNumber() {
    return { id: 1, companyNumber: "08765432" };
  },
  async createCompany() {
    return { id: 1 };
  },
  async listProspects() {
    return [];
  },
  async createProspect() {
    return { id: 77 };
  },
  async createContact() {
    return {};
  },
};

describe("stopConvertAndPromote", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("promotes a numbered convert opener and clears the deal convert clock", async () => {
    const { storage, writeOpeners, listOpeners, stopConvertAndPromote } = await loadPromote();
    vi.mocked(storage.listAgenticDeals).mockResolvedValue([
      {
        id: 9,
        email: "ops@acme.test",
        companyNumber: "08765432",
        convertPlaybook: "sme_nurture",
        convertWakeAt: "2026-12-01T00:00:00.000Z",
      },
    ] as never);
    writeOpeners([convertRow({ companyNumber: "08765432" })]);

    await stopConvertAndPromote("ops@acme.test", "promoted", promoteDeps);

    const row = listOpeners()[0];
    expect(row?.status).toBe("promoted");
    expect(row?.nurture.stopReason).toBe("promoted");
    expect(row?.nurture.wakeAt).toBeUndefined();
    expect(row?.prospectId).toBe(77);
    expect(storage.updateAgenticDeal).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        convertPlaybook: undefined,
        convertStopReason: "promoted",
        convertWakeAt: undefined,
      })
    );
  });

  it("stops convert without promoting when there is no company number", async () => {
    const { storage, writeOpeners, listOpeners, stopConvertAndPromote } = await loadPromote();
    vi.mocked(storage.listAgenticDeals).mockResolvedValue([
      { id: 9, email: "ops@acme.test", convertPlaybook: "sme_nurture" },
    ] as never);
    writeOpeners([convertRow({ companyNumber: undefined })]);
    let created = false;

    await stopConvertAndPromote("ops@acme.test", "promoted", {
      ...promoteDeps,
      async createProspect() {
        created = true;
        return { id: 77 };
      },
    });

    const row = listOpeners()[0];
    expect(created).toBe(false);
    expect(row?.status).toBe("nurturing");
    expect(row?.nurture.promoteBlocked).toBe(true);
    expect(row?.nurture.stopReason).toBe("blocked");
    expect(row?.nurture.stream).toBe("convert");
    expect(storage.updateAgenticDeal).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ convertStopReason: "blocked", convertPlaybook: undefined })
    );
  });

  it("parks convert on opt-out and does not promote", async () => {
    const { storage, writeOpeners, listOpeners, stopConvertAndPromote } = await loadPromote();
    vi.mocked(storage.listAgenticDeals).mockResolvedValue([
      { id: 9, email: "ops@acme.test", convertPlaybook: "sme_nurture" },
    ] as never);
    writeOpeners([convertRow({ companyNumber: "08765432" })]);
    let created = false;

    await stopConvertAndPromote("ops@acme.test", "opt_out", {
      ...promoteDeps,
      async createProspect() {
        created = true;
        return { id: 77 };
      },
    });

    const row = listOpeners()[0];
    expect(created).toBe(false);
    expect(row?.status).toBe("not_now");
    expect(row?.nurture.stopReason).toBe("opt_out");
    expect(row?.status).not.toBe("promoted");
    expect(storage.updateAgenticDeal).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ convertStopReason: "opt_out", convertPlaybook: undefined })
    );
  });

  it("Apply inbound routes stop convert, and bounce/spam do not promote", () => {
    const inbound = fs.readFileSync(path.resolve("server/routes/inbound.ts"), "utf8");
    expect(inbound).toMatch(/router\.post\("\/application"[\s\S]*stopConvertAfterInboundLead\(data\.email\)/);
    expect(inbound).toMatch(/router\.post\("\/portal-submit"[\s\S]*stopConvertAfterInboundLead\(data\.email\)/);
    const mail = fs.readFileSync(path.resolve("server/routes/agentMail.ts"), "utf8");
    expect(mail).toMatch(/convertReasonFromInboundKind/);
    expect(convertReasonFromInboundKind("responsive")).toBe("reply");
    expect(convertReasonFromInboundKind("bounce")).toBeUndefined();
    expect(convertReasonFromInboundKind("spam")).toBeUndefined();
    expect(convertReasonFromInboundKind("other")).toBeUndefined();
  });
});
