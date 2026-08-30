import { uid, type CraftDocument, type CraftPage, type TextAlign, type TextNode } from "./types";

export function displayText(node: Pick<TextNode, "text" | "uppercase">): string {
  return node.uppercase ? node.text.toUpperCase() : node.text;
}

type OverlayNode = Pick<
  TextNode,
  | "x"
  | "y"
  | "width"
  | "height"
  | "fontSize"
  | "fontFamily"
  | "fontWeight"
  | "color"
  | "align"
  | "letterSpacing"
  | "lineHeight"
  | "rotation"
>;

export function textOverlayBox(node: OverlayNode, zoom: number, panX: number, panY: number) {
  return {
    left: panX + node.x * zoom,
    top: panY + node.y * zoom,
    width: Math.max(48, node.width * zoom),
    height: Math.max(24, node.height * zoom),
    fontSize: Math.max(10, node.fontSize * zoom),
    fontFamily: `"${node.fontFamily}", Inter, sans-serif`,
    fontWeight: node.fontWeight,
    color: node.color,
    textAlign: node.align as TextAlign,
    letterSpacing: `${node.letterSpacing * zoom}px`,
    lineHeight: String(node.lineHeight),
    transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
  };
}

export function wrapText(
  ctx: Pick<CanvasRenderingContext2D, "font" | "measureText">,
  value: string,
  width: number,
  font: string,
): string[] {
  ctx.font = font;
  const lines: string[] = [];
  for (const para of value.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= width || !line) line = next;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
}

export function fitFontSize(
  ctx: Pick<CanvasRenderingContext2D, "font" | "measureText">,
  node: TextNode,
  min = 8,
): number {
  const max = Math.max(min, Math.round(node.fontSize));
  let lo = min;
  let hi = max;
  let best = min;
  const sample = displayText(node);
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const font = `${node.fontWeight} ${mid}px "${node.fontFamily}", Inter, sans-serif`;
    const lines = wrapText(ctx, sample, node.width, font);
    const height = lines.length * mid * node.lineHeight;
    if (height <= node.height) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

export function parseDeckLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function applyDeckLine(page: CraftPage, nodeId: string, text: string): CraftPage {
  return {
    ...page,
    nodes: page.nodes.map((node) => (node.id === nodeId && node.type === "text" ? { ...node, text } : node)),
  };
}

function headingNodeId(page: CraftPage, preferredId?: string): string | null {
  if (preferredId && page.nodes.some((node) => node.id === preferredId && node.type === "text")) return preferredId;
  const heading = page.nodes.find((node) => node.type === "text" && node.fontRole === "heading");
  if (heading) return heading.id;
  const first = page.nodes.find((node) => node.type === "text");
  return first?.id ?? null;
}

/** Apply the first line to this page, then duplicate the page for every extra line. */
export function applyDeckToPages(doc: CraftDocument, pageId: string, lines: string[], nodeId?: string): CraftDocument {
  const source = doc.pages.find((page) => page.id === pageId);
  if (!source) return doc;
  const clean = lines.map((line) => line.trim()).filter(Boolean);
  if (!clean.length) return doc;
  const targetId = headingNodeId(source, nodeId);
  if (!targetId) return doc;

  const pages = [...doc.pages];
  const index = pages.findIndex((page) => page.id === pageId);
  pages[index] = applyDeckLine(source, targetId, clean[0]);

  const extras: CraftPage[] = clean.slice(1).map((line, i) => {
    const copy = JSON.parse(JSON.stringify(source)) as CraftPage;
    copy.id = uid("page");
    copy.name = `${source.name} ${i + 2}`;
    copy.nodes = copy.nodes.map((node) => {
      const next = { ...node, id: uid(node.type) };
      if (node.id === targetId && next.type === "text") next.text = line;
      return next;
    });
    return copy;
  });
  pages.splice(index + 1, 0, ...extras);
  return { ...doc, pages, deck: { lines: clean }, activePageId: pages[index].id, updatedAt: new Date().toISOString() };
}
