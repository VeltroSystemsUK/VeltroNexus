import { describe, expect, it } from "vitest";
import { textOverlayBox } from "@/components/craft/lib/text";

describe("textOverlayBox", () => {
  it("places the editor over the text node in screen space", () => {
    const box = textOverlayBox(
      {
        x: 100,
        y: 50,
        width: 200,
        height: 40,
        fontSize: 20,
        fontFamily: "Lexend",
        fontWeight: "700",
        color: "#0f172a",
        align: "center",
        letterSpacing: 0.5,
        lineHeight: 1.2,
        rotation: 0,
      },
      2,
      10,
      20,
    );
    expect(box.left).toBe(210);
    expect(box.top).toBe(120);
    expect(box.width).toBe(400);
    expect(box.height).toBe(80);
    expect(box.fontSize).toBe(40);
    expect(box.textAlign).toBe("center");
    expect(box.fontFamily).toContain("Lexend");
  });
});
