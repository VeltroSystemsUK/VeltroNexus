import {
  LEDGER_CURRENT,
  hashMotionSchema,
  setMotionSessionWarning,
  validateMotionSchema,
  type MotionSchema,
} from "./motionSchema";
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
};

export type MotionHostView = {
  panX: number;
  panY: number;
  zoom: number;
  hostW: number;
  hostH: number;
};

type Particle = { x: number; y: number; vx: number; vy: number };

type Slot = { canvas: HTMLCanvasElement; key: string; particles: Particle[]; painted: boolean; lastTickMs: number };

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
  const { ctx, node, t, ink } = args;
  const period = 1 / Math.max(0.12, node.schema.physicsAndMath.speed);
  const phase = ((t % period) + period) % period;
  const slam = Math.min(1, phase / 0.2);
  const eased = 1 - (1 - slam) ** 3;
  const scale = 1.18 - 0.18 * eased;
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
  if (pointer && node.schema.interactionRules.triggerType === "click") {
    const loc = localPointer(node, pointer);
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
  const args: PaintArgs = { ctx, node, opts, freeze, particles: slot.particles, t, ink, accent, seed, pointer };

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
