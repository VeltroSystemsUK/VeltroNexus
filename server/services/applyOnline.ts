import { firstName } from "@shared/strataOutreach";
import {
  emptyApplicationData,
  applyApplicationSignature,
  isApplicationDataComplete,
  missingRequiredDirectorFields,
  missingRequiredFields,
  type ApplicationAnswers,
  type ApplicationDataState,
  type ApplicationDirector,
} from "@shared/applicationDataFields";
import { storage } from "../storage";
import type { AgenticDealFile } from "@shared/agenticWorkflow";
import { missingInfoGaps } from "@shared/missingInfoEmail";
import { findApplicationByToken, loadProspectApplication, submitProspectApply } from "./prospectApplication";
import { isApplicationSigned } from "@shared/applicationDataFields";

export type PublicApplyState = {
  companyName: string;
  contactFirstName: string;
  status: ApplicationDataState["status"];
  answers: ApplicationAnswers;
  directors: ApplicationDirector[];
  missingDocLabels: string[];
  uploadToken?: string;
  signed?: boolean;
  signedName?: string;
  signedAt?: string;
};

/** Deal fields we already know — never make the customer retype these. */
function prefillFromDeal(deal: Pick<AgenticDealFile, "companyName" | "companyNumber" | "placeAddress" | "loanAmount" | "fundingReason" | "website">): ApplicationAnswers {
  const prefill: ApplicationAnswers = {};
  if (deal.companyName) prefill.legalName = deal.companyName;
  if (deal.companyNumber) prefill.companyNumber = deal.companyNumber;
  if (deal.placeAddress) prefill.tradingAddress = deal.placeAddress;
  if (deal.loanAmount != null) prefill.loanAmount = String(deal.loanAmount);
  if (deal.fundingReason) prefill.loanPurpose = deal.fundingReason;
  if (deal.website) prefill.website = deal.website;
  return prefill;
}

function publicState(deal: AgenticDealFile): PublicApplyState {
  const saved = deal.applicationData || emptyApplicationData();
  const answers = { ...prefillFromDeal(deal), ...saved.answers };
  return {
    companyName: deal.companyName,
    contactFirstName: firstName(deal.contactName),
    status: saved.status,
    answers,
    directors: saved.directors,
    missingDocLabels: missingInfoGaps(deal).missingDocLabels,
    uploadToken: deal.uploadToken,
    signed: isApplicationSigned(saved),
    signedName: saved.signedName,
    signedAt: saved.signedAt,
  };
}

export async function getPublicApply(token: string): Promise<PublicApplyState | null> {
  const deal = await storage.getAgenticDealByUploadToken(token);
  if (deal) return publicState(deal);
  const found = await findApplicationByToken(token);
  if (!found) return null;
  const { prospect, data } = await loadProspectApplication(found.prospectId);
  return {
    companyName: prospect.company.companyName,
    contactFirstName: firstName(data.directors[0]?.fullName || prospect.company.companyName),
    status: data.status,
    answers: data.answers,
    directors: data.directors,
    missingDocLabels: [],
    uploadToken: token,
    signed: isApplicationSigned(data),
    signedName: data.signedName,
    signedAt: data.signedAt,
  };
}

export async function submitPublicApply(
  token: string,
  payload: { answers: ApplicationAnswers; directors: ApplicationDirector[]; sign?: { name: string; title?: string } },
  ip?: string,
): Promise<PublicApplyState> {
  const deal = await storage.getAgenticDealByUploadToken(token);
  if (!deal) {
    await submitProspectApply(token, payload, ip);
    const state = await getPublicApply(token);
    if (!state) throw Object.assign(new Error("This application link is not valid."), { status: 404 });
    return state;
  }

  const answers: ApplicationAnswers = { ...(deal.applicationData?.answers || {}), ...(payload.answers || {}) };
  const directors: ApplicationDirector[] = Array.isArray(payload.directors) ? payload.directors : deal.applicationData?.directors || [];

  const complete = isApplicationDataComplete({ answers, directors });
  const hasSomething =
    Object.values(answers).some((v) => v && v.trim()) ||
    directors.some((d) => Object.entries(d).some(([k, v]) => k !== "id" && v && v.trim()));

  let applicationData: ApplicationDataState = {
    ...(deal.applicationData || emptyApplicationData()),
    status: complete ? "complete" : hasSomething ? "partial" : "not_sent",
    sentAt: deal.applicationData?.sentAt,
    submittedAt: new Date().toISOString(),
    answers,
    directors,
  };
  if (payload.sign) {
    applicationData = applyApplicationSignature(applicationData, payload.sign, {
      at: new Date().toISOString(),
      ip,
    });
  }
  const status = applicationData.status;

  const updated = await storage.updateAgenticDeal(deal.id, {
    applicationData,
    events: [
      ...(deal.events || []),
      {
        at: new Date().toISOString(),
        stage: deal.stage,
        agent: "inbound-intake",
        message:
          status === "complete"
            ? "Online application completed"
            : `Online application updated (${missingRequiredFields(answers).length + (missingRequiredDirectorFields(directors).noDirectors ? 1 : 0)} required field(s) still outstanding)`,
      },
    ],
  });
  return publicState(updated);
}
