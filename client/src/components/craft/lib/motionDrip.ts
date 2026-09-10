import { DEFAULT_DRIP_WIDGET, type MotionWidget } from "./motionWidget";
import type { MotionNode } from "./types";

export type DripParticle = {
  tx: number;
  ty: number;
  sx: number;
  sy: number;
  size: number;
  delay: number;
  duration: number;
  wobble: number;
  phase: number;
};

export type DripState = {
  progress: number;
  particles: DripParticle[];
  key: string;
  clickAt?: number;
  layer?: HTMLCanvasElement;
  rng: () => number;
};

type Point = { x: number; y: number };

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function ease(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}
function reseed(seed: number) {
  let n = seed >>> 0 || 42;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}

function widgetOf(node: MotionNode): MotionWidget {
  return node.schema.widget ?? DEFAULT_DRIP_WIDGET;
}

function wordOf(node: MotionNode, hook?: string) {
  const raw = node.text?.trim() || hook?.trim() || "DRIP";
  return raw.toUpperCase();
}

function makeLayer(w: number, h: number, dpr: number, existing?: HTMLCanvasElement) {
  if (typeof document === "undefined") return undefined;
  const canvas = existing && existing.width === Math.max(1, Math.round(w * dpr)) ? existing : document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  return canvas;
}

function maskPoints(node: MotionNode, widget: MotionWidget, word: string, rng: () => number): Point[] {
  const W = node.width;
  const H = node.height;
  const size = clamp(Math.min(widget.fontSize, H * 0.46), 80, 360);
  if (typeof document === "undefined") {
    const pts: Point[] = [];
    for (let y = H * 0.43; y < H * 0.79; y += 5) {
      for (let x = W * 0.2; x < W * 0.8; x += 5) pts.push({ x, y });
    }
    return pts;
  }
  const dpr = 1;
  const mask = document.createElement("canvas");
  mask.width = Math.max(1, Math.round(W * dpr));
  mask.height = Math.max(1, Math.round(H * dpr));
  const m = mask.getContext("2d");
  if (!m || typeof m.getImageData !== "function") {
    const pts: Point[] = [];
    for (let y = H * 0.43; y < H * 0.79; y += 5) {
      for (let x = W * 0.2; x < W * 0.8; x += 5) pts.push({ x, y });
    }
    return pts;
  }
  m.setTransform(dpr, 0, 0, dpr, 0, 0);
  m.clearRect(0, 0, W, H);
  m.fillStyle = "#fff";
  let fontSize = size;
  m.font = `${widget.fontStyle} ${widget.fontWeight} ${fontSize}px ${widget.fontFamily}`;
  const measured = m.measureText(word).width;
  if (measured > W * 0.78) fontSize *= (W * 0.78) / Math.max(1, measured);
  m.font = `${widget.fontStyle} ${widget.fontWeight} ${fontSize}px ${widget.fontFamily}`;
  m.textAlign = "center";
  m.textBaseline = "middle";
  m.fillText(word, W / 2, H * 0.61);
  const data = m.getImageData(0, 0, mask.width, mask.height).data;
  const step = clamp(Math.round(fontSize / 64), 4, 5);
  const pts: Point[] = [];
  const rand = (a: number, b: number) => a + rng() * (b - a);
  for (let y = H * 0.43; y < H * 0.79; y += step) {
    for (let x = W * 0.14; x < W * 0.86; x += step) {
      const i = (Math.floor(y * dpr) * mask.width + Math.floor(x * dpr)) * 4 + 3;
      if ((data[i] ?? 0) > 20) pts.push({ x: x + rand(-1.3, 1.3), y: y + rand(-1.3, 1.3) });
    }
  }
  return pts;
}

function buildParticles(node: MotionNode, widget: MotionWidget, word: string, rng: () => number): DripParticle[] {
  const W = node.width;
  const H = node.height;
  const points = maskPoints(node, widget, word, rng);
  const count = Math.min(Math.max(8, node.schema.physicsAndMath.densityCount), points.length || 1);
  const rand = (a: number, b: number) => a + rng() * (b - a);
  const particles: DripParticle[] = [];
  for (let i = 0; i < count; i++) {
    const target = points[Math.floor((i * points.length) / count)] ?? { x: W / 2, y: H / 2 };
    particles.push({
      tx: target.x,
      ty: target.y,
      sx: rand(W * 0.22, W * 0.78),
      sy: rand(18, 54),
      size: rand(3.2, 5.2),
      delay: rand(0.02, 0.54),
      duration: rand(0.2, 0.29),
      wobble: rand(0, Math.PI * 2),
      phase: rand(0, 1),
    });
  }
  return particles;
}

export function drawWidgetTexture(
  ctx: CanvasRenderingContext2D,
  node: MotionNode,
  t: number,
  widget: MotionWidget,
) {
  if (widget.texture === "solid") return;
  const W = node.width;
  const H = node.height;
  const ink = node.schema.visual.palette[2] ?? node.schema.visual.palette[1] ?? "#F7F5F1";
  ctx.save();
  ctx.globalAlpha *= 0.14;
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 1;
  if (widget.texture === "scanlines") {
    for (let y = 0; y < H; y += 5) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y + Math.sin(y * 0.03 + t) * 2);
      ctx.stroke();
    }
  } else if (widget.texture === "grid") {
    for (let x = 0; x < W; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  } else if (widget.texture === "dots") {
    for (let y = 14; y < H; y += 24) {
      for (let x = 14; x < W; x += 24) ctx.fillRect(x, y, 1.5, 1.5);
    }
  } else if (widget.texture === "waves") {
    for (let y = 0; y < H; y += 18) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 14) {
        const yy = y + Math.sin(x * 0.018 + t * 1.4 + y * 0.04) * 5;
        if (x) ctx.lineTo(x, yy);
        else ctx.moveTo(x, yy);
      }
      ctx.stroke();
    }
  } else if (widget.texture === "noise") {
    const amount = Math.max(1, Math.floor((W * H) / 240));
    for (let i = 0; i < amount; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
  } else if (widget.texture === "paper") {
    ctx.globalAlpha *= 0.57;
    for (let y = 0; y < H; y += 3) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y + Math.sin(y * 0.13) * 1.5);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawDropShape(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  shape: MotionWidget["shape"],
  rotation: number,
) {
  g.save();
  g.translate(x, y);
  g.rotate(rotation || 0);
  g.beginPath();
  if (shape === "round") g.ellipse(0, 0, rx, rx, 0, 0, Math.PI * 2);
  else if (shape === "oval") g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  else if (shape === "diamond") {
    g.moveTo(0, -ry);
    g.lineTo(rx, 0);
    g.lineTo(0, ry);
    g.lineTo(-rx, 0);
    g.closePath();
  } else if (shape === "triangle") {
    g.moveTo(0, -ry);
    g.lineTo(rx, ry * 0.82);
    g.lineTo(-rx, ry * 0.82);
    g.closePath();
  } else if (shape === "hexagon") {
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * rx;
      const py = Math.sin(a) * ry;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
  } else if (shape === "square") g.rect(-rx, -ry, rx * 2, ry * 2);
  else if (shape === "star") {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const r = i % 2 ? rx * 0.45 : rx * 1.2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
  } else if (shape === "ring" || shape === "bubble") {
    g.arc(0, 0, rx, 0, Math.PI * 2);
    if (shape === "ring") g.arc(0, 0, rx * 0.48, 0, Math.PI * 2, true);
  } else if (shape === "snowflake") {
    g.lineWidth = Math.max(1, rx * 0.22);
    g.lineCap = "round";
    g.strokeStyle = String(g.fillStyle);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI;
      const sx = Math.cos(a) * rx;
      const sy = Math.sin(a) * ry;
      g.moveTo(-sx, -sy);
      g.lineTo(sx, sy);
      g.moveTo(sx * 0.55, sy * 0.55);
      g.lineTo(sx * 0.8 + Math.cos(a + 0.55) * rx * 0.22, sy * 0.8 + Math.sin(a + 0.55) * ry * 0.22);
      g.moveTo(sx * 0.55, sy * 0.55);
      g.lineTo(sx * 0.8 + Math.cos(a - 0.55) * rx * 0.22, sy * 0.8 + Math.sin(a - 0.55) * ry * 0.22);
    }
    g.stroke();
    g.restore();
    return;
  } else if (shape === "callout") {
    if (typeof g.roundRect === "function") g.roundRect(-rx, -ry * 0.72, rx * 2, ry * 1.45, rx * 0.24);
    else g.rect(-rx, -ry * 0.72, rx * 2, ry * 1.45);
    g.moveTo(-rx * 0.35, ry * 0.7);
    g.lineTo(-rx * 0.6, ry * 1.25);
    g.lineTo(rx * 0.08, ry * 0.7);
    g.closePath();
  } else if (shape === "dollar" || shape === "pound" || shape === "euro") {
    g.font = `900 ${ry * 2.05}px Arial, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(shape === "dollar" ? "$" : shape === "pound" ? "£" : "€", 0, 0);
    g.restore();
    return;
  } else if (shape === "bead") {
    g.ellipse(0, ry * 0.18, rx * 0.86, ry * 0.78, 0, 0, Math.PI * 2);
    g.ellipse(-rx * 0.25, -ry * 0.25, rx * 0.22, ry * 0.18, 0, 0, Math.PI * 2);
  } else if (shape === "icicle") {
    g.moveTo(-rx, -ry * 0.25);
    g.quadraticCurveTo(0, -ry * 0.1, rx, -ry * 0.25);
    g.lineTo(rx * 0.55, ry * 0.7);
    g.lineTo(0, ry * 1.5);
    g.lineTo(-rx * 0.55, ry * 0.7);
    g.closePath();
  } else if (shape === "puddle") {
    g.ellipse(0, ry * 0.25, rx * 1.35, ry * 0.65, 0, 0, Math.PI * 2);
  } else if (shape === "splash") {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = i % 2 ? rx * 0.72 : rx * 1.34;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
  } else {
    g.moveTo(0, -ry * 1.45);
    g.bezierCurveTo(rx * 1.1, -ry * 0.35, rx * 0.95, ry * 0.65, 0, ry);
    g.bezierCurveTo(-rx * 0.95, ry * 0.65, -rx * 1.1, -ry * 0.35, 0, -ry * 1.45);
    g.closePath();
  }
  g.fill();
  g.restore();
}

function positionOf(
  p: DripParticle,
  progress: number,
  time: number,
  widget: MotionWidget,
  pointer: Point | null,
  radius: number,
  strength: number,
): { x: number; y: number; local: number } {
  const local = clamp((progress - p.delay) / p.duration, 0, 1);
  const t = ease(local);
  if (local <= 0) return { x: p.sx, y: p.sy, local };
  let x = lerp(p.sx, p.tx, t);
  let y = lerp(p.sy, p.ty, t);
  if (local < 1) {
    const arc = Math.sin(local * Math.PI) * (p.tx - p.sx) * -0.08;
    x += arc * widget.drift;
    const phase = time * (1.2 + widget.turbulence) + p.wobble;
    if (widget.motion === "wave") {
      x += Math.sin(phase + p.ty * 0.02) * 22 * widget.drift;
      y += Math.cos(phase * 0.7) * 7;
    }
    if (widget.motion === "swirl") {
      x += Math.cos(phase) * 18 * (1 - local);
      y += Math.sin(phase) * 12 * (1 - local);
    }
    if (widget.motion === "float") {
      x += Math.sin(phase) * 14;
      y += Math.cos(phase * 0.7) * 14;
    }
    if (widget.motion === "bounce") y += Math.abs(Math.sin(local * Math.PI * 2.2)) * -28 * (1 - local);
    if (widget.motion === "pendulum") {
      x += Math.sin(phase * 1.5 + local * 3) * 32 * (1 - local);
      y += Math.abs(Math.cos(phase + local * 2)) * 14 * (1 - local);
    }
    if (widget.motion === "rain") {
      y += local * local * 105 * widget.gravity;
      x += Math.sin(phase * 0.65) * 7 * widget.drift;
    }
    if (widget.motion === "orbit") {
      x += Math.cos(phase + local * 4) * 28 * (1 - local);
      y += Math.sin(phase + local * 4) * 20 * (1 - local);
    }
    if (widget.motion === "jitter") {
      x += Math.sin(phase * 8.5) * 10 * widget.turbulence;
      y += Math.cos(phase * 7.2) * 10 * widget.turbulence;
    }
    if (widget.motion === "cascade") {
      y += local * local * 78 * widget.gravity;
      x += Math.sin(phase + local * 8) * 18 * (1 - local) * widget.drift;
    }
    if (widget.motion === "spiral") {
      const spiral = (1 - local) * (1 - local);
      x += Math.cos(phase * 0.8 + local * 7) * 34 * spiral;
      y += Math.sin(phase * 0.8 + local * 7) * 26 * spiral;
    }
    if (widget.motion === "gravity" || widget.motion === "blob" || widget.motion === "scroll") {
      y += local * local * 42 * widget.gravity;
    }
    if (pointer && widget.interaction !== "none") {
      const dx = x - pointer.x;
      const dy = y - pointer.y;
      const distance = Math.hypot(dx, dy);
      if (distance < radius) {
        const force = (1 - distance / radius) ** 2 * (widget.interaction === "stretch" ? 34 : 22) * Math.max(0.2, strength);
        if (widget.interaction === "attract") {
          x -= (dx / (distance || 1)) * force;
          y -= (dy / (distance || 1)) * force;
        }
        if (widget.interaction === "repel") {
          x += (dx / (distance || 1)) * force;
          y += (dy / (distance || 1)) * force;
        }
        if (widget.interaction === "stretch") {
          x += dx * 0.18;
          y += dy * 0.18;
        }
        if (widget.interaction === "ripple") {
          x += Math.sin(distance * 0.12 - time * 5) * force * 0.45;
          y += Math.cos(distance * 0.12 - time * 5) * force * 0.45;
        }
      }
    }
    return { x, y, local };
  }
  return { x: p.tx + Math.sin(time * 0.8 + p.wobble) * 0.35, y: p.ty + Math.sin(time * 1.1 + p.wobble) * 0.35, local };
}

export function paintDrip(
  ctx: CanvasRenderingContext2D,
  node: MotionNode,
  args: {
    t: number;
    freeze: boolean;
    reduced: boolean;
    pointer: Point | null;
    clickAtMs?: number;
    hooks?: { hook1?: string };
  },
  state: DripState,
) {
  const widget = widgetOf(node);
  const word = wordOf(node, args.hooks?.hook1);
  const key = `${word}|${widget.fontFamily}|${widget.fontSize}|${widget.shape}|${node.schema.physicsAndMath.densityCount}|${node.seed ?? 1}|${Math.round(node.width)}x${Math.round(node.height)}`;
  if (!state.rng || state.key !== key) {
    state.rng = reseed(node.seed ?? 42);
    state.particles = buildParticles(node, widget, word, state.rng);
    state.key = key;
    state.progress = args.reduced ? 1 : 0;
  }
  if (args.clickAtMs != null && state.clickAt !== args.clickAtMs) {
    state.clickAt = args.clickAtMs;
    state.rng = reseed((node.seed ?? 42) + args.clickAtMs);
    state.particles = buildParticles(node, widget, word, state.rng);
    state.progress = args.reduced ? 1 : 0;
  }
  if (args.reduced || args.freeze) state.progress = 1;
  else if (state.progress < 1) {
    const speed = node.schema.physicsAndMath.speed || 1;
    state.progress = Math.min(1, state.progress + 0.00095 * 1.6 * speed);
  }

  const W = node.width;
  const H = node.height;
  drawWidgetTexture(ctx, node, args.t, widget);

  const palette = node.schema.visual.palette;
  const layer = makeLayer(W, H, 1, state.layer);
  const g = layer?.getContext("2d") ?? ctx;
  if (layer) {
    state.layer = layer;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, layer.width, layer.height);
  }
  const radius = node.schema.interactionRules.influenceRadius || 120;
  const strength = node.schema.interactionRules.strength || 1;
  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i]!;
    const q = positionOf(p, state.progress, args.t, widget, args.pointer, radius, strength);
    if (q.local <= 0) continue;
    const r = p.size * (q.local < 1 ? 1 : 1.1 + widget.viscosity * 0.25);
    const rotation =
      q.local < 1 ? Math.atan2(q.y - p.sy, q.x - p.sx) + Math.PI / 2 : Math.sin(args.t + p.wobble) * (0.06 + widget.viscosity * 0.12);
    g.fillStyle = widget.multi ? palette[i % palette.length] ?? palette[0] ?? "#c8f04a" : palette[0] ?? "#c8f04a";
    const rx = q.local < 1 ? r : r;
    const ry = q.local < 1 ? r * 1.45 : r * (widget.motion === "blob" ? 1.15 + Math.sin(args.t * 2 + p.phase) * 0.12 : 1.15);
    drawDropShape(g, q.x, q.y, rx, ry, widget.shape, rotation);
  }
  if (layer) {
    ctx.save();
    if (typeof ctx.filter === "string") {
      ctx.filter = "blur(1.45px) contrast(8)";
      ctx.globalAlpha *= 0.72;
      ctx.drawImage(layer, 0, 0, W, H);
      ctx.filter = "blur(0.45px)";
      ctx.globalAlpha = 0.9;
      ctx.drawImage(layer, 0, 0, W, H);
      ctx.filter = "none";
    }
    ctx.globalAlpha = 0.62;
    ctx.drawImage(layer, 0, 0, W, H);
    ctx.restore();
  }
}
