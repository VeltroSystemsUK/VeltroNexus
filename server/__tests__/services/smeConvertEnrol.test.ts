import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeOpener } from "@shared/openers";

vi.mock("../../storage", () => ({
  storage: {
    getAgenticDeal: vi.fn(),
    updateAgenticDeal: vi.fn(async (_id: number, patch: object) => ({ id: 9, ...patch })),
  },
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

describe("enrolConvertFromMail", () => {
  beforeEach(() => vi.resetModules());
  it("applies the convert patch when dual-open is eligible", async () => {
    const { storage } = await import("../../storage");
    vi.mocked(storage.getAgenticDeal).mockResolvedValue({
      id: 9,
      email: "ops@acme.test",
      companyName: "Acme Ltd",
      status: "outreach",
      stage: "outreach",
      outreachTouch: 3,
      events: [],
    } as never);
    const { enrolConvertFromMail, setOpenersStorePathForTests, writeOpeners } = await import(
      "../../services/openers"
    );
    const openerFile = path.join(os.tmpdir(), `openers-enrol-${process.pid}-${Date.now()}.json`);
    openerFiles.push(openerFile);
    setOpenersStorePathForTests(openerFile);
    writeOpeners([normalizeOpener({ id: "op-1", email: "ops@acme.test", status: "new", dealId: 9 })]);
    await enrolConvertFromMail({
      id: "mail-sme2",
      touchId: "sme_2",
      direction: "outbound",
      status: "sent",
      dealId: 9,
      to: "ops@acme.test",
      opens: ["2026-09-08T10:00:00.000Z"],
      createdAt: "2026-09-08T09:00:00.000Z",
    } as never);
    expect(storage.updateAgenticDeal).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ convertPlaybook: "sme_nurture", outreachTouch: 0 })
    );
  });
});
