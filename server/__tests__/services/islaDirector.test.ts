import { describe, expect, it } from "vitest";
import { MARKETING_DIRECTOR_PROMPT } from "@shared/craftDirector";
import type { CreativeAmmoBrief } from "@shared/craftScout";
import { ISLA_WEEK_SYSTEM, craftBrief, craftWeek } from "../../services/islaDirector";

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

  it("injects the weekday playbook so Monday is a two-beat board", async () => {
    let user = "";
    await craftBrief(BRIEF, async (prompt) => {
      user = prompt;
      return JSON.stringify({
        socialAngle: "The bank took eight weeks to say no. Here is week one.",
        smeImpact: "A complete file changes the wait.",
      });
    }, "monday-two-beat");
    expect(user).toMatch(/monday-two-beat/);
    expect(user).toMatch(/Hook 2 is the correction/i);
    expect(user).toMatch(/horizon-shift/);
  });

  it("Sunday copy is one line of eight words, not a two-beat card", async () => {
    let user = "";
    const next = await craftBrief(BRIEF, async (prompt) => {
      user = prompt;
      return JSON.stringify({
        socialAngle: "Leave the board empty enough.",
        smeImpact: "We package. We do not lend.",
      });
    }, "sunday-silence");
    expect(user).toMatch(/eight words|8 words|one line/i);
    expect(user).not.toMatch(/TWO short clauses/);
    expect(next.socialAngle).toBe("Leave the board empty enough.");
  });

  it("Friday copy must carry a count, not a rate", async () => {
    let user = "";
    const next = await craftBrief(BRIEF, async (prompt) => {
      user = prompt;
      return JSON.stringify({
        socialAngle: "Twenty-two things on the file. Then a decision.",
        smeImpact: "One integer. We package it. We do not lend.",
      });
    }, "friday-number");
    expect(user).toMatch(/integer|count|number/i);
    expect(next.socialAngle).toMatch(/twenty-two|22/i);
  });

  it("spec demands a full card and a week argument, not two leftover fields", () => {
    expect(ISLA_WEEK_SYSTEM).toMatch(/"hook"/);
    expect(ISLA_WEEK_SYSTEM).toMatch(/"hook2"/);
    expect(ISLA_WEEK_SYSTEM).toMatch(/"body"/);
    expect(ISLA_WEEK_SYSTEM).toMatch(/"cta"/);
    expect(ISLA_WEEK_SYSTEM).toMatch(/complete sentence/i);
    expect(ISLA_WEEK_SYSTEM).toMatch(/seven beats|week argument/i);
    expect(ISLA_WEEK_SYSTEM).toMatch(/never end on/i);
    expect(ISLA_WEEK_SYSTEM.length).toBeLessThan(4000);
  });

  it("stamps Isla's four-field card onto the brief", async () => {
    const next = await craftBrief(BRIEF, async () =>
      JSON.stringify({
        hook: "The bank took eight weeks.",
        hook2: "Here is week one.",
        body: "A complete file changes the wait.",
        cta: "Send the pack.",
      }),
    );
    expect(next.hook).toBe("The bank took eight weeks.");
    expect(next.hook2).toBe("Here is week one.");
    expect(next.body).toBe("A complete file changes the wait.");
    expect(next.cta).toBe("Send the pack.");
    expect(next.socialAngle).toMatch(/eight weeks/i);
  });

  it("rejects a dangling hook and keeps Casey's angle", async () => {
    const next = await craftBrief(
      BRIEF,
      async () =>
        JSON.stringify({
          hook: "Consumer Duty doesn't cover your",
          hook2: "commercial client",
          body: "An accountant referring a client notices the lender asking for far more We build",
          cta: "Talk to Strata",
        }),
      "monday-two-beat",
    );
    expect(next.socialAngle).toBe(BRIEF.socialAngle);
    expect(next.hook).toBeUndefined();
  });

  it("craftWeek sends one week argument with all seven days", async () => {
    let user = "";
    const briefs = Array.from({ length: 7 }, (_, i) => ({ ...BRIEF, id: `ammo_${i}`, headline: `Headline ${i}` }));
    const week = await craftWeek(briefs, async (prompt) => {
      user = prompt;
      return JSON.stringify(
        briefs.map((_, i) => ({
          hook: i === 4 ? "22 files on the desk." : "The bank took eight weeks.",
          hook2: i === 6 ? "" : "Here is week one.",
          body: i === 6 ? "" : "A complete file changes the wait.",
          cta: i === 0 || i === 4 ? "Send the pack." : "",
        })),
      );
    });
    expect(user).toMatch(/Headline 0/);
    expect(user).toMatch(/Headline 6/);
    expect(user).toMatch(/monday-two-beat/);
    expect(user).toMatch(/sunday-silence/);
    expect(user).toMatch(/seven beats|week argument/i);
    expect(week[0]!.hook).toMatch(/eight weeks/i);
    expect(week[4]!.hook).toMatch(/22/);
  });
});
