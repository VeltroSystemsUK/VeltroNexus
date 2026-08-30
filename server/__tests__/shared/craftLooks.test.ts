import { describe, expect, it } from "vitest";
import { applyImageLook, applyNodeMotion, pageHasMotion } from "@/components/craft/lib/looks";
import type { CraftNode, ImageNode } from "@/components/craft/lib/types";

const BASE: ImageNode = {
  id: "img_1",
  name: "Visual",
  type: "image",
  x: 0,
  y: 0,
  width: 400,
  height: 300,
  rotation: 0,
  opacity: 1,
  locked: false,
  hidden: false,
  constraints: { horizontal: "start", vertical: "start" },
  assetId: "a1",
  objectFit: "cover",
  brightness: 1,
  contrast: 1,
};

describe("applyImageLook", () => {
  it("puts a gallery frame, wash and shadow on a lazy blob", () => {
    const next = applyImageLook(BASE, "editorial");
    expect(next.strokeWidth).toBeGreaterThan(4);
    expect(next.stroke).toBeTruthy();
    expect(next.tintOpacity).toBeGreaterThan(0);
    expect(next.shadow?.blur).toBeGreaterThan(0);
    expect(next.contrast).toBeGreaterThan(1);
  });

  it("can strip back to plain", () => {
    const next = applyImageLook(applyImageLook(BASE, "editorial"), "plain");
    expect(next.strokeWidth ?? 0).toBe(0);
    expect(next.tintOpacity ?? 0).toBe(0);
    expect(next.grayscale ?? 0).toBe(0);
    expect(next.opacity).toBe(1);
  });

  it("clips stills to shaped frames instead of a rectangular blob", () => {
    expect(applyImageLook(BASE, "diamond").mask).toBe("diamond");
    expect(applyImageLook(BASE, "hex").mask).toBe("hexagon");
    expect(applyImageLook(BASE, "arch").mask).toBe("arch");
    expect(applyImageLook(BASE, "ticket").mask).toBe("ticket");
    const polaroid = applyImageLook(BASE, "polaroid");
    expect(polaroid.mask).toBe("rounded-rect");
    expect(polaroid.strokeWidth).toBeGreaterThan(16);
    expect(polaroid.stroke).toMatch(/#f|#fff|f8fafc/i);
  });

  it("puts replayable motion on a layer without touching the still", () => {
    const faded = applyNodeMotion(BASE, "fadeIn");
    expect(faded.animation).toMatchObject({ type: "fadeIn" });
    expect(faded.assetId).toBe(BASE.assetId);
    expect(applyNodeMotion(faded, "none").animation).toBeUndefined();
    expect(pageHasMotion([faded])).toBe(true);
    expect(pageHasMotion([applyNodeMotion(BASE, "none") as CraftNode])).toBe(false);
  });
});
