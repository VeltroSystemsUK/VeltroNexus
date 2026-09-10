import { describe, expect, it } from "vitest";
import PDFDocument from "pdfkit";
import { parsePdfBuffer } from "../../utils/pdfText";

function makePdf(text: string): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.font("Helvetica").fontSize(12).text(text);
    doc.end();
  });
}

describe("parsePdfBuffer", () => {
  it("extracts text and page count from a PDF", async () => {
    const pdf = await makePdf("DD IWOca LTD 1250.00 UNPAID - REFER TO PAYER");
    const parsed = await parsePdfBuffer(pdf);
    expect(parsed.pages).toBeGreaterThanOrEqual(1);
    expect(parsed.text).toMatch(/IWOca/i);
    expect(parsed.text).toMatch(/UNPAID/i);
  });
});
