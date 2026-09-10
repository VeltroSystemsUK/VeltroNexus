import { describe, expect, it } from "vitest";
import { applyPostVisual, composeSocialPost } from "@/components/craft/lib/composePost";
import { copyFromAmmo, curateVisual, MARKETING_DIRECTOR_PROMPT } from "@shared/craftDirector";
import { generateWeek } from "@shared/craftQueue";
import type { CraftAsset } from "@/components/craft/lib/types";

const ASSET: CraftAsset = {
  id: "visual_test",
  name: "desk.jpg",
  mime: "image/jpeg",
  dataUrl: "data:image/jpeg;base64,QQ==",
};

describe("Marketing Director visual curation", () => {
  it("pairs each week post with a stock visual that matches the track", () => {
    const week = generateWeek("2026-08-31");
    for (const post of week) {
      expect(post.visual?.stockId).toBeTruthy();
      const cue = curateVisual(post);
      expect(cue.stockId).toBe(post.visual!.stockId);
      expect(cue.query.length).toBeGreaterThan(8);
      expect(cue.prompt.toLowerCase()).not.toContain("synergy");
    }
    const borrower = week.find((p) => p.track === "borrower")!;
    const introducer = week.find((p) => p.track === "introducer")!;
    expect(curateVisual(borrower).stockId).not.toBe("");
    expect(curateVisual(introducer).query.toLowerCase()).toMatch(/pack|file|desk|paper|meeting|office/);
  });

  it("places the curated image into the media / accent slot", () => {
    const post = generateWeek("2026-08-31")[5]!;
    const doc = applyPostVisual(composeSocialPost(post), ASSET, "plain", { weekday: post.weekday });
    expect(doc.assets.some((asset) => asset.id === ASSET.id)).toBe(true);
    const visuals = doc.pages.flatMap((page) =>
      page.name === post.weekday
        ? page.nodes.filter((node) => node.type === "image" && (node.name === "Visual" || node.name === "Media frame"))
        : [],
    );
    expect(visuals.length).toBeGreaterThan(0);
    expect(visuals[0]).toMatchObject({ assetId: ASSET.id, objectFit: "cover" });
  });

  it("hangs a Yaffle still without the editorial frame and wash", () => {
    const post = generateWeek("2026-08-31")[5]!;
    const yaffle = { ...ASSET, id: "yaffle_x", name: "Yaffle" };
    const doc = applyPostVisual(composeSocialPost(post), yaffle, "plain", { weekday: post.weekday });
    const page = doc.pages.find((item) => item.name === post.weekday) ?? doc.pages[0]!;
    const visual = page.nodes.find((node) => node.type === "image" && (node.name === "Visual" || node.name === "Media frame"));
    expect(visual?.type === "image" ? visual.strokeWidth ?? 0 : -1).toBe(0);
    expect(visual?.type === "image" ? visual.tintOpacity ?? 0 : -1).toBe(0);
    expect(visual?.type === "image" ? visual.brightness : 0).toBe(1);
  });

  it("Sunday ammo is silence, not a two-beat card with a CTA", () => {
    const brief = {
      id: "ammo_sun",
      track: "borrower" as const,
      headline: "Companies House is identity",
      source: "test",
      coreFact: "A number opens a file",
      smeImpact: "The pack is what gets you heard. We do not lend.",
      trigger: "patience",
      freshAngle: "Silence after density",
      dataBites: ["missing"],
      socialAngle: "Leave the board empty enough.",
      emailAngle: "email",
      stockId: "studio",
      imagePrompt: "UK desk",
    };
    const sun = copyFromAmmo(brief, "sunday-silence");
    expect(sun.cta).toBe("");
    expect(sun.hashtags).toEqual([]);
    expect(sun.body).toBe("");
    expect(sun.hook.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(8);
    expect(sun.hook2).toMatch(/do not lend|packager/i);
  });

  it("never chops a body mid-word to bolt on We do not lend", () => {
    const copy = copyFromAmmo({
      id: "ammo_clip",
      track: "borrower",
      headline: "The letter says annual review",
      source: "test",
      coreFact: "Overdrafts get cut in the annual letter",
      smeImpact:
        "A haulage operator running a seasonal overdraft to cover fuel costs before autumn contracts pay out gets a letter.",
      trigger: "review",
      freshAngle: "Annual review is a cut",
      dataBites: ["MISSING"],
      socialAngle: "It says annual review. They just cut the line.",
      emailAngle: "email",
      stockId: "desk",
      imagePrompt: "UK desk",
    });
    expect(copy.body).not.toMatch(/\bWe$/);
    expect(copy.body).not.toMatch(/\bWe build$/);
    expect(copy.body).not.toMatch(/\b(the|a|an|to|your|our|for|of|and|or|with)$/i);
    expect(copy.hook).not.toMatch(/\b(the|a|an|to|your|our)$/i);
    expect(copy.hook2).not.toMatch(/\b(the|a|an|to|your|our)$/i);
  });

  it("uses Isla's written card when the brief already has the four fields", () => {
    const copy = copyFromAmmo(
      {
        id: "ammo_card",
        track: "borrower",
        headline: "The letter says annual review",
        source: "test",
        coreFact: "Overdrafts get cut in the annual letter",
        smeImpact: "raw casey",
        trigger: "review",
        freshAngle: "Annual review is a cut",
        dataBites: ["MISSING"],
        socialAngle: "Casey angle that must not land",
        emailAngle: "email",
        stockId: "desk",
        imagePrompt: "UK desk",
        hook: "The letter says annual review.",
        hook2: "They just cut the line.",
        body: "A seasonal overdraft is a decision, not a favour.",
        cta: "Send the file.",
      },
      "monday-two-beat",
    );
    expect(copy.hook).toBe("The letter says annual review.");
    expect(copy.hook2).toBe("They just cut the line.");
    expect(copy.body).toBe("A seasonal overdraft is a decision, not a favour.");
    expect(copy.cta).toBe("Send the file.");
  });

  it("Friday without a verified count stays a complete line, not a fake rate", () => {
    const copy = copyFromAmmo(
      {
        id: "ammo_fri",
        track: "introducer",
        headline: "Consumer Duty tone in commercial files",
        source: "MISSING",
        coreFact: "MISSING",
        smeImpact: "An accountant referring a limited company notices the lender asking for more paperwork.",
        trigger: "duty",
        freshAngle: "The tone leaked into commercial",
        dataBites: ["MISSING"],
        socialAngle: "Consumer Duty doesn't cover your commercial client.",
        emailAngle: "email",
        stockId: "accountant",
        imagePrompt: "UK desk",
      },
      "friday-number",
    );
    expect(copy.body).not.toMatch(/\bWe build$/);
    expect(copy.hook).not.toMatch(/\byour$/);
    expect(copy.hook + copy.hook2 + copy.body).not.toMatch(/%|\bAPR\b/i);
  });

  it("keeps the Creative Director spec free of banned claims", () => {
    expect(MARKETING_DIRECTOR_PROMPT).toMatch(/do not lend/i);
    expect(MARKETING_DIRECTOR_PROMPT).toMatch(/visual/i);
    expect(MARKETING_DIRECTOR_PROMPT).not.toMatch(/guaranteed funding/i);
  });

  it("briefs Isla to use frames, shadows, motion and a two-colour hero on the board", () => {
    expect(MARKETING_DIRECTOR_PROMPT).toMatch(/frame/i);
    expect(MARKETING_DIRECTOR_PROMPT).toMatch(/shadow/i);
    expect(MARKETING_DIRECTOR_PROMPT).toMatch(/motion/i);
    expect(MARKETING_DIRECTOR_PROMPT).toMatch(/hook 1/i);
    expect(MARKETING_DIRECTOR_PROMPT).toMatch(/grok/i);
  });
});
