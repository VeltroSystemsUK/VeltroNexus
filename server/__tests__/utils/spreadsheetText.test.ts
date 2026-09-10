import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  extractSpreadsheetText,
  isSpreadsheetFile,
} from "../../utils/spreadsheetText";

async function xlsxBuffer(rows: (string | number)[][], sheetName = "Forecast") {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("isSpreadsheetFile", () => {
  it("recognises Excel and CSV by name or type", () => {
    expect(isSpreadsheetFile("cashflow.xlsx")).toBe(true);
    expect(isSpreadsheetFile("book.xlsm")).toBe(true);
    expect(isSpreadsheetFile("txns.csv")).toBe(true);
    expect(isSpreadsheetFile("pack.pdf")).toBe(false);
    expect(isSpreadsheetFile("data.bin", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(true);
    expect(isSpreadsheetFile("data.bin", "text/csv")).toBe(true);
  });
});

describe("extractSpreadsheetText", () => {
  it("reads worksheet cells from an xlsx buffer", async () => {
    const data = await xlsxBuffer([
      ["Month", "Receipts", "Payments"],
      ["Mar 2026", 20201, 20953],
    ]);
    const text = await extractSpreadsheetText(data, "forecast.xlsx");
    expect(text).toMatch(/Forecast/);
    expect(text).toMatch(/Receipts/);
    expect(text).toMatch(/20201/);
    expect(text).toMatch(/20953/);
  });

  it("reads CSV as utf-8 table text", async () => {
    const text = await extractSpreadsheetText(
      Buffer.from("Date,Description,Money Out\n01 Mar 26,IWOCA,1100.50\n"),
      "bank.csv"
    );
    expect(text).toMatch(/IWOCA/);
    expect(text).toMatch(/1100\.50/);
  });
});
