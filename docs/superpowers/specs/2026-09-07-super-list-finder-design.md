# Super List Finder — Stream A mailbox factory

Date: 2026-09-07  
Status: draft for review  
Repo: Nexus  
Owner: Shaun Tuhey  
Source: `SUPER_LIST_FINDER_AGENT.md` (behaviour), Stream A overlay  
Agent ID: `slf.list.v1`  
Org home: LST-2 desk under RES-2 (feeds Harper; does not replace Harper)  
Sits beside: SLF-2 (`slf.agent.v1`)  
Writes through: `nexus.adapter.v1` only

## Goal

A **lawful list factory** for Stream A. Discover, clean, verify, and grade UK business mailboxes. Attach a usable **director** mailbox onto a company Nexus already has. Deliver a dated list product with a source ledger and a quality report.

It does not send mail. It does not ingest stolen dumps, breach corpuses, or scraped LinkedIn. It does not invent `info@`. It does not open a second Stream A deal.

## Locked decisions (Stream A overlay)

The downloaded handbook prefers role mailboxes (`info@`, `enquiries@`) as the primary outreach address. Stream A **prefers a named director mailbox**. Live hopper code (`isSendableContact`) still accepts a **published** role mailbox on the company domain; Harper must **never invent** `info@`. This agent follows that live gate, not the 2026-09-01 “reject all role locals” line that the tests do not enforce.

- **Nexus attach:** `gradeMailbox !== reject`. Prefer `director` as `is_primary` when both exist. Published role mailboxes may attach as `mailbox_type: role`. Guessed `info@` never attaches.
- **`role_guess: false`** by default. Pattern-guessed `info@domain` stays `guessed_unverified` / F. Catch-all guessed rows never grade A.
- **Do not set `hopper: sendable`.** Harper/`isSendableContact` grades after attach.
- **`create_net_new_from_list: false`.** Lists enrich the book. SLF-2 creates candidates after human accept. This agent does not.
- **Queue-first.** Pull SME hopper rows missing a sendable mailbox before any open-web fetch.
- **Not a property list shop.** Drop `property@` from preferred roles. No Land Registry / planning / bridging panels.
- **Verification** never originates from the Nexus sending domain (`enquiries@stratafinance.co.uk` / SMTP host). Licensed API when a key exists; otherwise watermark `UNVERIFIED-MX-ONLY`.
- **Harper remains the harvest desk.** LST-2 is the factory and ledger. Harper runs domain-lock + SMTP on gated / hunt-contact / quarantine files. Attach writes go through the adapter as `attach_mailbox`; Harper still grades before sendable.

## Non-goals

- Sending email, starting `sme_1`, or changing owner.
- Replacing Harper, Elena, or `shared/pecrSend.ts`.
- “Google a free UK email dump.”
- LinkedIn scrape, unofficial Sales Nav exporters, combo/fullz files.
- Permuting director firstnames onto a domain in v1 (manufactures personal data).
- Stream B introducer lists (separate hunt).
- Auto-creating Nexus candidates from a CSV of emails.

## How the three pieces fit

```
open registers / company sites / operator files / Nexus book
                    │
             Super List Finder (slf.list.v1)
          firewall · resolve · clean · verify · grade · ledger
                    │
     ┌──────────────┴──────────────┐
     │                             │
List product bundle          attach_mailbox
(A director / A-role         on existing SME deal
/ B named / drop)            via nexus.adapter.v1
     │                             │
     └──────────────┬──────────────┘
                    │
                  Nexus
         hopper → Harper grade → SAL-2 sends
```

- **SLF-2** answers *who needs a Stream A conversation now*.
- **LST-2** answers *how we can lawfully reach that company*.
- **Nexus** owns the book and sends.

A verified director mailbox on a book company is **enrich / attach_mailbox**.  
A verified mailbox on a company Nexus has never seen stays in the **list product**. It becomes a candidate only if SLF-2 accepts a timing signal.

Join key: `company_number`. Fallback: normalised domain (not when the domain is a group parent).

## What “need a mailbox” looks like

Primary work queue (book-first):

1. Stream A deals with no email, or email Harper graded `reject` / personal / role.
2. SLF-2 Hot/Warm companies missing a sendable mailbox.
3. Operator CSV of company numbers / names they own.

Not a queue: random UK companies with no SIG-01/SIG-02. This is not a bulk email database product for the open market. ICP for *attach* is the Stream A book. ICP for a standalone list product is operator-declared and still Stream A (ltd/LLP, 12+ months, not broker, not excluded SIC).

## Sources

Allowed: operator CSV, Nexus book, SLF-2 companies, Companies House spine (no emails), company-published contact/about/footer (robots + rate limit), OGL datasets that actually have an email column, licensed finder/verify APIs with an operator key.

Blocked: breach/combo/fullz, “10 million UK emails”, LinkedIn unofficial export, purchased lists with no provenance. `list refuse` is a first-class command.

Companies House does **not** publish a free bulk email file. Say so in the quality report if the operator asks.

## Pipeline

```
ingest
  → source firewall
  → normalise
  → resolve company_number (CH)
  → resolve domain (never invent acmeltd.co.uk)
  → collect published mailboxes only (v1; no role-guess)
  → clean (shared pecr/role rules)
  → classify: director | named_work | role | personal_webmail | disposable | drop
  → verify: syntax → disposable → MX → licensed mailbox (or MX-only watermark)
  → grade
  → dedup vs Nexus / prior products / suppressions
  → package list product
  → adapter attach_mailbox for book hits that pass sendable grade
```

### Clean

Reuse `shared/pecrSend.ts` and `shared/smeHopper.ts` (`isRoleMailbox`, `isPersonalMailbox`, `gradeMailbox`, `directorForEmail`). Do not fork a second role list.

- lowercase, trim, strip `mailto:`
- drop `noreply@` / `donotreply@` / `postmaster@` / `abuse@`
- explode “email1 / email2” cells
- kill rows with no domain and no email
- registry/gov hosts are not company websites (`shared/pecrSend.ts` registry list)

### Grades (Stream A)

| Grade | Definition | File | Nexus attach? |
|---|---|---|---|
| **A** | `gradeMailbox === director`, company_number, deliverable, not catch-all, source ledger complete | `ready_to_import.csv` | yes, primary |
| **A-role** | Published role mailbox, deliverable, company_number, **not guessed** | `ready_to_import.csv` (flagged `mailbox_type: role`) | yes, not primary if a director row exists |
| **B** | Named work mailbox, deliverable, company_number, director match unproven | `named_work_review.csv` | no (Harper/Shaun) |
| **C** | Catch-all or unknown verify, company_number | `risky_hold.csv` | no |
| **D** | Deliverable mailbox, no company_number | `unresolved.csv` | no |
| **F** | Invalid, disposable, personal webmail, suppressed, blocked source, guessed `info@` | `drop` (90 days) | no |

A list product is the bundle: manifest, those CSVs, `quality_report.md`, `source_ledger.csv`, `nexus_attach.jsonl`.

### Verification

Same layers as the handbook. Stream A extras:

- Never SMTP-RCPT from the Nexus sending host.
- Cap concurrency. One verify per address per 30 days.
- If no verify API key: syntax + MX + disposable only, product watermark `UNVERIFIED-MX-ONLY`. MX-pass is not a live inbox.
- Catch-all ≠ deliverable ≠ grade A.
- Nexus hard-bounce / complaint / STOP → suppress that email, never re-emit as A. Soft bounce: re-verify after 14 days, once.

## Compliance

- Role mailbox on a ltd/LLP domain → `corporate_subscriber` but **still not Stream A sendable**.
- Named director at company domain → personal data, LIA `lia.slf.list.b2b.v1`, PECR corporate subscriber if the company is the subscriber; still identify sender and opt-out (Nexus).
- Sole trader / unincorporated / consumer webmail → not `ready_to_import`. `possible_regulated` hold.
- Every attach carries `source_explanation` a first-touch can quote. If we cannot generate that sentence, the row is not send-ready.
- Honour Nexus DNC within 48 hours.

## Tools (v1)

- `list_ingest_file`, `list_pull_nexus_missing_mailboxes`, `list_pull_slf_companies`
- shared `ch_search_companies` / `ch_get_company` / `ch_get_officers`
- `web_fetch_contact_page` `{ domain }` (Phase 3)
- `normalise_row`, `resolve_company`, `resolve_domain`, `classify_mailbox` (wraps `gradeMailbox`)
- `verify_email` `{ email, level: mx|full }`
- `build_list_product`, `nexus_attach_mailboxes` (adapter), `quality_report`
- `list_refuse`

## CLI

```
list ingest ./imports/operator.csv
list run --book-missing --verify mx
list product show ulp_20260907_stream_a
list attach ulp_20260907_stream_a
list refuse ./downloads/uk_emails_10m.csv
list health
```

## Config

`server/Lead Agent/config/list_operator.yaml`

```yaml
verify_provider: mx_only          # neverbounce when key exists
verify_api_key_env: VERIFY_API_KEY
finder_provider: null
max_contact_page_fetches_per_hour: 60
role_guess: false
named_work_in_ready_file: false
personal_webmail_policy: drop_from_ready
role_mailbox_in_ready_file: false
reverify_days: 30
attach_to_nexus_book: true
create_net_new_from_list: false
```

Preferred locals for **published** collection only (not sendable): `enquiries`, `info`, `finance`, `hello`, `contact`. Drop: `noreply`, `donotreply`, `postmaster`, `abuse`. Do not include `property`.

## Gold fixtures

1. Book deal `deal:4418` / `01234567`, contact page publishes `jane.ellis@acme.co.uk`, Jane Ellis is a CH director, MX+deliverable → grade A, `attach_mailbox`, candidate count unchanged.
2. Same company, only published `info@acme.co.uk` (not guessed) → A-role attach allowed; hopper sendable is Harper’s call (live `isSendableContact` is true). Director row, if found later, becomes primary.
3. Guessed `info@` on catch-all → F or C, never A, never attach.
4. File 80k rows, 70% gmail, no company numbers → `list refuse`, empty ready file.
5. MX-only mode watermarks `UNVERIFIED-MX-ONLY`.
6. Personal Gmail never in `ready_to_import`.
7. Hard bounce on `jane.ellis@acme.co.uk` → suppressed, gone from next ready file; company not DNC’d.
8. `create_net_new_from_list: false` → A-grade net-new stays in the product, no new `AgenticDealFile`.
9. Sole trader website, no company number → not corporate_subscriber, not ready.
10. Verification must not use the Nexus SMTP host.

## Phased build

1. Operator CSV + clean + syntax/MX + CH resolve + product bundle. No web fetch.
2. Pull Stream A deals missing a sendable mailbox; attach A-grade director mailboxes only.
3. Contact-page fetcher, book-first, robots + rate limit.
4. Licensed verify adapter.
5. Quality report + `list refuse`.
6. Optional licensed finder API.

Do not start with “search the web for free email databases.” Start with files Shaun owns and the hopper.

## Files

| Path | Role |
|---|---|
| `docs/agentic-org/agents/LST-2.md` | Runtime spec |
| `server/Lead Agent/config/list_operator.yaml` | Operator flags |
| `shared/smeHopper.ts` / `shared/pecrSend.ts` | Classification source of truth |
| `server/services/slfNexusAdapter.ts` | `attach_mailbox` only via this client |

## Success criteria

- Guessed `info@` never attaches. Published role mailboxes may attach; director is primary when both exist.
- Hopper attach never auto-sets `sendable` — Harper grades.
- Book-lane attaches never open a second deal.
- Every A-row has company_number, source URL, verify timestamp.
- Dump-shaped uploads produce a refusal report, not a ready file.
- Quality report can say where each ready address was published.
