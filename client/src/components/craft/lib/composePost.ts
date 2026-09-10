import { COPY_LIMITS, completeLine, defaultEyebrow, type CraftCopyPatch, type CraftPost } from "@shared/craftQueue";
import { applyBrand, applyBrandLogo, cloneBrand } from "./brand";
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
import { applyDayContract, applyPlaybookStack, isoWeekId, materialiseWeek, pageMatchesPost, pickWeekVisual } from "./weekGrammar";
import { identityLineFor } from "@shared/craftDirector";

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

export function applyCreativeDirection(doc: CraftDocument, post?: CraftPost): CraftDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) => {
      if (page.daySlot) {
        return applyDayContract(page, page.daySlot, doc.week?.route ?? "sharp-cultural");
      }
      if (!post) return page;
      const look = creativeDirectionFor(post.weekday);
      return {
        ...page,
        nodes: page.nodes.map((node) => {
          if ((node.type === "image" || node.type === "motion") && (node.name === "Visual" || node.name === "Media frame")) {
            return applyNodeMotion(
              applyNodeShadow(applyFrameShape(node, look.frame), look.shadow),
              look.visualMotion,
            ) as typeof node;
          }
          if (node.type === "text" && (node.name === "Hook 1" || node.name === "Hook 2")) {
            return applyNodeMotion(node, look.hookMotion);
          }
          return node;
        }),
      };
    }),
    updatedAt: new Date().toISOString(),
  };
}

export const STRATA_BRAND: CraftBrand = {
  name: "Strata",
  colors: {
    primary: "#1A1D21", // strata-slate-900 (ink)
    secondary: "#2F5199", // strata-blue
    accent: "#C69123", // strata-gold
    background: "#F7F5F1", // strata-paper
    text: "#1A1D21",
    muted: "#6B727C",
  },
  headingFont: "Unbounded",
  bodyFont: "Inter",
};

function clip(text: string, max: number): string {
  return completeLine(text, max);
}

function ctaLabel(post: CraftPost): string {
  return clip(post.cta.trim(), COPY_LIMITS.cta);
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
  identity: string;
  ticker: string;
};

function tickerCount(post: CraftPost): string {
  const blob = `${post.hook} ${post.hook2}`;
  const digits = blob.match(/\b\d{1,4}\b/);
  if (digits) return digits[0]!;
  const word = blob.match(/\b(twenty(?:-[\w]+)?|thirty(?:-[\w]+)?|forty(?:-[\w]+)?|dozen|hundred|thousand)\b/i);
  if (word) return word[0]!;
  return post.hook;
}

function fillsFor(post: CraftPost): Fills {
  const body = clip(post.body, COPY_LIMITS.body);
  return {
    eyebrow: clip(post.eyebrow || defaultEyebrow(post.track), COPY_LIMITS.eyebrow),
    hook: clip(post.hook, COPY_LIMITS.hook),
    hook2: clip(post.hook2 ?? "", COPY_LIMITS.hook2),
    deck: body,
    cta: ctaLabel(post),
    hashtags: (post.hashtags ?? []).slice(0, COPY_LIMITS.hashtags).join("  "),
    link: (post.links ?? [])[0] ?? "",
    handle: "@stratafinance",
    brand: "STRATA",
    role: post.track === "introducer" ? "Introducer desk" : "SME directors",
    identity: identityLineFor(post.id || post.title || post.body),
    ticker: tickerCount(post),
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

/** Queue posts cap board overlay typing. Templates (LinkedIn banner, etc.) do not. */
export function canvasCopyLimit(nodeName: string, assetId: string | null | undefined): number | undefined {
  if (!assetId?.startsWith("mkt-")) return undefined;
  const field = copyFieldForNodeName(nodeName);
  if (field === "eyebrow") return COPY_LIMITS.eyebrow;
  if (field === "hook") return COPY_LIMITS.hook;
  if (field === "hook2") return COPY_LIMITS.hook2;
  if (field === "body") return COPY_LIMITS.body;
  if (field === "cta") return COPY_LIMITS.cta;
  return undefined;
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
  if (node.copyExempt) return node;
  if (node.type !== "text") return node;
  const n = node.name.toLowerCase();
  if (n === "identity") return { ...node, text: fills.identity, locked: true, fontFamily: "JetBrains Mono" };
  if (n === "dataticker" || n === "ticker") return { ...node, text: fills.ticker };
  if (n === "voice") return { ...node, text: [fills.hook, fills.hook2].filter(Boolean).join(" ") };
  if (n === "silence" && fills.hook) return { ...node, text: fills.hook };
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
  const source = page.daySlot ? page : ensureHeroSplit(ensureCopySlots(page));
  const filled = { ...source, nodes: source.nodes.map((node) => fillNode(node, fills, brand)) };
  return applyPlaybookStack(filled, { hook: fills.hook, hook2: fills.hook2 });
}

export function applyPostCopy(doc: CraftDocument, post: CraftPost): CraftDocument {
  const fills = fillsFor(post);
  return {
    ...doc,
    title: doc.week ? doc.title : post.title,
    pages: doc.pages.map((page) => {
      if (doc.week && !pageMatchesPost(page, post)) return page;
      return fillPage(page, fills, doc.brand);
    }),
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
  opts?: { weekFill?: boolean; daySlot?: string; weekday?: string },
): CraftDocument {
  const assets = [...doc.assets.filter((item) => item.id !== asset.id), asset];
  const pages = doc.pages.map((page) => {
    if (opts?.daySlot && page.daySlot !== opts.daySlot) return page;
    if (opts?.weekday && page.name !== opts.weekday) return page;
    if (opts?.weekFill && page.daySlot) {
      const picked = pickWeekVisual(assets, page.daySlot);
      if ("empty" in picked) return page;
      return hangVisual(page, picked.asset, look);
    }
    return hangVisual(page, asset, look);
  });
  return { ...doc, assets, pages, updatedAt: new Date().toISOString() };
}

function hangVisual(page: CraftPage, asset: CraftAsset, look: ImageLookId): CraftPage {
  const slot = [...page.nodes].reverse().find(isVisualSlot);
  if (!slot) return page;
  if (slot.type === "motion") {
    return {
      ...page,
      nodes: page.nodes.map((node) =>
        node.id === slot.id && node.type === "motion" ? { ...node, capturedAssetId: asset.id } : node,
      ),
    };
  }
  let visual: ImageNode = applyImageLook({
    id: slot.id,
    name: slot.name === "Media frame" ? "Media frame" : "Visual",
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
    shadow: slot.shadow,
    mask: slot.type === "shape" && slot.variant === "rounded-rect" ? "rounded-rect" : undefined,
  }, look);
  if (slot.shadow) visual = { ...visual, shadow: slot.shadow };
  return {
    ...page,
    nodes: page.nodes.map((node) => (node.id === slot.id ? visual : node)),
  };
}

export function composeSocialPost(
  post: CraftPost,
  brand: CraftBrand = STRATA_BRAND,
  logo: CraftAsset | null = null,
): CraftDocument {
  const kit = cloneBrand(brand);
  const route =
    post.route === "safe-distinctive" || post.route === "beautiful-insane" || post.route === "sharp-cultural"
      ? post.route
      : "sharp-cultural";
  let weekDoc = materialiseWeek({ weekId: post.weekId || isoWeekId(post.date), route });
  weekDoc = applyBrand(weekDoc, kit);
  weekDoc = applyPostCopy(weekDoc, post);
  if (logo) weekDoc = applyBrandLogo(weekDoc, logo);
  return applyCreativeDirection(weekDoc, post);
}
