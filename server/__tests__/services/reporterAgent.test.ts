import { describe, expect, it } from "vitest";
import { reporterUserPrompt } from "../../services/reporterAgent";

describe("reporterUserPrompt", () => {
  it("grounds the digest in the given notes and names the section", () => {
    const prompt = reporterUserPrompt(
      "uk_economy",
      [{ title: "Bank Rate held", url: "https://example.com/rate", snippet: "The Bank of England held rates." }],
      "2026-09-03",
    );
    expect(prompt).toContain("UK Economy");
    expect(prompt).toContain("2026-09-03");
    expect(prompt).toContain("https://example.com/rate");
    expect(prompt).not.toMatch(/no notes landed/i);
  });

  it("tells the writer not to invent stories when no notes landed", () => {
    const prompt = reporterUserPrompt("uk_politics", [], "2026-09-03");
    expect(prompt).toMatch(/no notes landed/i);
    expect(prompt).toMatch(/inventing stories/i);
  });
});
