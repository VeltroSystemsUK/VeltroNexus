import ExcelJS from "exceljs";

export function isSpreadsheetFile(fileName: string, fileType?: string | null): boolean {
  const name = String(fileName || "").toLowerCase();
  const type = String(fileType || "").toLowerCase();
  return (
    name.endsWith(".xlsx") ||
    name.endsWith(".xlsm") ||
    name.endsWith(".csv") ||
    type.includes("spreadsheet") ||
    type.includes("excel") ||
    type.includes("csv")
  );
}

function cellText(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const record = value as { text?: unknown; result?: unknown; richText?: Array<{ text?: string }> };
    if (typeof record.text === "string") return record.text;
    if (Array.isArray(record.richText)) return record.richText.map((part) => part.text || "").join("");
    if ("result" in record) return cellText(record.result);
  }
  return String(value);
}

export async function extractSpreadsheetText(data: Buffer | Uint8Array, fileName: string): Promise<string> {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const name = String(fileName || "").toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    return buffer.toString("utf8").replace(/^\uFEFF/, "").trim();
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const lines: string[] = [];
  for (const sheet of workbook.worksheets) {
    lines.push(`=== SHEET ${sheet.name} ===`);
    sheet.eachRow((row) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      const cells = values.map(cellText);
      if (cells.some((cell) => cell !== "")) lines.push(cells.join("\t"));
    });
  }
  return lines.join("\n").trim();
}
