import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../storage", () => ({
  storage: {
    listAgenticDeals: vi.fn(),
    updateAgenticDeal: vi.fn(),
  },
}));

import { storage } from "../../storage";
import {
  clearAgentMail,
  recordInbound,
  setAgentMailStorePathForTests,
} from "../../services/agentMailLog";

const mocked = storage as unknown as {
  listAgenticDeals: ReturnType<typeof vi.fn>;
  updateAgenticDeal: ReturnType<typeof vi.fn>;
};

describe("recordInbound opt-out", () => {
  beforeEach(() => {
    const file = path.join(os.tmpdir(), `agent-mail-opt-${process.pid}-${Date.now()}.json`);
    setAgentMailStorePathForTests(file);
    mocked.listAgenticDeals.mockResolvedValue([
      {
        id: 3780,
        email: "homecraftersuk@gmail.com",
        prospectId: 85,
        stage: "fulfilment",
        events: [],
      },
    ]);
    mocked.updateAgenticDeal.mockResolvedValue({});
  });

  afterEach(() => {
    clearAgentMail();
    setAgentMailStorePathForTests(null);
  });

  it("does not fail the deal when the only stop is the quoted house line", async () => {
    await recordInbound({
      from: "homecraftersuk@gmail.com",
      to: "enquiries@stratafinance.co.uk",
      subject: "Re: Thanks for your enquiry — THE HOME CRAFTERS LTD.",
      text:
        "Thanks James, I'll send the statements.\n\nOn 5 Sep 2026, James Hale wrote:\n> Hi\n> If this isn't useful, reply stop and we won't email again.",
    });
    const patches = mocked.updateAgenticDeal.mock.calls.map((call) => call[1]);
    expect(patches.some((patch) => patch && (patch as { stage?: string }).stage === "failed")).toBe(false);
  });

  it("fails the deal on a real STOP", async () => {
    await recordInbound({
      from: "homecraftersuk@gmail.com",
      to: "enquiries@stratafinance.co.uk",
      subject: "STOP",
      text: "STOP",
    });
    expect(mocked.updateAgenticDeal).toHaveBeenCalledWith(
      3780,
      expect.objectContaining({ stage: "failed", status: "failed" }),
    );
  });
});
