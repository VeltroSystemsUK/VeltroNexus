/**
 * One-shot: remove Clients (internal_leads) that have no valid email on the card
 * or in contacts JSON. Backup is written first.
 */
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "veltro.db");
const BACKUP_DIR = path.join(ROOT, "scripts", "backups");
const STAMP = new Date().toISOString().replace(/[:.]/g, "-");
const DRY_RUN = process.argv.includes("--dry-run");

const STRICT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLACEHOLDER = /@(example\.com|test\.com|domain\.com|email\.com|placeholder\.|invalid)$/i;

function parseAddressList(value) {
  const raw = String(value || "").trim();
  const angle = raw.match(/<([^>]+)>/);
  if (angle) return angle[1].trim().toLowerCase();
  const email = raw.match(/[^\s<>]+@[^\s<>]+/);
  return email ? email[0].trim().toLowerCase() : raw.toLowerCase();
}

function normalizeEmail(value) {
  const email = parseAddressList(value);
  return email.includes("@") ? email : "";
}

function contactRows(contacts) {
  let rows = contacts;
  if (typeof rows === "string") {
    try {
      rows = JSON.parse(rows);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => row && typeof row === "object");
}

function emailsOnCrmLead(lead) {
  const emails = [
    normalizeEmail(lead.email),
    ...contactRows(lead.contacts).map((row) => normalizeEmail(row.email)).filter(Boolean),
  ];
  return [...new Set(emails.filter(Boolean))];
}

function hasValidEmail(lead) {
  return emailsOnCrmLead(lead).some((email) => STRICT.test(email) && !PLACEHOLDER.test(email));
}

function main() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const sqlite = new Database(DB_PATH, { fileMustExist: true });
  sqlite.pragma("journal_mode = WAL");

  const leads = sqlite.prepare("SELECT * FROM internal_leads").all();
  const drop = leads.filter((lead) => !hasValidEmail(lead));
  const keep = leads.length - drop.length;

  const backupPath = path.join(BACKUP_DIR, `internal_leads_pre_no_email_purge_${STAMP}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(leads, null, 2), "utf8");
  const dropListPath = path.join(BACKUP_DIR, `internal_leads_removed_no_email_${STAMP}.json`);
  fs.writeFileSync(
    dropListPath,
    JSON.stringify(
      drop.map((lead) => ({
        id: lead.id,
        company_name: lead.company_name,
        company_number: lead.company_number,
        email: lead.email,
        status: lead.status,
        emails: emailsOnCrmLead(lead),
      })),
      null,
      2,
    ),
    "utf8",
  );

  console.log(`Total: ${leads.length}`);
  console.log(`Keep (valid email): ${keep}`);
  console.log(`Drop (no valid email): ${drop.length}`);
  console.log(`Backup: ${backupPath}`);
  console.log(`Drop list: ${dropListPath}`);

  if (DRY_RUN) {
    console.log("Dry run — no deletes.");
    sqlite.close();
    return;
  }

  const del = sqlite.prepare("DELETE FROM internal_leads WHERE id = ?");
  const tx = sqlite.transaction((ids) => {
    for (const id of ids) del.run(id);
  });
  tx(drop.map((lead) => lead.id));

  const remaining = sqlite.prepare("SELECT * FROM internal_leads").all();
  const stillBad = remaining.filter((lead) => !hasValidEmail(lead));
  console.log(`Remaining: ${remaining.length}`);
  console.log(`Remaining without valid email: ${stillBad.length}`);
  sqlite.close();
  if (stillBad.length) {
    console.error("Purge incomplete.");
    process.exit(1);
  }
  console.log("Done.");
}

main();
