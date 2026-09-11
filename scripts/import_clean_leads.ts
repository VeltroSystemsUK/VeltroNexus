import fs from "fs";
import { parseCSVLine } from "../server/utils/routerHelpers";
import { storage } from "../server/storage";
import { HARVEST_CSV_MAX_ROWS, ingestHarvestCsv } from "../server/services/harvestCsv";
import { agenticWorkflow } from "../server/services/agenticWorkflow";
import type { HarvestCsvRow } from "../server/services/harvestCsv";

const CSV_PATH = "F:\\Shaun\\Desktop\\Data\\output\\Clean Leads.csv";
const FILE_NAME = "Clean Leads.csv";
const HARPER_BATCH = HARVEST_CSV_MAX_ROWS;

function normCompanyNumber(value?: string | null): string {
  const raw = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!raw) return "";
  if (/^\d+$/.test(raw) && raw.length <= 8) return raw.padStart(8, "0");
  return raw;
}

function sicCode(values: string[]): string {
  for (const value of values) {
    const digits = String(value || "").replace(/\D/g, "");
    if (digits.length >= 4 && digits.length <= 5) return digits.padStart(5, "0").slice(0, 5);
  }
  return "";
}

function parseCleanLeads(csvData: string): HarvestCsvRow[] {
  const lines = csvData.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
  const rows: HarvestCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const get = (name: string) => {
      const idx = headers.indexOf(name);
      return idx >= 0 ? (values[idx] || "").trim() : "";
    };
    const sicValues = headers
      .map((header, idx) => (header === "sic" ? values[idx] : ""))
      .filter(Boolean);
    const companyName = get("company_name");
    if (!companyName) continue;
    const companyNumber = normCompanyNumber(get("company_number"));
    const email = get("contact_email").toLowerCase();
    const contactName = get("contact_first_name") || get("contact_name");
    const website = get("website");
    rows.push({
      companyName,
      ...(companyNumber ? { companyNumber } : {}),
      ...(website ? { website } : {}),
      ...(email ? { email } : {}),
      ...(contactName ? { contactName } : {}),
      sic: sicCode(sicValues) || undefined,
      legalForm: get("legal_form") || undefined,
      address: get("address") || undefined,
    } as HarvestCsvRow & { sic?: string; legalForm?: string; address?: string });
  }
  return rows;
}

function csvChunk(rows: HarvestCsvRow[]): string {
  const header = "company_name,company_number,website,contact_email,contact_name";
  const body = rows.map((row) =>
    [row.companyName, row.companyNumber || "", row.website || "", row.email || "", row.contactName || ""]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(",")
  );
  return [header, ...body].join("\n");
}

async function ownerUserId(): Promise<string> {
  const users = await storage.getAllUsers();
  const shaun = users.find((user) => (user.email || "").toLowerCase() === "shaun@veltro.co.uk");
  if (shaun) return shaun.id;
  const admin = users.find((user) => user.role === "super_admin");
  if (admin) return admin.id;
  if (users[0]) return users[0].id;
  throw new Error("No owner user");
}

async function main() {
  const csvData = fs.readFileSync(CSV_PATH, "utf8");
  const parsed = parseCleanLeads(csvData);
  console.log(`CSV rows: ${parsed.length}`);

  const existing = await storage.listInternalLeads();
  const numbers = new Set(
    existing.map((lead) => normCompanyNumber(lead.companyNumber)).filter(Boolean)
  );
  const emails = new Set(
    existing.map((lead) => String(lead.email || "").trim().toLowerCase()).filter(Boolean)
  );

  let inserted = 0;
  let skippedDup = 0;
  let skippedBad = 0;
  const fresh: HarvestCsvRow[] = [];

  for (const row of parsed) {
    const extra = row as HarvestCsvRow & { sic?: string; legalForm?: string; address?: string };
    const number = normCompanyNumber(row.companyNumber);
    const email = String(row.email || "").trim().toLowerCase();
    if (!row.companyName || !number || !email) {
      skippedBad += 1;
      continue;
    }
    if (numbers.has(number) || emails.has(email)) {
      skippedDup += 1;
      continue;
    }
    await storage.createInternalLead({
      companyName: row.companyName,
      companyNumber: number,
      contactName: row.contactName || undefined,
      email,
      status: "new",
      notes: `Clean Leads.csv | Harper to verify ${email}`,
      address: extra.address || undefined,
      website: row.website || undefined,
      sicCode: extra.sic || undefined,
      companyType: extra.legalForm || undefined,
      contacts: [
        {
          name: row.contactName || row.companyName,
          role: "Director",
          email,
          phone: null,
          linkedinUrl: null,
        },
      ],
      hasCharges: false,
      totalChargesCount: 0,
      satisfiedChargesCount: 0,
      possibleDuplicate: false,
      commissionRate: 0.1,
    });
    numbers.add(number);
    emails.add(email);
    fresh.push({ ...row, companyNumber: number, email });
    inserted += 1;
    if (inserted % 200 === 0) console.log(`inserted ${inserted}…`);
  }

  console.log(
    JSON.stringify(
      {
        csvRows: parsed.length,
        inserted,
        skippedDuplicate: skippedDup,
        skippedIncomplete: skippedBad,
      },
      null,
      2
    )
  );

  const owner = await ownerUserId();
  let harperCreated = 0;
  let harperSkipped = 0;
  for (let i = 0; i < fresh.length; i += HARPER_BATCH) {
    const chunk = fresh.slice(i, i + HARPER_BATCH);
    const result = await ingestHarvestCsv({
      csvData: csvChunk(chunk),
      fileName: FILE_NAME,
      ownerUserId: owner,
    });
    harperCreated += result.created;
    harperSkipped += result.skipped;
    console.log(
      `Harper batch ${Math.floor(i / HARPER_BATCH) + 1}: created=${result.created} skipped=${result.skipped}`
    );
  }

  console.log(`Harper files opened=${harperCreated} alreadyOnBook=${harperSkipped}`);
  if (harperCreated > 0) {
    console.log("Starting Harper mailbox verification…");
    const harvest = await agenticWorkflow.harvestMailboxes();
    console.log(harvest);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
