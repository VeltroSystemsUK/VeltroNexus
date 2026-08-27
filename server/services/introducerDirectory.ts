import { assessIntroducerFit } from "@shared/salesOs";
import { chFetch } from "../utils/companiesHouseClient";
import { incorporatedToCutoff } from "./strataFit";

export const INTRODUCER_SIC_CODES = ["69201", "69202", "69203"];

export const INTRODUCER_REGIONS = [
  { location: "Leicester", postcode: "LE" },
  { location: "Nottingham", postcode: "NG" },
  { location: "Derby", postcode: "DE" },
  { location: "Lincoln", postcode: "LN" },
  { location: "Northampton", postcode: "NN" },
  { location: "Coventry", postcode: "CV" },
  { location: "Peterborough", postcode: "PE" },
  { location: "Milton Keynes", postcode: "MK" },
];

export type IntroducerCandidate = {
  companyName: string;
  companyNumber: string;
  companyStatus?: string;
  dateOfCreation?: string;
  sicCodes: string[];
  address?: string;
  score: number;
  reasons: string[];
  summary: string;
};

const ALLOWED_TYPES = new Set(["ltd", "llp", "plc", "limited-partnership"]);

export async function searchIntroducerDirectory(options?: {
  limit?: number;
  skipNumbers?: Set<string>;
}): Promise<IntroducerCandidate[]> {
  const limit = options?.limit ?? 15;
  const skip = options?.skipNumbers || new Set<string>();
  const found: IntroducerCandidate[] = [];

  for (const region of INTRODUCER_REGIONS) {
    if (found.length >= limit) break;
    const params = new URLSearchParams({
      company_status: "active",
      size: "25",
      start_index: "0",
      location: region.location,
      sic_codes: INTRODUCER_SIC_CODES[0],
      incorporated_to: incorporatedToCutoff(),
    });

    let data: any;
    try {
      const response = await chFetch(`/advanced-search/companies?${params.toString()}`);
      if (response.status === 429) break;
      if (!response.ok) continue;
      data = await response.json();
    } catch {
      continue;
    }

    for (const item of data?.items || []) {
      if (found.length >= limit) break;
      const companyNumber = String(item.company_number || "");
      const companyName = String(item.company_name || "");
      if (!companyNumber || skip.has(companyNumber)) continue;
      const type = String(item.company_type || "").toLowerCase();
      if (type && !ALLOWED_TYPES.has(type)) continue;

      const addr = item.registered_office_address || {};
      const pc = String(addr.postal_code || "").toUpperCase().replace(/\s+/g, "");
      if (region.postcode && pc && !pc.startsWith(region.postcode.toUpperCase())) continue;

      const sicCodes: string[] = item.sic_codes || [];
      const fit = assessIntroducerFit({
        companyName,
        sicCodes,
        companyStatus: item.company_status,
        dateOfCreation: item.date_of_creation,
        alreadyOnBook: skip.has(companyNumber),
      });
      if (!fit.pass) continue;

      skip.add(companyNumber);
      found.push({
        companyName,
        companyNumber,
        companyStatus: item.company_status,
        dateOfCreation: item.date_of_creation,
        sicCodes,
        address: [addr.address_line_1, addr.locality, addr.postal_code].filter(Boolean).join(", ") || undefined,
        score: fit.score,
        reasons: fit.reasons,
        summary: fit.summary,
      });
    }
  }

  return found;
}
