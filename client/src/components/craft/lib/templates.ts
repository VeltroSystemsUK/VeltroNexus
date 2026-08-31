import { applyBrandToNode } from "./brand";
import {
  DEFAULT_BRAND,
  DEFAULT_CONSTRAINTS,
  blankDocument,
  blankPage,
  defaultConstraintsFor,
  uid,
  type AnimationSpec,
  type ColorRole,
  type CraftBrand,
  type CraftDocument,
  type CraftNode,
  type CraftPage,
  type FontRole,
  type ShapeVariant,
} from "./types";

export interface SizePreset {
  id: string;
  name: string;
  description: string;
  category: "Social" | "Web" | "Motion" | "Docs";
  width: number;
  height: number;
}

export interface DesignTemplate {
  id: string;
  name: string;
  description: string;
  category: SizePreset["category"];
  presetId: string;
  build: (brand: CraftBrand) => CraftPage;
}

export const SIZE_PRESETS: SizePreset[] = [
  { id: "post", name: "Social Post", description: "1080 × 1350", category: "Social", width: 1080, height: 1350 },
  { id: "story", name: "Story", description: "1080 × 1920", category: "Social", width: 1080, height: 1920 },
  { id: "square", name: "Instagram Square", description: "1080 × 1080", category: "Social", width: 1080, height: 1080 },
  { id: "twitter", name: "X / Twitter", description: "1200 × 675", category: "Social", width: 1200, height: 675 },
  { id: "linkedin", name: "LinkedIn Banner", description: "1584 × 396", category: "Web", width: 1584, height: 396 },
  { id: "og", name: "Open Graph", description: "1200 × 630", category: "Web", width: 1200, height: 630 },
  { id: "banner", name: "Web Banner", description: "1200 × 628", category: "Web", width: 1200, height: 628 },
  { id: "hero", name: "Hero", description: "1920 × 600", category: "Web", width: 1920, height: 600 },
  { id: "email", name: "Email Header", description: "600 × 200", category: "Web", width: 600, height: 200 },
  { id: "email-letter", name: "Email", description: "600 × 900", category: "Docs", width: 600, height: 900 },
  { id: "reels", name: "Reels / TikTok", description: "1080 × 1920", category: "Social", width: 1080, height: 1920 },
  { id: "youtube", name: "YouTube Thumb", description: "1280 × 720", category: "Social", width: 1280, height: 720 },
  { id: "pinterest", name: "Pinterest Pin", description: "1000 × 1500", category: "Social", width: 1000, height: 1500 },
  { id: "gif-square", name: "GIF Square", description: "800 × 800", category: "Motion", width: 800, height: 800 },
  { id: "gif-story", name: "GIF Story", description: "720 × 1280", category: "Motion", width: 720, height: 1280 },
  { id: "favicon", name: "App Icon", description: "512 × 512", category: "Web", width: 512, height: 512 },
  { id: "a4", name: "A4 Portrait", description: "794 × 1123", category: "Docs", width: 794, height: 1123 },
];

export function presetById(id: string): SizePreset | undefined {
  return SIZE_PRESETS.find((preset) => preset.id === id);
}

function shape(
  name: string,
  variant: ShapeVariant,
  x: number,
  y: number,
  width: number,
  height: number,
  role: ColorRole,
  extras: Partial<Extract<CraftNode, { type: "shape" }>> = {},
): Extract<CraftNode, { type: "shape" }> {
  return {
    id: uid("shape"),
    name,
    type: "shape",
    variant,
    x,
    y,
    width,
    height,
    rotation: extras.rotation ?? 0,
    opacity: extras.opacity ?? 1,
    locked: false,
    hidden: false,
    constraints: extras.constraints ?? DEFAULT_CONSTRAINTS,
    role,
    fill: DEFAULT_BRAND.colors[role],
    fillMode: extras.fillMode ?? "solid",
    gradientEnd: extras.gradientEnd,
    stroke: extras.stroke ?? "transparent",
    strokeWidth: extras.strokeWidth ?? 0,
    borderRadius: extras.borderRadius ?? (variant === "rounded-rect" ? 24 : 0),
    animation: extras.animation,
    groupId: extras.groupId,
    groupName: extras.groupName,
    shadow: extras.shadow,
  };
}

function text(
  name: string,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  size: number,
  role: ColorRole,
  extras: Partial<Extract<CraftNode, { type: "text" }>> & { fontRole?: FontRole } = {},
): Extract<CraftNode, { type: "text" }> {
  const fontRole = extras.fontRole ?? (size >= 40 ? "heading" : "body");
  return {
    id: uid("text"),
    name,
    type: "text",
    text: value,
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity: extras.opacity ?? 1,
    locked: false,
    hidden: false,
    constraints: extras.constraints ?? defaultConstraintsFor(size >= 40 ? "title" : "body"),
    role,
    fontRole,
    fontFamily: fontRole === "heading" ? DEFAULT_BRAND.headingFont : DEFAULT_BRAND.bodyFont,
    fontWeight: extras.fontWeight ?? (size >= 40 ? "800" : "600"),
    fontSize: size,
    align: extras.align ?? "left",
    letterSpacing: extras.letterSpacing ?? 0,
    lineHeight: extras.lineHeight ?? 1.12,
    color: DEFAULT_BRAND.colors[role],
    animation: extras.animation,
    groupId: extras.groupId,
    groupName: extras.groupName,
  };
}

function pageOf(presetId: string, name: string, nodes: CraftNode[], background?: CraftPage["background"]): CraftPage {
  const preset = presetById(presetId) ?? SIZE_PRESETS[0];
  const branded = nodes.map((node) => applyBrandToNode(node, DEFAULT_BRAND));
  return {
    ...blankPage(preset.id, preset.width, preset.height, name),
    background: background ?? { mode: "solid", color: DEFAULT_BRAND.colors.background },
    nodes: branded,
  };
}

const fade: AnimationSpec = { type: "fadeIn", duration: 500, delay: 0 };
const pop: AnimationSpec = { type: "pop", duration: 450, delay: 80 };

function announcePost(): CraftPage {
  return pageOf("post", "Announcement", [
    shape("Accent bar", "rect", 0, 0, 1080, 18, "accent", { constraints: defaultConstraintsFor("bar") }),
    text("Eyebrow", "NEW RELEASE", 80, 72, 920, 36, 18, "accent", { letterSpacing: 4, fontWeight: "700", fontRole: "body" }),
    text("Headline", "Make the work look inevitable.", 80, 120, 920, 140, 48, "text", { fontRole: "heading", lineHeight: 1.08 }),
    text("Support", "A single artboard. Your brand, not a blank canvas.", 80, 280, 920, 80, 22, "muted", { fontRole: "body", fontWeight: "400", lineHeight: 1.3 }),
    text("Hashtags", "#SMEFinance  #UKBusiness", 80, 372, 920, 32, 16, "muted", { fontRole: "body", fontWeight: "400", letterSpacing: 0.5 }),
    text("Link", "stratafinance.co.uk", 80, 408, 920, 28, 16, "accent", { fontRole: "body", fontWeight: "400" }),
    shape("Media frame", "rounded-rect", 80, 460, 920, 620, "secondary", { constraints: defaultConstraintsFor("image"), borderRadius: 28 }),
    shape("CTA", "rounded-rect", 80, 1110, 320, 64, "accent", { borderRadius: 999, constraints: { horizontal: "start", vertical: "end" } }),
    text("CTA label", "See it live", 80, 1126, 320, 36, 20, "secondary", { align: "center", fontRole: "body", constraints: { horizontal: "start", vertical: "end" } }),
  ]);
}

function storyLaunch(): CraftPage {
  return pageOf(
    "story",
    "Launch Story",
    [
      shape("Wash", "rect", 0, 0, 1080, 1920, "primary", { constraints: { horizontal: "stretch", vertical: "stretch" } }),
      shape("Accent slash", "rect", 80, 160, 140, 8, "accent", { constraints: defaultConstraintsFor("bar") }),
      text("Wordmark", "QUIRES", 80, 200, 920, 50, 22, "muted", { letterSpacing: 8, fontRole: "body" }),
      text("Title", "Ship the\nstory.", 80, 520, 920, 420, 96, "secondary", { fontRole: "heading", lineHeight: 0.98 }),
      text("Deck", "One design. Story, post, banner — resized, not rebuilt.", 80, 980, 780, 140, 28, "muted", { fontRole: "body", fontWeight: "400", lineHeight: 1.35 }),
      shape("CTA", "rounded-rect", 80, 1680, 400, 80, "accent", { borderRadius: 999, constraints: { horizontal: "start", vertical: "end" } }),
      text("CTA label", "Open CRAFT", 80, 1700, 400, 50, 24, "secondary", { align: "center", fontRole: "body", constraints: { horizontal: "start", vertical: "end" } }),
    ],
    { mode: "solid", color: DEFAULT_BRAND.colors.primary },
  );
}

function quoteSquare(): CraftPage {
  return pageOf("square", "Quote Card", [
    shape("Ground", "rect", 0, 0, 1080, 1080, "secondary", { constraints: { horizontal: "stretch", vertical: "stretch" }, role: "secondary" }),
    text("Mark", "“", 70, 80, 240, 180, 180, "accent", { fontRole: "heading", fontWeight: "800" }),
    text("Quote", "The file should survive a restart. The rest is decoration.", 100, 340, 880, 360, 48, "text", { fontRole: "heading", lineHeight: 1.2 }),
    shape("Rule", "rect", 100, 760, 120, 6, "accent"),
    text("Name", "CRAFT", 100, 800, 400, 40, 20, "muted", { letterSpacing: 4, fontRole: "body" }),
    text("Role", "Design that ships.", 100, 850, 500, 40, 22, "text", { fontRole: "body", fontWeight: "400" }),
  ]);
}

function ogBanner(): CraftPage {
  return pageOf("og", "Open Graph", [
    shape("Panel", "rect", 0, 0, 680, 630, "primary", { constraints: { horizontal: "stretch", vertical: "stretch" } }),
    shape("Accent", "rect", 680, 0, 520, 630, "accent", { constraints: { horizontal: "end", vertical: "stretch" } }),
    text("Eyebrow", "QUIRES  ·  CRAFT", 56, 120, 560, 28, 14, "muted", { letterSpacing: 3, fontRole: "body" }),
    text("Headline", "Design once. Export everywhere.", 56, 160, 560, 130, 36, "secondary", { fontRole: "heading", lineHeight: 1.1 }),
    text("Deck", "Social, web, and motion assets with a brand kit that actually applies.", 56, 300, 540, 80, 18, "muted", { fontRole: "body", fontWeight: "400", lineHeight: 1.3 }),
    shape("CTA", "rounded-rect", 56, 400, 220, 44, "accent", { borderRadius: 999 }),
    text("CTA label", "Talk to Strata", 56, 410, 220, 28, 16, "secondary", { align: "center", fontRole: "body" }),
    text("Hashtags", "#SMEFinance  #UKBusiness", 56, 464, 560, 28, 13, "muted", { fontRole: "body", fontWeight: "400" }),
    text("Link", "stratafinance.co.uk", 56, 500, 560, 28, 13, "secondary", { fontRole: "body", fontWeight: "400" }),
  ]);
}

function linkedInBanner(): CraftPage {
  return pageOf("linkedin", "LinkedIn Banner", [
    shape("Ground", "rect", 0, 0, 1584, 396, "primary", { constraints: { horizontal: "stretch", vertical: "stretch" } }),
    shape("Accent", "rect", 0, 0, 18, 396, "accent", { constraints: { horizontal: "start", vertical: "stretch" } }),
    text("Title", "Work at the speed of thought.", 64, 120, 980, 90, 48, "secondary", { fontRole: "heading" }),
    text("Sub", "Local-first design for the posts, banners, and pages you actually ship.", 64, 230, 900, 50, 22, "muted", { fontRole: "body", fontWeight: "400" }),
    shape("Mark", "rounded-rect", 1360, 148, 160, 100, "accent", { borderRadius: 18, constraints: { horizontal: "end", vertical: "center" } }),
  ]);
}

function xPost(): CraftPage {
  return pageOf("twitter", "X Post", [
    shape("Ground", "rect", 0, 0, 1200, 675, "background", { constraints: { horizontal: "stretch", vertical: "stretch" } }),
    shape("Bar", "rect", 0, 0, 12, 675, "accent", { constraints: { horizontal: "start", vertical: "stretch" } }),
    text("Headline", "Stop rebuilding the same post six times.", 64, 140, 1070, 180, 56, "text", { fontRole: "heading", lineHeight: 1.05 }),
    text("Body", "Resize the artboard. Keep the constraints. Export the pack.", 64, 380, 900, 80, 26, "muted", { fontRole: "body", fontWeight: "400" }),
    text("Handle", "@quires", 64, 560, 300, 40, 20, "accent", { fontRole: "body", letterSpacing: 1 }),
  ]);
}

function emailHeader(): CraftPage {
  return pageOf("email", "Email Header", [
    shape("Ground", "rect", 0, 0, 600, 200, "primary", { constraints: { horizontal: "stretch", vertical: "stretch" } }),
    shape("Dot", "ellipse", 36, 78, 44, 44, "accent"),
    text("Title", "This week in the studio", 100, 72, 460, 60, 28, "secondary", { fontRole: "heading" }),
  ]);
}

function emailLetter(): CraftPage {
  return pageOf("email-letter", "Email", [
    shape("Mast", "rect", 0, 0, 600, 88, "primary", { constraints: { horizontal: "stretch", vertical: "start" } }),
    text("Brand", "STRATA FINANCE", 32, 28, 536, 36, 18, "secondary", { letterSpacing: 3, fontRole: "body", fontWeight: "700" }),
    text("Greeting", "Hi {{firstName}},", 32, 120, 536, 40, 22, "text", { fontRole: "heading" }),
    text(
      "Body",
      "We package UK commercial finance for SME directors. We do not lend. If {{companyName}} needs a complete file, talk to us.",
      32,
      176,
      536,
      120,
      16,
      "muted",
      { fontRole: "body", fontWeight: "400", lineHeight: 1.4 },
    ),
    text("Signoff", "{{senderName}}\n{{senderCompany}}", 32, 320, 536, 56, 16, "text", { fontRole: "body", fontWeight: "600", lineHeight: 1.35 }),
    text("Unsub", "{{unsubscribeLink}}", 32, 820, 536, 28, 12, "muted", { fontRole: "body", fontWeight: "400" }),
  ]);
}

function promoSquare(): CraftPage {
  return pageOf("square", "Promo", [
    shape("Ground", "rect", 0, 0, 1080, 1080, "background", { constraints: { horizontal: "stretch", vertical: "stretch" } }),
    shape("Media", "rounded-rect", 80, 80, 920, 620, "secondary", { constraints: defaultConstraintsFor("image"), borderRadius: 32 }),
    text("Kicker", "LIMITED", 80, 740, 300, 32, 18, "accent", { letterSpacing: 4, fontRole: "body" }),
    text("Product", "The midnight drop.", 80, 790, 700, 90, 48, "text", { fontRole: "heading" }),
    shape("CTA", "rounded-rect", 80, 920, 240, 72, "accent", { borderRadius: 999 }),
    text("CTA label", "Shop now", 80, 938, 240, 48, 22, "secondary", { align: "center", fontRole: "body" }),
    text("Price", "£48", 820, 930, 180, 56, 40, "text", { align: "right", fontRole: "heading" }),
  ]);
}

function eventStory(): CraftPage {
  return pageOf(
    "story",
    "Event Story",
    [
      shape("Ground", "rect", 0, 0, 1080, 1920, "background", { constraints: { horizontal: "stretch", vertical: "stretch" } }),
      shape("Date block", "rounded-rect", 80, 160, 220, 220, "accent", { borderRadius: 28 }),
      text("Day", "18", 80, 190, 220, 110, 72, "secondary", { align: "center", fontRole: "heading" }),
      text("Month", "SEP", 80, 300, 220, 50, 22, "secondary", { align: "center", fontRole: "body", letterSpacing: 3 }),
      text("Title", "Open studio\nnight.", 80, 460, 920, 320, 80, "text", { fontRole: "heading", lineHeight: 1.02 }),
      text("Where", "Warehouse 4  ·  19:00  ·  Free", 80, 820, 800, 50, 24, "muted", { fontRole: "body" }),
      shape("CTA", "rounded-rect", 80, 1700, 420, 80, "primary", { borderRadius: 999, constraints: { horizontal: "start", vertical: "end" } }),
      text("CTA label", "Save the date", 80, 1720, 420, 50, 24, "secondary", { align: "center", fontRole: "body", constraints: { horizontal: "start", vertical: "end" } }),
    ],
  );
}

function gifCaption(): CraftPage {
  return pageOf(
    "gif-square",
    "Caption GIF",
    [
      shape("Ground", "rect", 0, 0, 800, 800, "primary", { constraints: { horizontal: "stretch", vertical: "stretch" } }),
      shape("Top bar", "rect", 0, 0, 800, 120, "primary", {
        constraints: defaultConstraintsFor("bar"),
        opacity: 0.88,
        animation: fade,
      }),
      text("Top", "WHEN THE FILE SAVES", 40, 38, 720, 70, 32, "secondary", {
        align: "center",
        fontRole: "body",
        fontWeight: "800",
        animation: fade,
      }),
      shape("Bottom bar", "rect", 0, 680, 800, 120, "primary", {
        constraints: { horizontal: "stretch", vertical: "end" },
        opacity: 0.88,
        animation: pop,
      }),
      text("Bottom", "AND IT OPENS AGAIN", 40, 718, 720, 70, 32, "accent", {
        align: "center",
        fontRole: "body",
        fontWeight: "800",
        constraints: { horizontal: "stretch", vertical: "end" },
        animation: pop,
      }),
    ],
    { mode: "solid", color: DEFAULT_BRAND.colors.primary },
  );
}

function youtubeThumb(): CraftPage {
  return pageOf("youtube", "YouTube Thumb", [
    shape("Ground", "rect", 0, 0, 1280, 720, "primary", { constraints: { horizontal: "stretch", vertical: "stretch" } }),
    shape("Accent slab", "rect", 0, 0, 28, 720, "accent", { constraints: { horizontal: "start", vertical: "stretch" } }),
    text("Eyebrow", "WATCH NEXT", 72, 80, 700, 40, 22, "accent", { letterSpacing: 4, fontRole: "body" }),
    text("Title", "The file that\nsurvives a restart.", 72, 160, 820, 280, 64, "secondary", { fontRole: "heading", lineHeight: 1.02 }),
    shape("Play", "ellipse", 980, 250, 180, 180, "accent", { constraints: { horizontal: "end", vertical: "center" } }),
    shape("Play arrow", "triangle", 1044, 300, 80, 80, "secondary", { rotation: 90, constraints: { horizontal: "end", vertical: "center" } }),
  ]);
}

function pinterestPin(): CraftPage {
  return pageOf("pinterest", "Pinterest Pin", [
    shape("Ground", "rect", 0, 0, 1000, 1500, "background", { constraints: { horizontal: "stretch", vertical: "stretch" } }),
    shape("Media", "rounded-rect", 64, 64, 872, 880, "secondary", { constraints: defaultConstraintsFor("image"), borderRadius: 36 }),
    text("Kicker", "SAVE THIS", 64, 990, 400, 32, 18, "accent", { letterSpacing: 3, fontRole: "body" }),
    text("Title", "One design.\nEvery channel.", 64, 1040, 872, 200, 52, "text", { fontRole: "heading", lineHeight: 1.05 }),
    text("Hint", "Pin it. Resize it. Ship it.", 64, 1320, 700, 50, 24, "muted", { fontRole: "body", fontWeight: "400" }),
  ]);
}

function testimonialSquare(): CraftPage {
  return pageOf("square", "Testimonial", [
    shape("Ground", "rect", 0, 0, 1080, 1080, "secondary", { constraints: { horizontal: "stretch", vertical: "stretch" } }),
    shape("Avatar", "ellipse", 80, 80, 120, 120, "accent"),
    text("Name", "Alex Rivera", 230, 100, 700, 48, 28, "text", { fontRole: "heading" }),
    text("Role", "Studio lead", 230, 150, 500, 36, 18, "muted", { fontRole: "body" }),
    text("Quote", "We stopped rebuilding the same post. The brand lives in the file now.", 80, 280, 920, 420, 44, "text", { fontRole: "heading", lineHeight: 1.2 }),
    shape("Bar", "rect", 80, 920, 160, 8, "accent"),
    text("Source", "SWARFE SWELL", 80, 960, 400, 40, 20, "muted", { fontRole: "body", letterSpacing: 2 }),
  ]);
}

function speakerCard(): CraftPage {
  return pageOf("square", "Speaker", [
    shape("Ground", "rect", 0, 0, 1080, 1080, "primary", { constraints: { horizontal: "stretch", vertical: "stretch" } }),
    shape("Accent rail", "rect", 0, 0, 18, 1080, "accent", { constraints: { horizontal: "start", vertical: "stretch" } }),
    shape("Portrait well", "rounded-rect", 80, 80, 440, 920, "secondary", { borderRadius: 36, constraints: defaultConstraintsFor("image") }),
    text("Eyebrow", "TONIGHT", 580, 140, 420, 36, 18, "accent", { letterSpacing: 5, fontRole: "body" }),
    text("Name", "Maya Chen", 580, 200, 420, 160, 56, "secondary", { fontRole: "heading", lineHeight: 1.02 }),
    text("Role", "Creative director\nSWARFE studio", 580, 400, 420, 100, 24, "muted", { fontRole: "body", fontWeight: "400", lineHeight: 1.35 }),
    shape("Rule", "rect", 580, 540, 80, 6, "accent"),
    text("Talk", "How a brand\nsurvives a restart.", 580, 580, 420, 200, 32, "secondary", { fontRole: "heading", lineHeight: 1.15 }),
    text("Meta", "Doors 18:30  ·  40 min", 580, 900, 420, 40, 18, "muted", { fontRole: "body" }),
  ], { mode: "solid", color: DEFAULT_BRAND.colors.primary });
}

function priceList(): CraftPage {
  return pageOf("post", "Menu", [
    shape("Ground", "rect", 0, 0, 1080, 1350, "background", { constraints: { horizontal: "stretch", vertical: "stretch" } }),
    text("Eyebrow", "THIS WEEK", 80, 80, 920, 36, 18, "accent", { letterSpacing: 4, fontRole: "body" }),
    text("Title", "The studio menu.", 80, 130, 920, 90, 52, "text", { fontRole: "heading" }),
    shape("Rule", "rect", 80, 250, 160, 6, "accent"),
    text("Item 1", "Brand kit", 80, 310, 620, 48, 28, "text", { fontRole: "heading" }),
    text("Price 1", "£180", 780, 310, 220, 48, 28, "accent", { align: "right", fontRole: "heading" }),
    text("Note 1", "Colours, type, and a logo that actually applies.", 80, 360, 920, 40, 18, "muted", { fontRole: "body", fontWeight: "400" }),
    text("Item 2", "Export pack", 80, 460, 620, 48, 28, "text", { fontRole: "heading" }),
    text("Price 2", "£90", 780, 460, 220, 48, 28, "accent", { align: "right", fontRole: "heading" }),
    text("Note 2", "Story, square, and Open Graph in one click.", 80, 510, 920, 40, 18, "muted", { fontRole: "body", fontWeight: "400" }),
    text("Item 3", "Reskin", 80, 610, 620, 48, 28, "text", { fontRole: "heading" }),
    text("Price 3", "£240", 780, 610, 220, 48, 28, "accent", { align: "right", fontRole: "heading" }),
    text("Note 3", "Keep the layout. Change the brand. Ship tonight.", 80, 660, 920, 40, 18, "muted", { fontRole: "body", fontWeight: "400" }),
    shape("Footer", "rect", 0, 1180, 1080, 170, "primary", { constraints: { horizontal: "stretch", vertical: "end" } }),
    text("Book", "Book a desk", 80, 1235, 400, 50, 24, "secondary", { fontRole: "heading", constraints: { horizontal: "start", vertical: "end" } }),
    text("Handle", "@quires", 680, 1240, 320, 44, 20, "accent", { align: "right", fontRole: "body", constraints: { horizontal: "end", vertical: "end" } }),
  ]);
}

export const DESIGN_TEMPLATES: DesignTemplate[] = [
  { id: "announce-post", name: "Announcement", description: "Post with media frame and CTA", category: "Social", presetId: "post", build: announcePost },
  { id: "story-launch", name: "Launch Story", description: "Full-bleed launch frame", category: "Social", presetId: "story", build: storyLaunch },
  { id: "quote-square", name: "Quote Card", description: "Pull-quote on a square", category: "Social", presetId: "square", build: quoteSquare },
  { id: "promo-square", name: "Promo", description: "Product frame, price, CTA", category: "Social", presetId: "square", build: promoSquare },
  { id: "event-story", name: "Event Story", description: "Date block and venue", category: "Social", presetId: "story", build: eventStory },
  { id: "x-post", name: "X Post", description: "Headline and handle", category: "Social", presetId: "twitter", build: xPost },
  { id: "og-banner", name: "Open Graph", description: "Link preview split", category: "Web", presetId: "og", build: ogBanner },
  { id: "linkedin-banner", name: "LinkedIn", description: "Cover with wordmark", category: "Web", presetId: "linkedin", build: linkedInBanner },
  { id: "email-header", name: "Email Header", description: "Narrow newsletter mast", category: "Web", presetId: "email", build: emailHeader },
  { id: "email-letter", name: "Email letter", description: "600px letter with merge tags", category: "Docs", presetId: "email-letter", build: emailLetter },
  { id: "gif-caption", name: "Caption GIF", description: "Top and bottom motion bars", category: "Motion", presetId: "gif-square", build: gifCaption },
  { id: "youtube-thumb", name: "YouTube Thumb", description: "Title plus play mark", category: "Social", presetId: "youtube", build: youtubeThumb },
  { id: "pinterest-pin", name: "Pinterest Pin", description: "Tall save-this card", category: "Social", presetId: "pinterest", build: pinterestPin },
  { id: "testimonial", name: "Testimonial", description: "Quote with attribution", category: "Social", presetId: "square", build: testimonialSquare },
  { id: "speaker-card", name: "Speaker", description: "Portrait rail and talk title", category: "Social", presetId: "square", build: speakerCard },
  { id: "price-list", name: "Menu", description: "Priced list with a footer", category: "Social", presetId: "post", build: priceList },
];

export function documentFromBlank(presetId: string, brand: CraftBrand = DEFAULT_BRAND, title?: string): CraftDocument {
  const preset = presetById(presetId) ?? SIZE_PRESETS[0];
  const page = blankPage(preset.id, preset.width, preset.height, preset.name);
  page.background.color = brand.colors.background;
  const doc = blankDocument(title ?? preset.name);
  doc.brand = { ...brand, colors: { ...brand.colors } };
  doc.pages = [page];
  doc.activePageId = page.id;
  return doc;
}

export function documentFromTemplate(templateId: string, brand: CraftBrand = DEFAULT_BRAND): CraftDocument {
  const template = DESIGN_TEMPLATES.find((item) => item.id === templateId);
  if (!template) return documentFromBlank(templateId, brand);
  const page = template.build(brand);
  page.nodes = page.nodes.map((node) => applyBrandToNode(node, brand));
  page.background.color = page.background.color === DEFAULT_BRAND.colors.background ? brand.colors.background : page.background.color;
  page.background.color = page.background.color === DEFAULT_BRAND.colors.primary ? brand.colors.primary : page.background.color;
  const doc = blankDocument(template.name);
  doc.brand = { ...brand, colors: { ...brand.colors } };
  doc.pages = [page];
  doc.activePageId = page.id;
  return doc;
}

export function addBlankPage(doc: CraftDocument, presetId: string): CraftDocument {
  const preset = presetById(presetId) ?? SIZE_PRESETS[0];
  const page = blankPage(preset.id, preset.width, preset.height, preset.name);
  page.background.color = doc.brand.colors.background;
  return { ...doc, pages: [...doc.pages, page], activePageId: page.id, updatedAt: new Date().toISOString() };
}

export type ComponentCategory = "Social" | "Type" | "Media" | "Layout" | "Motion";

export interface ComponentSpec {
  id: string;
  name: string;
  description: string;
  category: ComponentCategory;
  build: (page: CraftPage, brand: CraftBrand) => CraftNode[];
}

export type TextStyleId = "heading" | "subhead" | "body" | "caption" | "eyebrow" | "stat";

export interface TextStyleSpec {
  id: TextStyleId;
  name: string;
  sample: string;
  size: number;
  weight: "400" | "600" | "700" | "800";
  fontRole: FontRole;
  role: ColorRole;
}

export const TEXT_STYLES: TextStyleSpec[] = [
  { id: "eyebrow", name: "Eyebrow", sample: "OVERLINE", size: 16, weight: "700", fontRole: "body", role: "accent" },
  { id: "heading", name: "Heading", sample: "Big headline", size: 56, weight: "800", fontRole: "heading", role: "text" },
  { id: "subhead", name: "Subhead", sample: "Supporting line", size: 28, weight: "600", fontRole: "heading", role: "text" },
  { id: "body", name: "Body", sample: "Write the paragraph here.", size: 20, weight: "400", fontRole: "body", role: "muted" },
  { id: "caption", name: "Caption", sample: "Small print", size: 14, weight: "600", fontRole: "body", role: "muted" },
  { id: "stat", name: "Stat", sample: "128k", size: 72, weight: "800", fontRole: "heading", role: "accent" },
];

export const SHAPE_GROUPS: { id: string; name: string; variants: ShapeVariant[] }[] = [
  { id: "basic", name: "Basics", variants: ["rect", "rounded-rect", "ellipse", "line"] },
  { id: "arrows", name: "Arrows & marks", variants: ["arrow", "chevron", "star", "cross"] },
  { id: "polygons", name: "Polygons", variants: ["triangle", "diamond", "pentagon", "hexagon", "octagon", "parallelogram"] },
  { id: "icons", name: "Icons", variants: ["heart", "speech", "cloud", "banner"] },
];

export const SHAPE_LABELS: Record<ShapeVariant, string> = {
  rect: "Rect",
  ellipse: "Oval",
  "rounded-rect": "Round",
  triangle: "Triangle",
  diamond: "Diamond",
  star: "Star",
  arrow: "Arrow",
  line: "Line",
  hexagon: "Hex",
  pentagon: "Pent",
  octagon: "Oct",
  chevron: "Chevron",
  heart: "Heart",
  speech: "Speech",
  cloud: "Cloud",
  banner: "Banner",
  cross: "Cross",
  parallelogram: "Para",
};

export const INSERT_COMPONENTS: ComponentSpec[] = [
  {
    id: "caption",
    name: "Caption bars",
    description: "Top and bottom title bars",
    category: "Social",
    build: (page, brand) => {
      const groupId = uid("group");
      const bar = Math.max(64, page.height * 0.1);
      return [
        shape("Top caption", "rect", 0, 0, page.width, bar, "primary", { groupId, groupName: "Caption", constraints: defaultConstraintsFor("bar"), opacity: 0.88 }),
        text("Top text", "TOP LINE", 24, bar * 0.28, page.width - 48, bar * 0.6, bar * 0.32, "secondary", { groupId, groupName: "Caption", align: "center", fontRole: "body", fontWeight: "800" }),
        shape("Bottom caption", "rect", 0, page.height - bar, page.width, bar, "primary", { groupId, groupName: "Caption", constraints: { horizontal: "stretch", vertical: "end" }, opacity: 0.88 }),
        text("Bottom text", "BOTTOM LINE", 24, page.height - bar * 0.72, page.width - 48, bar * 0.6, bar * 0.3, "accent", { groupId, groupName: "Caption", align: "center", fontRole: "body", fontWeight: "800", constraints: { horizontal: "stretch", vertical: "end" } }),
      ].map((node) => applyBrandToNode(node, brand));
    },
  },
  {
    id: "cta",
    name: "CTA pill",
    description: "Rounded call to action",
    category: "Social",
    build: (page, brand) => {
      const groupId = uid("group");
      const w = Math.min(280, page.width * 0.4);
      const h = 72;
      const x = page.width * 0.5 - w / 2;
      const y = page.height * 0.78;
      return [
        shape("CTA fill", "rounded-rect", x, y, w, h, "accent", { groupId, groupName: "CTA", borderRadius: 999, constraints: { horizontal: "center", vertical: "end" } }),
        text("CTA label", "Learn more", x, y + 16, w, 44, 22, "secondary", { groupId, groupName: "CTA", align: "center", fontRole: "body", constraints: { horizontal: "center", vertical: "end" } }),
      ].map((node) => applyBrandToNode(node, brand));
    },
  },
  {
    id: "badge",
    name: "Badge",
    description: "Small status chip",
    category: "Social",
    build: (page, brand) => {
      const groupId = uid("group");
      const x = Math.min(48, page.width * 0.06);
      const y = Math.min(48, page.height * 0.05);
      return [
        shape("Badge", "rounded-rect", x, y, 180, 44, "accent", { groupId, groupName: "Badge", borderRadius: 999 }),
        text("Badge label", "NEW", x, y + 8, 180, 32, 16, "secondary", { groupId, groupName: "Badge", align: "center", fontRole: "body", letterSpacing: 2 }),
      ].map((node) => applyBrandToNode(node, brand));
    },
  },
  {
    id: "quote",
    name: "Quote stack",
    description: "Mark, quote, name",
    category: "Type",
    build: (page, brand) => {
      const groupId = uid("group");
      const x = page.width * 0.1;
      const y = page.height * 0.28;
      const w = page.width * 0.8;
      return [
        text("Quote mark", "“", x, y - 20, 120, 100, 90, "accent", { groupId, groupName: "Quote", fontRole: "heading" }),
        text("Quote", "Write the line they remember.", x, y + 90, w, 160, 36, "text", { groupId, groupName: "Quote", fontRole: "heading", lineHeight: 1.2 }),
        text("Attribution", "— Name, role", x, y + 270, w * 0.7, 40, 20, "muted", { groupId, groupName: "Quote", fontRole: "body" }),
      ].map((node) => applyBrandToNode(node, brand));
    },
  },
  {
    id: "price",
    name: "Price tag",
    description: "Was / now pair",
    category: "Type",
    build: (page, brand) => {
      const groupId = uid("group");
      const x = page.width * 0.12;
      const y = page.height * 0.72;
      return [
        text("Was", "£72", x, y, 140, 36, 22, "muted", { groupId, groupName: "Price", fontRole: "body" }),
        text("Now", "£48", x + 150, y - 8, 200, 56, 40, "accent", { groupId, groupName: "Price", fontRole: "heading" }),
      ].map((node) => applyBrandToNode(node, brand));
    },
  },
  {
    id: "handle",
    name: "Handle bar",
    description: "Social handle strip",
    category: "Social",
    build: (page, brand) => {
      const groupId = uid("group");
      const h = 56;
      const y = page.height - h - 32;
      return [
        shape("Handle bed", "rounded-rect", 32, y, page.width - 64, h, "primary", { groupId, groupName: "Handle", borderRadius: 999, constraints: { horizontal: "stretch", vertical: "end" }, opacity: 0.92 }),
        text("Handle", "@studio", 32, y + 14, page.width - 64, 36, 20, "secondary", { groupId, groupName: "Handle", align: "center", fontRole: "body", letterSpacing: 1, constraints: { horizontal: "stretch", vertical: "end" } }),
      ].map((node) => applyBrandToNode(node, brand));
    },
  },
  {
    id: "live",
    name: "Live pill",
    description: "Recording / live chip",
    category: "Social",
    build: (page, brand) => {
      const groupId = uid("group");
      const x = page.width - 200;
      const y = 36;
      return [
        shape("Live bed", "rounded-rect", x, y, 164, 40, "accent", { groupId, groupName: "Live", borderRadius: 999, constraints: { horizontal: "end", vertical: "start" } }),
        shape("Live dot", "ellipse", x + 16, y + 12, 16, 16, "secondary", { groupId, groupName: "Live", constraints: { horizontal: "end", vertical: "start" } }),
        text("Live", "LIVE", x + 40, y + 8, 110, 28, 16, "secondary", { groupId, groupName: "Live", fontRole: "body", letterSpacing: 2, constraints: { horizontal: "end", vertical: "start" } }),
      ].map((node) => applyBrandToNode(node, brand));
    },
  },
  {
    id: "progress",
    name: "Story progress",
    description: "Segmented story bar",
    category: "Social",
    build: (page, brand) => {
      const groupId = uid("group");
      const gap = 8;
      const count = 4;
      const w = (page.width - 48 - gap * (count - 1)) / count;
      return Array.from({ length: count }, (_, i) =>
        shape(`Seg ${i + 1}`, "rounded-rect", 24 + i * (w + gap), 20, w, 6, i === 0 ? "accent" : "muted", {
          groupId,
          groupName: "Progress",
          borderRadius: 999,
          constraints: defaultConstraintsFor("bar"),
          opacity: i === 0 ? 1 : 0.35,
        }),
      ).map((node) => applyBrandToNode(node, brand));
    },
  },
  {
    id: "follow",
    name: "Follow chip",
    description: "Follow + name",
    category: "Social",
    build: (page, brand) => {
      const groupId = uid("group");
      const x = 32;
      const y = page.height - 96;
      return [
        shape("Avatar", "ellipse", x, y, 48, 48, "accent", { groupId, groupName: "Follow", constraints: { horizontal: "start", vertical: "end" } }),
        text("Name", "studio", x + 60, y + 4, 200, 24, 16, "text", { groupId, groupName: "Follow", fontRole: "body", constraints: { horizontal: "start", vertical: "end" } }),
        text("Action", "Follow", x + 60, y + 26, 160, 22, 14, "accent", { groupId, groupName: "Follow", fontRole: "body", constraints: { horizontal: "start", vertical: "end" } }),
      ].map((node) => applyBrandToNode(node, brand));
    },
  },
  {
    id: "headstack",
    name: "Heading stack",
    description: "Eyebrow, title, deck",
    category: "Type",
    build: (page, brand) => {
      const groupId = uid("group");
      const x = page.width * 0.1;
      const y = page.height * 0.18;
      const w = page.width * 0.78;
      return [
        text("Eyebrow", "NEW", x, y, w, 28, 16, "accent", { groupId, groupName: "Heading", fontRole: "body", letterSpacing: 3 }),
        text("Title", "Say it once.", x, y + 36, w, 90, 48, "text", { groupId, groupName: "Heading", fontRole: "heading" }),
        text("Deck", "A short supporting line that holds the idea.", x, y + 136, w, 60, 20, "muted", { groupId, groupName: "Heading", fontRole: "body", fontWeight: "400", lineHeight: 1.3 }),
      ].map((node) => applyBrandToNode(node, brand));
    },
  },
  {
    id: "stat",
    name: "Stat block",
    description: "Big number + label",
    category: "Type",
    build: (page, brand) => {
      const groupId = uid("group");
      const x = page.width * 0.12;
      const y = page.height * 0.38;
      return [
        text("Number", "98%", x, y, page.width * 0.5, 90, 72, "accent", { groupId, groupName: "Stat", fontRole: "heading" }),
        text("Label", "faster to ship", x, y + 96, page.width * 0.5, 36, 20, "muted", { groupId, groupName: "Stat", fontRole: "body" }),
      ].map((node) => applyBrandToNode(node, brand));
    },
  },
  {
    id: "step",
    name: "Numbered step",
    description: "01 + title + body",
    category: "Type",
    build: (page, brand) => {
      const groupId = uid("group");
      const x = page.width * 0.1;
      const y = page.height * 0.4;
      return [
        text("Num", "01", x, y, 80, 40, 22, "accent", { groupId, groupName: "Step", fontRole: "body", letterSpacing: 1 }),
        text("Title", "Name the problem", x + 90, y, page.width * 0.6, 40, 24, "text", { groupId, groupName: "Step", fontRole: "heading" }),
        text("Body", "One sentence that a stranger can understand.", x + 90, y + 42, page.width * 0.62, 50, 18, "muted", { groupId, groupName: "Step", fontRole: "body", fontWeight: "400" }),
      ].map((node) => applyBrandToNode(node, brand));
    },
  },
  {
    id: "device",
    name: "Device frame",
    description: "Phone mockup",
    category: "Media",
    build: (page, brand) => {
      const groupId = uid("group");
      const w = Math.min(280, page.width * 0.32);
      const h = w * 1.85;
      const x = page.width * 0.5 - w / 2;
      const y = page.height * 0.18;
      return [
        shape("Bezel", "rounded-rect", x, y, w, h, "primary", { groupId, groupName: "Device", borderRadius: 36 }),
        shape("Screen", "rounded-rect", x + 14, y + 48, w - 28, h - 110, "secondary", { groupId, groupName: "Device", borderRadius: 20 }),
        shape("Speaker", "rounded-rect", x + w * 0.32, y + 18, w * 0.36, 10, "muted", { groupId, groupName: "Device", borderRadius: 999 }),
        shape("Home", "ellipse", x + w / 2 - 12, y + h - 38, 24, 24, "muted", { groupId, groupName: "Device" }),
      ].map((node) => applyBrandToNode(node, brand));
    },
  },
  {
    id: "avatar",
    name: "Avatar",
    description: "Circle + initials",
    category: "Media",
    build: (page, brand) => {
      const groupId = uid("group");
      const size = 96;
      const x = page.width * 0.12;
      const y = page.height * 0.2;
      return [
        shape("Disc", "ellipse", x, y, size, size, "accent", { groupId, groupName: "Avatar" }),
        text("Initials", "AR", x, y + 28, size, 48, 28, "secondary", { groupId, groupName: "Avatar", align: "center", fontRole: "heading" }),
      ].map((node) => applyBrandToNode(node, brand));
    },
  },
  {
    id: "frame",
    name: "Image frame",
    description: "Empty media well",
    category: "Media",
    build: (page, brand) => {
      const groupId = uid("group");
      const w = page.width * 0.62;
      const h = page.height * 0.36;
      const x = page.width * 0.19;
      const y = page.height * 0.28;
      return [
        shape("Well", "rounded-rect", x, y, w, h, "secondary", { groupId, groupName: "Frame", borderRadius: 28, constraints: defaultConstraintsFor("image") }),
        text("Hint", "Drop image", x, y + h / 2 - 14, w, 32, 18, "muted", { groupId, groupName: "Frame", align: "center", fontRole: "body" }),
      ].map((node) => applyBrandToNode(node, brand));
    },
  },
  {
    id: "logo",
    name: "Logo mark",
    description: "Abstract brand symbol",
    category: "Media",
    build: (page, brand) => {
      const groupId = uid("group");
      const s = 140;
      const x = page.width * 0.5 - s / 2;
      const y = page.height * 0.32;
      return [
        shape("Halo", "ellipse", x - 16, y - 16, s + 32, s + 32, "accent", { groupId, groupName: "Logo", opacity: 0.18 }),
        shape("Diamond", "diamond", x, y, s, s, "primary", { groupId, groupName: "Logo" }),
        shape("Cut", "chevron", x + 28, y + 36, s - 56, s - 72, "secondary", { groupId, groupName: "Logo" }),
      ].map((node) => applyBrandToNode(node, brand));
    },
  },
  {
    id: "divider",
    name: "Divider",
    description: "Rule with gap",
    category: "Layout",
    build: (page, brand) => {
      const groupId = uid("group");
      const y = page.height * 0.5;
      return [
        shape("Rule", "rect", page.width * 0.12, y, page.width * 0.76, 3, "muted", { groupId, groupName: "Divider", constraints: { horizontal: "stretch", vertical: "center" } }),
      ].map((node) => applyBrandToNode(node, brand));
    },
  },
  {
    id: "card",
    name: "Content card",
    description: "Panel, title, body",
    category: "Layout",
    build: (page, brand) => {
      const groupId = uid("group");
      const w = Math.min(420, page.width * 0.62);
      const x = page.width * 0.5 - w / 2;
      const y = page.height * 0.28;
      return [
        shape("Card", "rounded-rect", x, y, w, 260, "secondary", { groupId, groupName: "Card", borderRadius: 28 }),
        shape("Accent", "rect", x, y, 10, 260, "accent", { groupId, groupName: "Card" }),
        text("Title", "Card title", x + 32, y + 36, w - 56, 40, 24, "text", { groupId, groupName: "Card", fontRole: "heading" }),
        text("Body", "A short supporting paragraph that sits inside the card.", x + 32, y + 90, w - 56, 90, 18, "muted", { groupId, groupName: "Card", fontRole: "body", fontWeight: "400", lineHeight: 1.35 }),
      ].map((node) => applyBrandToNode(node, brand));
    },
  },
  {
    id: "feature",
    name: "Feature row",
    description: "Icon + title + line",
    category: "Layout",
    build: (page, brand) => {
      const groupId = uid("group");
      const x = page.width * 0.1;
      const y = page.height * 0.42;
      return [
        shape("Icon", "rounded-rect", x, y, 52, 52, "accent", { groupId, groupName: "Feature", borderRadius: 14 }),
        text("Title", "Feature name", x + 68, y, page.width * 0.6, 28, 20, "text", { groupId, groupName: "Feature", fontRole: "heading" }),
        text("Line", "One benefit in a single sentence.", x + 68, y + 28, page.width * 0.62, 28, 16, "muted", { groupId, groupName: "Feature", fontRole: "body", fontWeight: "400" }),
      ].map((node) => applyBrandToNode(node, brand));
    },
  },
  {
    id: "countdown",
    name: "Countdown",
    description: "Big number card",
    category: "Motion",
    build: (page, brand) => {
      const groupId = uid("group");
      const w = Math.min(360, page.width * 0.5);
      const x = page.width * 0.5 - w / 2;
      const y = page.height * 0.32;
      return [
        shape("Card", "rounded-rect", x, y, w, w, "primary", { groupId, groupName: "Countdown", borderRadius: 32, animation: { type: "pulse", duration: 900, delay: 0 } }),
        text("Num", "3", x, y + w * 0.28, w, w * 0.45, w * 0.42, "secondary", { groupId, groupName: "Countdown", align: "center", fontRole: "heading", animation: { type: "pop", duration: 400, delay: 0 } }),
        text("Label", "NEXT", x, y + w * 0.76, w, 36, 18, "accent", { groupId, groupName: "Countdown", align: "center", fontRole: "body", letterSpacing: 4 }),
      ].map((node) => applyBrandToNode(node, brand));
    },
  },
  {
    id: "burst",
    name: "Burst",
    description: "Star + shout",
    category: "Motion",
    build: (page, brand) => {
      const groupId = uid("group");
      const s = Math.min(page.width, page.height) * 0.36;
      const x = page.width * 0.5 - s / 2;
      const y = page.height * 0.3;
      return [
        shape("Burst", "star", x, y, s, s, "accent", { groupId, groupName: "Burst", animation: { type: "pop", duration: 400, delay: 0 } }),
        text("Shout", "NEW", x, y + s * 0.38, s, 48, 28, "secondary", { groupId, groupName: "Burst", align: "center", fontRole: "heading" }),
      ].map((node) => applyBrandToNode(node, brand));
    },
  },
  {
    id: "loop",
    name: "Loop badge",
    description: "Replay ring",
    category: "Motion",
    build: (page, brand) => {
      const groupId = uid("group");
      const s = 180;
      const x = page.width * 0.5 - s / 2;
      const y = page.height * 0.36;
      return [
        shape("Ring", "ellipse", x, y, s, s, "accent", { groupId, groupName: "Loop", opacity: 0.22, animation: { type: "spin", duration: 1600, delay: 0 } }),
        shape("Core", "ellipse", x + 40, y + 40, s - 80, s - 80, "background", { groupId, groupName: "Loop" }),
        text("Label", "LOOP", x, y + s * 0.42, s, 36, 18, "text", { groupId, groupName: "Loop", align: "center", fontRole: "body", letterSpacing: 3 }),
      ].map((node) => applyBrandToNode(node, brand));
    },
  },
];

export const COMPONENT_CATEGORIES: ComponentCategory[] = ["Social", "Type", "Media", "Layout", "Motion"];

export function makeTextNode(page: CraftPage, brand: CraftBrand, x?: number, y?: number): Extract<CraftNode, { type: "text" }> {
  return makeTextStyle(page, brand, "heading", x, y);
}

export function makeTextStyle(page: CraftPage, brand: CraftBrand, styleId: TextStyleId, x?: number, y?: number): Extract<CraftNode, { type: "text" }> {
  const style = TEXT_STYLES.find((item) => item.id === styleId) ?? TEXT_STYLES[1];
  const size = Math.max(12, Math.round(style.size * Math.min(page.width / 1080, 1.15)));
  const node = text(style.name, style.sample, x ?? page.width * 0.12, y ?? page.height * 0.2, page.width * 0.72, size * 1.4, size, style.role, {
    fontRole: style.fontRole,
    fontWeight: style.weight,
    letterSpacing: styleId === "eyebrow" ? 3 : 0,
  });
  return applyBrandToNode(node, brand) as Extract<CraftNode, { type: "text" }>;
}

export function makeShapeNode(page: CraftPage, brand: CraftBrand, variant: ShapeVariant, x?: number, y?: number): Extract<CraftNode, { type: "shape" }> {
  const w = page.width * (variant === "line" ? 0.4 : 0.28);
  const h = variant === "line" ? 8 : page.height * 0.12;
  const node = shape(
    variant === "rounded-rect" ? "Rounded" : variant[0].toUpperCase() + variant.slice(1),
    variant,
    x ?? page.width * 0.2,
    y ?? page.height * 0.4,
    w,
    h,
    "accent",
    { borderRadius: variant === "rounded-rect" ? 24 : 0, strokeWidth: variant === "line" ? 6 : 0, stroke: variant === "line" ? brand.colors.accent : "transparent" },
  );
  return applyBrandToNode(node, brand) as Extract<CraftNode, { type: "shape" }>;
}

export function makeImageNode(page: CraftPage, assetId: string, width = page.width * 0.48, height = page.height * 0.36): Extract<CraftNode, { type: "image" }> {
  return {
    id: uid("image"),
    name: "Image",
    type: "image",
    x: page.width * 0.26,
    y: page.height * 0.3,
    width,
    height,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    constraints: defaultConstraintsFor("image"),
    assetId,
    objectFit: "cover",
    brightness: 1,
    contrast: 1,
  };
}
