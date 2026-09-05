import fs from "fs";
import path from "path";
import {
  applyAmmoToWeek,
  applyChannelHandles,
  defaultChannels,
  mergeGeneratedWeek,
  normalizePost,
  parseWeekGenerate,
  type CraftChannel,
  type CraftPost,
  type WeekGenerateMode,
} from "@shared/craftQueue";
import { DAY_SLOTS, isoWeekId, seedGrammarWeek, type WeekRoute } from "@/components/craft/lib/weekGrammar";
import { normalizeAmmo, type CreativeAmmoBrief } from "@shared/craftScout";
import { researchWeek } from "./caseyScout";
import { craftWeek } from "./islaDirector";

export type Desk = {
  week: CraftPost[];
  channels: CraftChannel[];
  weekStart: string | null;
  briefs: CreativeAmmoBrief[];
  weekId?: string | null;
  route?: string | null;
  /** Set when the last scan/compose fell back to the seed library instead of live research. */
  researchWarning?: string | null;
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
  const route: WeekRoute =
    desk.route === "safe-distinctive" || desk.route === "beautiful-insane" ? desk.route : "sharp-cultural";
  const rawWeek = (desk.week ?? []).map(normalizePost);
  const from = desk.weekStart || rawWeek[0]?.date || new Date().toISOString().slice(0, 10);
  const week = rawWeek.length ? asGrammarWeek(rawWeek, from, route) : rawWeek;
  return {
    ...desk,
    week,
    channels: desk.channels ?? defaultChannels(),
    briefs: normalizeAmmo(desk.briefs),
    weekId: week[0]?.weekId ?? (typeof desk.weekId === "string" ? desk.weekId : null),
    route,
  };
}

export function parseWeekGrammar(input: unknown): { from: string; route: WeekRoute } {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const from = typeof raw.from === "string" && raw.from ? raw.from : new Date().toISOString().slice(0, 10);
  const route: WeekRoute =
    raw.route === "safe-distinctive" || raw.route === "beautiful-insane" ? raw.route : "sharp-cultural";
  return { from, route };
}

export function runCraftNewWeek(
  userId: string,
  params: { from: string; route: WeekRoute } = parseWeekGrammar({}),
): Desk {
  const desk = deskFor(userId);
  const channels = desk.channels.length ? desk.channels : defaultChannels();
  const week = seedGrammarWeek(params.from, params.route);
  const next: Desk = {
    ...desk,
    week,
    channels,
    weekStart: week[0]?.date ?? params.from,
    weekId: week[0]?.weekId ?? isoWeekId(params.from),
    route: params.route,
  };
  saveDesk(userId, next);
  return next;
}

export function saveDesk(userId: string, desk: Desk) {
  const all = readAll();
  all[userId] = desk;
  writeAll(all);
}

function deskRoute(desk: Desk): WeekRoute {
  return desk.route === "safe-distinctive" || desk.route === "beautiful-insane" ? desk.route : "sharp-cultural";
}

function asGrammarWeek(week: CraftPost[], from: string, route: WeekRoute): CraftPost[] {
  const weekId = week[0]?.weekId || isoWeekId(from);
  return week.map((post, i) => ({
    ...post,
    weekId: post.weekId || weekId,
    route: post.route === "safe-distinctive" || post.route === "beautiful-insane" || post.route === "sharp-cultural"
      ? post.route
      : route,
    daySlot: post.daySlot || DAY_SLOTS[i],
    presetId: "li-landscape",
  }));
}

/** craftBrief() returns the same object reference, unchanged, whenever Isla's LLM pass fails. */
function islaFallbackWarning(before: CreativeAmmoBrief[], after: CreativeAmmoBrief[]): string | null {
  const fellBack = before.filter((brief, i) => after[i] === brief).length;
  if (!fellBack) return null;
  return `Isla's writing pass failed for ${fellBack} of ${before.length} briefs — using Casey's raw angle for those.`;
}

/** Casey's "scan the week" job — refreshes Creative Ammo Briefs and re-applies them to the queue. */
export async function runCraftScan(userId: string): Promise<Desk> {
  const desk = deskFor(userId);
  const research = await researchWeek(desk.briefs);
  const briefs = await craftWeek(research.briefs);
  const channels = desk.channels.length ? desk.channels : defaultChannels();
  const route = deskRoute(desk);
  const from = desk.weekStart || new Date().toISOString().slice(0, 10);
  const week = desk.week.length
    ? applyAmmoToWeek(asGrammarWeek(desk.week, from, route), briefs)
    : applyAmmoToWeek(seedGrammarWeek(from, route), briefs).map((post) => applyChannelHandles(post, channels));
  const next: Desk = {
    ...desk,
    channels,
    week,
    weekStart: week[0]?.date ?? desk.weekStart,
    briefs,
    weekId: week[0]?.weekId ?? isoWeekId(from),
    route,
    researchWarning: research.warning ?? islaFallbackWarning(research.briefs, briefs),
  };
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
  const route = deskRoute(desk);
  let researchWarning: string | null = null;
  const briefs =
    params.mode === "selected" && desk.briefs.length === 7
      ? desk.briefs
      : await (async () => {
          const research = await researchWeek(desk.briefs);
          const crafted = await craftWeek(research.briefs);
          researchWarning = research.warning ?? islaFallbackWarning(research.briefs, crafted);
          return crafted;
        })();
  const generated = applyAmmoToWeek(seedGrammarWeek(params.from, route), briefs).map((post) =>
    applyChannelHandles(post, channels),
  );
  const week = asGrammarWeek(
    mergeGeneratedWeek(desk.week, generated, params.mode, params.selectedId),
    params.from,
    route,
  );
  const next: Desk = {
    week,
    channels,
    weekStart: week[0]?.date ?? params.from,
    briefs,
    weekId: week[0]?.weekId ?? isoWeekId(params.from),
    route,
    researchWarning,
  };
  saveDesk(userId, next);
  return next;
}
