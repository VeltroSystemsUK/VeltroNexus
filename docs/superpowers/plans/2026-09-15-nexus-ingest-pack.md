# Nexus ingest-from-pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deal Files ingest reads the pack files and writes sourced SFP figures. It must not underwrite from the event log, and it must not invent numbers.

**Architecture:** Pure `extractSfpFiguresFromPackTexts` turns accounts (and P&L-like) document text into `{ turnoverGbp, netProfitGbp }` with `source = fileName`, reusing `yearsFromAccountsText`. A server loader reads PDF/xlsx bytes into text. `onPackArrived` / `runProcessing` call that extract then `buildSfp`. Missing stays missing. No Gemini in this slice. No live APIs in CI.

**Tech Stack:** TypeScript, Vitest, existing `yearsFromAccountsText`, `parsePdfBuffer`, `extractSpreadsheetText`. No new npm packages.

**Spec:** `docs/superpowers/specs/2026-09-15-nexus-best-definition-design.md` (ingest from the pack; never invent a figure)

## Global Constraints

- Company: Veltro Ltd. OS: Nexus. Client: Sterling Commercial Finance Ltd t/a Strata Finance
- Numbers from the pack. Missing stays missing. Never invent
- Do not underwrite from the event log
- Do not call Gemini / Anthropic / Companies House in CI
- Do not delete Workforce, Learn, Craft, Veltro landing
- Do not commit unrelated Direct Outreach / Craft WIP
- Completeness + one-rail already exist — do not weaken them
- Windows PowerShell: `git commit -m "message"` (no bash heredocs)

This plan is **slice 5 only**. Names-true, one-rail, and zip completeness are done. Live-file (rung 1) is later.

## File map

- Create: `shared/packIngest.ts` — extract sourced figures from pack texts
- Create: `server/__tests__/shared/packIngest.test.ts`
- Create: `server/services/packIngest.ts` — read file bytes → text → `buildSfp`
- Create: `server/__tests__/services/packIngest.test.ts`
- Modify: `server/services/agenticWorkflow.ts` — `onPackArrived` / `runProcessing` use pack ingest, not `deal.sfp?.figures` / event log
- Create: `server/__tests__/services/packIngestProcessing.test.ts`
- Do not modify: geminiClient, Craft WIP, frozen desks

---

### Task 1: Pure extract from pack text

**Files:**
- Create: `shared/packIngest.ts`
- Create: `server/__tests__/shared/packIngest.test.ts`

**Interfaces:**
- Consumes: `yearsFromAccountsText` from `shared/accountsAnalysisBuild.ts`; `packCategoryForAttachment` from `shared/sterlingCompleteness.ts`; `SfpFigures` from `shared/sfp.ts`
- Produces:
  - `PackTextDoc = { fileName?: string; category?: string | null; text?: string }`
  - `extractSfpFiguresFromPackTexts(docs: PackTextDoc[]): SfpFigures`
    - Skip docs whose text is empty
    - Skip docs that are not accounts (category `accounts` / `audited_accounts` / `management-accounts`, or filename matching `/account|profit|p\\s*&\\s*l|p&l/i`)
    - For each remaining doc, `yearsFromAccountsText(text, fileName)`. If that returns `[]`, retry with fileName `"accounts-2099-12-31.pdf"` so a labelled Turnover line is not dropped only because the filename has no date
    - Use the first year that has `turnover != null` or `netProfit != null`
    - Set `turnoverGbp` / `netProfitGbp` only when the number is finite; `source` is the original `fileName` or `"accounts"`
    - Later accounts docs do not overwrite an earlier sourced figure
    - Event-log-shaped text (`Day 1 email`, `Director approved`, no Turnover label) yields `{}`

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/shared/packIngest.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extractSfpFiguresFromPackTexts } from "@shared/packIngest";

const PNL = `Profit & Loss
Home Crafters
Accounting Year 2023/24
Turnover 121,943
Gross Profit 66,479
Operating Profit £10,174
`;

describe("extractSfpFiguresFromPackTexts", () => {
  it("sources turnover and profit from an accounts P&L, tagged with the filename", () => {
    const figures = extractSfpFiguresFromPackTexts([
      {
        fileName: "Home Crafters yearly profit and loss 2023-03-01 to 2024-02-29.pdf",
        category: "accounts",
        text: PNL,
      },
    ]);
    expect(figures.turnoverGbp).toEqual({ value: 121943, source: "Home Crafters yearly profit and loss 2023-03-01 to 2024-02-29.pdf" });
    expect(figures.netProfitGbp).toEqual({ value: 10174, source: "Home Crafters yearly profit and loss 2023-03-01 to 2024-02-29.pdf" });
  });

  it("extracts labelled Turnover even when the filename has no date", () => {
    const figures = extractSfpFiguresFromPackTexts([
      { fileName: "statutory-accounts.pdf", category: "accounts", text: "Profit and Loss\nTurnover 800,000\nNet Profit 42,000\n" },
    ]);
    expect(figures.turnoverGbp?.value).toBe(800000);
    expect(figures.turnoverGbp?.source).toBe("statutory-accounts.pdf");
    expect(figures.netProfitGbp?.value).toBe(42000);
  });

  it("does not invent figures from the event log or from a guess", () => {
    expect(
      extractSfpFiguresFromPackTexts([
        {
          fileName: "events",
          category: "other",
          text: "Day 1 email to ops@acme.test. Director approved. Likely turnover around 800k.",
        },
      ]),
    ).toEqual({});
  });

  it("ignores bank statements even if they mention a payment amount", () => {
    expect(
      extractSfpFiguresFromPackTexts([
        { fileName: "june.pdf", category: "bank-statements", text: "Turnover is not a statement line\nDD 1,250.00 IWOca" },
      ]),
    ).toEqual({});
  });
});
```

Note: the bank-statement fixture includes the word Turnover as prose (`Turnover is not a statement line`). Category is `bank-statements`, so extract must skip the file entirely.

- [ ] **Step 2: Run — fail**

Run: `npx vitest run server/__tests__/shared/packIngest.test.ts`
Expected: FAIL — `@shared/packIngest` missing

- [ ] **Step 3: Minimal implementation**

Create `shared/packIngest.ts` implementing the interface above.

- [ ] **Step 4: Run — pass**

Run: `npx vitest run server/__tests__/shared/packIngest.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```
git add shared/packIngest.ts server/__tests__/shared/packIngest.test.ts
git commit -m "feat: extract SFP figures from pack accounts text"
```

---

### Task 2: Read pack files into text and build SFP

**Files:**
- Create: `server/services/packIngest.ts`
- Create: `server/__tests__/services/packIngest.test.ts`

**Interfaces:**
- Consumes: `extractSfpFiguresFromPackTexts`, `buildSfp`, `parsePdfBuffer`, `extractSpreadsheetText` / `isSpreadsheetFile`, `isPdfDocument`
- Produces:
  - `type PackFileDoc = { fileName?: string; category?: string | null; fileType?: string | null; storagePath?: string }`
  - `type PackBytesReader = (storagePath: string) => Promise<Buffer | null>`
  - `readPackDocumentTexts(docs: PackFileDoc[], readBytes?: PackBytesReader): Promise<Array<{ fileName: string; category: string | null; text: string }>>`
    - Skip docs with no storagePath
    - PDF (`isPdfDocument`) → `parsePdfBuffer`
    - Spreadsheet (`isSpreadsheetFile`) → `extractSpreadsheetText`
    - Else treat buffer as utf-8 text
    - Unreadable file → omit (do not invent)
  - `ingestSfpFromPack(input: { documents?: PackFileDoc[]; fundingReason?: string; companyNumber?: string | null }, deps?: { readBytes?: PackBytesReader }): Promise<StandardFinancialProfile>`
    - `texts = await readPackDocumentTexts(input.documents || [], deps?.readBytes)`
    - `extracted = extractSfpFiguresFromPackTexts(texts)`
    - `return buildSfp({ documents: input.documents, fundingReason, companyNumber, extracted })`
    - Must **not** pass event log or `deal.events`

Default `readBytes`: `fs.readFile` if the path exists, else `null`. Do not call object storage in the default path if `existsSync` is true (pack uploads write a local path). If the file is missing, return null.

- [ ] **Step 1: Write failing tests**

Create `server/__tests__/services/packIngest.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ingestSfpFromPack, readPackDocumentTexts } from "../../services/packIngest";

const PNL = `Profit & Loss
Turnover 121,943
Gross Profit 66,479
Operating Profit £10,174
`;

describe("readPackDocumentTexts", () => {
  it("uses the injected reader and skips missing files", async () => {
    const texts = await readPackDocumentTexts(
      [
        { fileName: "accounts.pdf", category: "accounts", fileType: "application/pdf", storagePath: "/tmp/missing.pdf" },
        { fileName: "notes.txt", category: "accounts", storagePath: "/tmp/notes.txt" },
      ],
      async (storagePath) => (storagePath.endsWith("notes.txt") ? Buffer.from(PNL, "utf8") : null),
    );
    expect(texts).toEqual([{ fileName: "notes.txt", category: "accounts", text: PNL }]);
  });
});

describe("ingestSfpFromPack", () => {
  const requiredDocs = [
    { fileName: "june.pdf", category: "bank-statements", storagePath: "/tmp/june.pdf" },
    { fileName: "accounts-2024.pdf", category: "accounts", storagePath: "/tmp/accounts.pdf" },
    { fileName: "cff.xlsx", category: "cashflow", storagePath: "/tmp/cff.xlsx" },
    { fileName: "debts.xlsx", category: "debt-schedule", storagePath: "/tmp/debts.xlsx" },
    { fileName: "passport.pdf", category: "id", storagePath: "/tmp/id.pdf" },
  ];

  it("is COMPLETE when the accounts file yields sourced figures", async () => {
    const sfp = await ingestSfpFromPack(
      { documents: requiredDocs, fundingReason: "Refinance stacked MCA", companyNumber: "12345678" },
      {
        readBytes: async (storagePath) =>
          storagePath.endsWith("accounts.pdf") ? Buffer.from(PNL, "utf8") : Buffer.from("x"),
      },
    );
    expect(sfp.status).toBe("COMPLETE");
    expect(sfp.figures.turnoverGbp).toEqual({ value: 121943, source: "accounts-2024.pdf" });
    expect(sfp.figures.netProfitGbp?.value).toBe(10174);
  });

  it("stays PARTIAL when the pack files have no labelled figures", async () => {
    const sfp = await ingestSfpFromPack(
      { documents: requiredDocs, fundingReason: "Refinance", companyNumber: "12345678" },
      { readBytes: async () => Buffer.from("no numbers here") },
    );
    expect(sfp.status).toBe("PARTIAL");
    expect(sfp.figures).toEqual({});
    expect(sfp.missing.some((item) => /sourced figures/i.test(item))).toBe(true);
  });
});
```

`readPackDocumentTexts` for `notes.txt` is not a PDF and not a spreadsheet, so utf-8 path must run. For `accounts-2024.pdf` in ingestSfpFromPack, the reader returns PNL bytes but the loader will try `parsePdfBuffer` because the name ends with `.pdf`. **That will fail or return empty.**

Fix the test design: either
- make the accounts test file a `.txt` with category accounts (loader uses utf-8), or
- have `readPackDocumentTexts` accept a `fileType` of `text/plain` to force utf-8 even on `.pdf` names, or
- in tests, pass `fileType: "text/plain"` on the accounts doc so it does not go through PDF parse.

**Use `fileType: "text/plain"` on the accounts fixture** in the COMPLETE test so CI does not need a real PDF. Production PDFs still go through `parsePdfBuffer`.

- [ ] **Step 2: Run — fail**

Run: `npx vitest run server/__tests__/services/packIngest.test.ts`
Expected: FAIL — module missing

- [ ] **Step 3: Implement `server/services/packIngest.ts`**

```ts
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extractSfpFiguresFromPackTexts } from "@shared/packIngest";
import { buildSfp, type StandardFinancialProfile } from "@shared/sfp";
import { isPdfDocument } from "../utils/prospectDocumentText";
import { parsePdfBuffer } from "../utils/pdfText";
import { extractSpreadsheetText, isSpreadsheetFile } from "../utils/spreadsheetText";

export type PackFileDoc = {
  fileName?: string;
  category?: string | null;
  fileType?: string | null;
  storagePath?: string;
};

export type PackBytesReader = (storagePath: string) => Promise<Buffer | null>;

async function defaultReadBytes(storagePath: string): Promise<Buffer | null> {
  if (!storagePath || !existsSync(storagePath)) return null;
  try {
    return await readFile(storagePath);
  } catch {
    return null;
  }
}

export async function readPackDocumentTexts(
  docs: PackFileDoc[],
  readBytes: PackBytesReader = defaultReadBytes,
): Promise<Array<{ fileName: string; category: string | null; text: string }>> {
  const out: Array<{ fileName: string; category: string | null; text: string }> = [];
  for (const doc of docs) {
    const storagePath = String(doc.storagePath || "");
    if (!storagePath) continue;
    const buf = await readBytes(storagePath);
    if (!buf || !buf.length) continue;
    const fileName = String(doc.fileName || "document");
    let text = "";
    try {
      if (isPdfDocument({ fileName, fileType: doc.fileType })) {
        text = (await parsePdfBuffer(buf)).text || "";
      } else if (isSpreadsheetFile(fileName, doc.fileType || undefined)) {
        text = (await extractSpreadsheetText(buf, fileName)) || "";
      } else {
        text = buf.toString("utf8");
      }
    } catch {
      continue;
    }
    if (!text.trim()) continue;
    out.push({ fileName, category: doc.category ?? null, text });
  }
  return out;
}

export async function ingestSfpFromPack(
  input: { documents?: PackFileDoc[]; fundingReason?: string; companyNumber?: string | null },
  deps?: { readBytes?: PackBytesReader },
): Promise<StandardFinancialProfile> {
  const documents = input.documents || [];
  const texts = await readPackDocumentTexts(documents, deps?.readBytes || defaultReadBytes);
  const extracted = extractSfpFiguresFromPackTexts(texts);
  return buildSfp({
    documents,
    fundingReason: input.fundingReason,
    companyNumber: input.companyNumber,
    extracted,
  });
}
```

- [ ] **Step 4: Run — pass**

Run: `npx vitest run server/__tests__/services/packIngest.test.ts server/__tests__/shared/packIngest.test.ts`
Expected: PASS. If the COMPLETE test fails because `isPdfDocument` treats `.pdf` name as PDF regardless of `fileType: "text/plain"`, change the fixture filename to `accounts-2024.txt` with `category: "accounts"` (extract still keys source to fileName). Prefer that if `isPdfDocument` is name-or-type.

- [ ] **Step 5: Commit**

```
git add server/services/packIngest.ts server/__tests__/services/packIngest.test.ts
git commit -m "feat: ingest SFP from pack file bytes"
```

---

### Task 3: Processing reads the pack

**Files:**
- Modify: `server/services/agenticWorkflow.ts` — `sfpFromDeal` / `onPackArrived` / `runProcessing`
- Create: `server/__tests__/services/packIngestProcessing.test.ts`

**Interfaces:**
- Consumes: `ingestSfpFromPack`
- Produces:
  - `onPackArrived` and `runProcessing` set `deal.sfp` from `ingestSfpFromPack({ documents: packDocuments, fundingReason, companyNumber })`
  - They do **not** pass `deal.events` or `deal.sfp?.figures` as extracted input
  - If ingest throws, catch, leave SFP PARTIAL with missing including the error is **wrong** — let it throw only for programmer errors. File read failures already return omitted docs.
  - Keep BBB gate and PARTIAL → chase behaviour
  - COMPLETE → existing `runUnderwriting` path

- [ ] **Step 1: Write failing tests**

Create `server/__tests__/services/packIngestProcessing.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../storage", () => ({
  storage: {
    getAgenticDeal: vi.fn(),
    updateAgenticDeal: vi.fn(),
    getProspectById: vi.fn(),
    upsertDueDiligence: vi.fn(),
  },
}));
vi.mock("../../services/packIngest", () => ({
  ingestSfpFromPack: vi.fn(),
}));

import { storage } from "../../storage";
import { ingestSfpFromPack } from "../../services/packIngest";
import { agenticWorkflow } from "../../services/agenticWorkflow";

const mockedStorage = storage as unknown as {
  getAgenticDeal: ReturnType<typeof vi.fn>;
  updateAgenticDeal: ReturnType<typeof vi.fn>;
  getProspectById: ReturnType<typeof vi.fn>;
  upsertDueDiligence: ReturnType<typeof vi.fn>;
};

const packDocuments = [
  { fileName: "june.pdf", category: "bank-statements", storagePath: "/tmp/june.pdf" },
  { fileName: "accounts-2024.pdf", category: "accounts", storagePath: "/tmp/accounts.pdf" },
  { fileName: "cff.xlsx", category: "cashflow", storagePath: "/tmp/cff.xlsx" },
  { fileName: "debts.xlsx", category: "debt-schedule", storagePath: "/tmp/debts.xlsx" },
  { fileName: "passport.pdf", category: "id", storagePath: "/tmp/id.pdf" },
];

function deal() {
  return {
    id: 88,
    prospectId: 42,
    ownerUserId: "shaun",
    stage: "fulfilment",
    status: "running",
    companyName: "Acme Joinery Limited",
    companyNumber: "12345678",
    fundingReason: "Stacked MCA refinance",
    packDocuments,
    events: [{ at: "2026-09-01T00:00:00.000Z", stage: "outreach", message: "Day 1 email. Invent turnover 999999." }],
    bbbEligibility: { status: "pass" },
    sfp: { status: "PARTIAL", missing: ["no sourced figures from the pack"], figures: {}, documents: [] },
  };
}

describe("processing ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedStorage.updateAgenticDeal.mockImplementation(async (id: number, patch: object) => ({
      ...deal(),
      id,
      ...patch,
    }));
    mockedStorage.getProspectById.mockResolvedValue(null);
    mockedStorage.upsertDueDiligence.mockResolvedValue({});
  });

  it("onPackArrived builds SFP from ingestSfpFromPack, not from the event log", async () => {
    mockedStorage.getAgenticDeal.mockResolvedValue(deal());
    vi.mocked(ingestSfpFromPack).mockResolvedValue({
      status: "PARTIAL",
      missing: ["no sourced figures from the pack"],
      documents: packDocuments,
      fundingReason: "Stacked MCA refinance",
      figures: {},
    });
    await agenticWorkflow.onPackArrived(88);
    expect(ingestSfpFromPack).toHaveBeenCalledWith(
      expect.objectContaining({
        documents: packDocuments,
        fundingReason: "Stacked MCA refinance",
        companyNumber: "12345678",
      }),
    );
    const arg = vi.mocked(ingestSfpFromPack).mock.calls[0][0] as { documents?: unknown; events?: unknown };
    expect(arg.events).toBeUndefined();
  });

  it("runProcessing underwrites from sourced pack figures", async () => {
    const complete = {
      status: "COMPLETE" as const,
      missing: [],
      documents: packDocuments,
      fundingReason: "Stacked MCA refinance",
      figures: {
        turnoverGbp: { value: 121943, source: "accounts-2024.pdf" },
        netProfitGbp: { value: 10174, source: "accounts-2024.pdf" },
      },
    };
    vi.mocked(ingestSfpFromPack).mockResolvedValue(complete);
    const updated = await agenticWorkflow.runProcessing(deal() as never);
    expect(ingestSfpFromPack).toHaveBeenCalled();
    expect(updated.sfp?.status).toBe("COMPLETE");
    expect(updated.sfp?.figures.turnoverGbp?.source).toBe("accounts-2024.pdf");
    expect(updated.stage).toBe("human_review");
    expect(JSON.stringify(updated.sfp?.figures)).not.toMatch(/999999/);
  });
});
```

`persistSfpOnProspect` may call storage — mock enough that it does not throw. If `runProcessing` hits BBB first, fixture `bbbEligibility.status = "pass"` is already set.

- [ ] **Step 2: Run — fail**

Run: `npx vitest run server/__tests__/services/packIngestProcessing.test.ts`
Expected: FAIL — `ingestSfpFromPack` not called; processing still uses `sfpFromDeal` without reading files

- [ ] **Step 3: Wire agenticWorkflow**

Import `ingestSfpFromPack` from `./packIngest`.

Replace `sfpFromDeal(deal)` in `onPackArrived` and `runProcessing` with:

```ts
const sfp = await ingestSfpFromPack({
  documents: deal.packDocuments || [],
  fundingReason: deal.fundingReason,
  companyNumber: deal.companyNumber,
});
```

In `runFulfilment` reprocess branch, pass the same packDocuments list into `ingestSfpFromPack` (after mapping pipeline docs onto pack shape if packDocuments is empty — keep that mapping, then ingest).

Do **not** pass `extracted: deal.sfp?.figures`.

Leave `sfpFromDeal` in the file if other callers use it; if only these three sites remain, delete `sfpFromDeal` in the same change.

- [ ] **Step 4: Run**

Run: `npx vitest run server/__tests__/services/packIngestProcessing.test.ts server/__tests__/services/packIngest.test.ts server/__tests__/shared/packIngest.test.ts server/__tests__/shared/sterlingCompleteness.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```
git add server/services/agenticWorkflow.ts server/__tests__/services/packIngestProcessing.test.ts
git commit -m "feat: Deal Files ingest reads the pack, not the event log"
```

---

## Self-review

- Spec “Numbers from the pack / missing stays missing / never invent” → Tasks 1–2
- Spec “ingest read the pack, not the deal log” → Task 3
- No Gemini in CI
- Completeness / one-rail untouched
- No deletion of frozen/costume desks
- Unrelated dirty WIP not staged
