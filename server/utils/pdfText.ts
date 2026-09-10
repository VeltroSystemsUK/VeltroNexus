import { PDFParse } from "pdf-parse";

export type ParsedPdf = {
  text: string;
  pages: number;
};

export async function parsePdfBuffer(data: Buffer | Uint8Array): Promise<ParsedPdf> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length < 5 || String.fromCharCode(...bytes.subarray(0, 4)) !== "%PDF") {
    throw new Error("File is not a PDF");
  }
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    return {
      text: String(result.text || "").trim(),
      pages: Number(result.total || result.pages?.length || 0),
    };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
