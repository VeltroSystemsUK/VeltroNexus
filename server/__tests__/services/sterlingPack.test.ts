import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../storage", () => ({
  storage: {
    getProspectById: vi.fn(),
    getDueDiligence: vi.fn(),
    listContacts: vi.fn(),
    listProspectDocuments: vi.fn(),
    listExceptionsForProspect: vi.fn(),
    upsertDueDiligence: vi.fn(),
    updateBrokerHandoff: vi.fn(),
  },
}));

vi.mock("../../utils/prospectReport", () => ({
  buildProspectReportData: vi.fn(async (prospect: any) => ({
    prospect,
    dueDiligence: { data: {} },
  })),
}));

vi.mock("../../utils/fundingProposal", () => ({
  renderFundingProposalPdf: vi.fn(async () => Buffer.from("%PDF-fake")),
  renderFundingProposalHtmlFromData: vi.fn(() => "<html></html>"),
}));

vi.mock("@shared/proposalFacts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@shared/proposalFacts")>();
  return {
    ...actual,
    assertProposalReady: vi.fn(),
    buildProposal: vi.fn(() => ({})),
    proposalSourceFromFile: vi.fn(() => ({})),
  };
});

import { storage } from "../../storage";
import { buildSterlingPackZip, compileSterlingRailPack } from "../../services/sterlingPack";

const mocked = storage as unknown as {
  getProspectById: ReturnType<typeof vi.fn>;
  getDueDiligence: ReturnType<typeof vi.fn>;
  listContacts: ReturnType<typeof vi.fn>;
  listProspectDocuments: ReturnType<typeof vi.fn>;
  listExceptionsForProspect: ReturnType<typeof vi.fn>;
  updateBrokerHandoff: ReturnType<typeof vi.fn>;
};

const prospect = {
  id: 42,
  userId: "u1",
  company: { companyName: "THE HOME CRAFTERS LTD.", companyNumber: "10034885" },
  loanAmount: 12_000_000,
  term: 60,
  fundingReason: "Stacked MCA refinance",
};

const documents = [
  { id: 1, fileName: "june.pdf", category: "bank-statements", storagePath: "/tmp/june.pdf" },
  { id: 2, fileName: "accounts-2024.pdf", category: "accounts", storagePath: "/tmp/accounts.pdf" },
  { id: 3, fileName: "cff.xlsx", category: "cashflow", storagePath: "/tmp/cff.xlsx" },
  { id: 4, fileName: "debts.xlsx", category: "debt-schedule", storagePath: "/tmp/debts.xlsx" },
  { id: 5, fileName: "passport.pdf", category: "id", storagePath: "/tmp/id.pdf" },
];

function seedStorage(applicationData: unknown) {
  mocked.getProspectById.mockResolvedValue(prospect);
  mocked.getDueDiligence.mockResolvedValue({
    data: {
      applicationData,
      checklist: [],
      underwriting: { sfp: { status: "COMPLETE", fundingReason: "Stacked MCA refinance" } },
    },
  });
  mocked.listContacts.mockResolvedValue([{ id: 1, name: "Kirsty Bevan", role: "Director" }]);
  mocked.listProspectDocuments.mockResolvedValue(documents);
  mocked.listExceptionsForProspect.mockResolvedValue([]);
}

describe("sterling pack application gate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("refuses the zip until the customer has e-signed", async () => {
    seedStorage({ status: "sent", answers: { legalName: "THE HOME CRAFTERS LTD." }, directors: [] });
    await expect(
      buildSterlingPackZip({
        handoff: { prospectId: 42, recommendation: "Supportable subject to statements." },
        lenderId: "ffe",
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/e-sign the application/i),
    });
  });

  it("puts the filled Word application in the zip once signed", async () => {
    seedStorage({
      status: "signed",
      signedAt: "2026-09-09T12:00:00Z",
      signedName: "Kirsty Bevan",
      answers: { legalName: "THE HOME CRAFTERS LTD.", loanAmount: "£120,000" },
      directors: [{ id: "d1", fullName: "Kirsty Bevan" }],
    });
    const pack = await buildSterlingPackZip({
      handoff: { prospectId: 42, recommendation: "Supportable subject to statements." },
      lenderId: "ffe",
    });
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(pack.buffer);
    const name = Object.keys(zip.files).find((file) => file.endsWith("-ffe-application.docx"));
    expect(name).toBeTruthy();
    const inner = await JSZip.loadAsync(await zip.file(name!)!.async("nodebuffer"));
    const xml = await inner.file("word/document.xml")!.async("string");
    expect(xml).toContain("THE HOME CRAFTERS LTD.");
    expect(xml).toContain("Kirsty Bevan");
  });

  it("compileSterlingRailPack stamps packGeneratedAt on the handoff", async () => {
    seedStorage({
      status: "signed",
      signedAt: "2026-09-09T12:00:00Z",
      signedName: "Kirsty Bevan",
      answers: { legalName: "THE HOME CRAFTERS LTD.", loanAmount: "£120,000" },
      directors: [{ id: "d1", fullName: "Kirsty Bevan" }],
    });
    mocked.updateBrokerHandoff.mockResolvedValue({});
    const result = await compileSterlingRailPack({
      handoff: { id: 11, prospectId: 42, recommendation: "Supportable subject to statements." },
      lenderId: "cwrt",
      signedBy: "Shaun",
    });
    expect(result.lenderId).toBe("cwrt");
    expect(result.compiledAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.buffer.length).toBeGreaterThan(0);
    expect(mocked.updateBrokerHandoff).toHaveBeenCalledWith(
      11,
      expect.objectContaining({
        approvedLenderId: "cwrt",
        packGeneratedAt: result.compiledAt,
        recommendation: "Supportable subject to statements.",
      }),
    );
  });

  it("compileSterlingRailPack refuses an empty recommendation", async () => {
    await expect(
      compileSterlingRailPack({ handoff: { id: 11, prospectId: 42, recommendation: "  " } }),
    ).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/recommendation/i) });
  });

  it("compileSterlingRailPack markSent writes status sent", async () => {
    seedStorage({
      status: "signed",
      signedAt: "2026-09-09T12:00:00Z",
      signedName: "Kirsty Bevan",
      answers: { legalName: "THE HOME CRAFTERS LTD.", loanAmount: "£120,000" },
      directors: [{ id: "d1", fullName: "Kirsty Bevan" }],
    });
    mocked.updateBrokerHandoff.mockResolvedValue({});
    await compileSterlingRailPack({
      handoff: { id: 11, prospectId: 42, recommendation: "Supportable subject to statements." },
      lenderId: "ffe",
      markSent: true,
    });
    expect(mocked.updateBrokerHandoff).toHaveBeenCalledWith(
      11,
      expect.objectContaining({ status: "sent", approvedLenderId: "ffe" }),
    );
  });
});
