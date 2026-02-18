/**
 * models/business.ts
 * Zod schemas (runtime validation) + inferred TypeScript types (compile-time).
 * These are the types shared across scrapers, enrichers, DB, agent, and API.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────

export const BusinessStatus = {
  OPERATIONAL: 'OPERATIONAL',
  CLOSED_TEMPORARILY: 'CLOSED_TEMPORARILY',
  CLOSED_PERMANENTLY: 'CLOSED_PERMANENTLY',
  UNKNOWN: 'UNKNOWN',
} as const;
export type BusinessStatus = (typeof BusinessStatus)[keyof typeof BusinessStatus];

export const EmailConfidence = {
  HIGH: 'HIGH',       // Direct mailto: link on homepage
  MEDIUM: 'MEDIUM',   // Contact page or regex extraction
  LOW: 'LOW',         // Pattern-guessed, MX validated only
  UNVERIFIED: 'UNVERIFIED',
} as const;
export type EmailConfidence = (typeof EmailConfidence)[keyof typeof EmailConfidence];

export const PECRStatus = {
  ELIGIBLE: 'ELIGIBLE',         // Business email, B2B context clear
  UNCERTAIN: 'UNCERTAIN',       // Possibly sole trader or named individual
  INELIGIBLE: 'INELIGIBLE',     // Personal email (Gmail, Hotmail, etc.)
  NOT_ASSESSED: 'NOT_ASSESSED',
} as const;
export type PECRStatus = (typeof PECRStatus)[keyof typeof PECRStatus];

// ─────────────────────────────────────────────
// Search Filters
// ─────────────────────────────────────────────

export const SearchFiltersSchema = z.object({
  minRating: z.number().min(0).max(5).default(4.0),
  minReviews: z.number().int().min(0).default(5),
  operationalOnly: z.boolean().default(true),
  requireWebsite: z.boolean().default(true),
  requireEmail: z.boolean().default(false), // false at scrape time; true at export
});
export type SearchFilters = z.infer<typeof SearchFiltersSchema>;

export const defaultFilters = (): SearchFilters => SearchFiltersSchema.parse({});

// ─────────────────────────────────────────────
// Business
// ─────────────────────────────────────────────

export const BusinessSchema = z.object({
  id: z.number().optional(),

  // Core Maps data
  name: z.string(),
  address: z.string().nullable().default(null),
  phone: z.string().nullable().default(null),
  website: z.string().url().nullable().default(null),
  rating: z.number().min(0).max(5).nullable().default(null),
  reviewCount: z.number().int().nullable().default(null),
  status: z.nativeEnum(BusinessStatus).default(BusinessStatus.UNKNOWN),
  googlePlaceId: z.string().nullable().default(null),

  // Enrichment
  email: z.string().email().nullable().default(null),
  emailConfidence: z.nativeEnum(EmailConfidence).nullable().default(null),
  emailValidated: z.boolean().default(false),
  pecrStatus: z.nativeEnum(PECRStatus).default(PECRStatus.NOT_ASSESSED),

  // Companies House Data
  companyNumber: z.string().nullable().default(null),
  sicCode: z.string().nullable().default(null),
  incorporationDate: z.string().nullable().default(null),
  contactName: z.string().nullable().default(null),
  contactRole: z.string().nullable().default(null),
  hasCharges: z.boolean().default(false),
  activeChargeCount: z.number().int().default(0),
  lastChargeDate: z.string().nullable().default(null),
  lenderNames: z.array(z.string()).default([]),
  migrated: z.boolean().default(false),

  // Scoring
  leadScore: z.number().min(0).max(1).nullable().default(null),

  // Metadata
  searchQuery: z.string(),
  searchHash: z.string().optional(),
  scrapedAt: z.date().optional(),
  enrichedAt: z.date().nullable().default(null),
});
export type Business = z.infer<typeof BusinessSchema>;

// ─────────────────────────────────────────────
// Run Summary
// ─────────────────────────────────────────────

export const RunSummarySchema = z.object({
  searchQuery: z.string(),
  filtersApplied: SearchFiltersSchema,
  totalScraped: z.number().int(),
  passedFilters: z.number().int(),
  enriched: z.number().int(),
  emailsFound: z.number().int(),
  highQuality: z.number().int(),    // leadScore >= 0.7
  pecrEligible: z.number().int(),
  runtimeSeconds: z.number(),
  successRate: z.number(),          // emailsFound / passedFilters
  recommendation: z.string(),
});
export type RunSummary = z.infer<typeof RunSummarySchema>;

export interface SearchResult {
  summary: RunSummary;
  leads: Business[];
  highQuality: Business[];
}

// ─────────────────────────────────────────────
// Lead Score computation
// ─────────────────────────────────────────────

/**
 * Collapses multiple signals into a single 0–1 score.
 * Agents use this number to rank/filter without needing
 * business logic baked into their prompts.
 */
export function computeLeadScore(business: Business): number {
  let score = 0;

  // Rating (0–0.35)
  if (business.rating !== null) {
    score += (business.rating / 5.0) * 0.35;
  }

  // Review count — log-scaled, caps at 100 (0–0.20)
  if (business.reviewCount !== null) {
    const capped = Math.min(business.reviewCount, 100);
    score += (Math.log1p(capped) / Math.log1p(100)) * 0.20;
  }

  // Has website (0–0.15)
  if (business.website) score += 0.15;

  // Has email (0–0.20)
  if (business.email) score += 0.20;

  // Email confidence bonus (0–0.05)
  if (business.emailConfidence === EmailConfidence.HIGH) score += 0.05;
  else if (business.emailConfidence === EmailConfidence.MEDIUM) score += 0.025;

  // PECR eligible bonus (0–0.05)
  if (business.pecrStatus === PECRStatus.ELIGIBLE) score += 0.05;

  return Math.round(Math.min(score, 1.0) * 10000) / 10000;
}

// ─────────────────────────────────────────────
// Idempotency key
// ─────────────────────────────────────────────

import { createHash } from 'crypto';

export function computeSearchHash(business: Pick<Business, 'name' | 'address' | 'searchQuery'>): string {
  const key = `${business.name}|${business.address ?? ''}|${business.searchQuery}`;
  return createHash('sha256').update(key).digest('hex');
}

// ─────────────────────────────────────────────
// Run summary recommendation
// ─────────────────────────────────────────────

export function generateRecommendation(summary: Omit<RunSummary, 'recommendation'>): string {
  if (summary.passedFilters === 0) {
    return 'No results passed filters. Consider widening search radius or lowering minRating.';
  }
  if (summary.successRate < 0.3) {
    return 'Low email success rate. Consider targeting businesses with clearer web presence.';
  }
  if (summary.highQuality < 10) {
    return 'Fewer than 10 high-quality leads. Consider running additional searches in adjacent areas.';
  }
  return `Good run. ${summary.highQuality} high-quality leads ready for Strategy Agent review.`;
}
