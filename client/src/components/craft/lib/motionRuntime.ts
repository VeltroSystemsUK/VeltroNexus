import {
  LEDGER_CURRENT,
  hashMotionSchema,
  setMotionSessionWarning,
  validateMotionSchema,
  type MotionSchema,
} from "./motionSchema";
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
  cap = 2,
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
  if (!slot.painted) {
    ctx.fillStyle = node.schema.visual.background;
    ctx.fillRect(0, 0, node.width, node.height);
    slot.painted = true;
  }

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
            if (!mod.drawWarp(canvas, node, opts.atMs)) {
              setMotionSessionWarning(node.id, "After-hours Warp failed. Frozen on last frame.");
            }
          } catch {
            setMotionSessionWarning(node.id, "After-hours Warp failed. Frozen on last frame.");
          }
        })
        .catch(() => {
          setMotionSessionWarning(node.id, "After-hours Warp failed. Frozen on last frame.");
        });
    })
    .catch(() => {
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
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]!;
    ctx.strokeStyle = rgba(i % 5 === 0 ? accent : ink, schema.category === "ParticleSystem" ? 0.35 : 0.22);
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
  const evo = t * node.schema.physicsAndMath.speed * 8;
  const cols = 7;
  const rows = 5;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const n = hashNoise(c + evo * 0.04, r + evo * 0.02, seed);
      const x = ((c + 0.5) / cols) * node.width + Math.sin(evo * 0.2 + r) * 10;
      const y = ((r + 0.5) / rows) * node.height + Math.cos(evo * 0.15 + c) * 8;
      const rx = node.width * (0.1 + n * 0.08);
      const ry = node.height * (0.08 + n * 0.06);
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, n, 0, Math.PI * 2);
      ctx.fillStyle = rgba(c % 2 === 0 ? ink : accent, 0.08 + n * 0.1);
      ctx.fill();
    }
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
  const opacity = (50 + Math.sin(t * 2) * 10) / 100;
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
  const { ctx, node, t, ink, accent, seed, origin } = args;
  const local = oneShot(args.clickAge, 1.5);
  const depth = Number.isFinite(local) ? easeOut01(local / 1.5) : 0;
  if (depth <= 0.01) return;
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
  const cycle = 3;
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
  const op = ((40 + Math.sin(t * 3) * 25) / 100) * hot;
  const inset = Math.max(6, Math.min(node.width, node.height) * 0.04);
  ctx.strokeStyle = rgba(accent, op);
  ctx.lineWidth = Math.max(3, inset * 0.7);
  ctx.strokeRect(inset, inset, node.width - inset * 2, node.height - inset * 2);
}

function drawResinGloss(args: PaintArgs) {
  const { ctx, node, t } = args;
  const paper: [number, number, number] = [247, 245, 241];
  const span = node.width + 400;
  const x = ((t * node.schema.physicsAndMath.speed * 80) % span) - 200;
  ctx.save();
  ctx.translate(x, 0);
  ctx.rotate(-0.4);
  const g = ctx.createLinearGradient(0, 0, 90, 0);
  g.addColorStop(0, rgba(paper, 0));
  g.addColorStop(0.5, rgba(paper, 0.45));
  g.addColorStop(1, rgba(paper, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-40, -node.height, 90, node.height * 3);
  ctx.restore();
}

function drawHoloFoil(args: PaintArgs) {
  const { ctx, node, t, pointer } = args;
  const hue = ((t * 60) % 360 + 360) % 360;
  const hot = Boolean(pointer);
  const sat = hot ? 42 : 22;
  const cx = node.width / 2;
  const cy = node.height / 2;
  const rw = Math.min(node.width, node.height) * 0.28;
  const rh = rw * 0.62;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((hue * Math.PI) / 180 * 0.15);
  const g = ctx.createLinearGradient(-rw, 0, rw, 0);
  g.addColorStop(0, `hsla(${hue}, ${sat}%, 38%, 0.85)`);
  g.addColorStop(0.45, `hsla(${(hue + 40) % 360}, ${sat}%, 52%, 0.9)`);
  g.addColorStop(1, `hsla(${(hue + 80) % 360}, ${sat}%, 40%, 0.8)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.rect(-rw, -rh, rw * 2, rh * 2);
  ctx.fill();
  ctx.strokeStyle = `hsla(${hue}, ${sat}%, 70%, ${hot ? 0.85 : 0.45})`;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawVellumCrease(args: PaintArgs) {
  const { ctx, node, t, ink } = args;
  const op = (50 + Math.sin(t * 1.5) * 15) / 100;
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
  const on = live && Math.floor(t * 2) % 2 === 0;
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
  if (!Number.isFinite(age)) return;
  const birth = easeOut01(1 - age / 0.8);
  const count = Math.max(12, Math.min(36, node.schema.physicsAndMath.densityCount));
  for (let i = 0; i < count; i++) {
    const ang = hashNoise(i, 1, seed) * Math.PI * 2;
    const dist = (0.15 + hashNoise(i, 2, seed) * 0.55) * Math.min(node.width, node.height) * (1 - birth * 0.2);
    const r = (2 + hashNoise(i, 3, seed) * 7) * birth;
    ctx.beginPath();
    ctx.arc(origin.x + Math.cos(ang) * dist * (0.35 + age), origin.y + Math.sin(ang) * dist * (0.35 + age), r, 0, Math.PI * 2);
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
  if (!Number.isFinite(age)) return;
  const amount = (1 - easeOut01(age)) * 30;
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 3; i++) {
    const r = (0.08 + i * 0.1) * Math.min(node.width, node.height) + (30 - amount) * (4 + i * 3);
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(i === 1 ? accent : ink, 0.12 + (1 - age) * 0.35);
    ctx.stroke();
  }
}

function drawFocusPull(args: PaintArgs) {
  const { ctx, node, ink } = args;
  const local = oneShot(args.signals.dialogAge, 0.4);
  const radius = Number.isFinite(local) ? (1 - easeOut01(local / 0.4)) * 25 : 0;
  if (radius <= 0.2) return;
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
  if (!Number.isFinite(age)) return;
  const dur = 0.5;
  const u = age < dur ? easeOut01(age / dur) : 1;
  const scale = 50 + u * 100;
  const r = (scale / 150) * Math.min(node.width, node.height) * 0.42;
  const fade = age < dur ? 1 - u * 0.4 : Math.max(0, 1 - (age - dur) * 2);
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

function drawQuartzFluid(args: PaintArgs) {
  const { ctx, node, t, ink, accent, pointer, lagged } = args;
  const amount = (10 + Math.sin(t * 4) * 3) * (pointer ? 1.35 : 0.75);
  const cx = lagged.x;
  const cy = lagged.y;
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 5; i++) {
    const r = (0.12 + i * 0.08) * Math.min(node.width, node.height) + Math.sin(t * 4 + i) * amount;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.62, t * 0.2 + i, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(i % 2 === 0 ? accent : ink, 0.14 + (pointer ? 0.12 : 0));
    ctx.stroke();
  }
}

function drawAnodeDecay(args: PaintArgs) {
  const { ctx, node, ink, accent } = args;
  const local = oneShot(args.signals.closeAge, 0.55);
  const dim = Number.isFinite(local) ? (local < 0.4 ? 1 - local / 0.4 : 0) : 1;
  ctx.fillStyle = rgba(ink, 0.55 + (1 - dim) * 0.4);
  ctx.fillRect(0, 0, node.width, node.height);
  if (dim > 0.02) {
    ctx.fillStyle = rgba(accent, 0.12 * dim);
    const y = node.height * (0.2 + (1 - dim) * 0.6);
    ctx.fillRect(0, y, node.width, Math.max(2, 6 * dim));
  }
  ctx.fillStyle = rgba(ink, 1 - dim);
  ctx.fillRect(0, 0, node.width, node.height);
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
  ctx.font = `800 ${size}px "Unbounded", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = rgba(ink, 0.28);
  ctx.fillText(copy, node.width / 2 + dist * 0.45, node.height / 2 + dist * 0.55, node.width * 0.86);
  ctx.fillStyle = rgba(accent, 0.15);
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
  const trim = ((t * 25 + Math.sin(t * 4) * 15) % 360) / 360;
  const roses = Math.max(2, Math.min(4, node.schema.physicsAndMath.densityCount));
  ctx.lineWidth = 1;
  for (let r = 0; r < roses; r++) {
    const n = 3 + r;
    const a = Math.min(node.width, node.height) * (0.18 + r * 0.07);
    const steps = Math.max(24, Math.round(96 * (0.35 + trim * 0.65)));
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const th = (i / 96) * Math.PI * 2 + t * 0.15 + r;
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
  const ang = Number.isFinite(saving) ? ((t * 180) % 360) * (Math.PI / 180) : 0;
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

function drawViralHook(args: PaintArgs) {
  const { ctx, node, ink, accent, opts } = args;
  const dur = 0.35;
  const local = oneShot(earliest(args.clickAge, args.signals.paneAge, args.signals.dockAge), 0.9);
  let scale = 1;
  if (Number.isFinite(local) && local < dur) {
    const u = easeOut01(local / dur);
    const eased = 220 - 120 * u;
    const spring = (Math.sin(local * 4.5 * Math.PI * 2) * 28) / Math.exp(local * 2.8);
    scale = Math.max(0.02, (220 - (eased + spring)) / 100);
  }
  const copy = opts.hooks?.hook1?.trim() ? opts.hooks.hook1 : "HOOK";
  const size = Math.max(20, Math.min(node.width * 0.14, node.height * 0.3));
  ctx.save();
  ctx.translate(node.width / 2, node.height / 2);
  ctx.rotate((1 - Math.min(1, scale)) * -0.12);
  ctx.scale(scale, scale);
  ctx.font = `800 ${size}px "Unbounded", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = rgba(ink, 0.95);
  ctx.fillText(copy, 0, 0, node.width * 0.86);
  ctx.fillStyle = rgba(accent, 0.45);
  ctx.fillRect(-node.width * 0.16, size * 0.62, node.width * 0.32, 3);
  ctx.restore();
}

function drawLiquidGlass(args: PaintArgs) {
  const { ctx, node, t } = args;
  const paper: [number, number, number] = [247, 245, 241];
  const wobble = Math.sin(t * 3) * 20;
  const x = ((t * 120) % (node.width + 160)) - 80 + wobble;
  ctx.save();
  ctx.translate(x, node.height * 0.5);
  ctx.rotate(-0.35);
  const g = ctx.createLinearGradient(0, -node.height, 70, node.height);
  g.addColorStop(0, rgba(paper, 0));
  g.addColorStop(0.45, rgba(paper, 0.38));
  g.addColorStop(0.55, "rgba(47,81,153,0.18)");
  g.addColorStop(1, rgba(paper, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-40, -node.height, 90, node.height * 2);
  ctx.restore();
}

function drawHookSlam(args: PaintArgs) {
  const { ctx, node, ink, accent, opts } = args;
  const dur = 0.35;
  const local = oneShot(earliest(args.clickAge, args.signals.paneAge, args.signals.dockAge), 0.9);
  let scale = 1;
  if (Number.isFinite(local) && local < dur) {
    const u = easeOut01(local / dur);
    const eased = 300 - 200 * u;
    const spring = (Math.sin(local * 4.2 * Math.PI * 2) * 45) / Math.exp(local * 3.1);
    scale = Math.max(0.02, (300 - (eased + spring)) / 100);
  }
  const copy = opts.hooks?.hook1?.trim() ? opts.hooks.hook1 : "HOOK";
  const size = Math.max(28, Math.min(node.width * 0.18, node.height * 0.38));
  ctx.save();
  ctx.translate(node.width / 2, node.height / 2);
  ctx.rotate((1 - Math.min(1, scale)) * -0.16);
  ctx.scale(scale, scale);
  ctx.font = `800 ${size}px "Unbounded", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = rgba(ink, 0.96);
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
  const digits = ["2026", "FILE", "04", "ON", "TIME"];
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
  const age = earliest(args.clickAge, args.signals.paneAge);
  const u = Number.isFinite(age) ? Math.min(1, easeOut01(age / 0.4)) : 0;
  if (u <= 0.01) return;
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
  ctx.fillStyle = node.schema.visual.background;
  ctx.fillRect(0, 0, node.width, node.height);

  if (freeze && node.capturedAssetId && drawCaptured(ctx, node, assets, opts.onImage)) {
    slot.painted = true;
    ctx.restore();
    return;
  }

  const t = Number.isFinite(opts.atMs) ? opts.atMs / 1000 : 0;
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
  const target = pointer ? localPointer(node, pointer) : { x: node.width / 2, y: node.height / 2 };
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
  if (!freeze && slot.painted) {
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
