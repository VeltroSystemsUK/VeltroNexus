# Cashflow Forecast Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put a confirmed without-vs-with cashflow-forecast analysis into funding-proposal section 7, with rule-based findings, without blocking Generate Report when no forecast exists.

**Architecture:** A shared kernel builds the without-facility column from the bank sweep and stacked monthly, scores findings as injected bullets, and exposes `readyToPrint`. An extract route flattens the `cashflow` attachment and lets a model fill numbers only. Studio confirms the grid. The PDF prints that object once in section 7.

**Tech Stack:** TypeScript, Vitest, Express, React, existing `extractSpreadsheetText` / `parsePdfBuffer` / `generateJson`. No new npm packages. No new Excel parser.

**Spec:** `docs/superpowers/specs/2026-09-08-cashflow-forecast-analysis-design.md` (amends quality spec section 7)

## Global Constraints

- Evidence vs claim. Not an LLM essay. Not DSCR/Creditsafe tiles dumped into section 7.
- Without facility is always rebuilt from the last 6 months of statements plus current stacked finance. A second base-case workbook is not required.
- With facility is the customer forecast only (attachment id `cashflow`).
- One object on the diligence file. Financial Data tab runs and confirms. Generate Report copies it into section 7.
- A model may fill a numeric schema only. Missing field = `null`, not 0. PDF prints the confirmed grid, never the raw model dump.
- Findings are rules, then bullets (cap 8, 20 words). Numbers injected from the grid/ledger.
- Missing does not block Generate Report. Unconfirmed extract never reaches the PDF.
- Voice: no paragraphs; tables for figures; bullets for findings.
- No Nexus forecast template. No silent accept of an unconfirmed extract.
- Windows PowerShell: `git commit -m "message"` (no bash heredocs).
- Tests: `npx vitest run <file>`.

## File map

- Create: `shared/cashflowForecast.ts`
- Create: `server/__tests__/shared/cashflowForecast.test.ts`
- Modify: `shared/schema.ts` — `dueDiligence.data.cashflowForecast`
- Modify: `server/utils/geminiClient.ts` — `extractCashflowForecastJson`
- Modify: `server/routes/prospects.ts` — extract + confirm routes
- Modify: `server/utils/fundingProposal.ts` — section 7 body
- Modify: `server/__tests__/utils/fundingProposal.test.ts`
- Create: `client/src/components/CashflowForecastPanel.tsx`
- Modify: `client/src/pages/underwriting/FinancialsPage.tsx` — fourth tab
- Create: `server/__tests__/utils/geminiClientForecast.test.ts` (prompt source assertions)

---

### Task 1: Kernel — without-column, findings rules, readyToPrint

**Files:**
- Create: `shared/cashflowForecast.ts`
- Create: `server/__tests__/shared/cashflowForecast.test.ts`
- Modify: `shared/schema.ts` (add optional `cashflowForecast` on `dueDiligenceDataSchema`)

**Interfaces:**
- Consumes: nothing from later tasks. Sweep shape is `{ totals?: { avgIn?: number; avgOut?: number; avgNet?: number }; financeMonthly?: number; cashForDebt?: number }`.
- Produces:

```ts
export type ForecastColumn = {
  creditsAvg: number | null;
  opexAvg: number | null;
  debtServiceAvg: number | null;
  netAvg: number | null;
  dscr: number | null;
};

export type ForecastMonth = {
  label: string;
  credits: number | null;
  opex: number | null;
  debtService: number | null;
  net: number | null;
};

export type CashflowForecast = {
  source: { documentId: number; fileName: string } | null;
  confirmed: boolean;
  confirmedBy?: string;
  confirmedAt?: string;
  extractable?: boolean;
  flattenedText?: string;
  without: ForecastColumn;
  with: ForecastColumn;
  months?: ForecastMonth[];
  findings: string[];
};

export function emptyColumn(): ForecastColumn;
export function finishColumn(col: ForecastColumn): ForecastColumn; // fills netAvg and dscr; never 0 for missing
export function withoutFromSweep(sweep: {
  totals?: { avgIn?: number; avgOut?: number; avgNet?: number };
  financeMonthly?: number;
  cashForDebt?: number;
}): ForecastColumn;
export function parseWithExtract(raw: unknown): { with: ForecastColumn; months?: ForecastMonth[] } | null;
export function applyFindings(input: {
  without: ForecastColumn;
  with: ForecastColumn;
  ledgerMonthly: number | null;
  flattenedText: string;
}): string[];
export function readyToPrint(forecast: CashflowForecast | null | undefined): boolean;
export function emptyForecast(): CashflowForecast;
```

`finishColumn`: `netAvg` = credits − opex − debt when all three present, else leave net if already set, else null. `dscr` = (credits − opex) / debtService when credits, opex, and debtService are numbers and debtService > 0; else if `cashForDebt` path: not on the column. For without, `withoutFromSweep` sets credits=`avgIn`, debt=`financeMonthly`, opex=`avgOut - financeMonthly` when both numbers, net=`avgNet` if present else derived, dscr = (`cashForDebt` ?? credits−opex) / debt when debt > 0.

`parseWithExtract`: accept `{ creditsAvg, opexAvg, debtServiceAvg, netAvg, months? }`. Coerce with `Number`; non-finite → null; do not treat 0 as missing if the JSON actually sent 0 (0 is a valid number). If **every** of the four avgs is null and no month has a number → return `null` (not extractable). Cap months at 12.

`applyFindings` uses the spec table verbatim. `%` is `Math.round((with/without - 1) * 100)`. Money in bullets: `new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n)` so £3,047. DSCR in bullets: `x.toFixed(2) + "x"`. Cap 8. `debt_mismatch` when `with.debtServiceAvg != null` and `ledgerMonthly != null` and `Math.abs(with.debtServiceAvg - ledgerMonthly) > 1`. Tax tokens: `/vat|paye|hmrc|corporation tax|corp tax/i`. Drawings tokens: `/drawing|dividend|director/i`.

`readyToPrint`: `confirmed === true` and (`with.creditsAvg != null` || `with.netAvg != null`).

Do not store raw model completions.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  applyFindings,
  parseWithExtract,
  readyToPrint,
  withoutFromSweep,
  emptyForecast,
} from "@shared/cashflowForecast";

const sweep = {
  totals: { avgIn: 20200, avgOut: 20953, avgNet: -753 },
  financeMonthly: 5703,
  cashForDebt: 4951,
};

describe("withoutFromSweep", () => {
  it("rebuilds without-facility from statements and ignores a sheet base-case", () => {
    const without = withoutFromSweep(sweep);
    expect(without.creditsAvg).toBe(20200);
    expect(without.debtServiceAvg).toBe(5703);
    expect(without.opexAvg).toBe(20953 - 5703);
    expect(without.netAvg).toBe(-753);
    expect(without.dscr).toBeCloseTo(4951 / 5703, 2);
  });
});

describe("parseWithExtract", () => {
  it("keeps null rather than coercing blank to 0, and rejects all-null", () => {
    expect(parseWithExtract({ creditsAvg: "nope", opexAvg: null })).toBeNull();
    const parsed = parseWithExtract({ creditsAvg: 24000, opexAvg: 18000, debtServiceAvg: 3047, netAvg: 2953 });
    expect(parsed?.with.creditsAvg).toBe(24000);
    expect(parseWithExtract({})).toBeNull();
  });
});

describe("applyFindings", () => {
  const without = withoutFromSweep(sweep);
  it("fires sales_stepup at +15% and not at +10%", () => {
    const hot = applyFindings({
      without,
      with: { creditsAvg: 20200 * 1.16, opexAvg: 15250, debtServiceAvg: 3047, netAvg: 1000, dscr: 1.8 },
      ledgerMonthly: 3047,
      flattenedText: "VAT PAYE directors drawings",
    });
    expect(hot.some((line) => /above statement run-rate/.test(line))).toBe(true);
    const mild = applyFindings({
      without,
      with: { creditsAvg: 20200 * 1.1, opexAvg: 15250, debtServiceAvg: 3047, netAvg: 1000, dscr: 1.8 },
      ledgerMonthly: 3047,
      flattenedText: "VAT PAYE directors drawings",
    });
    expect(mild.some((line) => /above statement run-rate/.test(line))).toBe(false);
  });

  it("fires debt_mismatch when sheet monthly disagrees with the ledger", () => {
    const lines = applyFindings({
      without,
      with: { creditsAvg: 20200, opexAvg: 15250, debtServiceAvg: 2800, netAvg: 0, dscr: 1.3 },
      ledgerMonthly: 3047,
      flattenedText: "VAT PAYE drawings",
    });
    expect(lines.some((line) => /Forecast debt service/.test(line) && /3,047/.test(line))).toBe(true);
  });

  it("does not write working-notes", () => {
    const lines = applyFindings({
      without,
      with: { creditsAvg: 10000, opexAvg: 1000, debtServiceAvg: 3047, netAvg: 0, dscr: 1.0 },
      ledgerMonthly: 3047,
      flattenedText: "sales only",
    });
    expect(lines.join(" ").toLowerCase()).not.toContain("note on scope");
    expect(lines.join(" ").toLowerCase()).not.toContain("the document provided");
  });
});

describe("readyToPrint", () => {
  it("requires confirm and a with-number", () => {
    const blank = emptyForecast();
    expect(readyToPrint(blank)).toBe(false);
    expect(readyToPrint({ ...blank, confirmed: true, with: { ...blank.with, creditsAvg: 1 } })).toBe(true);
    expect(readyToPrint({ ...blank, confirmed: false, with: { ...blank.with, creditsAvg: 1 } })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/cashflowForecast.test.ts`

Expected: FAIL — module `@shared/cashflowForecast` not found.

- [ ] **Step 3: Write minimal implementation**

Implement the exports in `shared/cashflowForecast.ts` exactly as the tests require. Add to `dueDiligenceDataSchema`:

```ts
cashflowForecast: z.any().optional(),
```

(Keep the runtime type in `cashflowForecast.ts`; do not duplicate a huge zod tree in this task.)

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run server/__tests__/shared/cashflowForecast.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add shared/cashflowForecast.ts server/__tests__/shared/cashflowForecast.test.ts shared/schema.ts
git commit -m "feat: cashflow forecast without-column and findings rules"
```

---

### Task 2: Extract and confirm API

**Files:**
- Modify: `server/utils/geminiClient.ts` — add exported `extractCashflowForecastJson`
- Modify: `server/routes/prospects.ts` — two POST handlers after the sweep-statements route
- Create: `server/__tests__/utils/geminiClientForecast.test.ts`

**Interfaces:**
- Consumes: `parseWithExtract`, `withoutFromSweep`, `applyFindings`, `emptyForecast`, `finishColumn` from `@shared/cashflowForecast`. Documents via `storage.listProspectDocuments`. Flatten: `extractSpreadsheetText` / `spreadsheetTextsFromDocuments` and `parsePdfBuffer` for PDF. Sweep from `dueDiligence.data.underwriting.affordabilitySweep`. Ledger monthly from `underwriting.loanDetails.monthlyRepayment` if > 0, else `affordabilitySweep.proposedMonthly`.
- Produces:

```ts
export async function extractCashflowForecastJson(flatText: string): Promise<unknown>;
```

Prompt (verbatim intent):

```
Extract monthly-average figures from this cashflow forecast dump.
Return JSON only:
{"creditsAvg":null,"opexAvg":null,"debtServiceAvg":null,"netAvg":null,"months":[]}
Use JSON numbers. Use null when a figure is not clearly present. Never use 0 as a stand-in for unknown. No prose, no pound signs inside strings, no loan-amount commentary.
```

Routes (mount on the existing prospects router, same `isAuthenticated` as sweep):

`POST /prospects/:prospectId/underwriting/extract-cashflow-forecast`

Body: `{ documentId?: number, consentToAiProcessing?: boolean }`.

Steps: load documents; pick `documentId` if given, else the latest file whose category or name matches `/forecast|projection|cash.?flow|cff/i` or category `cashflow`. Flatten spreadsheet via `extractSpreadsheetText` after `getObjectStorage().downloadAsBytes`, or PDF via `parsePdfBuffer`. If no text → save `{ ...emptyForecast(), source, extractable: false, confirmed: false, flattenedText: "" }` and return 200 `{ forecast, extractable: false }`. Else call `extractCashflowForecastJson`, `parseWithExtract`; if null → `extractable: false`. Else set `with` from parse, `without` from `withoutFromSweep(sweep)`, `months` capped 12, `confirmed: false`, `findings: []`, `flattenedText` sliced to 20_000 chars, `extractable: true`. Upsert `dueDiligence.data.cashflowForecast`. Do not persist the raw model string.

`POST /prospects/:prospectId/underwriting/confirm-cashflow-forecast`

Body: `{ with: ForecastColumn, months?: ForecastMonth[] }`. Recompute `without` from current sweep (never from the body). Set `with` from body via `finishColumn`. `findings = applyFindings({ without, with, ledgerMonthly, flattenedText: stored.flattenedText || "" })`. `confirmed: true`, `confirmedBy` = `[req.user.firstName, req.user.lastName].filter(Boolean).join(" ")` or user id, `confirmedAt` = ISO now. Upsert. Return `{ forecast }`.

If no sweep yet, `withoutFromSweep({})` yields all-null without-column; findings that need without simply do not fire.

- [ ] **Step 1: Write the failing tests**

```ts
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("cashflow forecast extract wiring", () => {
  it("exports extractCashflowForecastJson and forbids prose in the prompt", () => {
    const src = fs.readFileSync(path.resolve("server/utils/geminiClient.ts"), "utf8");
    expect(src).toMatch(/export async function extractCashflowForecastJson/);
    expect(src).toMatch(/Never use 0 as a stand-in for unknown/);
    expect(src).toMatch(/No prose/);
  });

  it("registers extract and confirm routes", () => {
    const src = fs.readFileSync(path.resolve("server/routes/prospects.ts"), "utf8");
    expect(src).toMatch(/extract-cashflow-forecast/);
    expect(src).toMatch(/confirm-cashflow-forecast/);
    expect(src).toMatch(/confirmed: false/);
    expect(src).toMatch(/applyFindings/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/utils/geminiClientForecast.test.ts`

Expected: FAIL — strings not in source.

- [ ] **Step 3: Write minimal implementation**

Export `extractCashflowForecastJson` using the existing private `generateJson`. Add the two routes. Wrap extract in `wrapAiRequest` like other underwriting AI posts (operation `cashflow_forecast_extract`, `consentToAiProcessing` from body).

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run server/__tests__/utils/geminiClientForecast.test.ts server/__tests__/shared/cashflowForecast.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add server/utils/geminiClient.ts server/routes/prospects.ts server/__tests__/utils/geminiClientForecast.test.ts
git commit -m "feat: extract and confirm cashflow forecast on the file"
```

---

### Task 3: Print confirmed analysis in proposal section 7

**Files:**
- Modify: `server/utils/fundingProposal.ts` (`forecastBody` around the empty-state block; `buildFundingProposal` must pass the diligence `cashflowForecast`)
- Modify: `server/__tests__/utils/fundingProposal.test.ts`

**Interfaces:**
- Consumes: `readyToPrint`, `CashflowForecast` from `@shared/cashflowForecast`. `buildFundingProposal` already receives `data.dueDiligence`.
- Produces: section 7 HTML. When `readyToPrint(forecast)`: tiles (without vs with for credits, debt service, DSCR or net), a `table.fin` with rows Credits / Operating costs / Debt service / Net and two data columns, then findings as `<ul class="campari-points">` (or existing `ul.strengths`). When not ready: if `forecast?.source` and `forecast.extractable === false` → empty-state title `Forecast on file but not extractable`; else title `Forecasts not yet modelled` and body `Upload a 24-month cash flow forecast on Financial Data and confirm the grid. Figures are not projected automatically.` Remove the old “A 24-month cash flow / CFADS model will sit here…” copy. Do **not** render `forecastStats` Creditsafe/DSCR hero on this page. Do not render the confirmed grid in section 4.

Money display: existing `money()` in `fundingProposal.ts`. DSCR: `n.toFixed(2) + "x"` or `—`.

- [ ] **Step 1: Write the failing tests**

In `server/__tests__/utils/fundingProposal.test.ts` add (reuse existing `prospect()` / `dueDiligence()` helpers):

```ts
it("prints a confirmed cashflow forecast only in section 7", () => {
  const html = renderFundingProposalHtmlFromData({
    prospect: prospect(),
    contacts,
    activities: [],
    dueDiligence: dueDiligence({
      /* spread into data.cashflowForecast, not underwriting */
    } as any),
  });
});
```

Do not stuff `cashflowForecast` into the `dueDiligence({ ...overrides })` underwriting spread if that helper only merges underwriting. Instead pass:

```ts
dueDiligence: {
  ...dueDiligence(),
  data: {
    ...dueDiligence().data,
    cashflowForecast: {
      source: { documentId: 9, fileName: "cff.xlsx" },
      confirmed: true,
      extractable: true,
      without: { creditsAvg: 20200, opexAvg: 15250, debtServiceAvg: 5703, netAvg: -753, dscr: 0.87 },
      with: { creditsAvg: 24000, opexAvg: 18000, debtServiceAvg: 3047, netAvg: 2953, dscr: 1.62 },
      findings: ["Credits in the forecast are 19% above statement run-rate."],
    },
  },
} as any,
```

Then:

```ts
const seven = html.split("7.&nbsp;&nbsp;Financial forecasts")[1]?.split("8.&nbsp;&nbsp;Recommendation")[0] || "";
const four = html.split("4.&nbsp;&nbsp;Current financial situation")[1]?.split("5.&nbsp;&nbsp;Historic")[0] || "";
expect(seven).toContain("Without facility");
expect(seven).toContain("With facility");
expect(seven).toContain("Credits in the forecast are 19%");
expect(seven).not.toContain("CREDITSAFE");
expect(seven).not.toContain("Forecasts not yet modelled");
expect(four).not.toContain("Credits in the forecast are 19%");
```

And:

```ts
it("keeps section 7 empty when the extract is not confirmed", () => {
  const html = renderFundingProposalHtmlFromData({
    prospect: prospect(),
    contacts,
    activities: [],
    dueDiligence: {
      ...dueDiligence(),
      data: {
        ...dueDiligence().data,
        cashflowForecast: {
          source: { documentId: 9, fileName: "cff.xlsx" },
          confirmed: false,
          extractable: true,
          without: { creditsAvg: 20200, opexAvg: null, debtServiceAvg: 5703, netAvg: null, dscr: null },
          with: { creditsAvg: 24000, opexAvg: null, debtServiceAvg: null, netAvg: null, dscr: null },
          findings: [],
        },
      },
    } as any,
  });
  const seven = html.split("7.&nbsp;&nbsp;Financial forecasts")[1]?.split("8.&nbsp;&nbsp;Recommendation")[0] || "";
  expect(seven).toContain("Forecasts not yet modelled");
  expect(seven).not.toContain("24000");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/utils/fundingProposal.test.ts`

Expected: FAIL — section 7 still the CFADS empty copy / no Without facility.

- [ ] **Step 3: Write minimal implementation**

In `buildFundingProposal`, read `asRecord(data.dueDiligence?.data).cashflowForecast`. Add `cashflowForecast` onto the model (or just use it when building `forecastBody`). Replace `forecastBody` as specified. Drop `forecastStats` from section 7 (leave the field on the model unused here).

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run server/__tests__/utils/fundingProposal.test.ts server/__tests__/shared/cashflowForecast.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add server/utils/fundingProposal.ts server/__tests__/utils/fundingProposal.test.ts
git commit -m "feat: print confirmed cashflow forecast in proposal section 7"
```

---

### Task 4: Financial Data tab to run, edit, and confirm

**Files:**
- Create: `client/src/components/CashflowForecastPanel.tsx`
- Modify: `client/src/pages/underwriting/FinancialsPage.tsx` (TabsList ~120)
- Create: `server/__tests__/routes/cashflowForecastUi.test.ts`

**Interfaces:**
- Consumes: `GET /api/prospects/:id/documents`, `GET /api/prospects/:id/due-diligence`, `POST .../extract-cashflow-forecast`, `POST .../confirm-cashflow-forecast`. Types from `@shared/cashflowForecast`.
- Produces: Fourth tab `value="cashflow"` labelled `Cashflow forecast`. Panel lists documents matching `/forecast|projection|cash.?flow|cff/i` or category `cashflow` (same regex as the route). Select + Run extract. Show two-column grid: without read-only, with `<Input type="number">` for credits/opex/debt/net. Confirm button posts `with` (and months if present). Findings as `<ul>`. If `extractable === false`, show `Forecast on file but not extractable.` Does not write bank-statement fields.

- [ ] **Step 1: Write the failing test**

```ts
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("Cashflow forecast Financial Data tab", () => {
  it("adds the fourth tab and confirm control", () => {
    const page = fs.readFileSync(path.resolve("client/src/pages/underwriting/FinancialsPage.tsx"), "utf8");
    const panel = fs.readFileSync(path.resolve("client/src/components/CashflowForecastPanel.tsx"), "utf8");
    expect(page).toMatch(/Cashflow forecast/);
    expect(page).toMatch(/CashflowForecastPanel/);
    expect(panel).toMatch(/extract-cashflow-forecast/);
    expect(panel).toMatch(/confirm-cashflow-forecast/);
    expect(panel).toMatch(/data-testid="button-confirm-cashflow-forecast"/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/routes/cashflowForecastUi.test.ts`

Expected: FAIL — file/tab missing.

- [ ] **Step 3: Write minimal implementation**

Mirror `BankStatementSweep` patterns (`useQuery` documents + due-diligence, `apiRequest` POST, toast, invalidate due-diligence). Without cells are text, not inputs. Confirm disabled until extractable and at least one with-number is filled.

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run server/__tests__/routes/cashflowForecastUi.test.ts server/__tests__/shared/cashflowForecast.test.ts server/__tests__/utils/fundingProposal.test.ts`

Expected: PASS

Verify in the browser when a dev server is up: Financial Data → Cashflow forecast tab renders; with no file, empty copy; Run/Confirm labels present. Desktop and a narrow viewport.

- [ ] **Step 5: Commit**

```powershell
git add client/src/components/CashflowForecastPanel.tsx client/src/pages/underwriting/FinancialsPage.tsx server/__tests__/routes/cashflowForecastUi.test.ts
git commit -m "feat: Financial Data tab to confirm cashflow forecast"
```

---

## Self-review (spec coverage)

| Spec section | Task |
|---|---|
| Without from sweep+stack; ignore sheet base-case | 1 |
| Null not 0; all-null extract rejected | 1, 2 |
| Findings table v1; cap 8; injected numbers; no working-notes | 1 |
| readyToPrint / unconfirmed not on PDF | 1, 3 |
| Extract flatten existing helpers; JSON numbers only | 2 |
| Confirm recomputes without; mismatch is a finding not a 409 | 2 |
| Section 7 tiles/table/findings; empty copy; no Creditsafe; not in section 4 | 3 |
| Financial Data fourth tab | 4 |
| No 24-month A4 grid; no customer template | 3, 4 |
