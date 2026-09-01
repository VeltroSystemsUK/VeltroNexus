import { dealStream } from "@shared/salesOs";
import { countLiveNonBankCharges, isP0 } from "@shared/chargeClassifier";
import { rejectBeforeCharges } from "./strataFit";

export type ChargeLike = {
  status?: string | null;
  personsEntitled?: string[];
  createdOn?: string;
};

export type SmeHuntInput = {
  companyName: string;
  companyNumber: string;
  companyStatus?: string;
  companyStatusDetail?: string;
  dateOfCreation?: string;
  sicCodes?: string[];
  alreadyOnBook?: boolean;
  charges?: ChargeLike[];
  hasPetition?: boolean;
};

export type SmeHuntResult =
  | { ok: true; liveNonBankChargeCount: number }
  | { ok: false; reason: string };

export const GATED_SME_HUNT_HOLD = {
  hopper: "gated" as const,
  stage: "ingest" as const,
  status: "waiting_timer" as const,
};

export function shouldSendOutreachAfterSmeHunt(deal: { hopper?: string | null; source?: string }): boolean {
  if (deal.source === "strata_inbound") return true;
  return deal.hopper !== "gated";
}

function normCompanyNumber(value?: string | null): string {
  const raw = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!raw) return "";
  if (/^\d+$/.test(raw) && raw.length <= 8) return raw.padStart(8, "0");
  return raw;
}

function setHasCompanyNumber(set: Set<string>, companyNumber?: string): boolean {
  const raw = String(companyNumber || "").trim();
  if (raw && set.has(raw)) return true;
  const number = normCompanyNumber(companyNumber);
  if (!number) return false;
  if (set.has(number)) return true;
  for (const item of set) {
    if (normCompanyNumber(item) === number) return true;
  }
  return false;
}

export function shouldEnterSmeHunt(input: SmeHuntInput): SmeHuntResult {
  const early = rejectBeforeCharges({
    companyName: input.companyName,
    companyNumber: input.companyNumber,
    companyStatus: input.companyStatus,
    companyStatusDetail: input.companyStatusDetail,
    dateOfCreation: input.dateOfCreation,
    sicCodes: input.sicCodes,
    alreadyOnBook: input.alreadyOnBook,
  });
  if (early) return { ok: false, reason: early };

  const liveNonBankChargeCount = countLiveNonBankCharges(input.charges || []);
  if (!isP0({ hasPetition: input.hasPetition, liveNonBankChargeCount })) {
    return { ok: false, reason: "no P0 buying signal" };
  }
  return { ok: true, liveNonBankChargeCount };
}

export function isExcludedFromSmeHunt(
  deal: { source?: string; companyNumber?: string; email?: string },
  bookedNumbers: Set<string>,
  inboundNumbers: Set<string>,
  inboundEmails: Set<string>
): boolean {
  if (dealStream(deal.source) === "inbound") return true;
  if (setHasCompanyNumber(bookedNumbers, deal.companyNumber)) return true;
  if (setHasCompanyNumber(inboundNumbers, deal.companyNumber)) return true;
  const email = String(deal.email || "").trim().toLowerCase();
  if (email) {
    for (const item of inboundEmails) {
      if (String(item || "").trim().toLowerCase() === email) return true;
    }
  }
  return false;
}
