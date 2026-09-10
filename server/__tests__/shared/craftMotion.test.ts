import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { evaluateAnimation } from "@/components/craft/lib/renderer";
import { IMAGE_MOTIONS, applyNodeMotion } from "@/components/craft/lib/looks";
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
import {
  earliest,
  noteTyping,
  oneShot,
  pulseMotion,
  resetMotionSignals,
  setMotionBusy,
  setMotionFocus,
  snapshotMotionSignals,
} from "@/components/craft/lib/motionSignals";

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
  it("keeps a MotionNode caption through normalizeDocument", () => {
    const node = makeMotionNode({ name: "Media frame", text: "File first" });
    const doc = normalizeDocument(JSON.parse(JSON.stringify(motionDoc(node))));
    const next = doc.pages[0]!.nodes[0];
    expect(next?.type).toBe("motion");
    if (next?.type !== "motion") return;
    expect(next.text).toBe("File first");
  });

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

  it("accepts the locked categories and requires ThreeJS for CustomShaderDistortion", () => {
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
      "VaporDrift",
      "StaticShiver",
      "VignetteBreath",
      "HorizonShift",
      "CarbonWeave",
      "HeatHaze",
      "LedgerFracture",
      "ScanlineSweep",
      "MarginGlow",
      "ResinGloss",
      "HoloFoil",
      "VellumCrease",
      "ElasticSpring",
      "KineticSqueeze",
      "CrosshairGrid",
      "TypewriterCursor",
      "LedgerStitch",
      "InkSplash",
      "GlitchBurst",
      "InkRipple",
      "FocusPull",
      "MagneticRipple",
      "StrobePulse",
      "MomentumGlide",
      "PrismaticFringe",
      "QuartzFluid",
      "AnodeDecay",
      "WaveformPulse",
      "EdgeSnap",
      "HeatBloom",
      "FocalVignette",
      "StencilPunch",
      "VellumHysteresis",
      "PhosphorBurn",
      "EntanglePulse",
      "ResonanceBlur",
      "GravityWarp",
      "GuillocheWave",
      "TopoContour",
      "OrigamiUnfold",
      "ElasticThread",
      "IsoExtrude",
      "Escapement",
      "VoronoiPulse",
      "ViralHook",
      "LiquidGlass",
      "HookSlam",
      "TextMaskShift",
      "PillPulse",
      "OdometerRoll",
      "RedactHighlight",
      "DrippingText",
      "WordPiston",
      "WordVortex",
      "LetterAssembly",
      "MisregisterGlitch",
      "MonumentBreathe",
      "StrokeReveal",
      "TelemetryOverlay",
      "VanishingTunnel",
      "IconWeather",
      "BufferGlitch",
      "StaticResolve",
      "RedactionLift",
      "KintsugiMend",
      "FerrofluidPull",
      "SlowFax",
      "SundialShadow",
      "HalftoneLamp",
      "HourglassDrain",
      "MurmurationFlock",
      "PendulumSwing",
      "TabEscape",
      "MossBloom",
      "InkPileup",
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

  it("liveMotionIds prefers selection and runs a stack", () => {
    const nodes = [0, 1, 2].map((i) => makeMotionNode({ id: `m${i}`, preview: "live" }));
    expect(liveMotionIds(nodes, ["m2"], 2)).toEqual(new Set(["m2", "m0"]));
    expect(liveMotionIds(nodes, ["m2"])).toEqual(new Set(["m2", "m0", "m1"]));
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
  it("ships grouped house presets with vibe strings", () => {
    expect(MOTION_PRESETS.map((p) => p.id)).toEqual([
      "ledger-current",
      "paper-sparks",
      "grain-breath",
      "after-hours-warp",
      "vapor-drift",
      "static-shiver",
      "vignette-breathing",
      "horizon-shift",
      "carbon-weave",
      "parchment-heat",
      "liquid-quartz",
      "liquid-glass-shift",
      "thermal-heat-bloom",
      "dynamic-focal-vignette",
      "vellum-hysteresis",
      "gravitational-field",
      "stamp-pulse",
      "redact-sweep",
      "ink-bleed",
      "light-leak",
      "ledger-fracture",
      "cybernetic-scanline",
      "ledger-margin-glow",
      "resin-gloss-sweep",
      "holographic-foil",
      "vellum-crease",
      "prismatic-focal-shift",
      "magnetic-edge-snap",
      "kinetic-stencil-punch",
      "guilloche-wave",
      "origami-unfold",
      "isometric-extrusion",
      "mechanical-escapement",
      "glowing-pill-pulse",
      "redact-highlight",
      "corporate-ribbon",
      "perspective-grid",
      "network-map",
      "hook-turn",
      "ledger-ticker",
      "elastic-spring",
      "kinetic-squeeze",
      "crosshair-grid-track",
      "typewriter-cursor",
      "ledger-stitch",
      "kinetic-momentum-glide",
      "acoustic-waveform-pulse",
      "resonance-blur",
      "topographic-contour",
      "elastic-threading",
      "voronoi-partition",
      "liquid-text-mask",
      "odometer-roll",
      "dripping-text",
      "goo-merge",
      "shatter-plate",
      "ink-splash-bloom",
      "quantum-glitch",
      "ink-ripple",
      "focus-pull",
      "magnetic-ripple",
      "kinetic-strobe-pulse",
      "anode-flicker-decay",
      "phosphor-burn-in",
      "quantum-entanglement",
      "viral-hook-drop",
      "cinematic-hook-slam",
    ]);
    expect(MOTION_PRESETS.every((p) => p.schema.meta?.vibe && p.schema.domTarget.tag === "canvas")).toBe(true);
    expect(presetById("grain-breath").schema.category).toBe("GrainField");
    expect(presetById("after-hours-warp").schema.engine.library).toBe("ThreeJS");
    expect(presetById("ledger-ticker").schema.visual.palette.join(" ")).not.toMatch(/#C69123/i);
    expect(presetById("resin-gloss-sweep").schema.category).toBe("ResinGloss");
    expect(presetById("carbon-weave").schema.interactionRules.triggerType).toBe("mousemove");
    expect(presetById("holographic-foil").schema.interactionRules.triggerType).toBe("hover");
    expect(presetById("magnetic-ripple").schema.interactionRules.triggerType).toBe("click");
    expect(presetById("parchment-heat").schema.engine.library).toBe("VanillaCanvas2D");
    expect(presetById("liquid-quartz").schema.interactionRules.triggerType).toBe("hover");
    expect(presetById("prismatic-focal-shift").schema.interactionRules.triggerType).toBe("click");
    expect(presetById("kinetic-strobe-pulse").schema.category).toBe("StrobePulse");
    expect(presetById("acoustic-waveform-pulse").schema.category).toBe("WaveformPulse");
    expect(presetById("magnetic-edge-snap").schema.interactionRules.triggerType).toBe("click");
    expect(presetById("dynamic-focal-vignette").schema.category).toBe("FocalVignette");
    expect(presetById("vellum-hysteresis").schema.interactionRules.triggerType).toBe("mousemove");
    expect(presetById("gravitational-field").schema.interactionRules.triggerType).toBe("mousemove");
    expect(presetById("phosphor-burn-in").schema.category).toBe("PhosphorBurn");
    expect(presetById("quantum-entanglement").schema.category).toBe("EntanglePulse");
    expect(presetById("guilloche-wave").schema.category).toBe("GuillocheWave");
    expect(presetById("origami-unfold").schema.category).toBe("OrigamiUnfold");
    expect(presetById("mechanical-escapement").schema.category).toBe("Escapement");
    expect(presetById("voronoi-partition").schema.category).toBe("VoronoiPulse");
    expect(presetById("viral-hook-drop").schema.category).toBe("ViralHook");
    expect(presetById("liquid-glass-shift").schema.category).toBe("LiquidGlass");
    expect(presetById("liquid-glass-shift").schema.visual.background.toLowerCase()).not.toBe("#f7f5f1");
    expect(presetById("liquid-glass-shift").schema.visual.background.toLowerCase()).toBe("#1a1d21");
    expect(presetById("viral-hook-drop").schema.meta?.vibe).not.toMatch(/apr|rate|loan|approved|%/i);
    expect(presetById("cinematic-hook-slam").schema.category).toBe("HookSlam");
    expect(presetById("odometer-roll").schema.category).toBe("OdometerRoll");
    expect(presetById("redact-highlight").schema.category).toBe("RedactHighlight");
    expect(presetById("dripping-text").schema.category).toBe("DrippingText");
    expect(presetById("dripping-text").schema.widget?.shape).toBe("teardrop");
    expect(presetById("dripping-text").schema.widget?.motion).toBe("gravity");
    expect(presetById("dripping-text").schema.widget?.texture).toBe("scanlines");
  });

  it("maps vibe language onto locked preset ids", () => {
    expect(matchMotionPreset("liquid wind")).toBe("ledger-current");
    expect(matchMotionPreset("glass warp")).toBe("after-hours-warp");
    expect(matchMotionPreset("moody starry sparks")).toBe("paper-sparks");
    expect(matchMotionPreset("clean wave ribbon")).toBe("corporate-ribbon");
    expect(matchMotionPreset("resin gloss")).toBe("resin-gloss-sweep");
    expect(matchMotionPreset("carbon weave parallax")).toBe("carbon-weave");
    expect(matchMotionPreset("holographic foil")).toBe("holographic-foil");
    expect(matchMotionPreset("ledger stitch")).toBe("ledger-stitch");
    expect(matchMotionPreset("magnetic ripple")).toBe("magnetic-ripple");
    expect(matchMotionPreset("liquid quartz")).toBe("liquid-quartz");
    expect(matchMotionPreset("strobe flicker")).toBe("kinetic-strobe-pulse");
    expect(matchMotionPreset("momentum glide")).toBe("kinetic-momentum-glide");
    expect(matchMotionPreset("prismatic fringe")).toBe("prismatic-focal-shift");
    expect(matchMotionPreset("anode decay")).toBe("anode-flicker-decay");
    expect(matchMotionPreset("acoustic waveform")).toBe("acoustic-waveform-pulse");
    expect(matchMotionPreset("edge snap dock")).toBe("magnetic-edge-snap");
    expect(matchMotionPreset("thermal bloom")).toBe("thermal-heat-bloom");
    expect(matchMotionPreset("writing vignette")).toBe("dynamic-focal-vignette");
    expect(matchMotionPreset("stencil punch")).toBe("kinetic-stencil-punch");
    expect(matchMotionPreset("hysteresis lag")).toBe("vellum-hysteresis");
    expect(matchMotionPreset("phosphor ghost")).toBe("phosphor-burn-in");
    expect(matchMotionPreset("entanglement pulse")).toBe("quantum-entanglement");
    expect(matchMotionPreset("resonance typing")).toBe("resonance-blur");
    expect(matchMotionPreset("gravitational warp")).toBe("gravitational-field");
    expect(matchMotionPreset("guilloche security")).toBe("guilloche-wave");
    expect(matchMotionPreset("topographic contour")).toBe("topographic-contour");
    expect(matchMotionPreset("origami unfold")).toBe("origami-unfold");
    expect(matchMotionPreset("bezier threading")).toBe("elastic-threading");
    expect(matchMotionPreset("isometric blueprint")).toBe("isometric-extrusion");
    expect(matchMotionPreset("escapement gear")).toBe("mechanical-escapement");
    expect(matchMotionPreset("voronoi partition")).toBe("voronoi-partition");
    expect(matchMotionPreset("cinematic slam")).toBe("cinematic-hook-slam");
    expect(matchMotionPreset("text mask matte")).toBe("liquid-text-mask");
    expect(matchMotionPreset("pill badge")).toBe("glowing-pill-pulse");
    expect(matchMotionPreset("odometer digits")).toBe("odometer-roll");
    expect(matchMotionPreset("highlight wipe")).toBe("redact-highlight");
    expect(matchMotionPreset("viral overshoot")).toBe("viral-hook-drop");
    expect(matchMotionPreset("chrome shift")).toBe("liquid-glass-shift");
    expect(matchMotionPreset("drip melt teardrop")).toBe("dripping-text");
  });

  it("TypeKinetic reads hook copy and DataTicker never emits rate claims", () => {
    expect(presetById("ledger-ticker").schema.meta?.vibe).not.toMatch(/apr|rate|loan|approved|%/i);
    expect(presetById("holographic-foil").schema.meta?.vibe).not.toMatch(/apr|rate|loan|approved|%/i);
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
      "VaporDrift",
      "StaticShiver",
      "VignetteBreath",
      "HorizonShift",
      "CarbonWeave",
      "HeatHaze",
      "LedgerFracture",
      "ScanlineSweep",
      "MarginGlow",
      "ResinGloss",
      "HoloFoil",
      "VellumCrease",
      "ElasticSpring",
      "KineticSqueeze",
      "CrosshairGrid",
      "TypewriterCursor",
      "LedgerStitch",
      "InkSplash",
      "GlitchBurst",
      "InkRipple",
      "FocusPull",
      "MagneticRipple",
      "StrobePulse",
      "MomentumGlide",
      "PrismaticFringe",
      "QuartzFluid",
      "AnodeDecay",
      "WaveformPulse",
      "EdgeSnap",
      "HeatBloom",
      "FocalVignette",
      "StencilPunch",
      "VellumHysteresis",
      "PhosphorBurn",
      "EntanglePulse",
      "ResonanceBlur",
      "GravityWarp",
      "GuillocheWave",
      "TopoContour",
      "OrigamiUnfold",
      "ElasticThread",
      "IsoExtrude",
      "Escapement",
      "VoronoiPulse",
      "ViralHook",
      "LiquidGlass",
      "HookSlam",
      "TextMaskShift",
      "PillPulse",
      "OdometerRoll",
      "RedactHighlight",
      "DrippingText",
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
      "VaporDrift",
      "StaticShiver",
      "VignetteBreath",
      "HorizonShift",
      "CarbonWeave",
      "HeatHaze",
      "LedgerFracture",
      "ScanlineSweep",
      "MarginGlow",
      "ResinGloss",
      "HoloFoil",
      "VellumCrease",
      "ElasticSpring",
      "KineticSqueeze",
      "CrosshairGrid",
      "TypewriterCursor",
      "LedgerStitch",
      "InkSplash",
      "GlitchBurst",
      "InkRipple",
      "FocusPull",
      "MagneticRipple",
      "StrobePulse",
      "MomentumGlide",
      "PrismaticFringe",
      "QuartzFluid",
      "AnodeDecay",
      "WaveformPulse",
      "EdgeSnap",
      "HeatBloom",
      "FocalVignette",
      "StencilPunch",
      "VellumHysteresis",
      "PhosphorBurn",
      "EntanglePulse",
      "ResonanceBlur",
      "GravityWarp",
      "GuillocheWave",
      "TopoContour",
      "OrigamiUnfold",
      "ElasticThread",
      "IsoExtrude",
      "Escapement",
      "VoronoiPulse",
      "ViralHook",
      "LiquidGlass",
      "HookSlam",
      "TextMaskShift",
      "PillPulse",
      "OdometerRoll",
      "RedactHighlight",
      "DrippingText",
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
    expect(runtime).not.toMatch(/function loopAge/);
    expect(runtime).toContain("oneShot");
    expect(runtime).toContain("snapshotMotionSignals");
    const renderer = readFileSync("client/src/components/craft/lib/renderer.ts", "utf8");
    expect(renderer).toContain('n.name === "Hook 1"');
    expect(renderer).toContain('n.name === "Hook 2"');
    expect(renderer).toMatch(/hooks:/);
    expect(renderer).not.toMatch(/updateNode/);
  });
});

describe("Craft motion editor signals", () => {
  it("oneShot stays idle after the event window", () => {
    expect(oneShot(0.1, 0.4)).toBe(0.1);
    expect(oneShot(0.4, 0.4)).toBe(Number.POSITIVE_INFINITY);
    expect(oneShot(Number.POSITIVE_INFINITY, 0.4)).toBe(Number.POSITIVE_INFINITY);
    expect(earliest(0.9, 0.2, 1.4)).toBe(0.2);
  });

  it("pulses save, pane, typing and busy into a snapshot", () => {
    resetMotionSignals();
    pulseMotion("save", 1000);
    pulseMotion("pane", 1500);
    pulseMotion("dock", 1800);
    pulseMotion("dialog", 2000);
    pulseMotion("close", 2500);
    pulseMotion("link", 1200);
    noteTyping(1600);
    noteTyping(1680);
    setMotionBusy(true);
    setMotionFocus(true, 1400);
    const snap = snapshotMotionSignals(2000, { wordCount: 12, selected: true });
    expect(snap.busy).toBe(true);
    expect(snap.focusMode).toBe(true);
    expect(snap.selected).toBe(true);
    expect(snap.wordCount).toBe(12);
    expect(snap.saveAge).toBeCloseTo(1, 5);
    expect(snap.paneAge).toBeCloseTo(0.5, 5);
    expect(snap.dockAge).toBeCloseTo(0.2, 5);
    expect(snap.dialogAge).toBe(0);
    expect(snap.closeAge).toBe(Number.POSITIVE_INFINITY);
    expect(snap.linkAge).toBeCloseTo(0.8, 5);
    expect(snap.typeVel).toBeGreaterThan(0);
    resetMotionSignals();
    setMotionBusy(false);
    expect(snapshotMotionSignals(3000).busy).toBe(false);
  });

  it("Craft canvas and desk fire real editor pulses", () => {
    const view = readFileSync("client/src/components/craft/CraftView.tsx", "utf8");
    expect(view).toContain("pulseMotion");
    expect(view).toContain("noteTyping");
    expect(view).toContain("setMotionFocus");
    expect(view).toContain("setMotionBusy");
    expect(view).toContain("onPointerLeave");
    const desk = readFileSync("client/src/pages/Craft.tsx", "utf8");
    expect(desk).toContain("pulseMotion");
    expect(desk).toContain("setMotionBusy");
    const store = readFileSync("client/src/components/craft/store.ts", "utf8");
    expect(store).toContain('pulseMotion("save"');
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
    expect(view).toMatch(/DRIP_TEXTURES/);
    expect(view).toMatch(/DRIP_SHAPES/);
    expect(view).toMatch(/DRIP_MOTIONS/);
    expect(view).toMatch(/applyLiquidPreset/);
    expect(view).toContain("Replay pour");
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
    expect(store).toMatch(/node.type !== "text" && node.type !== "motion"/);
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
    expect([
      "ledger-current",
      "paper-sparks",
      "after-hours-warp",
      "corporate-ribbon",
      "liquid-glass-shift",
    ]).toContain(matchMotionPreset("liquid glass wave sparks"));
    expect(matchMotionPreset("liquid glass")).toBe("liquid-glass-shift");
  });

  it("HUD flag and Describe a current exist in CraftView", () => {
    const view = readFileSync("client/src/components/craft/CraftView.tsx", "utf8");
    expect(view).toMatch(/Describe a current/);
    expect(view).toMatch(/craftMotionHud/);
  });

  it("lets a selected motion plate enter text edit", () => {
    const view = readFileSync("client/src/components/craft/CraftView.tsx", "utf8");
    expect(view).toMatch(/hit\?\.type === "text" \|\| hit\?\.type === "motion"/);
    expect(view).toMatch(/node\?\.type === "text" \|\| node\?\.type === "motion"/);
    expect(view).toContain("MotionCopyField");
    const store = readFileSync("client/src/components/craft/store.ts", "utf8");
    expect(store).toMatch(/node.type !== "text" && node.type !== "motion"/);
    const menu = readFileSync("client/src/components/craft/shell/CraftContextMenu.tsx", "utf8");
    expect(menu).toMatch(/node\?\.type === "text" \|\| node\?\.type === "motion"/);
  });

  it("double-click edits the topmost text or motion plate", () => {
    const view = readFileSync("client/src/components/craft/CraftView.tsx", "utf8");
    expect(view).not.toContain("textHit ?? motionHit");
    expect(view).toMatch(/hits\.find\(\(node\) => node\.type === "text" \|\| node\.type === "motion"\)/);
  });

  it("applyMotionPreset stacks a new plate unless the selected look is the same", () => {
    const store = readFileSync("client/src/components/craft/store.ts", "utf8");
    const apply = store.slice(
      store.indexOf("applyMotionPreset: (id) =>"),
      store.indexOf("replaceMotionPreset: (id)"),
    );
    expect(apply).toMatch(/selected\.schema\.category === preset\.schema\.category/);
    expect(apply).toMatch(/get\(\)\.addMotion\(preset\.id\)/);
    expect(apply).not.toMatch(/patch: Partial<typeof selected> = \{ schema: preset.schema/);
  });

  it("right-click motion plate lists house looks and plate actions", () => {
    const menu = readFileSync("client/src/components/craft/shell/CraftContextMenu.tsx", "utf8");
    expect(menu).toContain("MOTION_PRESETS");
    expect(menu).toContain("replaceMotionPreset");
    expect(menu).toContain("Capture still");
    expect(menu).toContain("Record GIF");
    expect(menu).toContain("MOTION_PRESET_GROUPS");
    expect(menu).toMatch(/node\.type === "motion"/);
    const store = readFileSync("client/src/components/craft/store.ts", "utf8");
    expect(store).toContain("replaceMotionPreset:");
    const replace = store.slice(store.indexOf("replaceMotionPreset: (id)"));
    expect(replace).toMatch(/schema: preset\.schema, seed: Date\.now\(\)/);
  });

  it("hides CSS tween and colour on motion plates", () => {
    const menu = readFileSync("client/src/components/craft/shell/CraftContextMenu.tsx", "utf8");
    expect(menu).toMatch(/node\.type !== "motion"/);
    expect(menu).toContain("IMAGE_MOTIONS");
    const view = readFileSync("client/src/components/craft/CraftView.tsx", "utf8");
    const idx = view.lastIndexOf("IMAGE_MOTIONS");
    expect(view.slice(Math.max(0, idx - 500), idx)).toMatch(/node\.type !== "motion"/);
  });
});

describe("Motion overlay layers", () => {
  it("keeps a transparent plate background through validateMotionSchema", () => {
    const node = makeMotionNode({
      schema: { ...LEDGER_CURRENT, visual: { ...LEDGER_CURRENT.visual, background: "transparent" } },
    });
    expect(node.schema.visual.background).toBe("transparent");
  });

  it("hook slam and viral hook are transparent overlays", () => {
    expect(presetById("cinematic-hook-slam").schema.visual.background).toBe("transparent");
    expect(presetById("viral-hook-drop").schema.visual.background).toBe("transparent");
  });

  it("runtime skips the card fill on a transparent overlay", () => {
    const runtime = readFileSync("client/src/components/craft/lib/motionRuntime.ts", "utf8");
    expect(runtime).toMatch(/background !== "transparent"/);
  });
});

describe("Dripping Text widget", () => {
  it("keeps enhanced widget settings through validateMotionSchema", () => {
    const next = validateMotionSchema({
      ...LEDGER_CURRENT,
      category: "DrippingText",
      widget: {
        texture: "waves",
        shape: "snowflake",
        motion: "swirl",
        interaction: "repel",
        gravity: 0.4,
        drift: 1.2,
        viscosity: 0.7,
        turbulence: 0.9,
        fontFamily: "Unbounded",
        fontWeight: "800",
        fontStyle: "italic",
        fontSize: 180,
        multi: false,
      },
    });
    expect(next.ok).toBe(true);
    expect(next.schema.category).toBe("DrippingText");
    expect(next.schema.widget).toMatchObject({
      texture: "waves",
      shape: "snowflake",
      motion: "swirl",
      interaction: "repel",
      fontFamily: "Unbounded",
      multi: false,
    });
  });

  it("rejects unknown widget keys by falling back to defaults", () => {
    const next = validateMotionSchema({
      ...LEDGER_CURRENT,
      category: "DrippingText",
      widget: { texture: "galaxy", shape: "teardrop", motion: "gravity" },
    });
    expect(next.ok).toBe(true);
    expect(next.schema.widget?.texture).toBe("scanlines");
  });
});

describe("Vapor Drift", () => {
  it("paints soft gradient mist instead of ellipses", () => {
    const runtime = readFileSync("client/src/components/craft/lib/motionRuntime.ts", "utf8");
    const start = runtime.indexOf("function drawVaporDrift");
    const next = runtime.indexOf("\nfunction ", start + 1);
    const body = runtime.slice(start, next);
    expect(body).toContain("function drawVaporDrift");
    expect(body).not.toMatch(/ctx\.ellipse/);
    expect(body).not.toMatch(/ctx\.scale/);
    expect(body).toMatch(/createLinearGradient/);
    expect(body).toMatch(/createRadialGradient/);
  });
});

describe("Cinematic Hook Slam caption", () => {
  it("hook overshoot starts oversized and rests at 1", async () => {
    const { hookOvershootScale } = await import("@/components/craft/lib/motionRuntime");
    expect(hookOvershootScale(Number.POSITIVE_INFINITY, 300, 0.35, 45, 4.2, 3.1)).toBe(1);
    expect(hookOvershootScale(0, 300, 0.35, 45, 4.2, 3.1)).toBeGreaterThanOrEqual(2.5);
    expect(hookOvershootScale(0.35, 300, 0.35, 45, 4.2, 3.1)).toBeGreaterThanOrEqual(0.9);
  });
});

type AuditCall = { op: string; args: unknown[]; fill: string; stroke: string; alpha: number; dash: number };

type AuditCanvas = {
  width: number;
  height: number;
  calls: AuditCall[];
  getContext: (type: string) => unknown;
  toDataURL: () => string;
};

function installAuditCanvas() {
  const priorDoc = (globalThis as { document?: unknown }).document;
  const priorEl = (globalThis as { HTMLCanvasElement?: unknown }).HTMLCanvasElement;
  const hadDoc = Object.prototype.hasOwnProperty.call(globalThis, "document");
  const hadEl = Object.prototype.hasOwnProperty.call(globalThis, "HTMLCanvasElement");

  class AuditCanvasEl {
    width = 1;
    height = 1;
    calls: AuditCall[] = [];
    private ctx: Record<string, unknown> | null = null;

    getContext(type: string) {
      if (type !== "2d") return null;
      if (this.ctx) return this.ctx;
      const canvas = this;
      const state = {
        fillStyle: "#000000" as unknown,
        strokeStyle: "#000000" as unknown,
        globalAlpha: 1,
        globalCompositeOperation: "source-over",
        lineWidth: 1,
        lineCap: "butt",
        lineJoin: "miter",
        lineDashOffset: 0,
        font: "10px sans-serif",
        textAlign: "start",
        textBaseline: "alphabetic",
      };
      const stack: Array<typeof state> = [];
      const rec = (op: string, args: unknown[]) => {
        canvas.calls.push({
          op,
          args,
          fill: String(state.fillStyle),
          stroke: String(state.strokeStyle),
          alpha: state.globalAlpha,
          dash: state.lineDashOffset,
        });
      };
      const gradient = () => ({
        addColorStop(...args: unknown[]) {
          rec("addColorStop", args);
        },
        toString() {
          return "gradient";
        },
      });
      const ctx: Record<string, unknown> = {
        canvas,
        get fillStyle() {
          return state.fillStyle;
        },
        set fillStyle(value: unknown) {
          state.fillStyle = value;
        },
        get strokeStyle() {
          return state.strokeStyle;
        },
        set strokeStyle(value: unknown) {
          state.strokeStyle = value;
        },
        get globalAlpha() {
          return state.globalAlpha;
        },
        set globalAlpha(value: number) {
          state.globalAlpha = value;
        },
        get globalCompositeOperation() {
          return state.globalCompositeOperation;
        },
        set globalCompositeOperation(value: string) {
          state.globalCompositeOperation = value;
        },
        get lineWidth() {
          return state.lineWidth;
        },
        set lineWidth(value: number) {
          state.lineWidth = value;
        },
        get lineCap() {
          return state.lineCap;
        },
        set lineCap(value: string) {
          state.lineCap = value;
        },
        get lineJoin() {
          return state.lineJoin;
        },
        set lineJoin(value: string) {
          state.lineJoin = value;
        },
        get lineDashOffset() {
          return state.lineDashOffset;
        },
        set lineDashOffset(value: number) {
          state.lineDashOffset = value;
        },
        get font() {
          return state.font;
        },
        set font(value: string) {
          state.font = value;
        },
        get textAlign() {
          return state.textAlign;
        },
        set textAlign(value: string) {
          state.textAlign = value;
        },
        get textBaseline() {
          return state.textBaseline;
        },
        set textBaseline(value: string) {
          state.textBaseline = value;
        },
        save() {
          stack.push({ ...state });
        },
        restore() {
          const next = stack.pop();
          if (next) Object.assign(state, next);
        },
        fillRect(...args: unknown[]) {
          rec("fillRect", args);
        },
        strokeRect(...args: unknown[]) {
          rec("strokeRect", args);
        },
        clearRect(...args: unknown[]) {
          rec("clearRect", args);
        },
        rect(...args: unknown[]) {
          rec("rect", args);
        },
        roundRect(...args: unknown[]) {
          rec("roundRect", args);
        },
        beginPath() {
          rec("beginPath", []);
        },
        closePath() {
          rec("closePath", []);
        },
        moveTo(...args: unknown[]) {
          rec("moveTo", args);
        },
        lineTo(...args: unknown[]) {
          rec("lineTo", args);
        },
        quadraticCurveTo(...args: unknown[]) {
          rec("quadraticCurveTo", args);
        },
        bezierCurveTo(...args: unknown[]) {
          rec("bezierCurveTo", args);
        },
        arc(...args: unknown[]) {
          rec("arc", args);
        },
        ellipse(...args: unknown[]) {
          rec("ellipse", args);
        },
        fill() {
          rec("fill", []);
        },
        stroke() {
          rec("stroke", []);
        },
        clip() {
          rec("clip", []);
        },
        fillText(...args: unknown[]) {
          rec("fillText", args);
        },
        strokeText(...args: unknown[]) {
          rec("strokeText", args);
        },
        measureText(text: string) {
          const size = Number.parseFloat(state.font) || 12;
          return { width: Math.max(1, String(text).length * size * 0.55) };
        },
        createLinearGradient(...args: unknown[]) {
          rec("createLinearGradient", args);
          return gradient();
        },
        createRadialGradient(...args: unknown[]) {
          rec("createRadialGradient", args);
          return gradient();
        },
        setTransform() {
          rec("setTransform", []);
        },
        translate(...args: unknown[]) {
          rec("translate", args);
        },
        rotate(...args: unknown[]) {
          rec("rotate", args);
        },
        scale(...args: unknown[]) {
          rec("scale", args);
        },
        transform() {
          rec("transform", []);
        },
        setLineDash() {},
        drawImage() {
          rec("drawImage", []);
        },
      };
      this.ctx = ctx;
      return ctx;
    }

    toDataURL() {
      return "data:image/png;base64,QQ==";
    }
  }

  (globalThis as { document: unknown }).document = {
    createElement(tag: string) {
      if (tag === "canvas") return new AuditCanvasEl();
      return { style: {} };
    },
  };
  (globalThis as { HTMLCanvasElement: unknown }).HTMLCanvasElement = AuditCanvasEl;

  return () => {
    disposeAll();
    if (hadDoc) (globalThis as { document: unknown }).document = priorDoc;
    else delete (globalThis as { document?: unknown }).document;
    if (hadEl) (globalThis as { HTMLCanvasElement: unknown }).HTMLCanvasElement = priorEl;
    else delete (globalThis as { HTMLCanvasElement?: unknown }).HTMLCanvasElement;
  };
}

function contentOps(calls: AuditCall[], width: number, height: number): AuditCall[] {
  return calls.filter((call) => {
    if (
      call.op === "save" ||
      call.op === "restore" ||
      call.op === "setTransform" ||
      call.op === "clearRect" ||
      call.op === "beginPath" ||
      call.op === "closePath" ||
      call.op === "clip" ||
      call.op === "transform"
    ) {
      return false;
    }
    if (call.op === "fillRect") {
      const [x, y, w, h] = call.args as number[];
      if (w <= 1 && h <= 1) return false;
      if (
        x === 0 &&
        y === 0 &&
        w >= width - 1 &&
        h >= height - 1 &&
        call.fill !== "gradient" &&
        !call.fill.startsWith("rgba") &&
        !call.fill.startsWith("hsla")
      ) {
        return false;
      }
    }
    return true;
  });
}

function paintPreset(id: string, atMs: number, extra: Partial<Parameters<typeof motionBitmap>[2]> = {}) {
  const preset = presetById(id);
  const node = makeMotionNode({
    id: `audit-${id}-${atMs}-${Math.random().toString(36).slice(2, 7)}`,
    width: 320,
    height: 200,
    schema: preset.schema,
    seed: 7,
  });
  const bitmap = motionBitmap(node, [], {
    live: true,
    reduced: false,
    atMs,
    dpr: 1,
    hooks: { hook1: "FILE", hook2: "NOW" },
    ...extra,
  }) as unknown as AuditCanvas;
  return { node, calls: bitmap.calls.slice() };
}

describe("Motion asset audit", () => {
  let restore: (() => void) | undefined;
  afterEach(() => {
    restore?.();
    restore = undefined;
    disposeAll();
    resetMotionSignals();
  });

  it("maps every locked category to exactly one house preset", () => {
    const cats = MOTION_PRESETS.map((preset) => preset.schema.category);
    expect(new Set(cats).size).toBe(cats.length);
    expect(MOTION_PRESETS).toHaveLength(MOTION_CATEGORIES.length);
    for (const category of MOTION_CATEGORIES) {
      expect(cats).toContain(category);
    }
  });

  it("paints a visible rest pose for every house look", () => {
    restore = installAuditCanvas();
    const blank: string[] = [];
    for (const preset of MOTION_PRESETS) {
      const { calls } = paintPreset(preset.id, 1400);
      if (contentOps(calls, 320, 200).length === 0) blank.push(preset.id);
    }
    expect(blank).toEqual([]);
  });

  it("keeps looping looks moving between two ticks", () => {
    restore = installAuditCanvas();
    const looping = [
      "ledger-current",
      "paper-sparks",
      "grain-breath",
      "vapor-drift",
      "static-shiver",
      "vignette-breathing",
      "horizon-shift",
      "parchment-heat",
      "liquid-quartz",
      "liquid-glass-shift",
      "thermal-heat-bloom",
      "redact-sweep",
      "ink-bleed",
      "light-leak",
      "cybernetic-scanline",
      "ledger-margin-glow",
      "resin-gloss-sweep",
      "holographic-foil",
      "vellum-crease",
      "guilloche-wave",
      "glowing-pill-pulse",
      "corporate-ribbon",
      "perspective-grid",
      "network-map",
      "hook-turn",
      "ledger-ticker",
      "ledger-stitch",
      "acoustic-waveform-pulse",
      "topographic-contour",
      "liquid-text-mask",
      "odometer-roll",
      "goo-merge",
      "quantum-glitch",
      "typewriter-cursor",
      "mechanical-escapement",
    ];
    const stuck: string[] = [];
    for (const id of looping) {
      const preset = presetById(id);
      const node = makeMotionNode({
        id: `loop-${id}`,
        width: 320,
        height: 200,
        schema: preset.schema,
        seed: 7,
      });
      const opts = {
        live: true as const,
        reduced: false,
        dpr: 1,
        hooks: { hook1: "FILE", hook2: "NOW" },
      };
      const canvas = motionBitmap(node, [], { ...opts, atMs: 0 }) as unknown as AuditCanvas;
      canvas.calls = [];
      motionBitmap(node, [], { ...opts, atMs: 20 });
      const a = JSON.stringify(contentOps(canvas.calls, 320, 200));
      canvas.calls = [];
      motionBitmap(node, [], { ...opts, atMs: 920 });
      const b = JSON.stringify(contentOps(canvas.calls, 320, 200));
      if (a === b) stuck.push(id);
      disposeNode(node.id);
    }
    expect(stuck).toEqual([]);
  });

  it("does not drop a click that lands between fps ticks", () => {
    restore = installAuditCanvas();
    const node = makeMotionNode({
      id: "click-gap",
      width: 320,
      height: 200,
      schema: presetById("ledger-fracture").schema,
      seed: 3,
    });
    motionBitmap(node, [], { live: true, reduced: false, atMs: 0, dpr: 1 });
    const canvas = motionBitmap(node, [], { live: true, reduced: false, atMs: 0, dpr: 1 }) as unknown as AuditCanvas;
    canvas.calls = [];
    motionBitmap(node, [], {
      live: true,
      reduced: false,
      atMs: 8,
      dpr: 1,
      click: { x: node.x + 48, y: node.y + 40 },
    });
    expect(canvas.calls.filter((call) => call.op === "lineTo").length).toBeGreaterThan(8);
  });

  it("stencil punch sits on a dark plate so the cut-out reads", () => {
    restore = installAuditCanvas();
    const { calls } = paintPreset("kinetic-stencil-punch", 400);
    const plate = calls.some(
      (call) =>
        (call.op === "fillRect" || call.op === "roundRect") &&
        Number(call.args[2]) > 80 &&
        Number(call.args[3]) > 40 &&
        /26,\s*29,\s*33/.test(call.fill),
    );
    expect(plate).toBe(true);
    expect(calls.some((call) => call.op === "fillText" && call.args[0] === "FILE")).toBe(true);
  });

  it("guilloche draws complete roses, not a trimmed open scribble", () => {
    restore = installAuditCanvas();
    const { calls } = paintPreset("guilloche-wave", 0);
    expect(calls.filter((call) => call.op === "lineTo").length).toBeGreaterThan(200);
  });

  it("typewriter cursor blinks while idle", () => {
    restore = installAuditCanvas();
    const idle = snapshotMotionSignals(0);
    const cursor = (atMs: number) =>
      paintPreset("typewriter-cursor", atMs, { signals: idle }).calls.filter(
        (call) => call.op === "fillRect" && Number(call.args[2]) < 40 && Number(call.args[3]) > 8,
      );
    expect(cursor(0).length + cursor(500).length).toBeGreaterThan(0);
  });

  it("escapement ticks while idle instead of freezing at angle 0", () => {
    restore = installAuditCanvas();
    const idle = snapshotMotionSignals(0);
    const angle = (atMs: number) =>
      paintPreset("mechanical-escapement", atMs, { signals: idle }).calls.find((call) => call.op === "rotate")?.args[0];
    expect(angle(0)).not.toEqual(angle(2400));
  });

  it("anode flicker stays faint at rest instead of washing the plate", () => {
    restore = installAuditCanvas();
    const idle = snapshotMotionSignals(0);
    const { calls } = paintPreset("anode-flicker-decay", 800, { signals: idle });
    const wash = calls.filter(
      (call) =>
        call.op === "fillRect" &&
        call.args[0] === 0 &&
        call.args[1] === 0 &&
        Number(call.args[2]) >= 320 &&
        Number(call.args[3]) >= 200 &&
        /26,\s*29,\s*33/.test(call.fill),
    );
    expect(wash).toHaveLength(0);
  });

  it("redact highlight rests on the hook instead of an empty plate", () => {
    restore = installAuditCanvas();
    const { calls } = paintPreset("redact-highlight", 800, { signals: snapshotMotionSignals(0) });
    expect(calls.some((call) => call.fill.toLowerCase().includes("201,27,37") || call.fill === "#C91B25")).toBe(true);
    expect(calls.some((call) => call.op === "fillText")).toBe(true);
  });

  it("after-hours warp still paints a 2d fallback without three.js", () => {
    restore = installAuditCanvas();
    const { calls } = paintPreset("after-hours-warp", 600);
    expect(contentOps(calls, 320, 200).length).toBeGreaterThan(0);
    const runtime = readFileSync("client/src/components/craft/lib/motionRuntime.ts", "utf8");
    expect(runtime).toMatch(/drawWarpFallback/);
  });

  it("CSS node tweens still land on identity when finished", () => {
    for (const motion of IMAGE_MOTIONS) {
      const node = applyNodeMotion(makeMotionNode({ id: `tween-${motion.id}` }), motion.id);
      if (motion.id === "none") {
        expect(evaluateAnimation(node.animation, 120)).toMatchObject({
          opacity: 1,
          scaleX: 1,
          scaleY: 1,
          dx: 0,
          dy: 0,
        });
        continue;
      }
      const spec = node.animation!;
      const mid = evaluateAnimation(spec, spec.duration / 4);
      if (motion.id === "pulse") {
        expect(mid.scaleX).not.toBe(1);
        expect(evaluateAnimation(spec, spec.duration * 3 + spec.duration / 4).scaleX).not.toBe(1);
        continue;
      }
      const done = evaluateAnimation(spec, spec.duration + 20);
      expect(done).toMatchObject({ opacity: 1, scaleX: 1, scaleY: 1, dx: 0, dy: 0, rotationDeg: 0 });
      if (motion.id === "fadeIn") {
        expect(mid.opacity).toBeGreaterThan(0);
        expect(mid.opacity).toBeLessThan(1);
      } else {
        expect(JSON.stringify(mid)).not.toEqual(JSON.stringify(done));
      }
    }
  });
});

describe("CRAFT.md", () => {
  it("docs/CRAFT.md documents MotionNode", () => {
    const md = readFileSync("docs/CRAFT.md", "utf8");
    expect(md).toMatch(/MotionNode|\*\*motion\*\*/);
    expect(md).toMatch(/Ledger Current/);
  });
});

