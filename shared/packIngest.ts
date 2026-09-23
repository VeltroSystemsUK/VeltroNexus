import { yearsFromAccountsText } from "./accountsAnalysisBuild";
import { packCategoryForAttachment } from "./sterlingCompleteness";
import type { SfpFigures } from "./sfp";

export type PackTextDoc = {
  fileName?: string;
  category?: string | null;
  text?: string;
};

export type PackFileRef = {
  fileName?: string;
  category?: string | null;
  fileType?: string | null;
  storagePath?: string;
};

export function mergePackFileDocs(primary: PackFileRef[] = [], extra: PackFileRef[] = []): PackFileRef[] {
  const out: PackFileRef[] = [];
  const seen = new Set<string>();
  for (const doc of [...primary, ...extra]) {
    const name = String(doc.fileName || "").trim().toLowerCase();
    if (name) {
      if (seen.has(name)) continue;
      seen.add(name);
    }
    out.push(doc);
  }
  return out;
}

const ACCOUNTS_NAME_RE = /account|profit|p\s*&\s*l|p&l/i;

function isAccountsDoc(doc: PackTextDoc): boolean {
  const mapped = packCategoryForAttachment(doc.category);
  if (mapped === "accounts" || mapped === "management-accounts") return true;
  if (String(doc.category || "") === "audited_accounts") return true;
  return ACCOUNTS_NAME_RE.test(String(doc.fileName || ""));
}

function sourced(value: number | null | undefined, source: string): { value: number; source: string } | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return { value, source };
}

export function extractSfpFiguresFromPackTexts(docs: PackTextDoc[]): SfpFigures {
  let chosen: { yearEnding: string; turnover?: { value: number; source: string }; profit?: { value: number; source: string } } | null =
    null;
  for (const doc of docs) {
    const text = String(doc.text || "");
    if (!text.trim()) continue;
    if (!isAccountsDoc(doc)) continue;
    const fileName = String(doc.fileName || "").trim() || "accounts";
    let years = yearsFromAccountsText(text, fileName);
    if (!years.length) years = yearsFromAccountsText(text, "accounts-2099-12-31.pdf");
    const year = years.find((row) => row.turnover != null || row.netProfit != null);
    if (!year) continue;
    const yearEnding = String(year.yearEnding || "");
    if (chosen && yearEnding && yearEnding < chosen.yearEnding) continue;
    chosen = {
      yearEnding: yearEnding || chosen?.yearEnding || "",
      turnover: sourced(year.turnover, fileName),
      profit: sourced(year.netProfit, fileName),
    };
  }
  const figures: SfpFigures = {};
  if (chosen?.turnover) figures.turnoverGbp = chosen.turnover;
  if (chosen?.profit) figures.netProfitGbp = chosen.profit;
  return figures;
}
