/**
 * scrapers/googleMaps.ts
 * Google Places API scraper — no browser, no Playwright, no fragility.
 *
 * Uses two endpoints:
 *   1. Text Search  → finds businesses matching a query, returns place_ids
 *   2. Place Details → fetches full data for each place_id
 *
 * Free tier: ~5,000 requests/month. At 1 Text Search + up to 20 Detail
 * calls per run, you'd need to run 250 searches to hit the limit.
 *
 * Setup: Add GOOGLE_PLACES_API_KEY to your .env file.
 * Get a key: https://console.cloud.google.com → APIs → Places API → Credentials
 */

import {
  Business,
  BusinessStatus,
  SearchFilters,
  computeLeadScore,
  computeSearchHash,
  defaultFilters,
} from '../models/business.js';

// ─────────────────────────────────────────────
// Types (Google Places API responses)
// ─────────────────────────────────────────────

interface PlacesTextSearchResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
}

interface PlacesTextSearchResponse {
  status: string;
  results: PlacesTextSearchResult[];
  next_page_token?: string;
  error_message?: string;
}

interface PlaceDetailsResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
}

interface PlaceDetailsResponse {
  status: string;
  result?: PlaceDetailsResult;
  error_message?: string;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const BASE_URL = 'https://maps.googleapis.com/maps/api/place';

// Only request fields you need — saves quota
const DETAIL_FIELDS = [
  'place_id',
  'name',
  'formatted_address',
  'formatted_phone_number',
  'website',
  'rating',
  'user_ratings_total',
  'business_status',
].join(',');

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getApiKey(): string {
  // Try both common names
  const key = process.env['GOOGLE_PLACES_API_KEY'] || process.env['GOOGLE_MAPS_API_KEY'] || process.env['GOOGLE_MAPS-API'];
  if (!key) {
    throw new Error(
      'GOOGLE_PLACES_API_KEY is not set in your .env file.\n' +
      'Get a key: https://console.cloud.google.com → APIs → Places API → Credentials'
    );
  }
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function mapBusinessStatus(status?: string): BusinessStatus {
  switch (status?.toUpperCase()) {
    case 'OPERATIONAL': return BusinessStatus.OPERATIONAL;
    case 'CLOSED_TEMPORARILY': return BusinessStatus.CLOSED_TEMPORARILY;
    case 'CLOSED_PERMANENTLY': return BusinessStatus.CLOSED_PERMANENTLY;
    default: return BusinessStatus.UNKNOWN;
  }
}

function isUKAddress(address: string | null | undefined): boolean {
  if (!address) return false;

  // UK postcode regex pattern (e.g., SW1A 1AA, M1 1AA, EC1A 1BB)
  const ukPostcodeRegex = /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}\b/i;
  const addressLower = address.toLowerCase();

  // Check for UK postcode format OR explicit UK/United Kingdom mention
  return ukPostcodeRegex.test(address) ||
    addressLower.includes('united kingdom') ||
    addressLower.includes(', uk');
}

function passesPreFlight(business: Business, filters: SearchFilters): boolean {
  if (filters.operationalOnly && business.status === BusinessStatus.CLOSED_PERMANENTLY) return false;
  if (business.rating !== null && business.rating < filters.minRating) return false;
  if (business.reviewCount !== null && business.reviewCount < filters.minReviews) return false;
  if (filters.requireWebsite && !business.website) return false;
  return true;
}

// ─────────────────────────────────────────────
// API calls
// ─────────────────────────────────────────────

async function textSearch(
  query: string,
  apiKey: string,
  pageToken?: string
): Promise<PlacesTextSearchResponse> {
  const params = new URLSearchParams({
    query,
    key: apiKey,
    region: 'gb',
    language: 'en-GB',
    location: '54.7023545,-3.2765753', // Geographic center of UK
    radius: '500000', // 500km radius covers all of UK
  });

  if (pageToken) params.set('pagetoken', pageToken);

  const res = await fetch(`${BASE_URL}/textsearch/json?${params}`);
  if (!res.ok) throw new Error(`Places Text Search HTTP ${res.status}: ${res.statusText}`);

  const data = await res.json() as PlacesTextSearchResponse;

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Places API error: ${data.status} — ${data.error_message ?? 'unknown'}`);
  }

  return data;
}

async function placeDetails(
  placeId: string,
  apiKey: string
): Promise<PlaceDetailsResult | null> {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: DETAIL_FIELDS,
    key: apiKey,
    language: 'en-GB',
  });

  const res = await fetch(`${BASE_URL}/details/json?${params}`);
  if (!res.ok) {
    console.error(`[scraper] Place Details HTTP ${res.status} for ${placeId}`);
    return null;
  }

  const data = await res.json() as PlaceDetailsResponse;
  if (data.status !== 'OK') {
    console.error(`[scraper] Place Details error for ${placeId}: ${data.status}`);
    return null;
  }

  return data.result ?? null;
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────

export async function scrapeGoogleMaps(
  query: string,
  maxResults = 50,
  filters: SearchFilters = defaultFilters()
): Promise<Business[]> {
  const apiKey = getApiKey();
  const businesses: Business[] = [];
  let pageToken: string | undefined;
  let fetched = 0;

  console.log(`[scraper] Searching Places API: "${query}"`);

  while (fetched < maxResults) {
    const searchData = await textSearch(query, apiKey, pageToken);

    if (!searchData.results?.length) {
      console.log(`[scraper] No results returned`);
      break;
    }

    const batch = searchData.results.slice(0, maxResults - fetched);
    console.log(`[scraper] Page ${Math.ceil(fetched / 20) + 1}: ${batch.length} results`);

    for (const result of batch) {
      // Pre-filter on Text Search data before spending a Detail call
      const quickStatus = mapBusinessStatus(result.business_status);
      if (filters.operationalOnly && quickStatus === BusinessStatus.CLOSED_PERMANENTLY) {
        console.log(`[scraper] Skip (closed): ${result.name}`);
        fetched++;
        continue;
      }
      if (result.rating !== undefined && result.rating < filters.minRating) {
        console.log(`[scraper] Skip (${result.rating}★): ${result.name}`);
        fetched++;
        continue;
      }
      if (result.user_ratings_total !== undefined && result.user_ratings_total < filters.minReviews) {
        console.log(`[scraper] Skip (${result.user_ratings_total} reviews): ${result.name}`);
        fetched++;
        continue;
      }

      // Fetch full details for remaining candidates
      const details = await placeDetails(result.place_id, apiKey);
      await sleep(200); // polite delay between Detail calls

      if (!details) { fetched++; continue; }

      // Filter out non-UK addresses
      if (!isUKAddress(details.formatted_address)) {
        console.log(`[scraper] Skip (non-UK): ${details.name} - ${details.formatted_address}`);
        fetched++;
        continue;
      }

      const business: Business = {
        name: details.name,
        address: details.formatted_address ?? null,
        phone: details.formatted_phone_number ?? null,
        website: details.website ?? null,
        rating: details.rating ?? null,
        reviewCount: details.user_ratings_total ?? null,
        status: mapBusinessStatus(details.business_status),
        googlePlaceId: details.place_id,
        email: null,
        emailConfidence: null,
        emailValidated: false,
        pecrStatus: 'NOT_ASSESSED',
        leadScore: null,
        searchQuery: query,
        enrichedAt: null,
        // Companies House fields (defaults)
        companyNumber: null,
        sicCode: null,
        incorporationDate: null,
        contactName: null,
        contactRole: null,
        hasCharges: false,
        activeChargeCount: 0,
        lastChargeDate: null,
        lenderNames: [],
        migrated: false,
        strategyAnalysis: null,
        strategyEmail: null,
      };

      business.searchHash = computeSearchHash(business);
      business.leadScore = computeLeadScore(business);

      if (passesPreFlight(business, filters)) {
        businesses.push(business);
        console.log(`[scraper] ✓ ${business.name} — ${business.rating ?? '?'}★ (${business.reviewCount ?? 0} reviews) — ${business.website ?? 'no website'}`);
      }

      fetched++;
    }

    // Paginate if needed — Google requires 2s delay before using page token
    if (searchData.next_page_token && fetched < maxResults) {
      pageToken = searchData.next_page_token;
      await sleep(2000);
    } else {
      break;
    }
  }

  console.log(`[scraper] Complete: ${businesses.length}/${fetched} passed filters`);
  return businesses;
}

