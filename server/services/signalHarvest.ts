import { companiesHouseClient } from "../utils/companiesHouseClient";
import {
  getGazetteNoticeLinkedData,
  noticeIdFromEntry,
  searchGazetteNotices,
} from "../utils/gazetteClient";
import {
  extractCompanyNumber,
  isHmrcPetitioner,
  mentionsHmrcPressure,
  type HmrcMarker,
} from "@shared/distressSignals";

export type PublicSignals = {
  hmrcTtp: boolean;
  hmrcMarkers: HmrcMarker[];
};

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function flattenText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(flattenText).join(" ");
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map(flattenText).join(" ");
  }
  return "";
}

function companyFromLinkedData(topic: any): { number?: string; name?: string } {
  const about = topic?.isAbout || topic;
  const company = about?.company || topic?.company;
  if (!company || typeof company !== "object") return {};
  return {
    number: String(company.companyNumber || extractCompanyNumber(flattenText(company)) || "").toUpperCase() || undefined,
    name: company.organisationName || company.name,
  };
}

function petitionerFromLinkedData(topic: any): string {
  const about = topic?.isAbout || topic;
  return flattenText(about?.petitioner || topic?.petitioner);
}

function isoFromGazetteDate(value: unknown): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function petitionExtrasFromLinkedData(topic: any): Pick<HmrcMarker, "hearingAt" | "presentedAt" | "caseNumber"> {
  const about = topic?.isAbout || topic;
  return {
    hearingAt: isoFromGazetteDate(about?.dateOfHearing || topic?.dateOfHearing),
    presentedAt: isoFromGazetteDate(about?.dateOfPetitionPresentation || topic?.dateOfPetitionPresentation),
    caseNumber: about?.hasCourtCase?.caseNumber || topic?.hasCourtCase?.caseNumber,
  };
}

export async function harvestHmrcPetitions(options?: {
  days?: number;
  limit?: number;
}): Promise<HmrcMarker[]> {
  const days = options?.days ?? 21;
  const limit = options?.limit ?? 30;
  const { entries } = await searchGazetteNotices({
    service: "insolvency",
    noticeType: "2450",
    text: "Revenue",
    startPublishDate: isoDaysAgo(days),
    pageSize: Math.min(limit, 20),
  });

  const markers: HmrcMarker[] = [];
  for (const entry of entries) {
    if (markers.length >= limit) break;
    const noticeId = noticeIdFromEntry(entry);
    let companyNumber: string | undefined;
    let companyName = entry.title;
    let petitioner = "";
    let publishedAt = entry.published || new Date().toISOString();
    let extras: Pick<HmrcMarker, "hearingAt" | "presentedAt" | "caseNumber"> = {};

    if (noticeId) {
      try {
        const linked = await getGazetteNoticeLinkedData(noticeId);
        const topic = linked?.result?.primaryTopic;
        const company = companyFromLinkedData(topic);
        companyNumber = company.number;
        companyName = company.name || companyName;
        petitioner = petitionerFromLinkedData(topic);
        publishedAt = topic?.hasPublicationDate || publishedAt;
        extras = petitionExtrasFromLinkedData(topic);
      } catch (error) {
        console.warn(`[SignalHarvest] Gazette notice ${noticeId} linked-data failed:`, error);
      }
    }

    const blob = [petitioner, entry.content, entry.title].filter(Boolean).join(" ");
    if (!isHmrcPetitioner(blob) && !mentionsHmrcPressure(blob)) continue;
    if (!companyNumber) companyNumber = extractCompanyNumber(blob);

    const hearingNote = extras.hearingAt
      ? ` Hearing listed ${new Date(extras.hearingAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`
      : "";
    markers.push({
      kind: "petition",
      publishedAt,
      source: noticeId ? `https://www.thegazette.co.uk/notice/${noticeId}` : "gazette:2450",
      note: `HMRC winding-up petition${companyName ? ` against ${companyName}` : ""}.${hearingNote}`,
      companyNumber,
      companyName,
      ...extras,
    });
  }

  return markers;
}

export async function harvestCompanySignals(
  companyNumber: string,
  companyName?: string
): Promise<PublicSignals> {
  const hmrcMarkers: HmrcMarker[] = [];

  try {
    const filings = await companiesHouseClient.getFilingHistory(companyNumber);
    for (const item of filings || []) {
      const text = [item.description, item.description_values && flattenText(item.description_values), item.type]
        .filter(Boolean)
        .join(" ");
      const date = item.date || new Date().toISOString();
      if (mentionsHmrcPressure(text) || (item.category === "gazette" && /wind/i.test(text))) {
        hmrcMarkers.push({
          kind: /petition/i.test(text) ? "petition" : "arrears",
          publishedAt: date,
          source: `companies-house:filing:${item.transaction_id || item.type || "unknown"}`,
          note: text.replace(/\s+/g, " ").trim().slice(0, 200),
          companyNumber,
          companyName,
        });
      }
    }
  } catch (error) {
    console.warn(`[SignalHarvest] Filing history failed for ${companyNumber}:`, error);
  }

  try {
    const insolvency = await companiesHouseClient.getCompanyInsolvency(companyNumber);
    const blob = flattenText(insolvency);
    if (mentionsHmrcPressure(blob) || /petition/i.test(blob)) {
      hmrcMarkers.push({
        kind: "petition",
        publishedAt: new Date().toISOString(),
        source: "companies-house:insolvency",
        note: "Insolvency case on the public file",
        companyNumber,
        companyName,
      });
    }
  } catch (error) {
    console.warn(`[SignalHarvest] Insolvency lookup failed for ${companyNumber}:`, error);
  }

  return {
    hmrcTtp: hmrcMarkers.length > 0,
    hmrcMarkers,
  };
}
