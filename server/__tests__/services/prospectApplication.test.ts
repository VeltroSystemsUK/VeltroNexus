import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../storage", () => ({
  storage: {
    getProspectById: vi.fn(),
    getDueDiligence: vi.fn(),
    listContacts: vi.fn(),
    upsertDueDiligence: vi.fn(),
  },
}));

import { storage } from "../../storage";
import { sendProspectApplication } from "../../services/prospectApplication";

const mocked = storage as unknown as {
  getProspectById: ReturnType<typeof vi.fn>;
  getDueDiligence: ReturnType<typeof vi.fn>;
  listContacts: ReturnType<typeof vi.fn>;
  upsertDueDiligence: ReturnType<typeof vi.fn>;
};

describe("sendProspectApplication", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.getProspectById.mockResolvedValue({
      id: 9,
      userId: "u1",
      company: { companyName: "THE HOME CRAFTERS LTD." },
      loanAmount: null,
      term: null,
    });
    mocked.getDueDiligence.mockResolvedValue({ data: {} });
    mocked.listContacts.mockResolvedValue([]);
    mocked.upsertDueDiligence.mockResolvedValue({});
  });

  it("returns a public /apply/ URL and records sentAt", async () => {
    const sent = await sendProspectApplication(9);
    expect(sent.url).toMatch(/\/apply\/[A-Za-z0-9_-]+$/);
    expect(mocked.upsertDueDiligence).toHaveBeenCalledWith(
      9,
      "u1",
      expect.objectContaining({
        applicationData: expect.objectContaining({
          status: "sent",
          token: expect.any(String),
          sentAt: expect.any(String),
        }),
      }),
    );
  });
});
