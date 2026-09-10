import { describe, expect, it } from "vitest";
import { AI_BULLET_INSTRUCTIONS, joinAiBullets, toAiBullets } from "@shared/aiBullets";

describe("toAiBullets", () => {
  it("splits an essay into one fact per line", () => {
    const out = toAiBullets(
      "The Home Crafters Ltd is a retailer in Yate. It trades online and from a shop. Customers include hobbyists."
    );
    expect(out.length).toBe(3);
    expect(out[0]).toMatch(/Home Crafters/);
    expect(out.join(" ")).not.toContain("\n\n");
  });

  it("keeps existing bullets and strips markdown", () => {
    const out = toAiBullets("# Character\n- Sole director Kirsty Bevan.\n- **Active** since 2016.");
    expect(out).toContain("Sole director Kirsty Bevan.");
    expect(out).toContain("Active since 2016.");
    expect(out.join(" ")).not.toContain("#");
  });

  it("caps the list", () => {
    const lines = Array.from({ length: 12 }, (_, i) => `Fact number ${i}.`).join("\n");
    expect(toAiBullets(lines, 6)).toHaveLength(6);
  });

  it("join round-trips for the editor", () => {
    expect(toAiBullets(joinAiBullets(["One fact.", "Two fact."]))).toEqual(["One fact.", "Two fact."]);
  });

  it("exports the prompt shape used by Auto Write", () => {
    expect(AI_BULLET_INSTRUCTIONS).toMatch(/No paragraphs/);
  });
});

describe("Auto Write surfaces demand bullets", () => {
  it("CAMPARI, SWOT, rewrite, and company profile prompts forbid paragraphs", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const gemini = readFileSync(resolve("server/utils/geminiClient.ts"), "utf8");
    const rewrite = readFileSync(resolve("server/routes.ts"), "utf8");
    const enrich = readFileSync(resolve("server/utils/companyEnrichment.ts"), "utf8");
    expect(gemini).toMatch(/No paragraphs, no essay/);
    expect(gemini).toMatch(/businessProfile must be 4 to 6 short bullet points/);
    expect(rewrite).toMatch(/AI_BULLET_INSTRUCTIONS/);
    expect(enrich).toMatch(/4-6 short bullet points/);
    expect(enrich).not.toMatch(/2-6 paragraph profile/);
  });
});
