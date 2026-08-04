# Four-Stage Pipeline Walkthrough

Maps the `broker-*` skill's conceptual four stages (ingest → underwrite → match → disclose) to what's actually implemented in Nexus. Written after building out this week's deliverables, as a factual check against the code — not aspirational.

## 1. Ingest
**Implemented.** A borrower's documents and financial profile enter the system via the prospect/due-diligence flow (`server/routes/prospects.ts`, `client/src/components/DueDiligenceTools.tsx`) and, once packaged, via the underwriting submission intake (`server/routes/submissions.ts` — `POST /api/underwriting/submissions`). This week added the HMRC Time To Pay flag and Companies House/Google Places verification checks into this stage (both file into `verification_exceptions`, surfaced on `ProspectDetail.tsx`).

## 2. Underwrite
**Implemented.** `client/src/pages/UnderwriterInbox.tsx` is the underwriter-facing queue; submission status moves `submitted → in_review → queried/responded → approved/declined`, plus the `sent_to_broker` side-branch for external partner hand-off. Companies House monitoring (`server/services/companiesHouseMonitor.ts`, new this week) re-checks a deal's company record nightly while it's active and flags changes during this stage.

## 3. Match
**Implemented, narrower than the skill describes.** `server/routes/cdfis.ts` and `client/src/pages/Lenders.tsx` provide a CDFI/lender registry with contact tracking and agreement status, and this week added per-CDFI `applicationRequirements`. There is no automated scoring/ranking match engine (the `broker-match` skill's weighted cost/fit model) — matching today is manual: an adviser reviews the registry and reaches out.

## 4. Disclose
**Not built.** No transparency-matrix or commission-disclosure UI exists anywhere in the app — confirmed by search, not assumed. If borrower-facing commission disclosure is a real requirement (the Compliance Hub's `DOC_001` already documents the *obligation* — CONC 4.4/3.7 IDD, commission disclosure), it needs to be built from scratch. This is a genuine gap, not a naming mismatch with something that already exists.

## Note on stage terminology
There are two separate "stage" concepts in the code that both proved relevant this week:
- The prospect Kanban stage (`lead → contacted → qualified → proposal → due-diligence → submission → approval → approved/declined/withdrawn`), driven by `client/src/pages/Settings.tsx`'s `DEFAULT_STAGES`.
- The underwriting submission `status` (a separate field, `submitted → in_review → ... → approved/declined`, plus `sent_to_broker`).

These aren't the same as the four `broker-*` pipeline stages above — don't conflate them when reading the code.
