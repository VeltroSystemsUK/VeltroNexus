import { ATTACHMENT_ITEMS, type AttachmentItemId } from "./attachmentsChecklist";

export const REQUIRED_FOR_STERLING_SEND: AttachmentItemId[] = [
  "accounts",
  "bank-statements",
  "cashflow",
  "debt-schedule",
  "id",
  "company-search",
  "use-of-funds",
];

const LEGACY_CATEGORY: Record<string, AttachmentItemId | "other"> = {
  bank_statements: "bank-statements",
  audited_accounts: "accounts",
  other: "other",
};

export type PackDocRef = {
  fileName?: string;
  category?: string | null;
};

export type CompletenessItem = {
  id: AttachmentItemId;
  label: string;
};

export type CompletenessResult = {
  ok: boolean;
  missing: CompletenessItem[];
  present: CompletenessItem[];
};

export function packCategoryForAttachment(category?: string | null): AttachmentItemId | "other" {
  const raw = String(category || "").trim();
  if (!raw) return "other";
  if (raw in LEGACY_CATEGORY) return LEGACY_CATEGORY[raw];
  if (ATTACHMENT_ITEMS.some((item) => item.id === raw)) return raw as AttachmentItemId;
  return "other";
}

export function isPackUploadCategory(category: string): boolean {
  const mapped = packCategoryForAttachment(category);
  if (mapped === "other") return category === "other" || category === "other";
  return mapped !== "company-search";
}

function itemById(id: AttachmentItemId): CompletenessItem {
  const row = ATTACHMENT_ITEMS.find((item) => item.id === id)!;
  return { id: row.id, label: row.label };
}

export function requiredCustomerPackLabels(): string[] {
  return REQUIRED_FOR_STERLING_SEND.filter((id) => id !== "company-search").map(
    (id) => ATTACHMENT_ITEMS.find((item) => item.id === id)!.label
  );
}

function presentIds(input: {
  documents?: PackDocRef[];
  fundingReason?: string;
  companyNumber?: string | null;
}): Set<AttachmentItemId> {
  const found = new Set<AttachmentItemId>();
  for (const doc of input.documents || []) {
    const mapped = packCategoryForAttachment(doc.category);
    if (mapped !== "other") found.add(mapped);
    const name = String(doc.fileName || "");
    if (/bank.?statement/i.test(name)) found.add("bank-statements");
    if (/account/i.test(name) && !/bank/i.test(name)) found.add("accounts");
    if (/forecast|cash.?flow|cff/i.test(name)) found.add("cashflow");
    if (/debt|facilit/i.test(name)) found.add("debt-schedule");
    if (/passport|driving|licence|license|identity/i.test(name)) found.add("id");
  }
  if (String(input.fundingReason || "").trim()) found.add("use-of-funds");
  if (String(input.companyNumber || "").trim()) found.add("company-search");
  return found;
}

export function evaluateSterlingCompleteness(input: {
  documents?: PackDocRef[];
  fundingReason?: string;
  companyNumber?: string | null;
  sfpStatus?: "COMPLETE" | "PARTIAL" | null;
}): CompletenessResult {
  const found = presentIds(input);
  const present = REQUIRED_FOR_STERLING_SEND.filter((id) => found.has(id)).map(itemById);
  const missing = REQUIRED_FOR_STERLING_SEND.filter((id) => !found.has(id)).map(itemById);
  const docsOk = missing.length === 0;
  const sfpOk = input.sfpStatus === "COMPLETE";
  return { ok: docsOk && sfpOk, missing, present };
}

export function namedPackGaps(input: {
  documents?: PackDocRef[];
  fundingReason?: string;
  companyNumber?: string | null;
}): string[] {
  return evaluateSterlingCompleteness({ ...input, sfpStatus: "COMPLETE" }).missing.map((item) => item.label);
}
