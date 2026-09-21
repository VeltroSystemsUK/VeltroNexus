import fs from "fs";
import path from "path";
import type { LenderCostCache } from "@shared/lenderCost";

const DEFAULT_STORE = path.resolve(process.cwd(), "uploads", "lender_cost.json");
let storeOverride: string | null = null;

export function setLenderCostCachePathForTests(filePath: string | null) {
  storeOverride = filePath;
}

function storePath() {
  return storeOverride || DEFAULT_STORE;
}

export function loadLenderCostCache(): LenderCostCache {
  const file = storePath();
  if (!fs.existsSync(file)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return data && typeof data === "object" ? (data as LenderCostCache) : {};
  } catch {
    return {};
  }
}

export function saveLenderCostCache(store: LenderCostCache) {
  const file = storePath();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(store));
}
