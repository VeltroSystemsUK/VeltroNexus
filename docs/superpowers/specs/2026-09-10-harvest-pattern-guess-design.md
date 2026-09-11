# Harvest pattern guess — domain + name, bounce is the ping

Date: 2026-09-10  
Status: draft for review  
Repo: Nexus  
Owner: Shaun Tuhey  
Desk: Harper Cole (`harvest`) under RES-2  
Related: `docs/superpowers/specs/2026-09-01-sme-lead-machine-design.md`, `docs/agentic-org/agents/RES-2.md`

## Goal

Raise Harper’s mailbox yield on Stream A files that have a **company domain** and a **named person** but no published mailto. Construct one director-format address per harvest pass. James sends it. A **hard bounce** is the ping: that mailbox is suppressed, Harper takes the next format. Never invent `info@`. No paid verifier (ZeroBounce / Apollo) in this pass.

## Why yield is low today

Harper already permutes `first.last` / `flast` / `first`, but **only** when MX is not Google, Microsoft, Mimecast, or Proofpoint, and only when SMTP says the domain is not catch-all. Most UK SMEs sit on Google Workspace or Microsoft 365. Those hosts do not answer RCPT. Harper treats SMTP as `unknown` and does not guess. The file goes to quarantine.

ZeroBounce is in the stack and unused on this path. This spec does not wire it. Bounce from live mail is the verifier.

## Locked decisions

- **Published still wins.** If scrape / Places / OSINT / Wayback already has a company-domain mailbox, attach that. Do not guess over a mailto.
- **Named person only — the company’s own officers.** Guessed locals are built from `directorNames` already on the file (current Companies House officers Harper fetched), or else a named contact found on Places/the site for **that** company. Never a dummy, never a generic “John Smith”, never `info@`, never a role local. `John Smith` / `acme.co.uk` in this spec is a worked example of the *format*, not an address anyone sends.
- **One constructed address per harvest pass.** Never spray six variants in one night.
- **Six formats** from that person’s forename + surname and the company’s domain. Example only, `John Smith` at `acme.co.uk`:
  1. `john.smith@` (`first.last`)
  2. `jsmith@` (`flast`)
  3. `john@` (`first`)
  4. `johnsmith@` (`firstlast`)
  5. `j.smith@` (`f.last`)
  6. `johns@` (`firstl`)
  Live: if the officer is `Jawad Moin MEHROOF` and the domain is `ihsanpharma.co.uk`, the first guess is `jawad.mehroof@ihsanpharma.co.uk`, not `john.smith@…`.
- **Attach cap 6** (`SME_ATTACH_ATTEMPT_CAP`). Sixth miss → quarantine. (Was 5; raised so `firstl` can run.)
- **Free SMTP ping stays** on hosts that answer (`mxFamily === "other"`). Catch-all → do not guess. Not catch-all → attach only if that candidate is deliverable.
- **Mute MX** (Google / Microsoft / Mimecast / Proofpoint): skip SMTP. Attach the first untried format as `contactSource: "domain"`, grade `director`, confidence 75 (send floor). James may send it.
- **Hard bounce is the verifier.** Existing mail desk: suppress that address only (not org DNC), strip deal email, `hopper: hunt_contact`. Next harvest skips suppressed addresses and takes the **next** format.
- **Soft bounce does not advance** the format.
- **MX must exist.** No domain, no guess.
- **No new tried-mailboxes field.** Memory is the hard-bounce suppression list plus hopper state (`sendable` is not re-harvested).
- **Guessed-cohort circuit breaker.** Among the last 50 outbound mails stamped as a domain guess, if hard bounces ≥ 8 (≥ 15%), Harper stops constructing addresses. Published harvest continues. Shaun lifts the pause; it does not auto-resume (or the pause would deadlock).
- **Catch-all on mute MX is accepted.** Mail may be accepted and never bounce. This path does not pay to detect that.

## Non-goals (this pass)

- ZeroBounce or Apollo on Harper.
- LST-2 list products, LinkedIn, purchased dumps.
- Guessing `info@` / role locals.
- New agent, mailbox, SQLite table, or hopper screen.
- Raising `HARVEST_PER_HOUR` or the 45s attach timeout.
- Changing PECR, STOP fan-out, or Clients contacted derivation.

## Architecture

```
gated / hunt_contact / quarantine (no sendable mailbox)
  → officers (existing)
  → domain: file website → Places → OSINT site → DNS name candidates
  → published scrape (Firecrawl / Wayback / OSINT emails)  [stop if sendable]
  → if domain + person and guessing not paused:
        skip suppressed
        lock format if a published local taught it
        else walk the six formats
        honest SMTP: catch-all gate + ping
        mute MX: attach first remaining candidate
  → hopper sendable  OR  attachAttempts+1 (cap 6 → quarantine)

James sends (existing)
  → hard bounce → suppress mailbox → strip → hunt_contact
  → Harper’s next pass takes the next format
```

Harper remains the desk. `attachOne` in `server/services/smeLeadHopper.ts` grows; it is not a second harvest worker.

## Domain

Stop at the first usable host: has MX, not a registry/gov/directory host (`isBlockedOutreachHost` / existing registry list).

1. Website already on the file.
2. Google Places (existing), when the file has no site.
3. OSINT search (existing Firecrawl search / DuckDuckGo). First company-looking website, never Endole/CH.
4. **DNS candidates from the legal name** (new). From `Acme Joinery Limited` try, in order:
   - concatenated distinctive tokens + `.co.uk` (`acmejoinery.co.uk`)
   - hyphenated distinctive tokens + `.co.uk` (`acme-joinery.co.uk`)
   - concatenated + `.com` (`acmejoinery.com`)
   First host with MX that belongs to the company (`emailMatchesCompany` on that host vs legal name) wins. No crawl. Not an `info@` guess.

Never treat a Companies House or Endole URL as the company website.

## Person

Need a forename and a surname **from this company**. No placeholder person.

1. Current CH officers already on the file, else fetch (existing). Display names already un-invert `SMITH, John`. If there is no officer name, there is no guess.
2. Else a named contact from Places/site scrape (not “Team”, not “Director”, not a generic word in `GENERIC_CONTACT_WORDS`).
3. At most **two** people on the file (existing officer cap). **Guess walk is the primary director only.** A second officer may still match a published mailbox or teach a format lock. Walking six formats for two people would be twelve live sends; the attach cap forbids it.

If domain + person → pattern guess after published scrape fails.  
If domain but **no** person → published **role** mailbox only (today’s `tryGrade("role")`). Do not guess `info@`.  
If person but **no** domain → fail the pass (quarantine / retry), same as now.

## Format lock and walk

`MailboxPattern` becomes:

`"first.last" | "flast" | "first" | "firstlast" | "f.last" | "firstl"`

`inferMailboxPattern` must detect all six from a published local (skip role locals). If a published mailbox on the domain matches a format, **lock that format** and do not walk.

`contactMailboxGuesses(domain, directorNames, pattern?)`:

- Use `directorNames[0]` only (primary).
- If `pattern` is set, emit only that format.
- If unset, emit the six formats in locked order.
- Never emit a `ROLE_LOCALS` local.
- Skip personal / blocked hosts.

`attachOne` takes the **first** guess that is not suppressed and passes the MX/SMTP rules below. One attach per pass.

## Attach rules

| MX family | Catch-all probe | Person ping | Attach guessed? |
|---|---|---|---|
| `other` (SMTP-honest) | Two nonsense locals (existing `nx-no-box-strata@`) | SMTP RCPT | Only if not catch-all **and** candidate is `deliverable` |
| google / microsoft / mimecast / proofpoint | Skip (returns unknown; do not treat as catch-all) | Skip | First untried candidate if MX exists |

Mute-MX guess scoring: `mailboxConfidence` must be ≥ `MAILBOX_SEND_FLOOR` (75) for `source: "domain"` + mute family + `smtp: unknown`. Catch-all on honest SMTP still does not attach a guess.

`contactSource: "domain"`. Grade `director`. Hopper `sendable` as today.

## Bounce memory

No new deal field. Hard bounce already:

1. `addSuppression({ email, reason })` — that mailbox only.
2. Clears `deal.email`, sets `hopper: "hunt_contact"`.
3. Harvest candidate again on the next pass.
4. `attachOne` already skips addresses in `suppressionSets().emails`.

Therefore the next pass must **generate the full six**, skip suppressed, attach the next remaining. It must not rebuild `john.smith@` after that address is suppressed.

Soft bounce: do not suppress, do not strip, do not advance.

## Circuit breaker

Stamp origin at send: when outbound Agent Mail is logged for a deal with `contactSource === "domain"`, persist `contactSource: "domain"` on that mail row so the join survives a later bounce strip.

Each harvest pass (and hunt quality):

- Take the last 50 outbound items (`sent` or `mock`) with `contactSource === "domain"`.
- If fewer than 50, do not trip.
- If hard-bounce suppressions among those recipients ≥ 8, set pause.

Pause store: `uploads/harvest_guess.json`

```json
{ "paused": true, "at": "ISO", "bounced": 8, "sampled": 50 }
```

While `paused`:

- Harper still scrapes and attaches **published** mailboxes.
- `contactMailboxGuesses` is not used.
- Hunt quality amber: constructed-mailbox bounce rate tripped guessing. Published harvest continues.

Lift: `POST /api/agentic/harvest/resume-guess` (authenticated) sets `paused: false`. One control on the existing Deal Files quality alert — not a new page. Pause does not clear itself when new published mail is sent.

## Quality and desks

- `shared/smeQuality.ts` exposes the pause as a quality alert (tone amber).
- RES-2 / Harper docs: one line — guess named director formats on a live MX domain; bounce is the ping; never `info@`.
- SAL-2 send path unchanged. James does not know the address was constructed.
- Clients contacted rule unchanged: a successful send still shows on Clients.

## Failure modes

| Event | Behaviour |
|---|---|
| No MX on candidate domain | Skip that host; do not attach. |
| Catch-all on honest SMTP | Do not guess. Published only. |
| Mute MX | Attach next format; no SMTP. |
| Hard bounce | Suppress that address, strip, next format on next pass. |
| Soft bounce | Do not advance format. |
| Guessed bounce rate ≥ 8 / 50 | Pause guessing; published continues; amber alert. |
| 6th miss | Quarantine (`SME_ATTACH_ATTEMPT_CAP = 6`). |
| 45s attach timeout | Fail the pass as today; do not leave a half-guessed email on the file. |
| Circuit breaker on | Guesses not constructed. |
| Registry / Endole host | Never used as the domain. |

## Tests (write these first)

- Six-format order for `John Smith` @ `acme.co.uk`, including `johns@`.
- Guesser never emits `info@` or other role locals.
- Guesses use the primary director only; a second officer is not walked.
- Published `jane.smith@` locks `first.last` for the director; does not walk.
- Google MX + director + empty scrape → attaches `john.smith@`, hopper `sendable`, confidence ≥ 75, **no** SMTP probe of the person (nonsense catch-all probes also skipped).
- Same file after `john.smith@` is suppressed → attaches `jsmith@`, never `john.smith@` again.
- After formats 1–5 suppressed → attaches `johns@`.
- Honest SMTP catch-all → no guess.
- Honest SMTP not catch-all + deliverable `jsmith@` → that address, not a later format.
- Legal name `Acme Joinery Limited` + MX only on `acmejoinery.co.uk` → that domain when Places/OSINT gave nothing.
- Registry host never becomes the domain.
- Circuit breaker trips at 8 hard bounces in 50 domain-source sends; does not trip at 7; does not trip before 50; does not block a published mailto while paused.
- Resume endpoint clears pause so the next pass may guess again.
- Cap 6: sixth miss → quarantine.
- Existing scrape / OSINT / Wayback attach tests still pass.

## Files (implementation, not this spec)

- `shared/companyMailbox.ts` — six patterns, lock, guesses, DNS name candidates (pure).
- `shared/mailboxScore.ts` — mute-MX director guess hits send floor 75.
- `shared/smeHopper.ts` — `SME_ATTACH_ATTEMPT_CAP = 6`.
- `server/services/smeLeadHopper.ts` — `attachOne` permute on every MX family; one candidate; skip suppressed; DNS domain when Places/OSINT gave no site; honour pause.
- `shared/smeQuality.ts` — breaker input + amber alert.
- `server/services/email.ts` / Agent Mail log — stamp `contactSource` on outbound when the deal’s source is `domain`.
- `server/routes/agenticWorkflow.ts` — `POST /api/agentic/harvest/resume-guess`.
- `client/src/components/agentic/DealFilesPanel.tsx` — resume action on the existing quality alert.
- `docs/agentic-org/agents/RES-2.md` — one Harper line.
- Tests under `server/__tests__/shared/` and `server/__tests__/services/smeLeadHopper.test.ts`.

## Success criteria

- A Google-Workspace SME with a known domain and a named director, and no mailto, becomes `hopper: sendable` with `john.smith@domain` on the first guess pass.
- A hard bounce of that address yields `jsmith@domain` on the next pass, not a repeat of `john.smith@`.
- `info@` is never attached as a guess.
- Published mailtos still attach first and still attach while guessing is paused.
- Guessing pauses after 8 hard bounces in 50 guessed sends and stays paused until Shaun resumes.
