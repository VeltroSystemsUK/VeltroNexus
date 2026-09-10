# Super Lead Finder — Stream A (Strata SME)

Date: 2026-09-07  
Status: draft for review  
Repo: Nexus  
Owner: Shaun Tuhey  
Sources: `SUPER_LEAD_FINDER_AGENT.md` (behaviour), `SUPER_LEAD_FINDER_SPEC.md` v1.1 (Nexus contract), `NEXUS_ADAPTER.md` (door), `SUPER_LIST_FINDER_AGENT.md` (mailbox factory, Stream A overlay)  
Agent ID: `slf.agent.v1`  
Org home: RES-2 desk, not a new department

## Goal

Upgrade the existing Lead Finder Agent from a Google Maps hunter into an always-on **Stream A intelligence agent**. It watches the **existing Nexus Stream A book** first and the open market second. It detects commercial-debt-stress timing signals (live non-bank charge, HMRC petition), scores them with Sales OS, writes an evidence-backed hypothesis, and on human accept **promotes or enriches a name already in Nexus**. Net-new creates are the exception.

Finder finds, interprets, ranks, and packages. Nexus owns the candidate book, sequences, and outreach. The agent never sends a client-facing message. The agent never creates a parallel queue of the same people.

## Locked decisions

- **Stream A only.** Direct UK SME directors. Facility £25,000–£250,000. Turnover £250k–£5m. Trading ≥ 12 months (`shared/salesOs.ts`). Stream B introducers are out of this agent.
- **Not a property packager.** No planning, EPC, MEES, Land Registry, bridging take-out, development exit, green capex, or commercial-property ownership as a lead. High-street charge ageing is **not** a lead.
- **Queue-first (SPEC v1.1).** The Stream A book is `AgenticDealFile` where `stream === "sme"`. Finder treats that hopper as the primary watchlist. It writes signals onto those records. `create` only after `nexus_lookup` miss **and** human accept.
- **Module inside Nexus.** Not a sidecar. Home: `server/Lead Agent/` plus one adapter file. Spine key: Companies House number.
- **Sales OS is the scoring source of truth.** Do not fork SIG weights into prompts. Handbook 0–100 is a **display rank** derived from Sales OS + freshness + resolution, not a second matrix.
- **Human in the loop.** `auto_push: false`. Reviewer is Shaun. Distressed product **on** (SIG-02 is the primary buying signal).
- **Brand in opening lines:** Strata Finance. Tone: British English, specific, non-predatory on distress.
- **08:30 hunt stays until this queue is live.** Do not starve the hopper by putting every file behind accept on day one. `slf accept` now writes live Deal Files: net-new → `hopper: gated`; book-lane → enrich the existing deal.
- **Maps is not a finder.** Google Places / Firecrawl remain Elena/Harper attach tools after accept. Lead Finder must not invent companies from Maps.

## Non-goals (this spec)

- Property Phase 5 from the product spec (planning, EPC, landreg, auction catalogues).
- Stream B introducer hunt (SIG-05).
- Sending email, LinkedIn, SMS, or voice.
- Underwriting or a credit paper.
- Replacing Deal Files, hopper, or `sme_1` cadence.
- LinkedIn scraping, CoStar, Rightmove, EGI.
- Consumer / sole-trader origination (tag `possible_regulated: true` and hold).
- Auto-push.
- Rewiring the 08:30 hunt in v1.
- A second Postgres. Use `lead_finder.db` for signals; Nexus deals remain the candidate book.

## What “need” looks like (Stream A)

A timing signal, not “company exists”:

| Need | Sales OS | SLF `signal_type` |
|---|---|---|
| Live non-bank CH charge (HP, lease, invoice finance, MCA, specialist) | SIG-01 | `charge.created` / `charge.multiple_outstanding` |
| Gazette HMRC winding-up petition, still trading | SIG-02 | `gazette.winding_up_petition` |
| Late accounts / interest spike (P1, not a hunt gate) | SIG-04 later | `accounts.late` / `accounts.interest_spike` |
| Operator watch | — | `manual.operator_flag` |

**Need is not:** high-street-only charge; dissolved; broker; excluded SIC (64–66, 68, 92, 12, 41100, …); trading &lt; 12 months; SIG-06; just-cleared non-bank book with no petition; generic Gazette name.

## Product tags (Stream A)

The handbook’s eight property families are **not used**. Classifier is rules, not the LLM:

```
if distressed enabled and (HMRC petition or CH insolvency) and still trading:
    primary = hmrc_distress
elif live non-bank charges >= 3:
    primary = stacked_debt
elif live non-bank charges >= 1:
    primary = high_cost_refi
else:
    not a lead
```

Secondary: the other rule that also fired. Max one secondary.

## Architecture

```
Nexus Stream A book (agentic deals stream=sme)
        │  poll 15 min + on hunt cycle
        ▼
Super Lead Finder
  sources: CH REST (v1), Gazette (v1), manual ingest
  store:  lead_finder.db  (signals, aliases, suppressions, audit — NOT a rival pipeline)
  score:  shared/salesOs.ts + shared/chargeClassifier.ts + display rank
  queue:  Book moved | New names     hot / warm / watch / unresolved / suppressed
        │
        ▼  Shaun A / R / S
slf.lead_package.v1  (schema gate)
        │
        ▼
slfNexusAdapter  (the only Nexus mapping file — see 2026-09-07-nexus-adapter-design.md)
  promote | enrich | intelligence_only | create
  LST-2 attach_mailbox (director primary; published role allowed; never guessed info@)
        │
        ▼
Nexus hopper deal  → RES-2 attach (Elena/Harper) → SAL-2 sme_1
```

### Book mapping (do not invent a second object)

| SPEC name | Nexus actual |
|---|---|
| Prospective candidate queue | `AgenticDealFile` `stream === "sme"` |
| `nexus_candidate_id` | `deal:{id}` |
| Spine | `companyNumber` |
| Prospective / queued | hopper `gated` \| `hunt_contact` \| `sendable` \| `queued` |
| Contacted / in sequence | stage `outreach` or `outreachTouch >= 1` |
| Meeting / packaging | stage `fulfilment` \| `processing` \| `underwriting` \| `human_review` |
| Won | stage `complete` |
| DNC | suppression / Rowan stop / `do_not_contact` |
| Net-new `create` | new deal `source: distress_scan`, `stream: sme`, `hopper: gated` |

Also watched, never duplicated: pipeline `Prospect` with a company number (usually `intelligence_only`). `InternalLead` with a company number is enrich-only, not a second Stream A file. Inbound (`strata_inbound`) is excluded from hunt and from New names.

### Action table (SPEC §8.0, Stream A)

Before any write, `nexus_lookup(company_number)`:

| Nexus already has | Finder action |
|---|---|
| SME deal, not yet contacted | `promote` if new Hot/Warm signal, else `enrich` |
| Contacted / in `sme_*` cadence | `enrich` (do not restart the sequence) |
| Fulfilment / processing / underwriting | `intelligence_only` |
| Complete / won &lt; 18 months | `intelligence_only` |
| Failed, retry allowed, new timing signal | `promote` |
| DNC / lost-do-not-retry | hard suppress |
| No record | `create` after human accept |

Human accept of a book-lane item **never** calls `create`.

## Scoring

Gate first with Sales OS (`scoreSignals`, `excludedSectorReason`, `isBrokerProspect`, `MIN_TRADING_MONTHS`). Fail the gate → drop / suppress. Do not queue.

Display rank (explainable, config weights in `server/Lead Agent/config/weights.yaml`):

```
rank = clamp(0, 100,
    Σ (weight_i × freshness_i × resolution_i)
  − suppression_penalty
)
```

Starter weights (Stream A only):

| signal_type | weight |
|---|---|
| `gazette.winding_up_petition` (HMRC, still trading) | 95 |
| `ch.insolvency_case` | 90 |
| `charge.multiple_outstanding` (3+ live non-bank) | 70 |
| `charge.created` (live non-bank) | 50 |
| `accounts.interest_spike` | 40 |
| `accounts.late` | 25 |
| `manual.operator_flag` | 100 |
| `charge.just_refinanced` | suppress 90 days |
| `nexus.do_not_contact` | hard suppress |
| `company.dissolved` | drop |
| `charge.high_street` alone | **0 — not a lead** |

Freshness: 7d=1.0, 30d=0.7, 90d=0.4, 365d=0.15, else 0. Exception: live outstanding non-bank charges do not decay while unsatisfied.

Resolution: 1.0 if company match ≥ 0.9, else 0.5 and priority cannot exceed `watch`.

Priority:

- `hot` — SIG-02, or SIG-01 with ≥ 3 live non-bank charges, or rank ≥ 75 with a Tier-A signal
- `warm` — SIG-01 (one or two live non-bank charges)
- `watch` — P1 only (late accounts / SIG-04), no P0
- `noise` — no timing signal (store, do not queue)

ICP multiplier is 1.0 inside Sales OS appetite, 0 out. There is no “adjacent property” band.

## Entity resolution

Same recipe as the agent handbook §9, minus property hints:

1. Company number in source → 1.0
2. Exact registered name + jurisdiction
3. Normalised name + town/postcode
4. Fuzzy name + officer + town
5. Gazette mention + unique uncommon name

Below 0.85 → `unresolved` with top 3 CH candidates. Never Nexus. Reviewer “this is 01234567” writes a permanent alias.

Never guess among five “Premier Properties Ltd” companies.

## Lead package

Canonical name stays `slf.lead_package.v1`. Stream A differences vs the downloaded schema:

- `action` enum includes `promote` (SPEC v1.1), not only `create | enrich | intelligence_only`
- `fit.primary_product` enum: `hmrc_distress | stacked_debt | high_cost_refi`
- `fit.facility_size_band`: `25_100k | 100_250k | unknown` (out of appetite is not packaged)
- `book_lane`: `existing_queue | net_new`
- `nexus_candidate_id` required on book-lane packages
- `assets[]` optional and usually empty (no property join)
- Hypothesis 80–140 words, every factual clause in `grounding_map[]`
- Invalid packages never leave Finder

Idempotency: `slf:{company_number}:{sha1(company_number + sorted_event_ids + primary_product)[:8]}`

Adapter path: `POST` handled inside Nexus by `server/services/slfNexusAdapter.ts`. Do not invent `/api/nexus/v1/leads/from-slf` as a public gateway until the adapter exists; the adapter is the contract.

## Compliance

Compute `outreach_brief.compliance`; do not let the LLM free-type lawful basis.

- Public registers + company ROA → `legitimate_interests_b2b`, `corporate_subscriber`
- Personal Gmail/mobile only → cannot recommend `email`; flag `ctps_required` for phone (Nexus job)
- `possible_regulated: true` → hold, do not recommend unregulated product language
- LIA reference `lia.slf.b2b.v1` in audit metadata
- Distress `opening_line` offers a conversation. Never announce the petition as a sales hook.

## Operator loop

Two lanes: **Book moved** (already a Stream A deal) and **New names**.

```
for lead in Hot then Warm:
    read hypothesis (5s)
    scan evidence (10s)
    A accept | R reject+reason | S snooze 7/30/90 | E edit hypothesis
    on accept → validate schema → adapter → status=pushed
```

Rejected reasons: `out_of_appetite`, `already_known`, `too_small`, `too_early`, `too_late`, `wrong_asset`, `competitor`, `junk_resolution`, `other`.

Snooze is not reject. A snoozed petition re-enters if still qualifying.

v1 surface: CLI (`slf ingest|queue|show|accept|reject|snooze|digest`). Thin review UI on `LeadFinderTab` later. Keyboard A/R/S is a later console pass.

## Daily loops (v1)

| Job | Cadence | Notes |
|---|---|---|
| Pull Stream A book | 15 min | Required before a hunt cycle |
| Gazette HMRC petitions | 15–60 min | Existing `gazetteClient` |
| CH REST enrich on book + ingest | on demand + nightly | No stream listener required in v1 |
| Score recompute | on new event | Sales OS + display rank |
| Morning digest | 06:30 Europe/London | Hot first, then Warm, cap 80 |
| Disposition poll | 5 min | Suppress / intelligence_only |
| Charge-ageing of **non-bank** live charges | 06:15 | Not high-street term-curve |

Do not ship Reddit/X/news until CH + Gazette + adapter are boring. Do not ship planning/EPC.

## Config (never hard-code)

Under `server/Lead Agent/config/`:

- `operator.yaml` — brand Strata Finance, owner Shaun, timezone Europe/London, `auto_push: false`, `distressed_product: true`, facility 25000–250000, reviewer shaun
- `icp.yaml` — include ltd/llp; exclude dissolved; exclude Sales OS SICs; `min_company_age_months: 12`; `exclude_if_only_signal: [company_exists, charge.high_street]`
- `lenders.yaml` — **non-bank / high-cost** panel for copy (`HIGH_RATE` style). High-street list is a **deny list for SIG-01**, not a refinance-switch panel
- `intent_phrases.yaml` — MCA, stacked debt, HMRC, Time to Pay, refinance expensive facilities. No bridging-exit / industrial unit seeds
- `weights.yaml` — table above
- `sources.yaml` — CH REST, Gazette; social/planning/epc = stub

## Gold fixtures (acceptance)

Product tag and priority must match. Hypothesis wording may differ.

1. **One live MCA, unique company, not on book** → Warm `high_cost_refi`, `book_lane=net_new`, action `create` only after accept.
2. **HMRC petition, unique name / number, still trading** → Hot `hmrc_distress`, non-predatory opening line, evidence URL is the Gazette notice.
3. **Three live non-bank charges** → Hot `stacked_debt`.
4. **All non-bank charges satisfied in the last 60 days, new high-street charge, no petition** → `charge.just_refinanced`, suppressed 90 days, not in Hot/Warm.
5. **Gazette “Premier Properties Limited”, no town, no number** → unresolved, top 3 candidates, never Nexus.
6. **Existing hopper deal + new petition** → `book_lane=existing_queue`, action `promote` or `enrich`, never `create`.
7. **Nexus DNC write-back** → further signals attach internally; action never `create` / `promote`.
8. **High-street-only outstanding charge, 5.1 years old, no petition** → not a lead (this is the property fixture, inverted).
9. **Broker name or SIC 64921** → drop.
10. **Trading 6 months + live non-bank charge** → drop (age gate).
11. **Hypothesis cites a date not in evidence[]** → validation fail.
12. **Only personal Gmail on file** → `channel_recommendation` cannot include `email`.
13. **Same package posted twice** → one Nexus deal.
14. **CH 429** → backoff, health=degraded, no crash.

## Phased delivery

### Phase 0 — Contract and identity

System prompt, org spec, config, package JSON Schema, mock adapter, empty signal tables.

**Exit:** paste a company number into CLI and see a lead shell.

### Phase 1 — CH spine

`ch_get_company|charges|officers|psc|filings|insolvency|search`. Charge parse via `chargeClassifier` (non-bank vs bank). Manual `slf ingest company`. Display rank + product tag.

**Exit:** ingest a number, see live non-bank charges, SIG-01/none, score, product tag.

### Phase 2 — Gazette + resolution

Reuse `server/utils/gazetteClient.ts` and `shared/distressSignals.ts`. Unresolved queue. Distress templates.

**Exit:** yesterday’s HMRC petition with a unique name lands Hot within 2 hours, evidence URL present.

### Phase 3 — Package + Nexus adapter

`build_package`, schema gate, accept CLI, `slfNexusAdapter` promote/enrich/create, disposition write-back, idempotency.

**Exit:** accept a New name → gated SME deal; accept a Book moved item → no second deal; DNC suppresses.

### Phase 4 — Operator harden

Morning digest, source health, audit log. Optional thin `LeadFinderTab` review lanes. Then consider pointing 08:30 hunt at this store.

**Not in this spec:** news/Reddit/X, planning, EPC, auto-push, Stream B.

## Files

| Path | Role |
|---|---|
| `docs/superpowers/specs/2026-09-07-super-lead-finder-design.md` | This spec |
| `docs/agentic-org/agents/SLF-2.md` | Runtime agent spec |
| `docs/agentic-org/agents/RES-2.md` | Origination still opens files after accept |
| `docs/agentic-org/corporate_structure.md` / `CLAUDE.md` / `agents.mmd` | Roster + hard stops |
| `server/Lead Agent/src/agent.ts` | System prompt (this agent) |
| `server/Lead Agent/config/*` | ICP, weights, lenders, sources |
| `server/Lead Agent/prompts/*` | classify / hypothesis / digest templates |
| `shared/slfScore.ts` | Display rank + product classifier (pure) |
| `shared/slfPackage.ts` | Package builder + JSON Schema gate |
| `server/services/slfNexusAdapter.ts` | **Only** Nexus client (SLF-2 + LST-2) |
| `server/Lead Agent/config/nexus_map.yaml` | Field map onto `AgenticDealFile` |
| `docs/superpowers/specs/2026-09-07-nexus-adapter-design.md` | Adapter contract |
| `docs/superpowers/specs/2026-09-07-super-list-finder-design.md` | LST-2 mailbox factory |
| `server/Lead Agent/src/cli.ts` | `slf ingest\|queue\|accept|…` |
| `server/__tests__/shared/slfScore.test.ts` | Gold fixtures 1–10 |
| `server/__tests__/shared/slfPackage.test.ts` | Schema, grounding, PECR, idempotency |

Reuse, do not fork: `shared/salesOs.ts`, `shared/chargeClassifier.ts`, `shared/distressSignals.ts`, `server/utils/gazetteClient.ts`, `server/Lead Agent/src/utils/companiesHouseClient.ts`.

## Success criteria

- Shaun’s morning list is 20–80 Stream A companies, each with a named charge or a named Gazette notice.
- Nothing on the list is “a company that exists”, a high-street-only charge, a broker, or a name already refinanced last month.
- Book-lane accepts never open a second deal.
- New-name accepts become `hopper: gated` for RES-2 attach.
- Zero predatory petition opening lines in fixtures.
- Maps is no longer the primary Lead Finder command.

## Open points (do not invent)

- Companies House bulk membership and streaming — v1 is REST + existing Gazette poll.
- Creditsafe: already in Nexus; call only after rank ≥ 45 and only if licensed; otherwise stub.
- When to switch 08:30 hunt from auto-open to SLF-queue-then-accept — after Phase 3 is in daily use.
- Thin UI vs CLI-only for the first week of review.
