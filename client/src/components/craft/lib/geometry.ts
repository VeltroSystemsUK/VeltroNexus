import type { Constraint, CraftNode, CraftPage, Handle, ImageCrop, ImageNode } from "./types";
import { DEFAULT_CROP } from "./types";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Guide {
  axis: "x" | "y";
  at: number;
}

export function clamp(value: number, lo: number, hi: number): number {
  return Math.min(Math.max(value, lo), Math.max(lo, hi));
}

export function nodeRect(node: CraftNode): Rect {
  return { x: node.x, y: node.y, width: node.width, height: node.height };
}

export function nodeCenter(node: CraftNode): { x: number; y: number } {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

export function unionRects(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  const x = Math.min(...rects.map((rect) => rect.x));
  const y = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { x, y, width: right - x, height: bottom - y };
}

export function selectionRect(nodes: CraftNode[]): Rect | null {
  return unionRects(nodes.map(nodeRect));
}

export function worldToLocal(px: number, py: number, node: CraftNode): { x: number; y: number } {
  const center = nodeCenter(node);
  const dx = px - center.x;
  const dy = py - center.y;
  const rad = (-node.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

export function localToWorld(lx: number, ly: number, node: CraftNode): { x: number; y: number } {
  const center = nodeCenter(node);
  const rad = (node.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: center.x + lx * cos - ly * sin, y: center.y + lx * sin + ly * cos };
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  if (len === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function pointInPolygon(px: number, py: number, points: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 0.00001) + xi) inside = !inside;
  }
  return inside;
}

export function pointInNode(px: number, py: number, node: CraftNode): boolean {
  const local = worldToLocal(px, py, node);
  if (node.type === "path" && node.points.length) {
    const pts = node.points;
    const hitWidth = Math.max(8, node.strokeWidth + 4);
    for (let i = 1; i < pts.length; i++) {
      if (distToSegment(local.x + node.width / 2, local.y + node.height / 2, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y) <= hitWidth) return true;
    }
    if (node.closed && pts.length > 2) {
      if (distToSegment(local.x + node.width / 2, local.y + node.height / 2, pts[pts.length - 1].x, pts[pts.length - 1].y, pts[0].x, pts[0].y) <= hitWidth) return true;
      return pointInPolygon(local.x + node.width / 2, local.y + node.height / 2, pts);
    }
    return false;
  }
  const pad = node.type === "shape" && node.variant === "line" ? Math.max(8, node.strokeWidth + 6) : 0;
  return (
    local.x >= -node.width / 2 - pad &&
    local.x <= node.width / 2 + pad &&
    local.y >= -node.height / 2 - pad &&
    local.y <= node.height / 2 + pad
  );
}

export function hitTest(nodes: CraftNode[], px: number, py: number): CraftNode | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    if (node.hidden || node.locked) continue;
    if (pointInNode(px, py, node)) return node;
  }
  return null;
}

export function nodesInMarquee(nodes: CraftNode[], rect: Rect): CraftNode[] {
  const left = Math.min(rect.x, rect.x + rect.width);
  const top = Math.min(rect.y, rect.y + rect.height);
  const right = Math.max(rect.x, rect.x + rect.width);
  const bottom = Math.max(rect.y, rect.y + rect.height);
  return nodes.filter((node) => {
    if (node.hidden || node.locked) return false;
    const box = nodeRect(node);
    return box.x < right && box.x + box.width > left && box.y < bottom && box.y + box.height > top;
  });
}

const HANDLE_LOCAL: Record<Exclude<Handle, "rotate">, { x: number; y: number }> = {
  nw: { x: -0.5, y: -0.5 },
  n: { x: 0, y: -0.5 },
  ne: { x: 0.5, y: -0.5 },
  e: { x: 0.5, y: 0 },
  se: { x: 0.5, y: 0.5 },
  s: { x: 0, y: 0.5 },
  sw: { x: -0.5, y: 0.5 },
  w: { x: -0.5, y: 0 },
};

export function handleWorldPoint(node: CraftNode, handle: Handle): { x: number; y: number } {
  if (handle === "rotate") return localToWorld(0, -node.height / 2 - 28, node);
  const local = HANDLE_LOCAL[handle];
  return localToWorld(local.x * node.width, local.y * node.height, node);
}

export function hitHandle(node: CraftNode, px: number, py: number, zoom: number): Handle | null {
  const threshold = 10 / Math.max(zoom, 0.1);
  const handles: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w", "rotate"];
  for (const handle of handles) {
    const point = handleWorldPoint(node, handle);
    if (Math.hypot(px - point.x, py - point.y) <= threshold) return handle;
  }
  return null;
}

export function moveNodes(nodes: CraftNode[], ids: Set<string>, dx: number, dy: number): CraftNode[] {
  return nodes.map((node) => (ids.has(node.id) ? { ...node, x: node.x + dx, y: node.y + dy } : node));
}

export function resizeNode(node: CraftNode, handle: Exclude<Handle, "rotate">, worldDx: number, worldDy: number, lockAspect = false): CraftNode {
  const rad = (-node.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const ldx = worldDx * cos - worldDy * sin;
  const ldy = worldDx * sin + worldDy * cos;

  let left = -node.width / 2;
  let right = node.width / 2;
  let top = -node.height / 2;
  let bottom = node.height / 2;

  if (handle.includes("w")) left += ldx;
  if (handle.includes("e")) right += ldx;
  if (handle.includes("n")) top += ldy;
  if (handle.includes("s")) bottom += ldy;

  if (lockAspect && node.height > 0) {
    const aspect = node.width / node.height;
    const nextW = Math.max(16, right - left);
    const nextH = Math.max(16, bottom - top);
    if (handle === "n" || handle === "s") {
      const mid = (left + right) / 2;
      const w = nextH * aspect;
      left = mid - w / 2;
      right = mid + w / 2;
    } else if (handle === "e" || handle === "w") {
      const mid = (top + bottom) / 2;
      const h = nextW / aspect;
      top = mid - h / 2;
      bottom = mid + h / 2;
    } else {
      const h = nextW / aspect;
      if (handle.includes("n")) top = bottom - h;
      else bottom = top + h;
    }
  }

  const width = Math.max(16, right - left);
  const height = Math.max(16, bottom - top);
  const localCx = (left + right) / 2;
  const localCy = (top + bottom) / 2;
  const world = localToWorld(localCx, localCy, node);
  const next = {
    ...node,
    width,
    height,
    x: world.x - width / 2,
    y: world.y - height / 2,
  };
  if (next.type === "text" && node.type === "text") {
    next.fontSize = clamp(node.fontSize * (height / Math.max(node.height, 1)), 8, 400);
  }
  if (next.type === "path" && node.type === "path") {
    const sx = width / Math.max(node.width, 1);
    const sy = height / Math.max(node.height, 1);
    next.points = node.points.map((point) => ({ x: point.x * sx, y: point.y * sy }));
  }
  return next;
}

export function pathFromPoints(points: { x: number; y: number }[]): { x: number; y: number; width: number; height: number; points: { x: number; y: number }[] } | null {
  if (points.length < 2) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const width = Math.max(8, Math.max(...xs) - x);
  const height = Math.max(8, Math.max(...ys) - y);
  return {
    x,
    y,
    width,
    height,
    points: points.map((point) => ({ x: point.x - x, y: point.y - y })),
  };
}

export function rotateNode(node: CraftNode, px: number, py: number): CraftNode {
  const center = nodeCenter(node);
  const angle = (Math.atan2(py - center.y, px - center.x) * 180) / Math.PI + 90;
  return { ...node, rotation: Math.round(angle) };
}

function applyAxis(pos: number, size: number, oldMax: number, newMax: number, constraint: Constraint): { pos: number; size: number } {
  const scale = newMax / Math.max(oldMax, 1);
  if (constraint === "start") return { pos, size };
  if (constraint === "end") return { pos: newMax - (oldMax - pos - size), size };
  if (constraint === "center") return { pos: ((pos + size / 2) / oldMax) * newMax - size / 2, size };
  if (constraint === "stretch") {
    const end = oldMax - pos - size;
    return { pos, size: Math.max(8, newMax - pos - end) };
  }
  return { pos: pos * scale, size: size * scale };
}

export function applyConstraints(node: CraftNode, oldWidth: number, oldHeight: number, newWidth: number, newHeight: number): CraftNode {
  const x = applyAxis(node.x, node.width, oldWidth, newWidth, node.constraints.horizontal);
  const y = applyAxis(node.y, node.height, oldHeight, newHeight, node.constraints.vertical);
  const next = { ...node, x: x.pos, y: y.pos, width: x.size, height: y.size };
  if (next.type === "text" && node.type === "text" && node.constraints.vertical === "scale") {
    next.fontSize = clamp(node.fontSize * (newHeight / Math.max(oldHeight, 1)), 8, 400);
  }
  return next;
}

export function resizePage(page: CraftPage, width: number, height: number, presetId = page.presetId): CraftPage {
  return {
    ...page,
    width,
    height,
    presetId,
    nodes: page.nodes.map((node) => applyConstraints(node, page.width, page.height, width, height)),
  };
}

function uniqueNums(values: number[]): number[] {
  return Array.from(new Set(values.map((value) => Math.round(value * 100) / 100)));
}

function rectEdges(rect: Rect) {
  return {
    x: [rect.x, rect.x + rect.width / 2, rect.x + rect.width],
    y: [rect.y, rect.y + rect.height / 2, rect.y + rect.height],
  };
}

function nearestDelta(edges: number[], targets: number[], threshold: number): number | null {
  let best = threshold + 1;
  let delta = 0;
  for (const edge of edges) {
    for (const target of targets) {
      const d = target - edge;
      if (Math.abs(d) < best) {
        best = Math.abs(d);
        delta = d;
      }
    }
  }
  return best <= threshold ? delta : null;
}

function collectGuides(rect: Rect, xTargets: number[], yTargets: number[], slop = 0.75): Guide[] {
  const { x, y } = rectEdges(rect);
  const guides: Guide[] = [];
  for (const edge of x) {
    for (const target of xTargets) {
      if (Math.abs(edge - target) <= slop) guides.push({ axis: "x", at: target });
    }
  }
  for (const edge of y) {
    for (const target of yTargets) {
      if (Math.abs(edge - target) <= slop) guides.push({ axis: "y", at: target });
    }
  }
  return guides.filter((guide, index, all) => all.findIndex((item) => item.axis === guide.axis && item.at === guide.at) === index);
}

export function snapThreshold(zoom: number): number {
  return Math.max(6, 12 / Math.max(zoom, 0.15));
}

/** Destination rect that letterboxes `img` inside the frame (CSS object-fit: contain). */
export function containDest(
  frameX: number,
  frameY: number,
  frameW: number,
  frameH: number,
  imgW: number,
  imgH: number,
): Rect {
  const iw = Math.max(imgW, 1);
  const ih = Math.max(imgH, 1);
  const scale = Math.min(frameW / iw, frameH / ih);
  const width = iw * scale;
  const height = ih * scale;
  return {
    x: frameX + (frameW - width) / 2,
    y: frameY + (frameH - height) / 2,
    width,
    height,
  };
}

export function coverCrop(imgW: number, imgH: number, frameW: number, frameH: number): ImageCrop {
  const width = Math.max(imgW, 1);
  const height = Math.max(imgH, 1);
  const scale = Math.max(frameW / width, frameH / height);
  const sw = Math.min(width, frameW / scale);
  const sh = Math.min(height, frameH / scale);
  return {
    x: (width - sw) / 2 / width,
    y: (height - sh) / 2 / height,
    width: sw / width,
    height: sh / height,
  };
}

export function materializeCrop(node: ImageNode, imgW: number, imgH: number): ImageCrop {
  if (node.crop) return { ...node.crop };
  if (node.objectFit === "contain" || node.objectFit === "fill") return { ...DEFAULT_CROP };
  return coverCrop(imgW, imgH, node.width, node.height);
}

export function panCrop(crop: ImageCrop, dx: number, dy: number): ImageCrop {
  return {
    ...crop,
    x: clamp(crop.x - dx, 0, Math.max(0, 1 - crop.width)),
    y: clamp(crop.y - dy, 0, Math.max(0, 1 - crop.height)),
  };
}

export function zoomCrop(crop: ImageCrop, factor: number): ImageCrop {
  const width = clamp(crop.width / factor, 0.05, 1);
  const height = clamp(crop.height / factor, 0.05, 1);
  const cx = crop.x + crop.width / 2;
  const cy = crop.y + crop.height / 2;
  return {
    x: clamp(cx - width / 2, 0, 1 - width),
    y: clamp(cy - height / 2, 0, 1 - height),
    width,
    height,
  };
}

export function snapDelta(
  moving: Rect,
  others: Rect[],
  page: CraftPage,
  dx: number,
  dy: number,
  threshold = 8,
): { dx: number; dy: number; guides: Guide[] } {
  const next: Rect = { ...moving, x: moving.x + dx, y: moving.y + dy };
  const xTargets = uniqueNums([0, page.width / 2, page.width, ...others.flatMap((rect) => [rect.x, rect.x + rect.width / 2, rect.x + rect.width])]);
  const yTargets = uniqueNums([0, page.height / 2, page.height, ...others.flatMap((rect) => [rect.y, rect.y + rect.height / 2, rect.y + rect.height])]);
  const xSnap = nearestDelta(rectEdges(next).x, xTargets, threshold);
  const ySnap = nearestDelta(rectEdges(next).y, yTargets, threshold);
  const applied = {
    x: moving.x + (xSnap === null ? dx : dx + xSnap),
    y: moving.y + (ySnap === null ? dy : dy + ySnap),
    width: moving.width,
    height: moving.height,
  };
  return {
    dx: xSnap === null ? dx : dx + xSnap,
    dy: ySnap === null ? dy : dy + ySnap,
    guides: collectGuides(applied, xTargets, yTargets),
  };
}

export function snapResize(
  node: CraftNode,
  handle: Exclude<Handle, "rotate">,
  others: Rect[],
  page: CraftPage,
  threshold = 8,
): { node: CraftNode; guides: Guide[] } {
  const xTargets = uniqueNums([0, page.width / 2, page.width, ...others.flatMap((rect) => [rect.x, rect.x + rect.width / 2, rect.x + rect.width])]);
  const yTargets = uniqueNums([0, page.height / 2, page.height, ...others.flatMap((rect) => [rect.y, rect.y + rect.height / 2, rect.y + rect.height])]);
  let { x, y, width, height } = node;
  const right = x + width;
  const bottom = y + height;
  if (handle.includes("e")) {
    const delta = nearestDelta([right], xTargets, threshold);
    if (delta !== null) width = Math.max(16, right + delta - x);
  }
  if (handle.includes("w")) {
    const delta = nearestDelta([x], xTargets, threshold);
    if (delta !== null) {
      const nextX = x + delta;
      width = Math.max(16, right - nextX);
      x = nextX;
    }
  }
  if (handle.includes("s")) {
    const delta = nearestDelta([bottom], yTargets, threshold);
    if (delta !== null) height = Math.max(16, bottom + delta - y);
  }
  if (handle.includes("n")) {
    const delta = nearestDelta([y], yTargets, threshold);
    if (delta !== null) {
      const nextY = y + delta;
      height = Math.max(16, bottom - nextY);
      y = nextY;
    }
  }
  const next = { ...node, x, y, width, height };
  return { node: next, guides: collectGuides({ x, y, width, height }, xTargets, yTargets) };
}

export function alignNodes(nodes: CraftNode[], ids: string[], dir: "left" | "centerH" | "right" | "top" | "centerV" | "bottom", page: CraftPage): CraftNode[] {
  const selected = nodes.filter((node) => ids.includes(node.id));
  if (!selected.length) return nodes;
  const bounds = selected.length > 1 ? selectionRect(selected) : { x: 0, y: 0, width: page.width, height: page.height };
  if (!bounds) return nodes;

  return nodes.map((node) => {
    if (!ids.includes(node.id)) return node;
    const box = nodeRect(node);
    if (dir === "left") return { ...node, x: bounds.x };
    if (dir === "centerH") return { ...node, x: bounds.x + (bounds.width - box.width) / 2 };
    if (dir === "right") return { ...node, x: bounds.x + bounds.width - box.width };
    if (dir === "top") return { ...node, y: bounds.y };
    if (dir === "centerV") return { ...node, y: bounds.y + (bounds.height - box.height) / 2 };
    return { ...node, y: bounds.y + bounds.height - box.height };
  });
}

export function flipNodes(nodes: CraftNode[], ids: string[], axis: "horizontal" | "vertical"): CraftNode[] {
  const selected = nodes.filter((node) => ids.includes(node.id));
  const bounds = selectionRect(selected);
  if (!bounds) return nodes;
  return nodes.map((node) => {
    if (!ids.includes(node.id)) return node;
    if (axis === "horizontal") {
      return { ...node, x: bounds.x + bounds.width - (node.x + node.width), rotation: -node.rotation, flipX: !node.flipX };
    }
    return { ...node, y: bounds.y + bounds.height - (node.y + node.height), rotation: -node.rotation, flipY: !node.flipY };
  });
}

export function distributeNodes(nodes: CraftNode[], ids: string[], axis: "horizontal" | "vertical"): CraftNode[] {
  const selected = nodes.filter((node) => ids.includes(node.id)).sort((a, b) => (axis === "horizontal" ? a.x - b.x : a.y - b.y));
  if (selected.length < 3) return nodes;
  const first = selected[0];
  const last = selected[selected.length - 1];
  const span =
    axis === "horizontal"
      ? last.x + last.width - first.x - selected.reduce((sum, node) => sum + node.width, 0)
      : last.y + last.height - first.y - selected.reduce((sum, node) => sum + node.height, 0);
  const gap = span / (selected.length - 1);
  let cursor = axis === "horizontal" ? first.x : first.y;
  const nextPos = new Map<string, number>();
  for (const node of selected) {
    nextPos.set(node.id, cursor);
    cursor += (axis === "horizontal" ? node.width : node.height) + gap;
  }
  return nodes.map((node) => {
    const pos = nextPos.get(node.id);
    if (pos === undefined) return node;
    return axis === "horizontal" ? { ...node, x: pos } : { ...node, y: pos };
  });
}
