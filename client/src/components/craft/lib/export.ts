import { drawFrame, getImageEl } from "./renderer";
import { displayText, fitFontSize, wrapText } from "./text";
import type { CraftAsset, CraftDocument, CraftNode, CraftPage } from "./types";

export type RasterFormat = "png" | "jpeg" | "webp";

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "craft";
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function renderPageToCanvas(page: CraftPage, assets: CraftAsset[], transparent = false): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = page.width;
  canvas.height = page.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create an export canvas.");
  drawFrame(ctx, page, assets, { atMs: Infinity, showHandles: false, transparent });
  return canvas;
}

export async function rasterBlob(
  page: CraftPage,
  assets: CraftAsset[],
  title: string,
  format: RasterFormat,
  scale = 1,
  transparent = false,
): Promise<{ blob: Blob; filename: string; mime: string }> {
  const source = renderPageToCanvas(page, assets, transparent && format === "png");
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(page.width * scale);
  canvas.height = Math.round(page.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not scale the export canvas.");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const mime = format === "png" ? "image/png" : format === "jpeg" ? "image/jpeg" : "image/webp";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.92));
  if (!blob) throw new Error("Export failed.");
  const filename = `${slug(title)}-${page.width}x${page.height}${scale === 2 ? "@2x" : ""}${transparent ? "-alpha" : ""}.${format === "jpeg" ? "jpg" : format}`;
  return { blob, filename, mime };
}

export async function exportRaster(
  page: CraftPage,
  assets: CraftAsset[],
  title: string,
  format: RasterFormat,
  scale = 1,
  transparent = false,
): Promise<void> {
  const { blob, filename } = await rasterBlob(page, assets, title, format, scale, transparent);
  downloadBlob(blob, filename);
}

export async function exportAllPages(doc: CraftDocument, format: RasterFormat = "png"): Promise<void> {
  for (const page of doc.pages) {
    await exportRaster(page, doc.assets, `${doc.title}-${page.name}`, format);
  }
}

export async function copyPagePng(page: CraftPage, assets: CraftAsset[]): Promise<void> {
  const canvas = renderPageToCanvas(page, assets);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Clipboard export failed.");
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function nodeTransform(node: CraftNode): string {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  return node.rotation ? `transform="rotate(${node.rotation} ${cx} ${cy})"` : "";
}

function shapeSvg(node: Extract<CraftNode, { type: "shape" }>): string {
  const common = `fill="${node.variant === "line" ? "none" : escapeXml(node.fill)}" stroke="${node.stroke === "transparent" ? "none" : escapeXml(node.stroke)}" stroke-width="${node.strokeWidth}" opacity="${node.opacity}" ${nodeTransform(node)}`;
  if (node.variant === "ellipse") {
    return `<ellipse cx="${node.x + node.width / 2}" cy="${node.y + node.height / 2}" rx="${node.width / 2}" ry="${node.height / 2}" ${common}/>`;
  }
  if (node.variant === "line") {
    return `<line x1="${node.x}" y1="${node.y + node.height / 2}" x2="${node.x + node.width}" y2="${node.y + node.height / 2}" stroke="${escapeXml(node.fill)}" stroke-width="${Math.max(2, node.height)}" stroke-linecap="round" opacity="${node.opacity}" ${nodeTransform(node)}/>`;
  }
  if (node.variant === "rounded-rect") {
    return `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="${node.borderRadius}" ${common}/>`;
  }
  return `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" ${common}/>`;
}

export function pageToSvg(page: CraftPage, assets: CraftAsset[], measure?: CanvasRenderingContext2D): string {
  const parts: string[] = [];
  const bg = page.background.mode === "gradient" && page.background.gradientEnd
    ? `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${escapeXml(page.background.color)}"/><stop offset="1" stop-color="${escapeXml(page.background.gradientEnd)}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#bg)"/>`
    : `<rect width="100%" height="100%" fill="${escapeXml(page.background.color)}"/>`;
  parts.push(bg);

  for (const node of page.nodes) {
    if (node.hidden) continue;
    if (node.type === "shape") {
      parts.push(shapeSvg(node));
      continue;
    }
    if (node.type === "path" && node.points.length) {
      const d = node.points.map((point, i) => `${i === 0 ? "M" : "L"}${node.x + point.x} ${node.y + point.y}`).join(" ") + (node.closed ? " Z" : "");
      parts.push(
        `<path d="${d}" fill="${node.closed ? escapeXml(node.fill) : "none"}" stroke="${escapeXml(node.stroke)}" stroke-width="${node.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${node.opacity}" ${nodeTransform(node)}/>`,
      );
      continue;
    }
    if (node.type === "image") {
      const asset = assets.find((item) => item.id === node.assetId);
      if (asset) {
        parts.push(
          `<image href="${asset.dataUrl}" x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" opacity="${node.opacity}" preserveAspectRatio="${node.objectFit === "contain" ? "xMidYMid meet" : "xMidYMid slice"}" ${nodeTransform(node)}/>`,
        );
      }
      continue;
    }
    if (node.type !== "text") continue;
    const sample = displayText(node);
    const size = measure && node.textFit === "shrink" ? fitFontSize(measure, node) : node.fontSize;
    const font = `${node.fontWeight} ${size}px "${node.fontFamily}", Inter, sans-serif`;
    const lines = measure ? wrapText(measure, sample, node.width, font) : sample.split("\n");
    const anchor = node.align === "center" ? "middle" : node.align === "right" ? "end" : "start";
    const tx = node.align === "center" ? node.x + node.width / 2 : node.align === "right" ? node.x + node.width : node.x;
    const clip =
      node.overflow === "clip" || node.textFit === "shrink"
        ? ` clip-path="inset(0)"`
        : "";
    const tspans = lines
      .map((line, i) => `<tspan x="${tx}" dy="${i === 0 ? 0 : size * node.lineHeight}">${escapeXml(line)}</tspan>`)
      .join("");
    parts.push(
      `<text x="${tx}" y="${node.y + size}" fill="${escapeXml(node.color)}" font-family="${escapeXml(node.fontFamily)}" font-size="${size}" font-weight="${node.fontWeight}" text-anchor="${anchor}" opacity="${node.opacity}"${clip} ${nodeTransform(node)}>${tspans}</text>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}" height="${page.height}" viewBox="0 0 ${page.width} ${page.height}">${parts.join("")}</svg>`;
}

export function exportSvg(page: CraftPage, assets: CraftAsset[], title: string, measure?: CanvasRenderingContext2D) {
  const svg = pageToSvg(page, assets, measure);
  downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${slug(title)}.svg`);
}

export async function exportGif(
  page: CraftPage,
  assets: CraftAsset[],
  title: string,
  _durationMs = 1500,
  _fps = 20,
): Promise<void> {
  await exportRaster(page, assets, title, "png");
}

export async function exportPack(doc: CraftDocument, page: CraftPage, measure?: CanvasRenderingContext2D): Promise<void> {
  await exportRaster(page, doc.assets, doc.title, "png");
  await exportRaster(page, doc.assets, doc.title, "jpeg");
  await exportRaster(page, doc.assets, doc.title, "webp");
  exportSvg(page, doc.assets, doc.title, measure);
}
