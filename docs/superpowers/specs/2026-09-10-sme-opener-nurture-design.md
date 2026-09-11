# SME opener convert — dual-open to site enquiry

Date: 2026-09-10  
Status: draft for review  
Repo: Nexus  
Owner: Shaun Tuhey  
Agent: SAL-2 James Hale (convert mandate). Addendum: `docs/agentic-org/agents/SAL-2-convert.md`.  
Related: `docs/superpowers/specs/2026-09-04-openers-crm-design.md`, `docs/superpowers/specs/2026-09-07-super-outreach-design.md`

## Goal

Turn silent dual-openers — they opened `sme_1` and opened `sme_2`, and have not got in touch — into **site engagement on stratafinance.co.uk** and then a **Promoted** Deck lead. The website does the converting. James does not ask for a call. Shaun only takes the last human closer, and live replies.

## Locked decisions

- **Approach:** SAL-2 convert playbook. Same James, same mailbox, new Sales OS playbook. Openers is the closer desk, not a second mail engine. Not a new roster line (no NUR-2).
- **Enrol:** sent `sme_1` with at least one open **and** sent `sme_2` with at least one open **or** click, still silent. Enrol on the `sme_2` open pixel or a click on that mail. Not on send of `sme_2`.
- **Hunt dies:** cancel remaining hunt steps. Do not send `sme_close`. Do not set hunt `queueCall`. Staged LinkedIn that was not posted stays; do not stage another. If `sme_close` already went (late dual-open), do not resend; still enrol; do not queue a second hunt call.
- **Gap:** first convert email is not the same Europe/London calendar day as the `sme_2` **send**. Next Sales OS window (`08:30–16:30`, Mon–Fri).
- **Clock:** `shared/playbooks/sme_nurture.yaml` + `shared/salesOs.ts`. Copy in `shared/strataOutreach.ts`. Auto-send is the existing OS flag. N1–N3 do not wait on Approve.
- **Ladder:** N1 day 0 (tools), N2 day 4 (calculator), N3 day 9 (enquiry), C1 day 12 (Shaun WhatsApp or call). Then stop that pass.
- **CTA origin:** `https://www.stratafinance.co.uk/` only. One tracked link per mail. No Learn. No Explore. No call or slot ask.
- **Clicks:** heat and rank only (existing Openers rule: clicks desc, opens desc, name A–Z). A click is not Promote.
- **Promote:** site enquiry, Apply, or inbound reply auto-Promotes (create-or-jump Deck, `referralSource: "Openers"`), stops convert, hands the live file to SAL-1 / Maya. Shaun does not drag the card for this cohort.
- **Silent complete:** keep the deal, opener card, and Agent Mail timeline. Card **Non Responsive**. `wakeAt` = C1 completed + 90 days (London). Re-run convert only (not hunt) if the enrol gate still passes. No cap on cycles until STOP, Promote, hard bounce with no phone, or the company is dead.
- **Wait behaviour:** click or open during the 90 days heats/ranks; does not pull `wakeAt` forward; does not start N1 early. Enquiry in the wait still auto-Promotes and kills the timer.
- **3-touch:** stays for everyone who is not a dual-open SME. Convert replaces 3-touch for this cohort only. Both sequences never run on the same company.
- **Sixth-email auto-promote** (`shouldAutoPromoteOpener` / `OPENER_AUTO_PROMOTE_AFTER_EMAILS`) **must not fire** on `nurture.stream === "convert"`. Convert Promote is enquiry / Apply / reply only. Hunt-plus-convert will exceed five outbound mails by N2; promoting on volume would empty the board of lurkers.
- **Persona:** James Hale, `enquiries@` mailbox. Isla does not rewrite these templates.

## Non-goals

- A new agent ID, mailbox, or SMTP stack.
- Site-side tool-completion tracking (eligibility/calculator finish) in v1. Nexus sees email clicks, then the form POST / inbound.
- Restarting `sme_1` / `sme_2` on wake.
- Auto WhatsApp, auto-dial, auto-post LinkedIn.
- Learn hub or Explore assessment in convert copy.
- Changing Agent Mail’s Opened folder.
- New SQLite tables. Deal clock + `uploads/openers.json` only.
- Craft / MKT-2 campaign world for these mails.

## Architecture

```
sme_2 open or click
  → dualOpenEligible?
  → cancel sme_close + hunt queueCall
  → deal playbook = sme_nurture
  → opener stream = convert, status = nurturing

ORC-1 tick (same as hunt)
  → N1 / N2 / N3 auto-send via strataOutreach + sendEmail + logAgentMail
  → click on last mail selects the next template variant only

N3 sent + 3 days
  → C1 due on Openers drawer (script from last stratafinance.co.uk click)
  → Shaun WhatsApp or Log call or Skip
  → Non Responsive + wakeAt +90d

Enquiry / Apply / inbound reply
  → stop convert, auto-Promote, SAL-1 / Maya

wakeAt tick
  → gate still passes? N1 on next window : stay parked with reason
```

Source of truth:

| Concern | Home |
|---|---|
| Convert clock, playbook, `wakeAt`, cycle | Agentic deal (Sales OS tick) |
| Board status, stream flag, closer due, C1 script | `uploads/openers.json` (derived + small stored flags) |
| Opens, clicks, URLs, replies | Agent Mail log |
| Deck prospect | existing Promote path |

## Enrolment gate

All of these, else no enrol:

1. Outbound mail `touchId` `sme_1` (or `cold_1`) status `sent`, at least one open.
2. Outbound mail `touchId` `sme_2` (or `cold_2`) status `sent`, at least one open **or** at least one click.
3. Same company: same `dealId`, else same normalised company number, else same normalised email.
4. No inbound reply on the thread / deal events.
5. No STOP / opt-out / suppression on that email.
6. No Explore enquiry (`hasExploreEnquiry`).
7. No `strata_inbound` deal and no successful `POST /api/inbound/refinance` for that email or company number.
8. Deal not `failed`. Company not dissolved (if CH snapshot present and status is not active, do not enrol).
9. Opener not `promoted`, not `not_now` with `stopReason` `opt_out`.
10. `dealId` present. No deal → no convert (OS clock lives on the deal). Opener card may still exist as today.
11. Not already on `sme_nurture` this cycle (second pixel is a no-op).

Clicks without dual-open do not enrol. `sme_1` open only stays on hunt (`sme_open` / `sme_followup` already ran; `sme_close` still due). Introducer and other Agent Mail opens never enter this playbook.

## Playbook

New file `shared/playbooks/sme_nurture.yaml`. Hunt `sme_14d.yaml` is unchanged. Dual-open **swaps** the deal onto this playbook; it does not run two playbooks.

```yaml
playbook_id: sme_nurture
version: 1
pipeline: sme
timezone: Europe/London
send_window: { days: [mon, tue, wed, thu, fri], start: "08:30", end: "16:30" }
stop_line: "If this isn't useful, reply stop and we won't email again."
steps:
  - id: sme_n1
    day: 0
    channel: email
    os_touch: sme_n1
    auto_send: true
    requires_merge: [contactName, companyName]
  - id: sme_n2
    day: 4
    delay_days_from_previous: 4
    channel: email
    os_touch: sme_n2
    auto_send: true
  - id: sme_n3
    day: 9
    delay_days_from_previous: 5
    channel: email
    os_touch: sme_n3
    auto_send: true
  - id: sme_c1
    day: 12
    delay_days_from_previous: 3
    channel: closer
    os_touch: sme_c1
    auto_send: false
    queue_opener_closer: true
    final: true
```

`salesOs.ts`: extend `CadenceTouchId` with `sme_n1` | `sme_n2` | `sme_n3` | `sme_c1`. Add `SME_NURTURE_CADENCE` (or stream `"sme_nurture"`). `nextCadenceStep` for a convert-enrolled SME deal reads this table, not `SME_CADENCE`. `sme_c1` is not hunt `queueCall`. It sets closer-due on the Openers card only.

Day 0 N1 is further gated: refuse send if London calendar date equals the `sme_2` send date. Hold until the next window.

Eligibility on every tick still runs (`shared/slfOutreach.ts`): `no_mailbox`, `pecr_individual`, `no_stop_line`, `smtp_unhealthy`, `suppressed_email`, `playbook_gap`, `book_status_blocks`. Convert does not invent a second gate. Corporate subscribers only; they already passed hunt PECR.

Convert sends count toward the same mailbox daily cap as hunt.

## Branching

The table in the playbook is the **no-click** path. A click never adds a same-day extra email. It only selects the **next** scheduled template.

| Signal | Next |
|---|---|
| Click `stratafinance.co.uk` with `#tools` or `sf=n1` | N2 = clicked-tool variant (`sme_n2_clicked`) |
| Click `#process` | N2 = default calculator + Apply (they read how it works; now run the check) |
| Click `#contact` / Apply path | Skip remaining tool mails. N3 uses `sme_n3_form`. Then C1. |
| HMRC petition on the deal (`dealHasHmrcPetition`) and no #contact click | N2 = `sme_n2_hmrc` |
| No click | N2 default refinance calculator; N3 enquiry |
| Re-open, no click | Stay on ladder. No extra mail |
| Site enquiry / Apply / inbound reply | Auto-Promote, stop, SAL-1 / Maya |
| STOP / opt-out | Rowan. Cancel remaining. No breakup mail |
| Live reply | SAL-1. Promote. Stop |
| Hard bounce | Stop email. C1 still due if a phone exists |
| Click on a non-site URL | Heat only. Branch stays default |

Compile-time URL on every N-mail: origin `https://www.stratafinance.co.uk/` plus `?sf=n1|n2|n3` plus hash `#tools` or `#contact`. N2 may keep `#tools` (the calculators live in that section). Do not link `/strata-solution.html`, `/cdfi-funding.html`, Learn, or Explore from convert.

## Copy

Templates in `shared/strataOutreach.ts`. Touch ids: `sme_n1`, `sme_n2`, `sme_n2_hmrc`, `sme_n2_clicked`, `sme_n3`, `sme_n3_form`. Playbook step `sme_n2` / `sme_n3` picks the variant at render time. Missing variant = `playbook_gap`, hold, no skip-ahead.

**Every convert email**

- James Hale signature, same as hunt.
- Stop line verbatim: `If this isn't useful, reply stop and we won't email again.`
- Packager identity in the body (`We do not lend` or packager). Lead with the repair, not the disclaimer.
- One link. No Learn, no Explore, no second CTA.
- No rates, APR, approved, we can definitely help, lender names, invented pounds, em dashes, emojis.
- No ask for a call, a Thursday slot, or a 10-minute review.
- Subject ≤ 45 characters. No `Re:` except `sme_n3_form`.
- Greeting: real first name → `Hi {name},`. Otherwise `Hi,` — not `Hi there,`. Convert must not use hunt `firstName()`’s `"there"` fallback.
- Merge fields: `contactName`, `companyName` only.

### N1 — `sme_n1`

Subject: `30 seconds on eligibility`

```
Hi {name},

You opened both notes I sent about {company}'s debt commitments.

If it is useful, there is a 30-second eligibility check on our site. No credit search, and no conversation.

https://www.stratafinance.co.uk/?sf=n1#tools

Strata packages the file. We do not lend.
```

Purpose: Dual-open diagnostic. Point at #tools.

### N2 default — `sme_n2`

Subject: `What the monthly stack becomes`

```
Hi {name},

If {company} is servicing more than one short-term facility, the refinance calculator on our site shows what that stack looks like as a single structure.

https://www.stratafinance.co.uk/?sf=n2#tools

Apply from the result if it is useful. We do not lend.
```

### N2 HMRC — `sme_n2_hmrc`

Subject: `HMRC Time to Pay first number`

```
Hi {name},

For {company}, the first figure most lenders will want is a Time to Pay shape on the HMRC balance. The calculator on our site is an indicative guide, not a lending decision.

https://www.stratafinance.co.uk/?sf=n2#tools

Apply from the result if it is useful. We do not lend.
```

### N2 after N1 click — `sme_n2_clicked`

Subject: `Same page, next check`

```
Hi {name},

You looked at the eligibility check for {company}. The refinance calculator is on the same page if you want a picture of the monthly stack as one structure.

https://www.stratafinance.co.uk/?sf=n2#tools

Apply from the result if it is useful. We do not lend.
```

If the deal is an HMRC petition and they clicked N1, use `sme_n2_hmrc` (petition wins over clicked-generic).

### N3 — `sme_n3`

Subject: `Last note from me`

```
Hi {name},

I will not keep emailing about {company}.

If you want a view on the file, the enquiry form is on our site. No credit search. We reply within one working day.

https://www.stratafinance.co.uk/?sf=n3#contact

We do not lend. We package.
```

### N3 form reminder — `sme_n3_form`

Subject: `The form is on that page`

```
Hi {name},

You opened the enquiry page for {company} and did not send it. The form is still on that page if you want it looked at.

https://www.stratafinance.co.uk/?sf=n3#contact

We do not lend.
```

### C1 script (not email)

Stored on the opener when N3 sends (or when C1 becomes due). Shaun sends WhatsApp or dials. James does not.

**If last Agent Mail click URL is `stratafinance.co.uk`:**

```
{company} ({name}). Opened sme_1 and sme_2. Last site click: {url}. No enquiry.
Point them at the form on that same page. No meeting ask. No credit search.
```

**If no site click:**

```
{company} ({name}). Opened sme_1 and sme_2. No site click.
Point them at https://www.stratafinance.co.uk/?sf=c1#contact
Enquiry form, no credit search. No meeting ask.
```

## Openers desk

**On enrol.** Matching opener (email / company number / `dealId`) → `status = nurturing`, `nurture.stream = "convert"`. No Start, no Approve. Badge: convert step (`N1 queued` / `N2 in n days` / `C1 due`) plus existing opens and clicks badges (`data-testid="badge-opener-clicks"` unchanged).

**3-touch isolation.** `nurture.stream` is `"convert"` | `"opener_3touch"` (default `opener_3touch`). Dual-open SME is `convert` and cannot `startNurture` 3-touch. If 3-touch is mid-flight when dual-open hits, stop 3-touch (`stopReason = "manual"` is wrong — use `stopReason` left unset on the 3-touch object and set `stream = "convert"`; remaining 3-touch actions no-op). Everyone else unchanged.

**Closer (C1).** Due 3 days after N3 **sent** (`OPENER_CONVERT_CLOSER_DELAY_MS = 3 * 24 * 60 * 60 * 1000`). Drawer: script, WhatsApp or Log call, same providers as today’s touch 2. Completing either: `stopReason = completed`, `status = non_responsive`, set deal+opener `wakeAt`. No phone: buttons disabled; **Skip closer** is the unstick; same completed / Non Responsive. No fourth email.

**Drag.** Convert cards: Nurturing is valid from enrol (before N1 sends). Do not require 3-touch `step >= 1`. Promoted column still calls promote API. Unsubscribed (`not_now`) still allowed. New column only if convert has not started sending (N1 not sent) — rare; prefer leaving them on Nurturing.

**Auto-Promote.** Any of: `POST /api/inbound/refinance` success; new `strata_inbound` deal for that email or company number; Agent Mail inbound reply that is not STOP. Then in one pass: stop convert (`stopReason = promoted`), existing create-or-jump (`referralSource: "Openers"`), card Promoted, hand to SAL-1 / Maya. Drag-to-Promoted remains a manual override.

**Promote blocked.** Inbound still **stops convert** so they are not mailed again. If create-or-jump cannot run (no company number): flag `Promote blocked — attach company`; Maya/SAL-1 still get the inbound file. Do not drop the enquiry.

**Heat.** `recordClick` already upserts `clickCount`. Rank unchanged. C1 script reads the latest timeline click whose URL host is `stratafinance.co.uk` or `www.stratafinance.co.uk`.

## 90-day diary

On silent C1 complete:

- Keep deal, opener, mail timeline. Do not delete or hide.
- `stopReason = completed`
- `status = non_responsive`
- `wakeAt` = London calendar date of C1 completed + 90 days, fire in the first send window on or after that date
- Increment `convertCycle` (start at 1 on first enrol)

On wake tick:

1. STOP / suppressed → stay parked, no mail.
2. Promoted or inbound exists → stay parked, no mail.
3. Deal failed or CH dissolved → stay parked, reason on the card, no mail.
4. Hard bounce and no phone → stay parked, no mail.
5. SMTP unhealthy → do not consume the cycle; retry wake next tick.
6. Else: swap onto `sme_nurture` again, `status = nurturing`, N1 on the next window. Same three emails + closer. Not a new hunt. New `wakeAt` only after the **next** silent C1.

No cap on cycles. One convert pass per cycle per company (enrol once per cycle).

## Record fields

Deal (agentic), additive:

| Field | Notes |
|---|---|
| `convertPlaybook` | `"sme_nurture"` when enrolled |
| `convertEnrolledAt` | ISO |
| `convertCycle` | integer, default 0 |
| `convertWakeAt` | ISO date (London) or empty |
| `convertStopReason` | `completed` \| `reply` \| `opt_out` \| `promoted` \| `manual` \| `blocked` \| `dead` |

Opener `nurture`, additive:

| Field | Notes |
|---|---|
| `stream` | `"convert"` \| `"opener_3touch"` |
| `convertCycle` | mirror |
| `wakeAt` | mirror for board |
| `n1MailId` / `n2MailId` / `n3MailId` | Agent Mail ids |
| `n1At` / `n2At` / `n3At` | send times |
| `closerStatus` | `idle` \| `due` \| `done` \| `skipped` |
| `closerChannel` | `whatsapp` \| `call` |
| `closerAt` | |
| `closerScript` | string, written at N3 send / C1 due |
| `promoteBlocked` | boolean |

Existing 3-touch fields stay for `opener_3touch`. Convert must not require `touch1Status = pending_approval`.

## Errors

- Dual-open enrols once. Second pixel no-op.
- SMTP fail / mock: `hold_undelivered`. Retry the **same** template. Do not skip a step. Do not bump `lastTouchAt` or the closer clock on a hold.
- Compile fail (missing stop line, missing site origin, Learn/Explore present, call-ask present): hold, `playbook_gap`.
- No `dealId`: no convert.
- 3-touch in flight: convert takes the file.
- `sme_close` already sent: still enrol, do not resend close.
- Auto-Promote without company number: stop mail, flag attach company, keep inbound.
- Wake gate fail: stay parked with reason. Do not clear history.

## Tests

No live SMTP, Companies House, or WhatsApp.

Shared / service:

- Enrol gate true only on dual-open + silent + deal present.
- `sme_1` open only does not enrol; hunt still owns `sme_close`.
- Enrol cancels `sme_close` and hunt `queueCall`.
- Late dual-open after `sme_close` sent still enrols and does not resend close.
- Same London day as `sme_2` send: N1 held.
- Second pixel no-op.
- Click-branch selects `sme_n2_clicked` / `sme_n3_form`; petition selects `sme_n2_hmrc`.
- No same-day extra mail on click.
- `shouldAutoPromoteOpener` is false for `stream === "convert"` even at 8 outbound mails.
- Enquiry / inbound refinance / reply → promoted, convert stopped, SAL-1 path.
- STOP → unsubscribed, no further convert mail, no wake enrol.
- C1 due 3 days after N3 sent; skip with no phone → non_responsive + `wakeAt`.
- Wake +90d re-enrols when gate passes; does not start `sme_1`.
- Wake does not enrol if STOP, Promoted, failed, or dissolved.
- SMTP down on wake does not consume the cycle.
- Click during wait does not move `wakeAt`.
- 3-touch cannot start on a convert card; convert stops in-flight 3-touch.
- Copy guards: each N-template contains `www.stratafinance.co.uk`, the stop line, packager identity; does not contain `learn.stratanexus`, `explore.stratanexus`, or a call/slot ask.
- Greeting without a real name is `Hi,` not `Hi there,`.

Routes / UI:

- Convert cards have no Start / Approve.
- Step badge and C1 script render.
- Clicks badge still `data-testid="badge-opener-clicks"`.
- Rank still clicks then opens then name.

## Files (expected)

- Create: `shared/playbooks/sme_nurture.yaml`
- Create: `docs/agentic-org/agents/SAL-2-convert.md`
- Modify: `shared/salesOs.ts` — convert cadence + touch ids
- Modify: `shared/strataOutreach.ts` — N1–N3 variants, copy guards, greeting
- Modify: `shared/openers.ts` — stream, closer, wake, disable sixth-email promote on convert
- Modify: `shared/smeOpenFollowUp.ts` or new `shared/smeConvert.ts` — enrol gate, dual-open detect (prefer a dedicated `shared/smeConvert.ts` so follow-up helpers stay about `sme_open`)
- Modify: `server/services/agenticWorkflow.ts` — tick convert playbook, hunt cancel, wake
- Modify: `server/services/openers.ts` / `server/routes/openers.ts` — enrol status, C1, auto-promote hook
- Modify: `server/services/agentMailLog.ts` — dual-open enrol from `recordOpen` / `recordClick`
- Modify: inbound refinance route — auto-Promote + stop convert
- Modify: `client/src/pages/Openers.tsx` — convert badges, hide Start/Approve, C1 script
- Modify: `docs/agentic-org/agents/SAL-2.md` — pointer to convert addendum
- Modify: `docs/agentic-org/corporate_structure.md` — one line under SAL-2 (convert playbook after dual-open)
- Tests: `server/__tests__/shared/smeConvert.test.ts`, openers + outreach + workflow + UI as above

## Success

A company that opened `sme_1` and `sme_2` and stayed silent is taken off the hunt close, receives three site-led James emails, can be closed by Shaun on Openers, becomes a Promoted lead when they enquire, and if they never move is kept and woken at 90 days for another convert pass — without a sixth-email fake Promote, without Learn links, and without a meeting ask in the mail.
