# Super Outreach — James Hale Hunt email desk (Stream A)

Date: 2026-09-07  
Status: draft for review  
Repo: Nexus  
Owner: Shaun Tuhey  
Source: `SUPER_OUTREACH_AGENT.md` (`slf.outreach.v1`); `FULL_STACK_SPEC.md` is a concat of Finder + List + Adapter + this desk — Finder/List/Adapter already live  
Agent ID: `slf.outreach.v1`  
Workforce: James Hale (`outreach-sales`) under SAL-2  
Inbox: SAL-1 James Hale stays drafts-only (`slf.inbox.v1` specified, already exists)

## Goal

James Hale runs cadences. He does not write cadences. He merges approved fields into approved playbooks, hands the message to SMTP, and **holds** if SMTP does not accept. He never invents copy. He never mixes the SME pack with the introducer pack.

## Locked decisions (Stream A overlay)

- **James Hale = Hunt email desk**, not a new department. SAL-2 first-touch. Sophie still chases packs. Rowan still STOP/bounce.
- **Sales OS cadence is the clock** (`shared/salesOs.ts`): Stream A 14-day `sme_1 → sme_linkedin → sme_2 → sme_close`. Playbook YAML names those steps; it does not invent a second 14-day shape.
- **Copy lives in `shared/strataOutreach.ts`.** Playbook files point at touch ids. Missing template = `playbook_gap`. No LLM body in v1.
- **Mailbox:** Stream A sendable is `isSendableContact` + PECR corporate (not personal webmail). Not “List Finder role-A only.” Guessed `info@` still never sends. Director mailbox is preferred primary.
- **Brand:** Strata Finance. PECR stop line is the existing OS line (`If this isn't useful, reply stop…`). Compile fails without it on cold email.
- **SMTP hold already exists** (`hold_undelivered`). Keep it. Mock is not delivered (`wasEmailDelivered`).
- **Approve & send for `sme_1` stays.** Shaun still approves first Stream A cold email. Auto-send after that follows OS `autoSend`.
- **Stream B:** playbook isolation is mandatory. Auto-enrol without Refer Agent `reachableCorporateContact` is **off**. Legacy introducer files with a live corporate mailbox may continue. New Stream B does not start from this upgrade.
- **Phone:** OS still queues a call script on `sme_close`. James does not dial. Spec’s “phone out of v1” means no auto-dial.
- **No property copy.** No bridging take-out / Mill Lane language in merge fields. Stream A merge may use SLF `opening_line` / `why_us_now` when present; otherwise OS templates stand.
- **One sequencer:** this desk (`hunt_agent`). Do not also fire a generic CRM drip on the same file.
- **Inbox:** SAL-1 already classifies replies. Outreach stops on human reply / STOP / bounce. Do not build a second inbox agent in this pass.

## Non-goals

- Inventing new email copy
- Auto-posting LinkedIn
- Auto-dial
- Rewriting Finder / List Finder
- Mid-cadence distress copy injection (pause for Shaun)
- Refer Agent implementation

## Eligibility (every tick, not once)

Hold reasons: `no_mailbox`, `mailbox_not_sendable`, `pecr_individual`, `no_stop_line`, `smtp_unhealthy`, `refer_contact_missing`, `wrong_pipeline_pack`, `already_in_sequence` (second cadence), `book_status_blocks`, `playbook_gap`, `suppressed_email`.

Inbound stream is not this gate’s enrol path (Maya/Sophie).

## Enrolment

On SLF accept of a Stream A deal that is `hopper: sendable` (or queued for Approve & send): James may run `sme_1`. He never `create`s a candidate and never attaches a mailbox.

## Files

| Path | Role |
|---|---|
| `shared/slfOutreach.ts` | Eligibility + stop-line compile |
| `shared/playbooks/sme_14d.yaml` | Stream A step map |
| `shared/playbooks/introducer_10d.yaml` | Stream B step map (isolation tests) |
| `docs/agentic-org/agents/SAL-2.md` | James Hale runtime spec |
| `server/services/agentService.ts` | Workforce card |
| `server/services/agenticWorkflow.ts` | Call eligibility before send |
