import {
  LEDGER_CURRENT,
  THREE_CDN,
  type MotionSchema,
} from "./motionSchema";

export type MotionPresetGroup = "Atmosphere" | "Graphic devices" | "Structure" | "Occasional";

export type MotionPreset = {
  id: string;
  name: string;
  group: MotionPresetGroup;
  schema: MotionSchema;
};

export const MOTION_PRESET_GROUPS: MotionPresetGroup[] = [
  "Atmosphere",
  "Graphic devices",
  "Structure",
  "Occasional",
];

const INK_BLUE_PAPER = ["#1A1D21", "#2F5199", "#F7F5F1"] as const;

const VIBE_KEYWORDS: Record<string, string[]> = {
  "ledger-current": ["liquid", "wind", "current", "silk", "smoke"],
  "paper-sparks": ["moody", "starry", "dust", "sparks"],
  "grain-breath": ["grain", "film", "tooth"],
  "after-hours-warp": ["distortion", "glass", "heat", "warp"],
  "stamp-pulse": ["stamp", "slam", "seal"],
  "redact-sweep": ["redact", "bar", "myth"],
  "ink-bleed": ["letterpress", "bleed"],
  "light-leak": ["leak", "flare"],
  "corporate-ribbon": ["clean", "wave", "ribbon", "flag"],
  "perspective-grid": ["grid", "retro", "city"],
  "network-map": ["network", "introducer"],
  "hook-turn": ["hook", "kinetic", "word"],
  "ledger-ticker": ["ticker", "numerals", "ledger"],
  "goo-merge": ["goo", "blob", "merge"],
  "shatter-plate": ["shatter", "crack"],
};

export const MOTION_PRESETS: MotionPreset[] = [
  {
    id: "ledger-current",
    name: "Ledger Current",
    group: "Atmosphere",
    schema: LEDGER_CURRENT,
  },
  {
    id: "paper-sparks",
    name: "Paper Sparks",
    group: "Atmosphere",
    schema: {
      ...LEDGER_CURRENT,
      meta: { title: "Paper sparks", vibe: "moody starry dust motes and sparks over a ledger, screen blend" },
      category: "ParticleSystem",
      visual: {
        ...LEDGER_CURRENT.visual,
        blending: "screen",
        opacity: 0.85,
        grain: 0.04,
        palette: [...INK_BLUE_PAPER],
      },
      physicsAndMath: { ...LEDGER_CURRENT.physicsAndMath, densityCount: 220, speed: 0.35, friction: 0.08 },
      interactionRules: { ...LEDGER_CURRENT.interactionRules, triggerType: "none" },
    },
  },
  {
    id: "grain-breath",
    name: "Grain Breath",
    group: "Atmosphere",
    schema: {
      ...LEDGER_CURRENT,
      meta: { title: "Grain breath", vibe: "paper tooth and film grain that barely moves" },
      category: "GrainField",
      visual: {
        ...LEDGER_CURRENT.visual,
        opacity: 0.28,
        grain: 0.12,
        blending: "multiply",
        palette: [...INK_BLUE_PAPER],
      },
      physicsAndMath: { ...LEDGER_CURRENT.physicsAndMath, densityCount: 80, speed: 0.08, amplitude: 6 },
      interactionRules: { triggerType: "none", influenceRadius: 0, strength: 0, falloff: "smooth" },
    },
  },
  {
    id: "after-hours-warp",
    name: "After-hours Warp",
    group: "Atmosphere",
    schema: {
      ...LEDGER_CURRENT,
      meta: { title: "After-hours warp", vibe: "glass heat distortion warp after closing" },
      category: "CustomShaderDistortion",
      engine: { library: "ThreeJS", renderContext: "webgl", cdn: THREE_CDN },
      visual: {
        ...LEDGER_CURRENT.visual,
        opacity: 0.8,
        grain: 0.05,
        blending: "source-over",
        palette: [...INK_BLUE_PAPER],
      },
      physicsAndMath: { ...LEDGER_CURRENT.physicsAndMath, densityCount: 64, speed: 0.4, amplitude: 18, frequency: 1.1 },
      interactionRules: { ...LEDGER_CURRENT.interactionRules, triggerType: "mousemove", influenceRadius: 200, strength: 0.9 },
    },
  },
  {
    id: "stamp-pulse",
    name: "Stamp Pulse",
    group: "Graphic devices",
    schema: {
      ...LEDGER_CURRENT,
      meta: { title: "Stamp pulse", vibe: "stamp slam seal ring with a gold needle" },
      category: "StampPulse",
      visual: {
        ...LEDGER_CURRENT.visual,
        opacity: 0.92,
        grain: 0.04,
        blending: "source-over",
        palette: ["#1A1D21", "#C69123", "#F7F5F1"],
      },
      physicsAndMath: { ...LEDGER_CURRENT.physicsAndMath, densityCount: 24, speed: 0.55, amplitude: 12, frequency: 1 },
      interactionRules: { triggerType: "click", influenceRadius: 80, strength: 1.4, falloff: "smooth" },
    },
  },
  {
    id: "redact-sweep",
    name: "Redact Sweep",
    group: "Graphic devices",
    schema: {
      ...LEDGER_CURRENT,
      meta: { title: "Redact sweep", vibe: "redact bar myth strike, never writes copy" },
      category: "RedactSweep",
      visual: {
        ...LEDGER_CURRENT.visual,
        opacity: 0.95,
        grain: 0.02,
        blending: "source-over",
        palette: ["#1A1D21", "#C91B25", "#F7F5F1"],
      },
      physicsAndMath: { ...LEDGER_CURRENT.physicsAndMath, densityCount: 16, speed: 0.6, amplitude: 8, frequency: 0.8 },
      interactionRules: { triggerType: "none", influenceRadius: 0, strength: 0, falloff: "smooth" },
    },
  },
  {
    id: "ink-bleed",
    name: "Ink Bleed",
    group: "Graphic devices",
    schema: {
      ...LEDGER_CURRENT,
      meta: { title: "Ink bleed", vibe: "letterpress bleed and misregistration squash" },
      category: "InkBleed",
      visual: {
        ...LEDGER_CURRENT.visual,
        opacity: 0.78,
        grain: 0.08,
        blending: "multiply",
        palette: [...INK_BLUE_PAPER],
      },
      physicsAndMath: { ...LEDGER_CURRENT.physicsAndMath, densityCount: 120, speed: 0.22, amplitude: 14, friction: 0.2 },
      interactionRules: { triggerType: "none", influenceRadius: 0, strength: 0, falloff: "smooth" },
    },
  },
  {
    id: "light-leak",
    name: "Light Leak",
    group: "Graphic devices",
    schema: {
      ...LEDGER_CURRENT,
      meta: { title: "Light leak", vibe: "one optical flare leak across paper" },
      category: "LightLeak",
      visual: {
        ...LEDGER_CURRENT.visual,
        opacity: 0.7,
        grain: 0.05,
        blending: "screen",
        palette: ["#F7F5F1", "#C69123", "#2F5199"],
      },
      physicsAndMath: { ...LEDGER_CURRENT.physicsAndMath, densityCount: 48, speed: 0.5, amplitude: 40, frequency: 0.6 },
      interactionRules: { triggerType: "none", influenceRadius: 0, strength: 0, falloff: "smooth" },
    },
  },
  {
    id: "corporate-ribbon",
    name: "Corporate Ribbon",
    group: "Structure",
    schema: {
      ...LEDGER_CURRENT,
      meta: { title: "Corporate ribbon", vibe: "clean strata wave ribbon flag, blue on paper" },
      category: "SineWaveRibbon",
      visual: {
        ...LEDGER_CURRENT.visual,
        opacity: 0.9,
        grain: 0.03,
        palette: ["#2F5199", "#1A1D21", "#F7F5F1"],
      },
      physicsAndMath: { ...LEDGER_CURRENT.physicsAndMath, densityCount: 8, speed: 0.45, amplitude: 28, frequency: 1.6 },
      interactionRules: { triggerType: "none", influenceRadius: 0, strength: 0, falloff: "smooth" },
    },
  },
  {
    id: "perspective-grid",
    name: "Perspective Grid",
    group: "Structure",
    schema: {
      ...LEDGER_CURRENT,
      meta: { title: "Perspective grid", vibe: "retro city grid vanishing into paper" },
      category: "PerspectiveGrid",
      visual: {
        ...LEDGER_CURRENT.visual,
        opacity: 0.88,
        grain: 0.03,
        palette: [...INK_BLUE_PAPER],
      },
      physicsAndMath: { ...LEDGER_CURRENT.physicsAndMath, densityCount: 32, speed: 0.3, amplitude: 20, frequency: 1.4 },
      interactionRules: { triggerType: "scroll", influenceRadius: 120, strength: 0.8, falloff: "linear" },
    },
  },
  {
    id: "network-map",
    name: "Network Map",
    group: "Structure",
    schema: {
      ...LEDGER_CURRENT,
      meta: { title: "Network map", vibe: "introducer network nodes and thin edges" },
      category: "NetworkGraph",
      visual: {
        ...LEDGER_CURRENT.visual,
        opacity: 0.86,
        grain: 0.04,
        palette: [...INK_BLUE_PAPER],
      },
      physicsAndMath: { ...LEDGER_CURRENT.physicsAndMath, densityCount: 36, speed: 0.25, amplitude: 10, friction: 0.18 },
      interactionRules: { triggerType: "hover", influenceRadius: 100, strength: 1, falloff: "smooth" },
    },
  },
  {
    id: "hook-turn",
    name: "Hook Turn",
    group: "Structure",
    schema: {
      ...LEDGER_CURRENT,
      meta: { title: "Hook turn", vibe: "kinetic word hook turn reading sibling hooks" },
      category: "TypeKinetic",
      visual: {
        ...LEDGER_CURRENT.visual,
        opacity: 0.95,
        grain: 0.02,
        palette: [...INK_BLUE_PAPER],
      },
      physicsAndMath: { ...LEDGER_CURRENT.physicsAndMath, densityCount: 12, speed: 0.4, amplitude: 16, frequency: 1 },
      interactionRules: { triggerType: "none", influenceRadius: 0, strength: 0, falloff: "smooth" },
    },
  },
  {
    id: "ledger-ticker",
    name: "Ledger Ticker",
    group: "Structure",
    schema: {
      ...LEDGER_CURRENT,
      meta: { title: "Ledger ticker", vibe: "mono numerals ticker: LEDGER, ON TIME, FILE 04, ISO dates" },
      category: "DataTicker",
      visual: {
        ...LEDGER_CURRENT.visual,
        opacity: 0.9,
        grain: 0.02,
        palette: [...INK_BLUE_PAPER],
      },
      physicsAndMath: { ...LEDGER_CURRENT.physicsAndMath, densityCount: 20, speed: 0.65, amplitude: 4, frequency: 1.2 },
      interactionRules: { triggerType: "none", influenceRadius: 0, strength: 0, falloff: "smooth" },
    },
  },
  {
    id: "goo-merge",
    name: "Goo Merge",
    group: "Occasional",
    schema: {
      ...LEDGER_CURRENT,
      meta: { title: "Goo merge", vibe: "lawful goo blob merge on paper" },
      category: "MetaballGoo",
      visual: {
        ...LEDGER_CURRENT.visual,
        opacity: 0.82,
        grain: 0.05,
        blending: "source-over",
        palette: [...INK_BLUE_PAPER],
      },
      physicsAndMath: { ...LEDGER_CURRENT.physicsAndMath, densityCount: 28, speed: 0.35, amplitude: 24, friction: 0.12 },
      interactionRules: { triggerType: "mousemove", influenceRadius: 140, strength: 1.1, falloff: "smooth" },
    },
  },
  {
    id: "shatter-plate",
    name: "Shatter Plate",
    group: "Occasional",
    schema: {
      ...LEDGER_CURRENT,
      meta: { title: "Shatter plate", vibe: "shatter crack plate on click" },
      category: "VoronoiShatter",
      visual: {
        ...LEDGER_CURRENT.visual,
        opacity: 0.9,
        grain: 0.04,
        palette: [...INK_BLUE_PAPER],
      },
      physicsAndMath: { ...LEDGER_CURRENT.physicsAndMath, densityCount: 40, speed: 0.7, amplitude: 30, frequency: 1.5 },
      interactionRules: { triggerType: "click", influenceRadius: 200, strength: 1.6, falloff: "linear" },
    },
  },
];

export function presetById(id: string): MotionPreset {
  return MOTION_PRESETS.find((preset) => preset.id === id) ?? MOTION_PRESETS[0]!;
}

export function matchMotionPreset(phrase: string): string {
  const words = phrase
    .toLowerCase()
    .split(/[^a-z0-9%]+/)
    .filter(Boolean);
  let bestId = "ledger-current";
  let bestScore = 0;

  for (const preset of MOTION_PRESETS) {
    const vibe = (preset.schema.meta?.vibe ?? "").toLowerCase();
    const keywords = VIBE_KEYWORDS[preset.id] ?? [];
    let score = 0;
    for (const word of words) {
      if (keywords.includes(word)) score += 1;
      if (vibe.split(/[^a-z0-9%]+/).includes(word)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestId = preset.id;
    }
  }

  return bestId;
}
