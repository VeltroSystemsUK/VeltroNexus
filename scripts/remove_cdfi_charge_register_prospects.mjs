import Database from "better-sqlite3";

const db = new Database("veltro.db");
db.pragma("journal_mode = WAL");

const SOURCE = "CDFI Charge Register";
const before = db
  .prepare("select count(*) as c from prospects where referral_source = ?")
  .get(SOURCE).c;
const strataBefore = db.prepare("select count(*) as c from prospects where referral_source = 'Strata'").get().c;
const leadsBefore = db.prepare("select count(*) as c from internal_leads").get().c;

if (before === 0) {
  console.log("No Charge Register prospects to delete");
  db.close();
  process.exit(0);
}

const del = db.transaction(() => {
  db.prepare(
    `delete from contacts where prospect_id in (select id from prospects where referral_source = ?)`,
  ).run(SOURCE);
  db.prepare(
    `delete from activities where prospect_id in (select id from prospects where referral_source = ?)`,
  ).run(SOURCE);
  const gone = db.prepare("delete from prospects where referral_source = ?").run(SOURCE);
  return gone.changes;
});

const deleted = del();
const after = db.prepare("select count(*) as c from prospects where referral_source = ?").get(SOURCE).c;
const strataAfter = db.prepare("select count(*) as c from prospects where referral_source = 'Strata'").get().c;
const leadsAfter = db.prepare("select count(*) as c from internal_leads").get().c;
const remaining = db.prepare("select count(*) as c from prospects").get().c;

console.log(
  JSON.stringify(
    {
      deleted,
      chargeRegisterLeft: after,
      strataBefore,
      strataAfter,
      internalLeadsBefore: leadsBefore,
      internalLeadsAfter: leadsAfter,
      prospectsLeft: remaining,
    },
    null,
    2,
  ),
);

db.pragma("wal_checkpoint(TRUNCATE)");

if (after !== 0 || strataAfter !== 3 || leadsAfter !== leadsBefore) {
  console.error("Post-check failed");
  process.exit(1);
}

db.close();
