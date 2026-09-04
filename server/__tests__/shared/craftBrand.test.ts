import { describe, expect, it } from "vitest";
import { applyBrandLogo, fitLogoSize, isLogoSlot, logoAspectRatio } from "@/components/craft/lib/brand";
import { containDest } from "@/components/craft/lib/geometry";
import { composeSocialPost } from "@/components/craft/lib/composePost";
import { generateWeek } from "@shared/craftQueue";
import type { CraftAsset, CraftNode } from "@/components/craft/lib/types";

const LOGO: CraftAsset = {
  id: "logo_test",
  name: "strata.svg",
  mime: "image/svg+xml",
  dataUrl: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='24'></svg>",
};

describe("brand logo", () => {
  it("does not treat a quote Mark as a logo slot", () => {
    expect(isLogoSlot({ name: "Mark" } as CraftNode)).toBe(false);
    expect(isLogoSlot({ name: "Logo" } as CraftNode)).toBe(true);
    expect(isLogoSlot({ name: "Brand logo" } as CraftNode)).toBe(true);
  });

  it("stamps the uploaded logo onto every page without eating the quote mark", () => {
    const post = generateWeek("2026-08-31")[0]!;
    const doc = applyBrandLogo(composeSocialPost(post), LOGO);

    expect(doc.brand.logoAssetId).toBe(LOGO.id);
    expect(doc.assets.some((asset) => asset.id === LOGO.id)).toBe(true);
    for (const page of doc.pages) {
      const logos = page.nodes.filter((node) => node.type === "image" && node.name === "Logo");
      expect(logos).toHaveLength(1);
      expect(logos[0]).toMatchObject({ assetId: LOGO.id, objectFit: "contain" });
    }
    const quote = doc.pages.flatMap((page) => page.nodes).find((node) => node.name === "Mark");
    if (quote) expect(quote.type).not.toBe("image");
  });

  it("stamps the logo at its intrinsic proportions, not a squat slot", () => {
    expect(logoAspectRatio(LOGO)).toBeCloseTo(80 / 24, 5);
    expect(fitLogoSize(220, 92, 80 / 24)).toEqual({ width: 220, height: 66 });
    expect(fitLogoSize(220, 92, 1)).toEqual({ width: 92, height: 92 });

    const post = generateWeek("2026-08-31")[0]!;
    const wide = applyBrandLogo(composeSocialPost(post), LOGO);
    const wideLogo = wide.pages[0]!.nodes.find((node) => node.name === "Logo")!;
    expect(wideLogo.width / wideLogo.height).toBeCloseTo(80 / 24, 1);

    const squareAsset: CraftAsset = {
      ...LOGO,
      id: "logo_square",
      dataUrl: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'></svg>",
    };
    const square = applyBrandLogo(composeSocialPost(post), squareAsset);
    const squareLogo = square.pages[0]!.nodes.find((node) => node.name === "Logo")!;
    expect(squareLogo.width / squareLogo.height).toBeCloseTo(1, 2);
  });

  it("contains an image inside its frame instead of stretching it", () => {
    const dest = containDest(10, 20, 200, 100, 100, 100);
    expect(dest).toEqual({ x: 60, y: 20, width: 100, height: 100 });
  });

  it("clears stamped logos when the kit has none", () => {
    const post = generateWeek("2026-08-31")[0]!;
    const withLogo = applyBrandLogo(composeSocialPost(post), LOGO);
    const cleared = applyBrandLogo(withLogo, null);
    expect(cleared.brand.logoAssetId).toBeUndefined();
    expect(cleared.pages.every((page) => page.nodes.every((node) => node.name !== "Logo"))).toBe(true);
  });
});
