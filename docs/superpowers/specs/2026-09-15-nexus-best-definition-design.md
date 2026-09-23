# Nexus — definition of best

Date: 2026-09-15  
Status: draft for review  
Repo: Nexus  
Owner: Shaun Tuhey  
Related: `docs/agentic-org/corporate_structure.md`, `docs/agentic-org/launch_readiness.md`, `docs/agentic-org/CLAUDE.md`

This is the product contract for the operating system. It is not a feature spec. New work is in or out by this document. “Best” means this document. It does not mean more surface.

---

## Goal

Make Nexus the best it can be: Veltro Ltd’s operating system, run for Sterling Commercial Finance Ltd (trading as Strata Finance), whose only product that counts is a **complete Sterling file** — nothing required still missing, no invented figures — sent by Shaun under the Veltro–Sterling contract.

Strata-first. Productise later. The file is the product.

---

## Locked decisions

### Identity

| Name | What it is | What it is not |
|---|---|---|
| **Veltro Ltd** | Shaun’s company. Owns Nexus. One party to the contract. | Not the borrower-facing brand. Not the OS. Not who the SME thinks they are talking to. |
| **Nexus** | Veltro’s operating system. This app. | Not a second brokerage. Not a demo Workforce. Not a Veltro SaaS product in this phase. |
| **Sterling Commercial Finance Ltd** | The other party to the contract. Destination of the complete file. | Not “Sterling Capital Reserve.” Not a Nexus user. |
| **Strata Finance** | Trading name of Sterling Commercial Finance Ltd. Borrower-facing packager brand (`stratafinance.co.uk`, `enquiries@stratafinance.co.uk`). | Not Veltro’s trading name. Not the contracting packager with Sterling. |
| **The contract** | Veltro Ltd ↔ Sterling Commercial Finance Ltd. | Not Strata ↔ Sterling. Not Veltro ↔ Sterling Capital Reserve. |
| **Shaun** | Sole director above the loop. The only person who sends live replies, signs the memo, phones, and emails Sterling. | Not an agent. Not the From: on cold playbook mail as himself. |
| **David** | Human at Sterling who receives the file. | Not a Nexus operator. Not a Veltro customer. |

One sentence: **Nexus is Veltro’s OS for fulfilling the Veltro–Sterling contract; borrowers see Strata; the only product that counts is a complete file on Sterling’s desk.**

Agents work **for Veltro**, **on Nexus**, **for that contract**. They do not work “for Strata Finance” as if Strata were Veltro. They do not impersonate Shaun or David.

**Retire these names in app copy and governing docs:** “Sterling Capital Reserve,” “FlowLoan,” and any line that says Strata is the contracting packager or that agents work for Strata as the company. The engagement footer is already right: *Sterling Commercial Finance Limited trading as Strata Finance.* Keep it.

### Who Nexus is for (this phase)

- **Now:** run Strata (Sterling’s trading name) so the contract is fulfilled.
- **Later:** Veltro may sell Nexus to another broker.
- **Not now:** multi-tenant, billing, generic pipeline, Veltro trial logins, fez-crm.

### What “best” means

Best is not more pages, more agents, more tests, a cleaner Craft, or a Veltro login for other brokers.

Best is:

**A live company that Nexus took from origination to a complete Sterling zip — nothing required still missing, no invented figures — which Shaun sent under the Veltro–Sterling contract.**

That is the product. Features are how we get there. They do not score.

### The eight tests (a file counts only if all are true)

1. **Real company.** Companies House number. Not a test fixture, not a seed, not “Acme Ltd.”
2. **Real path.** Entered through hunt, inbound, or Openers. Not typed onto Pipeline to force a zip.
3. **Legal mail.** Every outbound through `sendEmail` / `mailIsSuppressed`. STOP is org-wide. Hard bounce is mailbox-only. No send after opt-out.
4. **A human event.** Enquiry, Apply, or inbound reply. Opens and clicks heat the card; they do not Promote.
5. **A pack.** Documents from the portal, not screenshots pasted into a folder.
6. **Numbers from the pack.** SFP complete. Credit memo is a recommendation with workings. Missing stays missing.
7. **Completeness gate.** Every required item is in the zip. No `STILL-MISSING.txt`. No PARTIAL SFP marked complete.
8. **Shaun sent it.** Agents compile. Shaun is the only person who emails Sterling.

A file does **not** count if Shaun built the zip by hand, Gemini described the deal log instead of the pack, a required doc is absent, a figure was invented, or the company was force-promoted to make the demo work.

### Proof ladder

| Rung | Meaning |
|---|---|
| **1 — Proof** | One live file that hits all eight tests. Until this exists, Nexus is not yet good. This is **phase 1 done**. |
| **2 — Repeatable** | Three live files on that path, without Shaun assembling the zip. |
| **3 — Desk** | On those files Shaun’s only touches: match disputes, live-reply send, memo sign-off, phone, and the Sterling send. |
| **4 — Productise** | Only after rung 3. Veltro may then sell Nexus to another broker. Not before. |

Rung 1 is the definition of done for the current phase. Rungs 2–3 are how it becomes the best it can be. Rung 4 is Veltro’s later company, not this contract.

### Anti-scoreboard (not proof of progress)

This is a scoring rule. **It is not a deletion list.** Do not remove Workforce, Craft, Learn, Editorial, the Veltro landing, concierge, Openers, Agent Mail, tests, or an incomplete-zip path because they appear here. They stay. They just do not count as winning.

- Pages, agents, tests, commits, or specs shipped
- Workforce “online” / skill scores / Interact chat
- Craft weeks, Learn articles, Editorial posts
- Veltro landing, concierge, or trial logins
- Mail volume, open rate, or Openers card count without a file on Sterling’s desk
- A zip that is allowed to be incomplete

Until rung 1 is true, **starting a new subsystem** is a failure of discipline, not a feature. Existing desks are kept: on-the-loop, frozen, or costume, as below.

---

## The only loop that counts

```
Find          →  hopper / hunt / inbound / harvest
Legal mail    →  James cadence, PECR, sendEmail, Agent Mail
Convert       →  Openers (dwell), convert playbook, Direct Outreach
Human event   →  enquiry / Apply / inbound reply
Pack          →  portal documents
Numbers       →  SFP from the pack, memo as recommendation, missing stays missing
Complete zip  →  completeness gate, no STILL-MISSING, no PARTIAL marked done
Send          →  Shaun only, Veltro Ltd → Sterling Commercial Finance Ltd
```

### Allowed entry points

- Stream A hunt (distress SME)
- Stream B introducer
- Inbound to `enquiries@stratafinance.co.uk`
- Openers (on-site dwell on stratafinance.co.uk)

A card typed onto Pipeline to force a zip does not count.

### Without Shaun, the loop may

- Hunt, score, harvest a mailbox, open the deal
- Send playbook mail (PECR-gated)
- Enrol convert / stop on Direct Outreach
- Request the pack, chase missing docs
- Ingest, number, compile, **fail** the completeness gate

### Without Shaun, the loop must never

- Send a live reply (SAL-1 drafts only)
- Make a credit decision
- Mark a PARTIAL file complete
- Email Sterling / David
- Continue after STOP, complaint, solicitor, or vulnerability
- Invent a figure

### One rail

Deal Files and the Sterling zip are not allowed to be two machines. Approving, processing, or completing a deal on one rail must produce the zip on the other, or the loop is a lie. Best means **one file, one rail, one zip.**

---

## What stays, what freezes, what is costume

### On the loop — keep, finish, merge

| Desk | Why |
|---|---|
| Hopper / hunt / harvest | Find |
| Inbound + SAL-1 drafts | Human event |
| James / Sales OS / convert | Legal mail |
| PECR / suppression / Agent Mail | Legal mail |
| Openers / Direct Outreach / Clients | Convert |
| Pack portal / missing-doc chase | Pack |
| SFP / cashflow / proposal / completeness | Numbers |
| Sterling portal + zip | The product |
| Pipeline (Deck after Promote) | The file after the human event |
| Auth / roles needed to run the desk | Housekeeping |

`feat/sme-opener-nurture` (Direct Outreach) is on the loop. Land it. Cashflow analysis is on the loop only as it feeds the Sterling attachment.

### Frozen — keep, must not grow, does not score, do not delete

| Surface | Why frozen |
|---|---|
| Learn hub | Training. Convert mail must not sell it. Not a file. |
| Editorial | Brand ammo. Not a file. |
| Craft week / motion / social | Isla’s studio. **Exception:** the Direct Outreach house briefing template is on the loop. The week desk is not. |
| Veltro landing / concierge / fez-crm | Phase 2 (productise). A briefing may point at Veltro. Do not build Veltro SaaS in this phase. |
| Telnyx / Call Centre auto-dial | Shaun’s phone. Agents queue the script. They do not dial. |
| WhatsApp auto-send | Same. |
| Off-loop worktrees | `feat/learn-hub`, `craft-studio-help`, `feat/craft-motion-nodes` — freeze. Do not merge to look busy. |

### Costume — not operational. Do not extend. Do not quote as truth. Do not delete.

The screens stay. They are not the OS. Do not add roster lines, fake scores, or ARES loops. Do not rip the pages out.

- Workforce roster, Unsplash faces, “Online”, hardcoded skill scores
- ARES / Interact chat
- Any agent “success rate” that is not a job log

If a screen cannot name the company, the stage of the loop, and the next action toward a complete zip, it is costume or frozen — not a candidate for deletion.

### Rule for new work

A change is allowed only if it:

1. moves a live file along the loop, or
2. stops a lie (wrong name, two rails, incomplete zip marked done, send that skips PECR).

Everything else waits until rung 1 is true.

---

## Phase 1 done (all must be true)

1. **Names are true.** App, nav, footers, and governing docs match the identity table. “Sterling Capital Reserve,” “FlowLoan,” and “you work for Strata Finance” (as if Strata were Veltro) are gone. Engagement footer stays.
2. **One rail.** Promoting, processing, or approving a deal compiles the Sterling zip from the same file. Deal Files cannot “succeed” without that zip.
3. **The gate is real.** Completeness failure blocks send. No `STILL-MISSING.txt` on a sendable pack. No PARTIAL SFP marked complete. No invented figures.
4. **Direct Outreach is landed.** Merged into the checkout this machine actually runs (today: `feat/sme-opener-nurture`, not a stale `main` nobody boots). Frozen worktrees not merged “to keep up.”
5. **Rung 1.** One live company walked the loop. Shaun sent the zip under the Veltro–Sterling contract.

Until 1–5 are true, Nexus is a serious desk with an unfinished product.

Phase 1 is **not** done because tests are green, Openers has 1,349 cards, mail volume is up, or another spec shipped.

### Order of work until then

1. Make names true in governing docs and operator-facing chrome (`corporate_structure.md`, `CLAUDE.md`, README identity). Borrower-facing Strata chrome stays.
2. Finish and merge Direct Outreach into the checkout this machine runs.
3. Make Deal Files and the Sterling zip the same rail.
4. Make the completeness gate the send stop.
5. Make ingest read the pack, not the deal log.
6. Run live files until rung 1 exists.

No new desk in that list.

### Productise gate

Rung 3 is true. Then, and only then: tenancy, billing, generic pipeline, Veltro product UX. Starting that work before rung 3 is a failure of this definition.

---

## How agents (and implementers) must use this

- Read this spec before building.
- If a request is not on the loop, refuse or freeze it.
- If a change would make an incomplete zip look sendable, it is a bug, not a feature.
- PECR, Clients-contacted, and Openers-clicks house rules still apply; this spec does not weaken them.
- No agent may make a final credit or lending decision. Memo is a recommendation. Shaun signs. Sterling decides.
- Update `docs/agentic-org/corporate_structure.md` and `docs/agentic-org/CLAUDE.md` so they match the identity table. Those files currently contradict this spec (Strata as employer; Sterling Capital Reserve as receiver). This spec wins until they are patched.

---

## Non-goals

- Selling Nexus to a second broker in this phase
- Completing, hosting, or rebranding fez-crm / issuing Veltro trial logins
- Deleting Learn, Editorial, Craft, Workforce, ARES, Veltro landing, concierge, Openers, or Agent Mail
- Growing Learn, Editorial, Craft week, Telnyx auto-dial, or WhatsApp auto-send
- Treating Workforce / ARES as the operating system
- A second SMTP stack or Shaun’s personal mailbox as the cold From:
- Inventing figures, rates, or cashflow to make a zip look complete
- Merging frozen worktrees to reduce the branch list
- Replacing this contract with “more tests” or “more pages”

---

## Approach rejected

**Operator-hours as the scoreboard.** Rejected. A faster desk that never produces a complete Sterling zip is not best.

**Productise now.** Rejected. Strata-first. Tenancy and Veltro SaaS before rung 3 is the sprawl that already happened.

**Inbound-only for rung 1.** Not taken. Hunt, inbound, and Openers are all allowed entry points. The first complete file may come from any of them. It may not come from a hand-typed Pipeline card.

---

## Stale documents this spec supersedes (on identity and “what counts”)

These remain useful for pipeline holes. They are **wrong** on names and on treating extra desks as progress:

- `docs/agentic-org/corporate_structure.md` — says Strata packages for Sterling Capital Reserve; agents described as Strata staff
- `docs/agentic-org/CLAUDE.md` — “You work for Strata Finance”
- `docs/ARCHITECTURE.md` — FlowLoan, Postgres/Neon/Redis
- `README.md` — product named Veltro as if Veltro were the OS
- `docs/RELEASE.md` — staging.example.com, Redis
- `CODEBASE_AUDIT.md` — already flags some of this; does not carry the identity lock

Patching those files is part of phase 1 item 1 (names are true). It is not a new product initiative.

---

## Open questions

None. Locked in session 2026-09-15:

- Nexus is for Strata first, then productise
- The file is the product
- Identity: Veltro Ltd / Nexus / Sterling Commercial Finance Ltd t/a Strata Finance
- Sterling trades as Strata (engagement footer is correct)
- The loop, the keep/freeze/costume cut, and the done/productise gate
