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
  type DropShadow,
  type DaySlot,
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
  { id: "linkedin", name: "LinkedIn Banner", description: "1584 × 396", category: "Social", width: 1584, height: 396 },
  { id: "og", name: "Open Graph", description: "1200 × 630", category: "Web", width: 1200, height: 630 },
  { id: "li-landscape", name: "LinkedIn landscape", description: "1200 × 627", category: "Social", width: 1200, height: 627 },
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
    locked: extras.locked ?? false,
    hidden: extras.hidden ?? false,
    constraints: extras.constraints ?? DEFAULT_CONSTRAINTS,
    role,
    copyExempt: extras.copyExempt,
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
    locked: extras.locked ?? false,
    hidden: extras.hidden ?? false,
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

/** Hard offset shadow only — no soft/glass shadows. Section 5.4. */
const HARD_SHADOW: DropShadow = { color: "rgba(26,29,33,0.22)", blur: 0, x: 4, y: 4 };

/** Data, labels, captions live in mono — Section 5.3. Built directly (not via text()) since
 * FontRole only spans heading/body; this stays untouched by brand-remap on purpose. */
function monoText(
  name: string,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  size: number,
  role: ColorRole,
  extras: Partial<Extract<CraftNode, { type: "text" }>> = {},
): Extract<CraftNode, { type: "text" }> {
  return {
    id: uid("text"),
    name,
    type: "text",
    text: value,
    x,
    y,
    width,
    height,
    rotation: extras.rotation ?? 0,
    opacity: extras.opacity ?? 1,
    locked: extras.locked ?? false,
    hidden: extras.hidden ?? false,
    constraints: extras.constraints ?? DEFAULT_CONSTRAINTS,
    role,
    fontWeight: extras.fontWeight ?? "600",
    fontSize: size,
    align: extras.align ?? "left",
    letterSpacing: extras.letterSpacing ?? 3,
    lineHeight: extras.lineHeight ?? 1.3,
    color: DEFAULT_BRAND.colors[role],
    fontFamily: "JetBrains Mono",
    uppercase: extras.uppercase ?? true,
    animation: extras.animation,
    groupId: extras.groupId,
    groupName: extras.groupName,
  };
}

/**
 * The strata signature: a stepped, tapering cluster of angled bands standing in for the mark
 * at a glance — the brand's curved four-band geometry, adapted to this tool's straight-edge
 * shapes as a deliberate cut rather than a smooth sweep. Section 5.1a.
 */
function strataMark(
  x: number,
  y: number,
  w: number,
  bandH: number,
  roles: ColorRole[] = ["secondary", "muted", "accent", "primary"],
): Extract<CraftNode, { type: "shape" }>[] {
  const angles = [-6, 4, -3, 5, -2, 6];
  return roles.map((role, i) =>
    shape(
      `Strata band ${i + 1}`,
      "parallelogram",
      x - i * 6,
      y + i * (bandH * 0.72),
      Math.max(24, w - i * 18),
      bandH,
      role,
      { rotation: angles[i % angles.length], opacity: 0.94 },
    ),
  );
}

/**
 * A considered slot for the real mark. isLogoSlot() in brand.ts matches on the name "Logo"
 * and makeLogoNode() replaces this node wholesale, aspect-fitting the real logo asset inside
 * this exact box — so placement here is placement in the finished board. Without an explicit
 * slot, applyBrandLogo() falls back to a generic top-left pad-based box blind to the layout,
 * which is what was colliding with text and sitting redundantly beside strataMark clusters.
 */
function logo(x: number, y: number, w: number, h: number): Extract<CraftNode, { type: "shape" }> {
  return shape("Logo", "rect", x, y, w, h, "muted", { opacity: 1 });
}

function announcePost(): CraftPage {
  return pageOf("post", "Introducer — pack ready", [
    text("Eyebrow", "INTRODUCERS  ·  STRATA", 80, 64, 600, 30, 15, "muted", { letterSpacing: 3, fontWeight: "700", fontRole: "body" }),
    logo(924, 52, 72, 64),
    ...strataMark(900, 1132, 130, 10, ["secondary", "accent", "muted"]),
    text("Hook 1", "You keep the relationship.", 80, 168, 640, 150, 52, "text", { fontRole: "heading", lineHeight: 1.06 }),
    text("Hook 2", "We run the pack.", 80, 312, 640, 90, 44, "accent", { fontRole: "heading", lineHeight: 1.06 }),
    text("Deck", "You bring the client. Thin files do not go to Sterling. We package. We do not lend.", 80, 430, 560, 100, 21, "muted", { fontRole: "body", fontWeight: "400", lineHeight: 1.35 }),
    shape("Band peek", "parallelogram", 540, 640, 200, 460, "secondary", { rotation: -4, opacity: 0.85 }),
    shape("Media frame", "rect", 580, 660, 420, 500, "muted", { constraints: defaultConstraintsFor("image"), shadow: HARD_SHADOW }),
    shape("CTA", "rect", 80, 1176, 300, 66, "accent", { borderRadius: 2, shadow: HARD_SHADOW }),
    text("CTA label", "Talk to Strata", 80, 1196, 300, 30, 19, "text", { align: "center", fontRole: "body", fontWeight: "700" }),
    monoText("Hashtags", "#COMMERCIALFINANCE #INTRODUCERS", 80, 1272, 600, 22, 12, "muted", { letterSpacing: 1 }),
    monoText("Link", "STRATAFINANCE.CO.UK", 80, 1300, 500, 22, 12, "secondary", { letterSpacing: 1 }),
  ]);
}

function storyLaunch(): CraftPage {
  return pageOf(
    "story",
    "Story — full bleed ink",
    [
      shape("Ground", "rect", 0, 0, 1080, 1920, "primary", { constraints: { horizontal: "stretch", vertical: "stretch" } }),
      logo(80, 56, 72, 64),
      ...strataMark(720, 140, 260, 22, ["secondary", "muted", "accent", "background"]),
      monoText("Eyebrow", "SME DIRECTORS  ·  STRATA", 80, 300, 700, 30, 16, "background", { letterSpacing: 3, opacity: 0.75 }),
      text("Hook 1", "Declined is a decision", 80, 360, 940, 260, 76, "background", { fontRole: "heading", lineHeight: 1.02 }),
      text("Hook 2", "by one lender.", 80, 600, 940, 180, 68, "accent", { fontRole: "heading", lineHeight: 1.02 }),
      text("Deck", "It is not a verdict on the business. We package the file that moves.", 80, 840, 780, 140, 30, "background", { fontRole: "body", fontWeight: "400", lineHeight: 1.35, opacity: 0.72 }),
      shape("Media frame", "rect", 80, 1040, 920, 620, "muted", { constraints: defaultConstraintsFor("image"), shadow: HARD_SHADOW }),
      shape("CTA", "rect", 80, 1720, 420, 84, "accent", { borderRadius: 2, constraints: { horizontal: "start", vertical: "end" }, shadow: HARD_SHADOW }),
      text("CTA label", "Talk to Strata", 80, 1744, 420, 40, 24, "text", { align: "center", fontRole: "body", fontWeight: "700", constraints: { horizontal: "start", vertical: "end" } }),
    ],
    { mode: "solid", color: DEFAULT_BRAND.colors.primary },
  );
}

function quoteSquare(): CraftPage {
  return pageOf("square", "Quote — split ground", [
    shape("Ground", "rect", 0, 0, 1080, 1080, "background", { constraints: { horizontal: "stretch", vertical: "stretch" } }),
    shape("Ink panel", "rect", 0, 0, 620, 1080, "primary", { constraints: { horizontal: "start", vertical: "stretch" } }),
    logo(64, 56, 72, 64),
    ...strataMark(560, 420, 200, 18, ["accent", "secondary", "muted"]),
    text("Hook 1", "A personal guarantee", 72, 300, 500, 220, 44, "background", { fontRole: "heading", lineHeight: 1.08 }),
    text("Hook 2", "is not a formality.", 72, 520, 500, 140, 44, "accent", { fontRole: "heading", lineHeight: 1.08 }),
    text("Deck", "It is your house. Read what you are signing before you sign it.", 680, 640, 340, 160, 22, "muted", { fontRole: "body", fontWeight: "400", lineHeight: 1.4 }),
    monoText("Name", "READ THE SMALL PRINT", 680, 860, 340, 26, 13, "secondary", { letterSpacing: 2 }),
    monoText("Role", "A STRATA SERIES", 680, 892, 340, 24, 12, "muted", { letterSpacing: 2, opacity: 0.8 }),
  ]);
}

function liLandscape(): CraftPage {
  return pageOf("li-landscape", "LinkedIn landscape", [
    shape("Ground", "rect", 0, 0, 1200, 627, "background", {
      constraints: { horizontal: "stretch", vertical: "stretch" },
    }),
    shape("Media frame", "rect", 0, 0, 460, 627, "muted", {
      constraints: defaultConstraintsFor("image"),
      shadow: HARD_SHADOW,
    }),
    shape("LightLeak", "rect", 0, 0, 12, 627, "accent", { hidden: true }),
    shape("RedactSweep", "rect", 40, 220, 380, 56, "primary", { hidden: true, opacity: 0.92, copyExempt: true }),
    monoText("Eyebrow", "", 500, 40, 640, 24, 13, "muted", { letterSpacing: 2 }),
    text("Hook 1", "", 500, 80, 640, 110, 36, "text", { fontRole: "heading", lineHeight: 1.08 }),
    text("Hook 2", "", 500, 196, 640, 90, 32, "accent", { fontRole: "heading", lineHeight: 1.08 }),
    text("Body", "", 500, 300, 640, 110, 16, "muted", { fontRole: "body", fontWeight: "400", lineHeight: 1.35 }),
    text("Voice", "", 500, 300, 640, 80, 18, "muted", { hidden: true, fontRole: "body", fontWeight: "400" }),
    monoText("DataTicker", "00", 80, 500, 300, 72, 56, "text", { hidden: true, letterSpacing: 1, uppercase: false }),
    text("Silence", "", 80, 240, 1040, 90, 28, "text", { hidden: true, fontRole: "heading" }),
    shape("CTA", "rect", 500, 470, 220, 52, "accent", { borderRadius: 2, shadow: HARD_SHADOW }),
    text("CTA label", "", 500, 484, 220, 28, 16, "text", { align: "center", fontRole: "body", fontWeight: "700" }),
    monoText("Identity", "We package the case. We do not lend.", 500, 548, 640, 24, 13, "text", {
      letterSpacing: 2,
      uppercase: false,
      locked: true,
    }),
  ]);
}

function trackRole(): ReturnType<typeof text> {
  return text("Role", "", 0, 0, 12, 12, 10, "muted", { hidden: true });
}

function identityLine(x: number, y: number, width = 1040, role: ColorRole = "text"): ReturnType<typeof monoText> {
  return monoText("Identity", "We package the case. We do not lend.", x, y, width, 24, 13, role, {
    letterSpacing: 2,
    uppercase: false,
    locked: true,
    shadow: HARD_SHADOW,
  });
}

/** Seven different 1200×627 boards. Cloning li-landscape seven times is a PowerPoint deck. */
export function weekDayPage(slot: DaySlot): CraftPage {
  const stretch = { constraints: { horizontal: "stretch" as const, vertical: "stretch" as const } };
  const hard = { borderRadius: 0, shadow: HARD_SHADOW };
  const nodes: CraftNode[] =
    slot === "monday-two-beat"
      ? [
          shape("Ground", "rect", 0, 0, 1200, 627, "primary", stretch),
          shape("Gold blade", "rect", 0, 0, 8, 627, "accent"),
          monoText("Eyebrow", "", 48, 28, 720, 22, 12, "background", { letterSpacing: 4, opacity: 0.7 }),
          text("Hook 1", "", 40, 64, 1140, 220, 80, "background", { fontRole: "heading", lineHeight: 0.94, fontWeight: "800" }),
          text("Hook 2", "", 48, 300, 980, 88, 42, "accent", { fontRole: "heading", lineHeight: 1.0 }),
          text("Body", "", 48, 408, 760, 72, 16, "background", { fontRole: "body", fontWeight: "400", lineHeight: 1.35, opacity: 0.72 }),
          shape("CTA", "rect", 48, 500, 220, 48, "accent", hard),
          text("CTA label", "", 48, 512, 220, 26, 15, "text", { align: "center", fontRole: "body", fontWeight: "700" }),
          identityLine(48, 568, 900, "background"),
          monoText("Hashtags", "", 320, 514, 400, 24, 11, "muted", { letterSpacing: 1, hidden: true }),
          monoText("Link", "", 740, 514, 400, 24, 11, "background", { letterSpacing: 1, hidden: true }),
          trackRole(),
        ]
      : slot === "tuesday-stamp"
        ? [
            shape("Ground", "rect", 0, 0, 1200, 627, "background", stretch),
            shape("LightLeak", "rect", 0, 0, 8, 627, "accent"),
            shape("Media frame", "rect", 40, 40, 500, 547, "muted", { shadow: HARD_SHADOW }),
            monoText("Eyebrow", "", 580, 48, 560, 22, 12, "muted", { letterSpacing: 4 }),
            text("Hook 1", "", 580, 140, 560, 160, 36, "text", { fontRole: "heading", lineHeight: 1.02 }),
            text("Hook 2", "", 580, 320, 560, 80, 24, "accent", { fontRole: "heading", lineHeight: 1.08 }),
            text("Body", "", 580, 420, 400, 40, 16, "muted", { hidden: true, fontRole: "body" }),
            identityLine(580, 568, 560),
            trackRole(),
          ]
        : slot === "wednesday-voice"
          ? [
              shape("Ground", "rect", 0, 0, 1200, 627, "primary", stretch),
              shape("Media frame", "rect", 0, 0, 1200, 627, "muted", stretch),
              shape("Wash", "rect", 0, 240, 1200, 387, "primary", { opacity: 0.72 }),
              monoText("Eyebrow", "", 48, 36, 800, 22, 12, "background", { letterSpacing: 4, opacity: 0.75 }),
              text("Voice", "", 48, 280, 1104, 200, 44, "background", { fontRole: "heading", lineHeight: 1.08 }),
              text("Hook 1", "", 48, 80, 400, 40, 18, "text", { hidden: true }),
              text("Hook 2", "", 48, 120, 400, 40, 18, "accent", { hidden: true }),
              text("Body", "", 48, 160, 400, 40, 16, "muted", { hidden: true }),
              identityLine(48, 568, 1100, "background"),
              trackRole(),
            ]
          : slot === "thursday-redact"
            ? [
                shape("Ground", "rect", 0, 0, 1200, 627, "background", stretch),
                monoText("Eyebrow", "", 48, 28, 800, 22, 12, "muted", { letterSpacing: 4 }),
                shape("RedactSweep", "rect", 40, 88, 1120, 96, "primary", { opacity: 0.94, copyExempt: true }),
                text("Hook 1", "", 48, 220, 1104, 140, 56, "text", { fontRole: "heading", lineHeight: 0.98 }),
                text("Hook 2", "", 48, 372, 1104, 72, 32, "accent", { fontRole: "heading" }),
                text("Body", "", 48, 460, 820, 56, 16, "muted", { fontRole: "body", fontWeight: "400", lineHeight: 1.35 }),
                identityLine(48, 568),
                trackRole(),
              ]
            : slot === "friday-number"
              ? [
                  shape("Ground", "rect", 0, 0, 1200, 627, "primary", stretch),
                  monoText("Eyebrow", "", 48, 24, 800, 22, 12, "background", { letterSpacing: 4, hidden: true }),
                  monoText("DataTicker", "00", -40, 16, 1240, 240, 168, "background", {
                    letterSpacing: -6,
                    uppercase: false,
                    fontWeight: "800",
                  }),
                  text("Body", "", 48, 280, 900, 80, 20, "background", { fontRole: "body", fontWeight: "400", lineHeight: 1.3, opacity: 0.8 }),
                  text("Hook 1", "", 48, 80, 400, 40, 18, "text", { hidden: true }),
                  text("Hook 2", "", 48, 120, 400, 40, 18, "accent", { hidden: true }),
                  shape("CTA", "rect", 48, 400, 220, 48, "accent", hard),
                  text("CTA label", "", 48, 412, 220, 26, 15, "text", { align: "center", fontRole: "body", fontWeight: "700" }),
                  identityLine(48, 568, 900, "background"),
                  trackRole(),
                ]
              : slot === "saturday-object"
                ? [
                    shape("Ground", "rect", 0, 0, 1200, 627, "primary", stretch),
                    shape("Media frame", "rect", 0, 0, 1200, 627, "muted", stretch),
                    shape("CaptionBar", "rect", 0, 460, 1200, 167, "primary", { opacity: 0.88 }),
                    monoText("Eyebrow", "", 40, 20, 600, 22, 11, "background", { letterSpacing: 4, opacity: 0.8 }),
                    text("Hook 1", "", 40, 480, 900, 44, 24, "background", { fontRole: "heading", lineHeight: 1.05 }),
                    text("Hook 2", "", 40, 526, 800, 32, 18, "accent", { fontRole: "body" }),
                    identityLine(40, 572, 800, "background"),
                    trackRole(),
                  ]
                : [
                    shape("Ground", "rect", 0, 0, 1200, 627, "background", stretch),
                    monoText("Eyebrow", "", 72, 40, 900, 22, 12, "muted", { letterSpacing: 6, hidden: true }),
                    text("Hook 1", "", 72, 248, 960, 120, 36, "text", { fontRole: "heading", align: "left", lineHeight: 1.12 }),
                    text("Hook 2", "", 72, 400, 400, 40, 18, "accent", { hidden: true }),
                    text("Body", "", 72, 440, 400, 40, 16, "muted", { hidden: true }),
                    text("CTA label", "", 72, 500, 200, 28, 16, "text", { hidden: true }),
                    identityLine(72, 568, 960),
                    trackRole(),
                  ];
  const page = pageOf("li-landscape", slot, nodes);
  return { ...page, daySlot: slot };
}

function ogBanner(): CraftPage {
  return pageOf("og", "Open Graph — three-column cut", [
    shape("Ground", "rect", 0, 0, 1200, 630, "background", { constraints: { horizontal: "stretch", vertical: "stretch" } }),
    shape("Media frame", "rect", 0, 0, 480, 630, "muted", { constraints: defaultConstraintsFor("image") }),
    shape("Rail", "rect", 860, 0, 340, 630, "secondary", { constraints: { horizontal: "end", vertical: "stretch" } }),
    logo(908, 14, 96, 68),
    ...strataMark(430, -10, 140, 14, ["accent", "muted", "secondary"]),
    monoText("Eyebrow", "SME DIRECTORS  ·  STRATA", 520, 60, 320, 24, 13, "muted", { letterSpacing: 2 }),
    text("Hook 1", "The bank took", 520, 100, 320, 130, 36, "text", { fontRole: "heading", lineHeight: 1.08 }),
    text("Hook 2", "eight weeks to say no.", 520, 220, 320, 120, 34, "accent", { fontRole: "heading", lineHeight: 1.08 }),
    text("Deck", "Here is what happened in week one, and what a complete file changes.", 520, 360, 320, 130, 16, "muted", { fontRole: "body", fontWeight: "400", lineHeight: 1.35 }),
    monoText("Rail label", "WE PACKAGE", 908, 90, 240, 24, 13, "background", { letterSpacing: 3, opacity: 0.85 }),
    text("Rail word", "We do not lend.", 908, 130, 240, 130, 26, "background", { fontRole: "heading", lineHeight: 1.2 }),
    shape("CTA", "rect", 908, 470, 220, 56, "accent", { borderRadius: 2, shadow: HARD_SHADOW }),
    text("CTA label", "Talk to Strata", 908, 486, 220, 30, 17, "text", { align: "center", fontRole: "body", fontWeight: "700" }),
    monoText("Link", "STRATAFINANCE.CO.UK", 908, 560, 240, 22, 11, "background", { letterSpacing: 1, opacity: 0.7 }),
  ]);
}

function linkedInBanner(): CraftPage {
  // LinkedIn personal cover: profile photo covers ~240×160 bottom-left. Keep that zone clear.
  return pageOf(
    "linkedin",
    "LinkedIn cover — ink",
    [
      shape("Ground", "rect", 0, 0, 1584, 396, "primary", { constraints: { horizontal: "stretch", vertical: "stretch" } }),
      logo(620, 8, 64, 57),
      ...strataMark(-30, 40, 220, 20, ["secondary", "muted", "accent", "background"]),
      monoText("Wordmark", "STRATA FINANCE", 620, 78, 860, 26, 14, "background", { letterSpacing: 5, opacity: 0.85 }),
      text("Hook 1", "We build the case.", 620, 118, 940, 90, 46, "background", { fontRole: "heading", lineHeight: 1.05 }),
      text("Hook 2", "Layer by layer.", 620, 200, 940, 70, 40, "accent", { fontRole: "heading", lineHeight: 1.05 }),
      monoText("Sub", "UK COMMERCIAL FINANCE, PACKAGED  ·  WE DO NOT LEND", 624, 300, 900, 24, 13, "background", { letterSpacing: 2, opacity: 0.7 }),
    ],
    { mode: "solid", color: DEFAULT_BRAND.colors.primary },
  );
}

function xPost(): CraftPage {
  return pageOf("twitter", "X — ledger cut", [
    shape("Ground", "rect", 0, 0, 1200, 675, "background", { constraints: { horizontal: "stretch", vertical: "stretch" } }),
    shape("Ink corner", "rect", 0, 0, 420, 675, "primary", { constraints: { horizontal: "start", vertical: "stretch" } }),
    logo(64, 56, 72, 64),
    ...strataMark(360, 500, 180, 16, ["accent", "secondary", "muted"]),
    monoText("Eyebrow", "HMRC, ACTUALLY", 460, 96, 660, 26, 14, "muted", { letterSpacing: 3 }),
    text("Hook 1", "HMRC said Time to Pay", 460, 140, 700, 150, 42, "text", { fontRole: "heading", lineHeight: 1.06 }),
    text("Hook 2", "wasn't available.", 460, 260, 700, 80, 42, "accent", { fontRole: "heading", lineHeight: 1.06 }),
    text("Body", "HMRC was wrong. It is negotiable, and the terms depend on how the case is presented.", 460, 380, 660, 100, 21, "muted", { fontRole: "body", fontWeight: "400", lineHeight: 1.35 }),
    monoText("Handle", "@STRATAFINANCE", 460, 560, 400, 24, 13, "secondary", { letterSpacing: 1 }),
  ]);
}

function emailHeader(): CraftPage {
  return pageOf("email", "Email mast — ink", [
    shape("Ground", "rect", 0, 0, 600, 200, "primary", { constraints: { horizontal: "stretch", vertical: "stretch" } }),
    logo(40, 6, 48, 42),
    ...strataMark(500, 24, 120, 10, ["accent", "secondary", "muted"]),
    monoText("Kicker", "STRATA LAYER", 40, 56, 300, 22, 12, "background", { letterSpacing: 3, opacity: 0.75 }),
    text("Title", "This month's numbers", 40, 88, 460, 60, 30, "background", { fontRole: "heading" }),
    text("Title2", "in five lines.", 40, 138, 460, 46, 26, "accent", { fontRole: "heading" }),
  ]);
}

function emailLetter(): CraftPage {
  return pageOf("email-letter", "Email — Strata Layer", [
    shape("Mast", "rect", 0, 0, 600, 96, "primary", { constraints: { horizontal: "stretch", vertical: "start" } }),
    logo(508, 20, 56, 50),
    monoText("Brand", "STRATA FINANCE", 32, 38, 400, 22, 13, "background", { letterSpacing: 3 }),
    text("Greeting", "Hi {{firstName}},", 32, 130, 536, 40, 24, "text", { fontRole: "heading" }),
    text(
      "Body",
      "We package UK commercial finance for SME directors. We do not lend. If {{companyName}} needs a complete file, talk to us.",
      32,
      188,
      536,
      130,
      17,
      "muted",
      { fontRole: "body", fontWeight: "400", lineHeight: 1.45 },
    ),
    shape("Rule", "rect", 32, 340, 90, 3, "accent"),
    text("Signoff", "{{senderName}}\n{{senderCompany}}", 32, 364, 536, 60, 16, "text", { fontRole: "body", fontWeight: "600", lineHeight: 1.4 }),
    monoText("Unsub", "{{unsubscribeLink}}", 32, 850, 536, 22, 11, "muted", { letterSpacing: 0.5, uppercase: false }),
  ]);
}

function promoSquare(): CraftPage {
  return pageOf("square", "Decline Autopsy promo", [
    shape("Ground", "rect", 0, 0, 1080, 1080, "background", { constraints: { horizontal: "stretch", vertical: "stretch" } }),
    shape("Media", "rect", 0, 0, 1080, 680, "muted", { constraints: defaultConstraintsFor("image"), shadow: HARD_SHADOW }),
    logo(900, 730, 64, 57),
    monoText("Kicker", "DECLINE AUTOPSY", 80, 760, 500, 28, 16, "accent", { letterSpacing: 3 }),
    text("Product", "What the lender saw.", 80, 810, 900, 100, 46, "text", { fontRole: "heading" }),
    shape("CTA", "rect", 80, 960, 260, 64, "accent", { borderRadius: 2, shadow: HARD_SHADOW }),
    text("CTA label", "Read the case", 80, 978, 260, 30, 19, "text", { align: "center", fontRole: "body", fontWeight: "700" }),
    monoText("Series", "A STRATA SERIES", 820, 984, 200, 24, 12, "muted", { align: "right", letterSpacing: 1 }),
  ]);
}

function eventStory(): CraftPage {
  return pageOf(
    "story",
    "The Monthly Numbers",
    [
      shape("Ground", "rect", 0, 0, 1080, 1920, "background", { constraints: { horizontal: "stretch", vertical: "stretch" } }),
      shape("Date block", "rect", 80, 160, 240, 240, "accent", { borderRadius: 2, shadow: HARD_SHADOW }),
      monoText("Day", "N=", 80, 210, 240, 60, 26, "text", { align: "center" }),
      text("Stat", "—", 80, 250, 240, 120, 64, "text", { align: "center", fontRole: "heading" }),
      monoText("Month", "INSOLVENCY SERVICE", 80, 380, 240, 44, 12, "text", { align: "center", letterSpacing: 1, lineHeight: 1.3 }),
      logo(900, 56, 72, 64),
      ...strataMark(760, 200, 200, 18, ["secondary", "muted", "accent"]),
      monoText("Eyebrow", "THE MONTHLY NUMBERS", 80, 480, 900, 30, 16, "muted", { letterSpacing: 3 }),
      text("Title", "What the data means", 80, 540, 920, 160, 56, "text", { fontRole: "heading", lineHeight: 1.05 }),
      text("Title2", "for your business.", 80, 690, 920, 100, 56, "accent", { fontRole: "heading", lineHeight: 1.05 }),
      text("Where", "Five lines. No jargon. Cited, not invented.", 80, 820, 800, 60, 24, "muted", { fontRole: "body", fontWeight: "400" }),
      shape("CTA", "rect", 80, 1740, 460, 84, "primary", { borderRadius: 2, constraints: { horizontal: "start", vertical: "end" }, shadow: HARD_SHADOW }),
      text("CTA label", "Read this month's numbers", 80, 1764, 460, 40, 21, "background", { align: "center", fontRole: "body", fontWeight: "700", constraints: { horizontal: "start", vertical: "end" } }),
    ],
  );
}

function gifCaption(): CraftPage {
  return pageOf(
    "gif-square",
    "Caption GIF — ledger",
    [
      shape("Ground", "rect", 0, 0, 800, 800, "primary", { constraints: { horizontal: "stretch", vertical: "stretch" } }),
      logo(368, 344, 64, 57),
      shape("Top bar", "rect", 0, 0, 800, 110, "primary", { constraints: defaultConstraintsFor("bar"), opacity: 0.92, animation: fade }),
      monoText("Top", "THE BANK SAID NO", 40, 40, 720, 40, 26, "background", { align: "center", letterSpacing: 3, animation: fade }),
      shape("Bottom bar", "rect", 0, 690, 800, 110, "primary", { constraints: { horizontal: "stretch", vertical: "end" }, opacity: 0.92, animation: pop }),
      monoText("Bottom", "THE MARKET SAID MAYBE", 40, 728, 720, 40, 26, "accent", { align: "center", letterSpacing: 3, constraints: { horizontal: "stretch", vertical: "end" }, animation: pop }),
    ],
    { mode: "solid", color: DEFAULT_BRAND.colors.primary },
  );
}

function youtubeThumb(): CraftPage {
  return pageOf("youtube", "YouTube — ledger slab", [
    shape("Ground", "rect", 0, 0, 1280, 720, "primary", { constraints: { horizontal: "stretch", vertical: "stretch" } }),
    shape("Accent slab", "parallelogram", 0, 0, 40, 720, "accent", { constraints: { horizontal: "start", vertical: "stretch" }, rotation: -1 }),
    logo(96, 632, 72, 64),
    monoText("Eyebrow", "STRATA EXPLAINS", 96, 88, 700, 30, 16, "background", { letterSpacing: 3, opacity: 0.75 }),
    text("Title", "The file that", 96, 160, 900, 130, 62, "background", { fontRole: "heading", lineHeight: 1.02 }),
    text("Title2", "moves the lender.", 96, 280, 900, 130, 62, "accent", { fontRole: "heading", lineHeight: 1.02 }),
    shape("Play", "ellipse", 1000, 260, 180, 180, "accent", { constraints: { horizontal: "end", vertical: "center" }, shadow: HARD_SHADOW }),
    shape("Play arrow", "triangle", 1064, 310, 80, 80, "primary", { rotation: 90, constraints: { horizontal: "end", vertical: "center" } }),
  ]);
}

function pinterestPin(): CraftPage {
  return pageOf("pinterest", "Pin — checklist", [
    shape("Ground", "rect", 0, 0, 1000, 1500, "background", { constraints: { horizontal: "stretch", vertical: "stretch" } }),
    shape("Media", "rect", 0, 0, 1000, 820, "muted", { constraints: defaultConstraintsFor("image"), shadow: HARD_SHADOW }),
    logo(872, 24, 64, 57),
    ...strataMark(820, 860, 160, 14, ["accent", "secondary", "muted"]),
    monoText("Kicker", "THE LENDER'S CHECKLIST", 64, 990, 500, 26, 14, "muted", { letterSpacing: 2 }),
    text("Title", "22 things the", 64, 1030, 872, 100, 46, "text", { fontRole: "heading", lineHeight: 1.05 }),
    text("Title2", "underwriter checks first.", 64, 1120, 872, 100, 46, "accent", { fontRole: "heading", lineHeight: 1.05 }),
    monoText("Hint", "STRATAFINANCE.CO.UK/LEARN", 64, 1400, 700, 22, 12, "secondary", { letterSpacing: 1 }),
  ]);
}

function testimonialSquare(): CraftPage {
  return pageOf("square", "Introducer testimonial", [
    shape("Ground", "rect", 0, 0, 1080, 1080, "secondary", { constraints: { horizontal: "stretch", vertical: "stretch" } }),
    logo(900, 972, 72, 64),
    ...strataMark(80, 80, 160, 14, ["accent", "background", "muted"]),
    text("Quote", "The file arrived complete.", 80, 300, 920, 200, 46, "background", { fontRole: "heading", lineHeight: 1.15 }),
    text("Quote2", "First time.", 80, 480, 920, 120, 46, "accent", { fontRole: "heading", lineHeight: 1.15 }),
    shape("Bar", "rect", 80, 640, 90, 4, "accent"),
    monoText("Name", "PARTNER, ICAEW PRACTICE", 80, 680, 500, 24, 13, "background", { letterSpacing: 2, opacity: 0.85 }),
    monoText("Source", "AN INTRODUCER, NOT A CLIENT", 80, 716, 500, 22, 12, "background", { letterSpacing: 1, opacity: 0.55 }),
  ]);
}

function speakerCard(): CraftPage {
  return pageOf("square", "Founder card", [
    shape("Ground", "rect", 0, 0, 1080, 1080, "primary", { constraints: { horizontal: "stretch", vertical: "stretch" } }),
    shape("Portrait well", "rect", 80, 80, 440, 920, "muted", { constraints: defaultConstraintsFor("image"), shadow: HARD_SHADOW }),
    logo(900, 32, 72, 64),
    ...strataMark(560, 120, 180, 16, ["accent", "secondary", "muted"]),
    monoText("Eyebrow", "THIRTY YEARS LENDER-SIDE", 580, 220, 420, 26, 13, "background", { letterSpacing: 2, opacity: 0.8 }),
    text("Name", "Shaun Tuhey", 580, 260, 420, 140, 48, "background", { fontRole: "heading", lineHeight: 1.05 }),
    text("Role", "Director, Strata Finance", 580, 400, 420, 60, 22, "background", { fontRole: "body", fontWeight: "400", opacity: 0.65 }),
    shape("Rule", "rect", 580, 480, 70, 3, "accent"),
    text("Talk", "What the credit\ncommittee actually said.", 580, 520, 420, 220, 34, "background", { fontRole: "heading", lineHeight: 1.2 }),
    monoText("Meta", "STRATA FINANCE  ·  STRENGTH, LAYER BY LAYER", 580, 940, 420, 22, 11, "background", { letterSpacing: 1, opacity: 0.55 }),
  ], { mode: "solid", color: DEFAULT_BRAND.colors.primary });
}

function priceList(): CraftPage {
  return pageOf("post", "Tools menu — Learn", [
    shape("Ground", "rect", 0, 0, 1080, 1350, "background", { constraints: { horizontal: "stretch", vertical: "stretch" } }),
    logo(900, 50, 72, 64),
    ...strataMark(900, 1190, 140, 10, ["accent", "secondary", "muted"]),
    monoText("Eyebrow", "STRATA LEARN  ·  TOOLS", 80, 90, 700, 28, 15, "muted", { letterSpacing: 3 }),
    text("Title", "Run the numbers", 80, 140, 900, 90, 48, "text", { fontRole: "heading" }),
    text("Title2", "before the call.", 80, 226, 900, 80, 48, "accent", { fontRole: "heading" }),
    shape("Rule", "rect", 80, 330, 120, 4, "accent"),
    text("Item 1", "Time to Pay Calculator", 80, 380, 700, 44, 26, "text", { fontRole: "heading" }),
    monoText("Price 1", "FREE", 800, 384, 200, 36, 16, "accent", { align: "right" }),
    text("Note 1", "Term, arrears, and the HMRC late-payment rate, worked through.", 80, 428, 900, 40, 17, "muted", { fontRole: "body", fontWeight: "400" }),
    text("Item 2", "Debt Stress Check", 80, 520, 700, 44, 26, "text", { fontRole: "heading" }),
    monoText("Price 2", "FREE", 800, 524, 200, 36, 16, "accent", { align: "right" }),
    text("Note 2", "Where the pressure actually sits, in five questions.", 80, 568, 900, 40, 17, "muted", { fontRole: "body", fontWeight: "400" }),
    text("Item 3", "Lender's Checklist", 80, 660, 700, 44, 26, "text", { fontRole: "heading" }),
    monoText("Price 3", "FREE", 800, 664, 200, 36, 16, "accent", { align: "right" }),
    text("Note 3", "22 things the underwriter checks before reading a word.", 80, 708, 900, 40, 17, "muted", { fontRole: "body", fontWeight: "400" }),
    shape("Footer", "rect", 0, 1180, 1080, 170, "primary", { constraints: { horizontal: "stretch", vertical: "end" } }),
    text("Book", "learn.stratanexus.co.uk", 80, 1236, 500, 50, 24, "background", { fontRole: "heading", constraints: { horizontal: "start", vertical: "end" } }),
    monoText("Handle", "@STRATAFINANCE", 700, 1244, 300, 30, 14, "accent", { align: "right", constraints: { horizontal: "end", vertical: "end" } }),
  ]);
}

export const DESIGN_TEMPLATES: DesignTemplate[] = [
  { id: "linkedin-banner", name: "LinkedIn Cover", description: "Ink ground, strata mark bleeding off the edge", category: "Social", presetId: "linkedin", build: linkedInBanner },
  { id: "announce-post", name: "Introducer Post", description: "Asymmetric pack-ready post for the introducer track", category: "Social", presetId: "post", build: announcePost },
  { id: "story-launch", name: "Full-Bleed Story", description: "Ink story with a cropped two-colour hook", category: "Social", presetId: "story", build: storyLaunch },
  { id: "quote-square", name: "Read the Small Print", description: "Split ink/paper ground for a single clause", category: "Social", presetId: "square", build: quoteSquare },
  { id: "promo-square", name: "Decline Autopsy", description: "Full-bleed case still with a strata mark cut", category: "Social", presetId: "square", build: promoSquare },
  { id: "event-story", name: "The Monthly Numbers", description: "Data-release story with a mono stat block", category: "Social", presetId: "story", build: eventStory },
  { id: "x-post", name: "HMRC, Actually", description: "Ink corner cut against a standing correction", category: "Social", presetId: "twitter", build: xPost },
  { id: "og-banner", name: "Open Graph — Rail", description: "Structural blue rail, strata mark bleeding off the corner", category: "Web", presetId: "og", build: ogBanner },
  { id: "li-landscape", name: "LinkedIn landscape", description: "Week board. Paper, identity, two-beat hook.", category: "Social", presetId: "li-landscape", build: liLandscape },
  { id: "email-header", name: "Email Mast", description: "Ink newsletter mast with a strata mark", category: "Web", presetId: "email", build: emailHeader },
  { id: "email-letter", name: "Strata Layer Email", description: "600px letter with merge tags", category: "Docs", presetId: "email-letter", build: emailLetter },
  { id: "gif-caption", name: "Caption GIF", description: "Mono top/bottom bars, band-in motion", category: "Motion", presetId: "gif-square", build: gifCaption },
  { id: "youtube-thumb", name: "Strata Explains", description: "Angled accent slab, two-colour title", category: "Social", presetId: "youtube", build: youtubeThumb },
  { id: "pinterest-pin", name: "The Lender's Checklist", description: "Full-bleed still over a mono kicker", category: "Social", presetId: "pinterest", build: pinterestPin },
  { id: "testimonial", name: "Introducer Testimonial", description: "Blue ground, third-party proof, mono attribution", category: "Social", presetId: "square", build: testimonialSquare },
  { id: "speaker-card", name: "Founder Card", description: "Ink ground, portrait rail, founder proof", category: "Social", presetId: "square", build: speakerCard },
  { id: "price-list", name: "Learn Tools Menu", description: "Time to Pay Calculator, Debt Stress Check, Checklist", category: "Social", presetId: "post", build: priceList },
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
