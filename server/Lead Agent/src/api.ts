/**
 * api.ts
 * LeadFinderAPI — the primary agent-facing interface.
 *
 * Import this in your agent architecture. The CLI is a thin wrapper over this.
 * All methods are async and return typed objects — nothing is printed to stdout.
 */

import { writeFileSync, createWriteStream } from 'fs';
import {
  Business,
  SearchFilters,
  SearchResult,
  RunSummary,
  PECRStatus,
  computeLeadScore,
  computeSearchHash,
  defaultFilters,
  generateRecommendation,
} from './models/business.js';
import {
  initDb,
  upsertBusiness,
  getUnenrichedBusinesses,
  getBusinessesForExport,
  getRunStats,
} from './database/db.js';
import { findEmail } from './scrapers/emailFinder.js';
import { scrapeGoogleMaps } from './scrapers/googleMaps.js';
import { validateEmail, assessPecrEligibility } from './enrichers/emailValidator.js';
import { enrichWithCompaniesHouse } from './enrichers/companiesHouse.js';

export class LeadFinderAPI {
  constructor() {
    initDb();
  }

  // ─────────────────────────────────────────────
  // Tool 1: search
  // ─────────────────────────────────────────────

  /**
   * Full pipeline: scrape → filter → enrich → score → persist.
   *
   * Agent notes:
   * - Check summary.recommendation before deciding next action
   * - Use highQuality for immediate outreach pipeline
   * - If summary.passedFilters < 20, consider widening the search
   */
  async search(params: {
    query: string;
    maxResults?: number;
    filters?: Partial<SearchFilters>;
    enrich?: boolean;
    enrichBatchSize?: number;
    enrichDelay?: number;
  }): Promise<SearchResult> {
    const {
      query,
      maxResults = 50,
      filters: filterOverrides = {},
      enrich = true,
      enrichBatchSize = 10,
      enrichDelay = 2000,
    } = params;

    const filters: SearchFilters = { ...defaultFilters(), ...filterOverrides };
    const startTime = Date.now();

    // Phase 1: Discover Businesses (Google Places API)
    console.log(`[api] Searching for leads via Google Places: "${query}" (max: ${maxResults})`);
    const rawBusinesses = await scrapeGoogleMaps(query, maxResults, filters);

    // Phase 2: Persist (idempotent via searchHash)
    let persisted: Business[] = rawBusinesses.map((b) => {
      const hash = computeSearchHash(b);
      return upsertBusiness({ ...b, searchHash: hash });
    });

    // Phase 3: Enrich
    if (enrich && persisted.length > 0) {
      persisted = await this.enrichBatch(persisted, enrichBatchSize, enrichDelay);
    }

    // Phase 4: Recompute scores with email data and persist
    persisted = persisted.map((b) => {
      const scored = { ...b, leadScore: computeLeadScore(b) };
      return upsertBusiness(scored);
    });

    // Phase 5: Build summary
    const runtimeSeconds = (Date.now() - startTime) / 1000;
    const stats = getRunStats(query);
    const highQuality = persisted.filter((b) => (b.leadScore ?? 0) >= 0.7);

    const summaryBase = {
      searchQuery: query,
      filtersApplied: filters,
      totalScraped: rawBusinesses.length,
      passedFilters: persisted.length,
      enriched: stats.enriched,
      emailsFound: stats.emailsFound,
      highQuality: highQuality.length,
      pecrEligible: stats.pecrEligible,
      runtimeSeconds: Math.round(runtimeSeconds * 100) / 100,
      successRate: persisted.length > 0
        ? Math.round((stats.emailsFound / persisted.length) * 100) / 100
        : 0,
    };

    const summary: RunSummary = {
      ...summaryBase,
      recommendation: generateRecommendation(summaryBase),
    };

    return { summary, leads: persisted, highQuality };
  }

  // ─────────────────────────────────────────────
  // Tool 2: enrich
  // ─────────────────────────────────────────────

  /**
   * Enrich unenriched businesses in the database with email addresses.
   * Safe to call multiple times — skips already-enriched records.
   *
   * Agent notes:
   * - Use after a search run with enrich: false, or to retry failed enrichments
   */
  async enrich(params: {
    batchSize?: number;
    delay?: number;
    limit?: number;
  } = {}): Promise<{
    enrichedCount: number;
    emailsFound: number;
    pecrEligible: number;
  }> {
    const { batchSize = 10, delay = 2000, limit = 100 } = params;
    const unenriched = getUnenrichedBusinesses(limit);

    if (unenriched.length === 0) {
      return { enrichedCount: 0, emailsFound: 0, pecrEligible: 0 };
    }

    const enriched = await this.enrichBatch(unenriched, batchSize, delay);

    return {
      enrichedCount: enriched.length,
      emailsFound: enriched.filter((b) => b.email).length,
      pecrEligible: enriched.filter((b) => b.pecrStatus === PECRStatus.ELIGIBLE).length,
    };
  }

  // ─────────────────────────────────────────────
  // Tool 3: export
  // ─────────────────────────────────────────────

  /**
   * Export filtered leads to CSV.
   *
   * Agent notes:
   * - topLeads gives a preview without reading the full CSV
   * - Default filters require email; set requireEmail: false to export all
   */
  async export(params: {
    filters?: Partial<SearchFilters>;
    outputPath?: string;
    minLeadScore?: number;
  } = {}): Promise<{
    exported: number;
    outputPath: string;
    topLeads: Array<{
      name: string;
      email: string | null;
      rating: number | null;
      leadScore: number | null;
      pecrStatus: PECRStatus;
    }>;
  }> {
    const {
      filters: filterOverrides = {},
      outputPath = 'leads.csv',
      minLeadScore = 0,
    } = params;

    const filters: SearchFilters = {
      ...defaultFilters(),
      requireEmail: true,
      ...filterOverrides,
    };

    let records = getBusinessesForExport(filters);
    if (minLeadScore > 0) {
      records = records.filter((r) => (r.leadScore ?? 0) >= minLeadScore);
    }

    // Write CSV manually (avoids extra dependency)
    const header = [
      'name', 'address', 'phone', 'website', 'email',
      'emailConfidence', 'rating', 'reviewCount',
      'status', 'leadScore', 'pecrStatus', 'searchQuery',
      'companyNumber', 'contactName', 'contactRole', 'hasCharges', 'lenderNames'
    ].join(',');

    const rows = records.map((r) =>
      [
        JSON.stringify(r.name ?? ''),
        JSON.stringify(r.address ?? ''),
        JSON.stringify(r.phone ?? ''),
        JSON.stringify(r.website ?? ''),
        JSON.stringify(r.email ?? ''),
        JSON.stringify(r.emailConfidence ?? ''),
        r.rating ?? '',
        r.reviewCount ?? '',
        JSON.stringify(r.status),
        r.leadScore ?? '',
        JSON.stringify(r.pecrStatus),
        JSON.stringify(r.searchQuery),
        JSON.stringify(r.companyNumber ?? ''),
        JSON.stringify(r.contactName ?? ''),
        JSON.stringify(r.contactRole ?? ''),
        r.hasCharges ? 'true' : 'false',
        JSON.stringify(r.lenderNames?.join('; ') ?? ''),
      ].join(',')
    );

    writeFileSync(outputPath, [header, ...rows].join('\n'), 'utf-8');

    const topLeads = records.slice(0, 5).map((r) => ({
      name: r.name,
      email: r.email,
      rating: r.rating,
      leadScore: r.leadScore,
      pecrStatus: r.pecrStatus,
    }));

    return { exported: records.length, outputPath, topLeads };
  }

  // ─────────────────────────────────────────────
  // Tool 4: status
  // ─────────────────────────────────────────────

  /**
   * Return current database statistics.
   *
   * Agent notes:
   * - Call after search() to confirm run completed successfully
   * - Call with no args for overall pipeline health check
   */
  async status(searchQuery?: string): Promise<{
    total: number;
    enriched: number;
    emailsFound: number;
    highQuality: number;
    pecrEligible: number;
  }> {
    return getRunStats(searchQuery);
  }

  // ─────────────────────────────────────────────
  // Internal: batch enrichment
  // ─────────────────────────────────────────────

  private async enrichBatch(
    businesses: Business[],
    batchSize: number,
    delay: number
  ): Promise<Business[]> {
    const enriched: Business[] = [];

    for (let i = 0; i < businesses.length; i += batchSize) {
      const batch = businesses.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map((b) => this.enrichSingle(b))
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          enriched.push(result.value);
        } else {
          // Keep unenriched business rather than lose the record
          enriched.push(batch[results.indexOf(result)]!);
        }
      }

      if (i + batchSize < businesses.length) {
        await new Promise((res) => setTimeout(res, delay));
      }
    }

    return enriched;
  }

  private async enrichSingle(business: Business): Promise<Business> {
    // 1. Companies House Enrichment (Always try if not yet enriched with CH data)
    let enriched = { ...business };

    if (!enriched.companyNumber) {
      // Only run if we haven't already linked it (preserves manually linked data if we add that feature later)
      const chData = await enrichWithCompaniesHouse(enriched);
      enriched = { ...enriched, ...chData };
    }

    // 2. Email Finding (Skip if already has email)
    if (!enriched.email && enriched.website) {
      console.log(`[LeadFinderAPI] Attempting to find email for ${enriched.name} (${enriched.website})`);
      const result = await findEmail(enriched.website, enriched.contactName);
      if (result) {
        const { valid } = await validateEmail(result.email);
        if (valid) {
          enriched.email = result.email;
          enriched.emailConfidence = result.confidence;
          enriched.emailValidated = true;
        }
      }
    }

    enriched.pecrStatus = assessPecrEligibility(enriched);
    enriched.leadScore = computeLeadScore(enriched); // Recompute score with new data
    enriched.enrichedAt = new Date();

    return upsertBusiness(enriched);
  }

}

// ─────────────────────────────────────────────
// Claude tool definitions (Anthropic API format)
// ─────────────────────────────────────────────

export const LEAD_FINDER_TOOLS = [
  {
    name: 'lead_finder_search',
    description:
      'Search Google Maps for local businesses in the UNITED KINGDOM matching a niche and location. ' +
      'All results are geographically restricted to UK addresses only. ' +
      'Scrapes listing data, finds emails, scores leads, and returns a structured summary. ' +
      'Check summary.recommendation to decide next steps. ' +
      'If passedFilters < 20, consider widening the search or lowering filters.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: "Natural language search query, e.g. 'commercial finance brokers in Leeds, UK'",
        },
        maxResults: {
          type: 'number',
          description: 'Max results to scrape. Keep <= 100 to avoid detection. Default: 50.',
          default: 50,
        },
        minRating: {
          type: 'number',
          description: 'Minimum Google Maps star rating. Default: 4.0.',
          default: 4.0,
        },
        minReviews: {
          type: 'number',
          description: 'Minimum review count. Default: 5.',
          default: 5,
        },
        enrich: {
          type: 'boolean',
          description: 'Whether to find emails immediately after scraping. Default: true.',
          default: true,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'lead_finder_enrich',
    description:
      'Enrich unenriched businesses already in the database with email addresses. ' +
      'Use after a search run with enrich=false, or to retry failed enrichments.',
    input_schema: {
      type: 'object' as const,
      properties: {
        batchSize: {
          type: 'number',
          description: 'Concurrent requests per batch. Default: 10.',
          default: 10,
        },
        limit: {
          type: 'number',
          description: 'Max records to enrich in this run. Default: 100.',
          default: 100,
        },
      },
    },
  },
  {
    name: 'lead_finder_export',
    description:
      'Export quality leads to CSV. Returns count, file path, and a preview of ' +
      'the top 5 leads. Default filters require an email address.',
    input_schema: {
      type: 'object' as const,
      properties: {
        outputPath: {
          type: 'string',
          description: "File path for CSV output. Default: 'leads.csv'.",
          default: 'leads.csv',
        },
        minLeadScore: {
          type: 'number',
          description: 'Minimum lead score (0.0–1.0). Default: 0.0.',
          default: 0.0,
        },
        requireEmail: {
          type: 'boolean',
          description: 'Only export leads with a verified email. Default: true.',
          default: true,
        },
      },
    },
  },
  {
    name: 'lead_finder_status',
    description:
      'Return current database statistics. Call after search() to confirm ' +
      'the run completed, or with no args for overall pipeline health.',
    input_schema: {
      type: 'object' as const,
      properties: {
        searchQuery: {
          type: 'string',
          description: 'Filter stats to a specific search run. Omit for overall stats.',
        },
      },
    },
  },
] as const;
