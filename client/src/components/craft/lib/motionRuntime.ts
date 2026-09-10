import {
  LEDGER_CURRENT,
  hashMotionSchema,
  setMotionSessionWarning,
  validateMotionSchema,
  type MotionSchema,
} from "./motionSchema";
import { DEFAULT_MOTION_WIDGET } from "./motionWidget";
import { drawWidgetTexture, paintDrip, type DripState } from "./motionDrip";
import {
  earliest,
  oneShot,
  snapshotMotionSignals,
  type MotionSignalsSnap,
} from "./motionSignals";
import { getImageEl } from "./renderer";
import {
  DEFAULT_CONSTRAINTS,
  uid,
  type CraftAsset,
  type CraftNode,
  type MotionNode,
  type MotionPreview,
} from "./types";

export type MotionDraft = Partial<Omit<MotionNode, "type" | "schema" | "constraints">> & {
  schema?: MotionSchema;
  constraints?: MotionNode["constraints"];
};

export type MotionDrawOpts = {
  live: boolean;
  reduced: boolean;
  pointer?: { x: number; y: number } | null;
  click?: { x: number; y: number } | null;
  atMs: number;
  dpr?: number;
  hooks?: { hook1?: string; hook2?: string };
  onImage?: () => void;
  signals?: MotionSignalsSnap;
};

export type MotionHostView = {
  panX: number;
  panY: number;
  zoom: number;
  hostW: number;
  hostH: number;
};

type Particle = { x: number; y: number; vx: number; vy: number };

type Slot = {
  canvas: HTMLCanvasElement;
  key: string;
  particles: Particle[];
  painted: boolean;
  lastTickMs: number;
  clickAtMs?: number;
  clickX?: number;
  clickY?: number;
  lagX?: number;
  lagY?: number;
  warpOk?: boolean;
  quartzSurface?: HTMLCanvasElement;
  drip?: DripState;
  /** Generic per-node scratch cache (mask points, luminance grids, …) — one entry, keyed, since only one category paints a node at a time. */
  cache?: { key: string; data: unknown };
};

type MotionThreeMod = {
  ensureThree: () => Promise<void>;
  drawWarp: (canvas: HTMLCanvasElement, node: MotionNode, atMs: number) => boolean;
  dispose: (id?: string) => void;
};

const REGISTRY = new Map<string, Slot>();
const liveWarps = new Set<string>();
let warpMod: MotionThreeMod | null = null;

/** Runtime-only particle spawn multiplier; never written into schema. */
export let densityScale = 1;

export function setDensityScale(scale: number) {
  densityScale = scale;
}

export function makeMotionNode(partial: MotionDraft = {}): MotionNode {
  const schema = validateMotionSchema(partial.schema ?? LEDGER_CURRENT).schema;
  return {
    id: partial.id ?? uid("motion"),
    name: partial.name ?? "Motion",
    type: "motion",
    x: partial.x ?? 48,
    y: partial.y ?? 48,
    width: partial.width ?? 640,
    height: partial.height ?? 400,
    rotation: partial.rotation ?? 0,
    opacity: partial.opacity ?? 1,
    locked: partial.locked ?? false,
    hidden: partial.hidden ?? false,
    constraints: partial.constraints ?? { ...DEFAULT_CONSTRAINTS, horizontal: "scale", vertical: "scale" },
    schema,
    preview: partial.preview ?? "live",
    capturedAssetId: partial.capturedAssetId,
    seed: partial.seed ?? 1,
    text: partial.text,
    text2: partial.text2,
    mask: partial.mask,
    stroke: partial.stroke,
    strokeWidth: partial.strokeWidth,
    shadow: partial.shadow,
    animation: partial.animation,
    role: partial.role,
  };
}

export function liveMotionIds(
  nodes: CraftNode[],
  selectedIds: string[],
  cap = 8,
  view?: MotionHostView | null,
): Set<string> {
  const motion = nodes.filter((node): node is MotionNode => {
    if (node.type !== "motion" || node.preview !== "live" || node.hidden || node.locked) return false;
    if (view && !nodeOnscreen(node, view)) return false;
    return true;
  });
  const selected = new Set(selectedIds);
  const ordered = [...motion.filter((node) => selected.has(node.id)), ...motion.filter((node) => !selected.has(node.id))];
  return new Set(ordered.slice(0, cap).map((node) => node.id));
}

export function influencePointer(
  triggerType: MotionSchema["interactionRules"]["triggerType"],
  move: { x: number; y: number } | null | undefined,
  click: { x: number; y: number } | null | undefined,
): { x: number; y: number } | null {
  if (triggerType === "click") return click ?? null;
  if (triggerType === "mousemove" || triggerType === "hover" || triggerType === "touch") return move ?? null;
  return null;
}

function disposeWarpGlFor(id: string) {
  liveWarps.delete(id);
  if (liveWarps.size === 0) releaseWarpGl();
}

export function disposeNode(id: string) {
  REGISTRY.delete(id);
  disposeWarpGlFor(id);
}

export function disposeAll() {
  REGISTRY.clear();
  liveWarps.clear();
  releaseWarpGl();
}

export function syncMotionLiveSet(liveIds: Set<string>) {
  for (const id of [...liveWarps]) {
    if (!liveIds.has(id)) disposeWarpGlFor(id);
  }
  if (liveWarps.size === 0) releaseWarpGl();
}

export function retainMotionNodes(ids: Iterable<string>) {
  const keep = new Set(ids);
  for (const id of [...REGISTRY.keys()]) {
    if (!keep.has(id)) disposeNode(id);
  }
}

export function resolveMotionPreview(node: MotionNode, prefersReduced: boolean): MotionPreview {
  if (prefersReduced) return "reduced";
  return node.preview;
}

export function nodeOnscreen(
  node: MotionNode,
  view: { panX: number; panY: number; zoom: number; hostW: number; hostH: number },
): boolean {
  if (!node.schema.performance.pauseOffscreen) return true;
  const left = node.x * view.zoom + view.panX;
  const top = node.y * view.zoom + view.panY;
  const right = (node.x + node.width) * view.zoom + view.panX;
  const bottom = (node.y + node.height) * view.zoom + view.panY;
  return left < view.hostW && right > 0 && top < view.hostH && bottom > 0;
}

function hashNoise(x: number, y: number, seed: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function fieldAngle(x: number, y: number, schema: MotionSchema, seed: number): number {
  const f = schema.physicsAndMath.frequency;
  let amp = 1;
  let freq = f;
  let n = 0;
  for (let o = 0; o < schema.physicsAndMath.octaves; o++) {
    n += (hashNoise(x * freq * 0.01, y * freq * 0.01, seed + o) - 0.5) * amp;
    amp *= 0.5;
    freq *= 2;
  }
  return n * Math.PI * 2;
}

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(rgb: [number, number, number], a: number): string {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

const GOLD_HEX = "#c69123";
const GOLD_RGB: [number, number, number] = [198, 145, 35];
const REDACT = "#C91B25";
const TICKER_DATE = "2026-09-04";
const TICKER_COPY = ["LEDGER", "ON TIME", "FILE 04", TICKER_DATE] as const;

function paletteHasGold(palette: string[]): boolean {
  return palette.some((color) => color.toLowerCase() === GOLD_HEX);
}

function easeOut01(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return 1 - (1 - u) ** 3;
}

// ---- shared helpers for the ported motion-widget presets (word/letter/glitch plates) ----
function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function easeInOut01(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}
function easeBackOut01(t: number): number {
  const c = 1.70158;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}
function quadBezier(
  a: { x: number; y: number },
  c: { x: number; y: number },
  b: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}
function wordFrom(opts: MotionDrawOpts, fallback: string): string {
  const raw = opts.hooks?.hook1?.trim();
  return (raw && raw.length ? raw : fallback).toUpperCase();
}
function paletteColor(node: MotionNode, i: number): string {
  const palette = node.schema.visual.palette;
  if (!palette.length) return "#c8f04a";
  return palette[((i % palette.length) + palette.length) % palette.length] ?? palette[0]!;
}
function fitWordFont(
  ctx: CanvasRenderingContext2D,
  word: string,
  maxWidth: number,
  maxHeight: number,
  weight = "900",
  family = '"Unbounded", "Arial Black", Arial, sans-serif',
): number {
  let size = Math.min(Math.max(maxHeight, 24), 400);
  ctx.font = `${weight} ${size}px ${family}`;
  const measured = ctx.measureText(word).width;
  if (measured > maxWidth) size = Math.max(12, size * (maxWidth / Math.max(1, measured)));
  ctx.font = `${weight} ${size}px ${family}`;
  return size;
}
function pistonStroke(t: number): number {
  const p = ((t % 1) + 1) % 1;
  if (p < 0.28) return easeOut01(p / 0.28) * 1.18;
  if (p < 0.5) return 1 + 0.18 * Math.cos(((p - 0.28) / 0.22) * (Math.PI / 2) * 3) * (1 - (p - 0.28) / 0.22);
  return 1 - easeOut01((p - 0.5) / 0.5);
}
function drawAssemblyFragment(ctx: CanvasRenderingContext2D, part: number, size: number) {
  ctx.beginPath();
  if (part === 0) ctx.rect(-size * 0.3, -size * 0.3, size * 0.6, size * 0.6);
  else if (part === 1) {
    ctx.moveTo(0, -size * 0.36);
    ctx.lineTo(size * 0.34, size * 0.26);
    ctx.lineTo(-size * 0.34, size * 0.26);
    ctx.closePath();
  } else {
    ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
  }
  ctx.fill();
}

// ---- shared helpers for the "set two" motion-widget ports (mask sampling, luminance grids, paragraph text) ----
function getCache<T>(slot: Slot, key: string, compute: () => T): T {
  if (slot.cache && slot.cache.key === key) return slot.cache.data as T;
  const data = compute();
  slot.cache = { key, data };
  return data;
}
function paragraphFrom(node: MotionNode, opts: MotionDrawOpts, fallback: string): string {
  const raw = node.text?.trim() || opts.hooks?.hook1?.trim();
  return raw && raw.length ? raw : fallback;
}
function maskPointsFor(
  node: MotionNode,
  word: string,
  maxWidth: number,
  maxHeight: number,
  step: number,
): { x: number; y: number }[] {
  if (!canUseDomCanvas()) return [];
  const W = Math.max(1, Math.round(node.width));
  const H = Math.max(1, Math.round(node.height));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");
  if (!g) return [];
  fitWordFont(g, word, maxWidth, maxHeight);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#fff";
  g.fillText(word, W / 2, H / 2);
  const data = g.getImageData(0, 0, W, H).data;
  const out: { x: number; y: number }[] = [];
  for (let y = step / 2; y < H; y += step) {
    for (let x = step / 2; x < W; x += step) {
      const idx = (Math.floor(y) * W + Math.floor(x)) * 4 + 3;
      if ((data[idx] ?? 0) > 40) out.push({ x, y });
    }
  }
  return out;
}
function cachedMaskPoints(
  slot: Slot,
  prefix: string,
  node: MotionNode,
  word: string,
  maxWidth: number,
  maxHeight: number,
  step: number,
): { x: number; y: number }[] {
  const key = `${prefix}:${word}:${step}:${Math.round(node.width)}x${Math.round(node.height)}`;
  return getCache(slot, key, () => maskPointsFor(node, word, maxWidth, maxHeight, step));
}
function luminanceGridFor(word: string, cols: number, rows: number): Float32Array {
  const data = new Float32Array(cols * rows);
  if (!canUseDomCanvas()) return data;
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const g = canvas.getContext("2d");
  if (!g) return data;
  g.fillStyle = "#000";
  g.fillRect(0, 0, cols, rows);
  g.fillStyle = "#fff";
  let fontSize = rows * 0.5;
  g.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`;
  const measured = g.measureText(word).width;
  if (measured > cols * 0.85) fontSize *= (cols * 0.85) / Math.max(1, measured);
  g.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(word, cols / 2, rows / 2);
  const px = g.getImageData(0, 0, cols, rows).data;
  for (let i = 0; i < data.length; i++) {
    data[i] = (px[i * 4]! * 0.299 + px[i * 4 + 1]! * 0.587 + px[i * 4 + 2]! * 0.114) / 255;
  }
  return data;
}

function drawStaticResolve(args: PaintArgs) {
  const { ctx, node, t, seed, opts, slot } = args;
  const word = wordFrom(opts, "LISTEN");
  const points = cachedMaskPoints(slot, "static", node, word, node.width * 0.84, node.height * 0.5, 6);
  const cycle = 5;
  const phase = ((t % cycle) + cycle) % cycle / cycle;
  const clarity = phase < 0.65 ? clamp01(phase / 0.5) : clamp01(1 - (phase - 0.65) / 0.35);
  ctx.save();
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const noise = hashNoise(i, Math.floor(t * 24), seed);
    const resolved = noise < clarity;
    const size = resolved ? 2.4 : 1.6;
    ctx.globalAlpha = resolved ? 0.9 : 0.35 * (1 - clarity);
    ctx.fillStyle = paletteColor(node, resolved ? (noise < clarity * 0.15 ? 1 : 0) : 2);
    ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
  }
  ctx.restore();
  if (clarity < 0.4) {
    ctx.save();
    ctx.font = "10px monospace";
    ctx.fillStyle = paletteColor(node, 1);
    ctx.textAlign = "center";
    ctx.globalAlpha = clamp01(0.5 * (1 - clarity));
    ctx.fillText("resolving…", node.width / 2, node.height * 0.9);
    ctx.restore();
  }
}

function drawRedactionLift(args: PaintArgs) {
  const { ctx, node, t, opts } = args;
  const text = paragraphFrom(
    node,
    opts,
    "This paragraph was never meant to be read. It declassifies itself, one word at a time, then seals back up.",
  );
  const size = Math.max(12, Math.min(28, node.height * 0.09));
  ctx.font = `700 ${size}px Arial, sans-serif`;
  const pad = node.width * 0.1;
  const maxW = node.width - pad * 2;
  const space = ctx.measureText(" ").width;
  const lh = size * 1.55;
  const words = text.split(/\s+/).filter(Boolean);
  const items: { w: string; x: number; y: number; wd: number; line: number }[] = [];
  let x = pad;
  let line = 0;
  for (const w of words) {
    const wd = ctx.measureText(w).width;
    if (x + wd > pad + maxW && x > pad) {
      x = pad;
      line++;
    }
    items.push({ w, x, y: 0, wd, line });
    x += wd + space;
  }
  const lines = line + 1;
  const top = (node.height - lines * lh) / 2 + size * 0.8;
  for (const it of items) it.y = top + it.line * lh;
  const revealSpan = 0.6 + items.length * 0.12;
  const cycle = revealSpan + 2.5;
  const cyc = ((t % cycle) + cycle) % cycle;
  ctx.textBaseline = "alphabetic";
  items.forEach((it, i) => {
    const seenAt = i * 0.12 + 0.5;
    const open =
      cyc < revealSpan
        ? clamp01((cyc - seenAt) / 0.3)
        : cyc < revealSpan + 1.2
          ? 1
          : clamp01(1 - (cyc - revealSpan - 1.2) / 1.3);
    ctx.fillStyle = paletteColor(node, 0);
    ctx.globalAlpha = open;
    ctx.fillText(it.w, it.x, it.y);
    ctx.globalAlpha = 1;
    const bw = it.wd + 8;
    const bh = size * 1.08;
    const e = easeOut01(open);
    ctx.fillStyle = paletteColor(node, 2);
    ctx.globalAlpha = 1 - e;
    ctx.fillRect(it.x - 4 + e * bw, it.y - size * 0.86, bw * (1 - e), bh);
    ctx.globalAlpha = 1;
  });
}

function drawKintsugiMend(args: PaintArgs) {
  const { ctx, node, t, seed, opts } = args;
  const word = wordFrom(opts, "MEND");
  const size = fitWordFont(ctx, word, node.width * 0.84, node.height * 0.5);
  const W = node.width;
  const H = node.height;
  const tw = ctx.measureText(word).width;
  const x0 = W / 2 - tw / 2 - 10;
  const y0 = H / 2 - size * 0.6;
  const w = tw + 20;
  const h = size * 1.2;
  const cols = 6;
  const rows = 2;
  const pts: { x: number; y: number }[][] = [];
  let n = 0;
  for (let r = 0; r <= rows; r++) {
    const row: { x: number; y: number }[] = [];
    for (let c = 0; c <= cols; c++) {
      const edgeX = c === 0 || c === cols;
      const edgeY = r === 0 || r === rows;
      const jx = edgeX ? 0 : (hashNoise(n, 101, seed) - 0.5) * 2 * ((w / cols) * 0.35);
      const jy = edgeY ? 0 : (hashNoise(n, 103, seed) - 0.5) * 2 * (h * 0.25);
      row.push({ x: x0 + (w * c) / cols + jx, y: y0 + (h * r) / rows + jy });
      n++;
    }
    pts.push(row);
  }
  const shards: { poly: { x: number; y: number }[]; dx: number; dy: number; rot: number }[] = [];
  let si = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      shards.push({
        poly: [pts[r]![c]!, pts[r]![c + 1]!, pts[r + 1]![c + 1]!, pts[r + 1]![c]!],
        dx: (hashNoise(si, 111, seed) - 0.5) * 12,
        dy: (hashNoise(si, 113, seed) - 0.5) * 10,
        rot: (hashNoise(si, 117, seed) - 0.5) * 0.06,
      });
      si++;
    }
  }
  const cracks: [{ x: number; y: number }, { x: number; y: number }][] = [];
  for (let r = 1; r < rows; r++) for (let c = 0; c < cols; c++) cracks.push([pts[r]![c]!, pts[r]![c + 1]!]);
  for (let c = 1; c < cols; c++) for (let r = 0; r < rows; r++) cracks.push([pts[r]![c]!, pts[r + 1]![c]!]);

  const cycle = 9;
  const age = ((t % cycle) + cycle) % cycle;
  const shatter = easeOut01(clamp01(age / 0.35)) * (1 - easeOut01(clamp01((age - 1.2) / 1.6)) * 0.55);
  const gold = clamp01((age - 1.4) / 3);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.save();
  for (const sh of shards) {
    const cx = sh.poly.reduce((a, p) => a + p.x, 0) / 4;
    const cy = sh.poly.reduce((a, p) => a + p.y, 0) / 4;
    ctx.save();
    ctx.translate(cx + sh.dx * shatter, cy + sh.dy * shatter);
    ctx.rotate(sh.rot * shatter);
    ctx.translate(-cx, -cy);
    ctx.beginPath();
    sh.poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = paletteColor(node, 0);
    ctx.fillText(word, W / 2, H / 2);
    ctx.restore();
  }
  ctx.restore();
  if (gold > 0) {
    ctx.save();
    ctx.strokeStyle = paletteColor(node, 1);
    ctx.lineCap = "round";
    ctx.lineWidth = 2.5 + gold * 2;
    const total = cracks.length;
    cracks.forEach(([a, b], i) => {
      const p = clamp01(gold * total * 1.4 - i * 0.84);
      if (p <= 0) return;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(lerpNum(a.x, b.x, p), lerpNum(a.y, b.y, p));
      ctx.stroke();
    });
    ctx.restore();
  }
}

function drawFerrofluidPull(args: PaintArgs) {
  const { ctx, node, t, pointer, opts, slot } = args;
  const word = wordFrom(opts, "PULL");
  const W = node.width;
  const H = node.height;
  const points = cachedMaskPoints(slot, "ferro", node, word, W * 0.8, H * 0.46, 7);
  ctx.save();
  ctx.fillStyle = paletteColor(node, 0);
  fitWordFont(ctx, word, W * 0.8, H * 0.46);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(word, W / 2, H / 2);
  ctx.restore();
  const loc = pointer ? localPointer(node, pointer) : null;
  const target = loc ?? { x: W / 2 + Math.cos(t * 0.6) * W * 0.3, y: H * 0.2 + Math.sin(t * 0.9) * H * 0.3 };
  const reach = 140;
  ctx.save();
  ctx.fillStyle = paletteColor(node, 0);
  for (const p of points) {
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const d = Math.hypot(dx, dy);
    let len = 0;
    let nx = 0;
    let ny = 0;
    let base = 4.5;
    if (d <= reach && d > 0) {
      const f = (1 - d / reach) ** 1.6;
      len = f * Math.min(d * 0.9, reach * 0.55) * (1 + 0.15 * Math.sin(t * 7 + p.x * 0.3 + p.y * 0.2));
      nx = dx / d;
      ny = dy / d;
      base = 4.5 + f * 2;
    }
    ctx.beginPath();
    if (len > 0.1) {
      ctx.moveTo(p.x - ny * base, p.y + nx * base);
      ctx.lineTo(p.x + nx * len, p.y + ny * len);
      ctx.lineTo(p.x + ny * base, p.y - nx * base);
      ctx.closePath();
    } else {
      ctx.arc(p.x, p.y, base, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = paletteColor(node, 1);
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.arc(target.x, target.y, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(target.x, target.y, 2, 0, Math.PI * 2);
  ctx.fillStyle = paletteColor(node, 1);
  ctx.fill();
  ctx.restore();
}

function drawSlowFax(args: PaintArgs) {
  const { ctx, node, t, opts } = args;
  const W = node.width;
  const H = node.height;
  const word = wordFrom(opts, "RECEIVED");
  const paperW = Math.min(W * 0.6, (H * 0.8) * 0.78);
  const paperH = Math.min(H * 0.8, (W * 0.6) / 0.78);
  const px = (W - paperW) / 2;
  const py = (H - paperH) / 2;
  ctx.save();
  ctx.fillStyle = paletteColor(node, 1);
  ctx.fillRect(px, py, paperW, paperH);
  ctx.restore();

  const duration = 6;
  const cyc = ((t % (duration + 2)) + (duration + 2)) % (duration + 2);
  const prog = Math.min(1, cyc / duration);
  const printed = paperH * prog;
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, paperW, printed);
  ctx.clip();
  ctx.fillStyle = paletteColor(node, 0);
  fitWordFont(ctx, word, paperW - 40, paperH * 0.3);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(word, W / 2, py + paperH * 0.4);
  ctx.font = "11px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`FROM  ${word}`, px + 14, py + paperH * 0.8 + 8);
  ctx.fillText("PAGE  1 OF 1", px + 14, py + paperH * 0.8 + 24);
  ctx.restore();

  const head = py + printed;
  if (prog > 0 && prog < 1) {
    const grd = ctx.createLinearGradient(0, head - 18, 0, head);
    grd.addColorStop(0, "rgba(0,0,0,0)");
    grd.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = grd;
    ctx.fillRect(px, head - 18, paperW, 18);
  }
  ctx.save();
  ctx.fillStyle = paletteColor(node, 0);
  ctx.fillRect(px - 16, head - 5, paperW + 32, 10);
  ctx.restore();
  ctx.save();
  ctx.font = "10px monospace";
  ctx.fillStyle = paletteColor(node, 1);
  ctx.globalAlpha = 0.6;
  ctx.textAlign = "center";
  ctx.fillText(prog < 1 ? `RECEIVING ${Math.round(prog * 100)}%` : "RECEIVED", W / 2, py + paperH + 22);
  ctx.restore();
}

function drawSundialShadow(args: PaintArgs) {
  const { ctx, node, t, opts } = args;
  const word = wordFrom(opts, "NOON");
  const W = node.width;
  const H = node.height;
  const size = fitWordFont(ctx, word, W * 0.8, H * 0.5);
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;
  const day = h >= 6 && h <= 19.5;
  const cx = W / 2;
  const cy = H * 0.52;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (day) {
    const u = (h - 6) / 13.5;
    const alt = Math.sin(u * Math.PI);
    const az = (u - 0.5) * Math.PI;
    const len = size * (1.9 - alt * 1.75);
    const dx = -Math.sin(az) * len;
    const dy = Math.cos(az * 0.6) * len * 0.35 + size * 0.02;
    ctx.save();
    ctx.globalAlpha *= 0.08;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, W, H * (1 - alt * 0.6));
    ctx.restore();
    const steps = 16;
    ctx.save();
    for (let i = steps; i > 0; i--) {
      const k = i / steps;
      ctx.globalAlpha = 0.045 + (1 - k) * 0.03;
      ctx.fillStyle = paletteColor(node, 2);
      ctx.fillText(word, cx + dx * k, cy + dy * k);
    }
    ctx.restore();
    ctx.fillStyle = paletteColor(node, 0);
    ctx.fillText(word, cx, cy);
    ctx.save();
    ctx.strokeStyle = paletteColor(node, 2);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55;
    ctx.strokeText(word, cx, cy);
    ctx.restore();
    const sx = W * 0.1 + u * W * 0.8;
    const sy = H * 0.16 - alt * H * 0.08;
    ctx.save();
    ctx.fillStyle = paletteColor(node, 1);
    ctx.shadowColor = paletteColor(node, 1);
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(sx, sy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    const pulse = Math.sin(t * 1.2) * 0.5 + 0.5;
    ctx.save();
    ctx.shadowColor = paletteColor(node, 1);
    ctx.shadowBlur = 30 + pulse * 30;
    ctx.fillStyle = paletteColor(node, 1);
    ctx.globalAlpha = 0.35 + pulse * 0.25;
    ctx.fillText(word, cx, cy);
    ctx.restore();
    ctx.fillStyle = paletteColor(node, 0);
    ctx.fillText(word, cx, cy);
    ctx.strokeStyle = paletteColor(node, 1);
    ctx.lineWidth = 1.5;
    ctx.strokeText(word, cx, cy);
    const u = ((h + 4.5) % 24) / 10.5;
    const mx = W * 0.1 + u * W * 0.8;
    const my = H * 0.16;
    ctx.save();
    ctx.fillStyle = paletteColor(node, 0);
    ctx.beginPath();
    ctx.arc(mx, my, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.font = "10px monospace";
  ctx.textAlign = "right";
  ctx.fillStyle = day ? paletteColor(node, 2) : paletteColor(node, 0);
  ctx.globalAlpha = 0.6;
  ctx.fillText(
    `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.floor((h % 1) * 60)).padStart(2, "0")} local`,
    W - 16,
    H - 14,
  );
  ctx.restore();
}

function drawHalftoneLamp(args: PaintArgs) {
  const { ctx, node, t, pointer, opts, slot } = args;
  const word = wordFrom(opts, "LIGHT");
  const W = node.width;
  const H = node.height;
  const cell = 9;
  const cols = Math.max(1, Math.ceil(W / cell));
  const rows = Math.max(1, Math.ceil(H / cell));
  const key = `halftone:${word}:${cell}:${cols}x${rows}`;
  const grid = getCache(slot, key, () => luminanceGridFor(word, cols, rows));
  const loc = pointer ? localPointer(node, pointer) : null;
  const reach = 0.6 * Math.hypot(W, H);
  const lamp = loc ?? { x: W / 2 + Math.cos(t * 0.5) * W * 0.3, y: H / 2 + Math.sin(t * 0.35) * H * 0.25 };
  ctx.save();
  ctx.fillStyle = paletteColor(node, 0);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * cell;
      const y = (r + 0.5) * cell;
      const d = Math.hypot(x - lamp.x, y - lamp.y);
      const light = 0.12 + 0.88 * Math.max(0, 1 - d / reach) ** 1.5;
      const rad = cell * 0.52 * grid[r * cols + c]! * light;
      if (rad < 0.35) continue;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = paletteColor(node, 1);
  ctx.shadowColor = paletteColor(node, 1);
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(lamp.x, lamp.y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHourglassDrain(args: PaintArgs) {
  const { ctx, node, t, opts } = args;
  const W = node.width;
  const H = node.height;
  const word = wordFrom(opts, "LAUNCH");
  const totalSeconds = 3 * 86400 + 23 * 3600 + 59 * 60 + 47;
  const cyclePeriod = 90;
  const frac = (((t % cyclePeriod) + cyclePeriod) % cyclePeriod) / cyclePeriod;
  const left = Math.max(0, Math.round(totalSeconds * (1 - frac)));
  const d = Math.floor(left / 86400);
  const hr = Math.floor(left / 3600) % 24;
  const mi = Math.floor(left / 60) % 60;
  const se = left % 60;
  const groups = ["DAYS", "HRS", "MIN", "SEC"];
  const values = [d, hr, mi, se];
  const levels = [1 - frac, (left % 86400) / 86400, (left % 3600) / 3600, (left % 60) / 60];
  const gw = Math.min(W * 0.21, H * 0.5);
  const gap = gw * 0.12;
  const x0 = (W - (gw * 4 + gap * 3)) / 2;
  const gy = H * 0.5;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  groups.forEach((name, i) => {
    const x = x0 + i * (gw + gap);
    const cx = x + gw / 2;
    const text = String(values[i]).padStart(2, "0");
    const lvl = clamp01(levels[i] ?? 0);
    ctx.save();
    ctx.font = `900 ${gw * 0.78}px "Arial Black", Arial, sans-serif`;
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = paletteColor(node, 1);
    ctx.fillText(text, cx, gy);
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = paletteColor(node, 1);
    ctx.lineWidth = 1;
    ctx.strokeText(text, cx, gy);
    ctx.globalAlpha = 1;
    const top = gy - gw * 0.42;
    const bottom = gy + gw * 0.42;
    const surf = bottom - (bottom - top) * lvl;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 4, surf, gw + 8, bottom - surf + 4);
    ctx.clip();
    ctx.fillStyle = paletteColor(node, 0);
    ctx.fillText(text, cx, gy);
    ctx.restore();
    ctx.font = "10px monospace";
    ctx.fillStyle = paletteColor(node, 1);
    ctx.globalAlpha = 0.6;
    ctx.fillText(name, cx, gy + gw * 0.58);
    ctx.restore();
  });
  ctx.save();
  ctx.font = `700 ${Math.max(12, gw * 0.18)}px Arial, sans-serif`;
  ctx.fillStyle = paletteColor(node, 1);
  ctx.textAlign = "center";
  ctx.fillText(left ? word : "NOW", W / 2, gy - gw * 0.62);
  ctx.restore();
}

function drawMurmurationFlock(args: PaintArgs) {
  const { ctx, node, t, seed, pointer, opts, slot } = args;
  const W = node.width;
  const H = node.height;
  const word = wordFrom(opts, "FLOCK");
  const targets = cachedMaskPoints(slot, "flock", node, word, W * 0.8, H * 0.46, 6);
  const count = Math.max(20, Math.min(500, Math.round(node.schema.physicsAndMath.densityCount) || 260));
  const hold = 3;
  const cycle = hold + 6;
  const cyc = ((t % cycle) + cycle) % cycle;
  const forming = cyc < 4 ? 0 : cyc < 4 + hold ? clamp01((cyc - 4) / 1.2) : 0;
  const loc = pointer ? localPointer(node, pointer) : null;
  ctx.save();
  for (let i = 0; i < count; i++) {
    const target = targets.length ? targets[Math.floor((i * targets.length) / count)]! : { x: W / 2, y: H / 2 };
    const orbitR = Math.min(W, H) * (0.18 + hashNoise(i, 201, seed) * 0.28);
    const orbitSpeed = 0.25 + hashNoise(i, 203, seed) * 0.5;
    const phase = hashNoise(i, 205, seed) * Math.PI * 2;
    const cx = W / 2 + Math.cos(t * 0.3 + i * 2.4) * W * 0.06;
    const cy = H / 2 + Math.sin(t * 0.22 + i * 1.7) * H * 0.06;
    const swirlX = cx + Math.cos(t * orbitSpeed + phase) * orbitR;
    const swirlY = cy + Math.sin(t * orbitSpeed * 1.3 + phase) * orbitR * 0.6;
    let x = lerpNum(swirlX, target.x, forming);
    let y = lerpNum(swirlY, target.y, forming);
    if (loc) {
      const hx = x - loc.x;
      const hy = y - loc.y;
      const hd = Math.hypot(hx, hy);
      if (hd < 130 && hd > 0) {
        const f = (1 - hd / 130) * 18;
        x += (hx / hd) * f;
        y += (hy / hd) * f;
      }
    }
    const vx = Math.cos(t * orbitSpeed + phase + 0.1) - Math.cos(t * orbitSpeed + phase);
    const vy = Math.sin(t * orbitSpeed * 1.3 + phase + 0.1) - Math.sin(t * orbitSpeed * 1.3 + phase);
    const angle = Math.atan2(vy || 0.001, vx || 0.001);
    const wing = Math.sin(t * 14 + phase) * 0.5;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha *= i % 5 === 0 ? 0.9 : 0.7;
    ctx.fillStyle = paletteColor(node, i % 5 === 0 ? 1 : 0);
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(-3, -3 - wing * 2);
    ctx.lineTo(-1.5, 0);
    ctx.lineTo(-3, 3 + wing * 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  if (loc) {
    ctx.save();
    ctx.strokeStyle = paletteColor(node, 1);
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(loc.x, loc.y, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawPendulumSwing(args: PaintArgs) {
  const { ctx, node, t, seed, opts } = args;
  const word = wordFrom(opts, "SWING");
  const size = fitWordFont(ctx, word, node.width * 0.8, node.height * 0.34);
  const letters = [...word];
  const widths = letters.map((ch) => ctx.measureText(ch).width);
  const gap = size * 0.12;
  const total = widths.reduce((s, w) => s + w, 0) + gap * (letters.length - 1);
  let cursor = (node.width - total) / 2;
  const py = node.height * 0.12;
  const len = node.height * 0.5;
  ctx.save();
  ctx.strokeStyle = paletteColor(node, 2);
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(node.width * 0.06, py);
  ctx.lineTo(node.width * 0.94, py);
  ctx.stroke();
  ctx.restore();
  const positions = letters.map((ch, i) => {
    const w = widths[i]!;
    const px = cursor + w / 2;
    cursor += w + gap;
    const amp = 0.12 + hashNoise(i, 301, seed) * 0.22;
    const freq = 0.6 + hashNoise(i, 303, seed) * 0.35;
    const phase = hashNoise(i, 305, seed) * Math.PI * 2;
    const a = Math.sin(t * freq + phase) * amp;
    const bx = px + Math.sin(a) * len;
    const by = py + Math.cos(a) * len;
    return { px, bx, by, a };
  });
  positions.forEach((p) => {
    ctx.save();
    ctx.strokeStyle = paletteColor(node, 2);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(p.px, py);
    ctx.lineTo(p.bx, p.by - size * 0.45);
    ctx.stroke();
    ctx.restore();
  });
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  letters.forEach((ch, i) => {
    const p = positions[i]!;
    ctx.save();
    ctx.translate(p.bx, p.by);
    ctx.rotate(-p.a * 0.6);
    ctx.fillStyle = paletteColor(node, 0);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
}

// ---- "attention grabbers" batch (favicon escape / absence bloom / selection ink ports) ----
function drawTabEscape(args: PaintArgs) {
  const { ctx, node, t, seed, opts } = args;
  const word = wordFrom(opts, "LEAVE");
  const W = node.width;
  const H = node.height;
  const size = fitWordFont(ctx, word, W * 0.8, H * 0.42);
  const letters = [...word];
  const widths = letters.map((ch) => ctx.measureText(ch).width);
  const gap = size * 0.05;
  const total = widths.reduce((s, w) => s + w, 0) + gap * (letters.length - 1);
  let cursor = (W - total) / 2;
  const homeY = H * 0.56;
  const homes = widths.map((w) => {
    const cx = cursor + w / 2;
    cursor += w + gap;
    return cx;
  });
  const tab = { x: W * 0.14, y: H * 0.14 };
  const speed = node.schema.physicsAndMath.speed || 1;
  const cycle = 10;
  const leaveSpan = cycle * 0.72;
  const cyc = (((t * speed) % cycle) + cycle) % cycle;
  const per = leaveSpan / Math.max(1, letters.length);
  let escaped = "";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  letters.forEach((ch, i) => {
    const homeX = homes[i]!;
    let p = clamp01((cyc - i * per) / (per * 1.6));
    if (cyc > leaveSpan) p = 1 - clamp01((cyc - leaveSpan) / (cycle - leaveSpan));
    if (p > 0.99) escaped += ch;
    const e = easeInOut01(p);
    const drift = (hashNoise(i, 401, seed) - 0.5) * 2;
    const x = lerpNum(homeX, tab.x, e) + Math.sin(t * 3 + i) * (1 - e) * e * 14 * drift;
    const y = lerpNum(homeY, tab.y, e) - Math.sin(e * Math.PI) * H * 0.12;
    const scale = lerpNum(1, 0.14, e);
    ctx.save();
    ctx.globalAlpha = 1 - e ** 8;
    ctx.fillStyle = e > 0.02 ? paletteColor(node, 1) : paletteColor(node, 0);
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate(e * (1 - e) * 1.2 * drift);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    if (p > 0) {
      ctx.save();
      ctx.globalAlpha = 0.12 * p;
      ctx.strokeStyle = paletteColor(node, 0);
      ctx.lineWidth = 1;
      ctx.strokeText(ch, homeX, homeY);
      ctx.restore();
    }
  });
  const chipW = Math.min(W * 0.42, 190);
  const chipH = Math.max(20, size * 0.16);
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = paletteColor(node, 2);
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(tab.x - chipW * 0.18, tab.y - chipH * 0.6, chipW, chipH, [8, 8, 0, 0]);
    ctx.fill();
  } else {
    ctx.fillRect(tab.x - chipW * 0.18, tab.y - chipH * 0.6, chipW, chipH);
  }
  ctx.fillStyle = paletteColor(node, 1);
  ctx.fillRect(tab.x - chipW * 0.1, tab.y - chipH * 0.42, chipH * 0.62, chipH * 0.62);
  ctx.font = "11px Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = paletteColor(node, 0);
  ctx.globalAlpha = 0.85;
  ctx.fillText((escaped ? `${escaped} · ` : "") + word, tab.x + chipH * 0.62, tab.y - chipH * 0.1, chipW - chipH * 0.7);
  ctx.restore();
}

function drawMossBloom(args: PaintArgs) {
  const { ctx, node, t, seed, opts, slot } = args;
  const W = node.width;
  const H = node.height;
  const word = wordFrom(opts, "GROW");
  const points = cachedMaskPoints(slot, "moss", node, word, W * 0.8, H * 0.46, 5);
  const cycle = 13;
  const growSpan = 8;
  const holdSpan = 1.6;
  const cyc = ((t % cycle) + cycle) % cycle;
  const growth = cyc < growSpan ? easeOut01(cyc / growSpan) : cyc < growSpan + holdSpan ? 1 : 0;
  ctx.save();
  ctx.globalAlpha = 0.22 + growth * 0.1;
  ctx.fillStyle = paletteColor(node, 0);
  fitWordFont(ctx, word, W * 0.8, H * 0.46);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(word, W / 2, H * 0.46);
  ctx.restore();
  let seedPt = points[0] ?? { x: W / 2, y: H * 0.7 };
  for (const p of points) if (p.y > seedPt.y) seedPt = p;
  const maxDist = points.reduce((m, p) => Math.max(m, Math.hypot(p.x - seedPt.x, p.y - seedPt.y)), 1);
  ctx.save();
  points.forEach((p, i) => {
    const key = clamp01((Math.hypot(p.x - seedPt.x, p.y - seedPt.y) / maxDist) * 0.85 + hashNoise(i, 503, seed) * 0.15);
    if (key > growth) return;
    const r = 2 + hashNoise(i, 507, seed) * 2.6;
    const c = hashNoise(i, 509, seed);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = c < 0.15 ? paletteColor(node, 3) : c < 0.55 ? paletteColor(node, 1) : paletteColor(node, 2);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(p.x + (hashNoise(i, 511, seed) - 0.5) * 2, p.y - r * 0.5, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
  const grownSeconds = Math.round(growth * 180);
  ctx.save();
  ctx.font = "10px monospace";
  ctx.fillStyle = paletteColor(node, 1);
  ctx.globalAlpha = 0.55;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`${Math.floor(grownSeconds / 60)}m ${String(grownSeconds % 60).padStart(2, "0")}s of growth`, 16, H - 14);
  ctx.textAlign = "right";
  ctx.fillText("grows while you are away", W - 16, H - 14);
  ctx.restore();
  if (cyc >= growSpan + holdSpan) {
    const since = cyc - (growSpan + holdSpan);
    if (since < 2.4) {
      const away = 90 + Math.round(hashNoise(1, 601, seed) * 300);
      ctx.save();
      ctx.globalAlpha = clamp01(1 - since / 2.4);
      ctx.font = "700 13px Arial, sans-serif";
      ctx.fillStyle = paletteColor(node, 3);
      ctx.textAlign = "center";
      ctx.fillText(`you were gone ${Math.floor(away / 60)}m ${away % 60}s`, W / 2, H * 0.12);
      ctx.restore();
    }
  }
}

function drawInkPileup(args: PaintArgs) {
  const { ctx, node, t, seed, opts } = args;
  const W = node.width;
  const H = node.height;
  const heading = wordFrom(opts, "COLLECT");
  const words = paragraphFrom(node, opts, "focus trust speed clarity craft ship")
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 7);
  const n = Math.max(1, words.length);
  const interval = 1.05;
  const dropDur = 0.5;
  const clearSpan = 1.1;
  const cycle = n * interval + 2 + clearSpan;
  const cyc = ((t % cycle) + cycle) % cycle;
  const clearStart = cycle - clearSpan;
  const fade = cyc >= clearStart ? clamp01(1 - (cyc - clearStart) / clearSpan) : 1;

  fitWordFont(ctx, heading, W * 0.7, H * 0.3);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = paletteColor(node, 0);
  ctx.globalAlpha = 0.9;
  ctx.fillText(heading, W / 2, H * 0.22);
  ctx.restore();

  const pillH = Math.min(30, H * 0.13);
  const floor = H - 16;
  let landed = 0;
  ctx.save();
  ctx.font = "700 14px Arial, sans-serif";
  words.forEach((word, i) => {
    const spawnAt = i * interval;
    const local = cyc - spawnAt;
    if (local < 0) return;
    landed++;
    const wd = ctx.measureText(word).width + 18;
    const marginX = 14;
    const homeX = hashNoise(i, 701, seed) * (W - wd - marginX * 2) + marginX;
    const landingY = floor - (i + 1) * pillH * 0.82;
    const e = easeOut01(clamp01(local / dropDur));
    const y = lerpNum(-pillH, landingY, e);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(homeX + wd / 2, y);
    ctx.rotate((hashNoise(i, 703, seed) - 0.5) * 0.14 * (1 - e * 0.6));
    ctx.fillStyle = paletteColor(node, 1);
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(-wd / 2, -pillH / 2, wd, pillH, pillH / 2);
      ctx.fill();
    } else {
      ctx.fillRect(-wd / 2, -pillH / 2, wd, pillH);
    }
    ctx.fillStyle = paletteColor(node, 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(word, 0, 1);
    ctx.restore();
  });
  ctx.restore();

  ctx.save();
  ctx.font = "10px monospace";
  ctx.fillStyle = paletteColor(node, 1);
  ctx.globalAlpha = 0.55 * (landed ? fade : 1);
  ctx.textAlign = "center";
  ctx.fillText(
    landed ? `${landed} word${landed === 1 ? "" : "s"} collected · click to empty` : "highlight any text on this page",
    W / 2,
    H * 0.86,
  );
  ctx.restore();
}

function drawWordPiston(args: PaintArgs) {
  const { ctx, node, t, opts, accent } = args;
  const word = wordFrom(opts, "ENGINE");
  const size = fitWordFont(ctx, word, node.width * 0.84, node.height * 0.5);
  const letters = [...word];
  const widths = letters.map((ch) => ctx.measureText(ch).width);
  const gap = size * 0.04;
  const total = widths.reduce((s, w) => s + w, 0) + gap * (letters.length - 1);
  let cursor = (node.width - total) / 2;
  const positions = widths.map((w) => {
    const cx = cursor + w / 2;
    cursor += w + gap;
    return cx;
  });
  const travel = size * 0.32;
  const base = node.height * 0.58;
  const stagger = 0.12;
  const speed = node.schema.physicsAndMath.speed || 1;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.save();
  ctx.globalAlpha *= 0.28;
  ctx.strokeStyle = rgba(accent, 1);
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 6]);
  ctx.beginPath();
  ctx.moveTo(node.width * 0.08, base - travel - size * 0.55);
  ctx.lineTo(node.width * 0.92, base - travel - size * 0.55);
  ctx.moveTo(node.width * 0.08, base + size * 0.55);
  ctx.lineTo(node.width * 0.92, base + size * 0.55);
  ctx.stroke();
  ctx.restore();
  letters.forEach((ch, i) => {
    const lt = t * 0.9 * speed - i * stagger;
    const s = pistonStroke(lt);
    ctx.save();
    ctx.translate(positions[i]!, base);
    ctx.translate(0, -s * travel);
    ctx.save();
    ctx.globalAlpha *= 0.45;
    ctx.fillStyle = paletteColor(node, i + 2);
    ctx.fillRect(-size * 0.04, size * 0.4, size * 0.08, travel + size * 0.3);
    ctx.restore();
    ctx.fillStyle = paletteColor(node, i);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
}

function drawWordVortex(args: PaintArgs) {
  const { ctx, node, t, seed, pointer, opts } = args;
  const word = wordFrom(opts, "VORTEX");
  const size = fitWordFont(ctx, word, node.width * 0.5, node.height * 0.3);
  const cx = node.width / 2;
  const cy = node.height / 2;
  const loc = pointer ? localPointer(node, pointer) : null;
  const px = loc ? (loc.x - cx) / node.width : 0;
  const py = loc ? (loc.y - cy) / node.height : 0;
  const speed = node.schema.physicsAndMath.speed || 1;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const n = 14;
  for (let i = n - 1; i >= 0; i--) {
    const k = i / (n - 1);
    const spin = (hashNoise(i, 31, seed) * 0.9 + 0.3) * (i % 2 ? 1 : -1);
    const phase = hashNoise(i, 47, seed) * Math.PI * 2;
    const scale = 1 + k * 2.6;
    const alpha = (1 - k) * 0.55 + 0.05;
    const angle = phase + t * spin * speed;
    ctx.save();
    ctx.translate(cx + px * k * node.width * 0.35, cy + py * k * node.height * 0.35);
    ctx.rotate(angle);
    ctx.scale(scale, scale * (1 - k * 0.35));
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = paletteColor(node, i);
    ctx.fillText(word, 0, 0);
    ctx.restore();
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineJoin = "round";
  ctx.lineWidth = size * 0.06;
  ctx.strokeStyle = node.schema.visual.background === "transparent" ? "#11130F" : node.schema.visual.background;
  ctx.strokeText(word, 0, 0);
  ctx.fillStyle = paletteColor(node, 0);
  ctx.fillText(word, 0, 0);
  ctx.restore();
}

function drawLetterAssembly(args: PaintArgs) {
  const { ctx, node, t, seed, opts } = args;
  const word = wordFrom(opts, "ASSEMBLE");
  const W = node.width;
  const H = node.height;
  const size = fitWordFont(ctx, word, W * 0.84, H * 0.42);
  const letters = [...word];
  const widths = letters.map((ch) => ctx.measureText(ch).width);
  const gap = size * 0.05;
  const total = widths.reduce((s, w) => s + w, 0) + gap * (letters.length - 1);
  let cursor = (W - total) / 2;
  const cycle = 7;
  const speed = node.schema.physicsAndMath.speed || 1;
  const p = ((t * speed) / cycle) % 1;
  const phase = p < 0.38 ? "in" : p < 0.62 ? "hold" : "out";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  letters.forEach((ch, i) => {
    const w = widths[i]!;
    const homeX = cursor + w / 2;
    const homeY = H * 0.52;
    cursor += w + gap;
    const side = Math.floor(hashNoise(i, 5, seed) * 4);
    const from = [
      { x: hashNoise(i, 6, seed) * W, y: -size },
      { x: W + size, y: hashNoise(i, 7, seed) * H },
      { x: hashNoise(i, 8, seed) * W, y: H + size },
      { x: -size, y: hashNoise(i, 9, seed) * H },
    ][side]!;
    const ctrl = { x: hashNoise(i, 10, seed) * W * 0.8 + W * 0.1, y: hashNoise(i, 11, seed) * H * 0.8 + H * 0.1 };
    const exit = { x: hashNoise(i, 12, seed) * W * 1.4 - W * 0.2, y: hashNoise(i, 13, seed) * H * 1.6 - H * 0.3 };
    const delay = hashNoise(i, 14, seed) * 0.25;
    const spin = (hashNoise(i, 15, seed) - 0.5) * 4;
    const part = Math.floor(hashNoise(i, 16, seed) * 3);
    ctx.save();
    ctx.fillStyle = paletteColor(node, i);
    if (phase === "in") {
      const lt = clamp01((p / 0.38 - delay) / (1 - delay));
      const eased = easeBackOut01(lt);
      const pos = quadBezier(from, ctrl, { x: homeX, y: homeY }, clamp01(eased));
      ctx.translate(pos.x, pos.y);
      ctx.rotate((1 - lt) * spin);
      ctx.globalAlpha *= Math.min(1, lt * 3 + 0.1);
      ctx.fillText(ch, 0, 0);
    } else if (phase === "hold") {
      ctx.translate(homeX, homeY);
      ctx.fillText(ch, 0, 0);
    } else {
      const lt = clamp01(((p - 0.62) / 0.38 - delay * 0.6) / (1 - delay * 0.6));
      const eased = easeInOut01(lt);
      ctx.translate(lerpNum(homeX, exit.x, eased), lerpNum(homeY, exit.y, eased));
      ctx.rotate(lt * spin * 2);
      ctx.globalAlpha *= 1 - Math.min(1, lt * 2);
      ctx.fillText(ch, 0, 0);
      ctx.globalAlpha = Math.min(1, lt * 2) * (1 - Math.max(0, (lt - 0.7) / 0.3));
      drawAssemblyFragment(ctx, part, size);
    }
    ctx.restore();
  });
  if (phase === "hold") {
    ctx.save();
    ctx.globalAlpha *= 0.5;
    ctx.strokeStyle = paletteColor(node, 1);
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(W * 0.08, H * 0.52 + size * 0.5);
    ctx.lineTo(W * 0.92, H * 0.52 + size * 0.5);
    ctx.stroke();
    ctx.restore();
  }
}

function drawMisregisterGlitch(args: PaintArgs) {
  const { ctx, node, t, seed, opts } = args;
  const word = wordFrom(opts, "ERROR");
  fitWordFont(ctx, word, node.width * 0.86, node.height * 0.5);
  const n = 5;
  const off = 14;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < n; i++) {
    const k = (i + 1) / n;
    const jolt = hashNoise(i, 61, seed);
    const step = Math.floor(t * 9 + jolt * 7);
    const dx = ((((step * 7919 + i * 131) % 13) - 6) / 6) * off * k;
    const dy = ((((step * 104729 + i * 17) % 11) - 5) / 5) * off * k;
    ctx.save();
    ctx.translate(node.width / 2 + dx, node.height / 2 + dy);
    ctx.globalAlpha *= 0.85;
    ctx.fillStyle = paletteColor(node, i);
    ctx.fillText(word, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

function drawMonumentBreathe(args: PaintArgs) {
  const { ctx, node, t, opts } = args;
  const word = wordFrom(opts, "STILL");
  const size = fitWordFont(ctx, word, node.width * 0.82, node.height * 0.62);
  const period = 6;
  const speed = node.schema.physicsAndMath.speed || 1;
  const cyc = ((t * speed) / period) % 1;
  const breath = (1 - Math.cos(cyc * Math.PI * 2)) / 2;
  const scale = 0.96 + breath * 0.08;
  ctx.save();
  ctx.translate(node.width / 2, node.height / 2);
  ctx.scale(scale, scale);
  const span = size * 1.4;
  const shift = (t * 0.15) % 2;
  const grad = ctx.createLinearGradient(-span + shift * span, -size * 0.4, span + shift * span, size * 0.4);
  grad.addColorStop(0, paletteColor(node, 0));
  grad.addColorStop(0.5, paletteColor(node, 1));
  grad.addColorStop(1, paletteColor(node, 2));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha *= 0.82 + breath * 0.18;
  ctx.fillStyle = grad;
  ctx.fillText(word, 0, 0);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha *= 0.06 + breath * 0.06;
  ctx.strokeStyle = paletteColor(node, 1);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(
    node.width / 2,
    node.height / 2,
    size * (1.1 + breath * 0.25) * 1.6,
    size * (0.9 + breath * 0.25),
    0,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
  ctx.restore();
}

function drawStrokeReveal(args: PaintArgs) {
  const { ctx, node, t } = args;
  const duration = 4;
  const speed = node.schema.physicsAndMath.speed || 1;
  const secs = t * speed;
  const p = Math.min(1, (secs % (duration + 1.5)) / duration);
  const r = Math.min(node.width, node.height) * 0.3;
  const cx = node.width / 2;
  const cy = node.height * 0.46;
  ctx.save();
  ctx.strokeStyle = paletteColor(node, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.translate(cx, cy);
  ctx.lineWidth = Math.max(3, r * 0.09);
  ctx.beginPath();
  ctx.save();
  ctx.scale(r, r);
  ctx.moveTo(-0.9, 0.05);
  ctx.lineTo(-0.25, 0.7);
  ctx.lineTo(0.95, -0.7);
  ctx.restore();
  const len = 3 * r;
  ctx.setLineDash([len * p, len]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  const bw = node.width * 0.5;
  const bx = (node.width - bw) / 2;
  const by = node.height * 0.86;
  ctx.save();
  ctx.fillStyle = paletteColor(node, 2);
  ctx.fillRect(bx, by, bw, 3);
  ctx.fillStyle = paletteColor(node, 0);
  ctx.fillRect(bx, by, bw * p, 3);
  ctx.font = "11px Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = paletteColor(node, 1);
  ctx.globalAlpha *= 0.7;
  ctx.fillText(`${Math.round(p * 100)}%`, bx + bw, by - 6);
  ctx.restore();
}

function drawTelemetryOverlay(args: PaintArgs) {
  const { ctx, node, t, seed, opts } = args;
  const word = wordFrom(opts, "SUBJECT");
  fitWordFont(ctx, word, node.width * 0.62, node.height * 0.36, "700", '"JetBrains Mono", ui-monospace, monospace');
  const W = node.width;
  const H = node.height;
  const cx = W / 2;
  const cy = H / 2;
  const boxW = ctx.measureText(word).width + 40;
  const boxH = H * 0.18;
  const x0 = cx - boxW / 2;
  const y0 = cy - boxH / 2;
  const flicker = 1 - 0.5 * (Math.sin(t * 13) * 0.5 + 0.5) ** 4 * 0.5;
  ctx.save();
  ctx.globalAlpha *= Math.min(1, Math.max(0.15, flicker));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = paletteColor(node, 1);
  ctx.fillText(word, cx, cy);
  ctx.restore();
  const reveal = Math.min(1, t / 2.4);
  ctx.save();
  ctx.strokeStyle = paletteColor(node, 0);
  ctx.fillStyle = paletteColor(node, 0);
  ctx.lineWidth = 1.5;
  ctx.lineCap = "square";
  const c = Math.min(boxW, boxH) * 0.16;
  const pad = 14;
  const corners: [number, number, number, number][] = [
    [x0 - pad, y0 - pad, 1, 1],
    [x0 + boxW + pad, y0 - pad, -1, 1],
    [x0 + boxW + pad, y0 + boxH + pad, -1, -1],
    [x0 - pad, y0 + boxH + pad, 1, -1],
  ];
  corners.forEach(([x, y, sx, sy], i) => {
    const cornerLen = c * 2;
    ctx.setLineDash([cornerLen * clamp01(reveal * 4 - i * 0.6), cornerLen]);
    ctx.beginPath();
    ctx.moveTo(x, y + sy * c);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * c, y);
    ctx.stroke();
  });
  const ringLen = Math.PI * 2 * (boxH * 0.62);
  ctx.globalAlpha *= 0.5;
  ctx.setLineDash([ringLen * clamp01(reveal * 1.6 - 0.5), ringLen]);
  ctx.beginPath();
  ctx.arc(cx, cy, boxH * 0.62, -Math.PI / 2, Math.PI * 1.5);
  ctx.stroke();
  ctx.globalAlpha = 0.8;
  const hLen = clamp01(reveal * 2 - 1);
  ctx.setLineDash([W * hLen, W]);
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(W, cy);
  ctx.stroke();
  ctx.setLineDash([H * hLen, H]);
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, H);
  ctx.stroke();
  ctx.setLineDash([]);
  const scanY = y0 + ((t * 0.35) % 1) * boxH;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(x0 - pad, scanY, boxW + pad * 2, 1);
  ctx.font = "10px monospace";
  ctx.textBaseline = "top";
  ctx.globalAlpha = 0.75 * Math.min(1, reveal * 2);
  const labels = ["AZ", "EL", "RNG", "SIG", "T", "ID"];
  for (let i = 0; i < labels.length; i++) {
    const rx = hashNoise(i, 71, seed) * 0.85 + 0.05;
    const ry = hashNoise(i, 79, seed) * 0.84 + 0.08;
    const v = Math.floor(
      (hashNoise(i, 83, seed) * 9000 + t * (hashNoise(i, 90, seed) * 2.5 + 0.5) * 40) % 10000,
    );
    ctx.textAlign = rx > 0.5 ? "right" : "left";
    ctx.fillText(`${labels[i]} ${String(v).padStart(4, "0")}`, rx * W, ry * H);
  }
  ctx.textAlign = "left";
  ctx.fillText(reveal < 1 ? "ACQUIRING" : "LOCK", x0 - pad, y0 + boxH + pad + 8);
  ctx.restore();
}

function drawVanishingTunnel(args: PaintArgs) {
  const { ctx, node, t, pointer, opts } = args;
  const W = node.width;
  const H = node.height;
  const sides = 4;
  const n = 18;
  const target = pointer ? localPointer(node, pointer) : { x: W / 2, y: H / 2 };
  const vpx = W / 2 + (target.x - W / 2) * 0.35;
  const vpy = H / 2 + (target.y - H / 2) * 0.35;
  const speed = node.schema.physicsAndMath.speed || 1;
  const maxR = Math.hypot(W, H) * 0.75;
  const flow = (t * 0.6 * speed) % 1;
  for (let i = 0; i < n; i++) {
    const d = (((i / n + flow) % 1) + 1) % 1;
    const z = d ** 2.2;
    const r = Math.max(2, z * maxR);
    const alpha = Math.sin(d * Math.PI) * 0.9;
    const cx = lerpNum(vpx, W / 2, z);
    const cy = lerpNum(vpy, H / 2, z);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / sides + t * 0.25 * (1 - z) + i * 0.04);
    ctx.globalAlpha *= alpha;
    ctx.strokeStyle = paletteColor(node, i % 3 === 0 ? 2 : i % 2);
    ctx.lineWidth = 1 + z * 4;
    ctx.beginPath();
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
  const hook = opts.hooks?.hook1?.trim();
  if (hook) {
    const word = hook.toUpperCase();
    const size = fitWordFont(ctx, word, W * 0.5, H * 0.28);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.strokeStyle = node.schema.visual.background === "transparent" ? "#11130F" : node.schema.visual.background;
    ctx.lineWidth = size * 0.08;
    ctx.strokeText(word, W / 2, H / 2);
    ctx.fillStyle = paletteColor(node, 2);
    ctx.fillText(word, W / 2, H / 2);
    ctx.restore();
  }
}

function drawIconWeather(args: PaintArgs) {
  const { ctx, node, t, seed, pointer, opts } = args;
  const W = node.width;
  const H = node.height;
  const word = wordFrom(opts, "STORM");
  fitWordFont(ctx, word, W * 0.7, H * 0.4);
  const cx = W / 2;
  const cy = H / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = paletteColor(node, 0);
  ctx.fillText(word, cx, cy);
  const icons = ["★", "⚡", "✦", "♥", "⚠"];
  const count = Math.max(5, Math.min(140, Math.round(node.schema.physicsAndMath.densityCount) || 90));
  const speed = node.schema.physicsAndMath.speed || 1;
  const loc = pointer ? localPointer(node, pointer) : null;
  for (let i = 0; i < count; i++) {
    const baseX = hashNoise(i, 21, seed) * W;
    const baseY0 = hashNoise(i, 22, seed) * (H + 80) - 40;
    const v = hashNoise(i, 23, seed) * 1.0 + 0.6;
    const phase = hashNoise(i, 24, seed) * Math.PI * 2;
    const fontSize = hashNoise(i, 25, seed) * 20 + 10;
    const spin = (hashNoise(i, 26, seed) - 0.5) * 3;
    const span = H + 80;
    let y = ((baseY0 + v * 60 * t * speed) % span + span) % span - 40;
    let x = baseX + Math.sin(t * speed + phase) * 14;
    if (loc) {
      const dx = x - loc.x;
      const dy = y - loc.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 110) {
        const f = (1 - d / 110) * 8;
        x += (dx / d) * f;
        y += (dy / d) * f;
      }
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * spin * 0.4 + phase);
    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = paletteColor(node, i + 1);
    ctx.globalAlpha *= 0.55 + (fontSize - 10) / 40;
    ctx.fillText(icons[i % icons.length]!, 0, 0);
    ctx.restore();
  }
}

function drawBufferGlitch(args: PaintArgs) {
  const { ctx, node, t, seed, opts } = args;
  const W = node.width;
  const H = node.height;
  const boxW = Math.min(W * 0.58, (H * 0.68) * 1.25);
  const boxH = Math.min(H * 0.68, (W * 0.58) / 1.25);
  const x0 = (W - boxW) / 2;
  const y0 = (H - boxH) / 2 - 12;
  const word = wordFrom(opts, "SUBJECT");
  fitWordFont(ctx, word, boxW * 0.8, boxH * 0.5);
  const stall = hashNoise(1, 31, seed) * 0.32 + 0.62;
  const cyc = (t % 5) / 5;
  const p = cyc < 0.8 ? Math.min(stall, easeOut01(cyc / 0.8) * (stall + 0.1)) : stall * (1 - (cyc - 0.8) / 0.2);
  ctx.save();
  ctx.fillStyle = paletteColor(node, 2);
  ctx.fillRect(x0, y0, boxW, boxH);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = paletteColor(node, 1);
  ctx.fillText(word, W / 2, y0 + boxH / 2);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = paletteColor(node, 0);
  ctx.fillStyle = paletteColor(node, 0);
  ctx.lineWidth = 1.5;
  const pad = 10 + Math.sin(t * 2) * 4;
  const c = 22;
  const corners: [number, number, number, number][] = [
    [x0 - pad, y0 - pad, 1, 1],
    [x0 + boxW + pad, y0 - pad, -1, 1],
    [x0 + boxW + pad, y0 + boxH + pad, -1, -1],
    [x0 - pad, y0 + boxH + pad, 1, -1],
  ];
  corners.forEach(([x, y, sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(x, y + sy * c);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * c, y);
    ctx.stroke();
  });
  const r = Math.min(boxW, boxH) * 0.16;
  const a0 = t * 3;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(x0 + boxW - r - 12, y0 + r + 12, r, a0, a0 + Math.PI * 1.3);
  ctx.stroke();
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x0 + boxW - r - 12, y0 + r + 12, r, 0, Math.PI * 2);
  ctx.stroke();
  const by = y0 + boxH + 26;
  ctx.globalAlpha = 1;
  ctx.fillStyle = paletteColor(node, 2);
  ctx.fillRect(x0, by, boxW, 3);
  ctx.fillStyle = paletteColor(node, 0);
  ctx.fillRect(x0, by, boxW * p, 3);
  ctx.font = "11px monospace";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = paletteColor(node, 1);
  ctx.globalAlpha = 0.8;
  const dots = ".".repeat(Math.floor(t * 2) % 4);
  ctx.textAlign = "left";
  ctx.fillText(`LOADING${dots}`, x0, by - 6);
  ctx.textAlign = "right";
  ctx.fillText(`${Math.round(p * 100)}%`, x0 + boxW, by - 6);
  if (cyc > 0.8) {
    ctx.textAlign = "center";
    ctx.globalAlpha = (cyc - 0.8) / 0.2;
    ctx.fillText("RETRYING", W / 2, by - 6);
  }
  ctx.restore();
}

/** AE-style slam: start oversized, land at 1. Rest (idle one-shot) stays 1 so the caption never vanishes. */
export function hookOvershootScale(
  local: number,
  fromPercent: number,
  dur: number,
  springAmp: number,
  freq: number,
  damp: number,
): number {
  if (!Number.isFinite(local) || local >= dur) return 1;
  const u = easeOut01(local / dur);
  const eased = fromPercent - (fromPercent - 100) * u;
  const spring = (Math.sin(local * freq * Math.PI * 2) * springAmp) / Math.exp(local * damp);
  return Math.max(0.02, (eased + spring) / 100);
}

export { oneShot, earliest };

function canUseDomCanvas(): boolean {
  return typeof document !== "undefined" && typeof document.createElement === "function";
}

function dummyCanvas(): HTMLCanvasElement {
  return {
    width: 1,
    height: 1,
    getContext() {
      return null;
    },
    toDataURL() {
      return "";
    },
  } as unknown as HTMLCanvasElement;
}

function resolveDpr(node: MotionNode, dpr?: number): number {
  const raw = dpr ?? (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  return Math.min(Math.max(raw, 0), node.schema.performance.maxDpr);
}

function slotKey(node: MotionNode, dpr: number): string {
  return `${node.id}:${node.seed ?? 1}:${Math.round(node.width)}x${Math.round(node.height)}:${hashMotionSchema(node.schema)}:${dpr}:${densityScale}`;
}

function seedParticles(node: MotionNode): Particle[] {
  const count = Math.max(1, Math.round(node.schema.physicsAndMath.densityCount * densityScale));
  const seed = node.seed ?? 1;
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: hashNoise(i, 1, seed) * node.width,
      y: hashNoise(i, 2, seed) * node.height,
      vx: 0,
      vy: 0,
    });
  }
  return particles;
}

function slotFor(node: MotionNode, dpr: number): Slot | null {
  if (!canUseDomCanvas()) return null;
  const key = slotKey(node, dpr);
  const hit = REGISTRY.get(node.id);
  if (hit && hit.key === key) return hit;
  const canvas = hit?.canvas ?? document.createElement("canvas");
  const bw = Math.max(1, Math.round(node.width * dpr));
  const bh = Math.max(1, Math.round(node.height * dpr));
  if (canvas.width !== bw) canvas.width = bw;
  if (canvas.height !== bh) canvas.height = bh;
  const slot: Slot = { canvas, key, particles: seedParticles(node), painted: false, lastTickMs: 0 };
  REGISTRY.set(node.id, slot);
  return slot;
}

function releaseWarpGl() {
  if (!warpMod) return;
  try {
    warpMod.dispose();
  } catch {
    /* last 2D frame stays */
  }
}

function drawWarpFallback(ctx: CanvasRenderingContext2D, node: MotionNode, atMs: number) {
  const t = Number.isFinite(atMs) ? atMs / 1000 : 0;
  const ink = hexRgb(node.schema.visual.palette[0] ?? "#1A1D21");
  const accent = hexRgb(node.schema.visual.palette[1] ?? "#2F5199");
  const paper = node.schema.visual.background === "transparent" ? "#F7F5F1" : node.schema.visual.background;
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, node.width, node.height);
  const bands = 26;
  const h = node.height / bands;
  const amp = (node.schema.physicsAndMath.amplitude || 18) * 0.4;
  const freq = node.schema.physicsAndMath.frequency || 1.1;
  const speed = node.schema.physicsAndMath.speed || 0.4;
  for (let i = 0; i < bands; i++) {
    const y = i * h;
    const dx = Math.sin(t * speed * 2.2 + i * freq) * amp;
    ctx.fillStyle = rgba(i % 3 === 0 ? accent : ink, 0.05 + (i % 2) * 0.03);
    ctx.fillRect(dx, y, node.width, h + 0.8);
  }
}

function paintWarp(
  ctx: CanvasRenderingContext2D,
  node: MotionNode,
  assets: CraftAsset[],
  opts: MotionDrawOpts,
  freeze: boolean,
  slot: Slot,
) {
  ctx.save();
  ctx.globalAlpha *= node.schema.visual.opacity;
  ctx.globalCompositeOperation = node.schema.visual.blending === "additive" ? "lighter" : node.schema.visual.blending;

  if (freeze) {
    disposeWarpGlFor(node.id);
    if (slot.painted) {
      ctx.restore();
      return;
    }
    if (node.capturedAssetId && drawCaptured(ctx, node, assets, opts.onImage)) {
      slot.painted = true;
      ctx.restore();
      return;
    }
    ctx.fillStyle = node.schema.visual.background;
    ctx.fillRect(0, 0, node.width, node.height);
    slot.painted = true;
    ctx.restore();
    return;
  }

  liveWarps.add(node.id);
  if (!slot.warpOk) drawWarpFallback(ctx, node, opts.atMs);
  slot.painted = true;

  const canvas = slot.canvas;
  void import("./motionThree")
    .then((mod) => {
      warpMod = mod;
      if (!liveWarps.has(node.id)) {
        if (liveWarps.size === 0) releaseWarpGl();
        return;
      }
      void mod
        .ensureThree()
        .then(() => {
          if (!liveWarps.has(node.id)) return;
          try {
            if (mod.drawWarp(canvas, node, opts.atMs)) {
              slot.warpOk = true;
            } else {
              slot.warpOk = false;
              setMotionSessionWarning(node.id, "After-hours Warp failed. Frozen on last frame.");
            }
          } catch {
            slot.warpOk = false;
            setMotionSessionWarning(node.id, "After-hours Warp failed. Frozen on last frame.");
          }
        })
        .catch(() => {
          slot.warpOk = false;
          setMotionSessionWarning(node.id, "After-hours Warp failed. Frozen on last frame.");
        });
    })
    .catch(() => {
      slot.warpOk = false;
      setMotionSessionWarning(node.id, "After-hours Warp failed. Frozen on last frame.");
    });

  ctx.restore();
}

function drawCaptured(
  ctx: CanvasRenderingContext2D,
  node: MotionNode,
  assets: CraftAsset[],
  onImage?: () => void,
): boolean {
  const asset = assets.find((item) => item.id === node.capturedAssetId);
  if (!asset?.dataUrl) return false;
  const img = getImageEl(asset.dataUrl, onImage);
  if (!img || !img.width) return false;
  ctx.drawImage(img, 0, 0, node.width, node.height);
  return true;
}

type PaintArgs = {
  ctx: CanvasRenderingContext2D;
  node: MotionNode;
  opts: MotionDrawOpts;
  freeze: boolean;
  particles: Particle[];
  t: number;
  ink: [number, number, number];
  accent: [number, number, number];
  seed: number;
  pointer: { x: number; y: number } | null;
  clickAge: number;
  origin: { x: number; y: number };
  lagged: { x: number; y: number };
  signals: MotionSignalsSnap;
  slot: Slot;
};

function localPointer(node: MotionNode, pointer: { x: number; y: number }): { x: number; y: number } {
  return { x: pointer.x - node.x, y: pointer.y - node.y };
}

function drawFilaments(args: PaintArgs) {
  const { ctx, node, freeze, particles, ink, accent, seed, pointer } = args;
  const schema = node.schema;
  const speed = schema.physicsAndMath.speed * (schema.category === "ParticleSystem" ? 18 : 28);
  const friction = 1 - schema.physicsAndMath.friction;
  if (!freeze) {
    for (const p of particles) {
      const angle = fieldAngle(p.x, p.y, schema, seed);
      p.vx = p.vx * friction + Math.cos(angle) * speed * 0.016;
      p.vy = p.vy * friction + Math.sin(angle) * speed * 0.016;
      if (pointer) {
        const loc = localPointer(node, pointer);
        const dx = p.x - loc.x;
        const dy = p.y - loc.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < schema.interactionRules.influenceRadius) {
          const fall =
            schema.interactionRules.falloff === "linear"
              ? 1 - dist / schema.interactionRules.influenceRadius
              : 1 - (dist / schema.interactionRules.influenceRadius) ** 2;
          const push = schema.interactionRules.strength * fall * 4;
          p.vx += (dx / dist) * push;
          p.vy += (dy / dist) * push;
        }
      }
      p.x = (p.x + p.vx + node.width) % node.width;
      p.y = (p.y + p.vy + node.height) % node.height;
    }
  }
  ctx.lineWidth = schema.category === "ParticleSystem" ? 1.2 : 1.4;
  ctx.lineCap = "round";
  const screen = schema.visual.blending === "screen";
  const mote = screen ? hexRgb(schema.visual.palette[2] ?? "#F7F5F1") : ink;
  const moteAccent = screen ? accent : accent;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]!;
    ctx.strokeStyle = rgba(i % 5 === 0 ? moteAccent : mote, schema.category === "ParticleSystem" ? (screen ? 0.7 : 0.55) : 0.22);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
    ctx.stroke();
  }
}

function drawRibbon(args: PaintArgs) {
  const { ctx, node, t, ink, accent } = args;
  const schema = node.schema;
  const bands = Math.max(2, Math.min(4, schema.physicsAndMath.densityCount));
  for (let b = 0; b < bands; b++) {
    ctx.strokeStyle = rgba(b % 2 === 0 ? accent : ink, 0.55 - b * 0.08);
    ctx.lineWidth = Math.max(1.5, node.height * 0.012);
    ctx.beginPath();
    for (let x = 0; x <= node.width; x += 4) {
      const y =
        node.height * (0.35 + b * 0.12) +
        Math.sin((x / node.width) * Math.PI * 2 * schema.physicsAndMath.frequency + t * schema.physicsAndMath.speed + b) *
          schema.physicsAndMath.amplitude;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawGrainField(args: PaintArgs) {
  const { ctx, node, t, ink, seed } = args;
  const count = Math.max(20, Math.min(120, node.schema.physicsAndMath.densityCount));
  const drift = node.schema.physicsAndMath.speed * 2;
  ctx.fillStyle = rgba(ink, 0.55);
  for (let i = 0; i < count; i++) {
    const x = hashNoise(i, 1, seed) * node.width + Math.sin(t * drift + i) * 0.6;
    const y = hashNoise(i, 2, seed) * node.height + Math.cos(t * drift * 0.7 + i) * 0.4;
    ctx.fillRect(x, y, 1.2, 1.2);
  }
}

function drawStampPulse(args: PaintArgs) {
  const { ctx, node, ink } = args;
  const age = oneShot(earliest(args.clickAge, args.signals.dockAge), 0.42);
  const slam = Number.isFinite(age) ? Math.min(1, age / 0.2) : 1;
  const eased = 1 - (1 - slam) ** 3;
  const scale = Number.isFinite(age) ? 1.18 - 0.18 * eased : 1;
  const cx = node.width / 2;
  const cy = node.height / 2;
  const r = Math.min(node.width, node.height) * 0.22;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = rgba(ink, 0.88);
  ctx.fill();
  if (paletteHasGold(node.schema.visual.palette)) {
    ctx.strokeStyle = rgba(GOLD_RGB, 0.95);
    ctx.lineWidth = Math.max(2, r * 0.07);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRedactSweep(args: PaintArgs) {
  const { ctx, node, t } = args;
  const cycle = ((t * node.schema.physicsAndMath.speed * 0.45) % 1.35) - 0.2;
  const x = cycle * node.width;
  const h = Math.max(18, node.height * 0.16);
  ctx.fillStyle = REDACT;
  ctx.fillRect(x, node.height * 0.42, node.width * 0.52, h);
}

function drawInkBleed(args: PaintArgs) {
  const { ctx, node, t, ink, accent, seed } = args;
  const strokes = Math.max(3, Math.min(7, Math.round(node.schema.physicsAndMath.densityCount / 24)));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(8, node.height * 0.048);
  for (let i = 0; i < strokes; i++) {
    const y = node.height * (0.18 + hashNoise(i, 1, seed) * 0.64);
    const x0 = hashNoise(i, 2, seed) * node.width * 0.18;
    const x1 = node.width * (0.72 + hashNoise(i, 3, seed) * 0.22);
    const cpx = node.width * (0.42 + Math.sin(t * node.schema.physicsAndMath.speed + i) * 0.04);
    const cpy = y + (hashNoise(i, 4, seed) - 0.5) * node.height * 0.22;
    const y1 = y + (hashNoise(i, 5, seed) - 0.5) * 18;
    ctx.strokeStyle = rgba(i % 3 === 0 ? accent : ink, 0.82);
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.quadraticCurveTo(cpx, cpy, x1, y1);
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha *= 0.15;
    ctx.translate(3.5, -2.5);
    ctx.strokeStyle = rgba(ink, 1);
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.quadraticCurveTo(cpx, cpy, x1, y1);
    ctx.stroke();
    ctx.restore();
  }
}

function drawLightLeak(args: PaintArgs) {
  const { ctx, node, t } = args;
  const gold = paletteHasGold(node.schema.visual.palette) ? GOLD_RGB : args.accent;
  const sway = Math.sin(t * node.schema.physicsAndMath.speed) * node.width * 0.04;
  ctx.beginPath();
  ctx.moveTo(node.width * 0.78 + sway, 0);
  ctx.lineTo(node.width, 0);
  ctx.lineTo(node.width, node.height * 0.28);
  ctx.closePath();
  ctx.fillStyle = rgba(gold, 0.42);
  ctx.fill();
}

function drawPerspectiveGrid(args: PaintArgs) {
  const { ctx, node, t, accent } = args;
  const vpX = node.width * 0.5;
  const vpY = node.height * 0.16;
  const scroll = ((t * node.schema.physicsAndMath.speed * 0.35) % 1 + 1) % 1;
  ctx.strokeStyle = rgba(accent, 0.38);
  ctx.lineWidth = 1;
  const cols = 18;
  for (let i = -cols; i <= cols; i++) {
    const x = node.width / 2 + (i / cols) * node.width * 1.7;
    ctx.beginPath();
    ctx.moveTo(x, node.height);
    ctx.lineTo(vpX, vpY);
    ctx.stroke();
  }
  const rows = 16;
  for (let r = 0; r < rows; r++) {
    const p = ((r + scroll) / rows) ** 1.55;
    const y = vpY + (node.height - vpY) * p;
    const span = ((y - vpY) / (node.height - vpY)) * node.width * 1.7;
    ctx.beginPath();
    ctx.moveTo(vpX - span / 2, y);
    ctx.lineTo(vpX + span / 2, y);
    ctx.stroke();
  }
}

function drawNetworkGraph(args: PaintArgs) {
  const { ctx, node, t, ink, accent, seed, pointer } = args;
  const n = Math.max(12, Math.min(20, Math.round(node.schema.physicsAndMath.densityCount / 2) || 16));
  const sites: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const breathe = Math.sin(t * node.schema.physicsAndMath.speed + i) * 3;
    sites.push({
      x: hashNoise(i, 11, seed) * node.width + breathe,
      y: hashNoise(i, 19, seed) * node.height + breathe * 0.4,
    });
  }
  ctx.lineWidth = 1;
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const a = sites[i]!;
    let best = -1;
    let second = -1;
    let bestD = Infinity;
    let secondD = Infinity;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const d = Math.hypot(a.x - sites[j]!.x, a.y - sites[j]!.y);
      if (d < bestD) {
        second = best;
        secondD = bestD;
        best = j;
        bestD = d;
      } else if (d < secondD) {
        second = j;
        secondD = d;
      }
    }
    ctx.strokeStyle = rgba(ink, 0.4);
    if (best >= 0) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(sites[best]!.x, sites[best]!.y);
      ctx.stroke();
    }
    if (second >= 0) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(sites[second]!.x, sites[second]!.y);
      ctx.stroke();
    }
  }
  const loc = pointer ? localPointer(node, pointer) : null;
  for (let i = 0; i < n; i++) {
    const s = sites[i]!;
    const hot = loc ? Math.hypot(s.x - loc.x, s.y - loc.y) < node.schema.interactionRules.influenceRadius : false;
    ctx.beginPath();
    ctx.arc(s.x, s.y, hot ? 4.2 : 2.6, 0, Math.PI * 2);
    ctx.fillStyle = rgba(i % 4 === 0 ? accent : ink, hot ? 0.9 : 0.7);
    ctx.fill();
  }
}

function drawTypeKinetic(args: PaintArgs) {
  const { ctx, node, t, ink, accent, opts } = args;
  const hook1 = opts.hooks?.hook1?.trim() ? opts.hooks.hook1 : "HOOK";
  const hook2 = opts.hooks?.hook2?.trim() ? opts.hooks.hook2 : "";
  const size = Math.max(18, Math.min(node.width * 0.11, node.height * 0.26));
  const fade = (Math.sin(t * node.schema.physicsAndMath.speed * Math.PI * 2) + 1) / 2;
  ctx.font = `700 ${size}px "Unbounded", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = rgba(ink, 1);
  ctx.save();
  ctx.globalAlpha *= 1 - fade * (hook2 ? 0.45 : 0);
  ctx.fillText(hook1, node.width / 2, node.height * (hook2 ? 0.4 : 0.5), node.width * 0.9);
  ctx.restore();
  if (hook2) {
    ctx.save();
    ctx.globalAlpha *= 0.25 + fade * 0.75;
    ctx.fillStyle = rgba(accent, 1);
    ctx.fillText(hook2, node.width / 2, node.height * 0.64, node.width * 0.9);
    ctx.restore();
  }
}

function drawDataTicker(args: PaintArgs) {
  const { ctx, node, t, ink, accent } = args;
  const size = Math.max(14, Math.min(node.height * 0.2, 28));
  ctx.font = `600 ${size}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const line = TICKER_COPY.join("   ·   ") + "   ·   ";
  const width = Math.max(1, ctx.measureText(line).width);
  const scroll = ((t * node.schema.physicsAndMath.speed * 70) % width + width) % width;
  ctx.fillStyle = rgba(ink, 0.92);
  ctx.fillText(line + line, -scroll, node.height * 0.42);
  ctx.fillStyle = rgba(accent, 0.7);
  ctx.fillText(line + line, -scroll, node.height * 0.68);
}

function drawMetaballGoo(args: PaintArgs) {
  const { ctx, node, t, ink, accent, seed, pointer } = args;
  ctx.globalCompositeOperation = "source-over";
  const blobs = Math.max(5, Math.min(9, Math.round(node.schema.physicsAndMath.densityCount / 5)));
  const loc = pointer ? localPointer(node, pointer) : null;
  for (let i = 0; i < blobs; i++) {
    const ox = loc ? (loc.x - node.width / 2) * 0.08 : 0;
    const oy = loc ? (loc.y - node.height / 2) * 0.08 : 0;
    const cx =
      hashNoise(i, 3, seed) * node.width +
      Math.sin(t * node.schema.physicsAndMath.speed + i) * node.schema.physicsAndMath.amplitude * 0.4 +
      ox;
    const cy =
      hashNoise(i, 8, seed) * node.height +
      Math.cos(t * node.schema.physicsAndMath.speed * 0.8 + i) * node.schema.physicsAndMath.amplitude * 0.3 +
      oy;
    const rx = node.width * (0.12 + hashNoise(i, 9, seed) * 0.1);
    const ry = node.height * (0.1 + hashNoise(i, 10, seed) * 0.08);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, i * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = rgba(i % 3 === 0 ? accent : ink, 0.38);
    ctx.fill();
  }
}

type Pt = { x: number; y: number };

function clipHalfPlane(poly: Pt[], px: number, py: number, nx: number, ny: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const da = (a.x - px) * nx + (a.y - py) * ny;
    const db = (b.x - px) * nx + (b.y - py) * ny;
    const ain = da <= 0;
    const bin = db <= 0;
    if (ain) out.push(a);
    if (ain !== bin) {
      const u = da / (da - db || 1e-6);
      out.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
    }
  }
  return out;
}

function drawVoronoiShatter(args: PaintArgs) {
  const { ctx, node, ink, accent, seed, pointer } = args;
  const count = Math.max(10, Math.min(18, Math.round(node.schema.physicsAndMath.densityCount / 3) || 14));
  const sites: Pt[] = [];
  for (let i = 0; i < count; i++) {
    sites.push({
      x: hashNoise(i, 21, seed) * node.width,
      y: hashNoise(i, 34, seed) * node.height,
    });
  }
  let expand = -1;
  if ((pointer || args.clickAge < 1.2) && node.schema.interactionRules.triggerType === "click") {
    const loc = pointer ? localPointer(node, pointer) : args.origin;
    let best = Infinity;
    for (let i = 0; i < sites.length; i++) {
      const d = Math.hypot(sites[i]!.x - loc.x, sites[i]!.y - loc.y);
      if (d < best) {
        best = d;
        expand = i;
      }
    }
  }
  const box: Pt[] = [
    { x: 0, y: 0 },
    { x: node.width, y: 0 },
    { x: node.width, y: node.height },
    { x: 0, y: node.height },
  ];
  ctx.lineJoin = "miter";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < sites.length; i++) {
    const si = sites[i]!;
    let poly = box;
    for (let j = 0; j < sites.length; j++) {
      if (j === i) continue;
      const sj = sites[j]!;
      poly = clipHalfPlane(poly, (si.x + sj.x) / 2, (si.y + sj.y) / 2, sj.x - si.x, sj.y - si.y);
    }
    if (i === expand) {
      poly = poly.map((p) => ({ x: si.x + (p.x - si.x) * 1.22, y: si.y + (p.y - si.y) * 1.22 }));
    }
    if (poly.length < 3) continue;
    ctx.beginPath();
    ctx.moveTo(poly[0]!.x, poly[0]!.y);
    for (let k = 1; k < poly.length; k++) ctx.lineTo(poly[k]!.x, poly[k]!.y);
    ctx.closePath();
    ctx.fillStyle = rgba(i % 5 === 0 ? accent : ink, i === expand ? 0.2 : 0.08);
    ctx.fill();
    ctx.strokeStyle = rgba(ink, 0.62);
    ctx.stroke();
  }
}

function drawVaporDrift(args: PaintArgs) {
  const { ctx, node, t, ink, accent, seed } = args;
  const speed = node.schema.physicsAndMath.speed;
  const amp = node.schema.physicsAndMath.amplitude || 22;
  const drift = t * speed * 28;
  for (let i = 0; i < 4; i++) {
    const y = node.height * (0.16 + i * 0.2) + Math.sin(t * speed + i * 1.2) * amp * 0.35;
    const h = node.height * 0.32;
    const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
    g.addColorStop(0, rgba(ink, 0));
    g.addColorStop(0.5, rgba(i % 2 ? accent : ink, 0.06));
    g.addColorStop(1, rgba(ink, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, y - h / 2, node.width, h);
  }
  const puffs = Math.max(8, Math.min(16, Math.round(node.schema.physicsAndMath.densityCount / 3)));
  for (let i = 0; i < puffs; i++) {
    const n = hashNoise(i, 3, seed);
    const span = node.width + 280;
    const x = ((hashNoise(i, 1, seed) * span + drift * (0.35 + n * 0.4)) % span) - 140;
    const y =
      hashNoise(i, 2, seed) * node.height * 0.72 + node.height * 0.14 + Math.sin(t * speed * 0.7 + i) * amp * 0.18;
    const r = Math.min(node.width, node.height) * (0.32 + n * 0.18);
    const tone = i % 2 === 0 ? ink : accent;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(tone, 0.09));
    g.addColorStop(0.55, rgba(tone, 0.035));
    g.addColorStop(1, rgba(tone, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function drawStaticShiver(args: PaintArgs) {
  const { ctx, node, t, ink, seed } = args;
  const amp = node.schema.physicsAndMath.amplitude || 1.5;
  const freq = Math.max(1, node.schema.physicsAndMath.frequency) * 12;
  const ox = Math.sin(t * freq) * amp;
  const oy = Math.cos(t * freq * 1.13) * amp;
  const count = Math.max(40, Math.min(140, node.schema.physicsAndMath.densityCount));
  const tick = Math.floor(t * 8);
  ctx.fillStyle = rgba(ink, 0.45);
  for (let i = 0; i < count; i++) {
    const x = hashNoise(i, 1, seed + tick) * node.width + ox;
    const y = hashNoise(i, 2, seed + tick) * node.height + oy;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
}

function drawVignetteBreath(args: PaintArgs) {
  const { ctx, node, t, ink } = args;
  const speed = node.schema.physicsAndMath.speed || 0.32;
  const amp = (node.schema.physicsAndMath.amplitude || 10) / 100;
  const opacity = 0.5 + Math.sin(t * speed * 6) * (0.1 + amp * 0.4);
  const g = ctx.createRadialGradient(
    node.width / 2,
    node.height / 2,
    Math.min(node.width, node.height) * 0.18,
    node.width / 2,
    node.height / 2,
    Math.max(node.width, node.height) * 0.72,
  );
  g.addColorStop(0, rgba(ink, 0));
  g.addColorStop(1, rgba(ink, opacity));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, node.width, node.height);
}

function drawHorizonShift(args: PaintArgs) {
  const { ctx, node, t, accent, ink } = args;
  const lean = Math.sin(t * node.schema.physicsAndMath.frequency) * node.schema.physicsAndMath.amplitude;
  const vpX = node.width * 0.5 + lean;
  const vpY = node.height * 0.34 + Math.cos(t * 0.4) * 6;
  ctx.strokeStyle = rgba(accent, 0.32);
  ctx.lineWidth = 1;
  for (let i = -10; i <= 10; i++) {
    ctx.beginPath();
    ctx.moveTo(node.width / 2 + i * node.width * 0.09, node.height);
    ctx.lineTo(vpX, vpY);
    ctx.stroke();
  }
  ctx.strokeStyle = rgba(ink, 0.28);
  for (let r = 1; r <= 8; r++) {
    const p = (r / 8) ** 1.4;
    const y = vpY + (node.height - vpY) * p;
    const span = ((y - vpY) / (node.height - vpY)) * node.width * 1.4;
    ctx.beginPath();
    ctx.moveTo(vpX - span / 2, y);
    ctx.lineTo(vpX + span / 2, y);
    ctx.stroke();
  }
}

function drawCarbonWeave(args: PaintArgs) {
  const { ctx, node, ink, accent, lagged } = args;
  const ox = (lagged.x - node.width / 2) * 0.02;
  const oy = (lagged.y - node.height / 2) * 0.02;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.lineWidth = 1;
  const step = Math.max(8, Math.min(18, node.schema.physicsAndMath.densityCount / 2));
  ctx.strokeStyle = rgba(ink, 0.28);
  for (let x = -node.height; x < node.width + node.height; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + node.height, node.height);
    ctx.stroke();
  }
  ctx.strokeStyle = rgba(accent, 0.18);
  for (let x = -node.height; x < node.width + node.height; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, node.height);
    ctx.lineTo(x + node.height, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHeatHaze(args: PaintArgs) {
  const { ctx, node, t, ink, accent } = args;
  const bands = 22;
  const h = node.height / bands;
  const amp = (node.schema.physicsAndMath.amplitude || 5) * (args.signals.busy ? 1.7 : 0.45);
  const freq = node.schema.physicsAndMath.frequency || 4;
  for (let i = 0; i < bands; i++) {
    const y = i * h;
    const dx = Math.sin(t * freq * Math.PI * 2 + i * 0.7) * amp;
    ctx.fillStyle = rgba(i % 3 === 0 ? accent : ink, 0.06 + (i % 2) * 0.04);
    ctx.fillRect(dx, y, node.width, h + 0.6);
  }
}

function drawLedgerFracture(args: PaintArgs) {
  const { ctx, node, ink, accent, seed, origin } = args;
  const local = oneShot(earliest(args.clickAge, args.signals.dockAge), 1.5);
  const depth = Number.isFinite(local) ? 0.25 + 0.75 * easeOut01(local / 1.5) : 0.22;
  const cracks = 7;
  ctx.lineCap = "round";
  for (let i = 0; i < cracks; i++) {
    const ang = hashNoise(i, 3, seed) * Math.PI * 2;
    const len = Math.min(node.width, node.height) * (0.18 + hashNoise(i, 4, seed) * 0.35) * depth;
    ctx.strokeStyle = rgba(i % 2 === 0 ? ink : accent, 0.35 + depth * 0.4);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    let x = origin.x;
    let y = origin.y;
    const steps = 5;
    for (let s = 1; s <= steps; s++) {
      const u = s / steps;
      x = origin.x + Math.cos(ang + (hashNoise(i, s, seed) - 0.5) * 0.8) * len * u;
      y = origin.y + Math.sin(ang + (hashNoise(i, s + 9, seed) - 0.5) * 0.8) * len * u;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawScanlineSweep(args: PaintArgs) {
  const { ctx, node, t, accent } = args;
  const speed = Math.max(0.12, node.schema.physicsAndMath.speed || 0.35);
  const cycle = 2.4 / speed;
  const y = ((t % cycle) / cycle) * node.height;
  const h = Math.max(2, node.height * 0.018);
  const g = ctx.createLinearGradient(0, y - 8, 0, y + h + 8);
  g.addColorStop(0, rgba(accent, 0));
  g.addColorStop(0.5, rgba(accent, 0.55));
  g.addColorStop(1, rgba(accent, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, y - 8, node.width, h + 16);
}

function drawMarginGlow(args: PaintArgs) {
  const { ctx, node, t, accent } = args;
  const hot = args.signals.selected ? 1 : 0.35;
  const speed = node.schema.physicsAndMath.speed || 0.48;
  const op = ((40 + Math.sin(t * speed * 6) * 25) / 100) * hot;
  const inset = Math.max(6, Math.min(node.width, node.height) * 0.04);
  ctx.strokeStyle = rgba(accent, op);
  ctx.lineWidth = Math.max(3, inset * 0.7);
  ctx.strokeRect(inset, inset, node.width - inset * 2, node.height - inset * 2);
}

function drawResinGloss(args: PaintArgs) {
  const { ctx, node, t, accent } = args;
  const paper: [number, number, number] = [247, 245, 241];
  const span = node.width + 400;
  const x = ((t * node.schema.physicsAndMath.speed * 80) % span) - 200;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.translate(x, 0);
  ctx.rotate(-0.4);
  const g = ctx.createLinearGradient(0, 0, 160, 0);
  g.addColorStop(0, rgba(paper, 0));
  g.addColorStop(0.32, rgba(accent, 0.42));
  g.addColorStop(0.5, "rgba(255,255,255,0.88)");
  g.addColorStop(0.68, rgba(accent, 0.32));
  g.addColorStop(1, rgba(paper, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-24, -node.height, 160, node.height * 3);
  ctx.restore();
}

/** A rainbow-stepped light band sweeping diagonally across the node, same translate-wraps/
 * fixed-rotation geometry as drawResinGloss so the loop has no seam. Hue cycles continuously
 * (color, not geometry, so wrapping never snaps); hover brightens and widens the sheen. */
function drawHoloFoil(args: PaintArgs) {
  const { ctx, node, t, pointer } = args;
  const speed = node.schema.physicsAndMath.speed || 0.6;
  const hot = Boolean(pointer);
  const span = node.width + 400;
  const x = ((t * speed * 80) % span) - 200;
  const hueBase = (t * 40 * speed) % 360;
  const sat = hot ? 82 : 55;
  const light = hot ? 55 : 48;
  const alphaMax = hot ? 0.92 : 0.6;
  const bandW = hot ? 190 : 150;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.translate(x, 0);
  ctx.rotate(-0.4);
  const g = ctx.createLinearGradient(0, 0, bandW, 0);
  const stops = 6;
  for (let i = 0; i <= stops; i++) {
    const p = i / stops;
    const hue = (hueBase + p * 300) % 360;
    const dist = Math.abs(p - 0.5) * 2;
    const alpha = p === 0 || p === 1 ? 0 : alphaMax * (1 - dist * 0.75);
    const li = light + (1 - dist) * 22;
    g.addColorStop(p, `hsla(${hue}, ${sat}%, ${li}%, ${alpha})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(-24, -node.height, bandW + 24, node.height * 3);
  ctx.restore();
}

function drawVellumCrease(args: PaintArgs) {
  const { ctx, node, t, ink } = args;
  const speed = node.schema.physicsAndMath.speed || 0.24;
  const op = (50 + Math.sin(t * speed * 6) * 15) / 100;
  ctx.save();
  ctx.translate(node.width * 0.52, 0);
  ctx.rotate(0.18);
  const g = ctx.createLinearGradient(-18, 0, 18, 0);
  g.addColorStop(0, rgba(ink, 0));
  g.addColorStop(0.5, rgba(ink, op * 0.55));
  g.addColorStop(1, rgba(ink, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-18, -20, 36, node.height + 40);
  ctx.restore();
}

function drawElasticSpring(args: PaintArgs) {
  const { ctx, node, ink, accent } = args;
  const local = oneShot(earliest(args.clickAge, args.signals.dockAge, args.signals.paneAge), 2.4);
  const freq = node.schema.physicsAndMath.frequency || 1.5;
  const decay = 0.5;
  const n = node.schema.physicsAndMath.amplitude || 50;
  const spring = Number.isFinite(local) ? (n * Math.cos(freq * local * 2 * Math.PI)) / Math.exp(decay * local) : 0;
  const scale = 1 + spring / 400;
  const cx = node.width / 2;
  const cy = node.height / 2;
  const w = node.width * 0.42;
  const h = node.height * 0.28;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.fillStyle = rgba(ink, 0.88);
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = rgba(accent, 0.7);
  ctx.lineWidth = 2;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

function drawKineticSqueeze(args: PaintArgs) {
  const { ctx, node, ink, accent, opts } = args;
  const vel = args.signals.typeVel;
  const stretch = Math.min(30, vel * 0.9);
  const copy = opts.hooks?.hook1?.trim() ? opts.hooks.hook1 : "FILE";
  const size = Math.max(16, Math.min(node.width * 0.12, node.height * 0.28));
  ctx.save();
  ctx.translate(node.width / 2, node.height / 2);
  ctx.scale(1 + stretch / 140, 1 - stretch / 180);
  ctx.font = `700 ${size}px "Unbounded", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = rgba(ink, 0.95);
  ctx.fillText(copy, 0, 0, node.width * 0.8);
  ctx.fillStyle = rgba(accent, 0.35);
  ctx.fillRect(-node.width * 0.18, size * 0.7, node.width * 0.36, 3);
  ctx.restore();
}

function drawCrosshairGrid(args: PaintArgs) {
  const { ctx, node, lagged, accent, ink } = args;
  ctx.strokeStyle = rgba(ink, 0.18);
  ctx.lineWidth = 1;
  const step = Math.max(18, Math.min(36, node.width / 12));
  for (let x = 0; x <= node.width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, node.height);
    ctx.stroke();
  }
  for (let y = 0; y <= node.height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(node.width, y);
    ctx.stroke();
  }
  ctx.strokeStyle = rgba(accent, 0.7);
  ctx.beginPath();
  ctx.moveTo(lagged.x, 0);
  ctx.lineTo(lagged.x, node.height);
  ctx.moveTo(0, lagged.y);
  ctx.lineTo(node.width, lagged.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(lagged.x, lagged.y, 8, 0, Math.PI * 2);
  ctx.stroke();
}

function drawTypewriterCursor(args: PaintArgs) {
  const { ctx, node, t, ink, accent, opts } = args;
  const copy = opts.hooks?.hook1?.trim() ? opts.hooks.hook1 : "FILE";
  const size = Math.max(16, Math.min(node.height * 0.22, 28));
  ctx.font = `600 ${size}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const x = node.width * 0.12;
  const y = node.height * 0.5;
  ctx.fillStyle = rgba(ink, 0.92);
  ctx.fillText(copy, x, y, node.width * 0.7);
  const live = args.signals.focusMode || args.signals.typeAge < 1;
  const rate = live ? 3 : 1.6;
  const on = Math.floor(t * rate) % 2 === 0;
  if (on) {
    const w = ctx.measureText(copy).width;
    ctx.fillStyle = rgba(accent, 1);
    ctx.fillRect(x + w + 6, y - size * 0.45, Math.max(8, size * 0.42), size * 0.9);
  }
}

function drawLedgerStitch(args: PaintArgs) {
  const { ctx, node, t, ink, accent } = args;
  const inset = Math.max(10, Math.min(node.width, node.height) * 0.08);
  ctx.setLineDash([3, 7]);
  ctx.lineDashOffset = -t * 80;
  ctx.strokeStyle = rgba(ink, 0.85);
  ctx.lineWidth = 1.6;
  ctx.strokeRect(inset, inset, node.width - inset * 2, node.height - inset * 2);
  ctx.strokeStyle = rgba(accent, 0.35);
  ctx.lineDashOffset = -t * 80 + 5;
  ctx.strokeRect(inset + 4, inset + 4, node.width - inset * 2 - 8, node.height - inset * 2 - 8);
  ctx.setLineDash([]);
}

function drawInkSplash(args: PaintArgs) {
  const { ctx, node, ink, accent, seed, origin } = args;
  const age = oneShot(args.clickAge, 0.8);
  const active = Number.isFinite(age);
  const birth = active ? easeOut01(1 - age / 0.8) : 0.28;
  const count = active
    ? Math.max(12, Math.min(36, node.schema.physicsAndMath.densityCount))
    : 7;
  const spread = active ? 0.35 + age : 0.22;
  for (let i = 0; i < count; i++) {
    const ang = hashNoise(i, 1, seed) * Math.PI * 2;
    const dist = (0.15 + hashNoise(i, 2, seed) * 0.55) * Math.min(node.width, node.height) * (1 - birth * 0.2);
    const r = (2 + hashNoise(i, 3, seed) * 7) * birth;
    ctx.beginPath();
    ctx.arc(origin.x + Math.cos(ang) * dist * spread, origin.y + Math.sin(ang) * dist * spread, r, 0, Math.PI * 2);
    ctx.fillStyle = rgba(i % 4 === 0 ? accent : ink, 0.2 + birth * 0.45);
    ctx.fill();
  }
}

function drawGlitchBurst(args: PaintArgs) {
  const { ctx, node, t, ink, accent } = args;
  const interval = 4;
  const burstSeed = Math.floor(t / interval);
  const burst = Math.sin(t * 50 + burstSeed) > 0.85;
  const ox = burst ? Math.sin(t * 40) * 8 : 0;
  const oy = burst ? Math.cos(t * 37) * 4 : 0;
  const y = node.height * 0.42;
  const h = Math.max(16, node.height * 0.16);
  ctx.fillStyle = rgba(ink, 0.55);
  ctx.fillRect(node.width * 0.18, y, node.width * 0.64, h);
  if (burst) {
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = "rgba(200,40,40,0.45)";
    ctx.fillRect(node.width * 0.18 + ox, y + oy, node.width * 0.64, h);
    ctx.fillStyle = "rgba(40,90,200,0.4)";
    ctx.fillRect(node.width * 0.18 - ox, y - oy, node.width * 0.64, h);
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.fillStyle = rgba(accent, 0.25);
  ctx.fillRect(node.width * 0.18, y + h + 6, node.width * 0.4, 3);
}

function drawInkRipple(args: PaintArgs) {
  const { ctx, node, ink, accent, origin } = args;
  const age = oneShot(args.clickAge, 1);
  const active = Number.isFinite(age);
  const amount = active ? (1 - easeOut01(age)) * 30 : 22;
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 3; i++) {
    const r = (0.08 + i * 0.1) * Math.min(node.width, node.height) + (30 - amount) * (4 + i * 3);
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(i === 1 ? accent : ink, active ? 0.12 + (1 - age) * 0.35 : 0.18);
    ctx.stroke();
  }
}

function drawFocusPull(args: PaintArgs) {
  const { ctx, node, ink } = args;
  const local = oneShot(earliest(args.signals.dialogAge, args.signals.dockAge), 0.4);
  const radius = Number.isFinite(local) ? (1 - easeOut01(local / 0.4)) * 25 : 6;
  ctx.save();
  for (let i = 1; i <= 4; i++) {
    ctx.globalAlpha *= 0.35;
    ctx.fillStyle = rgba(ink, 0.08);
    ctx.fillRect(-radius * i * 0.15, -radius * i * 0.1, node.width + radius * i * 0.3, node.height + radius * i * 0.2);
  }
  ctx.restore();
}

function drawMagneticRipple(args: PaintArgs) {
  const { ctx, node, accent, ink, origin } = args;
  const age = oneShot(args.clickAge, 0.9);
  const dur = 0.5;
  const active = Number.isFinite(age);
  const u = active ? (age < dur ? easeOut01(age / dur) : 1) : 0.35;
  const scale = 50 + u * 100;
  const r = (scale / 150) * Math.min(node.width, node.height) * 0.42;
  const fade = !active ? 0.45 : age < dur ? 1 - u * 0.4 : Math.max(0, 1 - (age - dur) * 2);
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, r, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(accent, 0.55 * fade);
  ctx.lineWidth = Math.max(1.5, 4 * fade);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, r * 0.62, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(ink, 0.3 * fade);
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawStrobePulse(args: PaintArgs) {
  const { ctx, node, t, ink, seed } = args;
  if (!args.signals.busy) {
    ctx.fillStyle = rgba(ink, 0.12);
    for (let i = 0; i < 24; i++) {
      ctx.fillRect(hashNoise(i, 3, seed) * node.width, hashNoise(i, 4, seed) * node.height, 1.2, 1.2);
    }
    return;
  }
  const tick = Math.floor(t * 24);
  const fire = hashNoise(tick, 1, seed) > 0.85;
  const dip = fire ? 0.08 + hashNoise(tick, 2, seed) * 0.07 : 0;
  if (dip > 0) {
    ctx.fillStyle = rgba(ink, dip);
    ctx.fillRect(0, 0, node.width, node.height);
  }
  const count = Math.max(20, Math.min(80, node.schema.physicsAndMath.densityCount));
  ctx.fillStyle = rgba(ink, 0.28 + dip);
  for (let i = 0; i < count; i++) {
    const x = hashNoise(i, 3, seed + tick) * node.width;
    const y = hashNoise(i, 4, seed + tick) * node.height;
    ctx.fillRect(x, y, 1.2, 1.2);
  }
}

function drawMomentumGlide(args: PaintArgs) {
  const { ctx, node, ink, accent } = args;
  const local = oneShot(earliest(args.signals.paneAge, args.clickAge), 0.6);
  const u = Number.isFinite(local) ? easeOut01(local / 0.6) : 1;
  const dx = (1 - u) * -50;
  const w = node.width * 0.58;
  const h = node.height * 0.46;
  const x = node.width / 2 - w / 2 + dx;
  const y = node.height / 2 - h / 2;
  ctx.fillStyle = rgba(ink, 0.78);
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = rgba(accent, 0.45);
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  const paper: [number, number, number] = [247, 245, 241];
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, rgba(paper, 0));
  g.addColorStop(0.5, rgba(paper, 0.12));
  g.addColorStop(1, rgba(paper, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function drawPrismaticFringe(args: PaintArgs) {
  const { ctx, node, t, ink } = args;
  const age = oneShot(earliest(args.clickAge, args.signals.paneAge), 0.2);
  const on = Number.isFinite(age);
  const ox = on ? Math.sin(t * 20) * 4 : 0;
  const inset = Math.max(8, Math.min(node.width, node.height) * 0.05);
  ctx.lineWidth = 3;
  ctx.strokeStyle = rgba(ink, 0.35);
  ctx.strokeRect(inset, inset, node.width - inset * 2, node.height - inset * 2);
  if (!on) return;
  ctx.globalCompositeOperation = "screen";
  ctx.strokeStyle = "rgba(200,50,50,0.55)";
  ctx.strokeRect(inset + ox, inset, node.width - inset * 2, node.height - inset * 2);
  ctx.strokeStyle = "rgba(40,90,210,0.5)";
  ctx.strokeRect(inset - ox, inset, node.width - inset * 2, node.height - inset * 2);
  ctx.globalCompositeOperation = "source-over";
}

function buildQuartzSurface(w: number, h: number, ink: [number, number, number], accent: [number, number, number]): HTMLCanvasElement {
  const surface = document.createElement("canvas");
  surface.width = w;
  surface.height = h;
  const sctx = surface.getContext("2d");
  if (!sctx) return surface;
  const core = sctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.65);
  core.addColorStop(0, rgba(accent, 0.24));
  core.addColorStop(0.55, rgba(accent, 0.09));
  core.addColorStop(1, rgba(accent, 0));
  sctx.fillStyle = core;
  sctx.fillRect(0, 0, w, h);
  sctx.strokeStyle = rgba(ink, 0.14);
  sctx.lineWidth = 1;
  const step = Math.max(18, w / 10);
  for (let x = -h; x < w + h; x += step) {
    sctx.beginPath();
    sctx.moveTo(x, 0);
    sctx.lineTo(x + h, h);
    sctx.stroke();
  }
  return surface;
}

/** Real pixel displacement, not a painted shape: a self-rendered quartz surface (radial core + facet lines)
 * gets sliced into horizontal bands and redrawn with a per-band x-offset, so it actually ripples like glass
 * under tension instead of animating a drawn outline. Falloff concentrates the ripple near the cursor. */
function drawQuartzFluid(args: PaintArgs) {
  const { ctx, node, t, ink, accent, pointer, lagged, slot } = args;
  const { speed, amplitude, frequency } = node.schema.physicsAndMath;
  const strength = node.schema.interactionRules.strength || 0.9;
  const radius = Math.max(60, node.schema.interactionRules.influenceRadius || 160);
  const w = Math.max(1, Math.round(node.width));
  const h = Math.max(1, Math.round(node.height));

  if (!slot.quartzSurface || slot.quartzSurface.width !== w || slot.quartzSurface.height !== h) {
    slot.quartzSurface = buildQuartzSurface(w, h, ink, accent);
  }
  const surface = slot.quartzSurface;

  const spatialFreq = (frequency || 1) * 0.06;
  const band = 3;
  ctx.save();
  ctx.globalAlpha *= 0.85 + Math.sin(t * (speed || 0.5) * 2) * 0.15;
  for (let y = 0; y < h; y += band) {
    const fall = Math.max(0, 1 - Math.abs(y - lagged.y) / radius);
    const dx = (amplitude || 16) * strength * (0.3 + fall * (pointer ? 1.4 : 0.55)) * Math.sin(y * spatialFreq + t * (speed || 0.5) * 3);
    ctx.drawImage(surface, 0, y, w, band + 1, dx, y, w, band + 1);
  }
  ctx.restore();

  if (pointer) {
    const glow = ctx.createRadialGradient(lagged.x, lagged.y, 0, lagged.x, lagged.y, radius * 0.5);
    glow.addColorStop(0, rgba(accent, 0.2 * strength));
    glow.addColorStop(1, rgba(accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawAnodeDecay(args: PaintArgs) {
  const { ctx, node, ink, accent } = args;
  const local = oneShot(args.signals.closeAge, 0.55);
  if (!Number.isFinite(local)) {
    ctx.fillStyle = rgba(accent, 0.12);
    ctx.fillRect(0, node.height * 0.62, node.width, 3);
    ctx.fillStyle = rgba(ink, 0.08);
    ctx.fillRect(0, node.height * 0.62 + 6, node.width, 1);
    return;
  }
  const u = Math.min(1, local / 0.55);
  ctx.fillStyle = rgba(ink, 0.18 + u * 0.72);
  ctx.fillRect(0, 0, node.width, node.height);
  ctx.fillStyle = rgba(accent, 0.22 * (1 - u));
  ctx.fillRect(0, node.height * (0.2 + u * 0.5), node.width, Math.max(1, 6 * (1 - u)));
}

function drawWaveformPulse(args: PaintArgs) {
  const { ctx, node, t, ink, accent, seed } = args;
  const bars = Math.max(16, Math.min(40, node.schema.physicsAndMath.densityCount));
  const mid = node.height * 0.5;
  const listen = Math.max(0.12, args.signals.typeVel / 18, args.signals.busy ? 0.85 : 0);
  const base = 8 + listen * 16;
  const freq = node.schema.physicsAndMath.frequency || 12;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (let i = 0; i <= bars; i++) {
    const tick = Math.floor(t * 3);
    const wig = (hashNoise(tick, i, seed) - 0.5) * 2 * (node.schema.physicsAndMath.amplitude || 15) * listen;
    const h = base + Math.sin(t * freq + i) * wig;
    const x = (i / bars) * node.width;
    const y = mid - h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = rgba(ink, 0.9);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i <= bars; i++) {
    const tick = Math.floor(t * 3);
    const wig = (hashNoise(tick, i + 11, seed) - 0.5) * 2 * (node.schema.physicsAndMath.amplitude || 15) * listen;
    const h = base * 0.55 + Math.sin(t * freq * 0.8 + i) * wig * 0.6;
    const x = (i / bars) * node.width;
    const y = mid + h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = rgba(accent, 0.55);
  ctx.stroke();
}

function drawEdgeSnap(args: PaintArgs) {
  const { ctx, node, ink, accent } = args;
  const age = oneShot(earliest(args.clickAge, args.signals.dockAge), 0.25);
  const u = Number.isFinite(age) ? easeOut01(age / 0.25) : 1;
  const scale = 1.1 - u * 0.1;
  const w = node.width * 0.5;
  const h = node.height * 0.38;
  ctx.save();
  ctx.translate(node.width / 2, node.height / 2);
  ctx.scale(scale, scale);
  ctx.fillStyle = rgba(ink, 0.82);
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = rgba(accent, 0.7);
  ctx.lineWidth = 2;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.restore();
  ctx.strokeStyle = rgba(accent, 0.35 + (1 - u) * 0.4);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(node.width * 0.08, 0);
  ctx.lineTo(node.width * 0.08, node.height);
  ctx.stroke();
}

function drawHeatBloom(args: PaintArgs) {
  const { ctx, node, t, ink } = args;
  const amount = ((10 + Math.sin(t * 0.5) * 5) / 100) * (args.signals.busy ? 1.8 : 0.55);
  const g = ctx.createRadialGradient(
    node.width * 0.5,
    node.height * 0.7,
    8,
    node.width * 0.5,
    node.height * 0.55,
    Math.max(node.width, node.height) * 0.85,
  );
  g.addColorStop(0, rgba(ink, 0.05));
  g.addColorStop(1, `rgba(92,48,28,${amount * 1.4})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, node.width, node.height);
}

function drawFocalVignette(args: PaintArgs) {
  const { ctx, node, ink } = args;
  const local = args.signals.focusMode ? Math.min(1, args.signals.focusAge / 0.5) : 0;
  const u = easeOut01(local);
  const op = 0.3 + u * 0.45;
  const inner = 0.42 - u * 0.16;
  const g = ctx.createRadialGradient(
    node.width / 2,
    node.height / 2,
    Math.min(node.width, node.height) * inner,
    node.width / 2,
    node.height / 2,
    Math.max(node.width, node.height) * 0.72,
  );
  g.addColorStop(0, rgba(ink, 0));
  g.addColorStop(1, rgba(ink, op));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, node.width, node.height);
}

function drawStencilPunch(args: PaintArgs) {
  const { ctx, node, ink, accent, opts } = args;
  const local = oneShot(earliest(args.clickAge, args.signals.dockAge), 0.3);
  const dist = Number.isFinite(local) ? 25 - easeOut01(local / 0.3) * 20 : 5;
  const copy = opts.hooks?.hook1?.trim() ? opts.hooks.hook1 : "FILE";
  const size = Math.max(22, Math.min(node.width * 0.16, node.height * 0.32));
  const plateW = node.width * 0.84;
  const plateH = node.height * 0.52;
  const px = (node.width - plateW) / 2;
  const py = (node.height - plateH) / 2;
  ctx.fillStyle = rgba(ink, 0.92);
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(px, py, plateW, plateH, 10);
    ctx.fill();
  } else {
    ctx.fillRect(px, py, plateW, plateH);
  }
  ctx.font = `800 ${size}px "Unbounded", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = rgba(ink, 0.35);
  ctx.fillText(copy, node.width / 2 + dist * 0.45, node.height / 2 + dist * 0.55, node.width * 0.86);
  ctx.fillStyle = rgba(accent, 0.22);
  ctx.fillText(copy, node.width / 2 + dist * 0.2, node.height / 2 + dist * 0.25, node.width * 0.86);
  const paper: [number, number, number] = [247, 245, 241];
  ctx.fillStyle = rgba(paper, 1);
  ctx.fillText(copy, node.width / 2, node.height / 2, node.width * 0.86);
  ctx.strokeStyle = rgba(ink, 0.85);
  ctx.lineWidth = 1.4;
  ctx.strokeText(copy, node.width / 2, node.height / 2, node.width * 0.86);
}

function drawVellumHysteresis(args: PaintArgs) {
  const { ctx, node, ink, accent, lagged, pointer, seed } = args;
  const target = pointer ? localPointer(node, pointer) : { x: node.width / 2, y: node.height / 2 };
  ctx.fillStyle = rgba(ink, 0.12);
  for (let i = 0; i < 18; i++) {
    const x = hashNoise(i, 1, seed) * node.width;
    const y = hashNoise(i, 2, seed) * node.height;
    ctx.fillRect(x, y, 2.2, 1.4);
  }
  ctx.fillStyle = rgba(ink, 0.22);
  ctx.beginPath();
  ctx.arc(lagged.x, lagged.y, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(accent, 0.55);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(target.x, target.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = rgba(accent, 0.7);
  ctx.fill();
}

function drawPhosphorBurn(args: PaintArgs) {
  const { ctx, node, ink, accent, opts } = args;
  const local = oneShot(args.signals.typeAge, 0.3);
  const ghost = Number.isFinite(local) ? 0.4 * (1 - local / 0.3) : 0;
  const copy = opts.hooks?.hook1?.trim() ? opts.hooks.hook1 : "FILE";
  const size = Math.max(18, Math.min(node.width * 0.12, node.height * 0.26));
  const x = node.width * 0.28;
  const y = node.height * 0.5;
  ctx.font = `700 ${size}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  if (ghost > 0.01) {
    ctx.fillStyle = rgba(accent, ghost);
    ctx.fillText(copy, x - 18, y, node.width * 0.7);
  }
  ctx.fillStyle = rgba(ink, 0.92);
  ctx.fillText(copy, x, y, node.width * 0.7);
}

function drawEntanglePulse(args: PaintArgs) {
  const { ctx, node, t, ink, accent, seed } = args;
  const n = Math.max(6, Math.min(12, node.schema.physicsAndMath.densityCount));
  const linked = oneShot(earliest(args.signals.linkAge, args.clickAge), 1.2);
  const signal = Number.isFinite(linked) ? 0.55 + Math.sin(linked * 8) * 0.45 : 0.2;
  const freq = node.schema.physicsAndMath.frequency || 8;
  const base = node.schema.physicsAndMath.amplitude || 15;
  const sites: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const warp = base + signal * Math.sin(t * freq + i);
    sites.push({
      x: hashNoise(i, 5, seed) * node.width + Math.sin(t + i) * warp * 0.15,
      y: hashNoise(i, 9, seed) * node.height + Math.cos(t * 0.8 + i) * warp * 0.12,
    });
  }
  ctx.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    const a = sites[i]!;
    const b = sites[(i + 3) % n]!;
    ctx.strokeStyle = rgba(ink, 0.28 + signal * 0.2);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (let i = 0; i < n; i++) {
    const s = sites[i]!;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 3 + signal * 2, 0, Math.PI * 2);
    ctx.fillStyle = rgba(i % 3 === 0 ? accent : ink, 0.75);
    ctx.fill();
  }
}

function drawResonanceBlur(args: PaintArgs) {
  const { ctx, node, ink, accent, opts } = args;
  const vel = args.signals.typeVel;
  const blur = Math.min(45, vel * 1.2);
  const copy = opts.hooks?.hook1?.trim() ? opts.hooks.hook1 : "FILE";
  const size = Math.max(16, Math.min(node.width * 0.12, node.height * 0.26));
  ctx.font = `700 ${size}px "Unbounded", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cx = node.width / 2;
  const cy = node.height / 2;
  const steps = Math.max(1, Math.round(blur / 6));
  for (let i = steps; i >= 1; i--) {
    ctx.fillStyle = rgba(ink, 0.08);
    ctx.fillText(copy, cx + i * (blur / steps) * 0.35, cy, node.width * 0.8);
  }
  ctx.fillStyle = rgba(ink, 0.95);
  ctx.fillText(copy, cx, cy, node.width * 0.8);
  ctx.fillStyle = rgba(accent, 0.3);
  ctx.fillRect(cx - 24, cy + size * 0.7, 48 + blur * 0.2, 2);
}

function drawGravityWarp(args: PaintArgs) {
  const { ctx, node, ink, accent, seed, lagged } = args;
  const count = Math.max(10, Math.min(20, node.schema.physicsAndMath.densityCount));
  const radius = node.schema.interactionRules.influenceRadius || 150;
  for (let i = 0; i < count; i++) {
    let x = hashNoise(i, 6, seed) * node.width;
    let y = hashNoise(i, 12, seed) * node.height;
    const dist = Math.hypot(x - lagged.x, y - lagged.y);
    if (dist < radius && dist > 0.01) {
      const pull = (1 - dist / radius) * (node.schema.physicsAndMath.amplitude || 25);
      x += ((lagged.x - x) / dist) * pull;
      y += ((lagged.y - y) / dist) * pull;
    }
    ctx.beginPath();
    ctx.arc(x, y, dist < radius ? 3.4 : 2.2, 0, Math.PI * 2);
    ctx.fillStyle = rgba(i % 4 === 0 ? accent : ink, dist < radius ? 0.85 : 0.45);
    ctx.fill();
  }
}

function drawGuillocheWave(args: PaintArgs) {
  const { ctx, node, t, ink, accent } = args;
  const cx = node.width / 2;
  const cy = node.height / 2;
  const speed = node.schema.physicsAndMath.speed || 0.4;
  const roses = Math.max(2, Math.min(4, node.schema.physicsAndMath.densityCount));
  ctx.lineWidth = 1;
  for (let r = 0; r < roses; r++) {
    const n = 3 + r;
    const a = Math.min(node.width, node.height) * (0.18 + r * 0.07);
    const steps = 96;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const th = (i / steps) * Math.PI * 2 + t * speed * 0.35 + r;
      const rad = a * Math.sin(n * th);
      const x = cx + Math.cos(th) * rad;
      const y = cy + Math.sin(th) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = rgba(r % 2 === 0 ? ink : accent, 0.45);
    ctx.stroke();
  }
}

function drawTopoContour(args: PaintArgs) {
  const { ctx, node, t, ink, accent, opts } = args;
  const words = Math.max(
    args.signals.wordCount,
    `${opts.hooks?.hook1 ?? ""} ${opts.hooks?.hook2 ?? ""}`.trim().split(/\s+/).filter(Boolean).length,
  );
  const count = Math.min(5000, Math.max(0, words * 180 + 400));
  const scale = 50 + (count / 5000) * 150;
  const breathe = Math.sin(t * 2) * 3;
  const rings = Math.max(3, Math.min(7, node.schema.physicsAndMath.densityCount));
  const cx = node.width / 2;
  const cy = node.height / 2;
  ctx.lineWidth = 1.2;
  for (let i = 1; i <= rings; i++) {
    const u = i / rings;
    const rx = ((scale + breathe) / 200) * node.width * 0.42 * u;
    const ry = ((scale + breathe * 0.6) / 200) * node.height * 0.36 * u;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(i === rings ? accent : ink, 0.25 + u * 0.4);
    ctx.stroke();
  }
}

function drawOrigamiUnfold(args: PaintArgs) {
  const { ctx, node, ink, accent } = args;
  const dur = 0.8;
  const local = oneShot(earliest(args.signals.paneAge, args.signals.dockAge), dur);
  const fold = Number.isFinite(local) ? (1 - easeOut01(local / dur)) * 90 : 0;
  const open = Math.cos((fold * Math.PI) / 180);
  const w = node.width * 0.28;
  const h = node.height * 0.42;
  const y = node.height * 0.29;
  const x0 = node.width * 0.22;
  ctx.fillStyle = rgba(ink, 0.82);
  ctx.fillRect(x0, y, w, h);
  ctx.save();
  ctx.translate(x0 + w, y);
  ctx.transform(open, 0, 0, 1, 0, 0);
  ctx.fillStyle = rgba(ink, 0.55 + open * 0.25);
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = rgba(accent, 0.55);
  ctx.lineWidth = 1.4;
  ctx.strokeRect(0, 0, w, h);
  ctx.restore();
  ctx.strokeStyle = rgba(accent, 0.4);
  ctx.strokeRect(x0, y, w, h);
}

function drawElasticThread(args: PaintArgs) {
  const { ctx, node, ink, accent } = args;
  const local = oneShot(earliest(args.clickAge, args.signals.dockAge), 2.4);
  const freq = node.schema.physicsAndMath.frequency || 3;
  const decay = 1.2;
  const amp = Number.isFinite(local) ? (Math.sin(local * freq * 2 * Math.PI) * 40) / Math.exp(local * decay) : 0;
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(node.width * 0.08, node.height * 0.55);
  ctx.quadraticCurveTo(node.width * 0.5, node.height * 0.5 + amp, node.width * 0.92, node.height * 0.42);
  ctx.strokeStyle = rgba(ink, 0.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(node.width * 0.1, node.height * 0.62);
  ctx.quadraticCurveTo(node.width * 0.48, node.height * 0.58 - amp * 0.4, node.width * 0.9, node.height * 0.5);
  ctx.strokeStyle = rgba(accent, 0.45);
  ctx.stroke();
}

function drawIsoExtrude(args: PaintArgs) {
  const { ctx, node, ink, accent } = args;
  const dur = 0.5;
  const local = oneShot(earliest(args.signals.paneAge, args.signals.dockAge), dur);
  const u = Number.isFinite(local) ? easeOut01(local / dur) : 1;
  const scale = (100 + u * 45) / 100;
  const cx = node.width / 2;
  const cy = node.height * 0.55;
  const s = Math.min(node.width, node.height) * 0.16 * scale;
  const iso = (x: number, y: number, z: number) => ({
    x: cx + (x - z) * s * 0.86,
    y: cy + (x + z) * s * 0.5 - y * s,
  });
  const pts = [
    iso(1, 0, 1),
    iso(-1, 0, 1),
    iso(-1, 0, -1),
    iso(1, 0, -1),
    iso(1, 1.2, 1),
    iso(-1, 1.2, 1),
    iso(-1, 1.2, -1),
    iso(1, 1.2, -1),
  ];
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = rgba(ink, 0.8);
  const edges: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  for (const [a, b] of edges) {
    ctx.beginPath();
    ctx.moveTo(pts[a]!.x, pts[a]!.y);
    ctx.lineTo(pts[b]!.x, pts[b]!.y);
    ctx.stroke();
  }
  ctx.strokeStyle = rgba(accent, 0.35);
  ctx.strokeRect(cx - s * 1.6, cy - s * 1.8, s * 3.2, s * 2.8);
}

function drawEscapement(args: PaintArgs) {
  const { ctx, node, t, ink, accent } = args;
  const teeth = Math.max(8, Math.min(16, node.schema.physicsAndMath.densityCount));
  const saving = oneShot(args.signals.saveAge, 1.6);
  const spin = Number.isFinite(saving) ? t * 3.2 : t * 0.35;
  const ang = spin;
  const cx = node.width / 2;
  const cy = node.height / 2;
  const r = Math.min(node.width, node.height) * 0.28;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = rgba(ink, 0.85);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.fillStyle = rgba(accent, 0.7);
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawVoronoiPulse(args: PaintArgs) {
  const { ctx, node, ink, accent, seed } = args;
  const local = oneShot(earliest(args.clickAge, args.signals.dockAge), 0.4);
  const pulse = Number.isFinite(local) ? Math.sin(local * 25) * 8 : 0;
  const count = Math.max(8, Math.min(14, Math.round(node.schema.physicsAndMath.densityCount) || 12));
  const sites: Pt[] = [];
  for (let i = 0; i < count; i++) {
    sites.push({
      x: hashNoise(i, 21, seed) * node.width,
      y: hashNoise(i, 34, seed) * node.height,
    });
  }
  const box: Pt[] = [
    { x: 0, y: 0 },
    { x: node.width, y: 0 },
    { x: node.width, y: node.height },
    { x: 0, y: node.height },
  ];
  ctx.lineJoin = "miter";
  ctx.lineWidth = 1;
  for (let i = 0; i < sites.length; i++) {
    const si = sites[i]!;
    let poly = box;
    for (let j = 0; j < sites.length; j++) {
      if (j === i) continue;
      const sj = sites[j]!;
      poly = clipHalfPlane(poly, (si.x + sj.x) / 2, (si.y + sj.y) / 2, sj.x - si.x, sj.y - si.y);
    }
    const sx = 1 + pulse / 100;
    const sy = 1 - pulse / 100;
    poly = poly.map((p) => ({ x: si.x + (p.x - si.x) * sx, y: si.y + (p.y - si.y) * sy }));
    if (poly.length < 3) continue;
    ctx.beginPath();
    ctx.moveTo(poly[0]!.x, poly[0]!.y);
    for (let k = 1; k < poly.length; k++) ctx.lineTo(poly[k]!.x, poly[k]!.y);
    ctx.closePath();
    ctx.fillStyle = rgba(i % 5 === 0 ? accent : ink, 0.08);
    ctx.fill();
    ctx.strokeStyle = rgba(ink, 0.55);
    ctx.stroke();
  }
}

function overlayCopyRgb(node: MotionNode, ink: [number, number, number]): [number, number, number] {
  if (node.schema.visual.background !== "transparent") return ink;
  return hexRgb(node.schema.visual.palette[2] ?? "#F7F5F1");
}

function drawViralHook(args: PaintArgs) {
  const { ctx, node, ink, accent, opts } = args;
  const dur = 0.35;
  const local = oneShot(earliest(args.clickAge, args.signals.paneAge, args.signals.dockAge), 0.9);
  const scale = hookOvershootScale(local, 220, dur, 28, 4.5, 2.8);
  const copy = opts.hooks?.hook1?.trim() ? opts.hooks.hook1 : "HOOK";
  const size = Math.max(20, Math.min(node.width * 0.14, node.height * 0.3));
  const fill = overlayCopyRgb(node, ink);
  ctx.save();
  ctx.translate(node.width / 2, node.height / 2);
  ctx.rotate((1 - Math.min(1, scale)) * -0.12);
  ctx.scale(scale, scale);
  ctx.font = `800 ${size}px "Unbounded", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = rgba(fill, 0.95);
  ctx.fillText(copy, 0, 0, node.width * 0.86);
  ctx.fillStyle = rgba(accent, 0.45);
  ctx.fillRect(-node.width * 0.16, size * 0.62, node.width * 0.32, 3);
  ctx.restore();
}

function drawLiquidGlass(args: PaintArgs) {
  const { ctx, node, t, ink, accent } = args;
  const paper: [number, number, number] = [247, 245, 241];
  const wobble = Math.sin(t * 3) * 20;
  const span = node.width + 220;
  const x = ((t * 140) % span) - 110 + wobble;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = rgba(ink, 1);
  ctx.fillRect(0, 0, node.width, node.height);
  ctx.translate(x, node.height * 0.5);
  ctx.rotate(-0.38);
  const g = ctx.createLinearGradient(0, 0, 160, 0);
  g.addColorStop(0, rgba(paper, 0));
  g.addColorStop(0.35, rgba(accent, 0.35));
  g.addColorStop(0.5, rgba(paper, 0.72));
  g.addColorStop(0.65, rgba(accent, 0.28));
  g.addColorStop(1, rgba(paper, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-20, -node.height, 160, node.height * 2);
  ctx.restore();
}

function drawHookSlam(args: PaintArgs) {
  const { ctx, node, ink, accent, opts } = args;
  const dur = 0.35;
  const local = oneShot(earliest(args.clickAge, args.signals.paneAge, args.signals.dockAge), 0.9);
  const scale = hookOvershootScale(local, 300, dur, 45, 4.2, 3.1);
  const copy = opts.hooks?.hook1?.trim() ? opts.hooks.hook1 : "HOOK";
  const size = Math.max(28, Math.min(node.width * 0.18, node.height * 0.38));
  const fill = overlayCopyRgb(node, ink);
  ctx.save();
  ctx.translate(node.width / 2, node.height / 2);
  ctx.rotate((1 - Math.min(1, scale)) * -0.16);
  ctx.scale(scale, scale);
  ctx.font = `800 ${size}px "Unbounded", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = rgba(fill, 0.96);
  ctx.fillText(copy, 0, 0, node.width * 0.9);
  ctx.restore();
  ctx.fillStyle = rgba(accent, 0.55);
  ctx.fillRect(node.width * 0.18, node.height * 0.72, node.width * 0.64, 4);
}

function drawTextMaskShift(args: PaintArgs) {
  const { ctx, node, t, ink, accent, opts } = args;
  const copy = opts.hooks?.hook1?.trim() ? opts.hooks.hook1 : "FILE";
  const size = Math.max(22, Math.min(node.width * 0.16, node.height * 0.34));
  const drift = Math.sin(t * 2.5) * 25;
  const x = ((t * 180) % (node.width + 120)) - 60 + drift;
  const g = ctx.createLinearGradient(x, 0, x + node.width * 0.55, node.height);
  g.addColorStop(0, rgba(ink, 0.95));
  g.addColorStop(0.5, rgba(accent, 0.9));
  g.addColorStop(1, rgba(ink, 0.7));
  ctx.font = `800 ${size}px "Unbounded", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = g;
  ctx.fillText(copy, node.width / 2, node.height / 2, node.width * 0.9);
}

function drawPillPulse(args: PaintArgs) {
  const { ctx, node, t, ink, accent } = args;
  const op = (75 + Math.sin(t * 3) * 25) / 100;
  const hot = args.signals.selected ? 1 : 0.85;
  const w = Math.min(node.width * 0.62, 280);
  const h = Math.min(node.height * 0.28, 48);
  const x = (node.width - w) / 2;
  const y = (node.height - h) / 2;
  ctx.fillStyle = rgba(ink, 0.82 * op * hot);
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, h / 2);
  else ctx.rect(x, y, w, h);
  ctx.fill();
  ctx.strokeStyle = rgba(accent, 0.55 + op * 0.35);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = rgba(accent, 0.95 * op);
  ctx.font = `700 ${Math.max(12, h * 0.38)}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("LIVE", node.width / 2, node.height / 2);
}

function drawOdometerRoll(args: PaintArgs) {
  const { ctx, node, t, ink, accent } = args;
  const speed = 80 + args.signals.typeVel * 12;
  const size = Math.max(22, Math.min(node.height * 0.28, 40));
  const tick = Math.floor(t * (1.6 + args.signals.typeVel * 0.08));
  const digits = [
    String(2026 + (tick % 3)),
    "FILE",
    String((4 + (tick % 12))).padStart(2, "0"),
    "ON",
    "TIME",
  ];
  const line = size * 1.35;
  const scroll = ((t * speed) % (line * digits.length) + line * digits.length) % (line * digits.length);
  ctx.save();
  ctx.beginPath();
  ctx.rect(node.width * 0.12, node.height * 0.28, node.width * 0.76, line);
  ctx.clip();
  ctx.font = `700 ${size}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cx = node.width / 2;
  const y0 = node.height * 0.28 + line / 2 - scroll;
  for (let i = 0; i < digits.length * 2; i++) {
    const label = digits[i % digits.length]!;
    ctx.fillStyle = rgba(i % 2 === 0 ? ink : accent, 0.92);
    ctx.fillText(label, cx, y0 + i * line);
  }
  ctx.restore();
  ctx.strokeStyle = rgba(ink, 0.35);
  ctx.strokeRect(node.width * 0.12, node.height * 0.28, node.width * 0.76, line);
}

function drawRedactHighlight(args: PaintArgs) {
  const { ctx, node, opts } = args;
  const age = earliest(args.clickAge, args.signals.paneAge, args.signals.dockAge);
  const u = Number.isFinite(age) ? Math.min(1, easeOut01(age / 0.4)) : 1;
  const copy = opts.hooks?.hook1?.trim() ? opts.hooks.hook1 : "FILE";
  const size = Math.max(18, Math.min(node.width * 0.12, node.height * 0.26));
  ctx.font = `700 ${size}px "Unbounded", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const w = Math.min(node.width * 0.82, ctx.measureText(copy).width + 28) * u;
  const h = Math.max(22, size * 1.15);
  ctx.fillStyle = REDACT;
  ctx.fillRect(node.width / 2 - w / 2, node.height / 2 - h / 2, w, h);
  ctx.fillStyle = "rgba(247,245,241,0.95)";
  ctx.save();
  ctx.beginPath();
  ctx.rect(node.width / 2 - w / 2, node.height / 2 - h / 2, w, h);
  ctx.clip();
  ctx.fillText(copy, node.width / 2, node.height / 2, node.width * 0.8);
  ctx.restore();
}

function paintCategory(args: PaintArgs) {
  const run = (fn: () => void) => {
    try {
      fn();
    } catch {
      drawFilaments(args);
    }
  };
  switch (args.node.schema.category) {
    case "SineWaveRibbon":
      return run(() => drawRibbon(args));
    case "GrainField":
      return run(() => drawGrainField(args));
    case "StampPulse":
      return run(() => drawStampPulse(args));
    case "RedactSweep":
      return run(() => drawRedactSweep(args));
    case "InkBleed":
      return run(() => drawInkBleed(args));
    case "LightLeak":
      return run(() => drawLightLeak(args));
    case "PerspectiveGrid":
      return run(() => drawPerspectiveGrid(args));
    case "NetworkGraph":
      return run(() => drawNetworkGraph(args));
    case "TypeKinetic":
      return run(() => drawTypeKinetic(args));
    case "DataTicker":
      return run(() => drawDataTicker(args));
    case "MetaballGoo":
      return run(() => drawMetaballGoo(args));
    case "VoronoiShatter":
      return run(() => drawVoronoiShatter(args));
    case "VaporDrift":
      return run(() => drawVaporDrift(args));
    case "StaticShiver":
      return run(() => drawStaticShiver(args));
    case "VignetteBreath":
      return run(() => drawVignetteBreath(args));
    case "HorizonShift":
      return run(() => drawHorizonShift(args));
    case "CarbonWeave":
      return run(() => drawCarbonWeave(args));
    case "HeatHaze":
      return run(() => drawHeatHaze(args));
    case "LedgerFracture":
      return run(() => drawLedgerFracture(args));
    case "ScanlineSweep":
      return run(() => drawScanlineSweep(args));
    case "MarginGlow":
      return run(() => drawMarginGlow(args));
    case "ResinGloss":
      return run(() => drawResinGloss(args));
    case "HoloFoil":
      return run(() => drawHoloFoil(args));
    case "VellumCrease":
      return run(() => drawVellumCrease(args));
    case "ElasticSpring":
      return run(() => drawElasticSpring(args));
    case "KineticSqueeze":
      return run(() => drawKineticSqueeze(args));
    case "CrosshairGrid":
      return run(() => drawCrosshairGrid(args));
    case "TypewriterCursor":
      return run(() => drawTypewriterCursor(args));
    case "LedgerStitch":
      return run(() => drawLedgerStitch(args));
    case "InkSplash":
      return run(() => drawInkSplash(args));
    case "GlitchBurst":
      return run(() => drawGlitchBurst(args));
    case "InkRipple":
      return run(() => drawInkRipple(args));
    case "FocusPull":
      return run(() => drawFocusPull(args));
    case "MagneticRipple":
      return run(() => drawMagneticRipple(args));
    case "StrobePulse":
      return run(() => drawStrobePulse(args));
    case "MomentumGlide":
      return run(() => drawMomentumGlide(args));
    case "PrismaticFringe":
      return run(() => drawPrismaticFringe(args));
    case "QuartzFluid":
      return run(() => drawQuartzFluid(args));
    case "AnodeDecay":
      return run(() => drawAnodeDecay(args));
    case "WaveformPulse":
      return run(() => drawWaveformPulse(args));
    case "EdgeSnap":
      return run(() => drawEdgeSnap(args));
    case "HeatBloom":
      return run(() => drawHeatBloom(args));
    case "FocalVignette":
      return run(() => drawFocalVignette(args));
    case "StencilPunch":
      return run(() => drawStencilPunch(args));
    case "VellumHysteresis":
      return run(() => drawVellumHysteresis(args));
    case "PhosphorBurn":
      return run(() => drawPhosphorBurn(args));
    case "EntanglePulse":
      return run(() => drawEntanglePulse(args));
    case "ResonanceBlur":
      return run(() => drawResonanceBlur(args));
    case "GravityWarp":
      return run(() => drawGravityWarp(args));
    case "GuillocheWave":
      return run(() => drawGuillocheWave(args));
    case "TopoContour":
      return run(() => drawTopoContour(args));
    case "OrigamiUnfold":
      return run(() => drawOrigamiUnfold(args));
    case "ElasticThread":
      return run(() => drawElasticThread(args));
    case "IsoExtrude":
      return run(() => drawIsoExtrude(args));
    case "Escapement":
      return run(() => drawEscapement(args));
    case "VoronoiPulse":
      return run(() => drawVoronoiPulse(args));
    case "ViralHook":
      return run(() => drawViralHook(args));
    case "LiquidGlass":
      return run(() => drawLiquidGlass(args));
    case "HookSlam":
      return run(() => drawHookSlam(args));
    case "TextMaskShift":
      return run(() => drawTextMaskShift(args));
    case "PillPulse":
      return run(() => drawPillPulse(args));
    case "OdometerRoll":
      return run(() => drawOdometerRoll(args));
    case "RedactHighlight":
      return run(() => drawRedactHighlight(args));
    case "WordPiston":
      return run(() => drawWordPiston(args));
    case "WordVortex":
      return run(() => drawWordVortex(args));
    case "LetterAssembly":
      return run(() => drawLetterAssembly(args));
    case "MisregisterGlitch":
      return run(() => drawMisregisterGlitch(args));
    case "MonumentBreathe":
      return run(() => drawMonumentBreathe(args));
    case "StrokeReveal":
      return run(() => drawStrokeReveal(args));
    case "TelemetryOverlay":
      return run(() => drawTelemetryOverlay(args));
    case "VanishingTunnel":
      return run(() => drawVanishingTunnel(args));
    case "IconWeather":
      return run(() => drawIconWeather(args));
    case "BufferGlitch":
      return run(() => drawBufferGlitch(args));
    case "StaticResolve":
      return run(() => drawStaticResolve(args));
    case "RedactionLift":
      return run(() => drawRedactionLift(args));
    case "KintsugiMend":
      return run(() => drawKintsugiMend(args));
    case "FerrofluidPull":
      return run(() => drawFerrofluidPull(args));
    case "SlowFax":
      return run(() => drawSlowFax(args));
    case "SundialShadow":
      return run(() => drawSundialShadow(args));
    case "HalftoneLamp":
      return run(() => drawHalftoneLamp(args));
    case "HourglassDrain":
      return run(() => drawHourglassDrain(args));
    case "MurmurationFlock":
      return run(() => drawMurmurationFlock(args));
    case "PendulumSwing":
      return run(() => drawPendulumSwing(args));
    case "TabEscape":
      return run(() => drawTabEscape(args));
    case "MossBloom":
      return run(() => drawMossBloom(args));
    case "InkPileup":
      return run(() => drawInkPileup(args));
    case "DrippingText":
      return run(() => {
        const slot = args.slot;
        if (!slot.drip) slot.drip = { progress: 0, particles: [], key: "", rng: Math.random };
        paintDrip(
          args.ctx,
          args.node,
          {
            t: args.t,
            freeze: args.freeze,
            reduced: args.opts.reduced,
            pointer: args.pointer ? localPointer(args.node, args.pointer) : null,
            clickAtMs: slot.clickAtMs,
            hooks: args.opts.hooks,
          },
          slot.drip,
        );
      });
    case "ParticleSystem":
    case "FlowField":
    default:
      return run(() => drawFilaments(args));
  }
}

function paintLocal(
  ctx: CanvasRenderingContext2D,
  node: MotionNode,
  assets: CraftAsset[],
  opts: MotionDrawOpts,
  freeze: boolean,
  slot: Slot,
) {
  if (node.schema.category === "CustomShaderDistortion") {
    paintWarp(ctx, node, assets, opts, freeze, slot);
    return;
  }

  if (freeze && slot.painted) return;

  ctx.save();
  ctx.globalAlpha *= node.schema.visual.opacity;
  ctx.globalCompositeOperation = node.schema.visual.blending === "additive" ? "lighter" : node.schema.visual.blending;
  if (node.schema.visual.background !== "transparent") {
    ctx.fillStyle = node.schema.visual.background;
    ctx.fillRect(0, 0, node.width, node.height);
  }

  const t = Number.isFinite(opts.atMs) ? opts.atMs / 1000 : 0;
  if (node.schema.category !== "DrippingText") {
    const widget = node.schema.widget ?? DEFAULT_MOTION_WIDGET;
    if (widget.texture !== "solid") drawWidgetTexture(ctx, node, t, widget);
  }

  if (freeze && node.capturedAssetId && drawCaptured(ctx, node, assets, opts.onImage)) {
    slot.painted = true;
    ctx.restore();
    return;
  }

  const schema = node.schema;
  const ink = hexRgb(schema.visual.palette[0] ?? "#1A1D21");
  const accent = hexRgb(schema.visual.palette[1] ?? "#2F5199");
  const seed = node.seed ?? 1;
  const pointer = freeze
    ? null
    : influencePointer(schema.interactionRules.triggerType, opts.pointer, opts.click);
  if (!freeze && opts.click) {
    const loc = localPointer(node, opts.click);
    const inside = loc.x >= -12 && loc.x <= node.width + 12 && loc.y >= -12 && loc.y <= node.height + 12;
    if (inside && (slot.clickX !== loc.x || slot.clickY !== loc.y || slot.clickAtMs == null)) {
      slot.clickAtMs = opts.atMs;
      slot.clickX = loc.x;
      slot.clickY = loc.y;
    }
  }
  const rawTarget = pointer ? localPointer(node, pointer) : null;
  const hoverMargin = Math.max(24, schema.interactionRules.influenceRadius || 0);
  const onNode =
    rawTarget != null &&
    rawTarget.x >= -hoverMargin &&
    rawTarget.x <= node.width + hoverMargin &&
    rawTarget.y >= -hoverMargin &&
    rawTarget.y <= node.height + hoverMargin;
  const target = onNode ? rawTarget! : { x: node.width / 2, y: node.height / 2 };
  if (slot.lagX == null || slot.lagY == null) {
    slot.lagX = target.x;
    slot.lagY = target.y;
  } else {
    slot.lagX += (target.x - slot.lagX) * 0.12;
    slot.lagY += (target.y - slot.lagY) * 0.12;
  }
  const origin =
    slot.clickX != null && slot.clickY != null
      ? { x: slot.clickX, y: slot.clickY }
      : { x: node.width / 2, y: node.height / 2 };
  const clickAge = slot.clickAtMs != null ? (opts.atMs - slot.clickAtMs) / 1000 : Number.POSITIVE_INFINITY;
  const signals = opts.signals ?? snapshotMotionSignals();
  const args: PaintArgs = {
    ctx,
    node,
    opts,
    freeze,
    particles: slot.particles,
    t,
    ink,
    accent,
    seed,
    pointer,
    clickAge,
    origin,
    lagged: { x: slot.lagX, y: slot.lagY },
    signals,
    slot,
  };

  try {
    paintCategory(args);
  } catch {
    drawFilaments(args);
  }

  const grain = schema.visual.grain;
  if (grain > 0) {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(26,29,33,${grain * 0.35})`;
    const step = 6;
    for (let y = 0; y < node.height; y += step) {
      for (let x = 0; x < node.width; x += step) {
        if (hashNoise(x, y, seed + (freeze ? 0 : Math.floor(t * 8))) > 1 - grain) {
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }
  if (!(freeze && node.capturedAssetId)) slot.painted = true;
  ctx.restore();
}

export function motionBitmap(node: MotionNode, assets: CraftAsset[], opts: MotionDrawOpts): HTMLCanvasElement {
  if (!canUseDomCanvas()) return dummyCanvas();
  const dpr = resolveDpr(node, opts.dpr);
  const slot = slotFor(node, dpr);
  if (!slot) return dummyCanvas();
  const ctx = slot.canvas.getContext("2d");
  if (!ctx) return slot.canvas;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  const preview = resolveMotionPreview(node, opts.reduced);
  const freeze = !opts.live || preview !== "live";
  if (freeze && slot.painted) return slot.canvas;
  if (!freeze && slot.painted && !opts.click) {
    const minMs = 1000 / Math.max(1, node.schema.performance.fpsCap);
    if (opts.atMs - slot.lastTickMs < minMs) return slot.canvas;
    slot.lastTickMs = opts.atMs;
  }
  if (node.schema.category !== "CustomShaderDistortion") {
    ctx.clearRect(0, 0, node.width, node.height);
  }
  paintLocal(ctx, node, assets, opts, freeze, slot);
  return slot.canvas;
}

export function drawMotionNode(
  ctx: CanvasRenderingContext2D,
  node: MotionNode,
  assets: CraftAsset[],
  opts: MotionDrawOpts,
) {
  if (!canUseDomCanvas()) return;
  const bitmap = motionBitmap(node, assets, opts);
  ctx.drawImage(bitmap, node.x, node.y, node.width, node.height);
}

export function captureMotionFrame(
  node: MotionNode,
  assets: CraftAsset[],
  opts?: Partial<MotionDrawOpts>,
): { dataUrl: string; width: number; height: number } {
  const width = Math.max(1, Math.round(node.width));
  const height = Math.max(1, Math.round(node.height));
  if (!canUseDomCanvas()) return { dataUrl: "", width, height };
  const scratch = document.createElement("canvas");
  scratch.width = width;
  scratch.height = height;
  const ctx = scratch.getContext("2d");
  if (!ctx) return { dataUrl: "", width, height };
  const live = REGISTRY.get(node.id);
  if (live?.painted) {
    ctx.drawImage(live.canvas, 0, 0, width, height);
    return { dataUrl: scratch.toDataURL("image/png"), width, height };
  }
  const slot: Slot = { canvas: scratch, key: "capture", particles: seedParticles(node), painted: false, lastTickMs: 0 };
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  paintLocal(
    ctx,
    node,
    assets,
    {
      live: true,
      reduced: false,
      atMs: typeof opts?.atMs === "number" && Number.isFinite(opts.atMs) ? opts.atMs : 0,
      pointer: opts?.pointer,
      click: opts?.click,
      hooks: opts?.hooks,
      dpr: 1,
    },
    false,
    slot,
  );
  return { dataUrl: scratch.toDataURL("image/png"), width, height };
}

export function remapMotionSchema(schema: MotionSchema, from: Record<string, string>, to: Record<string, string>): MotionSchema {
  const swap = (color: string) => {
    for (const [role, value] of Object.entries(from)) {
      if (color.toLowerCase() === value.toLowerCase()) return to[role] ?? color;
    }
    return color;
  };
  return {
    ...schema,
    visual: {
      ...schema.visual,
      background: swap(schema.visual.background),
      palette: schema.visual.palette.map(swap),
    },
  };
}
