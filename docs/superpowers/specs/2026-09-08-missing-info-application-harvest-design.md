# Missing-info chase + Generic Online Application Form

Date: 2026-09-08
Status: draft for review
Repo: Nexus
Owner: Shaun Tuhey
Source: this conversation. Field list sourced directly from the four lender application forms already on disk at `server/templates/sterling/{bcrs,cwrt,ffe,firstent}/` — not re-derived from a generic checklist.

## Goal

Today, a prospect who hasn't sent everything falls into a manual chase. Make it a formal, repeatable stage:

1. Nexus detects exactly what's missing — both **documents** (already tracked) and **data fields** (not tracked anywhere today — nobody has typed "director DOB" or "amount requested" into a structured place).
2. One email goes out naming exactly those gaps, with a link to a **Generic Online Application Form (GOAF)** — a public, tokenised page, pre-filled with everything Nexus already knows, that only asks for what's missing.
3. What the customer fills in there is captured as structured data on the deal file, so it can feed whichever CDFI's actual application form the file ends up going to, instead of Shaun retyping it.

## The gap this fills

Nexus already tracks **document** completeness end to end: `ATTACHMENT_ITEMS` (`shared/attachmentsChecklist.ts`) is the canonical checklist, `attachmentsFromDocuments` (`shared/sterlingPortal.ts`) auto-matches uploaded files against it, and `AttachmentsChecklistForm.tsx` renders it. `sterlingCompleteness.ts` gates the Sterling zip on it. That machinery stays — reuse it, don't rebuild it.

What's missing is the **data half**: things a director has to type, not upload — loan amount, use of funds, director details, bank-decline evidence, the 10%-contribution eligibility check. `shared/checklistData.ts` (`CHECKLIST_SECTIONS`) is the closest existing thing, but it's an *adviser compliance checklist* (tick-and-file, used only as the CDFI `applicationRequirements` seed) — it has no notion of "customer fills this in online" or "we already know this from Companies House."

### Real forms already on file

You already have the actual application form for all four Sterling lenders as assets in the repo — no need to guess at fields:

| Lender | Asset(s) | Format |
|---|---|---|
| BCRS | `server/templates/sterling/bcrs/BCRS_A0009-08.24-01.pdf` | PDF, 6 pages |
| CWRT | `server/templates/sterling/cwrt/CWRT_Application_Form_Feb26.xlsm` | Excel, 5 sheets (Business Info + 4× Personal Info) |
| FFE | `server/templates/sterling/ffe/FFE-Enterprise-Loan-Application.docx`, `FFE-Client-Declaration.docx` | Word, 2 documents (business form + per-director declaration/SAL) |
| First Enterprise | `server/templates/sterling/firstent/Loan-Application-Form-v10.docx` | Word (`Business-Plan.docx` and `Cash-Flow-Forecast.xlsx` alongside it are documents to produce, not data-entry forms — out of scope here, already covered by `ATTACHMENT_ITEMS`) |

I read every field off all four. The catch-all checklist below is that union, tagged with which lender(s) actually ask each one — not a generic guess. CWRT's workbook repeats its "Personal Info" sheet per person (up to 4); FFE's declaration sheet and First Enterprise's "Director Details" block do the same — so the GOAF needs a **repeatable director/applicant section**, not a single fixed set of director fields.

## Process

```
pack collection under way
    → completeness check (docs via ATTACHMENT_ITEMS, data via new APPLICATION_DATA_FIELDS)
    → if either has gaps
          → missing-info email (one send, names every gap, links GOAF token page)
          → customer opens GOAF: pre-filled fields read-only/editable, gaps highlighted,
            can type missing data AND drag in missing documents (reuse upload flow)
          → submit → gaps close on the deal file, checklist updates live
    → re-check completeness; if still gaps after one chase → Shaun (existing chase-cap pattern)
    → complete → feeds SFP / credit memo as today
```

One email per gap-set, same shape as the existing `accounts-prep` trigger (`docs/superpowers/plans/2026-09-07-sterling-engagement.md`) — don't invent a second chase mechanism, extend that one to cover data fields as well as the three document types it already names.

### Trigger

Fires once per deal when, after the initial pack lands, either list is non-empty:
- `missingAttachments(items)` — existing.
- `missingApplicationData(deal)` — new, same shape, checked against `APPLICATION_DATA_FIELDS`.

Re-fires only if Shaun resets it (same rule as accounts-prep). Two chases, then Shaun — the existing cap (FM-13), not a new one.

### The email

States plainly:
- Which documents are missing (existing wording, unchanged).
- Which data points are missing, in plain English, not field IDs ("the amount you're looking to borrow", not `loan_amount_requested`).
- One link: `/apply/:token` (same token as `/pack/:token` and `/sign/:token` — one token per deal, not a new one to manage).
- Sets expectation: "takes 5 minutes, most of it is already filled in."

### The Generic Online Application Form (`/apply/:token`)

Public, unauthenticated, same host rules as `/pack/:token` and `/sign/:token` — invalid token gets the same no-phone, `enquiries@` fallback as those pages (per the phone-number rule already locked in the Sterling engagement design; don't reintroduce 0115 here).

Pre-fill sources, in order — never ask for what's already sitting on the record:
- Companies House (company name/number, registered address, incorporation date, SIC/nature of business) — already fetched at RES-2 intake.
- `CompanyInformation.tsx` record, if a director already gave it on a call or the intro portal.
- Anything already on `AgenticDealFile` (loan amount if it came in on the inbound enquiry, etc).

Everything else renders as an editable field, grouped by section, checklist-style (ticks off as they fill it in — same visual language as `AttachmentsChecklistForm`). Missing documents appear in the same page as a second section, reusing the existing upload control — one page, one link, not two separate asks.

Submit writes to the deal file; re-opens the token afterwards for edits (same idempotent-resubmit pattern as `/sign/:token`) rather than locking on first submit — a director will come back and add the accountant's figure a day later.

### The checklist + notes (the new artifact)

This is the formal document the user asked for — the thing that says exactly what's required and why, independent of the code. Seed it as data (`shared/applicationDataFields.ts`, mirroring `attachmentsChecklist.ts`'s shape) so the email, the GOAF, and this document never drift apart — one source, four consumers (email, GOAF, this doc, per-CDFI `applicationRequirements`), not four copies to keep in sync.

**Lender key**: B = BCRS · C = CWRT · F = FFE · E = First Enterprise (ELEM). "All" = asked in some form by all four.

#### Company / business

| Field | Notes | Asked by |
|---|---|---|
| Legal business name | | All |
| Trading name (if different) | | E explicit; others assume same as legal name |
| Company number (Ltd/LLP) | | B, E, F ("registered number") |
| UTR / VAT number (sole trader, partnership) | | B, E |
| Registered address | BCRS explicitly wants *trading* address, "not registered office" — the two aren't interchangeable on this form | Companies House gives registered; ask trading separately |
| Trading address (if different) | | B, E, F |
| Postcode | | B, C, E |
| Nature of business / what it does / SIC code | | All |
| Business telephone / mobile | | B, F, E |
| Business email | | F, E |
| Website | | B, F, E |
| Legal entity type (sole trader / partnership / Ltd / LLP / CIC / social enterprise) | | All |
| Start date of trading | Distinct from incorporation date if there was a dormant period | All |
| Local authority / council business rates paid to | | B, C, E |
| CWRT-area council picker | CWRT-specific: Coventry / Warwick / Warwickshire / Rugby / Nuneaton & Bedworth / Stratford-on-Avon, or type another | C only — not a generic field, keep it lender-specific |
| Business category / sector (fixed taxonomy) | CWRT has its own picklist (Accommodation, Arts/sports, Catering, Childcare, Construction, Delivery/haulage, Education, Hairdressing/beauty, Healthcare, IT/telecoms, Manufacturing, Media, Professional/legal, Repairs, Retail, Wholesale, Other) | C |
| VAT registered? | | F |
| Employee count — total, full-time/part-time, male/female split | BCRS wants the M/F/FT/PT breakdown; others just want a headcount | B (detailed), C, E |
| Number of management staff | | C |
| Annual turnover — current + last 2 FYs | Pull from filed/management accounts once ingested; ask only if accounts aren't in yet | C, E, F |
| Increased turnover expected? | | C |
| Is the business women-led? / BAME-led? | Business-level EDI monitoring, separate from individual director EDI below — doesn't affect assessment | C |
| Premises: owned or rented; if owned — value / mortgage outstanding / lender / net equity; if rented — rent / frequency / lease expiry / next review | | F only |
| How did you hear about us | Internally we already know — "introduced by Strata Finance" — never put this to the customer as an open question | B, C, E ask it of the customer; we answer it ourselves |

#### Facility requested

| Field | Notes | Asked by |
|---|---|---|
| Amount requested | | All |
| Term / repayment period requested | CWRT max 60 months; First Enterprise 1–5yrs; BCRS 1–7yrs — the number itself is generic, the cap is lender-specific validation, not a GOAF field | All |
| Purpose of loan (narrative) | Plain text — CDFIs read this, don't reduce it to a dropdown | All |
| Breakdown of how the loan will be used | | B, C |
| Own funds already invested/available in the business | | C |
| Other funding already obtained (grants etc.) and source | | C |
| Other funding still needed and where hoped from | | C |
| Total project cost | | C |
| Preferred arrangement-fee treatment (upfront / added to loan / netted off) | | E |
| Independent legal advice — solicitor details, or confirmation of waiving | | E |
| Introduced by a broker? | We already know: yes, Strata Finance. Pre-fill, never ask | E |

#### Bank decline (CDFI eligibility gate)

| Field | Notes | Asked by |
|---|---|---|
| Confirmation of prior mainstream bank decline | CWRT: hard EU anti-competition eligibility rule — cannot apply unless already declined by a mainstream lender. Matches `ad-2` in the existing compliance checklist (`shared/checklistData.ts`) | C mandatory, E via declaration |
| Which bank(s) declined | | C |
| Date(s) of decline | | C |
| Reason(s) given | | C |

#### Bank & accountant relationship (BCRS-specific, worth capturing generically anyway — useful to any lender)

| Field | Notes | Asked by |
|---|---|---|
| Bank name & branch, business manager name, phone, email | | B |
| Accountancy practice & accountant name, phone, email | | B |

#### Existing borrowing / liabilities (business-level)

| Field | Notes | Asked by |
|---|---|---|
| Type, lender, limit/balance, term, monthly payment | BCRS/FFE want a simple table; CWRT adds security detail + whose name it's in | B, F, C |
| Any other potential liabilities (e.g. guarantees given) | | F |

#### State aid / subsidy history

| Field | Notes | Asked by |
|---|---|---|
| Received State Aid / subsidy in last 3 years? | | B, F, E |
| Amount received, or RLS/GGS loan detail (amount, term, date drawn) | | B, E |
| NI protocol questions (goods/wholesale-electricity-market involvement; entity registered in NI) | Only relevant when a Growth Guarantee Scheme facility is in play | B |
| GB borrower vs NI borrower | | E |

#### Jobs & social impact

| Field | Notes | Asked by |
|---|---|---|
| Jobs created by this loan (how many) | | B, F, E |
| Jobs protected/safeguarded by this loan (how many) | | B, F, E |
| How the loan protects these jobs/sales for a year, which jobs, anticipated new roles | | B |
| Business turnover, last quarter | | B |

#### Security offered

| Field | Notes | Asked by |
|---|---|---|
| Type (debenture, personal guarantee, mortgage/second charge, other asset) | | B, C, F |
| Current value / details (address, model no. etc) | | C |
| Offered in whose name / joint | | C |

#### Directors / owners / applicants — **repeatable block, one per person**

| Field | Notes | Asked by |
|---|---|---|
| Title, full name | | C, E, F |
| Date of birth | | C, E |
| NI number | | C, E |
| Gender | Includes "prefer not to say" | C |
| Nationality / British citizen? If not, residency status | | F |
| Home address, postcode | | C, E, F |
| Time at current address / move-in date; previous address + move-in date if under 3 years | Same 3-year history the existing KYC checklist item `cc-1` already requires for the credit search | C, E, F |
| Home owner or tenant | | C |
| Personal council tax paid to | | C |
| Home phone / mobile / personal email | | C, E, F |
| Relationship status, number of dependents | | E |
| Monthly income after tax, gross annual income | | E |
| Shareholding % / share of business | | F, E (via position) |
| Years with the business | | F |
| Capital introduced (this director's own money into the business) | | F |
| Position within the business | | B, E |
| Involved with the business? | For a co-applicant with shared finances (e.g. a spouse) on FFE/CWRT's combined-finances option | C |
| Existing personal guarantees given | | B (business-level ask), C, F (person-level) |

#### Director credit / insolvency history — per person, plus business-level equivalents above

| Field | Notes | Asked by |
|---|---|---|
| Business ever subject to insolvency (CVL / Administration / CCJ)? + details | | B, E |
| Director(s) ever associated with a failed business? + details | | B, E, F, C |
| Director(s) personally subject to insolvency (IVA / bankruptcy / CCJ / DMP)? + details | | B, E, F, C |
| Convicted of fraud or dishonesty? | | F |
| Ever removed from a company board? | | F |
| Ever had a loan under the Gov Small Firms Loan Guarantee / Enterprise Finance Guarantee scheme? | | F |
| Currently on a Debt Management Programme? | | F |
| Personal CCJs — date, amount, lodged by, reason, status (outstanding/satisfied/disputed) | CWRT wants the structured table; BCRS/First Enterprise take free-text "if yes, provide details" | C (detailed), B, E (free text) |

#### Personal statement of assets & liabilities — per director

| Field | Notes | Asked by |
|---|---|---|
| Property: market value, mortgage outstanding, equity, third-party interest | | F (detailed), C (via security + liabilities) |
| Other assets: life policies, bank/building society balances, stocks/shares, other significant assets | | F |
| Liabilities: overdraft, loans, credit cards, HP, tax due, other — lender, limit, balance | | F, C |
| Guarantees given / contingent liabilities | | F |
| Totals: assets, liabilities, surplus | Derived from the rows above, never asked directly | F, C |

#### Personal budget (income & expenditure) — per director

CWRT-specific in the source forms, but there's no reason to make it CWRT-only in the GOAF — capture it generically once, use it wherever it's asked.

| Field | Notes | Asked by |
|---|---|---|
| Income: drawings, salary/wages, dividends, working tax credits, JSA, child benefit, pension | | C |
| Outgoings: mortgage/rent, utilities, phone/TV/internet, mobile, food, motoring, entertainment, insurance, pension contributions, other | | C |
| Totals: monthly income, monthly payments, surplus/shortfall | Derived | C |
| Anything else to explain about finances/budget | | C |

#### Consents & declarations (wording differs per lender; the data shape is the same)

| Field | Notes | Asked by |
|---|---|---|
| Consent: lender may hold data for assessing/disbursing/monitoring | | All |
| Consent: lender may share data with affiliated/funding organisations | | All |
| Authorisation: credit reference and other enquiries | | All |
| Consent: lender may use company name in publicity | | B, C, E |
| Open-banking read-only access consent | CWRT is explicit that it cannot process the application without this | C mandatory, E mentions open banking |
| Marketing consent (lender + affiliates) + preferred contact method (post/email/phone) | Optional, doesn't gate the loan | B, C, E |
| Alternative email for private/confidential correspondence | | B, E |
| Paper vs email statements preference | | B, E |
| Declaration: information given is true, accurate, complete | | All |
| Signature(s) of director(s) + date | Same e-sign mechanism already scoped for the Sterling Engagement Letter (`shared/engagementLetter.ts`, `/sign/:token`) — reuse it, don't build a second signing flow | All |

#### Equal opportunities monitoring — per director, doesn't affect assessment

| Field | Notes | Asked by |
|---|---|---|
| Ethnic origin (detailed categories) | | C, E |
| Disability (yes / no / prefer not to say) | | C, E |
| Gender | | C |

This is the seed data for `shared/applicationDataFields.ts` — build it from these tables verbatim, don't re-derive from a generic checklist. Anything tagged as a single lender's quirk (the CWRT council picker, its sector taxonomy) stays a lender-specific extra field, not a false generic — the point of "every field on every form is accommodated" is completeness, not pretending every lender wants the same thing.

## Decisions

- **Who sends it: Maya, always.** Chase emails on documentation sit with Maya Hart's desk (RES-2, `inbound-intake`), full stop — confirmed. This supersedes the earlier default (which had proposed James/SAL-1 by analogy to `accounts-prep`) and needs a small org-chart update: `docs/agentic-org/agents/RES-2.md` should gain "staged data/document chase + GOAF send" under Maya's responsibilities; `SAL-1.md`'s "credit-pack collection... staged asks, completeness, chases" line should be scoped down to whatever James still owns after this moves (or removed if this chase mechanism replaces it entirely — confirm which before editing that file).
- **Generic, not per-CDFI-branched.** All four lenders are known, finite assets (not a hypothetical future CDFI) — the table above is the full union across all four, so the GOAF asks the complete superset up front. No branching logic by matched lender. A field only one lender needs (e.g. CWRT's council picker) still appears once, tagged to that lender in the seed data, and the UI can gray out/hide fields once a lender is matched and known not to need them — but that's a display refinement, not a second form.
- **Where harvested data lives.** New fields on `AgenticDealFile` / prospect record (mirroring how `accountsPrep`/`engagement` were added), not a new table.

## Non-goals

- Auto-filling or auto-submitting the actual CDFI application form. This harvests the data; producing each CDFI's specific form from it is a separate, later step (the `Match` stage gap noted in `PIPELINE_STAGES.md`).
- A second document-upload mechanism. GOAF reuses the existing upload control and `ATTACHMENT_ITEMS`.
- A second token system. Reuses the existing per-deal `uploadToken`.
- Redesigning the Introduction Portal (separate branch, separate concern).
- Legal/regulated-agreement handling — sole trader / small partnership stays the existing hard stop (`CLAUDE.md`), unaffected by this.

## Files (implementation map, not a plan)

- New: `shared/applicationDataFields.ts` — the seed table above, `APPLICATION_DATA_FIELDS` + `missingApplicationData(...)`, same shape as `attachmentsChecklist.ts`.
- New: `client/src/pages/ApplyOnline.tsx` — the `/apply/:token` page, modelled on `PackUpload.tsx` / the planned `SignEngagement.tsx`.
- New: `server/routes/applyOnline.ts` — `GET`/`POST /api/apply/:token`.
- Extend: `shared/agenticWorkflow.ts` — trigger state (same shape as `accountsPrep`), gap lists on the deal file.
- Extend: `docs/agentic-org/strata-inbound/intake.md` — new staged-ask row, same table style as the accounts-prep stage.
- Extend: `docs/agentic-org/agents/RES-2.md` — Maya's desk gains the staged data/document chase + GOAF send.
- Extend: `docs/agentic-org/agents/SAL-1.md` — scope down or remove the overlapping "staged asks, completeness, chases" line once this moves to Maya.
- Reuse unchanged: `shared/attachmentsChecklist.ts`, `shared/sterlingPortal.ts`, `AttachmentsChecklistForm.tsx`, the `uploadToken` on the deal file, `shared/engagementLetter.ts`'s e-sign mechanism (for the declaration signature).
- Source of truth (read, not edited): `server/templates/sterling/bcrs/BCRS_A0009-08.24-01.pdf`, `.../cwrt/CWRT_Application_Form_Feb26.xlsm`, `.../ffe/FFE-Enterprise-Loan-Application.docx`, `.../ffe/FFE-Client-Declaration.docx`, `.../firstent/Loan-Application-Form-v10.docx`.

## Success

1. A deal with a data gap (not just a document gap) shows up on a chase, instead of silently sitting until Shaun notices on a call.
2. One link, one page, gets a director through everything outstanding — no "which of the three emails did I already reply to."
3. What lands from GOAF is structured (typed fields on the deal file), not another PDF to re-key.
4. The checklist above is the one place that defines "what a complete application needs" — the email, the form, and this document can't drift apart because they read the same seed data.
5. Every field on every one of BCRS, CWRT, FFE and First Enterprise's real forms has a home in `APPLICATION_DATA_FIELDS` — checked off against the source assets, not assumed.
