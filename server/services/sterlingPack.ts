import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import {
  assertProposalReady,
  buildProposal,
  ProposalNotReadyError,
  proposalSourceFromFile,
} from "@shared/proposalFacts";
import { storage } from "../storage";
import { getObjectStorage } from "../utils/routerHelpers";
import { buildProspectReportData } from "../utils/prospectReport";
import { renderFundingProposalHtmlFromData, renderFundingProposalPdf } from "../utils/fundingProposal";
import { buildStrataPayload } from "./strataPayload";
import {
  attachmentsFromDocuments,
  isSterlingLenderId,
  missingAttachments,
  sterlingPackLines,
  unmatchedSterlingDocuments,
  type SterlingLenderId,
} from "@shared/sterlingPortal";
import type { DueDiligenceData } from "@shared/schema";
import { unwrapDueDiligence } from "@shared/dueDiligence";
import { handoverPackHtml, resolveHandoverPack } from "@shared/handoverPack";
import { evaluateSterlingCompleteness } from "@shared/sterlingCompleteness";

const TEMPLATE_ROOT = path.resolve(process.cwd(), "server", "templates", "sterling");

export function sterlingTemplateDir(lenderId: SterlingLenderId) {
  return path.join(TEMPLATE_ROOT, lenderId);
}

export async function loadSterlingFileContext(handoff: { prospectId: number; submissionId?: number }) {
  const prospect = await storage.getProspectById(handoff.prospectId);
  if (!prospect) throw new Error("Prospect not found");
  const [contacts, diligence, documents, exceptions] = await Promise.all([
    storage.listContacts(handoff.prospectId, prospect.userId),
    storage.getDueDiligence(handoff.prospectId, prospect.userId),
    storage.listProspectDocuments(handoff.prospectId, prospect.userId),
    storage.listExceptionsForProspect(handoff.prospectId),
  ]);
  const dd = unwrapDueDiligence(diligence?.data || diligence) as DueDiligenceData;
  const attachments = attachmentsFromDocuments(documents);
  const handover = resolveHandoverPack(dd.checklist);
  const loan =
    dd.underwriting?.loanDetails?.amount ||
    (prospect.loanAmount ? prospect.loanAmount / 100 : undefined);
  return {
    prospect,
    contacts,
    diligence: dd,
    documents,
    exceptions,
    attachments,
    missing: missingAttachments(attachments),
    otherDocuments: unmatchedSterlingDocuments(documents, attachments),
    handover,
    packLines: [
      ...sterlingPackLines(attachments),
      {
        label: `Handover pack · ${handover.answered} of ${handover.total} answered`,
        ok: handover.answered > 0,
      },
    ],
    loanAmount: loan,
    term: prospect.term,
    payload: buildStrataPayload({
      prospect,
      contacts,
      diligence: dd,
      documents,
      exceptions,
      submissionId: handoff.submissionId,
    }),
  };
}

export async function readStoredFile(storagePath: string): Promise<Buffer | null> {
  try {
    if (existsSync(storagePath)) return await readFile(storagePath);
    const { data } = await getObjectStorage().downloadAsBytes(storagePath);
    return Buffer.from(data);
  } catch {
    return null;
  }
}

export async function buildSterlingPackZip(opts: {
  handoff: any;
  lenderId: string;
  signedBy?: string;
}): Promise<{ buffer: Buffer; filename: string }> {
  if (!isSterlingLenderId(opts.lenderId)) {
    throw Object.assign(new Error("Unknown lender"), { status: 400 });
  }
  const rec = String(opts.handoff.recommendation || "").trim();
  if (!rec) {
    throw Object.assign(new Error("Write a recommendation before sending"), { status: 400 });
  }

  const ctx = await loadSterlingFileContext(opts.handoff);
  const sfpStatus = (ctx.diligence as any)?.underwriting?.sfp?.status || "PARTIAL";
  const gate = evaluateSterlingCompleteness({
    documents: ctx.documents,
    fundingReason:
      (ctx.diligence as any)?.underwriting?.sfp?.fundingReason ||
      (ctx.prospect as any)?.fundingReason,
    companyNumber: ctx.prospect.company?.companyNumber,
    sfpStatus,
  });
  if (!gate.ok) {
    throw Object.assign(
      new Error(`File is not complete for Sterling: ${gate.missing.map((item) => item.label).join("; ")}`),
      { status: 400 }
    );
  }

  try {
    assertProposalReady(
      buildProposal(
        proposalSourceFromFile({
          prospect: ctx.prospect,
          dueDiligence: { data: ctx.diligence },
        }),
      ),
    );
  } catch (error) {
    if (error instanceof ProposalNotReadyError) {
      throw Object.assign(new Error(error.message), { status: 400 });
    }
    throw error;
  }

  const reportData = await buildProspectReportData(ctx.prospect, { layoutUserId: ctx.prospect.userId });
  const pdf = await renderFundingProposalPdf({
    ...reportData,
    hideAdviserRecommendation: true,
    sterlingRecommendation: rec,
    sterlingSignedBy: opts.signedBy,
  });

  const zip = new JSZip();
  const slug = (ctx.prospect.company.companyName || "file").replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 40);
  zip.file(`Funding_Proposal_${slug}.pdf`, pdf);

  const templateDir = sterlingTemplateDir(opts.lenderId);
  if (existsSync(templateDir)) {
    const files = await readdir(templateDir);
    for (const name of files) {
      const full = path.join(templateDir, name);
      zip.file(`application/${name}`, await readFile(full));
    }
  }

  for (const doc of ctx.documents) {
    const buf = await readStoredFile(doc.storagePath);
    if (buf) zip.file(`supporting/${doc.fileName}`, buf);
  }

  zip.file(
    "Handover_Pack.html",
    handoverPackHtml(ctx.handover, { companyName: ctx.prospect.company.companyName || "File" }),
  );
  zip.file("recommendation.txt", rec);
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return { buffer, filename: `${slug}-${opts.lenderId}-pack.zip` };
}

export function sterlingReportHtml(reportData: Parameters<typeof renderFundingProposalHtmlFromData>[0]) {
  return renderFundingProposalHtmlFromData({ ...reportData, hideAdviserRecommendation: true });
}
