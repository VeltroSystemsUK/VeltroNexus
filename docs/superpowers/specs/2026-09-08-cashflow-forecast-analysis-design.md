# Cashflow forecast analysis — evidence vs claim, section 7

Date: 2026-09-08  
Status: draft for review  
Repo: Nexus  
Owner: Shaun Tuhey  
Source: this conversation  
Amends: `docs/superpowers/specs/2026-09-08-funding-proposal-quality-design.md` (section 7 is no longer an empty-only page; the 24-month CFADS modeller remains out of scope)

The customer’s 24-month forecast is a claim. The bank sweep is evidence. Section **7. Financial forecasts** on the funding proposal prints both, side by side, plus a short findings list. It does not reprint historic statements (section 4) or Creditsafe.

## Goal

Give Sterling a brutal, two-column view: **without the facility** (what the account is doing now) versus **with the facility** (what the customer’s sheet says will happen), and flag where the sheet is sales literature.

## Locked decisions

- **Approach:** evidence vs claim. Not an LLM essay. Not DSCR/Creditsafe tiles dumped into section 7.
- **Without facility** is always rebuilt from the last 6 months of statements plus current stacked finance on the facts ledger. A second “base case” workbook is not required.
- **With facility** is the customer forecast only (the attachment with id `cashflow`).
- **One object** on the diligence file. Financial Data tab runs and confirms it. Generate Report copies that object into section 7. No second write-up.
- **Extract-and-confirm.** A model may fill a numeric schema from the flattened spreadsheet. It does not write findings prose or a loan amount. The Studio grid is editable. The PDF prints the confirmed grid, never the raw model dump.
- **Findings are rules**, then bullets (cap 8, 20 words). Numbers in those bullets are injected from the grid/ledger.
- **Missing does not block** Generate Report. No forecast file, or extract not usable and not confirmed → empty state.
- **Voice** matches the quality spec: no paragraphs; tables for figures; bullets for findings.
- No Nexus template the customer must fill. No silent accept of an unconfirmed extract.

## Non-goals

- A full 24-month CFADS / cash-build model on A4.
- Requiring two customer workbooks.
- Putting this analysis in section 4 (current financial situation) or on the cover.
- Letting the model type £, DSCR, or a grade into a finding.
- Auto-running on every upload without a confirm step.

## Architecture

Three units.

| Unit | Job | Depends on |
|---|---|---|
| `shared/cashflowForecast.ts` | Schema, without-facility from sweep+ledger, findings rules, `readyToPrint` | Facts ledger monthly/stacked; statement totals; confirmed with-facility numbers |
| Extract | Flatten `cashflow` attachment via `extractSpreadsheetText`; model fills numeric schema only; missing field = null, not 0 | Attachment id `cashflow` |
| Surfaces | Financial Data tab (run, edit, confirm); `fundingProposal` section 7 (print confirmed object only) | The shared object |

```
cashflow attachment
        │
        ▼
 flatten xlsx/csv/pdf-text
        │
        ▼
 model → { creditsAvg, opexAvg, debtServiceAvg, netAvg, months? }
        │
        ▼
 Studio grid (editable) + without-facility from statements/ledger
        │
        ▼
 confirm → dueDiligence.data.cashflowForecast
        │
        ├── Financial Data tab (same view)
        └── section 7 on Generate Report
```

## Stored object

`dueDiligence.data.cashflowForecast`:

```ts
{
  source: { documentId: number; fileName: string } | null;
  confirmed: boolean;
  confirmedBy?: string;
  confirmedAt?: string;
  without: {          // always from statements + ledger; not from their sheet
    creditsAvg: number | null;
    opexAvg: number | null;      // statement money-out minus stacked finance, when both known
    debtServiceAvg: number | null; // stacked monthly
    netAvg: number | null;
    dscr: number | null;
  };
  with: {             // from confirmed extract / edits
    creditsAvg: number | null;
    opexAvg: number | null;
    debtServiceAvg: number | null; // must match ledger monthly once confirmed, or finding fires
    netAvg: number | null;
    dscr: number | null;
  };
  months?: Array<{     // optional, max 12; omitted on the PDF if absent
    label: string;
    credits: number | null;
    opex: number | null;
    debtService: number | null;
    net: number | null;
  }>;
  findings: string[];  // already-injected bullets, cap 8
}
```

`without` is recomputed on every run from the affordability sweep + proposal facts (stacked monthly, new monthly). `with` is whatever was confirmed. `dscr` = credits-for-debt / debt service when both > 0; else null. Missing is never 0.

`readyToPrint` = `confirmed === true` and at least one of `with.creditsAvg` / `with.netAvg` is a number. Unconfirmed extract never reaches the PDF.

## Extract

1. Resolve the `cashflow` attachment (checklist id already on `ATTACHMENT_ITEMS`). If several matching files, the tab picks one. Default: the latest.
2. Flatten with `extractSpreadsheetText` (xlsx/xlsm/csv). PDF forecasts use existing PDF text extract. If no readable text → not extractable.
3. Model returns **JSON numbers only**, matching `with` plus optional `months`. Prompt forbids prose, £ in strings, and filling gaps with 0. Unreadable field → `null`.
4. Reject the extract if every numeric field is null.
5. Studio shows the two-column grid (without locked / with editable). Confirm writes `confirmed: true` and runs findings rules.
6. Re-running extract clears `confirmed` until you confirm again.

## Findings rules (v1)

Run after confirm. Each hit is one bullet, cap 8, drop the rest. Inject amounts from the grid/ledger; do not ask a model to phrase them.

| Id | When | Bullet shape (numbers injected) |
|---|---|---|
| `sales_stepup` | `with.creditsAvg` > `without.creditsAvg` × 1.15 | Credits in the forecast are {pct}% above statement run-rate. |
| `opex_drop` | `with.opexAvg` < `without.opexAvg` × 0.85 (both present) | Operating costs fall {pct}% versus statements. |
| `debt_mismatch` | `with.debtServiceAvg` present and differs from ledger monthly by more than £1 | Forecast debt service {sheet} versus ledger monthly {ledger}. |
| `dscr_still_tight` | `with.dscr` present and < 1.25 | DSCR after facility {dscr}x — still below 1.25x. |
| `without_unserviceable` | `without.dscr` present and < 1.00 | Without the facility DSCR is {dscr}x. |
| `no_tax_line` | Flattened text has no VAT/PAYE/HMRC/corporation-tax token | Forecast text does not mention VAT, PAYE or HMRC. |
| `no_drawings_line` | Flattened text has no drawing/dividend/director token | Forecast text does not mention directors’ drawings or dividends. |

No other findings in v1. No “note on scope”. No commentary about the prompt.

## Section 7 page map

| Prints | Does not print |
|---|---|
| Tiles: without vs with for credits, debt service, net or DSCR | Creditsafe; grade now/after; historic P&L |
| Two-column table: credits, opex, debt service, net | 24 monthly columns; bank-statement month table (section 4) |
| Findings bullets (≤ 8) | LLM essay; unconfirmed extract |
| Empty state if `!readyToPrint`. If a cashflow file exists but is not extractable: “Forecast on file but not extractable.” If none: keep “Forecasts not yet modelled.” | “A 24-month CFADS model will sit here…” once this ships |

## Financial Data tab

Fourth tab: **Cashflow forecast**. Pick file, Run, show the same tiles/table/findings, Edit with-column, Confirm. Without-column is read-only. Does not write section 4.

## Error handling

- No file / unreadable → empty state, 200 on generate, no 409.
- Extract JSON fails or all-null → “not extractable”, `confirmed` false.
- Confirm with debt-service mismatch still allowed; the finding prints. It is not a generate-gate conflict (loan amount conflicts stay on the quality-spec gate).
- Model must not persist raw completion text on the diligence object.

## Tests

- Without-facility uses sweep+ledger, ignores a “base case” line in the sheet.
- Null, not 0, when a with-field cannot be parsed.
- Unconfirmed extract does not appear in section 7 HTML.
- Confirmed grid appears once in section 7; not in section 4; no Creditsafe on 7.
- `sales_stepup` fires at +15% and not at +10%.
- `debt_mismatch` fires when sheet monthly ≠ `calculateLoan` monthly.
- Findings contain injected figures and no banned working-notes.
- Empty state when no cashflow attachment.
- Flatten helper still used; no new Excel parser.

## Files

| File | Change |
|---|---|
| `shared/cashflowForecast.ts` | Schema, without-from-sweep, findings rules, `readyToPrint` |
| `shared/schema.ts` | `dueDiligence.data.cashflowForecast` |
| `server/utils/` extract route (new or next to sweep-statements) | Flatten + schema fill + save unconfirmed |
| `client/src/pages/underwriting/FinancialsPage.tsx` | Fourth tab |
| `server/utils/fundingProposal.ts` | Section 7 from confirmed object |
| `server/__tests__/shared/cashflowForecast.test.ts` | Rules + without/with |
| `server/__tests__/utils/fundingProposal.test.ts` | Section 7 HTML |

## Success

Home Crafters with a forecast xlsx: section 7 shows statement run-rate vs their sheet, stacked monthly vs ledger £3,047, and bullets for any 15%+ sales jump or cost collapse. Without a forecast file, section 7 is empty and the rest of the PDF still generates. The model never authors a paragraph on that page.
