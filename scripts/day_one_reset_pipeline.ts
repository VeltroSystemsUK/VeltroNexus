/**
 * Day One reset: empty the broker Pipeline and Underwriting studio.
 * Leaves origination (agentic deals / hopper), lenders, users, and mail alone.
 */
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "veltro.db");
const STORE_PATH = path.join(ROOT, "uploads", "local_collections_store.json");
const BACKUP_DIR = path.join(ROOT, "scripts", "backups");
const STAMP = new Date().toISOString().replace(/[:.]/g, "-");

const JSON_KEYS = [
  "due_diligence",
  "underwriting_submissions",
  "underwriting_activities",
  "broker_handoffs",
  "verification_exceptions",
  "prospect_documents",
  "application_submissions",
  "time_entries",
  "lender_interactions",
] as const;

function main() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const sqlite = new Database(DB_PATH, { fileMustExist: true });
  sqlite.pragma("journal_mode = WAL");

  const prospects = sqlite.prepare("SELECT * FROM prospects").all();
  const companies = sqlite.prepare("SELECT * FROM companies").all();
  const contacts = sqlite.prepare("SELECT * FROM contacts").all();
  const activities = sqlite.prepare("SELECT * FROM activities").all();

  const store = JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as Record<string, unknown[]>;
  const jsonBackup: Record<string, unknown[]> = {};
  for (const key of JSON_KEYS) {
    jsonBackup[key] = Array.isArray(store[key]) ? store[key] : [];
  }

  const backupPath = path.join(BACKUP_DIR, `day_one_pipeline_${STAMP}.json`);
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        sqlite: { prospects, companies, contacts, activities },
        collections: jsonBackup,
      },
      null,
      2
    )
  );

  const tx = sqlite.transaction(() => {
    sqlite.prepare("DELETE FROM contacts").run();
    sqlite.prepare("DELETE FROM activities").run();
    sqlite.prepare("DELETE FROM prospects").run();
    sqlite.prepare("DELETE FROM companies").run();
    sqlite.prepare("UPDATE users SET prospects_created_count = 0").run();
  });
  tx();

  const fresh = JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as Record<string, unknown[]>;
  for (const key of JSON_KEYS) {
    if (key in fresh || (jsonBackup[key] && jsonBackup[key].length)) {
      fresh[key] = [];
    }
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(fresh, null, 2));

  const left = {
    prospects: Number((sqlite.prepare("SELECT COUNT(*) AS n FROM prospects").get() as { n: number }).n),
    companies: Number((sqlite.prepare("SELECT COUNT(*) AS n FROM companies").get() as { n: number }).n),
    contacts: Number((sqlite.prepare("SELECT COUNT(*) AS n FROM contacts").get() as { n: number }).n),
    underwriting: (fresh.underwriting_submissions || []).length,
    dueDiligence: (fresh.due_diligence || []).length,
    agenticDeals: (fresh.agentic_deals || []).length,
  };
  sqlite.close();

  console.log(
    JSON.stringify(
      {
        backup: backupPath,
        deleted: {
          prospects: prospects.length,
          companies: companies.length,
          contacts: contacts.length,
          activities: activities.length,
          underwriting: jsonBackup.underwriting_submissions.length,
          dueDiligence: jsonBackup.due_diligence.length,
          handoffs: jsonBackup.broker_handoffs.length,
        },
        remaining: left,
      },
      null,
      2
    )
  );
}

main();
