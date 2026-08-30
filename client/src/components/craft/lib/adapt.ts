import { applyConstraints, clamp } from "./geometry";
import { presetById } from "./templates";
import { uid, type CraftDocument, type CraftNode, type CraftPage } from "./types";

export const PACK_PRESET_IDS = ["story", "square", "twitter", "youtube", "og"] as const;

function adaptAxis(
  pos: number,
  size: number,
  oldMax: number,
  newMax: number,
  constraint: CraftNode["constraints"]["horizontal"],
  uni: number,
): { pos: number; size: number } {
  if (constraint === "stretch") {
    const startM = pos / Math.max(oldMax, 1);
    const endM = (oldMax - pos - size) / Math.max(oldMax, 1);
    const nextPos = startM * newMax;
    return { pos: nextPos, size: Math.max(8, newMax - nextPos - endM * newMax) };
  }
  if (constraint === "scale") {
    const scale = newMax / Math.max(oldMax, 1);
    return { pos: pos * scale, size: Math.max(8, size * scale) };
  }
  const nextSize = Math.max(8, size * uni);
  if (constraint === "end") {
    const margin = oldMax - pos - size;
    return { pos: newMax - margin * uni - nextSize, size: nextSize };
  }
  if (constraint === "center") {
    const center = ((pos + size / 2) / Math.max(oldMax, 1)) * newMax;
    return { pos: center - nextSize / 2, size: nextSize };
  }
  return { pos: pos * uni, size: nextSize };
}

function adaptNode(node: CraftNode, oldW: number, oldH: number, newW: number, newH: number, uni: number): CraftNode {
  const x = adaptAxis(node.x, node.width, oldW, newW, node.constraints.horizontal, uni);
  const y = adaptAxis(node.y, node.height, oldH, newH, node.constraints.vertical, uni);
  const next: CraftNode = { ...node, x: x.pos, y: y.pos, width: x.size, height: y.size };
  if (next.type === "text" && node.type === "text") {
    next.fontSize = clamp(node.fontSize * uni, 8, 400);
  }
  if (next.type === "path" && node.type === "path") {
    const sx = x.size / Math.max(node.width, 1);
    const sy = y.size / Math.max(node.height, 1);
    next.points = node.points.map((point) => ({ x: point.x * sx, y: point.y * sy }));
  }
  return next;
}

/** Reflow a page into another size, keeping pins and scaling type with the smaller axis. */
export function adaptPage(page: CraftPage, width: number, height: number, presetId = page.presetId): CraftPage {
  const sx = width / Math.max(page.width, 1);
  const sy = height / Math.max(page.height, 1);
  const uni = Math.min(sx, sy);
  const similar = Math.abs(sx - sy) / Math.max(sx, sy, 0.0001) < 0.18;
  if (similar) {
    return {
      ...applyFontScale(applyConstraintsPage(page, width, height, presetId), uni),
    };
  }
  return {
    ...page,
    width,
    height,
    presetId,
    nodes: page.nodes.map((node) => adaptNode(node, page.width, page.height, width, height, uni)),
  };
}

function applyConstraintsPage(page: CraftPage, width: number, height: number, presetId: string): CraftPage {
  return {
    ...page,
    width,
    height,
    presetId,
    nodes: page.nodes.map((node) => applyConstraints(node, page.width, page.height, width, height)),
  };
}

function applyFontScale(page: CraftPage, uni: number): CraftPage {
  if (Math.abs(uni - 1) < 0.02) return page;
  return {
    ...page,
    nodes: page.nodes.map((node) =>
      node.type === "text" ? { ...node, fontSize: clamp(node.fontSize * uni, 8, 400) } : node,
    ),
  };
}

export function spawnSizes(doc: CraftDocument, pageId: string, presetIds: string[]): CraftDocument {
  const source = doc.pages.find((page) => page.id === pageId);
  if (!source) return doc;
  const extras: CraftPage[] = [];
  for (const id of presetIds) {
    const preset = presetById(id);
    if (!preset) continue;
    if (source.presetId === id && source.width === preset.width && source.height === preset.height) continue;
    const next = adaptPage({ ...source, id: uid("page"), name: preset.name }, preset.width, preset.height, preset.id);
    next.nodes = next.nodes.map((node) => ({ ...node, id: uid(node.type) }));
    extras.push(next);
  }
  if (!extras.length) return doc;
  const index = doc.pages.findIndex((page) => page.id === pageId);
  const pages = [...doc.pages];
  pages.splice(index + 1, 0, ...extras);
  return { ...doc, pages, activePageId: extras[0].id, updatedAt: new Date().toISOString() };
}
