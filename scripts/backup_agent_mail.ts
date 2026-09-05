import fs from "fs";
import path from "path";

const live = path.resolve(process.cwd(), "uploads", "agent_mail.json");
const destDir = process.env.AGENT_MAIL_BACKUP_DIR || path.resolve("F:/Shaun/Backups/nexus-mail");

if (!fs.existsSync(live)) {
  console.error(`No mail store at ${live}`);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
const day = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const dest = path.join(destDir, `agent_mail-${day}.json`);
if (fs.existsSync(dest) && fs.statSync(live).size < fs.statSync(dest).size) {
  console.error(`Skip: live store is smaller than ${dest}`);
  process.exit(1);
}
fs.copyFileSync(live, dest);
const keepMs = 14 * 24 * 60 * 60 * 1000;
const cutoff = Date.now() - keepMs;
for (const name of fs.readdirSync(destDir)) {
  if (!name.startsWith("agent_mail-") || !name.endsWith(".json")) continue;
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
