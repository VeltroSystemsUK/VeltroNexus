import fs from "fs";
import path from "path";
import type { SuppressionRow } from "@shared/mailDesk";

const STORE = path.resolve(process.cwd(), "uploads", "mail_suppression.json");

function readAll(): SuppressionRow[] {
  if (!fs.existsSync(STORE)) return [];
  try {
    return JSON.parse(fs.readFileSync(STORE, "utf8"));
  } catch {
    return [];
  }
}

function writeAll(rows: SuppressionRow[]) {
  const dir = path.dirname(STORE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE, JSON.stringify(rows, null, 2));
}

export function loadSuppression(): SuppressionRow[] {
  return readAll();
}

export function addSuppression(row: Omit<SuppressionRow, "at"> & { at?: string }): SuppressionRow {
  const next: SuppressionRow = {
    email: String(row.email || "").trim().toLowerCase(),
    companyNumber: row.companyNumber ? String(row.companyNumber) : undefined,
    reason: row.reason,
    at: row.at || new Date().toISOString(),
  };
  const all = readAll().filter((item) => item.email !== next.email || item.companyNumber !== next.companyNumber);
  all.push(next);
  writeAll(all);
  return next;
}

export function suppressionSets(list: SuppressionRow[] = loadSuppression()): {
  emails: Set<string>;
  numbers: Set<string>;
} {
  const emails = new Set<string>();
  const numbers = new Set<string>();
  for (const row of list) {
    if (row.email) emails.add(row.email.toLowerCase());
    if (row.companyNumber) numbers.add(String(row.companyNumber));
  }
  return { emails, numbers };
}
