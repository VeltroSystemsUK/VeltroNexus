import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import {
  applyFindings,
  emptyForecast,
  parseWithExtract,
  pickCashflowDocument,
  readyToPrint,
  sanitizeForecastBullets,
  withoutFromSweep,
  type CashflowForecast,
} from "@shared/cashflowForecast";
import { buildProposal, proposalSourceFromFile } from "@shared/proposalFacts";
import { critiqueCashflowForecastJson, extractCashflowForecastJson } from "./geminiClient";
import { parsePdfBuffer } from "./pdfText";
import { getObjectStorage } from "./routerHelpers";
import { isSpreadsheetFile, extractSpreadsheetText } from "./spreadsheetText";
import type { ProspectReportData } from "./pdfGenerator";

async function loadStoredDocument(storagePath: string): Promise<Buffer | null> {
  try {
    if (existsSync(storagePath)) return await readFile(storagePath);
    const { data } = await getObjectStorage().downloadAsBytes(storagePath);
    return Buffer.from(data);
  } catch {
    return null;
  }
}

async function flattenDocument(fileName: string, buf: Buffer): Promise<string> {
  if (isSpreadsheetFile(fileName)) return extractSpreadsheetText(buf, fileName);
  if (/\.pdf$/i.test(fileName)) {
    const parsed = await parsePdfBuffer(buf);
    return parsed.text;
  }
  return buf.toString("utf8");
}

export async function ensureCashflowForecast(data: ProspectReportData): Promise<ProspectReportData> {
  const diligence = (data.dueDiligence?.data || {}) as Record<string, any>;
  const existing = diligence.cashflowForecast as CashflowForecast | undefined;
  if (readyToPrint(existing)) return data;

  const doc = pickCashflowDocument(data.documents || []);
  if (!doc?.storagePath && !doc?.fileName) return data;

  const source = {
    documentId: Number(doc.id || 0),
    fileName: String(doc.fileName || "cashflow"),
  };

  const buf = doc.storagePath ? await loadStoredDocument(doc.storagePath) : null;
  if (!buf) {
    const forecast = { ...emptyForecast(), source, extractable: false };
    return attach(data, forecast);
  }

  let flattened = "";
  try {
    flattened = await flattenDocument(source.fileName, buf);
  } catch {
    return attach(data, { ...emptyForecast(), source, extractable: false });
  }
  if (!flattened.trim()) {
    return attach(data, { ...emptyForecast(), source, extractable: false, flattenedText: flattened });
  }

  const sweep = (diligence.underwriting || {}).affordabilitySweep || {};
  const without = withoutFromSweep(sweep);
  const proposal = buildProposal(
    proposalSourceFromFile({ prospect: data.prospect, dueDiligence: data.dueDiligence }),
  );
  const ledgerMonthly = proposal.derived.monthlyRepayment;

  let parsed: ReturnType<typeof parseWithExtract> = null;
  try {
    parsed = parseWithExtract(await extractCashflowForecastJson(flattened));
  } catch {
    parsed = null;
  }
  if (!parsed) {
    return attach(data, {
      ...emptyForecast(),
      source,
      extractable: false,
      flattenedText: flattened,
      without,
    });
  }

  const findings = applyFindings({
    without,
    with: parsed.with,
    ledgerMonthly,
    ledgerAfterDscr: proposal.derived.dscrAfter,
    flattenedText: flattened,
  });

  let critique: string[] = [];
  try {
    critique = sanitizeForecastBullets(
      await critiqueCashflowForecastJson({
        without,
        with: parsed.with,
        findings,
        flattenedText: flattened,
      }),
    );
  } catch {
    critique = [];
  }

  const forecast: CashflowForecast = {
    source,
    confirmed: false,
    extractable: true,
    flattenedText: flattened.slice(0, 4000),
    without,
    with: parsed.with,
    months: parsed.months,
    findings,
    critique,
  };
  return attach(data, forecast);
}

function attach(data: ProspectReportData, forecast: CashflowForecast): ProspectReportData {
  const dueDiligence = data.dueDiligence || { data: {} };
  const nextData = { ...(dueDiligence.data || {}), cashflowForecast: forecast };
  return {
    ...data,
    dueDiligence: { ...dueDiligence, data: nextData } as ProspectReportData["dueDiligence"],
  };
}
