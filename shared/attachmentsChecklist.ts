/** Supporting documents confirmed on the file before submit to Sterling / a lender. */
export const ATTACHMENT_ITEMS = [
  { id: "accounts", label: "Last 3 years filed accounts (or management accounts if shorter trading)" },
  { id: "management-accounts", label: "Latest management accounts" },
  { id: "bank-statements", label: "Last 6 months business bank statements" },
  { id: "cashflow", label: "24-month cash flow forecast" },
  { id: "debt-schedule", label: "Debt schedule / existing facilities" },
  { id: "id", label: "Photo ID for all directors (passport or driving licence)" },
  { id: "proof-of-address", label: "Proof of address (utility bill, not a mobile bill)" },
  { id: "company-search", label: "Companies House search" },
  { id: "application-form", label: "Signed application form" },
  { id: "sal", label: "Personal statement of assets & liabilities (each director)" },
  { id: "use-of-funds", label: "Use of funds evidence (quotes, invoices, lender statements)" },
  { id: "hmrc", label: "HMRC / VAT correspondence (including Time to Pay if applicable)" },
  { id: "insurance", label: "Insurance certificates (PL, EL, PI as applicable)" },
  { id: "business-plan", label: "Business plan / director CVs" },
] as const;

export type AttachmentItemId = (typeof ATTACHMENT_ITEMS)[number]["id"];

export type AttachmentTick = {
  id: string;
  attached: boolean;
};

export type AttachmentFile = {
  id: number;
  fileName: string;
};

export type ResolvedAttachment = {
  id: string;
  label: string;
  attached: boolean;
  files?: AttachmentFile[];
};

export function resolveAttachmentsChecklist(saved: unknown): ResolvedAttachment[] {
  const map = new Map<string, boolean>();
  if (Array.isArray(saved)) {
    for (const row of saved) {
      if (row && typeof row === "object" && typeof (row as AttachmentTick).id === "string") {
        map.set((row as AttachmentTick).id, !!(row as AttachmentTick).attached);
      }
    }
  }
  return ATTACHMENT_ITEMS.map((item) => ({
    id: item.id,
    label: item.label,
    attached: map.get(item.id) === true,
  }));
}
