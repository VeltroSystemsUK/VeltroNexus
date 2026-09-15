import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENGAGEMENT_PACK_VERSION } from "@shared/engagementPack";

vi.mock("../../storage", () => ({
  storage: {
    getAgenticDeal: vi.fn(),
    updateAgenticDeal: vi.fn(),
    listProspectDocuments: vi.fn(),
    getSystemSetting: vi.fn(),
  },
}));
vi.mock("../../services/sterlingHandoff", () => ({
  ensureSterlingHandoff: vi.fn(),
  markDealCompleteFromSterlingPack: vi.fn(),
}));
vi.mock("../../services/sterlingPack", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/sterlingPack")>();
  return { ...actual, compileSterlingRailPack: vi.fn() };
});

import { storage } from "../../storage";
import { ensureSterlingHandoff } from "../../services/sterlingHandoff";
import { compileSterlingRailPack } from "../../services/sterlingPack";
import { agenticWorkflow } from "../../services/agenticWorkflow";

const mockedStorage = storage as unknown as {
  getAgenticDeal: ReturnType<typeof vi.fn>;
  updateAgenticDeal: ReturnType<typeof vi.fn>;
};

function completeDeal() {
  return {
    id: 88,
    prospectId: 42,
    ownerUserId: "shaun",
    stage: "human_review",
    status: "waiting_human",
    companyName: "Acme Joinery Limited",
    companyNumber: "12345678",
    fundingReason: "Stacked MCA refinance",
    packDocuments: [
      { fileName: "june.pdf", category: "bank-statements" },
      { fileName: "accounts.pdf", category: "accounts" },
      { fileName: "cff.xlsx", category: "cashflow" },
      { fileName: "debts.xlsx", category: "debt-schedule" },
      { fileName: "passport.pdf", category: "id" },
    ],
    sfp: { status: "COMPLETE" },
    bbbEligibility: { status: "pass" },
    underwritingJudgement: "Recommendation only — Supportable.",
    engagement: {
      status: "signed",
      version: ENGAGEMENT_PACK_VERSION,
      signedName: "Jane Hartley",
      privacyAccepted: true,
      termsAccepted: true,
    },
    events: [],
  };
}

describe("approve_sterling one rail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedStorage.updateAgenticDeal.mockImplementation(async (id: number, patch: object) => ({
      ...completeDeal(),
      id,
      ...patch,
    }));
  });

  it("does not mark complete when the zip compile fails", async () => {
    mockedStorage.getAgenticDeal.mockResolvedValue(completeDeal());
    vi.mocked(ensureSterlingHandoff).mockResolvedValue({ ok: true, handoff: { id: 11, prospectId: 42 } });
    vi.mocked(compileSterlingRailPack).mockRejectedValue(
      Object.assign(new Error("File is not complete for Sterling: Cash flow forecast"), { status: 400 }),
    );
    await expect(agenticWorkflow.resolveHuman(88, "approve_sterling")).rejects.toThrow(/not complete/i);
    const patches = mockedStorage.updateAgenticDeal.mock.calls.map((call) => call[1]);
    expect(patches.some((patch) => patch && (patch as { stage?: string }).stage === "complete")).toBe(false);
  });

  it("marks complete only after the zip is compiled", async () => {
    mockedStorage.getAgenticDeal.mockResolvedValue(completeDeal());
    vi.mocked(ensureSterlingHandoff).mockResolvedValue({
      ok: true,
      handoff: { id: 11, prospectId: 42, recommendation: "" },
    });
    vi.mocked(compileSterlingRailPack).mockResolvedValue({
      buffer: Buffer.from("zip"),
      filename: "pack.zip",
      compiledAt: "2026-09-15T08:00:00.000Z",
      lenderId: "ffe",
    });
    const updated = await agenticWorkflow.resolveHuman(88, "approve_sterling");
    expect(compileSterlingRailPack).toHaveBeenCalledWith(
      expect.objectContaining({
        handoff: expect.objectContaining({ id: 11 }),
        underwritingJudgement: "Recommendation only — Supportable.",
      }),
    );
    expect(updated.stage).toBe("complete");
    expect(updated.sterlingPackCompiledAt).toBe("2026-09-15T08:00:00.000Z");
    expect(updated.sterlingHandoffId).toBe(11);
  });
});
