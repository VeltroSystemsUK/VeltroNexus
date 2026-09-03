import Database from "better-sqlite3";
import { resolve } from "path";

export type LeadFinderCandidate = {
  companyName: string;
  companyNumber: string;
  address?: string;
  phone?: string;
  website?: string;
  email?: string;
  contactName?: string;
  sicCode?: string;
  incorporationDate?: string;
  lenders: string[];
  lastChargeDate?: string;
  activeChargeCount: number;
};

export function listLeadFinderCandidates(limit = 300): LeadFinderCandidate[] {
  const dbPath = process.env.DATABASE_PATH || resolve("lead_finder.db");
  const db = new Database(dbPath, { readonly: true });
  try {
    const rows = db
      .prepare(
        `SELECT name, company_number, address, phone, website, email, contact_name, sic_code,
                incorporation_date, last_charge_date, active_charge_count, lender_names
         FROM businesses
         WHERE company_number IS NOT NULL
           AND company_number != ''
           AND company_number NOT LIKE 'unknown%'
           AND company_number NOT LIKE 'WEB-%'
         ORDER BY COALESCE(active_charge_count, 0) DESC, COALESCE(has_charges, 0) DESC
         LIMIT ?`
      )
      .all(limit) as any[];

    return rows.map((row) => {
      let lenders: string[] = [];
      try {
        lenders = row.lender_names ? JSON.parse(row.lender_names) : [];
      } catch {
        lenders = String(row.lender_names || "")
          .split(/[;,]/)
          .map((part: string) => part.trim())
          .filter(Boolean);
      }
      return {
        companyName: row.name,
        companyNumber: String(row.company_number),
        address: row.address || undefined,
        phone: row.phone || undefined,
        website: row.website || undefined,
        email: row.email || undefined,
        contactName: row.contact_name || undefined,
        sicCode: row.sic_code || undefined,
        incorporationDate: row.incorporation_date || undefined,
        lastChargeDate: row.last_charge_date || undefined,
        activeChargeCount: Number(row.active_charge_count || 0),
        lenders,
      };
    });
  } finally {
    db.close();
  }
}

export function lendersByCompanyNumber(limit = 5000): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of listLeadFinderCandidates(limit)) {
    if (!row.lenders.length) continue;
    map.set(String(row.companyNumber), row.lenders);
    map.set(String(row.companyNumber).replace(/^0+/, ""), row.lenders);
  }
  return map;
}

export function lendersForCompany(companyNumber?: string | null, index?: Map<string, string[]>): string[] {
  const raw = String(companyNumber || "").trim();
  if (!raw) return [];
  const table = index || lendersByCompanyNumber();
  return table.get(raw) || table.get(raw.replace(/^0+/, "")) || [];
}
