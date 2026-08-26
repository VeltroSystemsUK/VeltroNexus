# Sterling Commercial Finance portal

Date: 2026-08-26  
Status: draft for review  
Repo: Nexus (`/broker-portal`), not the standalone Strata Next.js app

## Goal

David Griffiths (Sterling Commercial Finance Limited) logs into Nexus and only sees files that are ready for him. He recommends, checks, and downloads a lender pack. He does not underwrite, package, or work in Credit Studio. Recommendation text is not stored on the main Nexus prospect record.

## Locked decisions

- Host: inside Nexus. Role `external_broker`. After login, only the Sterling portal.
- Visual: current Sterling dashboard (navy bar, IBM Plex, cases list). No New case, rename, or delete.
- File page: workbench on the **left**, live Nexus funding proposal on the **right**.
- Files appear automatically when the compiled report can be built (the event that today pushes a case into standalone Strata). No second human click.
- Missing checklist items are flagged. Approve is not blocked. Optional **Return to Nexus**.
- Approve offers only lenders that already have a real application template: **Finance for Enterprise** (auto-filled Word) and **CWRT** (official Excel in the pack; cell mapping is a follow-on, not this build).
- Nexus builds a zip. David downloads it and sends it himself. Download marks the file **Sent**.
- Approach: all in Nexus. Do not keep the Next.js app as David’s workspace. Do not call the Python Strata API as a sidecar.

## Screens

### Login

Existing Nexus `/auth`. If `role === external_broker`, land on `/broker-portal`. No pipeline, underwriting studio, or other nav.

Chrome: Sterling Commercial Finance logo, navy 3px top bar, IBM Plex Sans. Not the generic “Broker Portal” shield header.

### Dashboard (`/broker-portal`)

Matches the current Sterling cases list.

Each row: company name, status, flag count if any, date. **Open** goes to the file.

Empty state: “No files have been sent to you yet.”

### File (`/broker-portal/:id`)

Two columns.

**Left rail (David’s job)**

- Back to Cases
- Company name
- Pills: status, amount/term, missing count
- Flags: each missing checklist item
- Documents: full attachments checklist with On file / Missing; click opens the uploaded file
- Recommendation: textarea. Autosave. Required before Approve.
- **Approve** (primary)
- **Return to Nexus** (secondary)

**Right pane (reading)**

- The live Nexus funding proposal HTML (same CSS as `renderFundingProposalHtml`: Source Sans 3, navy `#1F3864` bands, fact table, running header, confidential footer).
- Scrollable A4 paper on a grey desk.
- Logo at natural size (not stretched). Height 42px, `width: auto`, `align-self: flex-start`.
- Section 8 on this copy shows “Awaiting recommendation”. David does not write in the report body.

### Approve overlay

Opens only if recommendation text is non-empty.

1. Pick **Finance for Enterprise** or **CWRT** (two cards, one selected).
2. Warning if flags remain: “N items still missing. They will be listed in the pack. Approve is not blocked.”
3. Pack contents list (filled form(s), funding proposal PDF with section 8 stamped, supporting files, `STILL-MISSING.txt` when needed).
4. **Download pack** builds the zip, starts the download, sets status to `sent`.
5. Cancel closes the overlay. Status stays `awaiting_recommendation` until download succeeds.

### Return overlay

Short note (required). Status → `returned`. Nexus underwriting sees the note. When the pack is ready again (new or updated report / newly attached docs), status returns to `awaiting_recommendation`.

## Data

Extend `broker_handoffs` (do not store this on `prospects` or `dueDiligence.underwriting.adviserSummary`):

| Field | Meaning |
|---|---|
| `status` | `awaiting_recommendation` \| `returned` \| `sent` |
| `recommendation` | David’s commentary |
| `recommendedAt` | ISO timestamp |
| `recommendedByUserId` | David’s user id |
| `returnNote` | Set when returned |
| `returnedAt` | ISO timestamp |
| `approvedLenderId` | `ffe` \| `cwrt` (set when the zip is built) |
| `packGeneratedAt` | ISO timestamp of last successful zip |

Existing fields remain: `submissionId`, `prospectId`, `externalUserId`, `sentByUserId`. Do not hide Sterling files by `expiresAt`. The current 30-day guest expiry does not apply to this partner.

`status` on the underwriting submission stays in sync at a coarse level: `sent_to_broker` when the handoff is created; a returned note is an activity on the submission; `sent` on the handoff does not invent a new submission status beyond recording an activity “Sterling downloaded pack for FFE|CWRT”.

## Recommendation isolation

- Remove Credit Studio section 12 (Adviser Recommendation) as an editable surface: `CreditUnderwritingTool` and `underwriting/SummaryPage`.
- Do not write `adviserSummary.recommendation`, `prospect.adviserRecommendation`, or related sign-off fields from Nexus UI.
- Funding proposal HTML used **inside Nexus** and **on David’s right pane** always renders section 8 as awaiting (or omits David’s text).
- Funding proposal PDF **inside the Sterling zip only** is a one-off render that stamps `handoff.recommendation` into section 8 and the sign-off (“For and on behalf of Sterling Commercial Finance”). That PDF is not saved back onto the prospect.

## When a file appears

Replace the standalone Strata push (`POST /api/prospects/:id/strata-packaging` creating a Strata case / embed) as the path that puts work in front of David.

Trigger: the same moment packaging is considered ready today — compiled funding proposal can be built for the prospect. Create or refresh a `broker_handoff` for the configured Sterling `external_broker` user (`BROKER_HANDOFF_EMAIL`). Dashboard lists it immediately.

Do not embed the 10-tab Strata app (`StrataWorkspace`) as David’s workspace. Nexus underwriting may still generate the report; it must not be the place the recommendation is typed.

If a handoff already exists for that prospect and is `sent`, do not silently reopen it. If it is `returned` or `awaiting_recommendation`, refresh documents/report in place.

## Documents and flags

Use `ATTACHMENT_ITEMS` / `resolveAttachmentsChecklist` plus actual uploaded prospect documents.

- On file: checklist tick **or** a matching uploaded file (existing `DOC_FLAGS` / payload mapping).
- Missing: shown as a flag and as Missing on the document list.
- David cannot upload replacements in this build (Nexus chases docs). He can only return the file.

## Approve pack

Templates live in Nexus (copied from `F:\Shaun\Desktop\Strata\strata-general`):

- FFE: `FFE Enterprise Loan Application Fin1 (02.20).docx` and `FFE Client Declaration Fin2 (07.20).docx`
- CWRT: `CWRT Application Form (Feb 26) .xlsm`

Fill logic: port the existing FFE Word fill (`apps/api/app/render/ffe.py` + `word_fill.py`) into a Nexus server module. Payload from `buildStrataPayload` (already maps the Nexus file). One application plus one declaration per director.

CWRT in this build: include the official `.xlsm` unfilled, plus the same report and supporting docs. Do not invent spreadsheet cell mapping here.

Zip contents:

1. Filled FFE docs **or** the CWRT workbook
2. `Funding_Proposal_<company>.pdf` with section 8 stamped from the handoff
3. All uploaded supporting files that exist
4. `STILL-MISSING.txt` listing remaining checklist items (omit the file if none)

Download is the send. No lender email from Nexus.

## Auth and routing

- `external_broker` → `/broker-portal` only. Other authenticated routes redirect there.
- Existing `/api/broker-portal/*` stays session-auth + `external_broker`. Extend with:
  - `GET /api/broker-portal/handoffs` (status, flags, company, dates)
  - `GET /api/broker-portal/handoffs/:id` (file: report HTML or URL, checklist, documents, recommendation)
  - `PUT /api/broker-portal/handoffs/:id/recommendation`
  - `POST /api/broker-portal/handoffs/:id/return` `{ note }`
  - `POST /api/broker-portal/handoffs/:id/pack` `{ lenderId }` → zip stream
- Do not apply IP allowlist to Sterling portal routes. David must be able to sign in from Sterling’s office or home. Session auth + `external_broker` is the gate.

## Out of scope (this build)

- Auto-email to the lender
- Full Nexus lender catalogue on Approve
- CWRT cell-level auto-fill
- David creating/renaming/deleting cases
- David uploading missing documents
- Keeping the standalone Strata web app as a production UI
- Writing recommendation back into Credit Studio after send

## Error handling

- Pack ready but no Sterling user configured (`BROKER_HANDOFF_EMAIL` missing or not `external_broker`): log and skip; do not crash packaging. Surface on underwriting as “Sterling portal not configured”.
- Approve with empty recommendation: 400, overlay does not open.
- Unknown `lenderId`: 400.
- FFE fill failure: 500 with a readable error; status stays `awaiting_recommendation`; no half-sent zip.
- Missing template files on disk: 500 naming the template.
- Download interruption after zip built: retrying pack is allowed; status becomes `sent` only after the zip is successfully generated for return to the client.

## Testing

- Handoff created when packaging is ready; dashboard lists it for the Sterling user only.
- Recommendation PUT stores on the handoff; prospect `adviserRecommendation` / `adviserSummary.recommendation` remain unchanged.
- Credit Studio / Summary no longer expose an editable recommendation control.
- Funding proposal HTML (Nexus) still shows awaiting in section 8 when the handoff has text.
- Pack PDF for FFE includes the handoff recommendation in section 8.
- Flags match unresolved checklist items; Approve still succeeds.
- Return sets status + note; Nexus activity recorded.
- Pack zip for `ffe` contains filled application + declarations + PDF + uploads.
- Pack zip for `cwrt` contains the `.xlsm` template + PDF + uploads, not a filled FFE form.
- `external_broker` cannot load `/pipeline` or `/prospect/:id/underwriting/*`.

## Success

David logs in, sees only Sterling, opens a file, reads the real Nexus report, writes a recommendation, Approves, picks FFE, downloads a zip, and can send it without touching the rest of Nexus. Recommendation is not in Credit Studio.
