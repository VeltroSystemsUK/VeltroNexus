import { describe, expect, it } from "vitest";
import { documentFromTemplate, presetById } from "@/components/craft/lib/templates";

/** LinkedIn personal cover: 1584×396. Desktop avatar sits over the bottom-left. */
const BANNER_W = 1584;
const BANNER_H = 396;
const AVATAR_W = 240;
const AVATAR_H = 160;

function intersectsAvatarZone(node: { x: number; y: number; width: number; height: number }): boolean {
  const zoneY = BANNER_H - AVATAR_H;
  return node.x < AVATAR_W && node.x + node.width > 0 && node.y < BANNER_H && node.y + node.height > zoneY;
}

describe("LinkedIn banner template", () => {
  it("uses the official personal-profile cover size 1584 × 396", () => {
    const preset = presetById("linkedin");
    expect(preset).toMatchObject({ width: BANNER_W, height: BANNER_H, name: "LinkedIn Banner" });

    const doc = documentFromTemplate("linkedin-banner");
    const page = doc.pages[0]!;
    expect(doc.title).toBe("LinkedIn Banner");
    expect(page.presetId).toBe("linkedin");
    expect(page.width).toBe(BANNER_W);
    expect(page.height).toBe(BANNER_H);
  });

  it("keeps copy out of the bottom-left profile-photo overlap", () => {
    const page = documentFromTemplate("linkedin-banner").pages[0]!;
    const copy = page.nodes.filter((node) => node.type === "text");
    expect(copy.length).toBeGreaterThan(0);
    for (const node of copy) {
      expect(intersectsAvatarZone(node), `${node.name} sits under the profile photo`).toBe(false);
    }
  });
});
