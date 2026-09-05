import { describe, expect, it } from "vitest";
import { MARKETING_DIRECTOR_PROMPT } from "@shared/craftDirector";
import type { CreativeAmmoBrief } from "@shared/craftScout";
import { ISLA_WEEK_SYSTEM, craftBrief } from "../../services/islaDirector";

const BRIEF: CreativeAmmoBrief = {
  id: "ammo_1",
  track: "borrower",
  headline: "Banks are slow",
  source: "test",
  coreFact: "Clearing can take weeks",
  smeImpact: "Directors wait with no plan",
  trigger: "decline",
  freshAngle: "The wait is the product",
  dataBites: ["missing"],
  socialAngle: "A long research sentence about clearing times that would wrap badly on a LinkedIn card",
  emailAngle: "email",
  stockId: "desk",
  imagePrompt: "UK desk",
};

describe("Isla week-desk pass", () => {
  it("uses a short v3 week system prompt, not the 67k persona dump", () => {
    expect(ISLA_WEEK_SYSTEM).toMatch(/CreativeDirector_MarketingExec_v3/);
    expect(ISLA_WEEK_SYSTEM).toMatch(/Hook 2/);
    expect(ISLA_WEEK_SYSTEM).toMatch(/do not lend/i);
    expect(ISLA_WEEK_SYSTEM).toMatch(/Casey's socialAngle/i);
    expect(ISLA_WEEK_SYSTEM.length).toBeLessThan(4000);
    expect(MARKETING_DIRECTOR_PROMPT.length).toBeGreaterThan(20000);
    expect(MARKETING_DIRECTOR_PROMPT).toMatch(/CreativeDirector_MarketingExec_v3/);
  });

  it("sends the week system prompt on craftBrief and keeps a two-beat hook", async () => {
    let system = "";
    let user = "";
    const next = await craftBrief(BRIEF, async (prompt, _model, sys) => {
      user = prompt;
      system = sys || "";
      return JSON.stringify({
        socialAngle: "The bank took eight weeks to say no. Here is week one.",
        smeImpact: "A complete file changes the wait.",
      });
    });
    expect(system).toBe(ISLA_WEEK_SYSTEM);
    expect(user).toMatch(/Do not quote Casey/i);
    expect(user).not.toContain(BRIEF.socialAngle);
    expect(next.socialAngle).toMatch(/eight weeks/i);
    expect(next.smeImpact).toMatch(/complete file/i);
    expect(next.socialAngle).not.toBe(BRIEF.socialAngle);
  });
});
