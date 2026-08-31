import { describe, expect, it } from "vitest";
import { FONT_WEIGHTS, STRATA_SITE_FONTS, SYSTEM_FONTS, documentFonts } from "@/components/craft/lib/fonts";
import { STRATA_BRAND } from "@/components/craft/lib/composePost";
import { ALL_SHAPE_VARIANTS } from "@/components/craft/lib/types";
import { SHAPE_GROUPS } from "@/components/craft/lib/templates";

describe("Craft type and shape palettes", () => {
  it("puts Strata's site typefaces first in the font list", () => {
    expect(STRATA_SITE_FONTS).toEqual(["Unbounded", "Plus Jakarta Sans", "Space Mono"]);
    expect(SYSTEM_FONTS.slice(0, 3)).toEqual(STRATA_SITE_FONTS);
    expect(STRATA_BRAND.headingFont).toBe("Unbounded");
    expect(STRATA_BRAND.bodyFont).toBe("Plus Jakarta Sans");
    expect(documentFonts(null)).toContain("Unbounded");
    expect(documentFonts(null)).toContain("Plus Jakarta Sans");
    expect(documentFonts(null)).toContain("Lexend");
  });

  it("exposes the weights the hero uses", () => {
    expect(FONT_WEIGHTS.map((item) => item.id)).toEqual(["400", "600", "700", "800"]);
  });

  it("keeps the toolbar shape set as wide as the full variant list", () => {
    const grouped = SHAPE_GROUPS.flatMap((group) => group.variants);
    expect(new Set(grouped)).toEqual(new Set(ALL_SHAPE_VARIANTS));
    expect(ALL_SHAPE_VARIANTS.length).toBeGreaterThanOrEqual(16);
  });
});
