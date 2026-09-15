import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extractSfpFiguresFromPackTexts } from "@shared/packIngest";
import { buildSfp, type StandardFinancialProfile } from "@shared/sfp";
import { isPdfDocument } from "../utils/prospectDocumentText";
import { parsePdfBuffer } from "../utils/pdfText";
import { extractSpreadsheetText, isSpreadsheetFile } from "../utils/spreadsheetText";

export type PackFileDoc = {
  fileName?: string;
  category?: string | null;
  fileType?: string | null;
  storagePath?: string;
};

export type PackBytesReader = (storagePath: string) => Promise<Buffer | null>;

async function defaultReadBytes(storagePath: string): Promise<Buffer | null> {
  if (!storagePath || !existsSync(storagePath)) return null;
  try {
    return await readFile(storagePath);
  } catch {
    return null;
  }
}

export async function readPackDocumentTexts(
  docs: PackFileDoc[],
  readBytes: PackBytesReader = defaultReadBytes,
): Promise<Array<{ fileName: string; category: string | null; text: string }>> {
  const out: Array<{ fileName: string; category: string | null; text: string }> = [];
  for (const doc of docs) {
    const storagePath = String(doc.storagePath || "");
    if (!storagePath) continue;
    const buf = await readBytes(storagePath);
    if (!buf || !buf.length) continue;
    const fileName = String(doc.fileName || "document");
    let text = "";
    try {
      if (isPdfDocument({ fileName, fileType: doc.fileType })) {
        text = (await parsePdfBuffer(buf)).text || "";
      } else if (isSpreadsheetFile(fileName, doc.fileType || undefined)) {
        text = (await extractSpreadsheetText(buf, fileName)) || "";
      } else {
        text = buf.toString("utf8");
      }
    } catch {
      continue;
    }
    if (!text.trim()) continue;
    out.push({ fileName, category: doc.category ?? null, text });
  }
  return out;
}

export async function ingestSfpFromPack(
  input: { documents?: PackFileDoc[]; fundingReason?: string; companyNumber?: string | null },
  deps?: { readBytes?: PackBytesReader },
): Promise<StandardFinancialProfile> {
  const documents = input.documents || [];
  const texts = await readPackDocumentTexts(documents, deps?.readBytes || defaultReadBytes);
  const extracted = extractSfpFiguresFromPackTexts(texts);
  return buildSfp({
    documents,
    fundingReason: input.fundingReason,
    companyNumber: input.companyNumber,
    extracted,
  });
}
