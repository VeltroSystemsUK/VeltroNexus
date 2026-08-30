export const CRAFT_SCHEMA = "quires.craft.v1";
export const CRAFT_APP = "QUIRES CRAFT";
export const CRAFT_VERSION = "0.1.0";

export type Constraint = "start" | "end" | "center" | "scale" | "stretch";
export type ShapeVariant =
  | "rect"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "star"
  | "arrow"
  | "rounded-rect"
  | "line"
  | "hexagon"
  | "pentagon"
  | "octagon"
  | "chevron"
  | "heart"
  | "speech"
  | "cloud"
  | "banner"
  | "cross"
  | "parallelogram";

export const ALL_SHAPE_VARIANTS: ShapeVariant[] = [
  "rect",
  "ellipse",
  "rounded-rect",
  "triangle",
  "diamond",
  "star",
  "arrow",
  "line",
  "hexagon",
  "pentagon",
  "octagon",
  "chevron",
  "heart",
  "speech",
  "cloud",
  "banner",
  "cross",
  "parallelogram",
];
export type TextAlign = "left" | "center" | "right";
export type FillMode = "solid" | "gradient";
export type BgMode = "solid" | "gradient";
export type AnimationType = "none" | "fadeIn" | "slideIn" | "pop" | "pulse" | "bounce" | "spin";
export type ColorRole = "primary" | "secondary" | "accent" | "background" | "text" | "muted";
export type FontRole = "heading" | "body";
export type TextFit = "none" | "shrink";
export type TextOverflow = "visible" | "clip";
export type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "rotate";

export interface Constraints {
  horizontal: Constraint;
  vertical: Constraint;
}

export interface AnimationSpec {
  type: AnimationType;
  duration: number;
  delay: number;
}

export interface DropShadow {
  color: string;
  blur: number;
  x: number;
  y: number;
}

export interface TextOutline {
  color: string;
  width: number;
}

export interface NodeBase {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  hidden: boolean;
  flipX?: boolean;
  flipY?: boolean;
  groupId?: string;
  groupName?: string;
  constraints: Constraints;
  role?: ColorRole;
  animation?: AnimationSpec;
  shadow?: DropShadow;
}

export interface TextNode extends NodeBase {
  type: "text";
  text: string;
  fontFamily: string;
  fontWeight: "400" | "600" | "700" | "800";
  fontSize: number;
  align: TextAlign;
  letterSpacing: number;
  lineHeight: number;
  color: string;
  fontRole?: FontRole;
  outline?: TextOutline;
  uppercase?: boolean;
  textFit?: TextFit;
  overflow?: TextOverflow;
}

export interface ShapeNode extends NodeBase {
  type: "shape";
  variant: ShapeVariant;
  fill: string;
  fillMode: FillMode;
  gradientEnd?: string;
  stroke: string;
  strokeWidth: number;
  borderRadius: number;
}

export type MaskShape = "none" | "rect" | "ellipse" | "rounded-rect" | "diamond" | "hexagon" | "arch" | "ticket";

export interface ImageCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageNode extends NodeBase {
  type: "image";
  assetId: string;
  objectFit: "cover" | "contain" | "fill";
  brightness: number;
  contrast: number;
  grayscale?: number;
  tint?: string;
  tintOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  crop?: ImageCrop;
  mask?: Exclude<MaskShape, "none">;
}

export interface PathPoint {
  x: number;
  y: number;
}

export interface PathNode extends NodeBase {
  type: "path";
  points: PathPoint[];
  closed: boolean;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export type CraftNode = TextNode | ShapeNode | ImageNode | PathNode;

export interface AutoLayout {
  direction: "row" | "column";
  gap: number;
  padding: number;
  align: "start" | "center" | "end";
}

export const DEFAULT_CROP: ImageCrop = { x: 0, y: 0, width: 1, height: 1 };
export const DEFAULT_LAYOUT: AutoLayout = { direction: "row", gap: 16, padding: 0, align: "start" };

export interface CraftAsset {
  id: string;
  name: string;
  mime: string;
  dataUrl: string;
  width?: number;
  height?: number;
}

export interface CraftFont {
  id: string;
  family: string;
  assetId: string;
}

export interface CraftDeck {
  lines: string[];
}

export interface CraftBrand {
  name: string;
  colors: Record<ColorRole, string>;
  headingFont: string;
  bodyFont: string;
  logoAssetId?: string;
}

export interface CraftPage {
  id: string;
  name: string;
  presetId: string;
  width: number;
  height: number;
  background: {
    mode: BgMode;
    color: string;
    gradientEnd?: string;
    angle?: number;
  };
  nodes: CraftNode[];
  layouts?: Record<string, AutoLayout>;
}

export interface CraftVersion {
  id: string;
  timestamp: number;
  note: string;
  snapshot: CraftDocument;
}

export interface CraftDocument {
  schema: string;
  app: string;
  version: string;
  id: string;
  title: string;
  brand: CraftBrand;
  pages: CraftPage[];
  activePageId: string;
  assets: CraftAsset[];
  fonts?: CraftFont[];
  deck?: CraftDeck;
  versions?: CraftVersion[];
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_CONSTRAINTS: Constraints = { horizontal: "start", vertical: "start" };
export const DEFAULT_ANIMATION: AnimationSpec = { type: "none", duration: 600, delay: 0 };

export const DEFAULT_BRAND: CraftBrand = {
  name: "Studio",
  colors: {
    primary: "#111118",
    secondary: "#f4f4f5",
    accent: "#ff006e",
    background: "#ffffff",
    text: "#111118",
    muted: "#6b7280",
  },
  headingFont: "Playfair Display",
  bodyFont: "Inter",
};

export function uid(prefix = "n"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function cloneDocument(doc: CraftDocument): CraftDocument {
  return JSON.parse(JSON.stringify(doc)) as CraftDocument;
}

export function snapshotForVersion(doc: CraftDocument): CraftDocument {
  const snapshot = cloneDocument(doc);
  snapshot.versions = [];
  return snapshot;
}

export function defaultConstraintsFor(kind: "bar" | "title" | "image" | "body"): Constraints {
  if (kind === "bar") return { horizontal: "stretch", vertical: "start" };
  if (kind === "title") return { horizontal: "stretch", vertical: "start" };
  if (kind === "image") return { horizontal: "scale", vertical: "scale" };
  return { horizontal: "start", vertical: "start" };
}

export function blankPage(presetId: string, width: number, height: number, name = "Artboard"): CraftPage {
  return {
    id: uid("page"),
    name,
    presetId,
    width,
    height,
    background: { mode: "solid", color: DEFAULT_BRAND.colors.background },
    nodes: [],
  };
}

export function blankDocument(title = "Untitled Design"): CraftDocument {
  const page = blankPage("post", 1080, 1350, "Social Post");
  const now = new Date().toISOString();
  return {
    schema: CRAFT_SCHEMA,
    app: CRAFT_APP,
    version: CRAFT_VERSION,
    id: uid("craft"),
    title,
    brand: { ...DEFAULT_BRAND, colors: { ...DEFAULT_BRAND.colors } },
    pages: [page],
    activePageId: page.id,
    assets: [],
    fonts: [],
    deck: { lines: [] },
    versions: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function activePage(doc: CraftDocument): CraftPage {
  return doc.pages.find((page) => page.id === doc.activePageId) ?? doc.pages[0];
}

export function findNode(nodes: CraftNode[], id: string): CraftNode | undefined {
  return nodes.find((node) => node.id === id);
}

export function replaceNodes(page: CraftPage, nodes: CraftNode[]): CraftPage {
  return { ...page, nodes };
}

export function duplicatePage(doc: CraftDocument, pageId: string): CraftDocument {
  const source = doc.pages.find((page) => page.id === pageId);
  if (!source) return doc;
  const copy: CraftPage = JSON.parse(JSON.stringify(source)) as CraftPage;
  copy.id = uid("page");
  copy.name = `${source.name} copy`;
  copy.nodes = copy.nodes.map((node) => ({ ...node, id: uid(node.type) }));
  const index = doc.pages.findIndex((page) => page.id === pageId);
  const pages = [...doc.pages];
  pages.splice(index + 1, 0, copy);
  return { ...doc, pages, activePageId: copy.id, updatedAt: new Date().toISOString() };
}

export function deletePage(doc: CraftDocument, pageId: string): CraftDocument {
  if (doc.pages.length <= 1) return doc;
  const pages = doc.pages.filter((page) => page.id !== pageId);
  const activePageId = doc.activePageId === pageId ? pages[Math.max(0, doc.pages.findIndex((page) => page.id === pageId) - 1)]?.id ?? pages[0].id : doc.activePageId;
  return { ...doc, pages, activePageId, updatedAt: new Date().toISOString() };
}

export function renamePage(doc: CraftDocument, pageId: string, name: string): CraftDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) => (page.id === pageId ? { ...page, name: name.trim() || page.name } : page)),
    updatedAt: new Date().toISOString(),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function asConstraint(value: unknown, fallback: Constraint): Constraint {
  return value === "start" || value === "end" || value === "center" || value === "scale" || value === "stretch"
    ? value
    : fallback;
}

function normalizeNode(raw: unknown, index: number): CraftNode {
  const node = asRecord(raw) ?? {};
  const type = node.type === "text" || node.type === "image" || node.type === "path" ? node.type : "shape";
  const base: NodeBase = {
    id: asString(node.id, uid("n")),
    name: asString(node.name, type === "text" ? "Text" : type === "image" ? "Image" : type === "path" ? "Path" : "Shape"),
    x: asNumber(node.x, 40 + index * 8),
    y: asNumber(node.y, 40 + index * 8),
    width: asNumber(node.width, 200),
    height: asNumber(node.height, 80),
    rotation: asNumber(node.rotation, 0),
    opacity: asNumber(node.opacity, 1),
    locked: node.locked === true,
    hidden: node.hidden === true,
    flipX: node.flipX === true,
    flipY: node.flipY === true,
    groupId: typeof node.groupId === "string" ? node.groupId : undefined,
    groupName: typeof node.groupName === "string" ? node.groupName : undefined,
    constraints: {
      horizontal: asConstraint(asRecord(node.constraints)?.horizontal, "start"),
      vertical: asConstraint(asRecord(node.constraints)?.vertical, "start"),
    },
    role:
      node.role === "primary" ||
      node.role === "secondary" ||
      node.role === "accent" ||
      node.role === "background" ||
      node.role === "text" ||
      node.role === "muted"
        ? node.role
        : undefined,
    animation: asRecord(node.animation)
      ? {
          type: (asString(asRecord(node.animation)?.type, "none") as AnimationType) || "none",
          duration: asNumber(asRecord(node.animation)?.duration, 600),
          delay: asNumber(asRecord(node.animation)?.delay, 0),
        }
      : undefined,
    shadow: asRecord(node.shadow)
      ? {
          color: asString(asRecord(node.shadow)?.color, "#000000"),
          blur: asNumber(asRecord(node.shadow)?.blur, 16),
          x: asNumber(asRecord(node.shadow)?.x, 0),
          y: asNumber(asRecord(node.shadow)?.y, 8),
        }
      : undefined,
  };

  if (type === "text") {
    return {
      ...base,
      type: "text",
      text: asString(node.text, "Text"),
      fontFamily: asString(node.fontFamily, DEFAULT_BRAND.bodyFont),
      fontWeight:
        node.fontWeight === "400" || node.fontWeight === "600" || node.fontWeight === "700" || node.fontWeight === "800"
          ? node.fontWeight
          : "700",
      fontSize: asNumber(node.fontSize, 32),
      align: node.align === "center" || node.align === "right" ? node.align : "left",
      letterSpacing: asNumber(node.letterSpacing, 0),
      lineHeight: asNumber(node.lineHeight, 1.18),
      color: asString(node.color, DEFAULT_BRAND.colors.text),
      fontRole: node.fontRole === "heading" || node.fontRole === "body" ? node.fontRole : undefined,
      outline: asRecord(node.outline)
        ? {
            color: asString(asRecord(node.outline)?.color, "#000000"),
            width: asNumber(asRecord(node.outline)?.width, 2),
          }
        : undefined,
      uppercase: node.uppercase === true,
      textFit: node.textFit === "shrink" ? "shrink" : undefined,
      overflow: node.overflow === "clip" ? "clip" : undefined,
    };
  }

  if (type === "image") {
    const crop = asRecord(node.crop);
    return {
      ...base,
      type: "image",
      assetId: asString(node.assetId, ""),
      objectFit: node.objectFit === "contain" || node.objectFit === "fill" ? node.objectFit : "cover",
      brightness: asNumber(node.brightness, 1),
      contrast: asNumber(node.contrast, 1),
      grayscale: node.grayscale !== undefined ? asNumber(node.grayscale, 0) : undefined,
      tint: typeof node.tint === "string" ? node.tint : undefined,
      tintOpacity: node.tintOpacity !== undefined ? asNumber(node.tintOpacity, 0) : undefined,
      stroke: typeof node.stroke === "string" ? node.stroke : undefined,
      strokeWidth: node.strokeWidth !== undefined ? asNumber(node.strokeWidth, 0) : undefined,
      crop: crop
        ? {
            x: clamp01(asNumber(crop.x, 0)),
            y: clamp01(asNumber(crop.y, 0)),
            width: clamp01(asNumber(crop.width, 1)),
            height: clamp01(asNumber(crop.height, 1)),
          }
        : undefined,
      mask:
        node.mask === "ellipse" ||
        node.mask === "rounded-rect" ||
        node.mask === "rect" ||
        node.mask === "diamond" ||
        node.mask === "hexagon" ||
        node.mask === "arch" ||
        node.mask === "ticket"
          ? node.mask
          : undefined,
    };
  }

  if (type === "path") {
    const points = Array.isArray(node.points)
      ? node.points
          .map((point) => {
            const rec = asRecord(point);
            return rec ? { x: asNumber(rec.x, 0), y: asNumber(rec.y, 0) } : null;
          })
          .filter((point): point is PathPoint => Boolean(point))
      : [];
    return {
      ...base,
      type: "path",
      points,
      closed: node.closed === true,
      fill: asString(node.fill, "transparent"),
      stroke: asString(node.stroke, DEFAULT_BRAND.colors.accent),
      strokeWidth: asNumber(node.strokeWidth, 4),
    };
  }

  const variant = ALL_SHAPE_VARIANTS.includes(node.variant as ShapeVariant)
    ? (node.variant as ShapeVariant)
    : "rect";

  return {
    ...base,
    type: "shape",
    variant,
    fill: asString(node.fill, DEFAULT_BRAND.colors.accent),
    fillMode: node.fillMode === "gradient" ? "gradient" : "solid",
    gradientEnd: typeof node.gradientEnd === "string" ? node.gradientEnd : undefined,
    stroke: asString(node.stroke, "transparent"),
    strokeWidth: asNumber(node.strokeWidth, 0),
    borderRadius: asNumber(node.borderRadius, variant === "rounded-rect" ? 24 : 0),
  };
}

function normalizeBrand(raw: unknown): CraftBrand {
  const brand = asRecord(raw) ?? {};
  const colors = asRecord(brand.colors) ?? {};
  return {
    name: asString(brand.name, DEFAULT_BRAND.name),
    colors: {
      primary: asString(colors.primary, DEFAULT_BRAND.colors.primary),
      secondary: asString(colors.secondary, DEFAULT_BRAND.colors.secondary),
      accent: asString(colors.accent, DEFAULT_BRAND.colors.accent),
      background: asString(colors.background, DEFAULT_BRAND.colors.background),
      text: asString(colors.text, DEFAULT_BRAND.colors.text),
      muted: asString(colors.muted, DEFAULT_BRAND.colors.muted),
    },
    headingFont: asString(brand.headingFont, DEFAULT_BRAND.headingFont),
    bodyFont: asString(brand.bodyFont, DEFAULT_BRAND.bodyFont),
    logoAssetId: typeof brand.logoAssetId === "string" ? brand.logoAssetId : undefined,
  };
}

function normalizePage(raw: unknown, index: number): CraftPage {
  const page = asRecord(raw) ?? {};
  const background = asRecord(page.background) ?? {};
  const nodes = Array.isArray(page.nodes) ? page.nodes.map(normalizeNode) : [];
  return {
    id: asString(page.id, uid("page")),
    name: asString(page.name, `Artboard ${index + 1}`),
    presetId: asString(page.presetId, "custom"),
    width: asNumber(page.width, 1080),
    height: asNumber(page.height, 1350),
    background: {
      mode: background.mode === "gradient" ? "gradient" : "solid",
      color: asString(background.color, DEFAULT_BRAND.colors.background),
      gradientEnd: typeof background.gradientEnd === "string" ? background.gradientEnd : undefined,
      angle: asNumber(background.angle, 135),
    },
    nodes,
    layouts: asRecord(page.layouts)
      ? Object.fromEntries(
          Object.entries(asRecord(page.layouts) ?? {}).map(([id, value]) => {
            const layout = asRecord(value) ?? {};
            return [
              id,
              {
                direction: layout.direction === "column" ? "column" : "row",
                gap: asNumber(layout.gap, 16),
                padding: asNumber(layout.padding, 0),
                align: layout.align === "center" || layout.align === "end" ? layout.align : "start",
              } satisfies AutoLayout,
            ];
          }),
        )
      : undefined,
  };
}

export function normalizeDocument(raw: unknown): CraftDocument {
  const doc = asRecord(raw);
  if (!doc || !Array.isArray(doc.pages) || doc.pages.length === 0) {
    throw new Error("This file is not a SWELL / Craft design.");
  }

  const pages = doc.pages.map(normalizePage);
  const now = new Date().toISOString();
  const activePageId = pages.some((page) => page.id === doc.activePageId) ? asString(doc.activePageId, pages[0].id) : pages[0].id;
  const assets = Array.isArray(doc.assets)
    ? doc.assets
        .map((item) => {
          const asset = asRecord(item);
          if (!asset) return null;
          const width = asNumber(asset.width, 0);
          const height = asNumber(asset.height, 0);
          return {
            id: asString(asset.id, uid("asset")),
            name: asString(asset.name, "Image"),
            mime: asString(asset.mime, "image/png"),
            dataUrl: asString(asset.dataUrl, ""),
            ...(width > 0 ? { width } : {}),
            ...(height > 0 ? { height } : {}),
          } satisfies CraftAsset;
        })
        .filter((asset): asset is CraftAsset => Boolean(asset?.dataUrl))
    : [];

  const fonts = Array.isArray(doc.fonts)
    ? doc.fonts
        .map((item) => {
          const font = asRecord(item);
          if (!font) return null;
          const family = asString(font.family, "");
          const assetId = asString(font.assetId, "");
          if (!family || !assetId) return null;
          return { id: asString(font.id, uid("font")), family, assetId } satisfies CraftFont;
        })
        .filter((font): font is CraftFont => Boolean(font))
    : [];

  const deckRaw = asRecord(doc.deck);
  const deck: CraftDeck = {
    lines: Array.isArray(deckRaw?.lines) ? deckRaw.lines.filter((line): line is string => typeof line === "string" && line.trim().length > 0) : [],
  };

  return {
    schema: CRAFT_SCHEMA,
    app: CRAFT_APP,
    version: CRAFT_VERSION,
    id: asString(doc.id, uid("craft")),
    title: asString(doc.title, "Untitled Design").trim() || "Untitled Design",
    brand: normalizeBrand(doc.brand),
    pages,
    activePageId,
    assets,
    fonts,
    deck,
    versions: Array.isArray(doc.versions) ? (doc.versions as CraftVersion[]) : [],
    createdAt: asString(doc.createdAt, now),
    updatedAt: asString(doc.updatedAt, now),
  };
}
