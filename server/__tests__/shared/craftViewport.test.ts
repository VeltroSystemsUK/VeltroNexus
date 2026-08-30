import { describe, expect, it } from "vitest";
import { fitPageInView, panFromWheel } from "@/components/craft/canvas/viewport";

describe("fitPageInView", () => {
  it("keeps a wide OG board and its copy inside the design viewport", () => {
    const view = fitPageInView(1200, 630, 720, 480);
    expect(view.zoom * 1200).toBeLessThanOrEqual(720);
    expect(view.zoom * 630).toBeLessThanOrEqual(480);
    expect(view.panX).toBeGreaterThanOrEqual(0);
    expect(view.panY).toBeGreaterThanOrEqual(0);
    expect(view.panX + 1200 * view.zoom).toBeLessThanOrEqual(720 + 0.5);
    expect(view.panY + 630 * view.zoom).toBeLessThanOrEqual(480 + 0.5);
  });

  it("fits a tall story so the CTA at the bottom stays on screen", () => {
    const view = fitPageInView(1080, 1920, 640, 520);
    expect(view.zoom * 1920).toBeLessThanOrEqual(520);
    expect(view.panY + 1920 * view.zoom).toBeLessThanOrEqual(520 + 0.5);
  });
});

describe("panFromWheel", () => {
  it("scrolls the board with the wheel instead of only zooming", () => {
    expect(panFromWheel(40, 80, false)).toEqual({ dx: -40, dy: -80 });
    expect(panFromWheel(0, 80, true)).toEqual({ dx: -80, dy: 0 });
  });
});
