import { drawMotionNode } from "./motion";
import { snapshotMotionSignals } from "./motionSignals";
import { ALL_SHAPE_VARIANTS, type AnimationSpec, type CraftAsset, type CraftNode, type CraftPage, type Handle, type ImageNode, type ShapeVariant } from "./types";
import { containDest, handleWorldPoint, type Guide, type Rect } from "./geometry";
import { displayText, fitFontSize, wrapText } from "./text";

export interface AnimTransform {
  opacity: number;
  scaleX: number;
  scaleY: number;
  dx: number;
  dy: number;
  rotationDeg: number;
}

const IDENTITY: AnimTransform = { opacity: 1, scaleX: 1, scaleY: 1, dx: 0, dy: 0, rotationDeg: 0 };

const imageCache = new Map<string, HTMLImageElement>();

export function getImageEl(src: string, onLoad?: () => void): HTMLImageElement | null {
  if (!src) return null;
  const cached = imageCache.get(src);
  if (cached) return cached;
  if (typeof Image === "undefined") return null;
  const img = new Image();
  img.onload = () => {
    imageCache.set(src, img);
    onLoad?.();
  };
  img.src = src;
  return null;
}

export function evaluateAnimation(spec: AnimationSpec | undefined, atMs: number): AnimTransform {
  if (!spec || spec.type === "none" || !Number.isFinite(atMs)) return IDENTITY;

  if (spec.type === "pulse" || spec.type === "bounce" || spec.type === "spin") {
    const period = Math.max(1, spec.duration);
    const phase = (((atMs - spec.delay) % period) + period) % period;
    const p = phase / period;
    const wave = Math.sin(p * Math.PI * 2);
    if (spec.type === "pulse") return { ...IDENTITY, scaleX: 1 + wave * 0.08, scaleY: 1 + wave * 0.08 };
    if (spec.type === "bounce") return { ...IDENTITY, dy: -Math.abs(wave) * 10 };
    return { ...IDENTITY, rotationDeg: p * 360 };
  }

  const local = atMs - spec.delay;
  if (local <= 0) {
    if (spec.type === "fadeIn") return { ...IDENTITY, opacity: 0 };
    if (spec.type === "slideIn") return { ...IDENTITY, dx: -60 };
    if (spec.type === "pop") return { ...IDENTITY, scaleX: 0.01, scaleY: 0.01 };
    if (spec.type === "hook-turn") return { ...IDENTITY, opacity: 0, dx: -24 };
    if (spec.type === "stamp-down") return { ...IDENTITY, scaleX: 1.18, scaleY: 1.18 };
    return IDENTITY;
  }
  if (local >= spec.duration) return IDENTITY;
  const eased = 1 - Math.pow(1 - local / Math.max(1, spec.duration), 3);
  if (spec.type === "fadeIn") return { ...IDENTITY, opacity: eased };
  if (spec.type === "slideIn") return { ...IDENTITY, dx: -60 * (1 - eased) };
  if (spec.type === "pop") {
    const scale = 0.01 + 0.99 * eased;
    return { ...IDENTITY, scaleX: scale, scaleY: scale };
  }
  if (spec.type === "hook-turn") return { ...IDENTITY, opacity: eased, dx: -24 * (1 - eased) };
  if (spec.type === "stamp-down") {
    const scale = 1.18 - 0.18 * eased;
    return { ...IDENTITY, scaleX: scale, scaleY: scale };
  }
  return IDENTITY;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function drawShapePath(ctx: CanvasRenderingContext2D, variant: ShapeVariant, x: number, y: number, w: number, h: number, radius: number) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.beginPath();
  if (variant === "rect") {
    ctx.rect(x, y, w, h);
    return;
  }
  if (variant === "rounded-rect") {
    roundRectPath(ctx, x, y, w, h, radius);
    return;
  }
  if (variant === "ellipse") {
    ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
    return;
  }
  if (variant === "line") {
    ctx.moveTo(x, cy);
    ctx.lineTo(x + w, cy);
    return;
  }
  if (variant === "triangle") {
    ctx.moveTo(cx, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    return;
  }
  if (variant === "diamond") {
    ctx.moveTo(cx, y);
    ctx.lineTo(x + w, cy);
    ctx.lineTo(cx, y + h);
    ctx.lineTo(x, cy);
    ctx.closePath();
    return;
  }
  if (variant === "arrow") {
    ctx.moveTo(x, cy - h * 0.18);
    ctx.lineTo(x + w * 0.58, cy - h * 0.18);
    ctx.lineTo(x + w * 0.58, y);
    ctx.lineTo(x + w, cy);
    ctx.lineTo(x + w * 0.58, y + h);
    ctx.lineTo(x + w * 0.58, cy + h * 0.18);
    ctx.lineTo(x, cy + h * 0.18);
    ctx.closePath();
    return;
  }
  if (variant === "hexagon" || variant === "pentagon" || variant === "octagon") {
    const sides = variant === "hexagon" ? 6 : variant === "pentagon" ? 5 : 8;
    const r = Math.min(w, h) / 2;
    const start = variant === "hexagon" ? -Math.PI / 6 : -Math.PI / 2;
    for (let i = 0; i < sides; i++) {
      const a = start + (i * 2 * Math.PI) / sides;
      const px = cx + r * Math.cos(a);
      const py = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    return;
  }
  if (variant === "chevron") {
    ctx.moveTo(x, y);
    ctx.lineTo(x + w * 0.7, y);
    ctx.lineTo(x + w, cy);
    ctx.lineTo(x + w * 0.7, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + w * 0.3, cy);
    ctx.closePath();
    return;
  }
  if (variant === "heart") {
    const s = Math.min(w, h) * 0.5;
    ctx.moveTo(cx, cy + s * 0.8);
    ctx.bezierCurveTo(cx - s * 1.2, cy + s * 0.2, cx - s * 1.4, cy - s * 0.8, cx - s * 0.7, cy - s);
    ctx.bezierCurveTo(cx - s * 0.2, cy - s * 1.1, cx, cy - s * 0.6, cx, cy - s * 0.3);
    ctx.bezierCurveTo(cx, cy - s * 0.6, cx + s * 0.2, cy - s * 1.1, cx + s * 0.7, cy - s);
    ctx.bezierCurveTo(cx + s * 1.4, cy - s * 0.8, cx + s * 1.2, cy + s * 0.2, cx, cy + s * 0.8);
    ctx.closePath();
    return;
  }
  if (variant === "speech") {
    const r = Math.min(w, h) * 0.12;
    const tail = h * 0.22;
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - tail - r);
    ctx.quadraticCurveTo(x + w, y + h - tail, x + w - r, y + h - tail);
    ctx.lineTo(x + w * 0.42, y + h - tail);
    ctx.lineTo(x + w * 0.28, y + h);
    ctx.lineTo(x + w * 0.34, y + h - tail);
    ctx.lineTo(x + r, y + h - tail);
    ctx.quadraticCurveTo(x, y + h - tail, x, y + h - tail - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    return;
  }
  if (variant === "cloud") {
    ctx.moveTo(x + w * 0.2, y + h);
    ctx.arcTo(x, y + h, x, y + h * 0.55, h * 0.28);
    ctx.arcTo(x, y + h * 0.22, x + w * 0.28, y + h * 0.22, h * 0.3);
    ctx.arcTo(x + w * 0.32, y, x + w * 0.62, y, h * 0.34);
    ctx.arcTo(x + w, y, x + w, y + h * 0.42, h * 0.32);
    ctx.arcTo(x + w, y + h, x + w * 0.72, y + h, h * 0.28);
    ctx.closePath();
    return;
  }
  if (variant === "banner") {
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h * 0.78);
    ctx.lineTo(cx, y + h);
    ctx.lineTo(x, y + h * 0.78);
    ctx.closePath();
    return;
  }
  if (variant === "cross") {
    const t = w * 0.32;
    const t2 = h * 0.32;
    ctx.moveTo(cx - t / 2, y);
    ctx.lineTo(cx + t / 2, y);
    ctx.lineTo(cx + t / 2, cy - t2 / 2);
    ctx.lineTo(x + w, cy - t2 / 2);
    ctx.lineTo(x + w, cy + t2 / 2);
    ctx.lineTo(cx + t / 2, cy + t2 / 2);
    ctx.lineTo(cx + t / 2, y + h);
    ctx.lineTo(cx - t / 2, y + h);
    ctx.lineTo(cx - t / 2, cy + t2 / 2);
    ctx.lineTo(x, cy + t2 / 2);
    ctx.lineTo(x, cy - t2 / 2);
    ctx.lineTo(cx - t / 2, cy - t2 / 2);
    ctx.closePath();
    return;
  }
  if (variant === "parallelogram") {
    const sk = w * 0.22;
    ctx.moveTo(x + sk, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w - sk, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    return;
  }
  const outer = Math.min(w, h) / 2;
  const inner = outer * 0.4;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const px = cx + r * Math.cos(a);
    const py = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function imageMaskPath(ctx: CanvasRenderingContext2D, node: Pick<ImageNode, "x" | "y" | "width" | "height" | "mask">) {
  const { x, y, width: w, height: h } = node;
  const radius = Math.min(w, h) * 0.18;
  const shapeMask = node.mask === "ellipse" ? "ellipse" : node.mask;
  if (
    shapeMask &&
    shapeMask !== "arch" &&
    shapeMask !== "ticket" &&
    ALL_SHAPE_VARIANTS.includes(shapeMask as ShapeVariant)
  ) {
    drawShapePath(ctx, shapeMask as ShapeVariant, x, y, w, h, radius);
    return;
  }
  ctx.beginPath();
  if (node.mask === "ellipse") {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    return;
  }
  if (node.mask === "rounded-rect") {
    roundRectPath(ctx, x, y, w, h, radius);
    return;
  }
  if (node.mask === "arch") {
    const r = Math.min(w / 2, h * 0.45);
    ctx.moveTo(x, y + r);
    ctx.arc(x + w / 2, y + r, r, Math.PI, 0);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    return;
  }
  if (node.mask === "ticket") {
    const notch = Math.min(w, h) * 0.12;
    const cy = y + h / 2;
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, cy - notch);
    ctx.arc(x + w, cy, notch, -Math.PI / 2, Math.PI / 2, true);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, cy + notch);
    ctx.arc(x, cy, notch, Math.PI / 2, -Math.PI / 2, true);
    ctx.closePath();
    return;
  }
  ctx.rect(x, y, w, h);
}

function applyTransform(ctx: CanvasRenderingContext2D, node: CraftNode, anim: AnimTransform) {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  ctx.translate(cx + anim.dx, cy + anim.dy);
  const rot = node.rotation + anim.rotationDeg;
  if (rot) ctx.rotate((rot * Math.PI) / 180);
  const sx = (node.flipX ? -1 : 1) * anim.scaleX;
  const sy = (node.flipY ? -1 : 1) * anim.scaleY;
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  ctx.translate(-cx, -cy);
}

function applyShadow(ctx: CanvasRenderingContext2D, node: CraftNode) {
  if (!node.shadow) return;
  ctx.shadowColor = node.shadow.color;
  ctx.shadowBlur = node.shadow.blur;
  ctx.shadowOffsetX = node.shadow.x;
  ctx.shadowOffsetY = node.shadow.y;
}

function paintBackground(ctx: CanvasRenderingContext2D, page: CraftPage) {
  const { width: w, height: h, background } = page;
  if (background.mode === "gradient" && background.gradientEnd) {
    const rad = ((background.angle ?? 135) * Math.PI) / 180;
    const grad = ctx.createLinearGradient(
      w / 2 - Math.cos(rad) * w / 2,
      h / 2 - Math.sin(rad) * h / 2,
      w / 2 + Math.cos(rad) * w / 2,
      h / 2 + Math.sin(rad) * h / 2,
    );
    grad.addColorStop(0, background.color);
    grad.addColorStop(1, background.gradientEnd);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = background.color;
  }
  ctx.fillRect(0, 0, w, h);
}

function drawNode(
  ctx: CanvasRenderingContext2D,
  node: CraftNode,
  assets: CraftAsset[],
  atMs: number,
  onImage?: () => void,
  motionOpts?: DrawOptions["motion"],
  page?: CraftPage,
) {
  if (node.hidden) return;
  const anim = evaluateAnimation(node.animation, atMs);
  ctx.save();
  ctx.globalAlpha = node.opacity * anim.opacity;
  applyTransform(ctx, node, anim);
  applyShadow(ctx, node);

  if (node.type === "shape") {
    drawShapePath(ctx, node.variant, node.x, node.y, node.width, node.height, node.borderRadius);
    if (node.variant !== "line") {
      if (node.fillMode === "gradient" && node.gradientEnd) {
        const grad = ctx.createLinearGradient(node.x, node.y, node.x + node.width, node.y + node.height);
        grad.addColorStop(0, node.fill);
        grad.addColorStop(1, node.gradientEnd);
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = node.fill;
      }
      ctx.fill();
    }
    if (node.strokeWidth > 0 && node.stroke !== "transparent") {
      ctx.strokeStyle = node.stroke;
      ctx.lineWidth = node.strokeWidth;
      ctx.lineCap = "round";
      ctx.stroke();
    } else if (node.variant === "line") {
      ctx.strokeStyle = node.fill;
      ctx.lineWidth = Math.max(2, node.height);
      ctx.lineCap = "round";
      ctx.stroke();
    }
  } else if (node.type === "path") {
    if (node.points.length) {
      ctx.beginPath();
      ctx.moveTo(node.x + node.points[0].x, node.y + node.points[0].y);
      for (let i = 1; i < node.points.length; i++) ctx.lineTo(node.x + node.points[i].x, node.y + node.points[i].y);
      if (node.closed) ctx.closePath();
      if (node.closed && node.fill !== "transparent") {
        ctx.fillStyle = node.fill;
        ctx.fill();
      }
      if (node.strokeWidth > 0 && node.stroke !== "transparent") {
        ctx.strokeStyle = node.stroke;
        ctx.lineWidth = node.strokeWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
      }
    }
  } else if (node.type === "image") {
    const asset = assets.find((item) => item.id === node.assetId);
    const img = asset ? getImageEl(asset.dataUrl, onImage) : null;
    ctx.save();
    imageMaskPath(ctx, node);
    ctx.clip();
    const gray = node.grayscale ?? 0;
    ctx.filter = `brightness(${node.brightness}) contrast(${node.contrast}) grayscale(${gray})`;
    if (img) {
      const crop = node.crop ?? { x: 0, y: 0, width: 1, height: 1 };
      let sx = crop.x * img.width;
      let sy = crop.y * img.height;
      let sw = Math.max(1, crop.width * img.width);
      let sh = Math.max(1, crop.height * img.height);
      if (node.objectFit === "cover" && !node.crop && img.width && img.height) {
        const scale = Math.max(node.width / img.width, node.height / img.height);
        sw = node.width / scale;
        sh = node.height / scale;
        sx = (img.width - sw) / 2;
        sy = (img.height - sh) / 2;
      }
      if (node.objectFit === "contain" && !node.crop && img.width && img.height) {
        const dest = containDest(node.x, node.y, node.width, node.height, img.width, img.height);
        ctx.drawImage(img, 0, 0, img.width, img.height, dest.x, dest.y, dest.width, dest.height);
      } else {
        ctx.drawImage(img, sx, sy, sw, sh, node.x, node.y, node.width, node.height);
      }
    } else {
      ctx.fillStyle = "#e4e4e7";
      ctx.fillRect(node.x, node.y, node.width, node.height);
    }
    ctx.filter = "none";
    if (node.tint && (node.tintOpacity ?? 0) > 0) {
      ctx.globalAlpha = node.opacity * anim.opacity * (node.tintOpacity ?? 0);
      ctx.fillStyle = node.tint;
      ctx.fillRect(node.x, node.y, node.width, node.height);
      ctx.globalAlpha = node.opacity * anim.opacity;
    }
    ctx.restore();
    if ((node.strokeWidth ?? 0) > 0 && node.stroke && node.stroke !== "transparent") {
      imageMaskPath(ctx, node);
      ctx.strokeStyle = node.stroke;
      ctx.lineWidth = node.strokeWidth ?? 0;
      ctx.lineJoin = "round";
      ctx.stroke();
    }
  } else if (node.type === "motion") {
    const live = Boolean(motionOpts?.liveIds.has(node.id));
    const hook1 = page?.nodes.find((n) => n.type === "text" && n.name === "Hook 1");
    const hook2 = page?.nodes.find((n) => n.type === "text" && n.name === "Hook 2");
    ctx.save();
    imageMaskPath(ctx, node);
    ctx.clip();
    drawMotionNode(ctx, node, assets, {
      live,
      reduced: Boolean(motionOpts?.reduced),
      pointer: motionOpts?.pointer,
      click: motionOpts?.click,
      atMs,
      onImage,
      hooks: motionOpts?.hooks ?? {
        hook1: hook1?.type === "text" ? hook1.text : undefined,
        hook2: hook2?.type === "text" ? hook2.text : undefined,
      },
      signals: motionOpts?.signals,
    });
    ctx.restore();
    if ((node.strokeWidth ?? 0) > 0 && node.stroke && node.stroke !== "transparent") {
      imageMaskPath(ctx, node);
      ctx.strokeStyle = node.stroke;
      ctx.lineWidth = node.strokeWidth ?? 0;
      ctx.lineJoin = "round";
      ctx.stroke();
    }
  } else if (node.type === "text") {
    const sample = displayText(node);
    const size = node.textFit === "shrink" ? fitFontSize(ctx, node) : node.fontSize;
    const font = `${node.fontWeight} ${size}px "${node.fontFamily}", Inter, sans-serif`;
    const lines = wrapText(ctx, sample, node.width, font);
    ctx.font = font;
    ctx.fillStyle = node.color;
    ctx.textBaseline = "top";
    ctx.textAlign = node.align;
    if (node.overflow === "clip" || node.textFit === "shrink") {
      ctx.beginPath();
      ctx.rect(node.x, node.y, node.width, node.height);
      ctx.clip();
    }
    const lh = size * node.lineHeight;
    const tx = node.align === "center" ? node.x + node.width / 2 : node.align === "right" ? node.x + node.width : node.x;
    if (node.letterSpacing && "letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${node.letterSpacing}px`;
    lines.forEach((line, i) => {
      const y = node.y + i * lh;
      if (node.outline && node.outline.width > 0) {
        ctx.lineJoin = "round";
        ctx.strokeStyle = node.outline.color;
        ctx.lineWidth = node.outline.width * 2;
        ctx.strokeText(line, tx, y);
      }
      ctx.fillText(line, tx, y);
    });
    if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
  }

  ctx.restore();
}

export interface DrawOptions {
  atMs?: number;
  selectedIds?: string[];
  guides?: Guide[];
  marquee?: Rect | null;
  showHandles?: boolean;
  zoom?: number;
  grid?: boolean;
  transparent?: boolean;
  draftPath?: { x: number; y: number }[];
  croppingId?: string | null;
  hideIds?: string[];
  onImage?: () => void;
  motion?: {
    liveIds: Set<string>;
    pointer?: { x: number; y: number } | null;
    click?: { x: number; y: number } | null;
    reduced?: boolean;
    hooks?: { hook1?: string; hook2?: string };
    signals?: import("./motionSignals").MotionSignalsSnap;
  };
}

export function drawFrame(ctx: CanvasRenderingContext2D, page: CraftPage, assets: CraftAsset[], options: DrawOptions = {}) {
  const atMs = options.atMs ?? Infinity;
  ctx.clearRect(0, 0, page.width, page.height);
  if (!options.transparent) paintBackground(ctx, page);
  if (options.grid) {
    ctx.save();
    ctx.strokeStyle = "rgba(127,127,127,0.18)";
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = step; x < page.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, page.height);
      ctx.stroke();
    }
    for (let y = step; y < page.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(page.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }
  const hook1 = page.nodes.find((n) => n.type === "text" && n.name === "Hook 1");
  const hook2 = page.nodes.find((n) => n.type === "text" && n.name === "Hook 2");
  let wordCount = 0;
  for (const node of page.nodes) {
    if (node.type !== "text") continue;
    const parts = node.text.trim().split(/\s+/).filter(Boolean);
    wordCount += parts.length;
  }
  const baseSignals = options.motion?.signals ?? snapshotMotionSignals(undefined, { wordCount });
  const motion: DrawOptions["motion"] = {
    liveIds: options.motion?.liveIds ?? new Set(),
    pointer: options.motion?.pointer,
    click: options.motion?.click,
    reduced: options.motion?.reduced,
    hooks: options.motion?.hooks ?? {
      hook1: hook1?.type === "text" ? hook1.text : undefined,
      hook2: hook2?.type === "text" ? hook2.text : undefined,
    },
    signals: { ...baseSignals, wordCount: baseSignals.wordCount || wordCount },
  };
  for (const node of page.nodes) {
    if (options.hideIds?.includes(node.id)) continue;
    const selected = Boolean(options.selectedIds?.includes(node.id));
    drawNode(ctx, node, assets, atMs, options.onImage, { ...motion, signals: { ...motion.signals!, selected } }, page);
  }

  const cropNode = options.croppingId ? page.nodes.find((node) => node.id === options.croppingId) : undefined;
  if (cropNode?.type === "image") {
    const zoom = options.zoom ?? 1;
    ctx.save();
    ctx.fillStyle = "rgba(8, 6, 10, 0.42)";
    ctx.beginPath();
    ctx.rect(0, 0, page.width, page.height);
    ctx.rect(cropNode.x, cropNode.y, cropNode.width, cropNode.height);
    ctx.fill("evenodd");
    ctx.strokeStyle = "#ff006e";
    ctx.lineWidth = Math.max(1.5, 2 / zoom);
    ctx.setLineDash([7 / zoom, 5 / zoom]);
    ctx.strokeRect(cropNode.x, cropNode.y, cropNode.width, cropNode.height);
    ctx.restore();
  }

  const selected = page.nodes.filter(
    (node) => options.selectedIds?.includes(node.id) && !node.hidden && !options.hideIds?.includes(node.id),
  );
  if (selected.length && options.showHandles !== false && !options.croppingId) {
    const zoom = options.zoom ?? 1;
    ctx.save();
    ctx.strokeStyle = "#ff006e";
    ctx.fillStyle = "#ff006e";
    ctx.lineWidth = Math.max(1.5, 2 / zoom);
    if (selected.length === 1) {
      const node = selected[0];
      const handles: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w", "rotate"];
      const corners = (["nw", "ne", "se", "sw"] as Handle[]).map((handle) => handleWorldPoint(node, handle));
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      corners.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.closePath();
      ctx.stroke();
      const top = handleWorldPoint(node, "n");
      const rot = handleWorldPoint(node, "rotate");
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(rot.x, rot.y);
      ctx.stroke();
      const size = Math.max(6, 8 / zoom);
      for (const handle of handles) {
        const point = handleWorldPoint(node, handle);
        ctx.beginPath();
        ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const xs = selected.map((node) => node.x);
      const ys = selected.map((node) => node.y);
      const rights = selected.map((node) => node.x + node.width);
      const bottoms = selected.map((node) => node.y + node.height);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      const w = Math.max(...rights) - x;
      const h = Math.max(...bottoms) - y;
      ctx.setLineDash([6 / zoom, 4 / zoom]);
      ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
    }
    ctx.restore();
  }

  if (options.guides?.length) {
    const zoom = options.zoom ?? 1;
    ctx.save();
    ctx.strokeStyle = "#ff006e";
    ctx.lineWidth = Math.max(1.25, 1.5 / zoom);
    ctx.setLineDash([6 / zoom, 4 / zoom]);
    ctx.shadowColor = "rgba(255,0,110,0.55)";
    ctx.shadowBlur = 6 / zoom;
    for (const guide of options.guides) {
      ctx.beginPath();
      if (guide.axis === "x") {
        ctx.moveTo(guide.at, 0);
        ctx.lineTo(guide.at, page.height);
      } else {
        ctx.moveTo(0, guide.at);
        ctx.lineTo(page.width, guide.at);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  if (options.marquee) {
    const { x, y, width, height } = options.marquee;
    ctx.save();
    ctx.strokeStyle = "#ff006e";
    ctx.fillStyle = "rgba(255,0,110,0.08)";
    ctx.setLineDash([4, 3]);
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
    ctx.restore();
  }

  if (options.draftPath && options.draftPath.length) {
    ctx.save();
    ctx.strokeStyle = "#ff006e";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(options.draftPath[0].x, options.draftPath[0].y);
    for (let i = 1; i < options.draftPath.length; i++) ctx.lineTo(options.draftPath[i].x, options.draftPath[i].y);
    ctx.stroke();
    ctx.fillStyle = "#ff006e";
    for (const point of options.draftPath) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
