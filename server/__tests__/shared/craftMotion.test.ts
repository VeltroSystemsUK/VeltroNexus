import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { adaptPage } from "@/components/craft/lib/adapt";
import { applyBrand } from "@/components/craft/lib/brand";
import { applyCreativeDirection, applyPostVisual, creativeDirectionFor } from "@/components/craft/lib/composePost";
import { emailHtmlFromCraft } from "@/components/craft/lib/emailHtml";
import { encodeGif } from "@/components/craft/lib/gifEncode";
import { applyFrameShape } from "@/components/craft/lib/looks";
import { drawMotionNode, liveMotionIds, makeMotionNode, resolveMotionPreview } from "@/components/craft/lib/motion";
import {
  captureMotionFrame,
  disposeAll,
  disposeNode,
  influencePointer,
  motionBitmap,
  nodeOnscreen,
} from "@/components/craft/lib/motionRuntime";
import { MOTION_PRESETS, matchMotionPreset, presetById } from "@/components/craft/lib/motionPresets";
import {
  LEDGER_CURRENT,
  MOTION_CATEGORIES,
  THREE_CDN,
  clearMotionSessionWarning,
  getMotionSessionWarning,
  validateMotionSchema,
} from "@/components/craft/lib/motionSchema";
import {
  DEFAULT_BRAND,
  blankDocument,
  normalizeDocument,
  type CraftAsset,
  type MotionNode,
} from "@/components/craft/lib/types";
import { generateWeek } from "@shared/craftQueue";

const STILL: CraftAsset = {
  id: "visual_motion",
  name: "desk.jpg",
  mime: "image/jpeg",
  dataUrl: "data:image/jpeg;base64,QQ==",
};

function motionDoc(node: MotionNode) {
  const doc = blankDocument("Motion board");
  doc.pages[0]!.presetId = "og";
  doc.pages[0]!.width = 1200;
  doc.pages[0]!.height = 630;
  doc.pages[0]!.nodes = [node];
  return doc;
}

describe("MotionNode schema", () => {
  it("keeps a MotionNode and its schema through normalizeDocument", () => {
    const node = makeMotionNode({ name: "Media frame", x: 40, y: 40, width: 640, height: 400 });
    const doc = normalizeDocument(JSON.parse(JSON.stringify(motionDoc(node))));
    const next = doc.pages[0]!.nodes[0];
    expect(next?.type).toBe("motion");
    if (next?.type !== "motion") return;
    expect(next.schema.category).toBe("FlowField");
    expect(next.schema.domTarget.tag).toBe("canvas");
    expect(next.schema.visual.palette).toEqual(LEDGER_CURRENT.visual.palette);
  });

  it("falls back to Ledger Current when the schema is illegal", () => {
    const result = validateMotionSchema({
      schemaId: "WebAnimationIntegrationSchema",
      version: "1.0.0",
      category: "Galaxy",
      extra: true,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/extra keys|illegal/i);
    expect(result.schema.category).toBe("FlowField");
  });

  it("bad schema on load sets a session warning", () => {
    clearMotionSessionWarning();
    const node = makeMotionNode({ id: "warn_schema" });
    const raw = motionDoc(node);
    (raw.pages[0]!.nodes[0] as { schema: unknown }).schema = { extra: true };
    const next = normalizeDocument(JSON.parse(JSON.stringify(raw)));
    const loaded = next.pages[0]!.nodes[0];
    expect(loaded?.type).toBe("motion");
    if (loaded?.type !== "motion") return;
    expect(loaded.schema.category).toBe("FlowField");
    expect(getMotionSessionWarning(loaded.id)).toMatch(/extra keys|illegal/i);
  });

  it("accepts the 15 locked categories and requires ThreeJS for CustomShaderDistortion", () => {
    expect(MOTION_CATEGORIES).toEqual([
      "ParticleSystem",
      "FlowField",
      "SineWaveRibbon",
      "CustomShaderDistortion",
      "PerspectiveGrid",
      "StampPulse",
      "RedactSweep",
      "GrainField",
      "NetworkGraph",
      "TypeKinetic",
      "InkBleed",
      "LightLeak",
      "MetaballGoo",
      "DataTicker",
      "VoronoiShatter",
    ]);
    const warp = validateMotionSchema({
      ...LEDGER_CURRENT,
      category: "CustomShaderDistortion",
      engine: { library: "VanillaCanvas2D", renderContext: "2d" },
    });
    expect(warp.ok).toBe(false);
    const ok = validateMotionSchema({
      ...LEDGER_CURRENT,
      category: "CustomShaderDistortion",
      engine: { library: "ThreeJS", renderContext: "webgl", cdn: THREE_CDN },
    });
    expect(ok.ok).toBe(true);
    expect(ok.schema.engine.library).toBe("ThreeJS");
  });

  it("clamps density and never injects gold into Ledger Current", () => {
    const next = validateMotionSchema({
      ...LEDGER_CURRENT,
      visual: { ...LEDGER_CURRENT.visual, opacity: 9, grain: 2 },
      physicsAndMath: { ...LEDGER_CURRENT.physicsAndMath, densityCount: 99999, speed: 99 },
    });
    expect(next.ok).toBe(true);
    expect(next.schema.physicsAndMath.densityCount).toBe(4000);
    expect(next.schema.physicsAndMath.speed).toBe(4);
    expect(next.schema.visual.opacity).toBe(1);
    expect(next.schema.visual.grain).toBeLessThanOrEqual(0.4);
    expect(next.schema.visual.palette.join(" ")).not.toMatch(/#C69123/i);
  });
});

describe("MotionNode compositor", () => {
  it("keeps the schema when a Kit still is hung on a motion visual slot", () => {
    const node = makeMotionNode({ name: "Visual", x: 0, y: 0, width: 400, height: 300 });
    const hung = applyPostVisual(motionDoc(node), STILL);
    const next = hung.pages[0]!.nodes[0];
    expect(next?.type).toBe("motion");
    if (next?.type !== "motion") return;
    expect(next.capturedAssetId).toBe(STILL.id);
    expect(next.schema.category).toBe("FlowField");
    expect(hung.assets.some((asset) => asset.id === STILL.id)).toBe(true);
  });

  it("recolors the field when applyBrand remaps paper and ink", () => {
    const node = makeMotionNode({ name: "Media frame" });
    const nextBrand = {
      ...DEFAULT_BRAND,
      colors: { ...DEFAULT_BRAND.colors, primary: "#111111", background: "#EEEAE4", secondary: "#1E3A8A" },
    };
    const branded = applyBrand(motionDoc(node), nextBrand);
    const next = branded.pages[0]!.nodes[0];
    expect(next?.type).toBe("motion");
    if (next?.type !== "motion") return;
    expect(next.schema.visual.background).toBe("#EEEAE4");
    expect(next.schema.visual.palette).toContain("#111111");
    expect(next.schema.visual.palette).toContain("#1E3A8A");
    expect(next.schema.visual.palette.join(" ")).not.toMatch(/#C69123/i);
  });

  it("exports email HTML from the captured still, never a canvas tag", () => {
    const node = makeMotionNode({ name: "Media frame", capturedAssetId: STILL.id, preview: "still" });
    const html = emailHtmlFromCraft({ ...motionDoc(node), assets: [STILL] });
    expect(html).toMatch(/<img /i);
    expect(html).toContain(STILL.dataUrl);
    expect(html).not.toMatch(/<canvas/i);
  });

  it("email skips a motion node when capture is missing and JIT cannot run", () => {
    const node = makeMotionNode({ name: "Media frame", preview: "live" });
    const html = emailHtmlFromCraft(motionDoc(node));
    expect(html).not.toMatch(/<canvas/i);
    expect(html).not.toMatch(/<img /i);
  });

  it("applyCreativeDirection frames a motion visual slot without swapping category", () => {
    const post = generateWeek("2026-08-31")[0]!;
    const node = makeMotionNode({ name: "Media frame", width: 400, height: 300 });
    const doc = applyCreativeDirection(motionDoc(node), post);
    const next = doc.pages[0]!.nodes[0];
    expect(next?.type).toBe("motion");
    if (next?.type !== "motion") return;
    expect(next.schema.category).toBe("FlowField");
    expect(next.shadow).toBeTruthy();
    const look = creativeDirectionFor(post.weekday);
    if (look.frame !== "plain") expect(next.mask || next.strokeWidth).toBeTruthy();
  });

  it("applyPostVisual on a shape slot still becomes an image", () => {
    const doc = blankDocument();
    doc.pages[0]!.nodes = [{
      id: "s1", name: "Visual", type: "shape", variant: "rect",
      x: 0, y: 0, width: 400, height: 300, rotation: 0, opacity: 1,
      locked: false, hidden: false, constraints: { horizontal: "scale", vertical: "scale" },
      fill: "#eee", fillMode: "solid", stroke: "transparent", strokeWidth: 0, borderRadius: 0,
    }];
    const hung = applyPostVisual(doc, STILL);
    expect(hung.pages[0]!.nodes[0]?.type).toBe("image");
  });

  it("adaptPage to 9:16 resizes the box and drops density", () => {
    const node = makeMotionNode({
      name: "Media frame",
      x: 0, y: 0, width: 1200, height: 627,
      constraints: { horizontal: "scale", vertical: "scale" },
      schema: { ...LEDGER_CURRENT, physicsAndMath: { ...LEDGER_CURRENT.physicsAndMath, densityCount: 640 } },
    });
    const page = { ...motionDoc(node).pages[0]!, width: 1200, height: 627, nodes: [node] };
    const story = adaptPage(page, 1080, 1920, "story");
    const next = story.nodes[0];
    expect(next?.type).toBe("motion");
    if (next?.type !== "motion") return;
    expect(next.width).not.toBe(1200);
    expect(next.schema.physicsAndMath.densityCount).toBe(Math.round(640 * 0.65));
  });

  it("normalizeDocument keeps motion-capture asset metadata", () => {
    const doc = blankDocument();
    doc.assets = [{
      id: "a1", name: "plate", mime: "image/png", dataUrl: "data:image/png;base64,QQ==",
      source: "motion-capture", metadata: { schemaHash: "abc" },
    }];
    const next = normalizeDocument(JSON.parse(JSON.stringify(doc)));
    expect(next.assets[0]?.source).toBe("motion-capture");
    expect(next.assets[0]?.metadata?.schemaHash).toBe("abc");
  });
});

describe("MotionNode live cap and reduced motion", () => {
  it("makeMotionNode defaults to Ledger Current named Motion", () => {
    const node = makeMotionNode();
    expect(node.name).toBe("Motion");
    expect(node.schema.category).toBe("FlowField");
    expect(node.preview).toBe("live");
  });

  it("liveMotionIds prefers selection and caps at two", () => {
    const nodes = [0, 1, 2].map((i) => makeMotionNode({ id: `m${i}`, preview: "live" }));
    expect(liveMotionIds(nodes, ["m2"])).toEqual(new Set(["m2", "m0"]));
  });

  it("liveMotionIds drops offscreen nodes when a host view is passed", () => {
    const on = makeMotionNode({ id: "on", x: 0, y: 0, width: 100, height: 80 });
    const off = makeMotionNode({ id: "off", x: 9000, y: 9000, width: 100, height: 80 });
    expect(liveMotionIds([on, off], [], 2)).toEqual(new Set(["on", "off"]));
    expect(liveMotionIds([on, off], [], 2, { panX: 0, panY: 0, zoom: 1, hostW: 800, hostH: 600 })).toEqual(
      new Set(["on"]),
    );
  });

  it("trigger none does not apply mouse pull", () => {
    expect(presetById("paper-sparks").schema.interactionRules.triggerType).toBe("none");
    expect(influencePointer("none", { x: 3, y: 4 }, { x: 1, y: 1 })).toBeNull();
    expect(influencePointer("mousemove", { x: 3, y: 4 }, null)).toEqual({ x: 3, y: 4 });
    expect(influencePointer("click", { x: 3, y: 4 }, { x: 8, y: 9 })).toEqual({ x: 8, y: 9 });
    expect(influencePointer("hover", { x: 2, y: 2 }, null)).toEqual({ x: 2, y: 2 });
    expect(influencePointer("touch", { x: 5, y: 6 }, null)).toEqual({ x: 5, y: 6 });
  });

  it("disposeNode and disposeAll are safe no-ops without a document", () => {
    expect(() => {
      disposeNode("missing");
      disposeAll();
    }).not.toThrow();
  });

  it("applyFrameShape masks a MotionNode", () => {
    const node = makeMotionNode();
    expect(applyFrameShape(node, "round").mask).toBe("ellipse");
    expect(applyFrameShape(node, "plain").mask).toBeUndefined();
  });

  it("forces reduced preview when the user prefers reduced motion", () => {
    const node = makeMotionNode({ preview: "live" });
    expect(resolveMotionPreview(node, true)).toBe("reduced");
    expect(resolveMotionPreview(node, false)).toBe("live");
  });

  it("nodeOnscreen implements pauseOffscreen as AABB vs host", () => {
    const node = makeMotionNode({ x: 0, y: 0, width: 100, height: 80 });
    expect(nodeOnscreen(node, { panX: 0, panY: 0, zoom: 1, hostW: 800, hostH: 600 })).toBe(true);
    expect(nodeOnscreen(node, { panX: -400, panY: 0, zoom: 1, hostW: 200, hostH: 200 })).toBe(false);
    const always = makeMotionNode({
      x: 9000,
      y: 9000,
      schema: { ...LEDGER_CURRENT, performance: { ...LEDGER_CURRENT.performance, pauseOffscreen: false } },
    });
    expect(nodeOnscreen(always, { panX: 0, panY: 0, zoom: 1, hostW: 10, hostH: 10 })).toBe(true);
  });

  it("drawMotionNode no-ops when document is missing", () => {
    expect(typeof document).toBe("undefined");
    const node = makeMotionNode();
    expect(() =>
      drawMotionNode(null as unknown as CanvasRenderingContext2D, node, [], { live: true, reduced: false, atMs: 0 }),
    ).not.toThrow();
    const frame = captureMotionFrame(node, []);
    expect(frame.width).toBe(Math.round(node.width));
    expect(frame.height).toBe(Math.round(node.height));
  });

  const canBitmap = typeof document !== "undefined" && typeof HTMLCanvasElement !== "undefined";

  it.skipIf(!canBitmap)("motionBitmap is CSS pixels times dpr", () => {
    const node = makeMotionNode({ width: 80, height: 40 });
    const bitmap = motionBitmap(node, [], { live: false, reduced: true, atMs: 0, dpr: 2 });
    expect(bitmap.width).toBe(160);
    expect(bitmap.height).toBe(80);
  });
});

describe("GIF encode", () => {
  it("writes a GIF89a from indexed frames", () => {
    const red = new Uint8Array([255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255]);
    const paper = new Uint8Array([247, 245, 241, 255, 247, 245, 241, 255, 247, 245, 241, 255, 247, 245, 241, 255]);
    const gif = encodeGif([red, paper], 2, 2, 12);
    expect(String.fromCharCode(...gif.slice(0, 6))).toBe("GIF89a");
    expect(gif[gif.length - 1]).toBe(0x3b);
  });

  it("encodeGif returns image/gif bytes for N frames", () => {
    const a = new Uint8Array(4).fill(247);
    a[3] = 255;
    const b = new Uint8Array([26, 29, 33, 255]);
    const gif = encodeGif([a, b, a, b], 1, 1, 12);
    expect(gif.byteLength).toBeGreaterThan(20);
    expect(String.fromCharCode(...gif.slice(0, 6))).toBe("GIF89a");
  });
});

describe("MotionNode presets", () => {
  it("ships 15 grouped presets with vibe strings", () => {
    expect(MOTION_PRESETS.map((p) => p.id)).toEqual([
      "ledger-current",
      "paper-sparks",
      "grain-breath",
      "after-hours-warp",
      "stamp-pulse",
      "redact-sweep",
      "ink-bleed",
      "light-leak",
      "corporate-ribbon",
      "perspective-grid",
      "network-map",
      "hook-turn",
      "ledger-ticker",
      "goo-merge",
      "shatter-plate",
    ]);
    expect(MOTION_PRESETS.every((p) => p.schema.meta?.vibe && p.schema.domTarget.tag === "canvas")).toBe(true);
    expect(presetById("grain-breath").schema.category).toBe("GrainField");
    expect(presetById("after-hours-warp").schema.engine.library).toBe("ThreeJS");
    expect(presetById("ledger-ticker").schema.visual.palette.join(" ")).not.toMatch(/#C69123/i);
  });

  it("maps vibe language onto locked preset ids", () => {
    expect(matchMotionPreset("liquid wind")).toBe("ledger-current");
    expect(matchMotionPreset("glass warp")).toBe("after-hours-warp");
    expect(matchMotionPreset("moody starry sparks")).toBe("paper-sparks");
    expect(matchMotionPreset("clean wave ribbon")).toBe("corporate-ribbon");
  });

  it("TypeKinetic reads hook copy and DataTicker never emits rate claims", () => {
    expect(presetById("ledger-ticker").schema.meta?.vibe).not.toMatch(/apr|rate|loan|approved|%/i);
    expect(presetById("hook-turn").schema.category).toBe("TypeKinetic");
    expect(presetById("redact-sweep").schema.category).toBe("RedactSweep");
  });

  it("live ticks of remaining 2D categories do not throw", () => {
    const remaining = [
      "GrainField",
      "StampPulse",
      "RedactSweep",
      "InkBleed",
      "LightLeak",
      "PerspectiveGrid",
      "NetworkGraph",
      "TypeKinetic",
      "DataTicker",
      "MetaballGoo",
      "VoronoiShatter",
    ] as const;
    for (const category of remaining) {
      const node = makeMotionNode({ schema: { ...LEDGER_CURRENT, category } });
      expect(() =>
        drawMotionNode(null as unknown as CanvasRenderingContext2D, node, [], {
          live: true,
          reduced: false,
          atMs: 1500,
          pointer: { x: node.x + 12, y: node.y + 8 },
          hooks: { hook1: "File first", hook2: "Then the lender" },
        }),
      ).not.toThrow();
    }
    const unknown = makeMotionNode();
    (unknown.schema as { category: string }).category = "Galaxy";
    expect(() =>
      drawMotionNode(null as unknown as CanvasRenderingContext2D, unknown, [], {
        live: true,
        reduced: false,
        atMs: 400,
      }),
    ).not.toThrow();
  });

  it("runtime draws remaining categories and renderer passes sibling hooks", () => {
    const runtime = readFileSync("client/src/components/craft/lib/motionRuntime.ts", "utf8");
    for (const category of [
      "GrainField",
      "StampPulse",
      "RedactSweep",
      "InkBleed",
      "LightLeak",
      "PerspectiveGrid",
      "NetworkGraph",
      "TypeKinetic",
      "DataTicker",
      "MetaballGoo",
      "VoronoiShatter",
    ]) {
      expect(runtime).toContain(`case "${category}"`);
    }
    expect(runtime).toMatch(/hooks\?: \{ hook1\?: string; hook2\?: string \}/);
    expect(runtime).toContain("Unbounded");
    expect(runtime).toContain("JetBrains Mono");
    expect(runtime).toContain("LEDGER");
    expect(runtime).toContain("ON TIME");
    expect(runtime).toContain("FILE 04");
    expect(runtime).toContain("#C91B25");
    expect(runtime).not.toMatch(/updateNode/);
    const renderer = readFileSync("client/src/components/craft/lib/renderer.ts", "utf8");
    expect(renderer).toContain('n.name === "Hook 1"');
    expect(renderer).toContain('n.name === "Hook 2"');
    expect(renderer).toMatch(/hooks:/);
    expect(renderer).not.toMatch(/updateNode/);
  });
});

describe("MotionNode Warp lazy Three.js", () => {
  it("does not import three.js from the 2D runtime module", () => {
    const runtime = readFileSync("client/src/components/craft/lib/motionRuntime.ts", "utf8");
    expect(runtime).not.toMatch(/cdnjs\.cloudflare\.com\/ajax\/libs\/three/);
    expect(runtime).toMatch(/import\("\.\/motionThree"/);
    const three = readFileSync("client/src/components/craft/lib/motionThree.ts", "utf8");
    expect(three).toContain(THREE_CDN);
  });
});

describe("MotionNode inspector", () => {
  it("inspector lists grouped motion presets and an Advanced JSON editor", () => {
    const view = readFileSync("client/src/components/craft/CraftView.tsx", "utf8");
    expect(view).toMatch(/Atmosphere/);
    expect(view).toMatch(/Graphic devices/);
    expect(view).toMatch(/Structure/);
    expect(view).toMatch(/Occasional/);
    expect(view).toMatch(/Record GIF/);
    expect(view).toMatch(/Filament 1/);
    expect(view).toMatch(/Field opacity/);
    expect(view).toMatch(/Pull strength/);
    expect(view).toMatch(/MOTION_BLENDS/);
    expect(view).toMatch(/validateMotionSchema/);
    expect(view).toMatch(/setAdvancedOpen\(false\)/);
    expect(view).toMatch(/getMotionSessionWarning/);
    expect(view).toMatch(/hostW/);
    expect(view).toMatch(/clickPage/);
    expect(view).toMatch(/disposeAll/);
  });

  it("store wires capture, frames, hook-turn animation, and silent insert", () => {
    const store = readFileSync("client/src/components/craft/store.ts", "utf8");
    expect(store).toMatch(/applyNodeMotion\(node, "hook-turn"\)/);
    expect(store).toMatch(/node.type !== "image" && node.type !== "motion"/);
    expect(store).toMatch(/silent: true/);
    expect(store).toMatch(/captureMotionFrame/);
    expect(store).toMatch(/disposeNode/);
    const runtime = readFileSync("client/src/components/craft/lib/motionRuntime.ts", "utf8");
    expect(runtime).not.toMatch(/const t = freeze \? 0/);
    expect(runtime).toMatch(/getImageEl/);
    const exp = readFileSync("client/src/components/craft/lib/export.ts", "utf8");
    expect(exp).toMatch(/captureMotionFrame/);
    const email = readFileSync("client/src/components/craft/lib/emailHtml.ts", "utf8");
    expect(email).toMatch(/captureMotionFrame/);
  });
});

describe("Describe a current", () => {
  it("matchMotionPreset stays on locked ids", () => {
    expect(["ledger-current", "paper-sparks", "after-hours-warp", "corporate-ribbon"]).toContain(
      matchMotionPreset("liquid glass wave sparks"),
    );
  });

  it("HUD flag and Describe a current exist in CraftView", () => {
    const view = readFileSync("client/src/components/craft/CraftView.tsx", "utf8");
    expect(view).toMatch(/Describe a current/);
    expect(view).toMatch(/craftMotionHud/);
  });
});

describe("CRAFT.md", () => {
  it("docs/CRAFT.md documents MotionNode", () => {
    const md = readFileSync("docs/CRAFT.md", "utf8");
    expect(md).toMatch(/MotionNode|\*\*motion\*\*/);
    expect(md).toMatch(/Ledger Current/);
  });
});

