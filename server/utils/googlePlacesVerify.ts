// Confirms a company's registered address (from Companies House) corresponds
// to a real, operational business listing — a lightweight sanity check, not a
// definitive legal verification. Reuses the same Places Text Search endpoint
// as Lead Agent's scraper, but queries by name+address instead of by sector.

const BASE_URL = "https://maps.googleapis.com/maps/api/place";

const UK_POSTCODE_REGEX = /([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})/i;

export interface AddressVerificationResult {
  matched: boolean;
  confidence: "high" | "low" | "none";
  placeName?: string;
  placeAddress?: string;
  businessStatus?: string;
}

function getApiKey(): string | undefined {
  return process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
}

export async function verifyBusinessAddress(
  companyName: string,
  registeredAddress: string
): Promise<AddressVerificationResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY not configured");
  }

  const query = `${companyName} ${registeredAddress}`;
  const response = await fetch(
    `${BASE_URL}/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`
  );

  if (!response.ok) {
    throw new Error(`Google Places API returned ${response.status}`);
  }

  const data = await response.json();
  const top = data.results?.[0];
  if (!top) {
    return { matched: false, confidence: "none" };
  }

  const inputPostcode = registeredAddress.match(UK_POSTCODE_REGEX)?.[1]?.replace(/\s+/g, "").toUpperCase();
  const resultPostcode = (top.formatted_address as string | undefined)
    ?.match(UK_POSTCODE_REGEX)?.[1]
    ?.replace(/\s+/g, "")
    .toUpperCase();

  const postcodeMatches = !!inputPostcode && !!resultPostcode && inputPostcode === resultPostcode;

  return {
    matched: postcodeMatches,
    confidence: postcodeMatches ? "high" : "low",
    placeName: top.name,
    placeAddress: top.formatted_address,
    businessStatus: top.business_status,
  };
}
