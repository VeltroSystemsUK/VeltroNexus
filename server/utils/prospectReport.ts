import type { Response as ExpressResponse } from "express";
import { storage } from "../storage";
import { chFetch } from "./companiesHouseClient";
import type { ProspectWithCompany } from "@shared/schema";
import type { ProspectReportData } from "./pdfGenerator";
import { renderFundingProposalPdf } from "./fundingProposal";
import { encodeContentDisposition } from "./security";

function jsonIfOk(res: globalThis.Response | null): Promise<any | null> {
  if (!res || !res.ok) return Promise.resolve(null);
  return res.json().catch(() => null);
}

export async function fetchCompaniesHouseReportData(
  companyNumber?: string | null
): Promise<ProspectReportData["companiesHouseData"]> {
  if (!companyNumber || companyNumber.startsWith("UNREG-") || !process.env.COMPANIES_HOUSE_API_KEY) {
    return null;
  }

  try {
    const encoded = encodeURIComponent(companyNumber);
    const [profileRes, officersRes, pscRes, chargesRes] = await Promise.all([
      chFetch(`/company/${encoded}`).catch(() => null),
      chFetch(`/company/${encoded}/officers`).catch(() => null),
      chFetch(`/company/${encoded}/persons-with-significant-control`).catch(() => null),
      chFetch(`/company/${encoded}/charges`).catch(() => null),
    ]);

    const [profile, officers, psc, charges] = await Promise.all([
      jsonIfOk(profileRes),
      jsonIfOk(officersRes),
      jsonIfOk(pscRes),
      jsonIfOk(chargesRes),
    ]);

    if (!profile && !officers && !psc && !charges) return null;
    return { profile, officers, psc, charges };
  } catch (error) {
    console.error("Error fetching Companies House data for report:", error);
    return null;
  }
}

export async function buildProspectReportData(
  prospect: ProspectWithCompany,
  options: { layoutUserId?: string } = {}
): Promise<ProspectReportData> {
  const ownerId = prospect.userId;
  const prospectId = prospect.id!;
  const layoutUserId = options.layoutUserId || ownerId;

  const [contacts, activities, dueDiligence, layoutUser, companiesHouseData, documents, exceptions] =
    await Promise.all([
      storage.listContacts(prospectId, ownerId),
      storage.listActivities(prospectId, ownerId),
      storage.getDueDiligence(prospectId, ownerId).catch(() => null),
      storage.getUser(layoutUserId),
      fetchCompaniesHouseReportData(prospect.company?.companyNumber),
      storage.listProspectDocuments(prospectId, ownerId).catch(() => []),
      storage.listExceptionsForProspect(prospectId).catch(() => []),
    ]);

  return {
    prospect,
    contacts,
    activities,
    dueDiligence: dueDiligence || undefined,
    companiesHouseData,
    documents,
    exceptions,
    pdfLayoutPreferences: (layoutUser?.pdfLayoutPreferences as ProspectReportData["pdfLayoutPreferences"]) || null,
    user: layoutUser
      ? { firstName: layoutUser.firstName || "", lastName: layoutUser.lastName || "" }
      : null,
  };
}

export function reportFilename(companyName: string): string {
  const safe = (companyName || "Company").replace(/[^a-z0-9]/gi, "_");
  return `${safe}_Funding_Proposal_${new Date().toISOString().split("T")[0]}.pdf`;
}

export async function renderProspectReportToBuffer(data: ProspectReportData): Promise<Buffer> {
  return renderFundingProposalPdf(data);
}

export async function streamProspectReport(
  res: ExpressResponse,
  data: ProspectReportData,
  filename: string
): Promise<void> {
  const pdf = await renderFundingProposalPdf(data);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", encodeContentDisposition(filename));
  res.setHeader("Content-Length", String(pdf.length));
  res.end(pdf);
}
