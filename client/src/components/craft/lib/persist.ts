import {
  CRAFT_APP,
  CRAFT_SCHEMA,
  CRAFT_VERSION,
  normalizeDocument,
  type CraftDocument,
} from "./types";

export type LoadCraftResult = {
  doc: CraftDocument;
  source: "disk" | "recovery";
  warning?: string;
};

export function parseCraftJson(raw: string): CraftDocument {
  return normalizeDocument(JSON.parse(raw));
}

export function serializeCraft(doc: CraftDocument): string {
  return JSON.stringify(
    {
      ...doc,
      schema: CRAFT_SCHEMA,
      app: CRAFT_APP,
      version: CRAFT_VERSION,
      updatedAt: new Date().toISOString(),
    },
    null,
    2,
  );
}

export function recoveryKey(path: string): string {
  return `quires:craft:${path || "untitled"}`;
}

export function writeLocalCraft(key: string, json: string): boolean {
  try {
    localStorage.setItem(key, json);
    return true;
  } catch (err) {
    console.error("Local recovery save failed:", err);
    return false;
  }
}

export function readLocalCraft(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function saveCraftToFile(_path: string, json: string): Promise<string> {
  writeLocalCraft("nexus:craft:last", json);
  return "nexus:craft:last";
}

export async function loadCraftFromFile(path: string): Promise<LoadCraftResult> {
  const stored = readLocalCraft(recoveryKey(path)) ?? readLocalCraft("nexus:craft:last");
  if (!stored) throw new Error("No saved CRAFT design on this device");
  return { doc: parseCraftJson(stored), source: "recovery" };
}

export async function openCraftDialog(): Promise<{ path: string; content: string } | null> {
  return null;
}

export async function saveCraftDialog(_defaultName: string, json: string): Promise<string | null> {
  writeLocalCraft("nexus:craft:last", json);
  return "nexus:craft:last";
}
