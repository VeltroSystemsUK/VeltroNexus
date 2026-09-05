import { describe, expect, it } from "vitest";
import {
  applyFrameShape,
  applyImageLook,
  applyNodeMotion,
  applyNodeShadow,
  CRAFT_SWATCHES,
  FRAME_SHAPES,
  pageHasMotion,
} from "@/components/craft/lib/looks";
import { evaluateAnimation } from "@/components/craft/lib/renderer";
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

  it("exposes a compact frame-shape set for the picker", () => {
    expect(FRAME_SHAPES.map((item) => item.id)).toEqual([
      "plain",
      "round",
      "arch",
      "diamond",
      "hex",
      "polaroid",
      "ticket",
      "star",
      "triangle",
      "heart",
      "speech",
      "banner",
      "cloud",
      "chevron",
    ]);
    expect(applyFrameShape(BASE, "round").mask).toBe("ellipse");
    expect(applyFrameShape(BASE, "star").mask).toBe("star");
  });

  it("applies a drop shadow without wiping the frame shape", () => {
    const framed = applyFrameShape(BASE, "diamond");
    const next = applyNodeShadow(framed, "drop");
    expect(next.mask).toBe("diamond");
    expect(next.shadow?.blur).toBeGreaterThan(20);
    expect(applyNodeShadow(next, "none").shadow).toBeUndefined();
    expect(applyFrameShape(next, "heart").shadow?.blur).toBeGreaterThan(20);
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

  it("offers a full swatch set for the colour picker", () => {
    expect(CRAFT_SWATCHES.length).toBeGreaterThanOrEqual(24);
    expect(CRAFT_SWATCHES.every((color) => /^#[0-9a-fA-F]{6}$/.test(color))).toBe(true);
  });

  it("puts replayable motion on a layer without touching the still", () => {
    const faded = applyNodeMotion(BASE, "fadeIn");
    expect(faded.animation).toMatchObject({ type: "fadeIn" });
    expect(faded.assetId).toBe(BASE.assetId);
    expect(applyNodeMotion(faded, "none").animation).toBeUndefined();
    expect(pageHasMotion([faded])).toBe(true);
    expect(pageHasMotion([applyNodeMotion(BASE, "none") as CraftNode])).toBe(false);
  });

  it("keeps the original six motion types and adds hook-turn and stamp-down", () => {
    const fade = evaluateAnimation({ type: "fadeIn", duration: 700, delay: 0 }, 0);
    expect(fade.opacity).toBe(0);
    const done = evaluateAnimation({ type: "fadeIn", duration: 700, delay: 0 }, 800);
    expect(done.opacity).toBe(1);

    const turn0 = evaluateAnimation({ type: "hook-turn", duration: 900, delay: 0 }, 0);
    expect(turn0.opacity).toBeLessThan(1);
    const turn1 = evaluateAnimation({ type: "hook-turn", duration: 900, delay: 0 }, 900);
    expect(turn1.opacity).toBe(1);

    const slam0 = evaluateAnimation({ type: "stamp-down", duration: 420, delay: 0 }, 0);
    expect(slam0.scaleX).toBeGreaterThan(1);
    const slam1 = evaluateAnimation({ type: "stamp-down", duration: 420, delay: 0 }, 500);
    expect(slam1.scaleX).toBe(1);
    expect(slam1.scaleY).toBe(1);
  });
});
