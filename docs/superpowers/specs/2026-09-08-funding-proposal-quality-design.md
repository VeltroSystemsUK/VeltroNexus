# Funding proposal quality — facts ledger, two grades, bullets, generate gate

Date: 2026-09-08  
Status: draft for review  
Repo: Nexus  
Owner: Shaun Tuhey  
Source: this conversation, grounded in `THE_HOME_CRAFTERS_LTD__Funding_Proposal_2026-09-08 (2).pdf` and `server/utils/fundingProposal.ts`

One PDF. Complete enough to work the file. Clean enough to send to Sterling. Missing data is an empty state. Conflicting numbers are a hard fail: no PDF bytes leave the building.

## Goal

The generated funding proposal is the product. On the Home Crafters file it printed £120,000, £110,000, £85,000 and an £8,500,000 “inconsistency”; used Creditsafe A (“Very Low Risk”) as the cover grade next to a 0.87x DSCR; pasted the same background and bank essay twice; and labelled ~20 overflowing pages `1 / 9`. Tests only asserted that section titles exist.

Stop that class of failure. Every numbered fact has one value. Every fact has one slot. Narrative is bullets. Generate Report is refused until the file is internally consistent.

## Locked decisions

- **Audience:** one PDF for internal work *and* Sterling. Not two artefacts. Not a draft banner someone can forward.
- **Conflicts:** block download. No PDF, including inside the Sterling zip, until each numbered fact has one value.
- **Missing:** empty state (`—` or the existing dashed empty box). Generation is still allowed.
- **Source of truth:** `dueDiligence.data.proposal` on the file. The PDF reads only this. Auto Write writes only the slot arrays on it.
- **Creditsafe** is a guide line on the company profile. It is never the cover grade and never an input to the grade function.
- **Two grades:** grade now (stacked monthly) and grade after (new facility monthly). Same rules table, applied twice, so the spread shows whether the facility improves the business — or does not.
- **Grades are rules, not a model.** Override is allowed and labelled. The LLM helper `calculateRiskGrade` in `geminiClient.ts` is not used for this PDF. Zeus is out of scope.
- **Approach:** ledger + slot template + generate gate + flowing HTML. Not a generate-time priority list. Not a new Word/PDF merge product.
- **Voice:** no paragraphs. Narrative is bullets with hard caps. Tables and stat tiles stay for figures. Empty states stay as one short line. Sign-off stays as Signed / Date.

## Non-goals

- Building the 24-month forecast / CFADS model (section 7 stays an empty state until that exists).
- Replacing Zeus or the LLM `calculateRiskGrade` used elsewhere.
- A confirmation screen that silently picks a winner among conflicting sources.
- Visual PDF screenshot CI.
- Rewriting Credit Studio analysis screens beyond: writing slots instead of essays, and the generate-gate panel.
- Changing Passan’s nine section headings. Content under them is rationalised; the headings stay.

## Why duplication happens today

Three layers, all present in `fundingProposal.ts`:

1. **Many sources, no owner.** Loan amount is read from requirement `loan_amount`, use-of-funds total, `loanDetails.amount`, calculator `loanAmount`, and `prospect.loanAmount / 100`. CAMPARI, SWOT and `financialAnalysis.summary` then invent further figures (£85,000, £110,000, £8.5m). Cover grade is `riskGrade || creditsafeGrade`.
2. **The template concatenates overlapping fields.** Cover Background and section 2 “Background & Notes” both print `prospect.background` + `prospect.notes`. Use of funds, Allocations, and Sources & Uses are the same breakdown three times. Bank commentary is dumped in full, then the same totals appear as the DSCR hero, the cashflow kv table, and the monthly table.
3. **Nine `.paper` boxes pretend to be pages.** Each is labelled `n / 9` and forced `page-break-after`. Chrome paginates overflow, so the PDF is ~20 pages still numbered out of 9. `overflow-wrap: anywhere` and letter-spacing split `CRAFTERS` and `February`. `break-inside: avoid` reprints clipped tables.

`text()` only skips exact duplicate strings. It does not skip the same fact in two fields.

## Architecture

Four units. Each has one job and is testable without Chrome.

| Unit | Job | Depends on |
|---|---|---|
| `shared/proposalFacts.ts` | Reconcile inputs, compute derived, list conflicts/missing, validate slots, compute grades | Existing `calculateLoan`, sweep totals, declared-unit sources |
| Slot writers | Auto Write (CAMPARI, SWOT, background, bank findings, recommendation) writes string arrays onto `proposal.slots` | Slot schema + banned-phrase / number-strip |
| `buildFundingProposal` | Map `proposal` + company/CH/documents onto the HTML model. One slot per fact | Ledger + slots. Must not read `financialAnalysis.summary` or `prospect.notes` into the PDF |
| Generate gate | `ready === (conflicts.length === 0)`. Same function for UI, `GET /report`, and Sterling zip | `buildProposal` result |

```
requirement / calculator / sweep / statements / CH / Creditsafe
        │
        ▼
 buildProposal(file)  →  { facts, derived, slots, conflicts, missing }
        │
        ├── conflicts.length > 0  →  no PDF (409 / disabled button / zip skip)
        └── else                  →  renderFundingProposalHtml(model from proposal only)
```

Old markdown essays in `adviserSummary.sections`, `financialAnalysis.summary`, `accounts.summary`, `prospect.background`, `prospect.notes` may remain on the file. The PDF does not copy them.

## Facts ledger

Stored at `dueDiligence.data.proposal`. Shape:

```ts
proposal: {
  facts: {
    loanAmountPounds: number | null;
    termMonths: number | null;
    interestRatePct: number | null;
    stackedMonthly: number | null;
    avgCredits: number | null;
    avgDebits: number | null;
    cashForDebt: number | null;
    purposeShort: string | null;          // one line, not a paragraph
    useOfFunds: Array<{ label: string; amountPounds: number }>;
    creditsafeScore: string | null;       // guide only
    creditsafeLimitPounds: number | null; // guide only
  };
  overrides: {
    gradeNow: "A" | "B" | "C" | "D" | "E" | null;
    gradeAfter: "A" | "B" | "C" | "D" | "E" | null;
    by: string | null;
    at: string | null;
  };
  slots: { /* see Voice */ };
}
```

`derived`, `conflicts`, and `missing` are **computed on every read / generate**. They are not a second store that can go stale. The UI may cache the last computation for the panel.

### Inputs and sources

| Fact | Sources (declared unit) |
|---|---|
| Loan amount (£) | Requirement `product_details.loan_amount` (pounds); `use_of_funds.total_request_amount` (pounds); `underwriting.loanDetails.amount` (pounds); calculator `loanAmount` (pounds); `prospect.loanAmount` (**pence**, divide by 100 once) |
| Term (months) | Requirement, `loanDetails.termMonths`, calculator, `prospect.term` |
| Interest rate (%) | `loanDetails.interestRate`, calculator, `prospect.interestRate` |
| Stacked finance / month | Affordability sweep `financeMonthly` only |
| Avg credits / debits / cash for debt | Sweep totals only |
| Use of funds lines | `prospect.loanAllocation` **or** `use_of_funds.breakdown` — one list |

**Units are declared, never guessed.** Do not “if it looks big, divide by 100”. That is how this file grew an £8,500,000 ghost. `prospect.loanAmount` is the only pence field in the table; everything else in the table is pounds.

**Agreement.** Money: nearest pound. Rate: 0.01. Term: exact integer. If every present source agrees, write the value. If two present sources disagree, the field is a **conflict** (blockers: field, value + source, value + source). If no source has a value, the field is **missing**.

**Use of funds.** If only one list exists, use it. If both exist and every line matches (label + pounds), use one table. If both exist and differ, that is a conflict on `useOfFunds`, not two tables.

David does not override loan amount by typing into CAMPARI. He changes the calculator or the requirement; the ledger updates.

### Derived (never typed, never taken from a model)

Recomputed from inputs with `calculateLoan(amount, rate, term)` already in the repo:

| Derived | Formula |
|---|---|
| Monthly repayment | `calculateLoan` on ledger amount, rate, term. If any of the three is missing, monthly is missing |
| Monthly saving | stacked − new monthly |
| DSCR now | cash for debt ÷ stacked monthly |
| DSCR after | cash for debt ÷ new monthly |
| Headroom now | avg credits − avg debits (same as net cashflow on the cashflow kv) |
| Headroom after | headroom now + monthly saving |
| Grade now / after | rules table below, unless override |

Stored `financialAnalysis.dscr` and `financialAnalysis.riskScore` are ignored. Sweep `dscrCurrent` / `dscrRefinance` are not competing sources; they are replaced by the formulae above so the PDF cannot disagree with its own cashflow table.

**Missing is not zero.** No sweep → DSCR now missing, grade now missing. No amount+rate+term → monthly missing, DSCR after missing, grade after missing. The PDF does not print `0.00x`, grade E, or Creditsafe “Very Low Risk” to fill the hole.

## Grade rules

Same table, twice: **now** uses stacked monthly; **after** uses new-facility monthly.

| DSCR | Grade | Meaning |
|---|---|---|
| ≥ 1.50 | A | Strong |
| ≥ 1.25 | B | Acceptable (existing `DSCR_THRESHOLD`) |
| ≥ 1.00 | C | Tight |
| ≥ 0.75 | D | Stressed |
| < 0.75 | E | Unserviceable |

Home Crafters on that table: now 0.87x → **D**, after 1.62x → **A**.

**One notch.** If statement findings already on the file include bounced/unpaid items, gambling, or a red flag matching unarranged overdraft / unpaid, both grades move down one, floor E. Historic conduct does not vanish because we refinance. No other modifiers in this pass: not charges, not key-person, not facility count, not Creditsafe.

**Override.** `overrides.gradeNow` / `gradeAfter` plus `by` and `at`. The PDF prints the computed pair and, if overridden, `B (overridden from D)`. A grade cannot be smuggled in a bullet.

**Cover.** Two tiles: Grade now, Grade after. Creditsafe stays on the profile as `A · £10,000 limit` (guide).

## Voice — bullets only

No paragraphs in the PDF. Tables and stat tiles are for figures. Empty states are one short line. Sign-off is Signed / Date.

| Slot | Max bullets | Max words each |
|---|---|---|
| `background` | 5 | 25 |
| `theBusiness` | 6 | 25 |
| each CAMPARI pillar | 6 | 20 |
| each SWOT quadrant | 5 | 20 |
| `bankFindings` | 8 | 20 |
| `recommendation` | 5 | 25 |

Over the cap is dropped, not “see below”.

**Save rejects a bullet that contains any of:**

- `£` or a GBP amount
- a DSCR (`DSCR`, or `\d+\.\d+x`)
- a grade-as-rating: `grade A`–`E`, `risk score A`–`E`, `A (Very Low Risk)` and the same for B–E
- a facility term used as a term (`60 months`, `5 years` next to loan/facility/term)
- a banned working-note (case-insensitive): `the document provided`, `note on scope`, `cannot currently be assessed`, `this is not stated`, `the evaluation below`, `cannot currently be credit-assessed`

At render, a **facts line** under the relevant heading injects ledger numbers once, as data, not inside a sentence. CAMPARI Amount gets `£120,000 · 60 months · 18% · £3,047.21/mo`. Repayment gets `DSCR 0.87x → 1.62x · stacked £5,702.70 → £3,047.21`. Means gets average credits/debits and cash for debt. Background, SWOT, and recommendation get no facts line unless the section already has tiles above.

### Slot writers

Auto Write for CAMPARI, SWOT, background, bank findings, and recommendation writes `proposal.slots` as string arrays. Prompts must ask for bullets, forbid amounts/DSCR/grades/working-notes, and stay inside the caps.

**Migration.** The PDF still only prints `proposal.slots`. If a slot array is empty, `buildProposal` may fill that slot **in memory** by splitting the matching old markdown (CAMPARI / SWOT / `prospect.background` only), stripping numbers and banned phrases, and applying caps. That hydrate is not written back until someone saves Auto Write or edits the slot. `financialAnalysis.summary`, `accounts.summary`, and `prospect.notes` are never hydrated — they are the working-notes that leaked on Home Crafters.

## Generate gate

`ready = conflicts.length === 0`.

The same `buildProposal(file)` result feeds three callers. If not ready, **no PDF bytes**:

1. **Prospect file** — `Generate Report` on `ProspectDetail` is disabled. A panel lists **blockers** (conflicts: field, value A + source, value B + source, link to the calculator or requirement) and **gaps** (missing → which empty state the PDF will show). Gaps do not disable the button.
2. **`GET /api/prospects/:id/report`** — HTTP 409 `{ conflicts, missing }`. Does not stream a PDF. Today it always prints.
3. **Sterling pack zip** — same gate as completeness: throw 400 naming the conflicts. Do not build the zip. Do not attach a proposal-less pack as if send succeeded. Existing `evaluateSterlingCompleteness` stays; this is a sibling gate.

Fixing a blocker means changing the calculator or the requirement (or reconciling the two use-of-funds lists), then recomputing. It does not mean editing a bullet.

## Page map

Keep the nine headings. Stop stuffing each into a fake A4 `.paper` with `n / 9`. One flowing document, CSS `@page` counters, running header (borrower + stamp + ref) and footer (confidential line + real page number) on every page. Remove `overflow-wrap: anywhere` and decorative letter-spacing that splits words.

| Section | Prints | Does not print |
|---|---|---|
| Cover | Ledger fact table; **Grade now / Grade after** tiles; company profile kv; Creditsafe guide line; `background` bullets (only here) | A single Creditsafe-derived risk grade; `prospect.notes`; coverNote |
| 1. Loan amount and purpose | Purpose bullets; **one** use-of-funds table; loan calc from the ledger (amount, rate, term, monthly, fees) | Allocations table; Sources & Uses table; a second monthly |
| 2. The business | `theBusiness` bullets; group; ownership; Companies House kv; charges; risk indicators | Cover profile again; Background & Notes again; the `businessFacts` run-on line |
| 3. Risk assessment | Grade now / after + DSCR now / after; CAMPARI bullets + facts lines; SWOT bullets; file flags | Creditsafe as the grade; CAMPARI essays; SWOT restating the profile |
| 4. Current financial situation | DSCR hero; cashflow kv **once**; monthly table; stacked-lenders table; `bankFindings` bullets; findings tables (DDs, bounces, loans, gambling, personal, anomalies) | `financialAnalysis.summary` essay; those same totals under Background |
| 5. Historic | P&L / BS / chart **if extractable figures exist** | Model chatter about blank PDFs or an £8.5m inconsistency. Blank accounts → empty state |
| 6. Deal summary | Security kv; Research Hub if completed | Use of funds again; loan calc again |
| 7. Forecasts | Empty state until a model exists | Reprint of DSCR / Creditsafe tiles |
| 8. Recommendation | Recommendation bullets; sign-off | A paragraph. Empty → existing “Awaiting recommendation” one-liner |
| 9. Attachments | Checklist **derived at render from documents actually on the file** (`attachmentsFromDocuments` / `resolveAttachmentsChecklist`) | “0 of 13” while statements have already been analysed |

Dropped globally: concatenating `prospect.notes` into Background; rendering `bank.summary` or `accounts.summary` as HTML; treating missing as zero.

## Error handling

- Conflict at generate: 409, JSON body with `conflicts` and `missing`. Client toast uses the first conflict’s field and values. No blob download.
- Slot save with a forbidden token: 400 naming the slot and the token. Nothing persisted.
- Override without `by`: reject. Must record who.
- Chrome missing: existing error, unchanged. Gate runs *before* HTML-to-PDF so a conflicted file never needs Chrome.

## Tests

Existing `fundingProposal.test.ts` title/smoke assertions stay. These are the ones that would have caught the Home Crafters PDF.

**Ledger.** Sources that agree with declared units collapse to one value (`prospect.loanAmount` 12,000,000 pence + requirement £120,000 → £120,000). £120,000 vs £85,000 → conflict, `ready === false`. Empty sources → missing, `ready === true`. Missing is never coerced to 0.

**Derived.** Monthly is `calculateLoan` on the ledger. Fixture: DSCR 0.87x → D, 1.62x → A. Adverse conduct notches both down one. Override stores who/when and prints as an override. Creditsafe A never becomes the cover grade.

**Slots.** A bullet containing `£`, a DSCR, a grade-as-rating, or a banned phrase is rejected. Over the cap is dropped. A markdown essay is not a valid slot.

**HTML.** One use-of-funds table; no Allocations; no Sources & Uses. Background only on the cover. No `businessFacts` run-on. No banned phrases. The ledger loan amount appears; £85,000, £110,000, and £8,500,000 do not. No fake `1 / 9`. No `overflow-wrap: anywhere`.

**Gate.** `GET /api/prospects/:id/report` returns 409 and zero PDF bytes when conflicted. Sterling pack does not zip a conflicted proposal. Missing historic/forecasts still generate, with empty states.

**Fixture.** One Home-Crafters-shaped file: conflicted → blocked; reconciled to £120,000 → D→A, bullets, one amount, no essay.

No visual PDF screenshot suite in this pass. The generate-gate panel is UI and is verified in the browser when implemented (button disabled on conflict, 409 path, enabled when only gaps remain).

## Files

| File | Change |
|---|---|
| `shared/proposalFacts.ts` | New. Reconcile, derive, grade, slot validate, `ready` |
| `shared/schema.ts` | `dueDiligence.data.proposal` |
| `server/utils/fundingProposal.ts` | Build model from `proposal` only; flowing layout; page map |
| Auto Write paths that currently dump essays into `adviserSummary.sections` / SWOT / background | Write `proposal.slots` |
| `client/src/pages/ProspectDetail.tsx` | Gate panel; disable Generate Report |
| `server/routes/submissions.ts` (report route) | 409 when not ready |
| `server/services/sterlingPack.ts` | Sibling gate before the proposal PDF |
| `server/__tests__/shared/proposalFacts.test.ts` | Ledger, grades, slots |
| `server/__tests__/utils/fundingProposal.test.ts` | HTML map + banned phrases + one amount |
| Report-route and sterling-pack tests | 409 / skip PDF |

## Success

A file like Home Crafters cannot download until loan amount, term, and rate agree. Once they agree, the PDF has one £120,000, grades D→A from the DSCR pair, Creditsafe only as a guide, background and bank findings as capped bullets, each table once, and real page numbers. A later Auto Write run cannot put £85,000 back into CAMPARI.
