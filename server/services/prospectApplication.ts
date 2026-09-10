import crypto from "node:crypto";
import {
  applyApplicationSignature,
  isApplicationSigned,
  parseApplicationData,
  seedAnswersFromFile,
  seedDirectorFromContact,
  type ApplicationDataState,
  type ApplicationDirector,
  type LenderCode,
} from "@shared/applicationDataFields";
import { applyOnlineUrl } from "@shared/strataOutreach";
import { buildApplicationFormDocx } from "@shared/applicationFormDoc";
import { isSterlingLenderId } from "@shared/sterlingPortal";
import { storage } from "../storage";

export async function loadProspectApplication(prospectId: number): Promise<{
  prospect: NonNullable<Awaited<ReturnType<typeof storage.getProspectById>>>;
  data: ApplicationDataState;
}> {
  const prospect = await storage.getProspectById(prospectId);
  if (!prospect) throw Object.assign(new Error("Prospect not found"), { status: 404 });
  const dd = await storage.getDueDiligence(prospectId, prospect.userId);
  const saved = parseApplicationData((dd?.data as any)?.applicationData);
  const contacts = await storage.listContacts(prospectId, prospect.userId);
  const purpose = String(
    (dd?.data as any)?.underwriting?.loanDetails?.purpose ||
      (dd?.data as any)?.underwriting?.sfp?.fundingReason ||
      "",
  ).trim();
  const answers = seedAnswersFromFile(
    {
      companyName: prospect.company.companyName,
      companyNumber: prospect.company.companyNumber,
      registeredAddress: prospect.company.registeredAddress || undefined,
      postcode: prospect.company.postcode || undefined,
      website: prospect.company.website || undefined,
      natureOfBusiness: prospect.company.sicDescription || prospect.company.sicCode || undefined,
      legalEntityType: prospect.company.companyType || undefined,
      startDate: prospect.company.incorporationDate || undefined,
      loanAmount: prospect.loanAmount ? prospect.loanAmount / 100 : undefined,
      term: prospect.term,
      loanPurpose: purpose,
    },
    saved.answers,
  );
  const directors: ApplicationDirector[] =
    saved.directors.length > 0
      ? saved.directors
      : contacts.map((contact) => seedDirectorFromContact(contact));
  return { prospect, data: { ...saved, answers, directors } };
}

async function persist(prospectId: number, userId: string, data: ApplicationDataState) {
  const existing = await storage.getDueDiligence(prospectId, userId);
  const merged = { ...(existing?.data || {}), applicationData: data };
  await storage.upsertDueDiligence(prospectId, userId, merged as any);
  return data;
}

export async function saveProspectApplication(
  prospectId: number,
  patch: Partial<ApplicationDataState>,
): Promise<ApplicationDataState> {
  const { prospect, data } = await loadProspectApplication(prospectId);
  const next = parseApplicationData({
    ...data,
    ...patch,
    answers: { ...data.answers, ...(patch.answers || {}) },
    directors: patch.directors || data.directors,
  });
  return persist(prospectId, prospect.userId, next);
}

export async function sendProspectApplication(prospectId: number): Promise<{ url: string; data: ApplicationDataState }> {
  const { prospect, data } = await loadProspectApplication(prospectId);
  const token = data.token || crypto.randomBytes(24).toString("base64url");
  const next: ApplicationDataState = {
    ...data,
    token,
    status: data.status === "signed" ? "signed" : "sent",
    sentAt: data.sentAt || new Date().toISOString(),
  };
  await persist(prospectId, prospect.userId, next);
  const url = applyOnlineUrl(token);
  if (!url) throw Object.assign(new Error("Could not build the customer link"), { status: 500 });
  return { url, data: next };
}

export async function findApplicationByToken(token: string): Promise<{
  prospectId: number;
  userId: string;
  data: ApplicationDataState;
} | null> {
  if (!token) return null;
  const rows = await storage.getAllDueDiligenceSummaries("");
  for (const row of rows) {
    const data = parseApplicationData(row?.data?.applicationData);
    if (data.token === token) {
      return { prospectId: row.prospectId, userId: row.userId, data };
    }
  }
  return null;
}

export async function submitProspectApply(
  token: string,
  payload: {
    answers?: ApplicationDataState["answers"];
    directors?: ApplicationDirector[];
    sign?: { name: string; title?: string };
  },
  ip?: string,
): Promise<ApplicationDataState> {
  const found = await findApplicationByToken(token);
  if (!found) throw Object.assign(new Error("This application link is not valid."), { status: 404 });
  let next: ApplicationDataState = parseApplicationData({
    ...found.data,
    answers: { ...found.data.answers, ...(payload.answers || {}) },
    directors: payload.directors || found.data.directors,
    submittedAt: new Date().toISOString(),
    status: "partial",
  });
  if (payload.sign) {
    next = applyApplicationSignature(next, payload.sign, { at: new Date().toISOString(), ip });
  }
  return persist(found.prospectId, found.userId, next);
}

export async function prospectApplicationDocx(prospectId: number, lenderId: string): Promise<{ buffer: Buffer; filename: string }> {
  if (!isSterlingLenderId(lenderId)) {
    throw Object.assign(new Error("Choose a lender"), { status: 400 });
  }
  const { prospect, data } = await loadProspectApplication(prospectId);
  const buffer = await buildApplicationFormDocx(lenderId as LenderCode, {
    companyName: prospect.company.companyName,
    answers: data.answers,
    directors: data.directors,
    signedName: data.signedName,
    signedAt: data.signedAt,
  });
  const slug = (prospect.company.companyName || "application").replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 40);
  return { buffer, filename: `${slug}-${lenderId}-application.docx` };
}

export { isApplicationSigned };
