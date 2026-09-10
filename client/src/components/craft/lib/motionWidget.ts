export const DRIP_TEXTURES = [
  "solid",
  "scanlines",
  "grid",
  "dots",
  "waves",
  "noise",
  "paper",
] as const;

export const DRIP_SHAPES = [
  "teardrop",
  "round",
  "oval",
  "bead",
  "icicle",
  "puddle",
  "bubble",
  "diamond",
  "triangle",
  "hexagon",
  "square",
  "star",
  "snowflake",
  "callout",
  "dollar",
  "pound",
  "euro",
  "splash",
  "ring",
] as const;

export const DRIP_MOTIONS = [
  "gravity",
  "blob",
  "wave",
  "bounce",
  "float",
  "swirl",
  "scroll",
  "pendulum",
  "rain",
  "orbit",
  "jitter",
  "cascade",
  "spiral",
] as const;

export const DRIP_INTERACT = ["none", "ripple", "attract", "repel", "stretch"] as const;

export const DRIP_LIQUIDS = ["honey", "water", "slime", "wax", "ink", "gel"] as const;

export type DripTexture = (typeof DRIP_TEXTURES)[number];
export type DripShape = (typeof DRIP_SHAPES)[number];
export type DripMotion = (typeof DRIP_MOTIONS)[number];
export type DripInteract = (typeof DRIP_INTERACT)[number];
export type DripLiquid = (typeof DRIP_LIQUIDS)[number];

export type MotionWidget = {
  texture: DripTexture;
  shape: DripShape;
  motion: DripMotion;
  interaction: DripInteract;
  gravity: number;
  drift: number;
  viscosity: number;
  turbulence: number;
  fontFamily: string;
  fontWeight: string;
  fontStyle: "normal" | "italic";
  fontSize: number;
  multi: boolean;
};

export const DEFAULT_MOTION_WIDGET: MotionWidget = {
  texture: "solid",
  shape: "teardrop",
  motion: "gravity",
  interaction: "ripple",
  gravity: 1,
  drift: 0.8,
  viscosity: 0.55,
  turbulence: 0.35,
  fontFamily: "Unbounded",
  fontWeight: "800",
  fontStyle: "normal",
  fontSize: 180,
  multi: true,
};

export const DEFAULT_DRIP_WIDGET: MotionWidget = {
  ...DEFAULT_MOTION_WIDGET,
  texture: "scanlines",
  fontFamily: "Arial Black, Arial, sans-serif",
  fontWeight: "900",
  fontSize: 240,
};

export const DRIP_FONTS = [
  { id: "Arial Black, Arial, sans-serif", label: "Arial Black" },
  { id: "Unbounded", label: "Unbounded" },
  { id: "Plus Jakarta Sans", label: "Plus Jakarta" },
  { id: "Impact, Haettenschweiler, sans-serif", label: "Impact" },
  { id: "Georgia, serif", label: "Georgia" },
  { id: "Playfair Display", label: "Playfair" },
  { id: "JetBrains Mono", label: "JetBrains Mono" },
  { id: "Courier New, monospace", label: "Courier" },
] as const;

export const DRIP_FONT_STYLES = [
  { id: "900|normal", label: "Black" },
  { id: "800|normal", label: "Bold" },
  { id: "700|normal", label: "Heavy" },
  { id: "400|normal", label: "Regular" },
  { id: "800|italic", label: "Bold italic" },
  { id: "400|italic", label: "Italic" },
] as const;

export type LiquidPreset = {
  palette: [string, string, string, string];
  background: string;
  motion: DripMotion;
  shape: DripShape;
  gravity: number;
  drift: number;
  viscosity: number;
  texture: DripTexture;
};

export const LIQUID_PRESETS: Record<DripLiquid, LiquidPreset> = {
  honey: {
    palette: ["#d89b24", "#ffe08a", "#a96312", "#6b390d"],
    background: "#1a1408",
    motion: "gravity",
    shape: "teardrop",
    gravity: 0.78,
    drift: 0.35,
    viscosity: 0.28,
    texture: "paper",
  },
  water: {
    palette: ["#bcecff", "#ffffff", "#64b6d9", "#266b91"],
    background: "#081018",
    motion: "wave",
    shape: "round",
    gravity: 0.22,
    drift: 0.9,
    viscosity: 0.18,
    texture: "waves",
  },
  slime: {
    palette: ["#c8f04a", "#eaff9a", "#76a91d", "#355b0b"],
    background: "#11130f",
    motion: "blob",
    shape: "bead",
    gravity: 0.42,
    drift: 0.55,
    viscosity: 0.68,
    texture: "scanlines",
  },
  wax: {
    palette: ["#ff806e", "#ffd1a9", "#d94d5c", "#7d2435"],
    background: "#1a0c0c",
    motion: "gravity",
    shape: "puddle",
    gravity: 0.9,
    drift: 0.25,
    viscosity: 0.72,
    texture: "dots",
  },
  ink: {
    palette: ["#111111", "#f4f0e8", "#606060", "#202020"],
    background: "#f4f0e8",
    motion: "swirl",
    shape: "ring",
    gravity: 0.55,
    drift: 0.8,
    viscosity: 0.2,
    texture: "paper",
  },
  gel: {
    palette: ["#d9a8ff", "#fff0ff", "#9c62d4", "#50307c"],
    background: "#140c18",
    motion: "float",
    shape: "bubble",
    gravity: 0.3,
    drift: 0.65,
    viscosity: 0.5,
    texture: "grid",
  },
};

export function applyLiquidPreset(widget: MotionWidget, id: DripLiquid): { widget: MotionWidget; visual: { palette: string[]; background: string } } {
  const preset = LIQUID_PRESETS[id];
  return {
    widget: {
      ...widget,
      motion: preset.motion,
      shape: preset.shape,
      gravity: preset.gravity,
      drift: preset.drift,
      viscosity: preset.viscosity,
      texture: preset.texture,
      multi: true,
    },
    visual: { palette: [...preset.palette], background: preset.background },
  };
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, n));
}

export function parseMotionWidget(raw: unknown, dripping: boolean): MotionWidget {
  const fallback = dripping ? DEFAULT_DRIP_WIDGET : DEFAULT_MOTION_WIDGET;
  const rec = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const fontStyle = rec.fontStyle === "italic" ? "italic" : "normal";
  return {
    texture: pick(rec.texture, DRIP_TEXTURES, fallback.texture),
    shape: pick(rec.shape, DRIP_SHAPES, fallback.shape),
    motion: pick(rec.motion, DRIP_MOTIONS, fallback.motion),
    interaction: pick(rec.interaction, DRIP_INTERACT, fallback.interaction),
    gravity: num(rec.gravity, fallback.gravity, 0, 2),
    drift: num(rec.drift, fallback.drift, 0, 2),
    viscosity: num(rec.viscosity, fallback.viscosity, 0, 1),
    turbulence: num(rec.turbulence, fallback.turbulence, 0, 2),
    fontFamily: typeof rec.fontFamily === "string" && rec.fontFamily.trim() ? rec.fontFamily : fallback.fontFamily,
    fontWeight: typeof rec.fontWeight === "string" && rec.fontWeight.trim() ? rec.fontWeight : fallback.fontWeight,
    fontStyle,
    fontSize: Math.round(num(rec.fontSize, fallback.fontSize, 80, 360)),
    multi: rec.multi === undefined ? fallback.multi : Boolean(rec.multi),
  };
}
