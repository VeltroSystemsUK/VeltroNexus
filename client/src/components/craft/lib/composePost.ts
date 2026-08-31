import { COPY_LIMITS, defaultEyebrow, type CraftCopyPatch, type CraftPost } from "@shared/craftQueue";
import { spawnSizes } from "./adapt";
import { applyBrand, applyBrandLogo, cloneBrand } from "./brand";
import { documentFromTemplate } from "./templates";
import {
  applyFrameShape,
  applyImageLook,
  applyNodeMotion,
  applyNodeShadow,
  type FrameShapeId,
  type ImageLookId,
  type ImageMotionId,
  type ShadowPresetId,
} from "./looks";
import { uid, type CraftAsset, type CraftBrand, type CraftDocument, type CraftNode, type CraftPage, type ImageNode, type TextNode } from "./types";

export type CreativeDirection = {
  frame: FrameShapeId;
  shadow: ShadowPresetId;
  visualMotion: ImageMotionId;
  hookMotion: ImageMotionId;
};

const WEEK_LOOKS: Record<string, CreativeDirection> = {
  Mon: { frame: "arch", shadow: "drop", visualMotion: "fadeIn", hookMotion: "slideIn" },
  Tue: { frame: "round", shadow: "soft", visualMotion: "pop", hookMotion: "fadeIn" },
  Wed: { frame: "polaroid", shadow: "drop", visualMotion: "slideIn", hookMotion: "pop" },
  Thu: { frame: "hex", shadow: "soft", visualMotion: "fadeIn", hookMotion: "slideIn" },
  Fri: { frame: "ticket", shadow: "hard", visualMotion: "pop", hookMotion: "fadeIn" },
  Sat: { frame: "diamond", shadow: "drop", visualMotion: "slideIn", hookMotion: "pop" },
  Sun: { frame: "star", shadow: "soft", visualMotion: "fadeIn", hookMotion: "pop" },
};

export function creativeDirectionFor(weekday: string): CreativeDirection {
  return WEEK_LOOKS[weekday] ?? WEEK_LOOKS.Mon!;
}

export function applyCreativeDirection(doc: CraftDocument, post: CraftPost): CraftDocument {
  const look = creativeDirectionFor(post.weekday);
  return {
    ...doc,
    pages: doc.pages.map((page) => ({
      ...page,
      nodes: page.nodes.map((node) => {
        if (node.type === "image" && node.name === "Visual") {
          return applyNodeMotion(
            applyNodeShadow(applyFrameShape(node, look.frame), look.shadow),
            look.visualMotion,
          ) as ImageNode;
        }
        if (node.type === "text" && (node.name === "Hook 1" || node.name === "Hook 2")) {
          return applyNodeMotion(node, look.hookMotion);
        }
        return node;
      }),
    })),
    updatedAt: new Date().toISOString(),
  };
}

export const STRATA_BRAND: CraftBrand = {
  name: "Strata Finance",
  colors: {
    primary: "#0f172a",
    secondary: "#f8fafc",
    accent: "#059669",
    background: "#ffffff",
    text: "#0f172a",
    muted: "#64748b",
  },
  headingFont: "Unbounded",
  bodyFont: "Plus Jakarta Sans",
};

function templateFor(post: CraftPost): string {
  if (post.presetId === "square") return "quote-square";
  if (post.presetId === "story") return "story-launch";
  if (post.track === "introducer") return "announce-post";
  return "og-banner";
}

function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > 40 ? cut.slice(0, sp) : cut).trim()}…`;
}

function ctaLabel(post: CraftPost): string {
  return clip(post.cta.trim(), COPY_LIMITS.cta).replace(/…$/, "");
}

type Fills = {
  eyebrow: string;
  hook: string;
  hook2: string;
  deck: string;
  cta: string;
  hashtags: string;
  link: string;
  handle: string;
  brand: string;
  role: string;
};

function fillsFor(post: CraftPost): Fills {
  return {
    eyebrow: clip(post.eyebrow || defaultEyebrow(post.track), COPY_LIMITS.eyebrow).replace(/…$/, ""),
    hook: clip(post.hook, COPY_LIMITS.hook).replace(/…$/, ""),
    hook2: clip(post.hook2 ?? "", COPY_LIMITS.hook2).replace(/…$/, ""),
    deck: clip(post.body, COPY_LIMITS.body).replace(/…$/, ""),
    cta: ctaLabel(post),
    hashtags: (post.hashtags ?? []).slice(0, COPY_LIMITS.hashtags).join("  "),
    link: (post.links ?? [])[0] ?? "",
    handle: "@stratafinance",
    brand: "STRATA",
    role: post.track === "introducer" ? "Introducer desk" : "SME directors",
  };
}

export function copyFieldForNodeName(name: string): keyof CraftCopyPatch | null {
  const n = name.toLowerCase();
  if (n === "mark") return null;
  if (/eyebrow|kicker/.test(n)) return "eyebrow";
  if (/hook 2|hero 2/.test(n)) return "hook2";
  if (/headline|title|quote|^hook$|hook 1|hero 1/.test(n)) return "hook";
  if (/deck|support|body|^sub$/.test(n)) return "body";
  if (n.includes("cta")) return "cta";
  if (n.includes("hashtag")) return "hashtags";
  if (n === "link" || n === "url") return "links";
  return null;
}

export function copyPatchFromNode(name: string, text: string): CraftCopyPatch | null {
  const field = copyFieldForNodeName(name);
  if (!field) return null;
  const raw = text.trim();
  if (field === "eyebrow") return { eyebrow: raw.slice(0, COPY_LIMITS.eyebrow) };
  if (field === "hook") return { hook: raw.slice(0, COPY_LIMITS.hook) };
  if (field === "hook2") return { hook2: raw.slice(0, COPY_LIMITS.hook2) };
  if (field === "body") return { body: raw.slice(0, COPY_LIMITS.body) };
  if (field === "cta") return { cta: raw.slice(0, COPY_LIMITS.cta) };
  if (field === "hashtags") return { hashtags: raw };
  if (field === "links") return { links: raw };
  return null;
}

function fillNode(node: CraftNode, fills: Fills, brand: CraftBrand): CraftNode {
  if (node.type !== "text") return node;
  const n = node.name.toLowerCase();
  if (/wordmark/.test(n)) return { ...node, text: fills.brand };
  const field = copyFieldForNodeName(node.name);
  if (field === "eyebrow") return { ...node, text: fills.eyebrow };
  if (field === "hook") return { ...node, text: fills.hook };
  if (field === "hook2") {
    return { ...node, text: fills.hook2, role: "accent", color: brand.colors.accent };
  }
  if (field === "body") return { ...node, text: fills.deck };
  if (field === "cta") return { ...node, text: fills.cta };
  if (field === "hashtags") return { ...node, text: fills.hashtags };
  if (field === "links") return { ...node, text: fills.link };
  if (/handle/.test(n)) return { ...node, text: fills.handle };
  if (/name|source/.test(n)) return { ...node, text: fills.brand };
  if (/role/.test(n)) return { ...node, text: fills.role };
  return node;
}

function slotText(
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  size: number,
): TextNode {
  return {
    id: uid("text"),
    name,
    type: "text",
    text: "",
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    constraints: { horizontal: "start", vertical: "end" },
    role: name === "CTA label" ? "secondary" : name === "Link" ? "accent" : "muted",
    fontRole: "body",
    fontFamily: STRATA_BRAND.bodyFont,
    fontWeight: "600",
    fontSize: size,
    align: name === "CTA label" ? "center" : "left",
    letterSpacing: 0,
    lineHeight: 1.2,
    color: "#64748b",
  };
}

function hasTextNamed(page: CraftPage, test: (name: string) => boolean): boolean {
  return page.nodes.some((node) => node.type === "text" && test(node.name.toLowerCase()));
}

function ensureCopySlots(page: CraftPage): CraftPage {
  const extras: CraftNode[] = [];
  const pad = Math.round(Math.min(page.width, page.height) * 0.055);
  const width = Math.max(220, page.width - pad * 2);
  if (!hasTextNamed(page, (n) => n.includes("cta"))) {
    extras.push(slotText("CTA label", pad, page.height - pad - 100, Math.min(280, width * 0.5), 36, 18));
  }
  if (!hasTextNamed(page, (n) => n.includes("hashtag"))) {
    extras.push(slotText("Hashtags", pad, page.height - pad - 58, width, 28, 14));
  }
  if (!hasTextNamed(page, (n) => n === "link" || n === "url")) {
    extras.push(slotText("Link", pad, page.height - pad - 26, width, 22, 14));
  }
  if (!extras.length) return page;
  return { ...page, nodes: [...page.nodes, ...extras] };
}

function ensureHeroSplit(page: CraftPage): CraftPage {
  if (hasTextNamed(page, (n) => n === "hook 2" || n === "hero 2")) return page;
  const hero = page.nodes.find(
    (node) => node.type === "text" && copyFieldForNodeName(node.name) === "hook",
  );
  if (!hero || hero.type !== "text") return page;
  const gap = Math.max(4, Math.round(hero.fontSize * 0.12));
  const h1 = Math.max(Math.round(hero.fontSize * 1.15), Math.round(hero.height * 0.48));
  const h2 = Math.max(Math.round(hero.fontSize * 1.15), hero.height - h1 - gap);
  const first: TextNode = { ...hero, name: "Hook 1", height: h1, role: "text", fontRole: "heading" };
  const second: TextNode = {
    ...hero,
    id: uid("text"),
    name: "Hook 2",
    y: hero.y + h1 + gap,
    height: h2,
    role: "accent",
    fontRole: "heading",
  };
  return {
    ...page,
    nodes: page.nodes.flatMap((node) => (node.id === hero.id ? [first, second] : node)),
  };
}

function fillPage(page: CraftPage, fills: Fills, brand: CraftBrand): CraftPage {
  const withSlots = ensureHeroSplit(ensureCopySlots(page));
  return { ...withSlots, nodes: withSlots.nodes.map((node) => fillNode(node, fills, brand)) };
}

export function applyPostCopy(doc: CraftDocument, post: CraftPost): CraftDocument {
  const fills = fillsFor(post);
  return {
    ...doc,
    title: post.title,
    pages: doc.pages.map((page) => fillPage(page, fills, doc.brand)),
    updatedAt: new Date().toISOString(),
  };
}

function isVisualSlot(node: CraftNode): boolean {
  const name = node.name.toLowerCase();
  if (name === "media frame" || name === "visual") return true;
  if (name === "accent" && node.width * node.height > 80_000) return true;
  return false;
}

export function applyPostVisual(
  doc: CraftDocument,
  asset: CraftAsset,
  look: ImageLookId = "plain",
): CraftDocument {
  const assets = [...doc.assets.filter((item) => item.id !== asset.id), asset];
  const pages = doc.pages.map((page) => {
    const slot = [...page.nodes].reverse().find(isVisualSlot);
    if (!slot) return page;
    const visual: ImageNode = applyImageLook({
      id: slot.id,
      name: "Visual",
      type: "image",
      x: slot.x,
      y: slot.y,
      width: slot.width,
      height: slot.height,
      rotation: slot.rotation,
      opacity: 1,
      locked: false,
      hidden: false,
      constraints: slot.constraints,
      assetId: asset.id,
      objectFit: "cover",
      brightness: 1,
      contrast: 1,
      mask: slot.type === "shape" && slot.variant === "rounded-rect" ? "rounded-rect" : undefined,
    }, look);
    return {
      ...page,
      nodes: page.nodes.map((node) => (node.id === slot.id ? visual : node)),
    };
  });
  return { ...doc, assets, pages, updatedAt: new Date().toISOString() };
}

export function composeSocialPost(
  post: CraftPost,
  brand: CraftBrand = STRATA_BRAND,
  logo: CraftAsset | null = null,
): CraftDocument {
  const kit = cloneBrand(brand);
  let doc = documentFromTemplate(templateFor(post), kit);
  doc = applyBrand(doc, kit);
  doc = {
    ...doc,
    id: post.id,
    title: post.title,
    updatedAt: new Date().toISOString(),
  };
  const home = doc.pages[0];
  if (home) {
    doc = spawnSizes(doc, home.id, ["square", "story"]);
    doc = { ...doc, activePageId: home.id };
  }
  doc = applyPostCopy(doc, post);
  if (logo) doc = applyBrandLogo(doc, logo);
  return applyCreativeDirection(doc, post);
}
