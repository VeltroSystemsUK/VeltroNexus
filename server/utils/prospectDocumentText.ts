import { attachmentCategoryFromFilename } from "@shared/sterlingPortal";
import { packCategoryForAttachment } from "@shared/sterlingCompleteness";
import { getObjectStorage } from "./routerHelpers";
import { parsePdfBuffer } from "./pdfText";
import { extractSpreadsheetText, isSpreadsheetFile } from "./spreadsheetText";

export type ProspectDocRef = {
  id: number;
  fileName: string;
  fileType?: string | null;
  category?: string | null;
  storagePath: string;
};

export type ExtractedPdf = {
  id: number;
  fileName: string;
  text: string;
  pages: number;
};

export function documentPackCategory(doc: Pick<ProspectDocRef, "fileName" | "category">): string {
  const fromCategory = packCategoryForAttachment(doc.category);
  if (fromCategory !== "other") return fromCategory;
  const fromName = attachmentCategoryFromFilename(doc.fileName);
  if (fromName && fromName !== "general") return fromName;
  if (/statement/i.test(doc.fileName) && !/assets|liabilit|\bsal\b/i.test(doc.fileName)) {
    return "bank-statements";
  }
  return "other";
}

export function isPdfDocument(doc: Pick<ProspectDocRef, "fileName" | "fileType">): boolean {
  return (
    String(doc.fileType || "").includes("pdf") || String(doc.fileName || "").toLowerCase().endsWith(".pdf")
  );
}

export function isMcaRateDocument(doc: Pick<ProspectDocRef, "fileName" | "category">): boolean {
  const cat = documentPackCategory(doc);
  if (cat === "debt-schedule" || cat === "use-of-funds") return true;
  return /debt.?schedule|existing.?facilit|existing.?finance|facilit(?:y|ies)|merchant cash/i.test(
    doc.fileName || "",
  );
}

export async function pdfTextsFromDocuments(
  docs: ProspectDocRef[],
  kind: "bank-statements" | "accounts" | "mca-rates"
): Promise<ExtractedPdf[]> {
  const wanted = docs.filter((doc) => {
    if (!isPdfDocument(doc)) return false;
    return kind === "mca-rates" ? isMcaRateDocument(doc) : documentPackCategory(doc) === kind;
  });
  const out: ExtractedPdf[] = [];
  for (const doc of wanted) {
    try {
      const { data } = await getObjectStorage().downloadAsBytes(doc.storagePath);
      const parsed = await parsePdfBuffer(Buffer.from(data));
      if (parsed.text.length < 40) continue;
      out.push({
        id: doc.id,
        fileName: doc.fileName,
        text: parsed.text.slice(0, 40000),
        pages: parsed.pages,
      });
    } catch (error) {
      console.warn(`[pdf] could not read ${doc.fileName}:`, error);
    }
  }
  return out;
}

export type AccountPdf = ExtractedPdf & { data: Buffer };

export async function accountPdfsFromDocuments(docs: ProspectDocRef[]): Promise<AccountPdf[]> {
  const wanted = docs.filter((doc) => isPdfDocument(doc) && documentPackCategory(doc) === "accounts");
  const out: AccountPdf[] = [];
  for (const doc of wanted) {
    try {
      const { data } = await getObjectStorage().downloadAsBytes(doc.storagePath);
      const buffer = Buffer.from(data);
      const parsed = await parsePdfBuffer(buffer);
      out.push({
        id: doc.id,
        fileName: doc.fileName,
        text: parsed.text.slice(0, 40000),
        pages: parsed.pages,
        data: buffer,
      });
    } catch (error) {
      console.warn(`[pdf] could not read ${doc.fileName}:`, error);
    }
  }
  return out;
}

export async function spreadsheetTextsFromDocuments(
  docs: ProspectDocRef[]
): Promise<{ id: number; fileName: string; text: string }[]> {
  const wanted = docs.filter((doc) => isSpreadsheetFile(doc.fileName, doc.fileType));
  const out: { id: number; fileName: string; text: string }[] = [];
  for (const doc of wanted) {
    try {
      const { data } = await getObjectStorage().downloadAsBytes(doc.storagePath);
      const text = (await extractSpreadsheetText(Buffer.from(data), doc.fileName)).slice(0, 40000);
      if (text.length < 20) continue;
      out.push({ id: doc.id, fileName: doc.fileName, text });
    } catch (error) {
      console.warn(`[sheet] could not read ${doc.fileName}:`, error);
    }
  }
  return out;
}
