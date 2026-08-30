import { cloneDocument, type CraftDocument } from "./types";

export const HISTORY_LIMIT = 40;

export function pushHistory(
  stack: CraftDocument[],
  index: number,
  snapshot: CraftDocument,
): { stack: CraftDocument[]; index: number } {
  const next = stack.slice(0, index + 1);
  next.push(cloneDocument(snapshot));
  if (next.length > HISTORY_LIMIT) next.splice(0, next.length - HISTORY_LIMIT);
  return { stack: next, index: next.length - 1 };
}

export function undoHistory(
  stack: CraftDocument[],
  index: number,
): { document: CraftDocument; index: number } | null {
  if (index <= 0) return null;
  const next = index - 1;
  return { document: cloneDocument(stack[next]), index: next };
}

export function redoHistory(
  stack: CraftDocument[],
  index: number,
): { document: CraftDocument; index: number } | null {
  if (index >= stack.length - 1) return null;
  const next = index + 1;
  return { document: cloneDocument(stack[next]), index: next };
}
