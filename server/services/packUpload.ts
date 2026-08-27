import crypto from "crypto";
import type { AgenticDealFile, PackDocument, PackDocumentCategory } from "@shared/agenticWorkflow";
import { firstName } from "@shared/strataOutreach";
import { ATTACHMENT_ITEMS } from "@shared/attachmentsChecklist";
import { namedPackGaps, packCategoryForAttachment } from "@shared/sterlingCompleteness";
import { storage } from "../storage";

export const PACK_CATEGORIES: PackDocumentCategory[] = [
  "bank_statements",
  "audited_accounts",
  "other",
  ...ATTACHMENT_ITEMS.map((item) => item.id as PackDocumentCategory),
];

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".heic",
  ".webp",
  ".csv",
  ".xls",
  ".xlsx",
  ".doc",
  ".docx",
  ".zip",
]);

export type PublicPackFile = {
  id: string;
  category: PackDocumentCategory;
  fileName: string;
  uploadedAt: string;
};

export type PublicPackState = {
  companyName: string;
  contactFirstName: string;
  documents: PublicPackFile[];
  fundingReason: string;
  hasBankStatements: boolean;
  hasAuditedAccounts: boolean;
  hasReason: boolean;
  missingRequired: string[];
  requiredComplete: boolean;
};

export type IncomingPackFile = {
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
};

function nowIso() {
  return new Date().toISOString();
}

export function isPackCategory(value: string): value is PackDocumentCategory {
  if (PACK_CATEGORIES.includes(value as PackDocumentCategory)) return true;
  return packCategoryForAttachment(value) !== "other" || value === "other";
}

export function isAllowedPackFile(fileName: string, mimeType?: string): boolean {
  const ext = fileName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || "";
  if (ALLOWED_EXTENSIONS.has(ext)) return true;
  const mime = String(mimeType || "").toLowerCase();
  return (
    mime.startsWith("image/") ||
    mime === "application/pdf" ||
    mime === "application/zip" ||
    mime.includes("spreadsheet") ||
    mime.includes("msword") ||
    mime.includes("officedocument")
  );
}

function publicState(deal: AgenticDealFile): PublicPackState {
  const documents = deal.packDocuments || [];
  const fundingReason = String(deal.fundingReason || "").trim();
  const missingRequired = namedPackGaps({
    documents,
    fundingReason,
    companyNumber: deal.companyNumber,
  });
  const hasBankStatements = documents.some(
    (doc) => packCategoryForAttachment(doc.category) === "bank-statements"
  );
  const hasAuditedAccounts = documents.some(
    (doc) => packCategoryForAttachment(doc.category) === "accounts"
  );
  return {
    companyName: deal.companyName,
    contactFirstName: firstName(deal.contactName),
    documents: documents.map((doc) => ({
      id: doc.id,
      category: doc.category,
      fileName: doc.fileName,
      uploadedAt: doc.uploadedAt,
    })),
    fundingReason,
    hasBankStatements,
    hasAuditedAccounts,
    hasReason: fundingReason.length > 0,
    missingRequired,
    requiredComplete: missingRequired.length === 0,
  };
}

async function wakeIngest(dealId: number) {
  try {
    const { agenticWorkflow } = await import("./agenticWorkflow");
    await agenticWorkflow.onPackArrived(dealId);
  } catch (error: any) {
    console.warn("[Pack] Ingest wake failed:", error?.message || error);
  }
}

function addEvent(deal: AgenticDealFile, message: string) {
  return [
    ...(deal.events || []),
    { at: nowIso(), stage: deal.stage, agent: "inbound-intake", message },
  ];
}

export async function getPublicPack(token: string): Promise<PublicPackState | null> {
  const deal = await storage.getAgenticDealByUploadToken(token);
  return deal ? publicState(deal) : null;
}

export async function savePackFiles(
  token: string,
  category: PackDocumentCategory,
  files: IncomingPackFile[]
): Promise<PublicPackState> {
  const deal = await storage.getAgenticDealByUploadToken(token);
  if (!deal) throw new Error("Upload link is not valid");
  if (files.length === 0) throw new Error("No files uploaded");

  const accepted = files.filter((file) => isAllowedPackFile(file.originalname, file.mimetype));
  if (accepted.length === 0) throw new Error("Please upload PDF, image, spreadsheet, or Word files");

  const canonical = packCategoryForAttachment(category);
  const storedCategory = (canonical === "other" ? category : canonical) as PackDocumentCategory;
  const added: PackDocument[] = accepted.map((file) => ({
    id: crypto.randomBytes(8).toString("hex"),
    category: storedCategory,
    fileName: file.originalname,
    fileSize: file.size,
    fileType: file.mimetype,
    storagePath: file.path,
    uploadedAt: nowIso(),
  }));

  if (deal.prospectId) {
    for (const file of accepted) {
      await storage.createProspectDocument({
        prospectId: deal.prospectId,
        userId: deal.ownerUserId,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        storagePath: file.path,
        category,
        notes: "Customer pack upload",
        status: "pending",
        uploadedAt: nowIso(),
      } as any);
    }
  }

  const packDocuments = [...(deal.packDocuments || []), ...added];
  const names = added.map((doc) => doc.fileName).join(", ");
  const updated = await storage.updateAgenticDeal(deal.id, {
    packDocuments,
    packReceivedAt: deal.packReceivedAt || nowIso(),
    events: addEvent(deal, `Customer uploaded ${added.length} ${storedCategory.replace(/_/g, " ")} file(s): ${names}`),
  });
  await wakeIngest(updated.id);
  const fresh = await storage.getAgenticDeal(updated.id);
  return publicState(fresh || updated);
}

export async function saveFundingReason(token: string, reason: string): Promise<PublicPackState> {
  const deal = await storage.getAgenticDealByUploadToken(token);
  if (!deal) throw new Error("Upload link is not valid");
  const fundingReason = reason.trim().slice(0, 4000);
  if (!fundingReason) throw new Error("Please say why the funding or refinance is needed");

  const updated = await storage.updateAgenticDeal(deal.id, {
    fundingReason,
    events: addEvent(deal, "Customer confirmed why funding / refinance is needed"),
  });
  await wakeIngest(updated.id);
  const fresh = await storage.getAgenticDeal(updated.id);
  return publicState(fresh || updated);
}
