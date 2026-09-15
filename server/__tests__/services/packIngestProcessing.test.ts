import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../storage", () => ({
  storage: {
    getAgenticDeal: vi.fn(),
    updateAgenticDeal: vi.fn(),
    getDueDiligence: vi.fn(),
    upsertDueDiligence: vi.fn(),
    getSystemSetting: vi.fn(),
  },
}));
vi.mock("../../services/packIngest", () => ({
  ingestSfpFromPack: vi.fn(),
}));
vi.mock("../../services/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

import { storage } from "../../storage";
import { ingestSfpFromPack } from "../../services/packIngest";
import { agenticWorkflow } from "../../services/agenticWorkflow";

const mockedStorage = storage as unknown as {
  getAgenticDeal: ReturnType<typeof vi.fn>;
  updateAgenticDeal: ReturnType<typeof vi.fn>;
  getDueDiligence: ReturnType<typeof vi.fn>;
  upsertDueDiligence: ReturnType<typeof vi.fn>;
  getSystemSetting: ReturnType<typeof vi.fn>;
};

const packDocuments = [
  { fileName: "june.pdf", category: "bank-statements", storagePath: "/tmp/june.pdf" },
  { fileName: "accounts-2024.pdf", category: "accounts", storagePath: "/tmp/accounts.pdf" },
  { fileName: "cff.xlsx", category: "cashflow", storagePath: "/tmp/cff.xlsx" },
  { fileName: "debts.xlsx", category: "debt-schedule", storagePath: "/tmp/debts.xlsx" },
  { fileName: "passport.pdf", category: "id", storagePath: "/tmp/id.pdf" },
];

function deal() {
  return {
    id: 88,
    prospectId: 42,
    ownerUserId: "shaun",
    stage: "fulfilment",
    status: "running",
    companyName: "Acme Joinery Limited",
    companyNumber: "12345678",
    fundingReason: "Stacked MCA refinance",
    packDocuments,
    events: [{ at: "2026-09-01T00:00:00.000Z", stage: "outreach", message: "Day 1 email. Invent turnover 999999." }],
    bbbEligibility: { status: "pass" },
    sfp: { status: "PARTIAL", missing: ["no sourced figures from the pack"], figures: {}, documents: [] },
  };
}

describe("processing ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let current: Record<string, unknown> = deal();
    mockedStorage.updateAgenticDeal.mockImplementation(async (id: number, patch: object) => {
      current = { ...current, id, ...patch };
      return current;
    });
    mockedStorage.getDueDiligence.mockResolvedValue(null);
    mockedStorage.upsertDueDiligence.mockResolvedValue({});
    mockedStorage.getSystemSetting.mockResolvedValue({});
  });

  it("onPackArrived builds SFP from ingestSfpFromPack, not from the event log", async () => {
    mockedStorage.getAgenticDeal.mockResolvedValue(deal());
    vi.mocked(ingestSfpFromPack).mockResolvedValue({
      status: "PARTIAL",
      missing: ["no sourced figures from the pack"],
      documents: packDocuments,
      fundingReason: "Stacked MCA refinance",
      figures: {},
    });
    await agenticWorkflow.onPackArrived(88);
    expect(ingestSfpFromPack).toHaveBeenCalledWith(
      expect.objectContaining({
        documents: packDocuments,
        fundingReason: "Stacked MCA refinance",
        companyNumber: "12345678",
      }),
    );
    const arg = vi.mocked(ingestSfpFromPack).mock.calls[0][0] as { documents?: unknown; events?: unknown };
    expect(arg.events).toBeUndefined();
  });

  it("runProcessing underwrites from sourced pack figures", async () => {
    const complete = {
      status: "COMPLETE" as const,
      missing: [] as string[],
      documents: packDocuments,
      fundingReason: "Stacked MCA refinance",
      figures: {
        turnoverGbp: { value: 121943, source: "accounts-2024.pdf" },
        netProfitGbp: { value: 10174, source: "accounts-2024.pdf" },
      },
    };
    vi.mocked(ingestSfpFromPack).mockResolvedValue(complete);
    const updated = await agenticWorkflow.runProcessing(deal() as never);
    expect(ingestSfpFromPack).toHaveBeenCalled();
    expect(updated.sfp?.status).toBe("COMPLETE");
    expect(updated.sfp?.figures.turnoverGbp?.source).toBe("accounts-2024.pdf");
    expect(updated.stage).toBe("human_review");
    expect(JSON.stringify(updated.sfp?.figures)).not.toMatch(/999999/);
  });
});
