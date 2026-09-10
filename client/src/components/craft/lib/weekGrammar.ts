import { BANNED, COPY_LIMITS, PACKAGER_IDENTITY, defaultEyebrow, type CraftPost } from "@shared/craftQueue";
import { IDENTITY_LINES, identityLineFor } from "@shared/craftDirector";
import { CRAFT_MANUAL_MOTION, CRAFT_OVERLAY_PRESETS, weekPlaybook } from "@shared/craftManual";
import { applyBrand } from "./brand";
import { applyNodeMotion, applyNodeShadow } from "./looks";
import { presetById } from "./motionPresets";
import { documentFromTemplate, weekDayPage } from "./templates";
import {
  DEFAULT_BRAND,
  uid,
  type CraftAsset,
  type CraftDocument,
  type CraftNode,
  type CraftPage,
  type DaySlot,
  type MotionNode,
  type WeekMaster,
  type WeekRoute,
} from "./types";

export type { DaySlot, WeekMaster, WeekRoute };

export const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const DAY_SLOTS: DaySlot[] = [
  "monday-two-beat",
  "tuesday-stamp",
  "wednesday-voice",
  "thursday-redact",
  "friday-number",
  "saturday-object",
  "sunday-silence",
];

export const WEEK_IDENTITY = IDENTITY_LINES[1];
export const HARD_OFFSET = { color: "rgba(26,29,33,0.22)", blur: 0, x: 4, y: 4 };

const FRIDAY_RATE = /%|\bAPR\b|\bfrom\b|\d+(\.\d+)?%/i;
const CATEGORY_PHOTO = /\b(tower|handshake|lawn|glass)\b/i;
const COPY_SLOT = /^(hook 1|hook 2|body|deck|cta|cta label|eyebrow|dataticker|silence|voice)$/i;

export type BoardFinding = {
  level: "block" | "warn";
  code: string;
  message: string;
  nodeId?: string;
};

export type WeekReview = {
  ok: boolean;
  findings: BoardFinding[];
};

export type VisualPick = { asset: CraftAsset } | { empty: true; reason: string };

const CONTRACT: Record<DaySlot, { day: string; must: string; forbidden: string; reminder: string }> = {
  "monday-two-beat": {
    day: "Monday",
    must: "Hook 1 + Hook 2. Hook 2 is the correction. Identity present.",
    forbidden: "A single slogan. Stock handshake.",
    reminder: "Monday — two-beat. Hook 2 is the correction.",
  },
  "tuesday-stamp": {
    day: "Tuesday",
    must: "Identity is the visual (stamp / lockup). Gold only here or on LightLeak.",
    forbidden: "Gold as fill. Decorative foil soup.",
    reminder: "Tuesday — stamp. Identity is the object.",
  },
  "wednesday-voice": {
    day: "Wednesday",
    must: "A named introducer sentence or a filed quote. Brand is the frame.",
    forbidden: "Fake headshot. Invented firm.",
    reminder: "Wednesday — named voice. Brand is the frame.",
  },
  "thursday-redact": {
    day: "Thursday",
    must: "A category myth exists only as artwork. Copy fields contain the correction only.",
    forbidden: "Banned phrase inside Hook/Body/CTA.",
    reminder: "Thursday — myth is artwork only.",
  },
  "friday-number": {
    day: "Friday",
    must: "One integer or count that is a policy or a desk fact.",
    forbidden: "% APR from rate tables.",
    reminder: "Friday — one count. No rates.",
  },
  "saturday-object": {
    day: "Saturday",
    must: "One object witness (letter, file, stamp on manila).",
    forbidden: "Glass tower, lawn, handshake.",
    reminder: "Saturday — one object on the desk.",
  },
  "sunday-silence": {
    day: "Sunday",
    must: "Max 8 words on the board. No still required.",
    forbidden: "Panic-fill. Extra CTAs.",
    reminder: "Sunday — leave the board empty enough.",
  },
};

export function weekContractReminder(slot: DaySlot): string {
  return CONTRACT[slot].reminder;
}

export function isoWeekId(date: Date | string = new Date()): string {
  const source = typeof date === "string" ? new Date(`${date}T00:00:00Z`) : new Date(date);
  const utc = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), source.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function mondayOf(isoDate: string): Date {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const day = d.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function defaultWeekMaster(weekId: string, route: WeekRoute = "sharp-cultural"): WeekMaster {
  return {
    weekId,
    route,
    type: { display: "Unbounded", body: "Inter", mono: "JetBrains Mono" },
    finish: { shadow: "hard-offset", radiusImage: 0, radiusChip: 2 },
    goldMaxArea: 0.1,
    identity: identityLineFor(weekId),
    platformLine: "",
  };
}

function clonePage(page: CraftPage, name: string, daySlot: DaySlot): CraftPage {
  const copy = JSON.parse(JSON.stringify(page)) as CraftPage;
  copy.id = uid("page");
  copy.name = name;
  copy.daySlot = daySlot;
  copy.nodes = copy.nodes.map((node) => ({ ...node, id: uid(node.type) }));
  return copy;
}

function show(node: CraftNode, visible: boolean): CraftNode {
  return { ...node, hidden: !visible };
}

function lockIdentity(node: CraftNode, identity: string): CraftNode {
  if (node.type !== "text" || node.name !== "Identity") return node;
  return {
    ...node,
    text: identity,
    locked: true,
    fontFamily: "JetBrains Mono",
    hidden: false,
  };
}

export function applyDayContract(page: CraftPage, slot: DaySlot, route: WeekRoute = "sharp-cultural"): CraftPage {
  const still = route === "safe-distinctive";
  const nodes = page.nodes.map((node) => {
    let next = node.name === "Identity" ? lockIdentity(node, identityLineFor(slot)) : node;
    if (next.name === "Hashtags") next = show(next, false);
    if (next.name === "Identity") next = { ...next, shadow: { ...HARD_OFFSET } };
    if (next.shadow) next = { ...next, shadow: { ...HARD_OFFSET } };
    if (next.name === "CTA" || next.name === "Media frame" || next.name === "Visual") {
      next = applyNodeShadow(next, "hard");
      next = { ...next, shadow: { ...HARD_OFFSET } };
    }

    if (slot === "monday-two-beat") {
      if (next.name === "Hook 1" || next.name === "Hook 2") {
        next = show(applyNodeMotion(next, still ? "none" : "slideIn"), true);
      }
      if (next.name === "RedactSweep" || next.name === "DataTicker" || next.name === "Silence" || next.name === "Voice") {
        next = show(next, false);
      }
    }
    if (slot === "tuesday-stamp") {
      if (next.name === "LightLeak") next = show(next, true);
      if (next.name === "Body") next = show(next, false);
      if (next.name === "RedactSweep" || next.name === "DataTicker" || next.name === "Silence") next = show(next, false);
    }
    if (slot === "wednesday-voice") {
      if (next.name === "Voice") next = show(next, true);
      if (next.name === "Body" || next.name === "Hook 1" || next.name === "Hook 2") next = show(next, false);
      if (next.name === "RedactSweep" || next.name === "DataTicker" || next.name === "Silence" || next.name === "LightLeak") {
        next = show(next, false);
      }
    }
    if (slot === "thursday-redact") {
      if (next.name === "RedactSweep") next = show({ ...next, copyExempt: true }, true);
      if (next.name === "DataTicker" || next.name === "Silence" || next.name === "LightLeak") next = show(next, false);
    }
    if (slot === "friday-number") {
      if (next.name === "DataTicker") next = show(next, true);
      if (next.name === "Hook 1" || next.name === "Hook 2" || next.name === "Eyebrow") next = show(next, false);
      if (next.name === "RedactSweep" || next.name === "Silence" || next.name === "LightLeak") next = show(next, false);
    }
    if (slot === "saturday-object") {
      if (next.name === "Media frame") next = show(next, true);
      if (next.name === "Hook 1" || next.name === "Hook 2") {
        next = show(applyNodeMotion(next, still ? "none" : "slideIn"), true);
      }
      if (next.name === "RedactSweep" || next.name === "DataTicker" || next.name === "Silence" || next.name === "LightLeak") {
        next = show(next, false);
      }
    }
    if (slot === "sunday-silence") {
      if (
        next.name === "Media frame" ||
        next.name === "Visual" ||
        next.name === "CTA" ||
        next.name === "CTA label" ||
        next.name === "Hook 2" ||
        next.name === "Body" ||
        next.name === "RedactSweep" ||
        next.name === "DataTicker" ||
        next.name === "LightLeak" ||
        next.name === "Voice" ||
        next.name === "Silence" ||
        next.name === "Eyebrow"
      ) {
        next = show(next, false);
      }
      if (next.name === "Hook 1") next = show(next, true);
    }
    return next;
  });

  const withoutSundayStill =
    slot === "sunday-silence"
      ? nodes.filter((node) => node.name !== "Media frame" && node.name !== "Visual" && node.type !== "image")
      : nodes;

  return applyPlaybookStack({ ...page, daySlot: slot, nodes: withoutSundayStill });
}

export const PLAYBOOK_NODE_PREFIX = "Playbook ";

export function playbookNodeName(presetId: string): string {
  return `${PLAYBOOK_NODE_PREFIX}${presetId}`;
}

function stackFrame(page: CraftPage): { x: number; y: number; width: number; height: number } {
  const frame = page.nodes.find((node) => node.name === "Media frame" || node.name === "Visual");
  if (frame && page.daySlot !== "sunday-silence") {
    return { x: frame.x, y: frame.y, width: frame.width, height: frame.height };
  }
  return { x: 40, y: 40, width: page.width - 80, height: Math.min(480, page.height - 140) };
}

function plateCarriesHook(presetId: string): boolean {
  if ((CRAFT_OVERLAY_PRESETS as readonly string[]).includes(presetId)) return true;
  const use = CRAFT_MANUAL_MOTION.find((item) => item.id === presetId);
  return use?.role === "overlay" || use?.role === "type";
}

export function applyPlaybookStack(
  page: CraftPage,
  fills?: { hook?: string; hook2?: string },
): CraftPage {
  const play = weekPlaybook(page.daySlot);
  if (!play) return page;
  const frame = stackFrame(page);
  const existing = new Map(
    page.nodes
      .filter((node): node is MotionNode => node.type === "motion" && node.name.startsWith(PLAYBOOK_NODE_PREFIX))
      .map((node) => [node.name, node]),
  );
  const built: MotionNode[] = play.stack.map((presetId) => {
    const name = playbookNodeName(presetId);
    const prev = existing.get(name);
    const preset = presetById(presetId);
    const carry = plateCarriesHook(presetId);
    return {
      id: prev?.id ?? uid("motion"),
      name,
      type: "motion",
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      rotation: prev?.rotation ?? 0,
      opacity: prev?.opacity ?? 1,
      locked: prev?.locked ?? false,
      hidden: false,
      constraints: prev?.constraints ?? { horizontal: "scale", vertical: "scale" },
      schema: preset.schema,
      preview: "live",
      seed: prev?.seed ?? 1,
      capturedAssetId: prev?.capturedAssetId,
      copyExempt: presetId === "redact-sweep" || presetId === "declassified-text" ? true : prev?.copyExempt,
      text: carry ? (fills?.hook ?? prev?.text) : prev?.text,
      text2: carry ? (fills?.hook2 ?? prev?.text2) : prev?.text2,
    };
  });
  const without = page.nodes.filter(
    (node) => !(node.type === "motion" && node.name.startsWith(PLAYBOOK_NODE_PREFIX)),
  );
  const groundAt = without.findIndex((node) => node.name === "Ground");
  const at = groundAt >= 0 ? groundAt + 1 : 0;
  let nodes = [...without.slice(0, at), ...built, ...without.slice(at)];
  if (
    page.daySlot !== "saturday-object" &&
    page.daySlot !== "wednesday-voice" &&
    page.daySlot !== "tuesday-stamp"
  ) {
    nodes = nodes.map((node) =>
      node.type === "shape" && (node.name === "Media frame" || node.name === "Visual")
        ? { ...node, hidden: true }
        : node,
    );
  }
  return { ...page, nodes };
}

export function shouldHangWeekStill(daySlot?: string): boolean {
  return daySlot === "saturday-object" || daySlot === "wednesday-voice";
}

export function materialiseWeek(master: Pick<WeekMaster, "weekId" | "route"> & Partial<WeekMaster>): CraftDocument {
  const week = defaultWeekMaster(master.weekId, master.route ?? "sharp-cultural");
  if (typeof master.platformLine === "string") week.platformLine = master.platformLine;
  const kit = {
    ...DEFAULT_BRAND,
    headingFont: week.type.display,
    bodyFont: week.type.body,
  };
  const base = documentFromTemplate("li-landscape", kit);
  const pages = WEEK_DAYS.map((name, i) => {
    const slot = DAY_SLOTS[i]!;
    const page = { ...weekDayPage(slot), name, id: uid("page") };
    return applyDayContract(page, slot, week.route);
  });
  const doc: CraftDocument = applyBrand(
    {
      ...base,
      id: `week:${week.weekId}`,
      title: week.weekId,
      brand: kit,
      pages,
      activePageId: pages[0]!.id,
      week,
      updatedAt: new Date().toISOString(),
    },
    kit,
  );
  return {
    ...doc,
    pages: doc.pages.map((page, i) => applyDayContract(page, DAY_SLOTS[i]!, week.route)),
    week,
  };
}

export function applyWeekRoute(doc: CraftDocument, route: WeekRoute): CraftDocument {
  if (!doc.week) return doc;
  const week = { ...doc.week, route };
  return {
    ...doc,
    week,
    pages: doc.pages.map((page) =>
      page.daySlot ? applyDayContract({ ...page, nodes: page.nodes.map((node) => ({ ...node })) }, page.daySlot, route) : page,
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function seedGrammarWeek(fromIso: string, route: WeekRoute = "sharp-cultural"): CraftPost[] {
  const start = mondayOf(fromIso);
  const weekId = isoWeekId(fromIso);
  return WEEK_DAYS.map((weekday, i) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + i);
    const daySlot = DAY_SLOTS[i]!;
    return {
      id: `mkt-${isoDay(date)}-week`,
      date: isoDay(date),
      weekday,
      track: i % 2 === 0 ? "borrower" : "introducer",
      status: "draft",
      compliance: "pending",
      autoPublish: false,
      primaryChannel: "linkedin",
      channels: ["linkedin", "instagram", "facebook", "tiktok"],
      presetId: "li-landscape",
      extraPresets: { instagram: "square", facebook: "og", tiktok: "story" },
      title: weekday,
      eyebrow: defaultEyebrow(i % 2 === 0 ? "borrower" : "introducer"),
      hook: "",
      hook2: "",
      body: weekday === "Fri" ? "00" : "",
      cta: "",
      links: [],
      hashtags: [],
      adsDraft: false,
      weekId,
      route,
      daySlot,
    };
  });
}

function copyText(node: CraftNode): string {
  return node.type === "text" && !node.hidden ? node.text : "";
}

function named(page: CraftPage, name: string): CraftNode | undefined {
  return page.nodes.find((node) => node.name === name);
}

function wordCount(text: string): number {
  return text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;
}

export function reviewWeekPage(page: CraftPage): WeekReview {
  const findings: BoardFinding[] = [];
  const slot = page.daySlot;
  const identity = named(page, "Identity");
  const identityText = identity?.type === "text" ? identity.text : "";
  if (!identity || identity.type !== "text" || !PACKAGER_IDENTITY.test(identityText)) {
    findings.push({
      level: "block",
      code: "identity",
      message: "Identity missing — packager identity on the board.",
      nodeId: identity?.id,
    });
  }

  const copyNodes = page.nodes.filter(
    (node) => node.type === "text" && !node.hidden && !node.copyExempt && COPY_SLOT.test(node.name),
  );
  for (const node of copyNodes) {
    if (node.type !== "text") continue;
    const field = copyFieldLimit(node.name);
    if (field && node.text.length > field) {
      findings.push({
        level: "block",
        code: "too_long",
        message: `${node.name} is too long.`,
        nodeId: node.id,
      });
    }
    if (BANNED.test(node.text) && slot === "thursday-redact") {
      findings.push({
        level: "block",
        code: "thursday_myth",
        message: "Thursday — banned myth belongs on artwork, not in Hook/Body/CTA.",
        nodeId: node.id,
      });
    } else if (BANNED.test(node.text)) {
      findings.push({
        level: "block",
        code: "house_policy",
        message: "Copy fails house policy — no rates, guarantees, or lending.",
        nodeId: node.id,
      });
    }
    if (slot === "friday-number" && (node.name === "Body" || node.name === "DataTicker" || node.name === "Deck") && FRIDAY_RATE.test(node.text)) {
      findings.push({
        level: "block",
        code: "friday_rate",
        message: "Friday — ticker and body reject %, APR, and from-rates.",
        nodeId: node.id,
      });
    }
  }

  if (slot === "monday-two-beat") {
    const hook1 = copyText(named(page, "Hook 1") ?? page.nodes[0]!);
    const hook2 = copyText(named(page, "Hook 2") ?? page.nodes[0]!);
    if (!hook1 || !hook2) {
      findings.push({
        level: "block",
        code: "monday_two_beat",
        message: "Monday needs Hook 1 and Hook 2. Hook 2 is the correction.",
        nodeId: named(page, hook2 ? "Hook 1" : "Hook 2")?.id,
      });
    }
  }

  if (slot === "sunday-silence") {
    const words = copyNodes
      .filter((node) => node.name !== "Identity")
      .map((node) => copyText(node))
      .join(" ");
    if (wordCount(words) > 8) {
      findings.push({
        level: "block",
        code: "sunday_silence",
        message: "Sunday — max 8 words on the board.",
      });
    }
  }

  return { ok: findings.every((item) => item.level !== "block"), findings };
}

function copyFieldLimit(name: string): number | undefined {
  const n = name.toLowerCase();
  if (n.includes("eyebrow")) return COPY_LIMITS.eyebrow;
  if (n.includes("hook 2")) return COPY_LIMITS.hook2;
  if (n.includes("hook")) return COPY_LIMITS.hook;
  if (n.includes("body") || n === "deck" || n === "silence" || n === "voice") return COPY_LIMITS.body;
  if (n.includes("cta")) return COPY_LIMITS.cta;
  return undefined;
}

export function canExportWeekPage(page: CraftPage): boolean {
  return reviewWeekPage(page).ok;
}

export function pickWeekVisual(assets: CraftAsset[], daySlot: DaySlot): VisualPick {
  if (daySlot === "sunday-silence") return { empty: true, reason: "no analog still — shoot or scan" };
  const analogKind =
    daySlot === "tuesday-stamp" ? "stamp" : daySlot === "saturday-object" ? (["letter", "file", "stamp", "sheet"] as const) : null;
  const analog = assets.filter((asset) => asset.source === "analog-capture" && asset.dataUrl);
  const analogMatch = analogKind
    ? analog.filter((asset) =>
        typeof analogKind === "string" ? asset.analogKind === analogKind : analogKind.includes(asset.analogKind as (typeof analogKind)[number]),
      )
    : analog;
  const analogHit = analogMatch[0] ?? analog[0];
  if (analogHit) return { asset: analogHit };
  const motion = assets.find((asset) => asset.source === "motion-capture" && asset.dataUrl);
  if (motion) return { asset: motion };
  const generated = assets.find(
    (asset) => asset.source === "generated" && asset.dataUrl && !CATEGORY_PHOTO.test(asset.name),
  );
  if (generated) return { asset: generated };
  return { empty: true, reason: "no analog still — shoot or scan" };
}

export function isHouseWeekDoc(doc: CraftDocument): boolean {
  if (!doc.week || doc.pages.length < 7) return false;
  return doc.pages.every((page) => {
    if (page.presetId !== "li-landscape" || !page.daySlot) return false;
    const names = new Set(page.nodes.map((node) => node.name));
    if (!names.has("Identity")) return false;
    if (names.has("Rail") || names.has("Rail word") || names.has("Ink panel")) return false;
    return true;
  });
}

export function pageMatchesPost(page: CraftPage, post: Pick<CraftPost, "weekday" | "daySlot">): boolean {
  if (post.daySlot && page.daySlot) return page.daySlot === post.daySlot;
  if (post.weekday && page.name === post.weekday) return true;
  return false;
}
