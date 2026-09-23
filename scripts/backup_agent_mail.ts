import fs from "fs";
import path from "path";
import { atomicWriteFileSync, readJsonArrayFile } from "../server/utils/atomicWriteJson";

const live = path.resolve(process.cwd(), "uploads", "agent_mail.json");
const openers = path.resolve(process.cwd(), "uploads", "openers.json");
const destDir = process.env.AGENT_MAIL_BACKUP_DIR || path.resolve("F:/Shaun/Backups/nexus-mail");

function londonDay(at = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

function snapshot(source: string, dest: string): boolean {
  const parsed = readJsonArrayFile(source);
  if (!parsed) return false;
  if (
    fs.existsSync(dest) &&
    readJsonArrayFile(dest) &&
    fs.statSync(source).size < fs.statSync(dest).size
  ) {
    console.error(`Skip: ${path.basename(source)} is smaller than ${dest}`);
    return false;
  }
  atomicWriteFileSync(dest, JSON.stringify(parsed, null, 2));
  return true;
}

if (!readJsonArrayFile(live)) {
  console.error(`Live mail store missing or unreadable at ${live}`);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
const day = londonDay();
const dest = path.join(destDir, `agent_mail-${day}.json`);
if (!snapshot(live, dest)) {
  console.error(`Mail backup skipped: ${dest}`);
  process.exit(1);
}
const openerDest = path.join(destDir, `openers-${day}.json`);
if (readJsonArrayFile(openers)) snapshot(openers, openerDest);

const keepMs = 14 * 24 * 60 * 60 * 1000;
const cutoff = Date.now() - keepMs;
for (const name of fs.readdirSync(destDir)) {
  if (!name.endsWith(".json")) continue;
  if (!name.startsWith("agent_mail-") && !name.startsWith("openers-")) continue;
  const file = path.join(destDir, name);
  try {
    if (fs.statSync(file).mtimeMs < cutoff) fs.unlinkSync(file);
  } catch {
    /* ignore */
  }
}
console.log(`Backup written: ${dest}`);
console.log(`Folder: ${destDir}`);
process.exit(0);
