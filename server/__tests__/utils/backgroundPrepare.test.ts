import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../utils/geminiClient", () => ({
  generateCampariSection: vi.fn(async () =>
    [
      "Incorporated in March 2016 and still trading.",
      "Sole director Kirsty Bevan holds the shares.",
      "Physical shop at Yate Shopping Centre in Bristol.",
      "Online shop ships hobby and craft goods UK-wide.",
      "Workshops run for adults and school holidays.",
      "The file is a refinance of stacked short-term facilities.",
      "Trading is omnichannel retail with stock on hand.",
      "Loyalty scheme CRAFTY PERKS is in use.",
      "No group companies sit around this borrower.",
      "Distress is cash-flow timing rather than lost trade.",
    ].join("\n"),
  ),
}));

vi.mock("../../storage", () => ({
  storage: {
    getDueDiligence: vi.fn(async () => ({ id: 1, prospectId: 85, data: {} })),
    upsertDueDiligence: vi.fn(async () => ({ id: 1 })),
  },
}));

import { ensureBackground } from "../../utils/backgroundPrepare";
import { storage } from "../../storage";

afterEach(() => {
  vi.clearAllMocks();
});

describe("ensureBackground", () => {
  it("rewrites up to ten background bullets and persists them", async () => {
    const out = await ensureBackground({
      prospect: {
        id: 85,
        userId: "user-1",
        company: { companyName: "THE HOME CRAFTERS LTD", sicDescription: "Retail" },
        loanRequirementNotes: "Repay short term loans",
      },
      contacts: [],
      dueDiligence: { data: { proposal: { slots: { background: ["Old line."] } } } },
    } as any);

    const bullets = (out.dueDiligence as any).data.proposal.slots.background as string[];
    expect(bullets.length).toBeGreaterThan(5);
    expect(bullets.length).toBeLessThanOrEqual(10);
    expect(bullets.join(" ")).toMatch(/Yate|Bristol|refinance/i);
    expect(storage.upsertDueDiligence).toHaveBeenCalled();
  });
});
