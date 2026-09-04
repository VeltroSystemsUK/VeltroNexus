import fs from "fs";
import path from "path";
import {
  applyAmmoToWeek,
  applyChannelHandles,
  defaultChannels,
  generateWeek,
  mergeGeneratedWeek,
  normalizePost,
  parseWeekGenerate,
  type CraftChannel,
  type CraftPost,
  type WeekGenerateMode,
} from "@shared/craftQueue";
import { normalizeAmmo, type CreativeAmmoBrief } from "@shared/craftScout";
import { researchWeek } from "./caseyScout";
import { craftWeek } from "./islaDirector";

export type Desk = {
  week: CraftPost[];
  channels: CraftChannel[];
  weekStart: string | null;
  briefs: CreativeAmmoBrief[];
};

const DESK_FILE = path.resolve(process.cwd(), "uploads", "craft_desk.json");

function readAll(): Record<string, Desk> {
  try {
    if (!fs.existsSync(DESK_FILE)) return {};
    return JSON.parse(fs.readFileSync(DESK_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, Desk>) {
  const dir = path.dirname(DESK_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DESK_FILE, JSON.stringify(data, null, 2));
}

export function deskFor(userId: string): Desk {
  const all = readAll();
  const desk = all[userId] ?? { week: [], channels: defaultChannels(), weekStart: null, briefs: [] };
  return {
    ...desk,
    week: (desk.week ?? []).map(normalizePost),
    channels: desk.channels ?? defaultChannels(),
    briefs: normalizeAmmo(desk.briefs),
  };
}

export function saveDesk(userId: string, desk: Desk) {
  const all = readAll();
  all[userId] = desk;
  writeAll(all);
}

/** Casey's "scan the week" job — refreshes Creative Ammo Briefs and re-applies them to the queue. */
export async function runCraftScan(userId: string): Promise<Desk> {
  const desk = deskFor(userId);
  const briefs = await craftWeek(await researchWeek(desk.briefs));
  const channels = desk.channels.length ? desk.channels : defaultChannels();
  const week = desk.week.length
    ? applyAmmoToWeek(desk.week, briefs)
    : generateWeek(desk.weekStart || new Date().toISOString().slice(0, 10), briefs).map((post) =>
        applyChannelHandles(post, channels),
      );
  const next: Desk = { ...desk, channels, week, weekStart: week[0]?.date ?? desk.weekStart, briefs };
  saveDesk(userId, next);
  return next;
}

/** Isla's "compose week" job — queues next week's posts from the current briefs. */
export async function runCraftComposeWeek(
  userId: string,
  params: { from: string; mode: WeekGenerateMode; selectedId?: string; stamp?: string } = parseWeekGenerate({}),
): Promise<Desk> {
  const desk = deskFor(userId);
  const channels = desk.channels.length ? desk.channels : defaultChannels();
  const briefs =
    params.mode === "selected" && desk.briefs.length === 7
      ? desk.briefs
      : await craftWeek(await researchWeek(desk.briefs));
  const generated = generateWeek(
    params.from,
    briefs,
    params.mode === "replace" ? params.stamp || Date.now().toString(36) : undefined,
  ).map((post) => applyChannelHandles(post, channels));
  const week = mergeGeneratedWeek(desk.week, generated, params.mode, params.selectedId);
  const next: Desk = { week, channels, weekStart: week[0]?.date ?? params.from, briefs };
  saveDesk(userId, next);
  return next;
}
