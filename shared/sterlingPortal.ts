import { ATTACHMENT_ITEMS, resolveAttachmentsChecklist, type ResolvedAttachment } from "./attachmentsChecklist";

export const STERLING_LENDERS = [
  { id: "ffe", label: "Finance for Enterprise", sendLabel: "Send to FFE", logo: "/images/sterling-lenders/ffe.png" },
  { id: "cwrt", label: "CWRT", sendLabel: "Send to CWRT", logo: "/images/sterling-lenders/cwrt.png" },
  { id: "bcrs", label: "BCRS Business Loans", sendLabel: "Send to BCRS", logo: "/images/sterling-lenders/bcrs.png" },
  { id: "firstent", label: "First Enterprise", sendLabel: "Send to First Enterprise", logo: "/images/sterling-lenders/firstent.png" },
] as const;

export type SterlingLenderId = (typeof STERLING_LENDERS)[number]["id"];

export const STERLING_STATUSES = ["awaiting_recommendation", "returned", "sent"] as const;
export type SterlingStatus = (typeof STERLING_STATUSES)[number];

export type SterlingLenderDestination = {
  email: string;
  apiUrl: string;
  apiKey: string;
};

export type SterlingSettings = Record<SterlingLenderId, SterlingLenderDestination>;

export const STERLING_SETTINGS_KEY = "sterling_lender_destinations";

const STERLING_PORTAL_ROLES = ["external_broker", "super_admin", "sales_admin"] as const;
const STERLING_OVERSIGHT_ROLES = ["super_admin", "sales_admin"] as const;

export function isSterlingPortalRole(role?: string | null): boolean {
  return !!role && (STERLING_PORTAL_ROLES as readonly string[]).includes(role);
}

export function isSterlingOversightRole(role?: string | null): boolean {
  return !!role && (STERLING_OVERSIGHT_ROLES as readonly string[]).includes(role);
}

export function emptyDestination(): SterlingLenderDestination {
  return { email: "", apiUrl: "", apiKey: "" };
}

export function defaultSterlingSettings(): SterlingSettings {
  return {
    ffe: emptyDestination(),
    cwrt: emptyDestination(),
    bcrs: emptyDestination(),
    firstent: emptyDestination(),
  };
}

export function parseSterlingSettings(raw: unknown): SterlingSettings {
  const base = defaultSterlingSettings();
  if (!raw || typeof raw !== "object") return base;
  const rec = raw as Record<string, unknown>;
  for (const lender of STERLING_LENDERS) {
    const row = rec[lender.id];
    if (row && typeof row === "object") {
      const r = row as Record<string, unknown>;
      base[lender.id] = {
        email: typeof r.email === "string" ? r.email : "",
        apiUrl: typeof r.apiUrl === "string" ? r.apiUrl : "",
        apiKey: typeof r.apiKey === "string" ? r.apiKey : "",
      };
    }
  }
  return base;
}

export function isSterlingLenderId(value: string): value is SterlingLenderId {
  return STERLING_LENDERS.some((l) => l.id === value);
}

const DOC_HINTS: Array<{ test: RegExp; ids: string[] }> = [
  { test: /bank.?statement|open.?banking|accountscore/i, ids: ["bank-statements"] },
  { test: /statutory|audited|filed.?account|accounts/i, ids: ["accounts"] },
  { test: /management.?account/i, ids: ["management-accounts"] },
  { test: /business.?plan|proposal|cv/i, ids: ["business-plan"] },
  { test: /forecast|projection|cash.?flow|cff/i, ids: ["cashflow"] },
  { test: /passport|identity|id.?doc|driving.?licen/i, ids: ["id"] },
  { test: /proof.?of.?address|utility|council.?tax/i, ids: ["proof-of-address"] },
  { test: /insurance|indemnity/i, ids: ["insurance"] },
  { test: /debt.?schedule|facility|existing.?debt/i, ids: ["debt-schedule"] },
  { test: /hmrc|vat|time.?to.?pay/i, ids: ["hmrc"] },
  { test: /companies.?house|company.?search/i, ids: ["company-search"] },
  { test: /statement of assets|s.?a.?l|liabilit/i, ids: ["sal"] },
  { test: /use of funds|quote|invoice/i, ids: ["use-of-funds"] },
  { test: /application.?form/i, ids: ["application-form"] },
];

export function attachmentCategoryFromFilename(name: string): string {
  for (const hint of DOC_HINTS) {
    if (hint.test.test(name)) return hint.ids[0];
  }
  return "general";
}

export type SterlingSourceDoc = {
  id: number;
  fileName: string;
  category?: string | null;
};

export function attachmentsFromDocuments(docs: SterlingSourceDoc[]): ResolvedAttachment[] {
  const filesById = new Map<string, { id: number; fileName: string }[]>();
  for (const item of ATTACHMENT_ITEMS) filesById.set(item.id, []);

  for (const doc of docs) {
    const add = (id: string) => {
      const list = filesById.get(id);
      if (list && !list.some((f) => f.id === doc.id)) list.push({ id: doc.id, fileName: doc.fileName });
    };
    if (doc.category && filesById.has(doc.category)) add(doc.category);
    for (const hint of DOC_HINTS) {
      if (hint.test.test(doc.fileName) || (doc.category && hint.test.test(doc.category))) {
        hint.ids.forEach(add);
      }
    }
  }

  return ATTACHMENT_ITEMS.map((item) => {
    const files = filesById.get(item.id) || [];
    return { id: item.id, label: item.label, attached: files.length > 0, files };
  });
}

export function unmatchedSterlingDocuments(
  docs: SterlingSourceDoc[],
  items: ResolvedAttachment[],
): SterlingSourceDoc[] {
  const used = new Set(items.flatMap((item) => (item.files || []).map((f) => f.id)));
  return docs.filter((doc) => !used.has(doc.id));
}

export function attachmentsFromFilenames(names: string[], savedChecklist?: unknown): ResolvedAttachment[] {
  const fromTicks = resolveAttachmentsChecklist(savedChecklist);
  const found = new Set<string>();
  for (const name of names) {
    for (const hint of DOC_HINTS) {
      if (hint.test.test(name)) hint.ids.forEach((id) => found.add(id));
    }
  }
  return fromTicks.map((item) => ({
    ...item,
    attached: item.attached || found.has(item.id),
  }));
}

export function missingAttachments(items: ResolvedAttachment[]): ResolvedAttachment[] {
  return items.filter((item) => !item.attached);
}

export function sterlingPackLines(items: ResolvedAttachment[]): Array<{ label: string; ok: boolean }> {
  const fileCount = items.reduce((n, item) => n + (item.files?.length || (item.attached ? 1 : 0)), 0);
  const missing = items.filter((item) => !item.attached);
  return [
    { label: "Completed Loan Application", ok: true },
    { label: "Funding proposal stamped", ok: true },
    { label: `${fileCount} supporting files`, ok: fileCount > 0 },
    ...missing.map((item) => ({ label: item.label, ok: false })),
  ];
}

export const ATTACHMENT_CATALOGUE = ATTACHMENT_ITEMS;
