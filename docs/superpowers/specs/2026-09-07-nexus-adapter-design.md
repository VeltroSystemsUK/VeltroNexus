# Nexus adapter — Stream A

Date: 2026-09-07  
Status: draft for review  
Repo: Nexus  
Owner: Shaun Tuhey  
Source: `NEXUS_ADAPTER.md` (`nexus.adapter.v1`)  
Consumers: SLF-2 (`slf.agent.v1`), LST-2 (`slf.list.v1`)  
One client: `server/services/slfNexusAdapter.ts`  
One map: `server/Lead Agent/config/nexus_map.yaml`

This is the only place Nexus field names live. Both agents speak adapter language. The adapter speaks Nexus. If Nexus already has an object for a company, nobody creates a second one.

## Locked decisions

- **The book is the Stream A hopper:** `AgenticDealFile` where `stream === "sme"`. Not a new Candidate type. Not InternalLead as a second pipeline. Not a sidecar CRM.
- **`nexus_candidate_id`** = `deal:{id}`.
- **Spine** = `companyNumber`.
- Module **inside** Nexus. Transport is in-process function calls first; HTTP `/api/nexus/v1/*` is the same contract for Mock and for any future sidecar. Do not give either agent its own storage write to deals.
- `create` only after lookup miss **and** SLF-2 human accept. LST-2 default `create_net_new_from_list: false`.
- Neither agent sends mail, starts `sme_1`, or changes `ownerUserId`.
- Idempotency on every mutate. Retries do not duplicate rows.
- Mock Nexus ships so tests do not need a live hopper.

## Who may write what

| Act | SLF-2 | LST-2 | Nexus |
|---|---|---|---|
| List / lookup the book | read | read | owns |
| Create a deal | yes, after accept, miss | no (default) | yes |
| Promote | yes | no | stores intel, may move `nurture`/`gated` → review queue |
| Enrich intel / evidence | yes | mailbox only | stores |
| Intelligence-only on packaging/won | yes | no | stores |
| Attach mailbox | no | yes | stores; Harper still grades sendable |
| Start sequence / send | no | no | SAL-2 |
| Set owner | no | no | Shaun |
| DNC / won / lost | no | reads | Rowan / Shaun |
| Hard-bounce / STOP | no | reads, suppresses address | writes |

New writes go in this spec first. Neither agent grows a private Nexus client.

## Canonical candidate (adapter-facing)

Projected from `AgenticDealFile`:

```json
{
  "nexus_candidate_id": "deal:4418",
  "company_number": "01234567",
  "name": "ACME ENGINEERING LTD",
  "trading_as": null,
  "domain": "acme-eng.co.uk",
  "status": "queued",
  "status_raw": "sendable",
  "owner": "shaun",
  "source": "distress_scan",
  "last_touched_at": "2026-09-07T08:30:00Z",
  "do_not_contact": false,
  "lost_do_not_retry": false,
  "won_at": null,
  "mailboxes": [
    {
      "email": "jane.ellis@acme-eng.co.uk",
      "mailbox_type": "director",
      "verification_status": "deliverable",
      "is_primary": true,
      "source_ref": "https://acme-eng.co.uk/contact"
    }
  ],
  "slf": {
    "score": 82,
    "priority": "hot",
    "primary_product": "hmrc_distress",
    "hypothesis": null,
    "last_package_id": null,
    "last_signal_at": null
  }
}
```

`status` is the canonical enum. `status_raw` is hopper or stage. Never discard it.

### Canonical status ← Nexus

| `status` | Nexus actual |
|---|---|
| `prospective` | hopper `gated` or `hunt_contact` (no first-touch) |
| `queued` | hopper `sendable` or `queued`, outreach not started |
| `nurture` | hopper `parked` (operator/snooze hold) or Openers `not_now` |
| `contacted` | `outreachTouch >= 1` or stage `outreach` |
| `meeting` | stage `human_call` |
| `packaging` | stage `fulfilment` \| `processing` \| `underwriting` \| `human_review` |
| `won` | stage `complete` |
| `lost` | stage `failed` (retry allowed) |
| `dnc` | suppression / Rowan STOP / `do_not_contact` |
| `invalid` | junk resolution / wrong entity |

Unmapped raw statuses ingest as `prospective` and raise a health warning. They must not ingest as `dnc`.

Inbound (`source: strata_inbound`) is **not** this book. Adapter lookup still finds them so SLF-2 / LST-2 never `create` a duplicate; writes are `intelligence_only` or mailbox enrich, never promote into `sme_1`.

### `nexus_map.yaml` (filled from this repo)

```yaml
object:
  candidate: "AgenticDealFile"
  id_prefix: "deal:"
  id_field: "id"
  company_number_field: "companyNumber"
  name_field: "companyName"
  domain_field: "website"
  status_field: "hopper"
  stage_field: "stage"
  owner_field: "ownerUserId"
  last_touched_field: "updatedAt"
  email_field: "email"
  contact_name_field: "contactName"
  stream_field: "stream"
  stream_value: "sme"
  source_field: "source"
  dnc: "suppression + mailbox-clerk STOP"

status_map:
  gated: prospective
  hunt_contact: prospective
  sendable: queued
  queued: queued
  parked: nurture
  quarantine: prospective
  outreach: contacted
  human_call: meeting
  fulfilment: packaging
  processing: packaging
  underwriting: packaging
  human_review: packaging
  complete: won
  failed: lost

source_map:
  distress_scan: slf
  strata_inbound: inbound
  harvest_csv: operator

writes:
  intel_field: "events"          # append AgenticEvent, do not overwrite notes
  mailbox_field: "email"
  contact_field: "contactName"
  score_field: "slfScore"        # additive JSON on the deal when implemented
  product_field: "slfProduct"
```

Until those additive `slf*` fields exist, store package JSON on an event message and/or `lead_finder.db` `nexus_links`. Do not invent a second deal.

Also watched, never duplicated: pipeline `Prospect.companyNumber` (usually `intelligence_only`). `InternalLead.companyNumber` is enrich-only.

## Lookup

Order: `nexus_candidate_id` → `companyNumber` (pad/normalise) → domain (single active SME deal) → normalised name + postcode if present.

- Multiple live SME deals for one company number is a **Nexus data defect**. Return newest non-`dnc`, emit `duplicate_book_rows`. Do not create a third row.
- Name with no number: resolve CH and **PATCH the same deal id**.
- Domain match alone is not enough for a group parent.

Writes always hit live storage. List views may cache 60s.

## decide_action (one function, both agents)

```
if actor == slf.list.v1:
    miss → store_in_list_product_only
    hit  → attach_mailbox

# slf.agent.v1
miss → create_after_accept
dnc / lost_do_not_retry → suppress
meeting / packaging → intelligence_only
won < 18 months → intelligence_only
prospective / queued / nurture + hot|warm → promote
else → enrich
```

Inbound hit → never `create`, never promote onto `sme_1`.

## Writes

Envelope: `nexus.from_slf.v1` with `action` ∈ `create | promote | enrich | intelligence_only | attach_mailbox`.

Idempotency:

```
slf:{company_number}:{package_hash8}
slf-list:{company_number}:{email}:{verify_day}
slf-watch:{company_number}:{on|off}
```

### `create` — SLF-2 only

Payload: `slf.lead_package.v1`. Insert one `AgenticDealFile`: `source: distress_scan`, `stream: sme`, `hopper: gated`. Do **not** start cadence. Reject `409 book_hit` if lookup would now succeed → agent retries as promote/enrich.

### `promote` — SLF-2, book hit still prospective/queued/nurture

Write score, product, evidence, hypothesis onto the existing id. Do not restart `sme_1`. Do not change owner. May leave hopper as-is; “moved” is the SLF review lane, not a new deal.

### `enrich`

SLF-2: package minus outreach-start flags.  
LST-2: use `attach_mailbox`, not this action, for emails.

### `intelligence_only`

Append an event. No hopper/stage change. Notify Shaun if Hot + SIG-02.

### `attach_mailbox` — LST-2 only

Add/update `email` / `contactName` on the existing deal. Do not create. Do not mark personal webmail or role locals as primary. Do not set `hopper: sendable` — Harper/`isSendableContact` does that. Copy `source_explanation` onto an event so first-touch can quote it.

Miss → `404 not_on_book`. List Finder keeps the product row.

Reject `422 pecr_blocked` for individual_subscriber / personal webmail on the ready path.

## Write-back

Poll `storage` deal status every 5 minutes (in-process; HTTP dispositions are the same shape for Mock).

| Event | SLF-2 | LST-2 |
|---|---|---|
| contacted | stop promoting | — |
| meeting / packaging | intelligence_only | — |
| won | suppress create 18 months | — |
| dnc / STOP | hard suppress company | drop all its mailboxes from ready files |
| hard_bounce / complaint / opt_out | — | suppress that email only |
| replied | note | mailbox engaged |

## Local link table

`lead_finder.db` `nexus_links`: company_number, nexus_candidate_id, status, status_raw, owner, last_disposition_at, last_package_id, last_mailbox_attach_at.

On `409 book_hit`, re-lookup and fix the link.

## Errors

Same table as `NEXUS_ADAPTER.md` §11: `400 schema`, `404 not_on_book`, `409 book_hit`, `409 idempotency_conflict`, `409 duplicate_book_rows`, `422 pecr_blocked`, `429`, `5xx` → `accepted_not_pushed` same key.

## Mock

SQLite or in-memory Candidates implementing this contract. Seed: `01234567` = `deal:4418` prospective, plus contacted / packaging / dnc rows.

Acceptance:

1. SLF-2 promote on `deal:4418` leaves id unchanged.
2. SLF-2 create on a new number; replay same Idempotency-Key does not create a second row.
3. SLF-2 create when seed already has the number → `409 book_hit`.
4. LST-2 attach_mailbox on `deal:4418` adds a **director** email; deal count unchanged; hopper not auto-flipped to sendable.
5. LST-2 attach of **guessed** `info@` is rejected. Published `info@` may attach as `mailbox_type: role` and is not primary if a director mailbox exists.
6. LST-2 attach on unknown number → `404`.
7. Disposition dnc removes the company from the next promote list and the next ready file.
8. Hard bounce suppresses that email only.

## Health

Fail if: book_sync_lag > 20 min; unmapped_status_rate > 0; duplicate_book_rows > 0; accepted_not_pushed > 25; creates / (promotes+enriches) > 0.4 over 7 days; LST-2 write that invented a candidate.

## Implementation order

1. `config/nexus_map.yaml` + canonical types.
2. Mock + `decide_action` tests.
3. Adapter client used by both agents.
4. Wire SLF-2 book-sync and promote/enrich/create.
5. Wire LST-2 missing-mailbox pull and attach_mailbox.
6. Additive deal fields for score/product when a package actually lands.

Do not give either agent its own HTTP/storage client to deals.

## What we already know (do not wait)

The downloaded adapter left `nexus_map.yaml` blank. This spec fills it from Nexus as it exists today. Remaining unknowns: licensed verify provider, webhook HMAC (in-process first).
