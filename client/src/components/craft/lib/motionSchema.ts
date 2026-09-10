import { parseMotionWidget, type MotionWidget } from "./motionWidget";

export type { MotionWidget } from "./motionWidget";

export const MOTION_SCHEMA_ID = "WebAnimationIntegrationSchema";
export const MOTION_SCHEMA_VERSION = "1.0.0";
export const THREE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js";

export const MOTION_CATEGORIES = [
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
] as const;

export type MotionCategory = (typeof MOTION_CATEGORIES)[number];
export type MotionBlending = "source-over" | "screen" | "additive" | "multiply" | "overlay";
export type MotionTrigger = "none" | "mousemove" | "click" | "scroll" | "touch" | "hover";
export type MotionFps = 24 | 30 | 60 | 120;

export type MotionEngine =
  | { library: "VanillaCanvas2D"; renderContext: "2d" }
  | { library: "ThreeJS"; renderContext: "webgl"; cdn: string };

export type MotionDomTarget = {
  selector: string;
  createIfMissing: boolean;
  tag: "canvas";
  positioning: "absolute";
  zIndex: number;
  pointerEvents: "none";
  fit: "cover";
};

export const DOM_TARGET: MotionDomTarget = {
  selector: "#motion-node",
  createIfMissing: true,
  tag: "canvas",
  positioning: "absolute",
  zIndex: 0,
  pointerEvents: "none",
  fit: "cover",
};

export type MotionSchema = {
  schemaId: typeof MOTION_SCHEMA_ID;
  version: typeof MOTION_SCHEMA_VERSION;
  meta?: { title: string; vibe: string };
  category: MotionCategory;
  engine: MotionEngine;
  domTarget: MotionDomTarget;
  visual: {
    palette: string[];
    background: string;
    blending: MotionBlending;
    opacity: number;
    bloom: boolean;
    grain: number;
  };
  physicsAndMath: {
    densityCount: number;
    friction: number;
    speed: number;
    amplitude: number;
    frequency: number;
    noise: "Perlin" | "Simplex";
    octaves: number;
    timestep: number;
  };
  interactionRules: {
    triggerType: MotionTrigger;
    influenceRadius: number;
    strength: number;
    falloff: "smooth" | "linear";
  };
  performance: {
    fpsCap: MotionFps;
    pauseOffscreen: boolean;
    respectReducedMotion: true;
    maxDpr: number;
  };
  widget?: MotionWidget;
};

const ALLOWED_ROOT = new Set([
  "schemaId",
  "version",
  "meta",
  "category",
  "engine",
  "domTarget",
  "visual",
  "physicsAndMath",
  "interactionRules",
  "performance",
  "widget",
]);

export const LEDGER_CURRENT: MotionSchema = {
  schemaId: MOTION_SCHEMA_ID,
  version: MOTION_SCHEMA_VERSION,
  meta: { title: "Ledger current", vibe: "ink-and-paper flow field that follows the mouse" },
  category: "FlowField",
  engine: { library: "VanillaCanvas2D", renderContext: "2d" },
  domTarget: DOM_TARGET,
  visual: {
    palette: ["#1A1D21", "#2F5199", "#F7F5F1"],
    background: "#F7F5F1",
    blending: "source-over",
    opacity: 0.72,
    bloom: false,
    grain: 0.06,
  },
  physicsAndMath: {
    densityCount: 640,
    friction: 0.14,
    speed: 0.7,
    amplitude: 36,
    frequency: 1.2,
    noise: "Simplex",
    octaves: 3,
    timestep: 0.016,
  },
  interactionRules: {
    triggerType: "mousemove",
    influenceRadius: 160,
    strength: 1.2,
    falloff: "smooth",
  },
  performance: {
    fpsCap: 60,
    pauseOffscreen: true,
    respectReducedMotion: true,
    maxDpr: 2,
  },
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function hex(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseEngine(engine: Record<string, unknown> | null): MotionEngine | null {
  if (!engine) return null;
  if (engine.library === "VanillaCanvas2D") {
    return { library: "VanillaCanvas2D", renderContext: "2d" };
  }
  if (engine.library === "ThreeJS") {
    return { library: "ThreeJS", renderContext: "webgl", cdn: THREE_CDN };
  }
  return null;
}

export function hashMotionSchema(schema: MotionSchema): string {
  const json = JSON.stringify(schema);
  let h = 5381;
  for (let i = 0; i < json.length; i++) h = ((h << 5) + h) ^ json.charCodeAt(i);
  return (h >>> 0).toString(16);
}

export function validateMotionSchema(raw: unknown): { ok: boolean; error?: string; schema: MotionSchema } {
  const rec = asRecord(raw);
  if (!rec) return { ok: false, error: "not an object", schema: LEDGER_CURRENT };

  const extras = Object.keys(rec).filter((key) => !ALLOWED_ROOT.has(key));
  const category = MOTION_CATEGORIES.includes(rec.category as MotionCategory)
    ? (rec.category as MotionCategory)
    : null;
  const engine = parseEngine(asRecord(rec.engine));
  const domTarget = asRecord(rec.domTarget);
  const visual = asRecord(rec.visual);
  const physics = asRecord(rec.physicsAndMath);
  const interaction = asRecord(rec.interactionRules);
  const performance = asRecord(rec.performance);

  if (
    extras.length ||
    !category ||
    !engine ||
    !domTarget ||
    !visual ||
    !physics ||
    !interaction ||
    !performance
  ) {
    return {
      ok: false,
      error: extras.length ? `extra keys: ${extras.join(", ")}` : "illegal motion schema",
      schema: LEDGER_CURRENT,
    };
  }

  if (category === "CustomShaderDistortion" && engine.library !== "ThreeJS") {
    return { ok: false, error: "illegal motion schema", schema: LEDGER_CURRENT };
  }

  const paletteRaw = Array.isArray(visual.palette) ? visual.palette.filter((item): item is string => typeof item === "string") : [];
  const fps: MotionFps =
    performance.fpsCap === 24 || performance.fpsCap === 30 || performance.fpsCap === 60 || performance.fpsCap === 120
      ? performance.fpsCap
      : 60;
  const blending: MotionBlending =
    visual.blending === "screen" || visual.blending === "additive" || visual.blending === "multiply" || visual.blending === "overlay"
      ? visual.blending
      : "source-over";
  const trigger: MotionTrigger =
    interaction.triggerType === "mousemove" ||
    interaction.triggerType === "click" ||
    interaction.triggerType === "scroll" ||
    interaction.triggerType === "touch" ||
    interaction.triggerType === "hover"
      ? interaction.triggerType
      : "none";

  let noise: "Perlin" | "Simplex" = physics.noise === "Perlin" ? "Perlin" : "Simplex";
  if (category === "FlowField" && physics.noise !== "Perlin" && physics.noise !== "Simplex") {
    noise = "Simplex";
  }

  const meta = asRecord(rec.meta);
  return {
    ok: true,
    schema: {
      schemaId: MOTION_SCHEMA_ID,
      version: MOTION_SCHEMA_VERSION,
      meta: meta
        ? { title: asString(meta.title, LEDGER_CURRENT.meta!.title), vibe: asString(meta.vibe, LEDGER_CURRENT.meta!.vibe) }
        : undefined,
      category,
      engine,
      domTarget: DOM_TARGET,
      visual: {
        palette: (paletteRaw.length ? paletteRaw : LEDGER_CURRENT.visual.palette).slice(0, 4).map((item, i) => hex(item, LEDGER_CURRENT.visual.palette[i] ?? "#1A1D21")),
        background: visual.background === "transparent" ? "transparent" : hex(visual.background, LEDGER_CURRENT.visual.background),
        blending,
        opacity: clamp(asNumber(visual.opacity, 0.72), 0, 1),
        bloom: false,
        grain: clamp(asNumber(visual.grain, 0.06), 0, 0.4),
      },
      physicsAndMath: {
        densityCount: Math.round(clamp(asNumber(physics.densityCount, 640), 8, 4000)),
        friction: clamp(asNumber(physics.friction, 0.14), 0, 1),
        speed: clamp(asNumber(physics.speed, 0.7), 0, 4),
        amplitude: clamp(asNumber(physics.amplitude, 36), 0, 200),
        frequency: clamp(asNumber(physics.frequency, 1.2), 0, 8),
        noise,
        octaves: Math.round(clamp(asNumber(physics.octaves, 3), 1, 6)),
        timestep: clamp(asNumber(physics.timestep, 0.016), 0.008, 0.05),
      },
      interactionRules: {
        triggerType: trigger,
        influenceRadius: clamp(asNumber(interaction.influenceRadius, 160), 0, 800),
        strength: clamp(asNumber(interaction.strength, 1.2), 0, 4),
        falloff: interaction.falloff === "linear" ? "linear" : "smooth",
      },
      performance: {
        fpsCap: fps,
        pauseOffscreen: performance.pauseOffscreen !== false,
        respectReducedMotion: true,
        maxDpr: clamp(asNumber(performance.maxDpr, 2), 1, 2),
      },
      widget: parseMotionWidget(rec.widget, category === "DrippingText"),
    },
  };
}

const SESSION_WARNINGS = new Map<string, string>();

export function setMotionSessionWarning(id: string, message: string) {
  if (!id) return;
  SESSION_WARNINGS.set(id, message);
}

export function getMotionSessionWarning(id: string): string | undefined {
  return SESSION_WARNINGS.get(id);
}

export function clearMotionSessionWarning(id?: string) {
  if (id) SESSION_WARNINGS.delete(id);
  else SESSION_WARNINGS.clear();
}
