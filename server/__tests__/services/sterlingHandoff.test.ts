import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../storage", () => ({
  storage: {
    getUserByEmail: vi.fn(),
    getBrokerHandoffByProspect: vi.fn(),
    getUnderwritingSubmissionByProspect: vi.fn(),
    createBrokerHandoff: vi.fn(),
    updateBrokerHandoff: vi.fn(),
    getProspectById: vi.fn(),
    updateProspectStage: vi.fn(),
    updateUnderwritingSubmission: vi.fn(),
    createUnderwritingActivity: vi.fn(),
  },
}));

import { storage } from "../../storage";
import {
  canCreateOrReopenUnderwriting,
  ensureSterlingHandoff,
  markSterlingReturned,
} from "../../services/sterlingHandoff";

const mocked = storage as unknown as {
  getUserByEmail: ReturnType<typeof vi.fn>;
  getBrokerHandoffByProspect: ReturnType<typeof vi.fn>;
  getUnderwritingSubmissionByProspect: ReturnType<typeof vi.fn>;
  createBrokerHandoff: ReturnType<typeof vi.fn>;
  updateBrokerHandoff: ReturnType<typeof vi.fn>;
  getProspectById: ReturnType<typeof vi.fn>;
  updateProspectStage: ReturnType<typeof vi.fn>;
  updateUnderwritingSubmission: ReturnType<typeof vi.fn>;
  createUnderwritingActivity: ReturnType<typeof vi.fn>;
};

describe("canCreateOrReopenUnderwriting", () => {
  it("blocks a second submit while underwriting is still live", () => {
    expect(canCreateOrReopenUnderwriting({ submissionStatus: "submitted" })).toBe("blocked");
    expect(canCreateOrReopenUnderwriting({ submissionStatus: "in_review" })).toBe("blocked");
  });

  it("reopens when Sterling has returned the file, even if the submission row is still submitted", () => {
    expect(canCreateOrReopenUnderwriting({ submissionStatus: "returned" })).toBe("reopen");
    expect(
      canCreateOrReopenUnderwriting({ submissionStatus: "submitted", handoffStatus: "returned" }),
    ).toBe("reopen");
  });

  it("creates a new submission when none exists or the last one is finished", () => {
    expect(canCreateOrReopenUnderwriting({})).toBe("create");
    expect(canCreateOrReopenUnderwriting({ submissionStatus: "declined" })).toBe("create");
    expect(canCreateOrReopenUnderwriting({ submissionStatus: "withdrawn" })).toBe("create");
  });
});

describe("ensureSterlingHandoff", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.BROKER_HANDOFF_EMAIL = "david@sterling.test";
  });

  it("skips when the partner account is missing", async () => {
    mocked.getUserByEmail.mockResolvedValue(undefined);
    const result = await ensureSterlingHandoff({ prospectId: 1, userId: "u1" });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not configured/i);
  });

  it("still hands files to David when his account is temporarily on a full-app role", async () => {
    mocked.getUserByEmail.mockResolvedValue({ id: "p1", role: "sales_admin" });
    mocked.getBrokerHandoffByProspect.mockResolvedValue(undefined);
    mocked.createBrokerHandoff.mockResolvedValue({ id: 3, status: "awaiting_recommendation" });
    const result = await ensureSterlingHandoff({ prospectId: 73, userId: "u1", submissionId: 3 });
    expect(result.ok).toBe(true);
    expect(mocked.createBrokerHandoff).toHaveBeenCalledWith(
      expect.objectContaining({ externalUserId: "p1", prospectId: 73 })
    );
  });

  it("does not reopen a sent file", async () => {
    mocked.getUserByEmail.mockResolvedValue({ id: "p1", role: "external_broker" });
    mocked.getBrokerHandoffByProspect.mockResolvedValue({ id: 9, status: "sent" });
    const result = await ensureSterlingHandoff({ prospectId: 1, userId: "u1" });
    expect(result.ok).toBe(true);
    expect(mocked.createBrokerHandoff).not.toHaveBeenCalled();
    expect(mocked.updateBrokerHandoff).not.toHaveBeenCalled();
  });

  it("creates a handoff for a newly submitted file", async () => {
    mocked.getUserByEmail.mockResolvedValue({ id: "p1", role: "external_broker" });
    mocked.getBrokerHandoffByProspect.mockResolvedValue(undefined);
    mocked.createBrokerHandoff.mockResolvedValue({ id: 3, status: "awaiting_recommendation" });
    const result = await ensureSterlingHandoff({ prospectId: 73, userId: "u1", submissionId: 3 });
    expect(result.ok).toBe(true);
    expect(mocked.createBrokerHandoff).toHaveBeenCalledWith(
      expect.objectContaining({
        prospectId: 73,
        submissionId: 3,
        externalUserId: "p1",
        status: "awaiting_recommendation",
      }),
    );
  });

  it("reopens a returned file as awaiting recommendation", async () => {
    mocked.getUserByEmail.mockResolvedValue({ id: "p1", role: "external_broker" });
    mocked.getBrokerHandoffByProspect.mockResolvedValue({ id: 9, status: "returned" });
    mocked.updateBrokerHandoff.mockResolvedValue({ id: 9, status: "awaiting_recommendation" });
    const result = await ensureSterlingHandoff({ prospectId: 1, userId: "u1", submissionId: 4 });
    expect(result.ok).toBe(true);
    expect(mocked.updateBrokerHandoff).toHaveBeenCalledWith(9, {
      submissionId: 4,
      status: "awaiting_recommendation",
    });
  });
});

describe("markSterlingReturned", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("drops the prospect onto Process Outcome Further Information", async () => {
    mocked.updateBrokerHandoff.mockResolvedValue({ id: 1, status: "returned" });
    mocked.getProspectById.mockResolvedValue({ id: 73, userId: "owner-1" });
    mocked.updateProspectStage.mockResolvedValue({ id: 73, stage: "further-information" });
    mocked.updateUnderwritingSubmission.mockResolvedValue({ id: 3, status: "returned" });
    mocked.createUnderwritingActivity.mockResolvedValue({});

    await markSterlingReturned({
      handoff: { id: 1, prospectId: 73, submissionId: 3 },
      note: "Need VAT correspondence",
      userId: "david",
    });

    expect(mocked.updateProspectStage).toHaveBeenCalledWith(73, "owner-1", "further-information");
  });
});
