import { yearsFromAccountsText } from "./accountsAnalysisBuild";
import { packCategoryForAttachment } from "./sterlingCompleteness";
import type { SfpFigures } from "./sfp";

export type PackTextDoc = {
  fileName?: string;
  category?: string | null;
  text?: string;
};

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
  const figures: SfpFigures = {};
  for (const doc of docs) {
    const text = String(doc.text || "");
    if (!text.trim()) continue;
    if (!isAccountsDoc(doc)) continue;
    const fileName = String(doc.fileName || "").trim() || "accounts";
    let years = yearsFromAccountsText(text, fileName);
    if (!years.length) years = yearsFromAccountsText(text, "accounts-2099-12-31.pdf");
    const year = years.find((row) => row.turnover != null || row.netProfit != null);
    if (!year) continue;
    const source = fileName;
    if (!figures.turnoverGbp) {
      const turnover = sourced(year.turnover, source);
      if (turnover) figures.turnoverGbp = turnover;
    }
    if (!figures.netProfitGbp) {
      const profit = sourced(year.netProfit, source);
      if (profit) figures.netProfitGbp = profit;
    }
  }
  return figures;
}
