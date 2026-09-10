import fs from "fs";
import path from "path";

export type HarvestGuessState = {
  paused: boolean;
  at?: string;
  bounced?: number;
  sampled?: number;
};

const DEFAULT_STORE = path.resolve(process.cwd(), "uploads", "harvest_guess.json");
let storeOverride: string | null = null;

export function setHarvestGuessStorePathForTests(filePath: string | null) {
  storeOverride = filePath;
}

function storePath(): string {
  return storeOverride || DEFAULT_STORE;
}

function readState(): HarvestGuessState {
  const file = storePath();
  if (!fs.existsSync(file)) return { paused: false };
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      paused: Boolean(data?.paused),
      at: typeof data?.at === "string" ? data.at : undefined,
      bounced: typeof data?.bounced === "number" ? data.bounced : undefined,
      sampled: typeof data?.sampled === "number" ? data.sampled : undefined,
    };
  } catch {
    return { paused: false };
  }
}

function writeState(state: HarvestGuessState) {
  const file = storePath();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}

export function isGuessPaused(): boolean {
  return readState().paused === true;
}

export function tripGuessPause(opts: { bounced: number; sampled: number }): HarvestGuessState {
  const state: HarvestGuessState = {
    paused: true,
    at: new Date().toISOString(),
    bounced: opts.bounced,
    sampled: opts.sampled,
  };
  writeState(state);
  return state;
}

export function resumeGuessPause(): HarvestGuessState {
  const prev = readState();
  const state: HarvestGuessState = {
    paused: false,
    at: prev.at,
    bounced: prev.bounced,
    sampled: prev.sampled,
  };
  writeState(state);
  return state;
}
