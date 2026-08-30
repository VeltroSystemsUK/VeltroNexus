import {
  DEFAULT_BRAND,
  uid,
  type ColorRole,
  type CraftAsset,
  type CraftBrand,
  type CraftDocument,
  type CraftNode,
  type CraftPage,
  type ImageNode,
} from "./types";

export const COLOR_ROLES: ColorRole[] = ["primary", "secondary", "accent", "background", "text", "muted"];

export function cloneBrand(brand: CraftBrand = DEFAULT_BRAND): CraftBrand {
  return {
    name: brand.name,
    colors: { ...brand.colors },
    headingFont: brand.headingFont,
    bodyFont: brand.bodyFont,
    logoAssetId: brand.logoAssetId,
  };
}

export function applyBrandToNode(node: CraftNode, brand: CraftBrand): CraftNode {
  let next: CraftNode = { ...node };
  if (next.type === "text") {
    if (next.role) next = { ...next, color: brand.colors[next.role] };
    if (next.fontRole === "heading") next = { ...next, fontFamily: brand.headingFont };
    if (next.fontRole === "body") next = { ...next, fontFamily: brand.bodyFont };
    return next;
  }
  if (next.type === "shape" && next.role) {
    return { ...next, fill: brand.colors[next.role] };
  }
  return next;
}

function remapColor(color: string, from: CraftBrand, to: CraftBrand): string {
  for (const role of COLOR_ROLES) {
    if (color.toLowerCase() === from.colors[role].toLowerCase()) return to.colors[role];
  }
  return color;
}

export function applyBrand(doc: CraftDocument, brand: CraftBrand): CraftDocument {
  return {
    ...doc,
    brand: cloneBrand(brand),
    pages: doc.pages.map((page) => ({
      ...page,
      background: {
        ...page.background,
        color: remapColor(page.background.color, doc.brand, brand),
        gradientEnd: page.background.gradientEnd
          ? remapColor(page.background.gradientEnd, doc.brand, brand)
          : page.background.gradientEnd,
      },
      nodes: page.nodes.map((node) => applyBrandToNode(node, brand)),
    })),
    updatedAt: new Date().toISOString(),
  };
}

export function isLogoSlot(node: Pick<CraftNode, "name">): boolean {
  return /^(logo|brand logo|logomark)$/i.test(node.name.trim());
}

function parseSvgSize(src: string): { width: number; height: number } | undefined {
  const trimmed = src.trim();
  let xml = trimmed;
  if (/^data:image\/svg\+xml/i.test(trimmed)) {
    const comma = trimmed.indexOf(",");
    if (comma < 0) return undefined;
    const payload = trimmed.slice(comma + 1);
    xml = /;base64/i.test(trimmed.slice(0, comma))
      ? (typeof atob === "function" ? atob(payload) : Buffer.from(payload, "base64").toString("utf8"))
      : (() => {
          try {
            return decodeURIComponent(payload);
          } catch {
            return payload;
          }
        })();
  } else if (!trimmed.startsWith("<svg") && !trimmed.startsWith("<?xml")) {
    return undefined;
  }
  const openTag = xml.match(/<svg\b[^>]*>/i)?.[0];
  if (!openTag) return undefined;
  const num = (attr: string) => {
    const match = openTag.match(new RegExp(`\\s${attr}\\s*=\\s*['"]?([\\d.]+)`, "i"));
    const value = match ? Number(match[1]) : NaN;
    return Number.isFinite(value) && value > 0 ? value : undefined;
  };
  const width = num("width");
  const height = num("height");
  if (width && height) return { width, height };
  const viewBox = xml.match(/viewBox\s*=\s*["']\s*[-\d.]+\s+[-\d.]+\s+([-\d.]+)\s+([-\d.]+)/i);
  if (!viewBox) return undefined;
  const vw = Number(viewBox[1]);
  const vh = Number(viewBox[2]);
  if (!(vw > 0 && vh > 0)) return undefined;
  return { width: vw, height: vh };
}

export function logoAspectRatio(asset: Pick<CraftAsset, "dataUrl"> & { width?: number; height?: number }): number {
  if (asset.width && asset.height && asset.width > 0 && asset.height > 0) return asset.width / asset.height;
  const parsed = parseSvgSize(asset.dataUrl);
  if (parsed) return parsed.width / parsed.height;
  return 1;
}

export function fitLogoSize(maxWidth: number, maxHeight: number, aspect: number): { width: number; height: number } {
  const ratio = aspect > 0 ? aspect : 1;
  let width = Math.max(1, maxWidth);
  let height = width / ratio;
  if (height > maxHeight) {
    height = Math.max(1, maxHeight);
    width = height * ratio;
  }
  return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
}

function makeLogoNode(
  page: CraftPage,
  logo: CraftAsset,
  slot?: Pick<CraftNode, "id" | "x" | "y" | "width" | "height" | "rotation" | "opacity">,
): ImageNode {
  const pad = Math.round(Math.min(page.width, page.height) * 0.045);
  const maxWidth = slot?.width ?? Math.round(Math.min(page.width * 0.22, 220));
  const maxHeight = slot?.height ?? Math.round(Math.min(page.height * 0.14, 120));
  const { width, height } = fitLogoSize(maxWidth, maxHeight, logoAspectRatio(logo));
  return {
    id: slot?.id ?? uid("image"),
    name: "Logo",
    type: "image",
    x: slot?.x ?? pad,
    y: slot?.y ?? pad,
    width,
    height,
    rotation: slot?.rotation ?? 0,
    opacity: slot?.opacity ?? 1,
    locked: false,
    hidden: false,
    constraints: { horizontal: "start", vertical: "start" },
    assetId: logo.id,
    objectFit: "contain",
    brightness: 1,
    contrast: 1,
  };
}

export function applyBrandLogo(doc: CraftDocument, logo: CraftAsset | null): CraftDocument {
  if (!logo) {
    const previousId = doc.brand.logoAssetId;
    return {
      ...doc,
      brand: { ...cloneBrand(doc.brand), logoAssetId: undefined },
      pages: doc.pages.map((page) => ({
        ...page,
        nodes: page.nodes.filter((node) => !(node.type === "image" && isLogoSlot(node))),
      })),
      assets: previousId ? doc.assets.filter((asset) => asset.id !== previousId) : doc.assets,
      updatedAt: new Date().toISOString(),
    };
  }

  const assets = [...doc.assets.filter((asset) => asset.id !== logo.id && asset.id !== doc.brand.logoAssetId), logo];
  const pages = doc.pages.map((page) => {
    if (page.nodes.some(isLogoSlot)) {
      return {
        ...page,
        nodes: page.nodes.map((node) => (isLogoSlot(node) ? makeLogoNode(page, logo, node) : node)),
      };
    }
    return { ...page, nodes: [...page.nodes, makeLogoNode(page, logo)] };
  });
  return {
    ...doc,
    assets,
    pages,
    brand: { ...cloneBrand(doc.brand), logoAssetId: logo.id },
    updatedAt: new Date().toISOString(),
  };
}

export interface PaletteSwatch {
  r: number;
  g: number;
  b: number;
  count: number;
  lum: number;
  sat: number;
}

function hex2(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return 0;
  return d / (1 - Math.abs(2 * l - 1));
}

function distinct(a: PaletteSwatch, b: PaletteSwatch): boolean {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b) > 36;
}

export function paletteFromPixels(data: Uint8ClampedArray | Uint8Array): Record<ColorRole, string> {
  const buckets = new Map<number, { r: number; g: number; b: number; count: number }>();
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 48) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.count += 1;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }
  }

  const swatches: PaletteSwatch[] = Array.from(buckets.values())
    .map((bucket) => {
      const r = bucket.r / bucket.count;
      const g = bucket.g / bucket.count;
      const b = bucket.b / bucket.count;
      return { r, g, b, count: bucket.count, lum: luminance(r, g, b), sat: saturation(r, g, b) };
    })
    .sort((a, b) => b.count - a.count);

  const fallback: Record<ColorRole, string> = { ...DEFAULT_BRAND.colors };
  if (!swatches.length) return fallback;

  const dark = [...swatches].filter((item) => item.lum < 0.42).sort((a, b) => a.lum - b.lum)[0] ?? swatches[swatches.length - 1];
  const light = [...swatches].filter((item) => item.lum > 0.72).sort((a, b) => b.lum - a.lum)[0];
  const accent =
    [...swatches]
      .filter((item) => item.sat > 0.18 && item.lum > 0.16 && item.lum < 0.84)
      .sort((a, b) => b.sat * Math.log(1 + b.count) - a.sat * Math.log(1 + a.count))[0] ?? swatches[0];
  const secondary =
    swatches.find((item) => distinct(item, accent) && item.lum > 0.45) ??
    light ??
    { r: 244, g: 244, b: 245, count: 1, lum: 0.96, sat: 0 };
  const mutedMix = {
    r: dark.r * 0.35 + (light?.r ?? 220) * 0.65,
    g: dark.g * 0.35 + (light?.g ?? 220) * 0.65,
    b: dark.b * 0.35 + (light?.b ?? 220) * 0.65,
    count: 1,
    lum: 0.55,
    sat: 0,
  };

  return {
    primary: rgbToHex(dark.r, dark.g, dark.b),
    secondary: rgbToHex(secondary.r, secondary.g, secondary.b),
    accent: rgbToHex(accent.r, accent.g, accent.b),
    background: light ? rgbToHex(light.r, light.g, light.b) : "#ffffff",
    text: rgbToHex(dark.r, dark.g, dark.b),
    muted: rgbToHex(mutedMix.r, mutedMix.g, mutedMix.b),
  };
}

function decodeBase64(payload: string): string {
  if (typeof atob === "function") return atob(payload);
  return Buffer.from(payload, "base64").toString("utf8");
}

function toSvgDataUrl(xml: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
}

/** Give SVG logos explicit width/height so canvas sampling is reliable. */
export function prepareLogoSrc(src: string): string {
  const trimmed = src.trim();
  const isDataSvg = /^data:image\/svg\+xml/i.test(trimmed);
  const isRawSvg = trimmed.startsWith("<svg") || trimmed.startsWith("<?xml");
  if (!isDataSvg && !isRawSvg) return src;

  let xml = trimmed;
  if (isDataSvg) {
    const comma = trimmed.indexOf(",");
    if (comma < 0) return src;
    const payload = trimmed.slice(comma + 1);
    xml = /;base64/i.test(trimmed.slice(0, comma)) ? decodeBase64(payload) : decodeURIComponent(payload);
  }

  const openTag = xml.match(/<svg\b[^>]*>/i)?.[0];
  if (!openTag) return src;
  if (/\swidth\s*=/i.test(openTag) && /\sheight\s*=/i.test(openTag)) {
    return isDataSvg && /<svg\b[^>]*\swidth\s*=/i.test(src) && /<svg\b[^>]*\sheight\s*=/i.test(src)
      ? src
      : toSvgDataUrl(xml);
  }

  const viewBox = xml.match(/viewBox\s*=\s*["']\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/i);
  const width = viewBox ? Math.max(1, Math.round(Number(viewBox[3]))) : 256;
  const height = viewBox ? Math.max(1, Math.round(Number(viewBox[4]))) : 256;
  return toSvgDataUrl(xml.replace(/<svg\b/i, `<svg width="${width}" height="${height}"`));
}

export async function extractPaletteFromImage(src: string): Promise<Record<ColorRole, string>> {
  if (typeof Image === "undefined" || typeof document === "undefined") {
    throw new Error("Logo colour extraction needs a browser canvas.");
  }
  const prepared = prepareLogoSrc(src);
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Could not read that logo."));
    img.src = prepared;
  });
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 128 / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height, 1));
  canvas.width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
  canvas.height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not sample the logo.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return paletteFromPixels(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
}

export function readDefaultPresetId(): "post" | "a4" | "square" {
  try {
    const prefs = JSON.parse(localStorage.getItem("quires:settings:v2") ?? "{}") as {
      appDefaults?: { createCanvas?: string };
    };
    const value = prefs.appDefaults?.createCanvas;
    if (value === "a4" || value === "square" || value === "post") return value;
  } catch {
    // ignore malformed settings
  }
  return "post";
}
