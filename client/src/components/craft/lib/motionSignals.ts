export type MotionPulse = "save" | "pane" | "close" | "dock" | "dialog" | "link";

export type MotionSignalsSnap = {
  typeVel: number;
  typeAge: number;
  busy: boolean;
  saveAge: number;
  paneAge: number;
  closeAge: number;
  dockAge: number;
  dialogAge: number;
  linkAge: number;
  focusMode: boolean;
  focusAge: number;
  wordCount: number;
  selected: boolean;
};

const EMPTY = {
  typeAtMs: 0,
  typeVel: 0,
  busy: false,
  saveAtMs: 0,
  paneAtMs: 0,
  closeAtMs: 0,
  dockAtMs: 0,
  dialogAtMs: 0,
  linkAtMs: 0,
  focusMode: false,
  focusAtMs: 0,
};

let state = { ...EMPTY };

function nowMs(): number {
  return typeof performance !== "undefined" && Number.isFinite(performance.now()) ? performance.now() : 0;
}

export function pulseMotion(kind: MotionPulse, at = nowMs()) {
  if (kind === "save") state.saveAtMs = at;
  else if (kind === "pane") state.paneAtMs = at;
  else if (kind === "close") state.closeAtMs = at;
  else if (kind === "dock") state.dockAtMs = at;
  else if (kind === "dialog") state.dialogAtMs = at;
  else state.linkAtMs = at;
}

export function noteTyping(at = nowMs()) {
  const dt = at - state.typeAtMs;
  state.typeAtMs = at;
  state.typeVel = dt > 0 && dt < 800 ? Math.min(32, 1000 / dt) : 8;
}

export function setMotionBusy(busy: boolean) {
  state.busy = busy;
}

export function setMotionFocus(on: boolean, at = nowMs()) {
  if (on && !state.focusMode) state.focusAtMs = at;
  state.focusMode = on;
}

export function ageSince(atMs: number, now = nowMs()): number {
  if (!atMs) return Number.POSITIVE_INFINITY;
  const age = (now - atMs) / 1000;
  if (age < 0) return Number.POSITIVE_INFINITY;
  return age;
}

export function oneShot(age: number, duration: number): number {
  if (!Number.isFinite(age) || age < 0 || age >= duration) return Number.POSITIVE_INFINITY;
  return age;
}

export function earliest(...ages: number[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const age of ages) if (age < best) best = age;
  return best;
}

export function snapshotMotionSignals(
  now = nowMs(),
  extras: { wordCount?: number; selected?: boolean } = {},
): MotionSignalsSnap {
  const typeAge = ageSince(state.typeAtMs, now);
  return {
    typeVel: typeAge < 0.6 ? state.typeVel * (1 - typeAge / 0.6) : 0,
    typeAge,
    busy: state.busy,
    saveAge: ageSince(state.saveAtMs, now),
    paneAge: ageSince(state.paneAtMs, now),
    closeAge: ageSince(state.closeAtMs, now),
    dockAge: ageSince(state.dockAtMs, now),
    dialogAge: ageSince(state.dialogAtMs, now),
    linkAge: ageSince(state.linkAtMs, now),
    focusMode: state.focusMode,
    focusAge: state.focusMode ? ageSince(state.focusAtMs, now) : Number.POSITIVE_INFINITY,
    wordCount: extras.wordCount ?? 0,
    selected: Boolean(extras.selected),
  };
}

export function resetMotionSignals() {
  state = { ...EMPTY };
}
