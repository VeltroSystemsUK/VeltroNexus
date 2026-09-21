import { chargeHarvestSignal, type HarvestRank, type HarvestSkipClass } from "@shared/crmHarvestRank";
import { classifyLender, type LenderBand, type LenderCostRank } from "@shared/lenderCost";
import type { CrmHarvestLead } from "./crmHarvest";

const SKIP: HarvestSkipClass[] = ["charge_sme", "ok_sme", "charity_public", "holding_spv", "unsure"];

export function noulProbability(answer: unknown): number {
  if (!answer || typeof answer !== "object") return 0;
  const row = answer as { noul?: unknown; value?: unknown; probability?: unknown };
  if (row.value === true) return 1;
  if (row.value === false) return 0;
  const p = Number(row.noul ?? row.probability);
  return Number.isFinite(p) ? p : 0;
}

export function noulYes(answer: unknown): boolean {
  return noulProbability(answer) >= 0.5;
}

export function scoreValue(answer: unknown): number {
  if (!answer || typeof answer !== "object") return 0;
  const row = answer as { score?: unknown; value?: unknown };
  const value = Number(row.score ?? row.value);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(4, Math.round(value)));
}

function skipValue(answer: unknown): HarvestSkipClass {
  const row = answer as { choice?: unknown; value?: unknown } | null;
  const value = String(row?.choice ?? row?.value ?? "");
  return SKIP.includes(value as HarvestSkipClass) ? (value as HarvestSkipClass) : "unsure";
}

export function parseJevHarvestAnswers(answers: Record<string, unknown> | null | undefined): HarvestRank {
  const row = answers || {};
  return {
    harvestNow: noulYes(row.harvest_now),
    smeBorrower: scoreValue(row.sme_borrower),
    skipClass: skipValue(row.skip_class),
  };
}

const BANDS: LenderBand[] = ["mca", "high_cost", "specialist", "high_street", "property", "unknown"];
const APR_FROM_SCORE = [0, 8, 15, 30, 45];

function bandValue(answer: unknown): LenderBand {
  const row = answer as { choice?: unknown; value?: unknown } | null;
  const value = String(row?.choice ?? row?.value ?? "");
  return BANDS.includes(value as LenderBand) ? (value as LenderBand) : "unknown";
}

function aprValue(answer: unknown, band: LenderBand): number {
  if (!answer || typeof answer !== "object") return band === "unknown" ? 0 : APR_FROM_SCORE[BANDS.indexOf(band)] || 0;
  const row = answer as { score?: unknown; value?: unknown };
  const raw = Number(row.score ?? row.value);
  if (!Number.isFinite(raw)) return band === "unknown" ? 0 : APR_FROM_SCORE[Math.max(0, BANDS.indexOf(band))] || 0;
  if (raw > 4) return Math.max(0, Math.min(80, Math.round(raw)));
  return APR_FROM_SCORE[Math.max(0, Math.min(4, Math.round(raw)))] ?? 0;
}

export function parseJevLenderAnswers(answers: Record<string, unknown> | null | undefined): LenderCostRank {
  const row = answers || {};
  const band = bandValue(row.lender_band);
  return { band, typicalApr: band === "unknown" ? 0 : aprValue(row.typical_apr, band) };
}

export async function jevRankLender(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<LenderCostRank> {
  const known = classifyLender(name);
  if (known.band !== "unknown") return known;
  const key = env.TYPESAFE_API_KEY?.trim();
  if (!key) return { band: "unknown", typicalApr: 0 };
  try {
    const res = await fetchImpl("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "jev-latest",
        state: { identifiedLender: name },
        questions: {
          lender_band: {
            type: "choice",
            instructions:
              "Classify this UK charge-holder for a commercial-finance broker ranking distress. MCA/revenue-based (YouLend, Liberis, Iwoca, daily skim) is mca. Other expensive short-term SME lenders (Capify, Fleximize, Reward, Bizcap) are high_cost. Milder non-bank (Funding Circle, Nucleus, CDFI-like but still commercial) is specialist. High-street banks and building societies are high_street. Property/bridging (Together, LendInvest, West One, Landbay) is property. Unknown if you cannot tell.",
            criteria: {
              mca: "Merchant cash advance or revenue-based / daily-repayment high-cost SME lender",
              high_cost: "Expensive short-term unsecured or invoice SME lender, typical APR 15%+",
              specialist: "Non-bank specialist at milder rates, or community/CDFI",
              high_street: "High-street bank or building society",
              property: "Property, bridging, BTL or development charge",
              unknown: "Not enough to classify",
            },
          },
          typical_apr: {
            type: "score",
            instructions:
              "How expensive is this lender for a UK SME? Score 0 cheap/unknown, 4 extremely expensive MCA. If you know a typical APR percentage above 4, return that percentage as the value.",
            criteria: [
              "Unknown or cheap (high street / property / CDFI)",
              "High-street-like (~8%)",
              "Specialist (~15%)",
              "High-cost short-term (~30%)",
              "MCA / daily skim (~45%+)",
            ],
          },
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { band: "unknown", typicalApr: 0 };
    const payload = await res.json();
    return { ...parseJevLenderAnswers(payload?.answers || payload), at: new Date().toISOString() };
  } catch {
    return { band: "unknown", typicalApr: 0 };
  }
}

export function jevHarvestEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.TYPESAFE_API_KEY?.trim());
}

export async function jevRankLead(
  lead: CrmHarvestLead,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<HarvestRank> {
  const key = env.TYPESAFE_API_KEY?.trim();
  if (!key) {
    const signal = chargeHarvestSignal(lead);
    if (signal === "property_only") return { harvestNow: false, smeBorrower: 0, skipClass: "unsure" };
    return {
      harvestNow: true,
      smeBorrower: signal === "business" ? 3 : 1,
      skipClass: signal === "business" ? "charge_sme" : "unsure",
    };
  }
  try {
    const res = await fetchImpl("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "jev-latest",
        state: {
          companyName: lead.companyName,
          companyType: lead.companyType || "",
          sicCode: lead.sicCode || "",
          hasCharges: Boolean(lead.hasCharges),
          identifiedLender: lead.identifiedLender || "",
          chargeStatus: (lead as { chargeStatus?: string }).chargeStatus || "",
          city: (lead as { city?: string }).city || "",
        },
        questions: {
          harvest_now: {
            type: "noul",
            instructions:
              "Should a UK commercial-finance broker spend a Firecrawl pass hunting a director mailbox now? Yes only for a trading SME. No for charity, public body, holding/SPV. A Together/Glenhawk/MFS/Roma/LendInvest property or bridging charge alone is not a reason to say yes — only say yes if there is also a high-interest business lender (Iwoca, YouLend, Liberis, Capify, Funding Circle, Fleximize, Boost, 365).",
          },
          sme_borrower: {
            type: "score",
            instructions:
              "How likely is this a trading SME that might refinance expensive working-capital debt? Property/bridging-only charges (Together etc.) score low unless a business-loan lender is also listed.",
            criteria: [
              "Almost certainly not (charity, public, dormant shell, property-only)",
              "Probably not",
              "Unclear",
              "Probably a trading SME",
              "Almost certainly a trading SME with expensive business lending to refinance",
            ],
          },
          skip_class: {
            type: "choice",
            instructions: "Pick the best class for harvest priority.",
            criteria: {
              charge_sme:
                "Trading SME with high-interest business lending (Iwoca, YouLend, Liberis, Capify, Funding Circle, etc.). Together/property bridging alone is not this class.",
              ok_sme: "Trading SME, harvest mailbox",
              charity_public: "Charity, church, CIC, council, NHS, education, public body",
              holding_spv: "Holding company, property/estates SPV, investment vehicle",
              unsure: "Not enough to classify, including Together/property charge with no business-loan charge",
            },
          },
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { harvestNow: true, smeBorrower: 1, skipClass: "unsure" };
    const payload = await res.json();
    return parseJevHarvestAnswers(payload?.answers || payload);
  } catch {
    return { harvestNow: true, smeBorrower: 1, skipClass: "unsure" };
  }
}
