import { isHighRateLender } from "../data/highRateCommercialLenders";
import { excludedSectorReason, isBrokerProspect, looksLikeIntroducer } from "@shared/salesOs";

export function isDistressHuntRow(row: {
  companyName: string;
  sicCodes?: string[];
  lenders?: string[];
  hmrc?: boolean;
}): boolean {
  if (isBrokerProspect(row.companyName, row.sicCodes)) return false;
  if (excludedSectorReason(row.sicCodes || [], row.companyName)) return false;
  if (row.hmrc) return true;
  if (looksLikeIntroducer(row.companyName, row.sicCodes)) return true;
  return (row.lenders || []).some((name) => Boolean(isHighRateLender(name)));
}
