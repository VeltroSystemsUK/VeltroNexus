# Direct Outreach — private briefing desk

Date: 2026-09-14  
Status: draft for review  
Repo: Nexus  
Owner: Shaun Tuhey  
Related: `docs/superpowers/specs/2026-09-04-openers-crm-design.md`, `docs/superpowers/specs/2026-09-10-sme-opener-nurture-design.md`  
Product named in pack (second offer): **Veltro** (git: `VeltroSystemsUK/fez-crm`; not this repo)

## Goal

When a company has actually sat on stratafinance.co.uk, pull them onto a Shaun-only desk. He generates a **private HTML briefing** (Craft house template, filled with what we can prove plus a named hypothesis), reviews it, and sends a short cover email. That pack’s job is to Promote them onto pipeline. Openers is an on-site work queue, not an email-open log.

## Locked decisions

- **Approach:** Direct Outreach desk on Nexus. Hosted HTML briefing (unique token URL). Cover email from Shaun via `enquiries@`. Craft is the house template, not a per-lead canvas. Completing Veltro/Fez is **out of this repo**.
- **Openers is on-site only.** Zero dwell stays off this desk. Those people remain visible on Agent Mail.
- **New** = 1–4 dwells, not in a sequence.
- **Nurturing** = 1–4 dwells, James still running (3-touch or convert).
- **Direct Outreach** = **5+ dwells**. Dwells only. Email clicks do not qualify. In-page site clicks do not qualify in v1 and do not substitute.
- **Promoted** = pipeline (existing Deck path).
- **Unsubscribed** leaves this board. New Marketing page: graveyard. Not a list. No campaigns, no nurture, no Direct Outreach, no export. PECR record only.
- **Gate + backfill:** same rule on every hydrate. Existing New/Nurturing cards that already have 5+ dwells move in on ship. Unsubscribed stay Unsubscribed. Promoted stay Promoted. Non Responsive with no dwell stay there.
- **James/convert stop** the moment the gate hits (`stopReason: "direct_outreach"`). No N2, N3, or C1 on that pass.
- **False positive:** drag back to Nurturing. **James auto-restarts** — nothing sits silent. Hydrate must not re-pull to Direct Outreach unless `dwellCount` rises **after** the drag.
- **Generate:** one action builds pack + cover email. Shaun reads (tweaks copy if needed), then Send. Open in Craft is the exception, not the queue.
- **Pack content:** proven facts (Companies House + on-site behaviour), then a **named hypothesis** in their language. Never “you have late payers” unless a filing says so.
- **Five slides, always this order:** Cover → What we can see → Hypothesis → How Strata would attack it → Next step.
- **Next-step CTAs:** soft reply ask **and** enquiry/Apply (finance). Second CTA: Veltro landing page (sales machine). Cover subject does not pitch two products.
- **Promote:** auto on **dwell on their briefing** or **inbound reply** (or enquiry/Apply), whichever comes first. Shaun can still Promote by hand. Veltro page / concierge does **not** create a Sterling file.
- **Privacy:** unlisted token, live only after Send, dead on STOP. `noindex`. Invalid token = blank private wall (no company name). Chrome: “Prepared for the directors of [Company] · private · not for circulation.” No Nexus/Openers chrome on the pack. Do not claim encryption or that forwarding is impossible.
- **Staff preview** does not mint the public token, does not count as dwell, does not Promote.
- **Send path:** `sendEmail` / `mailIsSuppressed`. STOP is org-wide. Hard bounce is mailbox-only (existing PECR rule).

## Non-goals

- Completing, hosting, or rebranding `fez-crm` / issuing Veltro trial logins.
- In-page click tracking on stratafinance.co.uk (v1 gate is dwells only).
- Putting each company through the Craft week desk or compliance per send (house template is signed off once).
- Using `emailHtmlFromCraft` (table exporter) for the **hosted pack**. That exporter is cover-email only, if used.
- Inventing late payment, loan rates, or cashflow figures.
- Asking for a call or calendar slot in the cover email.
- A second SMTP stack or Shaun personal mailbox.
- New SQLite tables. Openers JSON + a briefing JSON store.
- Indexing briefings, listing them in nav, Learn, or Explore.
- Mixing Veltro marketing onto stratafinance.co.uk.

## Architecture

```
hydrate / recordDwell
  → dwellCount >= 1 ? visible on Openers desk : Agent Mail only
  → dwellCount >= 5 && !DNC && !promoted && not dismissed-at-this-dwell
       → status = direct_outreach
       → stop nurture/convert (reason direct_outreach)

Direct Outreach card
  → Generate → bind house Craft (5 pages) + cover email draft
  → Shaun reviews
  → Send → sendEmail + mint token + briefing URL live

Recipient
  → dwell on /briefing/:token  OR  reply  OR  enquiry/Apply
       → auto-Promote (Deck, referralSource Openers)
  → Veltro CTA / concierge
       → veltroInterestAt on opener; not a Sterling file
  → STOP
       → Unsubscribed page; revoke token; suppress
```

Source of truth:

| Concern | Home |
|---|---|
| Board status, dwellCount, veltro flag, dismiss watermark | `uploads/openers.json` |
| House Craft briefing (5 pages) + Veltro landing Craft doc | `uploads/craft_direct_outreach.json` (server, not only IDB) |
| Minted briefings (token, openerId, sentAt, revokedAt, dwells, slides) | `uploads/briefings.json` |
| Opens/clicks/replies on the **cover email** | Agent Mail log (existing) |
| Pack dwell / slide / Veltro click | briefing store (staff-session ignored) |
| Deck prospect | existing Promote path |
| Suppression | `uploads/mail_suppression.json` (unchanged) |

## Board

`OPENER_BOARD_STATUSES` becomes:

`new | nurturing | direct_outreach | promoted`

`not_now` remains an `OpenerStatus` for the Unsubscribed page. It is **not** an Openers column.

| Column | Predicate |
|---|---|
| New | `status === "new"` and `dwellCount` 1–4 and not DNC |
| Nurturing | `status === "nurturing"` and `dwellCount` 1–4 and not DNC |
| Direct Outreach | `status === "direct_outreach"` (implies 5+ dwells unless Shaun dragged a card here — v1 does **not** allow drag *into* Direct Outreach; only the gate writes this status) |
| Promoted | `status === "promoted"` |

Openers desk list: `status !== "non_responsive"` **and** `dwellCount >= 1` **and** not Unsubscribed/DNC. Rank inside a column: existing rule (on-site dwell desc, then click heat, then clicks, then opens, then name A–Z). Direct Outreach cards with `veltroInterestAt` sort above others in that column after dwell rank.

**Do not contact** still wins. They never enter Direct Outreach. If STOP after a pack, status `not_now`, token revoked.

Drag:

- Direct Outreach → Nurturing: allowed (false positive). Set `nurture.directOutreachDismissedDwellCount = dwellCount` (current). **James auto-restarts** so nobody is missed:
  1. `status = "nurturing"`.
  2. If `stopReason` was `"direct_outreach"`, clear it (do not clear `opt_out` / `promoted`).
  3. **Convert already in-flight** (`stream === "convert"`, any of N1–N3 sent, C1 not done): resume that cycle. Do **not** resend a step that already went. Set `wakeAt` to the next Sales OS window for the next unsent step (N2 / N3 / C1).
  4. **3-touch already in-flight:** resume that sequence (touch 1 send if still pending; touch 2 reminder if touch 1 already sent).
  5. **Never started** (came from New, James never mailed): enrol and start the stream they qualify for — convert if the dual-open gate still passes, else opener 3-touch — on the next Sales OS window. Do not wait for a second “Start nurture” click.
  6. DNC / suppressed: do not restart. They belong on Unsubscribed, not Nurturing.
- Direct Outreach → Promoted: existing `canPromoteOpener`.
- Unsubscribed → Direct Outreach: **forbidden**.
- Direct Outreach → Unsubscribed: allowed (same as other columns → `not_now`) and revokes any live briefing.

UI: `data-testid="column-direct-outreach"`. Generate only in this column / its drawer: `data-testid="btn-generate-briefing"`. Send: `data-testid="btn-send-briefing"`. Veltro flag: `data-testid="badge-veltro-interest"`.

## Gate and migration

```
eligibleDirectOutreach(opener):
  dwellCount >= 5
  && status not in {promoted, non_responsive}
  && !isDoNotContactOpener(opener)
  && dwellCount > (nurture.directOutreachDismissedDwellCount ?? 0)
```

On hydrate (same pass as today’s opener hydrate):

1. If `isDoNotContactOpener` → status `not_now` (already). Never Direct Outreach.
2. Else if `eligibleDirectOutreach` and status is `new` or `nurturing` → `applyDirectOutreach(opener)`:
   - `status = "direct_outreach"`
   - `stopNurture(..., "direct_outreach")` (extend `stopReason` union)
   - convert: clear `wakeAt`, no C1
3. Else if status is `direct_outreach` but no longer eligible (e.g. now DNC) → Unsubscribed / leave promoted as-is.
4. Openers GET omits `dwellCount < 1` (except Unsubscribed page, which is a different route).

Backfill is this hydrate. No one-off script.

`stopReason` union adds `"direct_outreach"`. `STATUS_RANK.direct_outreach` sits above `nurturing` and below `promoted`.

## Briefing artefact

### House template (Craft)

Shaun art-directs **one** Craft document, five pages = five slides, stored on the server so Generate works on any machine. Merge slots (names locked):

| Tag | Filled from |
|---|---|
| `{{companyName}}` | CH name or email local |
| `{{dwellLine}}` | One true on-site line (see Copy). Never “you opened our email.” |
| `{{filings}}` | Age, SIC label, live charge count, `nonBankChargeCount` |
| `{{hypothesis}}` | Named hypothesis (see engine) |
| `{{mechanism}}` | Packager mechanism for that hypothesis |
| `{{enquiryUrl}}` | Tracked stratafinance enquiry/Apply URL |
| `{{veltroUrl}}` | Tracked `/veltro?b=<token>` (token only after mint; preview uses a staff preview query) |

Compliance: house template is signed off **once** (Craft export gate). Per-company Generate is data bind + Shaun review, not a new Craft week item.

**Open in Craft:** optional escape hatch on the drawer. Saves back to this company’s briefing instance, not the house file, unless Shaun explicitly “save as house.”

### Hypothesis engine (`shared/briefingHypothesis.ts`)

Deterministic, testable, no LLM in v1:

1. `nonBankChargeCount >= 2` → expensive / stacked non-bank debt (typical for this charge pattern).
2. Else construction/building SIC (existing SIC family used elsewhere) → late-pay **culture in this sector**, not “you have late payers.”
3. Else last dwell path contains tools/calculator/cashflow-ish hash → working-capital / cash timing.
4. Else → cashflow tightness **as a pattern for firms that keep returning to the site**.

Each output is `{ id, headline, body, mechanism }` with packager-not-lender copy. Banned: invented rates, “we lend”, “you have late payers” unless a filing field exists (v1: none does).

### Hosted player

Not `emailHtmlFromCraft`. Each Craft page is a full-viewport slide. Motion may run live in the browser. Tracking: opened, 10s dwell (`MAIL_DWELL_MS`), slide index, enquiry click, Veltro click. Staff session / Nexus referer: do not record (same `shouldRecordMailTracking`).

URL: `/briefing/<token>` on the Nexus app host. Token: 32+ bytes url-safe random. Unguessable. Not `/briefing/acme-ltd`.

Lifecycle:

- Generate creates a **draft** briefing bound to the opener (no public token, or token unlisted and 404 until send).
- Send mints/activates token, sends cover email with that URL, `logAgentMail`.
- STOP / Unsubscribed / suppression: `revokedAt` set. GET token → private wall.
- Promote does not revoke (they may still open it).

Private wall (invalid, revoked, or not-yet-sent): no company name, no “expired for X”, `X-Robots-Tag: noindex, nofollow`, `data-testid="briefing-private-wall"`.

Live pack chrome: “Prepared for the directors of [Company] · private · not for circulation.” `data-testid="briefing-pack"`. No app chrome.

Cover email copy (locked tone, not final words): Shaun, first person, one link, soft reply ask, honest “this note is for you; the link isn’t published.” STOP line. List-Unsubscribe headers as existing mail. No Veltro in the subject.

## Veltro landing page

Public Craft page at `/veltro`. Not on stratafinance.co.uk. Markets the four pillars in `fez-crm` README **honestly**: email verification, lead generation, CRM pipeline, business building. Does **not** claim AI workforce (dropped in that fork), live billing, or a working trial login.

Primary button: concierge / talk to Shaun → POST that flags `veltroInterestAt` when `?b=` token matches a live briefing; otherwise a waitlist-style row is enough. `data-testid="btn-veltro-concierge"`.

This page may be indexed. Briefings may not.

Existing `/waitlist` Veltro copy should not fight this page. v1: Veltro page is the public face; waitlist can redirect here or stay unused. Do not run two brands.

## APIs (sketch)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/openers` | staff | Desk omits zero-dwell and Unsubscribed |
| GET | `/api/openers/unsubscribed` | staff | Graveyard only |
| POST | `/api/openers/:id/briefing/generate` | staff | Bind house template; Direct Outreach only |
| GET | `/api/openers/:id/briefing/preview` | staff | HTML; no tracking |
| PATCH | `/api/openers/:id/briefing` | staff | Copy tweaks before send |
| POST | `/api/openers/:id/briefing/send` | staff | `sendEmail`; 403 if suppressed |
| GET | `/briefing/:token` | public | Pack or private wall |
| GET | `/api/briefing/:token/dwell.gif` | public | 10s dwell; staff ignored |
| POST | `/api/briefing/:token/slide` | public | `{ index }` |
| GET | `/veltro` | public | Marketing page |
| POST | `/api/veltro/interest` | public | `{ token }`; sets flag; not Promote |

Promote hook: when briefing dwell records (first 10s), call the same auto-Promote used for enquiry/reply (`canPromoteOpener`, DNC skip, `referralSource: "Openers"`). Convert’s “do not sixth-email auto-promote” remains; this is pack-dwell, not mail count.

## Copy guards

- Packager, not lender. No rates. No “we lend.”
- Hypothesis language: “businesses with this pattern…”, not “you are insolvent.”
- Cover and pack include STOP. Veltro page: not a loan; Strata is a separate conversation.
- `reviewMarketingCopy` (or the shared banned-term helper Craft/Editorial use) runs on generated HTML before Send. Fail = cannot send.

## Error handling

- Generate on a card that is not Direct Outreach → 409.
- Generate with no house template → 503, tell Shaun to save the Craft house board first.
- Send while suppressed / DNC → 403, no token activation.
- Send without generate → 409.
- Token guess / revoked → 200 private wall (do not 404-leak). Rate-limit token dwell POSTs.
- Promote when already promoted → no-op.

## Testing (acceptance)

- Hydrate: 5 dwells, not DNC → `direct_outreach`, James stopped. 4 dwells stay New/Nurturing. 0 dwells absent from Openers GET. 12 email clicks + 0 dwells absent. Unsubscribed with 9 dwells stay Unsubscribed.
- Dismiss drag: not re-pulled at same dwellCount; re-pulled if dwellCount increments. James’s clock is running again (next unsent step, or a fresh enrol if they had never started). No silent park.
- Generate+preview does not create Agent Mail, does not Promote, does not appear on public token GET.
- Send goes through `sendEmail`; suppressed address does not send.
- First briefing dwell Promote; Veltro concierge does not Promote; STOP revokes token and graveyard.
- Hypothesis: `nonBankChargeCount: 2` never emits “you have late payers.”
- Private wall has no company name for unknown tokens.
- Unsubscribed page has no Generate, no campaign action.

## Files (expected)

- `shared/openers.ts` — status, gate, stop reason, desk predicates, drag, rank
- `shared/briefingHypothesis.ts` — engine
- `shared/listUnsubscribe.ts` / mail send — unchanged gate
- `server/services/openers.ts` — hydrate apply gate
- `server/services/briefings.ts` — store, mint, revoke, track, render
- `server/routes/openers.ts` — generate/preview/send
- `server/routes/briefings.ts` — public pack + pixels
- `client/src/pages/Openers.tsx` — columns, generate/send drawer
- `client/src/pages/Unsubscribed.tsx` — graveyard
- `client/src/pages/BriefingPack.tsx` — public player + wall
- `client/src/pages/Veltro.tsx` — public marketing
- `client/src/components/shell/navModel.ts` — Unsubscribed under Marketing; Openers columns change
- Craft house persist (server) + bind merge tags
- Tests beside existing `server/__tests__/shared/openers.test.ts`, `openersUi`, new briefing tests

## Out of spec (later)

- Site-wide in-page click script on stratafinance.co.uk adding to the same ≥5 total.
- LLM / Gazette / accounts deep-research on Generate.
- Per-lead Craft as the everyday path.
- Veltro product completion in `fez-crm`.
- Slide CMS beyond the five-page house board.
