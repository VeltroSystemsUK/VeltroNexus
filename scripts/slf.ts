/**
 * Super Lead Finder / Super List Finder CLI (Stream A).
 *
 *   npx tsx scripts/slf.ts ingest 01234567 --fixture
 *   npx tsx scripts/slf.ts queue
 *   npx tsx scripts/slf.ts show 01234567
 *   npx tsx scripts/slf.ts accept 01234567
 *   npx tsx scripts/slf.ts reject 01234567 out_of_appetite
 *   npx tsx scripts/slf.ts list-ingest ./file.csv
 *   npx tsx scripts/slf.ts list-refuse ./uk_emails_10m.csv
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import {
  GOLD_FIXTURES,
  GOLD_REFER,
  acceptLead,
  acceptRefer,
  ingestRefer,
  createSlfStore,
  ingestListRows,
  ingestSnapshot,
  listQueue,
  mapChCharges,
  rejectLead,
  type SlfStore,
} from "../shared/slfRuntime";
import { MockNexus } from "../shared/slfAdapter";
import { refuseListFile } from "../shared/slfList";
import type { SlfSnapshot } from "../shared/slfScore";

const STORE_PATH = resolve("uploads/slf_store.json");

function loadStore(): SlfStore {
  try {
    const raw = JSON.parse(readFileSync(STORE_PATH, "utf8"));
    return { leads: raw.leads || {}, refers: raw.refers || {}, nexus: MockNexus.fromJSON(raw.nexus) };
  } catch {
    return createSlfStore();
  }
}

function saveStore(store: SlfStore): void {
  mkdirSync(dirname(STORE_PATH), { recursive: true });
  writeFileSync(
    STORE_PATH,
    JSON.stringify({ leads: store.leads, refers: store.refers, nexus: store.nexus.toJSON() }, null, 2),
    "utf8"
  );
}

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = cols[i] || "";
    });
    return row;
  });
}

async function liveDealBook() {
  const { StorageDealBook } = await import("../server/services/slfNexusAdapter");
  return StorageDealBook.open();
}

async function liveSnapshot(companyNumber: string): Promise<SlfSnapshot | null> {
  try {
    const { companiesHouseClient } = await import("../server/utils/companiesHouseClient");
    const profile = await companiesHouseClient.getCompanyProfile(companyNumber);
    if (!profile) return null;
    const charges = await companiesHouseClient.getCompanyCharges(companyNumber);
    return {
      companyName: profile.company_name,
      companyNumber: profile.company_number || companyNumber,
      companyStatus: profile.company_status,
      dateOfCreation: profile.date_of_creation,
      sicCodes: (profile.sic_codes || []).map(String),
      resolutionConfidence: 1,
      charges: mapChCharges(charges),
    };
  } catch {
    return null;
  }
}

function printLead(lead: ReturnType<typeof ingestSnapshot>): void {
  console.log(
    [
      lead.companyName,
      `(${lead.companyNumber})`,
      lead.score.priority,
      lead.score.primaryProduct,
      `rank ${lead.score.rank}`,
      lead.bookLane,
      lead.status,
    ].join("  ")
  );
  if (lead.package) {
    console.log(`  ${lead.package.fit.why_us_now}`);
    console.log(`  ${lead.package.outreach_brief.opening_line}`);
  }
  if (lead.score.dropReason) console.log(`  drop: ${lead.score.dropReason}`);
}

async function main(): Promise<void> {
  const [cmd, arg, arg2] = process.argv.slice(2);
  const fixture = process.argv.includes("--fixture");
  const store = loadStore();

  if (!cmd || cmd === "help") {
    console.log(`slf ingest <company_number> [--fixture]
slf queue [--priority hot|warm]
slf show <company_number>
slf accept <company_number>
slf reject <company_number> <reason>
slf list-ingest <csv>
slf list-refuse <csv>
slf refer ingest <company_number> [--fixture]
slf refer accept <company_number>
slf health`);
    return;
  }

  if (cmd === "ingest") {
    if (!arg) throw new Error("company number required");
    let snapshot = fixture ? GOLD_FIXTURES[arg] : null;
    if (!snapshot) snapshot = await liveSnapshot(arg);
    if (!snapshot) snapshot = GOLD_FIXTURES[arg] || null;
    if (!snapshot) {
      console.error("No fixture and Companies House returned nothing. Use --fixture with 01234567, 09876543, or 07777777.");
      process.exit(1);
    }
    const book = await liveDealBook();
    const lead = ingestSnapshot(store, snapshot, { dealBook: book });
    saveStore(store);
    printLead(lead);
    return;
  }

  if (cmd === "queue") {
    const priority = process.argv.includes("--priority")
      ? process.argv[process.argv.indexOf("--priority") + 1]
      : undefined;
    const rows = listQueue(store, priority);
    console.log(`Hot/Warm queued: ${rows.length}`);
    for (const lead of rows) printLead(lead);
    return;
  }

  if (cmd === "show") {
    const lead = store.leads[arg];
    if (!lead) {
      console.error("not found");
      process.exit(1);
    }
    console.log(JSON.stringify(lead, null, 2));
    return;
  }

  if (cmd === "accept") {
    const book = await liveDealBook();
    const result = await acceptLead(store, arg, book);
    saveStore(store);
    if (!result.ok) {
      console.error(result.error);
      process.exit(1);
    }
    printLead(result.lead!);
    console.log(`pushed ${result.lead!.nexusCandidateId}`);
    return;
  }

  if (cmd === "reject") {
    const lead = rejectLead(store, arg, arg2 || "other");
    saveStore(store);
    if (!lead) {
      console.error("not found");
      process.exit(1);
    }
    printLead(lead);
    return;
  }

  if (cmd === "list-ingest" || cmd === "list-refuse") {
    if (!arg) throw new Error("csv path required");
    const csv = parseCsv(readFileSync(resolve(arg), "utf8"));
    const rows = csv.map((row) => ({
      email: row.email || row.mailbox,
      companyNumber: row.company_number || row.companynumber,
      name: row.name || row.company,
      contactName: row.contact || row.contact_name,
    }));
    if (cmd === "list-refuse") {
      const refusal = refuseListFile(arg, rows);
      console.log(JSON.stringify(refusal, null, 2));
      return;
    }
    const book = await liveDealBook();
    const result = ingestListRows(store, arg, rows, {}, book);
    saveStore(store);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === "refer") {
    const sub = arg;
    const number = arg2;
    if (sub === "ingest") {
      if (!number) throw new Error("company number required");
      const input = GOLD_REFER[number];
      if (!input) {
        console.error("Use --fixture with 04440000 (Hartley Accountants) or add a refer ingest path.");
        process.exit(1);
      }
      const record = ingestRefer(store, input);
      saveStore(store);
      console.log(JSON.stringify({ reachable: record.reachable_corporate_contact, hold: record.hold_reason, type: record.introducer_type, mailbox: record.mailbox }, null, 2));
      return;
    }
    if (sub === "accept") {
      if (!number) throw new Error("company number required");
      const book = await liveDealBook();
      const result = await acceptRefer(store, number, book);
      saveStore(store);
      if (!result.ok) {
        console.error(result.error);
        process.exit(1);
      }
      console.log(`refer accepted ${number} ${result.nexusCandidateId || ""}`);
      return;
    }
    throw new Error("refer ingest | refer accept");
  }

  if (cmd === "health") {
    console.log(
      JSON.stringify(
        {
          leads: Object.keys(store.leads).length,
          queued: listQueue(store).length,
          book: store.nexus.candidateCount(),
        },
        null,
        2
      )
    );
    return;
  }

  throw new Error(`unknown command ${cmd}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
