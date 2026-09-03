import { parseCSVLine } from "../utils/routerHelpers";
import { storage } from "../storage";
import { HARVEST_AGENT_ID } from "./smeLeadHopper";
import type { AgenticDealFile } from "@shared/agenticWorkflow";

export const HARVEST_CSV_MAX_ROWS = 500;

export type HarvestCsvRow = {
  companyName: string;
  companyNumber?: string;
  website?: string;
  email?: string;
  contactName?: string;
  phone?: string;
};

const COLUMN: Record<string, keyof HarvestCsvRow | "contactEmail"> = {
  company_name: "companyName",
  companyname: "companyName",
  company: "companyName",
  name: "companyName",
  business_name: "companyName",
  businessname: "companyName",
  company_number: "companyNumber",
  companynumber: "companyNumber",
  crn: "companyNumber",
  registration_number: "companyNumber",
  website: "website",
  url: "website",
  web: "website",
  email: "email",
  company_email: "email",
  e_mail: "email",
  contact_email: "contactEmail",
  contactemail: "contactEmail",
  phone: "phone",
  telephone: "phone",
  tel: "phone",
  contact_phone: "phone",
  contact_name: "contactName",
  contactname: "contactName",
  contact: "contactName",
  contact_person: "contactName",
  contact_first_name: "contactName",
  director: "contactName",
};

function headerKey(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9_]/g, "_");
}

function normCompanyNumber(value?: string | null): string {
  const raw = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!raw) return "";
  if (/^\d+$/.test(raw) && raw.length <= 8) return raw.padStart(8, "0");
  return raw;
}

function normName(value?: string | null): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function parseHarvestCsv(csvData: string): {
  rows: HarvestCsvRow[];
  errors: { row: number; message: string }[];
} {
  const lines = String(csvData || "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) {
    return { rows: [], errors: [{ row: 0, message: "CSV must have a header row and at least one data row" }] };
  }
  if (lines.length - 1 > HARVEST_CSV_MAX_ROWS) {
    return {
      rows: [],
      errors: [{ row: 0, message: `CSV has more than ${HARVEST_CSV_MAX_ROWS} rows` }],
    };
  }

  const headers = parseCSVLine(lines[0]).map(headerKey);
  const rows: HarvestCsvRow[] = [];
  const errors: { row: number; message: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const mapped: Partial<HarvestCsvRow> & { contactEmail?: string } = {};
    for (let j = 0; j < headers.length && j < values.length; j++) {
      const field = COLUMN[headers[j]];
      const value = values[j]?.trim() || "";
      if (field && value) mapped[field] = value;
    }
    if (!mapped.email && mapped.contactEmail) mapped.email = mapped.contactEmail;
    delete mapped.contactEmail;
    if (!mapped.companyName) {
      errors.push({ row: i + 1, message: "Missing company name" });
      continue;
    }
    const companyNumber = normCompanyNumber(mapped.companyNumber);
    rows.push({
      companyName: mapped.companyName,
      ...(companyNumber ? { companyNumber } : {}),
      ...(mapped.website ? { website: mapped.website } : {}),
      ...(mapped.email ? { email: mapped.email } : {}),
      ...(mapped.contactName ? { contactName: mapped.contactName } : {}),
      ...(mapped.phone ? { phone: mapped.phone } : {}),
    });
  }

  return { rows, errors };
}

export function planHarvestCsvIngest(
  rows: HarvestCsvRow[],
  existing: Array<{ companyNumber?: string | null; companyName?: string | null }>
): { create: HarvestCsvRow[]; skipped: Array<{ row: HarvestCsvRow; reason: string }> } {
  const numbers = new Set(existing.map((deal) => normCompanyNumber(deal.companyNumber)).filter(Boolean));
  const names = new Set(existing.map((deal) => normName(deal.companyName)).filter(Boolean));
  const create: HarvestCsvRow[] = [];
  const skipped: Array<{ row: HarvestCsvRow; reason: string }> = [];

  for (const row of rows) {
    const number = normCompanyNumber(row.companyNumber);
    if (number && numbers.has(number)) {
      skipped.push({ row, reason: "already on book" });
      continue;
    }
    if (!number && names.has(normName(row.companyName))) {
      skipped.push({ row, reason: "already on book" });
      continue;
    }
    create.push(row);
    if (number) numbers.add(number);
    names.add(normName(row.companyName));
  }

  return { create, skipped };
}

export function harvestCsvDealDraft(
  row: HarvestCsvRow,
  fileName: string,
  ownerUserId: string,
  now: Date = new Date()
): Partial<AgenticDealFile> {
  const label = String(fileName || "upload.csv").trim() || "upload.csv";
  return {
    source: "distress_scan",
    stream: "sme",
    hopper: "hunt_contact",
    stage: "ingest",
    status: "waiting_timer",
    ownerUserId,
    companyName: row.companyName,
    companyNumber: row.companyNumber,
    website: row.website,
    email: row.email,
    contactName: row.contactName,
    phone: row.phone,
    events: [
      {
        at: now.toISOString(),
        stage: "ingest",
        agent: HARVEST_AGENT_ID,
        message: `CSV ingest from ${label}: ${row.companyName}`,
      },
    ],
  };
}

export async function ingestHarvestCsv(opts: {
  csvData: string;
  fileName: string;
  ownerUserId: string;
}): Promise<{
  created: number;
  skipped: number;
  errors: { row: number; message: string }[];
  fileName: string;
}> {
  const fileName = String(opts.fileName || "upload.csv").trim() || "upload.csv";
  const parsed = parseHarvestCsv(opts.csvData);
  if (!parsed.rows.length) {
    return { created: 0, skipped: 0, errors: parsed.errors, fileName };
  }
  const existing = await storage.listAgenticDeals();
  const plan = planHarvestCsvIngest(parsed.rows, existing);
  for (const row of plan.create) {
    await storage.createAgenticDeal(harvestCsvDealDraft(row, fileName, opts.ownerUserId));
  }
  return {
    created: plan.create.length,
    skipped: plan.skipped.length,
    errors: parsed.errors,
    fileName,
  };
}
