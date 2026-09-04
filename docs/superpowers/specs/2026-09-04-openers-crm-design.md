# Openers CRM — Agent Mail warm companies

Date: 2026-09-04  
Status: draft for review  
Repo: Nexus  
Owner: Shaun Tuhey

## Goal

A focused Sales desk of every unique company that has opened an Agent Mail outbound. Full visibility, Companies House identity on the card, a work queue so warm names do not go cold, a 3-touch nurture, and Promote onto the Deck. This is the working list of businesses that have shown intent and may need Strata.

## Locked decisions

- **One company per card.** Opens, clicks, and replies are a timeline under the company, not separate records.
- **Population:** every unique company that opened any Agent Mail outbound. Already-on-Pipeline and inbound names still appear; the board filters them, it does not hide them.
- **Enrichment v1:** Companies House identity only — name, number, status, SIC, directors, trading age, live charges, `nonBankChargeCount`. Auto once, when a company number first attaches. No Places, Firecrawl, or Creditsafe.
- **Monitoring v1:** live mail activity plus a work queue (`lastOpenedAt`, `lastTouchAt`, days sitting). No nightly CH refresh.
- **Working desk:** call log, WhatsApp, and the 3-touch sequence run from the card. They wire into Agent Mail, WhatsApp, and the existing call queue — they do not clone those products.
- **3-touch nurture:** email (approve to send) → 3 days later WhatsApp or call reminder (you execute) → stop. Starts only on **Start nurture**, not on first open. Existing SME first-touch and 2-day open follow-up keep running; this sequence is the *next* email, not a duplicate of `sme_1`.
- **Promote:** create a Deck prospect at `lead` only when none exists for that company number. If one exists, jump to it. The opener card stays, marked `promoted`, with `prospectId`.
- **UI:** Sales nav **Openers** (`/openers`), immediately after Agent Mail, `super_admin` only. Status board: New / Nurturing / Not now / Promoted. Click a card → side drawer. Drag between columns to change status.
- **Persistence:** thin JSON store `uploads/openers.json`. Activity stays in Agent Mail; Openers never copies the message log.
- **Clients / Prospects:** remove the Jobs panel (`AgentJobProgress`) from `GodModeCRM.tsx`. Jobs stay on Workforce.

## Non-goals (v1)

- A second mail client, campaign engine, or LinkedIn step.
- Places / Firecrawl contact attach, Creditsafe, or nightly charge refresh.
- Auto-send WhatsApp or auto-place calls.
- Hiding companies that are already on Pipeline or inbound.
- Storing opener state on `AgenticDealFile` or as a tab on Clients.
- New SQLite tables.
- Changing Agent Mail’s Opened folder (it stays message-centric).

## Architecture

```
Agent Mail recordOpen (tracking pixel)
  → upsertOpenerFromMail (email key → company number when known)
  → first company number? CH identity once
  → uploads/openers.json

GET /api/openers
  → hydrate from existing opened outbound (backfill)
  → join Agent Mail timeline
  → join Deck by companyNumber / prospectId
  → board payload

Drawer actions
  → notes / status / attach company / retry enrich
  → Start nurture → Agent Mail draft (approve) → touch 1
  → WhatsApp / log call (existing providers) → touch 2
  → Promote → create-or-jump Deck prospect
```

Source of truth:

| Concern | Home |
|---|---|
| Opens, clicks, replies | Agent Mail log |
| CRM status, notes, nurture, CH snapshot, prospectId | `uploads/openers.json` |
| Pipeline deal | Prospects / Deck |

## Record

Shared type in `shared/openers.ts`. One JSON object per company.

### Identity

| Field | Type | Notes |
|---|---|---|
| `id` | string | UUID |
| `email` | string | Primary, normalised lowercase |
| `emails` | string[] | Union after merges; includes `email` |
| `companyNumber` | string \| undefined | Normalised (uppercase, 8-digit pad when numeric) |
| `companyName` | string \| undefined | From CH or mail/deal |
| `dealId` | number \| undefined | Linked agentic deal when known |
| `prospectId` | number \| undefined | Set on promote or when already on Deck |
| `phone` | string \| undefined | Only if already on a linked deal / prospect / lead. v1 does not hunt a phone |

### CH snapshot (written once on successful enrich)

| Field | Type | Notes |
|---|---|---|
| `companyStatus` | string \| undefined | |
| `sicCodes` | string[] | |
| `directors` | `{ name: string; role?: string }[]` | Current officers |
| `dateOfCreation` | string \| undefined | Trading age derived at read time |
| `address` | string \| undefined | |
| `liveCharges` | `{ chargee?: string; status?: string; createdOn?: string }[]` | Unsatisfied only |
| `nonBankChargeCount` | number | Reuse `shared/chargeClassifier.ts` |
| `enrichedAt` | string \| undefined | ISO. Missing means not yet enriched |
| `enrichError` | string \| undefined | Last CH failure; cleared on success |

### Lifecycle

| Field | Type | Notes |
|---|---|---|
| `status` | `"new"` \| `"nurturing"` \| `"not_now"` \| `"promoted"` | Default `new` |
| `notes` | string | Default `""` |
| `firstOpenedAt` | string | Earliest open kept on merge |
| `lastOpenedAt` | string | Bumped on each `recordOpen` |
| `openCount` | number | Count of pixel hits across merged mail |
| `lastTouchAt` | string \| undefined | Last nurture send, WhatsApp, or logged call from this desk |
| `createdAt` | string | |
| `updatedAt` | string | |

### Nurture

Stored on the record as `nurture`. Cadence lives in `shared/openers.ts`, not as a new `SalesStream` and not inside `salesOs.ts`.

| Field | Type | Notes |
|---|---|---|
| `step` | `0 \| 1 \| 2 \| 3` | 0 not started, 1 email sent, 2 reminder done, 3 stopped |
| `touch1Status` | `"idle"` \| `"pending_approval"` \| `"sent"` \| `"skipped"` \| `"failed"` | |
| `touch1Draft` | `{ subject: string; html: string } \| undefined` | Built on start; shown in the drawer until approve |
| `touch1At` | string \| undefined | Set when sent |
| `touch1MailId` | string \| undefined | Agent Mail id |
| `touch2Status` | `"idle"` \| `"due"` \| `"done"` \| `"skipped"` | `due` when now ≥ touch1At + 3 days |
| `touch2Channel` | `"whatsapp"` \| `"call"` \| undefined | Which action completed touch 2 |
| `touch2At` | string \| undefined | |
| `stoppedAt` | string \| undefined | |
| `stopReason` | `"completed"` \| `"reply"` \| `"opt_out"` \| `"promoted"` \| `"manual"` \| undefined | |

**Days sitting** is derived at read time: `now - lastTouchAt`, else `now - lastOpenedAt`. Never stored.

**On Pipeline** is derived at read time: `prospectId` set, or a Deck prospect exists for `companyNumber`.

## Identity and merge

1. Key first by normalised email (`to` on the outbound that opened).
2. Resolve `companyNumber` in this order: mail `dealId` → mail `prospectId` → agentic deal by email → prospect/contact by email → internal lead by email.
3. When a number attaches, merge any other opener with that same number into this card: keep the earlier `firstOpenedAt`, sum `openCount`, union `emails`, keep non-empty CH snapshot, keep `promoted` / `prospectId` if either had it.
4. Email-only cards are valid until a number attaches. They show on the board.

Backfill: `GET /api/openers` and `recordOpen` both call `hydrateFromAgentMail()`. Walk opened outbound in the Agent Mail log (current 2000-cap store) and upsert. Existing warm companies appear without waiting for a new pixel hit.

## Write path (`recordOpen`)

`shouldRecordMailTracking` false (staff session, Agent Mail referer, localhost) → do not upsert.

Otherwise:

1. Load the mail item. Ignore if missing or not outbound.
2. Upsert as above.
3. If `companyNumber` is newly present and `enrichedAt` is missing, run CH identity once (async, do not block the tracking-pixel response).
4. Bump `lastOpenedAt` / `openCount` only. Do not change `status` or start nurture.

## 3-touch nurture

Existing SME cadence and `smeOpenFollowUp` are unchanged.

| Step | Channel | When | How |
|---|---|---|---|
| 1 | Email | On **Start nurture** | `POST .../nurture { action: "start" }` builds copy into `touch1Draft` and sets `touch1Status = pending_approval`. Copy: if a linked deal exists, reuse the existing SME open-follow-up / next-touch copy helper; else a short fixed opener-nurture template. Drawer shows the draft. `POST .../nurture { action: "approve" }` sends via existing `sendEmail` + `logAgentMail` (tracking pixel injected). Status becomes `nurturing` only after send succeeds. `lastTouchAt` = send time. Do not create an agentic deal solely to host the approval. |
| 2 | WhatsApp **or** call | 3 days after `touch1At` | Card/drawer shows the action as due. You pick one. Completing either sets touch 2 done. No auto-send. |
| 3 | Stop | After touch 2 | `step = 3`, `stopReason = completed`. Status stays `nurturing` until promote, `not_now`, or manual stop. No fourth touch. |

Rules:

- Start nurture is explicit. First open does not start it.
- Skip a step or stop early from the drawer.
- Inbound reply or opt-out (same signals Agent Mail already writes on the deal / deskKind) stops the sequence (`stopReason` `reply` or `opt_out`).
- Promote stops the sequence (`stopReason` `promoted`).
- Touch 1 send failure leaves `touch1Status = failed` and status `new` (or previous). Retry is `action: "approve"` again against the stored draft. Do not duplicate a sent mail (`touch1MailId` already set → no-op).
- WhatsApp send and call log both go through one helper `completeTouch2IfDue`. Completing either while touch 2 is `due` (or you force it from the drawer) marks touch 2 done and stops. Doing them before touch 2 is due still updates `lastTouchAt` but does not skip ahead unless `action: "touch2"` is explicit.

## Promote

Do **not** require an Internal Lead. Do **not** call `promoteInternalLeadToPipeline` unless an internal lead already exists for that company number.

1. Reject with 400 if `companyNumber` is missing. Drawer stays open; **Attach company** is the next action.
2. Find or create the `companies` row by number (name/status/SIC from the CH snapshot).
3. If a Deck prospect already exists for that company, set `prospectId`, `status = promoted`, stop nurture, return `{ prospectId, created: false }`. Client navigates to `/pipeline` and toasts that they are already on the Deck (Clients promote has no prospect deep-link; do not invent one).
4. Else `createProspect` at stage `lead`, `referralSource: "Openers"` (free string, not an enum), notes that they opened Agent Mail (subjects + last open). `createContact` from `email` / director name / `phone` when present. Set `prospectId`, `status = promoted`, stop nurture, return `{ prospectId, created: true }`. Client navigates to `/pipeline`.
5. If the helper throws, 500 via `handleApiError`. Do not flip status to `promoted`.

Dragging a card onto the Promoted column is this same API, not a silent status patch.

## Board UI

Route `/openers`. Page title **Openers**. Four columns: **New**, **Nurturing**, **Not now**, **Promoted**.

Card (always visible, so the work queue is not buried):

- Company name (or email if unnamed)
- Days sitting
- Open count / last open
- Live-charge badge when `nonBankChargeCount > 0`
- Nurture hint when relevant (`Touch 2 due`, `On pipeline`)

Filters above the board (status is the columns themselves): search, has CH number, already on Pipeline, has live charges. Default sort inside a column: days sitting descending.

Drawer:

- Header: name, number, status, trading age, charge badge
- Timeline joined from Agent Mail (opens, clicks, inbound replies)
- CH identity block (or **Attach company** + **Retry enrich**)
- Notes
- Nurture: Start / skip / stop / touch 2 WhatsApp or Log call
- **Promote to Pipeline** (or **Open on Deck** when already linked)
- WhatsApp / Log call disabled when `phone` is missing

Drag:

| Drop column | Behaviour |
|---|---|
| New | Status patch to `new` only if nurture `step === 0`. Otherwise reject. |
| Nurturing | Does **not** start the sequence. Allowed only when `step >= 1` and not stopped-as-promoted. |
| Not now | Status patch to `not_now`. Does not stop an in-flight send already queued. |
| Promoted | Calls promote API (create or jump). |

## API

`server/routes/openers.ts`, mounted like Agent Mail. `super_admin` only.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/openers` | Hydrate + board payload (records with derived days sitting, timeline summary, on-pipeline flag) |
| GET | `/api/openers/:id` | Drawer payload (full timeline, CH snapshot, nurture) |
| PATCH | `/api/openers/:id` | `status`, `notes`, `companyNumber` (attach). Attaching a number triggers enrich + merge |
| POST | `/api/openers/:id/enrich` | Retry CH identity |
| POST | `/api/openers/:id/nurture` | Body `{ action: "start" \| "approve" \| "skip" \| "stop" \| "touch2", channel?: "whatsapp" \| "call" }` |
| POST | `/api/openers/:id/promote` | Create-or-jump Deck prospect |
| POST | `/api/openers/:id/whatsapp` | Existing WhatsApp send; sets `lastTouchAt`; may complete touch 2 |
| POST | `/api/openers/:id/call` | Log / queue via existing call path; sets `lastTouchAt`; may complete touch 2 |

Nurture email send goes through the existing Agent Mail send path (returns a mail id stored on `touch1MailId`). No new SMTP stack.

## Error handling

- Open with no mail id, or staff pixel: no upsert.
- Unmatched email: create the card anyway. Promote disabled until a company number is attached.
- CH enrich failure: card stays; `enrichError` on the drawer; Retry.
- Duplicate company number: merge, never two cards.
- Already on Deck: card stays; badge **On pipeline**; Promote is **Open on Deck**.
- Promote without company number: 400.
- Promote throw: 500, status unchanged.
- Reply / opt-out while nurturing: stop sequence; card stays.
- WhatsApp / call with no phone: 400; buttons disabled in the drawer.
- Nurture email send failure: `touch1Status = failed`; status not `nurturing`.

## Clients page

Remove `<AgentJobProgress userId={user?.id} />` from `client/src/pages/GodModeCRM.tsx`. Do not remove job toasts or discovery actions. Workforce keeps its Jobs UI.

## Tests

No live Companies House, WhatsApp, or SMTP in CI.

- Upsert: first open creates `new`; second open same email bumps `lastOpenedAt` / `openCount`; two emails same company number merge (earliest first open, union emails).
- Staff pixel / `shouldRecordMailTracking` false does not create an opener.
- Days sitting uses `lastTouchAt` when set, else `lastOpenedAt`.
- Nurture: `start` only writes a draft (`pending_approval`); `approve` send success is what sets `nurturing`; touch 2 due after 3 days; skip/stop; reply/opt-out stops; promote stops; second `approve` after `touch1MailId` is a no-op.
- Promote: missing number 400; no prospect creates one at `lead` with `referralSource: "Openers"`; existing prospect returns that id and does not create a second.
- `GodModeCRM` no longer renders `AgentJobProgress`.
- Light page test: four columns render; Promote disabled without a company number.

## Files (expected)

- `shared/openers.ts` — types, days sitting, merge, nurture due, hydrate helpers
- `server/services/openers.ts` — JSON store, upsert, enrich, promote
- `server/routes/openers.ts` — HTTP
- `server/services/agentMailLog.ts` — call upsert from `recordOpen` (after the pixel write)
- `client/src/pages/Openers.tsx` — board + drawer
- `client/src/App.tsx`, `client/src/components/shell/navModel.ts` — route + nav
- `client/src/pages/GodModeCRM.tsx` — remove Jobs panel
- `server/__tests__/shared/openers.test.ts` and route tests under `server/__tests__/`

## Success

Shaun opens **Openers**, sees every company that has opened Agent Mail (including historical opens in the current log), can tell who has been sitting longest, can attach CH identity, run the 3-touch nurture from the drawer, and promote a real Deck prospect without duplicating one that already exists. Clients no longer shows Jobs.
