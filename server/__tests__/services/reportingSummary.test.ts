import { describe, expect, it } from "vitest";
import { composeProgressSummary } from "../../services/reportingService";

const input = {
  weekNumber: 5,
  completedPlanned: ["Ship pack upload"],
  completedExtra: [] as string[],
  sales: {
    emailsSent: 12,
    emailsOpened: 4,
    linksClicked: 2,
    repliesReceived: 1,
    inboundProspects: [{ companyName: "Acme Joinery Ltd", contactName: "Jane Smith" }],
  },
};

describe("composeProgressSummary", () => {
  it("uses the model text when the ask succeeds", async () => {
    const text = await composeProgressSummary(input, async () => ({
      text: "We shipped pack upload and opened 4 of 12 outbound emails.",
      engine: { provider: "anthropic", model: "claude" },
    }));
    expect(text).toBe("We shipped pack upload and opened 4 of 12 outbound emails.");
  });

  it("falls back to the factual summary when the ask fails", async () => {
    const spy = console.error;
    console.error = () => {};
    try {
      const text = await composeProgressSummary(input, async () => {
        throw new Error("no key");
      });
      expect(text).toMatch(/Ship pack upload/);
      expect(text).toMatch(/12 emails/);
      expect(text).toMatch(/Acme Joinery Ltd/);
    } finally {
      console.error = spy;
    }
  });
});
