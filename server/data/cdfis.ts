// UK Business-Lending CDFI registry — loaded live from cdfis.csv (the curated
// "UK CDFIs - Commercial Business Lending Directory").
//
// Only rows whose Type/Category contains "CDFI" are included, so high-street
// banks, mortgage companies, P2P/fintech lenders, invoice/asset finance houses
// and brokers from the wider directory are intentionally excluded — these are
// genuine community development finance institutions that lend to businesses.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Papa from "papaparse";

export interface SeedCdfi {
  name: string;
  website?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  postalAddress?: string;
  lendingMinQuantum?: number;
  lendingMaxQuantum?: number;
  geographicalScope: string[];
  preferredClientTypes: string[];
  backgroundInfo: string;
}

// Convert a money token like "£250,000", "£1.5m+", "£10 million", "250k" to a number.
function parseMoney(raw: string): number | undefined {
  if (!raw) return undefined;
  let s = raw.toLowerCase().replace(/[£,\s]/g, "").replace(/\+$/, "");
  const millionMatch = s.match(/^([\d.]+)(m|million)$/);
  const kMatch = s.match(/^([\d.]+)k$/);
  if (millionMatch) return Math.round(parseFloat(millionMatch[1]) * 1_000_000);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1_000);
  const n = parseFloat(s);
  return isNaN(n) ? undefined : Math.round(n);
}

// Parse a "Loan Size Range" cell into { min, max }.
// Handles "£10,000 - £250,000", "Up to £250,000", "£50,000 - £10 million+", "Various".
function parseLoanRange(raw: string): { min?: number; max?: number } {
  if (!raw || /various|n\/a|contact/i.test(raw)) {
    // May still contain an embedded amount, e.g. "Various (CIEF £10m facility)"
    const embedded = raw?.match(/£[\d.,]+\s*(?:k|m|million)?\+?/gi);
    if (embedded && embedded.length === 1) return { max: parseMoney(embedded[0]) };
    return {};
  }
  const upTo = raw.match(/up to\s*(£[\d.,]+\s*(?:k|m|million)?\+?)/i);
  if (upTo) return { max: parseMoney(upTo[1]) };

  const amounts = raw.match(/£[\d.,]+\s*(?:k|m|million)?\+?/gi);
  if (!amounts) return {};
  if (amounts.length === 1) return { max: parseMoney(amounts[0]) };
  return { min: parseMoney(amounts[0]), max: parseMoney(amounts[amounts.length - 1]) };
}

// Split an "Email/Phone" cell into separate phone + email.
function parseContact(raw: string): { phone?: string; email?: string } {
  if (!raw || /contact via website|n\/a|apply online|relationship|branches/i.test(raw)) return {};
  const result: { phone?: string; email?: string } = {};
  const emailMatch = raw.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (emailMatch) result.email = emailMatch[0];
  // Phone: the part that isn't the email, kept if it has enough digits
  const withoutEmail = raw.replace(emailMatch?.[0] || "", "").replace(/,/g, " ").trim();
  if ((withoutEmail.match(/\d/g) || []).length >= 7) result.phone = withoutEmail.trim();
  return result;
}

function splitList(raw: string): string[] {
  if (!raw || /^n\/a$/i.test(raw)) return [];
  return raw.split(/[,/]/).map((s) => s.trim()).filter(Boolean);
}

function loadCdfisFromCsv(): SeedCdfi[] {
  // Resolve the CSV next to this module, falling back to the project-root path.
  let csvPath: string;
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    csvPath = path.join(here, "cdfis.csv");
    if (!fs.existsSync(csvPath)) {
      csvPath = path.resolve(process.cwd(), "server/data/cdfis.csv");
    }
  } catch {
    csvPath = path.resolve(process.cwd(), "server/data/cdfis.csv");
  }

  const raw = fs.readFileSync(csvPath, "utf8");
  const parsed = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data
    .filter((row) => (row["Type/Category"] || "").toUpperCase().includes("CDFI"))
    .filter((row) => (row["Company Name"] || "").trim().length > 0)
    .map((row) => {
      const { min, max } = parseLoanRange(row["Loan Size Range"] || "");
      const { phone, email } = parseContact(row["Email/Phone"] || "");
      const website = (row["Website"] || "").trim();
      const products = (row["Products"] || "").trim();
      const notes = (row["Notes"] || "").trim();

      return {
        name: row["Company Name"].trim(),
        website: website && !/^n\/a$/i.test(website) ? website : undefined,
        contactPhone: phone,
        contactEmail: email,
        lendingMinQuantum: min,
        lendingMaxQuantum: max,
        geographicalScope: splitList(row["Geographic Coverage"] || ""),
        preferredClientTypes: splitList(row["Sectors Served"] || ""),
        backgroundInfo: [products, notes].filter(Boolean).join(" — "),
      } as SeedCdfi;
    });
}

export const ukCdfis: SeedCdfi[] = loadCdfisFromCsv();
