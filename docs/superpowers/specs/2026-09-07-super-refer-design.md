# Super Refer Agent — Tom Brennan (Stream B)

Date: 2026-09-07  
Status: draft for review  
Repo: Nexus  
Owner: Shaun Tuhey  
Source: `SUPER_REFER_AGENT.md` v1.1 (`slf.refer.v1`)  
Workforce: Tom Brennan (`database-builder-se`) — Refer desk, **not** a second hunt company  
Org: REF-2 under RES-2  
Downstream: James Hale Stream B (`slf.outreach.v1`) reads `reachableCorporateContact`  
Uses: List Finder grade, Nexus adapter, Sales OS `looksLikeIntroducer`

## Goal

Turn a named professional firm into a **Refer Record** with a proven corporate mailbox. This is the **only** process allowed to set `reachable_corporate_contact = true`. Outreach may then enrol the 10-day introducer playbook. Nobody else invents that mailbox.

Never send. Never enrol. Never paste the borrower’s charge, petition, or hypothesis onto the introducer row.

## Locked decisions (Strata overlay)

- **Tom Brennan is this agent.** Do not un-hibernate `database-builder-se` as a second CH hunt. Refer is a different job.
- **Stream B introducers are accountants, fractional CFOs, turnaround / insolvency advisers** (`looksLikeIntroducer`). Commercial finance brokers, NACFB, packagers are **not_an_introducer** — they are the market, not the referrer.
- Property agencies / SIC 68 stay out (Sales OS exclude).
- **Reachable mailbox:** published **role** mailbox on the firm’s domain, List Finder grade `A` or `A-role`, corporate subscriber, not catch-all, not Gmail. Named-work (director firstname@) is **not** reachable in v1 (`allow_named_work_introducers: false`).
- **Queue-first.** Introducer deals on the Nexus book first. Never attach `intros@` onto an SME row. Never create a second candidate for a firm already on the book.
- **Same company number as related_sme** → `same_entity_as_sme`. Stream A remains the lane.
- Own firm numbers in `config/refer.yaml` → `own_firm`.
- Distressed / IP type off until tone rules exist (`types_enabled.ip: false` unless operator flips).
- James Hale still will not enrol Stream B unless this flag is true **and** a Nexus introducer id exists.

## Non-goals

- Sending Stream B mail
- LinkedIn scrape / NACFB member scrape / broker email dumps
- Opening Stream A files
- Un-hibernating Tom as a regional SME hunter

## Reachability (exact)

```
reachable = resolution ≥ 0.9
  and company_number
  and domain
  and mailbox
  and mailbox_type == role
  and list_grade in {A, A-role}
  and pecr corporate_subscriber
  and not personal_webmail
  and not same_entity_as_sme
  and not own_firm
  and not DNC
  and classified introducer (accountant / ip / solicitor if enabled)
  and not broker
```

## Files

| Path | Role |
|---|---|
| `shared/slfRefer.ts` | Classify, reachable predicate, record builder |
| `server/Lead Agent/config/refer.yaml` | Own numbers, type flags |
| `docs/agentic-org/agents/REF-2.md` | Runtime spec |
| `scripts/slf.ts` | `refer ingest\|accept\|queue` |
