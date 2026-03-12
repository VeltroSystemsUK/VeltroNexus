/**
 * database/broker_db.ts
 * Isolated SQLite database for the Broker Finder agent.
 * Completely separate from lead_finder.db used by Lead Finder.
 */

import Database from 'better-sqlite3';
import { resolve } from 'path';
import {
  Business,
  BusinessStatus,
  EmailConfidence,
  PECRStatus,
  SearchFilters,
  computeSearchHash,
} from '../models/business.js';

function addColumn(db: Database.Database, table: string, column: string, type: string) {
  try {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
  } catch (error: any) {
    if (!error.message.includes('duplicate column name')) {
      console.error(`[BrokerDB] Failed to add column ${column}:`, error);
    }
  }
}

const BROKER_DB_PATH = process.env['BROKER_DATABASE_PATH'] ?? resolve('./broker_finder.db');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(BROKER_DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
  }
  return _db;
}

// ─────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────

export function initDb(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS businesses (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT    NOT NULL,
      address         TEXT,
      phone           TEXT,
      website         TEXT,
      rating          REAL,
      review_count    INTEGER,
      status          TEXT    NOT NULL DEFAULT 'UNKNOWN',
      google_place_id TEXT    UNIQUE,

      email             TEXT,
      email_confidence  TEXT,
      email_validated   INTEGER NOT NULL DEFAULT 0,
      pecr_status       TEXT    NOT NULL DEFAULT 'NOT_ASSESSED',

      lead_score    REAL,
      search_query  TEXT NOT NULL,
      search_hash   TEXT NOT NULL UNIQUE,
      scraped_at    TEXT NOT NULL DEFAULT (datetime('now')),
      enriched_at   TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_email ON businesses(email);
  `);

  addColumn(db, 'businesses', 'company_number', 'TEXT');
  addColumn(db, 'businesses', 'sic_code', 'TEXT');
  addColumn(db, 'businesses', 'incorporation_date', 'TEXT');
  addColumn(db, 'businesses', 'contact_name', 'TEXT');
  addColumn(db, 'businesses', 'contact_role', 'TEXT');
  addColumn(db, 'businesses', 'has_charges', 'INTEGER DEFAULT 0');
  addColumn(db, 'businesses', 'active_charge_count', 'INTEGER DEFAULT 0');
  addColumn(db, 'businesses', 'last_charge_date', 'TEXT');
  addColumn(db, 'businesses', 'lender_names', 'TEXT');
  addColumn(db, 'businesses', 'migrated', 'INTEGER DEFAULT 0');
}

// ─────────────────────────────────────────────
// Row <-> Business mapping
// ─────────────────────────────────────────────

interface DbRow {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  status: string;
  google_place_id: string | null;
  email: string | null;
  email_confidence: string | null;
  email_validated: number;
  pecr_status: string;
  lead_score: number | null;
  search_query: string;
  search_hash: string;
  scraped_at: string;
  enriched_at: string | null;
  company_number: string | null;
  sic_code: string | null;
  incorporation_date: string | null;
  contact_name: string | null;
  contact_role: string | null;
  has_charges: number;
  active_charge_count: number;
  last_charge_date: string | null;
  lender_names: string | null;
  migrated: number;
}

function rowToBusiness(row: DbRow): Business {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    website: row.website,
    rating: row.rating,
    reviewCount: row.review_count,
    status: row.status as BusinessStatus,
    googlePlaceId: row.google_place_id,
    email: row.email,
    emailConfidence: row.email_confidence as EmailConfidence | null,
    emailValidated: row.email_validated === 1,
    pecrStatus: row.pecr_status as PECRStatus,
    leadScore: row.lead_score,
    searchQuery: row.search_query,
    searchHash: row.search_hash,
    scrapedAt: new Date(row.scraped_at),
    enrichedAt: row.enriched_at ? new Date(row.enriched_at) : null,
    companyNumber: row.company_number,
    sicCode: row.sic_code,
    incorporationDate: row.incorporation_date,
    contactName: row.contact_name,
    contactRole: row.contact_role,
    hasCharges: row.has_charges === 1,
    activeChargeCount: row.active_charge_count || 0,
    lastChargeDate: row.last_charge_date,
    migrated: row.migrated === 1,
    lenderNames: (() => {
      try { return row.lender_names ? JSON.parse(row.lender_names) : []; }
      catch { return []; }
    })(),
  };
}

// ─────────────────────────────────────────────
// Write operations
// ─────────────────────────────────────────────

export function upsertBusiness(business: Business): Business {
  const db = getDb();
  const hash = business.searchHash ?? computeSearchHash(business);

  const existing = db
    .prepare('SELECT * FROM businesses WHERE search_hash = ?')
    .get(hash) as DbRow | undefined;

  if (existing) {
    db.prepare(`
      UPDATE businesses SET
        email            = COALESCE(?, email),
        email_confidence = COALESCE(?, email_confidence),
        email_validated  = CASE WHEN ? = 1 THEN 1 ELSE email_validated END,
        pecr_status      = ?,
        lead_score       = COALESCE(?, lead_score),
        enriched_at      = CASE WHEN ? IS NOT NULL THEN ? ELSE enriched_at END,
        company_number   = COALESCE(?, company_number),
        sic_code         = COALESCE(?, sic_code),
        incorporation_date = COALESCE(?, incorporation_date),
        contact_name     = COALESCE(?, contact_name),
        contact_role     = COALESCE(?, contact_role),
        has_charges      = ?,
        active_charge_count = ?,
        last_charge_date = COALESCE(?, last_charge_date),
        lender_names     = COALESCE(?, lender_names)
      WHERE search_hash = ?
    `).run(
      business.email ?? null,
      business.emailConfidence ?? null,
      business.emailValidated ? 1 : 0,
      business.pecrStatus,
      business.leadScore ?? null,
      business.enrichedAt?.toISOString() ?? null,
      business.enrichedAt?.toISOString() ?? null,
      business.companyNumber ?? null,
      business.sicCode ?? null,
      business.incorporationDate ?? null,
      business.contactName ?? null,
      business.contactRole ?? null,
      business.hasCharges ? 1 : 0,
      business.activeChargeCount ?? 0,
      business.lastChargeDate ?? null,
      JSON.stringify(business.lenderNames ?? []),
      hash,
    );

    return rowToBusiness(
      db.prepare('SELECT * FROM businesses WHERE search_hash = ?').get(hash) as DbRow
    );
  }

  db.prepare(`
    INSERT INTO businesses (
      name, address, phone, website, rating, review_count,
      status, google_place_id, email, email_confidence,
      email_validated, pecr_status, lead_score,
      search_query, search_hash, scraped_at, enriched_at,
      company_number, sic_code, incorporation_date, contact_name, contact_role,
      has_charges, active_charge_count, last_charge_date, lender_names
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, datetime('now'), ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).run(
    business.name,
    business.address ?? null,
    business.phone ?? null,
    business.website ?? null,
    business.rating ?? null,
    business.reviewCount ?? null,
    business.status,
    business.googlePlaceId ?? null,
    business.email ?? null,
    business.emailConfidence ?? null,
    business.emailValidated ? 1 : 0,
    business.pecrStatus,
    business.leadScore ?? null,
    business.searchQuery,
    hash,
    business.enrichedAt?.toISOString() ?? null,
    business.companyNumber ?? null,
    business.sicCode ?? null,
    business.incorporationDate ?? null,
    business.contactName ?? null,
    business.contactRole ?? null,
    business.hasCharges ? 1 : 0,
    business.activeChargeCount ?? 0,
    business.lastChargeDate ?? null,
    JSON.stringify(business.lenderNames ?? []),
  );

  return rowToBusiness(
    db.prepare('SELECT * FROM businesses WHERE search_hash = ?').get(hash) as DbRow
  );
}

export function deleteBusiness(placeId: string): void {
  getDb().prepare('DELETE FROM businesses WHERE google_place_id = ?').run(placeId);
}

export function clearAllBusinesses(): void {
  getDb().prepare('DELETE FROM businesses').run();
}

export function updateBusinessContact(placeId: string, contact: { email: string, context?: string }): void {
  getDb().prepare(`
    UPDATE businesses SET
      email = ?,
      email_confidence = 'HIGH',
      email_validated = 1,
      enriched_at = datetime('now')
    WHERE google_place_id = ?
  `).run(contact.email, placeId);
}

export function markBusinessAsMigrated(placeId: string): void {
  getDb().prepare(`
    UPDATE businesses SET migrated = 1 WHERE google_place_id = ?
  `).run(placeId);
}

// ─────────────────────────────────────────────
// Read operations
// ─────────────────────────────────────────────

export function getBusinessesForExport(filters: SearchFilters): Business[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.minRating) { conditions.push('rating >= ?'); params.push(filters.minRating); }
  if (filters.minReviews) { conditions.push('review_count >= ?'); params.push(filters.minReviews); }
  if (filters.operationalOnly) { conditions.push("status = 'OPERATIONAL'"); }
  if (filters.requireWebsite) { conditions.push('website IS NOT NULL'); }
  if (filters.requireEmail) { conditions.push('email IS NOT NULL'); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT * FROM businesses ${where} ORDER BY lead_score DESC NULLS LAST`;

  return (db.prepare(sql).all(...params) as DbRow[]).map(rowToBusiness);
}

export function getRunStats(): {
  total: number;
  enriched: number;
  emailsFound: number;
  highQuality: number;
  pecrEligible: number;
} {
  const rows = getDb().prepare('SELECT * FROM businesses').all() as DbRow[];
  return {
    total: rows.length,
    enriched: rows.filter(r => r.enriched_at !== null).length,
    emailsFound: rows.filter(r => r.email !== null).length,
    highQuality: rows.filter(r => r.lead_score !== null && r.lead_score >= 0.7).length,
    pecrEligible: rows.filter(r => r.pecr_status === 'ELIGIBLE').length,
  };
}
