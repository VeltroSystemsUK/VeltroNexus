import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../utils/geminiClient", () => ({
  extractCashflowForecastJson: vi.fn(async () => ({
    creditsAvg: 20000,
    opexAvg: 14000,
    debtServiceAvg: 3050,
    netAvg: 2950,
  })),
  critiqueCashflowForecastJson: vi.fn(async () => [
    "Credits in the sheet sit above the statement run-rate.",
  ]),
}));

import { ensureCashflowForecast } from "../../utils/cashflowForecastPrepare";

const written: string[] = [];

afterEach(() => {
  for (const file of written.splice(0)) {
    fs.rmSync(file, { force: true });
  }
});

async function writeKeyedXlsx(key: string): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Forecast");
  sheet.addRow(["Month", "Credits"]);
  sheet.addRow(["Sep-26", 16000]);
  const abs = path.resolve(process.cwd(), "uploads", key);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  await workbook.xlsx.writeFile(abs);
  written.push(abs);
  return abs;
}

describe("ensureCashflowForecast", () => {
  it("reads a cashflow xlsx stored as an uploads key, not a raw filesystem path", async () => {
    const key = `.private/test-cff/${Date.now()}_cashflow.xlsx`;
    await writeKeyedXlsx(key);

    expect(fs.existsSync(key)).toBe(false);

    const out = await ensureCashflowForecast({
      prospect: { id: 85, company: { name: "THE HOME CRAFTERS LTD" } },
      documents: [
        {
          id: 21,
          fileName: "Home_Crafters_24_Month_Cash_Flow_Forecast_STRATA.xlsx",
          category: "cashflow",
          storagePath: key,
        },
      ],
      dueDiligence: { data: {} },
    } as any);

    const forecast = (out.dueDiligence as any).data.cashflowForecast;
    expect(forecast.extractable).toBe(true);
    expect(forecast.with.creditsAvg).toBe(20000);
    expect(String(forecast.flattenedText || "")).toMatch(/16000|Sep-26/);
  });
});
