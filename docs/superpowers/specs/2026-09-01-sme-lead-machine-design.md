# SME lead machine — P0 hunter, attach, 250 hopper

Date: 2026-09-01  
Status: draft for review  
Repo: Nexus  
Owner: Shaun Tuhey

## Goal

An always-on origination loop that keeps ~250 **sendable** SME directors in the hopper for Strata Finance, using Companies House and the Gazette to find buying signals, then Google Places and Firecrawl only to attach a named director and a corporate mailbox. The existing 50/day `sme_1` cadence and Approve & send button drain it. Landing-page inbound never enters this program and always outranks it.

## Locked decisions

- **P0 only.** No charge/petition, no lead. Places/Firecrawl do not invent companies.
- **SIG-02:** Gazette HMRC winding-up petition, still trading, qualifies with zero charges.
- **SIG-01:** **one** live (unsatisfied) **non-bank** Companies House charge. HP, lease, invoice finance, MCA, specialist, CDFI all count. High-street bank / building-society charges do not.
- **Sales OS hard gates still apply:** **12+ months trading** (Companies House `date_of_creation`; `MIN_TRADING_MONTHS` in `shared/salesOs.ts` is the single source of truth), excluded SIC (property development, finance 64–66, real estate 68, gambling, tobacco, brokers), ltd/LLP, not on book, not suppressed. A petition on a broker or a six-month-old shop is dead.
- **Sendable contact:** current CH director or PSC **and** a company-domain mailbox that is not a personal domain and not a role local (`info`, `sales`, `enquiries`, `admin`, `hello`, `office`, `accounts`). MX required. SMTP handshake optional within budget.
- **Hopper depth:** 250 sendable. Nightly Attach runs only for the shortfall.
- **Ranking:** petition with hearing → petition → more live non-bank charges → fresher charge/petition filing → older company as tie-break.
- **Send:** unchanged `sme_1`, 50/London-day, Shaun approves. Phone later. Introducer hunt stays paused.
- **Inbound / landing pages:** `source: strata_inbound` (and any mailbox/company already on an inbound file or pipeline prospect) are excluded from hunt, Attach, hopper, and the 50 cap. Inbound waiting-you outranks cold Approve & send on the desk.
- **Approach:** extend existing 08:30 CH + Gazette hunt, Elena/contact-finder, and `startSmeOutreachBatch`. No second database, no bulk CH charges file in v1.

## Non-goals (v1)

- A separate Lead Machine process or store.
- Introducer / accountant hunt.
- Landing-page ads or organic capture (already inbound).
- Auto-send. Shaun still approves every cold email.
- Bulk ingest of the UK charges snapshot.
- Geography as a hard gate or rank boost.
- Using Places/Firecrawl as a primary finder of “businesses that look like they need finance”.
- Cold-emailing `info@` or personal mailboxes.

## Architecture

```
08:30 Hunt (database-builder)
  CH new/updated charges + Gazette 2450 HMRC petitions
  → P0 filter (petition OR ≥1 live non-bank charge)
  → Sales OS gates (12+ months, SIC, broker, on-book) + inbound/suppression dedup
  → gated P0 waiting room (no email yet)

Nightly refill (contact-finder / Elena)
  sendable = count hopper
  if sendable < 250:
    take next ranked gated P0s
    Attach: CH officers → Places → Firecrawl → MX → optional SMTP
    success → hopper (sendable)
    miss → hunt-contact (attempt n/5, retry tomorrow)
    5 misses → parked

Morning drain (existing)
  startSmeOutreachBatch / Queue SME emails
  top 50 sendable → sme_1 draft → waiting_human Approve & send
  inbound desk untouched
```

Desks stay RES-2 (Daniel / Elena) and SAL-2 (James). ORC-1 `tick()` already runs; hunt is the existing daily interval, tightened rather than replaced.

## Charge classifier

Pure function, test-first, in shared code (e.g. `shared/chargeClassifier.ts`).

**Live charge:** CH charge status is not satisfied/fully satisfied/released.

**Bank / building-society deny list** (chargee name, case-insensitive, aliases): HSBC, NatWest, National Westminster, Royal Bank of Scotland, RBS, Lloyds, Bank of Scotland, Halifax, Barclays, Santander, Nationwide, TSB, Handelsbanken, Clydesdale, Yorkshire Bank, Metro Bank, Virgin Money, AIB, Bank of Ireland, Danske, Ulster Bank, Co-operative Bank, and obvious “PLC”/“BANK PLC” forms of those names.

**Qualifying:** any other live chargee counts as one non-bank hit. One hit = SIG-01.

Do not require the existing `HIGH_RATE_LENDERS` list. That list may still be used in copy (`lenderLabel`) when the chargee matches, but it is not the eligibility gate.

## Deal states (same `agentic_deals` collection)

No new SQLite table. Additive fields on `AgenticDealFile`:

| Field | Type | Meaning |
|---|---|---|
| `hopper` | `"gated"` \| `"hunt_contact"` \| `"sendable"` \| `"parked"` \| `"queued"` | Machine state. Default omit/undefined for inbound and legacy files. |
| `attachAttempts` | number | Attach nights used. Cap 5. |
| `nonBankChargeCount` | number | Live qualifying charges. |
| `lastSignalAt` | ISO string | Charge created-on or petition presented/published. |
| `contactSource` | `"ch"` \| `"places"` \| `"firecrawl"` | How the sendable mailbox was attached. |

**Mapping to existing stage/status**

| hopper | stage | status |
|---|---|---|
| gated | ingest or enrich | waiting_timer |
| hunt_contact | enrich | waiting_timer (Elena) |
| sendable | outreach | waiting_timer or idle in hopper (not yet first-touch) |
| parked | failed | failed — reason “no director mailbox after 5 attach nights” |
| queued | outreach | waiting_human — `Approve this email to …` |

Inbound files must not receive a `hopper` value. `startSmeOutreachBatch` only picks `hopper === "sendable"`.

## Dedup keys

Skip hunt/Attach/hopper if any match:

1. Company number already on an open or completed agentic deal (any stream).
2. Company number on a pipeline prospect / booked client (`loadBookedCompanyNumbers`).
3. Email already on an inbound deal or converted lead.
4. Suppression / unsubscribed (when a list exists).
5. Same company number already `sendable` or `queued`.

Normalise numbers (uppercase, 8-digit pad where numeric).

## Attach waterfall

Only gated P0s that still lack sendable contact. Stop at first success.

1. CH officers + PSC (current only). Keep names for pattern tests.
2. Google Places: company name + registered town. Keep website, phone, email only if company-domain and matches director first name or unique last name.
3. Firecrawl website: `/`, `/contact`, `/about`, `/team`. `mailto:` and `firstname@domain` with the same match rule.
4. MX. Reject personal domains (`shared/pecrSend.ts`) and role locals (extend the existing role set used in SME outreach).
5. SMTP RCPT only if MX passed and nightly SMTP budget remains.

Success: set `contactName`, `email`, `website`/`phone` if found, `contactSource`, `hopper: sendable`.  
Fail: `attachAttempts += 1`; if `< 5` then `hopper: hunt_contact` and `waitUntil` tomorrow; else `hopper: parked`.

## Nightly budgets (hard stop)

| Tool | Cap / night | Rule |
|---|---|---|
| CH (profile + officers + charges) | 400 companies | 429 → wait 60s; still limited → end night |
| Google Places | 100 | Only shortfall toward 250 |
| Firecrawl | 50 | Last resort |
| SMTP handshake | 50 | Never spray |

If hopper already has 250 sendable, Attach does not run. Hunt may still add `gated` P0s for the next night.

## Ranking (sendable only)

Sort key, descending usefulness:

1. Has HMRC petition with `hearingAt`
2. Has HMRC petition without hearing
3. `nonBankChargeCount`
4. `lastSignalAt` (newer first)
5. Incorporation date (older first)

`startSmeOutreachBatch` takes the top 50 of that list subject to `remainingSmeFirstTouchSlots` (already 50/London-day, counting waiting approvals + Day-1 sends).

## What Shaun sees

Workforce Deal files (and/or a thin hopper strip on that panel):

- Sendable: n / 250
- Hunt-contact: n (attempt shown)
- Parked: n
- Inbound files remain on the inbound desk only
- **Approve & send** unchanged for cold `sme_1`

## Failure modes

| Event | Behaviour |
|---|---|
| CH 429 | 60s backoff; abort remaining hunt/Attach for the night |
| Places/Firecrawl error | Skip that company; retry next night (counts as an attach attempt only if that step was the one running and returned a hard failure after retries) |
| SMTP timeout | Not sendable; do not increment past MX-fail into parked in the same night unless attempts already at 5 |
| Duplicate inbound mailbox | Drop from this program |
| Hopper full | Hunt may continue into `gated`; Attach idle |

## Tests (must exist before wiring)

- `isNonBankCharge(chargee)` deny-list and alias cases.
- `isP0({ petition, liveNonBankCharges })` — one non-bank yes; bank-only no; petition yes.
- Sales OS gates still reject brokers, companies under 12 months, excluded SIC. A 13-month-old company with one live non-bank charge passes age.
- `isSendableContact({ directorNames, email })` — named director + corporate MX domain; reject gmail and `info@`.
- Hopper rank order fixture (hearing > petition > 3 charges > 1 charge > recency).
- `startSmeOutreachBatch` ignores inbound and `hunt_contact` / `parked`.
- Dedup: company number on inbound deal is not hunted.
- Refill: at 250 sendable, Attach is not called.
- Attach attempt cap: 5th miss → parked.

## Files (implementation, not this spec)

- `shared/chargeClassifier.ts` — new, pure.
- `shared/smeOutreach.ts` — sendable predicate, hopper rank, pick from `hopper === "sendable"`.
- `shared/agenticWorkflow.ts` — additive deal fields.
- `shared/salesOs.ts` — `MIN_TRADING_MONTHS = 12`; SIG-01 is one live non-bank charge at P0 (do not fork a second matrix).
- `server/services/signalHarvest.ts` / `agenticWorkflow.ts` — hunt filter + refill job.
- `server/services/agenticWorkflow.ts` `completeContact` / Attach waterfall budgets.
- `client/src/components/agentic/DealFilesPanel.tsx` — hopper counts.
- Tests under `server/__tests__/shared/` and service tests for hunt/refill.

## Success criteria

- Hopper holds up to 250 sendable directors who each have a P0, passed gates, and a named director corporate mailbox.
- Morning queue of ≤50 `sme_1` drafts, Shaun still approves.
- Zero inbound company numbers in that queue.
- Places/Firecrawl nightly counts stay within the caps.
- No new datastore.

## Open points (explicitly not blocking v1)

- Exact bank-alias spellings beyond the deny list above can be extended in code without a spec change.
- CH charges harvest source remains the current distress-scan / lead-finder charge path; bulk snapshot is v2 if 250 sendable cannot be filled.
