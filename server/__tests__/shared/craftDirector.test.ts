import { describe, expect, it } from "vitest";
import { applyPostVisual, composeSocialPost } from "@/components/craft/lib/composePost";
import { curateVisual, MARKETING_DIRECTOR_PROMPT } from "@shared/craftDirector";
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
    const post = generateWeek("2026-08-31")[0]!;
    const doc = applyPostVisual(composeSocialPost(post), ASSET);
    expect(doc.assets.some((asset) => asset.id === ASSET.id)).toBe(true);
    const visuals = doc.pages.flatMap((page) =>
      page.nodes.filter((node) => node.type === "image" && node.name === "Visual")
    );
    expect(visuals.length).toBeGreaterThan(0);
    expect(visuals[0]).toMatchObject({ assetId: ASSET.id, objectFit: "cover" });
  });

  it("hangs a Yaffle still without the editorial frame and wash", () => {
    const post = generateWeek("2026-08-31")[0]!;
    const yaffle = { ...ASSET, id: "yaffle_x", name: "Yaffle" };
    const doc = applyPostVisual(composeSocialPost(post), yaffle, "plain");
    const visual = doc.pages[0]!.nodes.find((node) => node.type === "image" && node.name === "Visual");
    expect(visual?.type === "image" ? visual.strokeWidth ?? 0 : -1).toBe(0);
    expect(visual?.type === "image" ? visual.tintOpacity ?? 0 : -1).toBe(0);
    expect(visual?.type === "image" ? visual.brightness : 0).toBe(1);
  });

  it("keeps the Creative Director spec free of banned claims", () => {
    expect(MARKETING_DIRECTOR_PROMPT).toMatch(/do not lend/i);
    expect(MARKETING_DIRECTOR_PROMPT).toMatch(/visual/i);
    expect(MARKETING_DIRECTOR_PROMPT).not.toMatch(/guaranteed funding/i);
  });
});
