# Ranked reach for the business-loan pool

Date: 2026-09-23
Status: draft for review
Repo: Nexus
Owner: Shaun Tuhey
Desk: Harper harvest, James first-touch, charge letters

## Goal

Reach the Clients companies Jev classed as `charge_sme`. Use a company mailbox when it passes the reach gate below. When it does not, Shaun makes one call, or sends one letter, or uses the company website form. The rest of the 45,742 stay where they are.

Snapshot on 23 September 2026, live `A:\Projects\Nexus\uploads\crm_harvest.json` joined to `internal_leads`: 774 `charge_sme` rows. 258 had a company-domain address on the card. 516 had none. None of the 258 were on the freemail list (Gmail, Hotmail, and the rest of `isPersonalMailbox`). The programme follows the class, so a later change to `skipClass` moves a company in or out. This work does not re-run Jev.

## Why this pool

Jev scored 8,848 Clients companies. A name rule stamped the other 30,393 before Jev was asked: a name containing holdings, property, estates, investments, nominees, SPV, trust, or a charity word is `holding_spv` or `charity_public` and is never hunted. Jev’s own “hunt now” flag is on for 82 companies. The live hunt does not use that flag as a gate. It queues `charge_sme`, `ok_sme`, and `unsure`, and it drops charity and holding.

`charge_sme` is the agreed front of the queue. Lender cost still orders inside it, so Capify and Funding Circle sit ahead of a softer community lender. `ok_sme` (1,384) waits. The name-ruled holdings stay parked, including trading companies whose name happens to contain “holdings”.

## Locked decisions

- **One channel per company.** Email if the reach gate passes. Otherwise one fallback after harvest has used its 6 attempts. A James first-touch, a marked call, a marked letter, or a marked form ends the programme for that company.
- **Reach gate.** James may send only:
  1. A published company address: source is not `domain` (site, archive, or search snippet), the domain matches the company, it is not a personal or blocked mailbox, and the domain has MX. Confidence 95. Role addresses such as `info@` qualify when they were published.
  2. A director-name guess on a server that answers: MX family `other`, SMTP `deliverable`, catch-all probe `not_catch_all`. Confidence 95.
- **Mute-MX guesses stay off this drip.** A director-name guess on Google, Microsoft, Mimecast, or Proofpoint scores 75 today and James may send it on the wider hopper (`docs/superpowers/specs/2026-09-10-harvest-pattern-guess-design.md`). For `charge_sme` that guess is a missed attempt. It is not written onto the lead as the address that ends the hunt, and it does not open a hopper file.
- **An address already on the card is a seed, not a ticket.** The Clients row does not store source or confidence. Enrolment runs the seed through the reach gate. Honest MX (family `other`) gets an SMTP probe plus the catch-all probe. Mute MX does not enrol from the field. Harper may still enrol that same address later if a scrape cites it (source not `domain`). A personal mailbox stays on the card, stays off the drip, and does not stop the hunt.
- **Phone before letter.** After 6 attempts and no reach-gate mailbox: a switchboard already on the card is a call. No phone, a named director, and an address: a letter. No phone and no letter, and a website on the card: Shaun opens the site. Nothing autodials. Nothing submits a form.
- **Letters stay a weekly batch of 20.** London week, Monday to Sunday, Europe/London. At most 20 letters posted in that week. The page shows only the remaining allowance. Home addresses are struck by Shaun before posting. There is no residential detector.
- **Calls are not capped.** The full call list is shown, expensive lender first. Shaun checks CTPS before dialling a number. This work does not integrate CTPS.
- **Do-not-contact wins on every channel.** Opt-out removes the company from enrolment and from all three lists, including a letter that has not been marked posted.
- **A hard bounce is not a reach.** That mailbox is suppressed and cleared. The company stays in the hunt while attempts remain. It is not organisation do-not-contact.
- **Send and harvest caps stay.** James first-touch remains 20 an hour and 240 a London weekday, 08:30–20:30. Replies, pack chase, and follow-ups already due keep their slots. This pool takes the new first-touch slots ahead of `ok_sme` and `unsure`. Harper stays at 100 companies an hour and 6 attempts (`HARVEST_PER_HOUR`, `SME_ATTACH_ATTEMPT_CAP`). Companies House cooldown still pauses the pass. When it lifts, `charge_sme` is still at the front.
- **Letter copy stays.** `letterForLead` body is unchanged. This programme additionally requires `letterFirstName` to be non-empty. “Dear Directors” does not qualify.

## Non-goals

- Buying or wiring Hunter, Apollo, ZeroBounce, or any other contact database.
- Re-running Jev, or loosening the holdings/property name rule.
- Putting `ok_sme`, `unsure`, charity, or holding companies through this desk.
- Reversing the 10 Sep mute-MX rule for hopper files that are not in this pool.
- Autodial, bot-submitted forms, LinkedIn automation, or a new sender that skips `sendEmail`.
- Raising the James cap or the harvest cap.
- A second James queue. Enrolment uses the existing hopper first-touch path.

## Flow

```
charge_sme lead
  → do-not-contact?  stop
  → a non-bounced sent or mock first-touch already logged?  stop
  → reach gate passes?  hopper sendable, James sme_1  → done
  → else Harper (this pool before ok_sme and unsure)
        published or SMTP-confirmed  → James  → done
        mute-MX guess or miss  → attempt + 1
        6 attempts and still no reach-gate mailbox
              phone on card            → call list
              else named director + address → letter list (20 / London week)
              else website             → form list
              else                     → outcome no_channel, done
  → Shaun marks called / posted / form sent / no form / home address
```

One touch ends it. A reply after that is ordinary inbox work.

## Reach gate

One predicate, used by enrolment, by Clients harvest when it decides whether to save an address, and by James when he picks a `charge_sme` first-touch:

| Evidence | MX | Result |
|---|---|---|
| Source not `domain`, company domain, not personal, not blocked | Has MX | Send |
| Source `domain`, family `other` | SMTP deliverable and not catch-all | Send |
| Source `domain`, family google / microsoft / mimecast / proofpoint | Not asked | Miss |
| Personal or blocked mailbox | Any | Miss, hunt continues |
| Stored on the card, family `other`, no source | SMTP deliverable and not catch-all | Send |
| Stored on the card, mute MX, no source | Not asked | Miss, until a scrape cites it |

A company-domain address that was typed onto a Google or Microsoft card is in that last row. It is a real-looking address and this programme still does not send it until a scrape cites it, or Shaun reaches the company by phone, letter, or form. A hard-bounced send is not a completed reach. The mailbox is cleared and the hunt continues while attempts remain.

`isCrmHarvestCandidate` today returns false when any email is present and the lead is not bounced. For `charge_sme`, an address that fails this gate does not count as present. The text stays on the card. Clients keeps showing Not sent until a real send.

## Harper queue

`harvestCrmLeads` queues `charge_sme` rows with no reach-gate mailbox ahead of `ok_sme` and `unsure`, including rows where Jev set `harvestNow` on the weaker class. Inside the pool, the existing `harvestPriority` order stands (lender cost, borrower score, charges, `charge_sme` bonus). Charity and holding stay excluded via `isHarvestSkipClass`.

A mute-MX domain guess returned by `attachOne` is treated as a miss for this pool: attempts increment, `waitUntil` is set as today, and `applyHarvestToCrmLead` does not take that address. A published or SMTP-confirmed address is saved and the lead leaves the hunt.

## James

A `charge_sme` lead whose address passes the reach gate, and who has no non-bounced sent or mock first-touch in Agent Mail (and no campaign recipient in sent, delivered, opened, or clicked), becomes an ordinary SME hopper file on the existing path (`source: distress_scan`). James sends the Workforce templates already in production. The deal stores the confidence from the gate (95) and the source (`firecrawl` / `osint` / `wayback` / `domain`).

First-touch selection sends due follow-ups and inbound work first. Remaining first-touch slots go to this pool, lender cost descending, before other SME first-touches. The second non-responsive queue is unchanged.

A `charge_sme` hopper file whose only mailbox fails the reach gate is not sent. That closes the other door: the general distress hunt must not enrol a mute-MX guess for a company number in this pool.

## Fallback desk

The existing letters pages (`/crm/letters` and `/clients/letters`) and `GET /api/god/crm/charge-letters` become the desk. God Mode auth stays. A company appears on exactly one list.

Eligible: `skipClass === "charge_sme"`, `attempts >= 6`, no reach-gate mailbox, not do-not-contact, no completed email reach (the same sent, mock, or campaign rule as enrolment), no `reachOutcome` yet.

1. **Calls**, when `phone` is non-empty. All of them. Lender cost descending. Shaun marks called.
2. **Letters**, when there is no phone, `letterFirstName(contactName)` is non-empty, and `address` is non-empty. Up to the weekly remainder (20 minus letters marked posted this London week). Lender cost descending. Shaun strikes a home address or marks posted. Copy from `letterForLead`.
3. **Forms**, when there is no phone and no letter qualification, and `website` is non-empty. Shaun marks form sent, or no form on the site.
4. **No channel.** No phone, no letter qualification, no website. The row is completed as `no_channel` without a list.

A home-address strike stores `reachSkip: "home"`. The company leaves the letter list. If `website` is set, it appears on the form list. If not, the outcome is `home` and the programme ends.

The letters route today takes the first 20 `charge_sme` or business-signal leads in table order, including companies that already have an email or a phone, and it does not remember a posting. That selection is replaced by the rules above.

## Memory of a touch

Email touches stay derived from Agent Mail. No contacted flag on the lead.

Call, letter, and form touches are written on the harvest row (`uploads/crm_harvest.json`), because nothing else records them:

```
reachOutcome?: "call" | "letter" | "form" | "no_form" | "home" | "no_channel"
reachOutcomeAt?: string   // ISO time
reachSkip?: "home"
```

`POST /api/god/crm/charge-letters/outcome` accepts `{ leadId, outcome }` where outcome is `call`, `letter`, `form`, `no_form`, or `home`. The handler checks the company is eligible for that outcome, then writes the row. Marking `letter` when 20 have already been posted this London week is rejected. Marking a do-not-contact company is rejected.

The next page load hides a company with a `reachOutcome`. `reachSkip: "home"` hides it from letters only.

## Error handling

- Companies House 429: the pass stops, as today. No partial enrol from a failed officer fetch.
- SMTP unknown, or catch-all: the address fails the gate. Attempt counts as a miss when it came from `attachOne`.
- Opt-out between page load and posting: the mark endpoint re-checks suppression and refuses the letter.
- Duplicate enrol: a company number that already has an SME hopper file, or a day-1 send, is not enrolled again.
- Missing director name: no letter. The company falls through to the form list when a website exists.
- Empty address: same as a missing director.

## Tests

Vitest, under `server/__tests__`.

- Reach gate: cited address with MX passes. Domain guess with SMTP deliverable and not catch-all passes. Mute-MX domain guess at 75 fails. Personal mailbox fails. Stored mute-MX address with no source fails. Stored honest-MX address passes only when the probe is deliverable and not catch-all.
- Harvest candidate: `charge_sme` with a personal or mute-MX address and attempts under 6 is still a candidate. A reach-gate address is not. Attempts at 6 are not.
- Queue order: a `charge_sme` miss sorts before an `ok_sme` or `unsure` row with `harvestNow: true`.
- Harvest apply: a mute-MX `attachOne` result does not write the email onto a `charge_sme` lead and does increment attempts. A published result writes the email.
- James: a `charge_sme` deal with confidence 75 and source `domain` is not selected for first-touch. A confidence 95 published address is selected ahead of a non-pool SME first-touch. A deal with a non-bounced sent or mock first-touch is not selected again. A hard bounce does not count as a completed reach.
- Desk: phone lands on calls. No phone, named director, and address lands on letters. No phone and no address, with a website, lands on forms. Do-not-contact, attempts under 6, reach-gate email, and a finished outcome are absent. The letter list stops at the weekly remainder. A home strike moves a company with a website onto forms and completes a company with no website. The outcome endpoint rejects a 21st letter in the same London week.

## Files

- `shared/mailboxScore.ts` and `shared/smeHopper.ts`: the reach-gate predicate next to the existing confidence and sendable checks.
- `shared/crmLeadContact.ts`: `charge_sme` candidate ignores an address that fails the gate.
- `server/services/crmHarvest.ts`: queue order, and do not save a mute-MX guess on this pool.
- `server/services/agenticWorkflow.ts`: enrol from a passing seed, and skip a `charge_sme` first-touch that fails the gate.
- `shared/chargeLetter.ts`: letter eligibility for the desk (named director required for this programme). The letter body stays.
- `server/routes/crm.ts`: desk query and outcome mark.
- `client/src/pages/ChargeLetters.tsx`: calls, letters, forms, and the mark actions.
- Tests beside the modules above.

## Out of scope for the implementation that follows this spec

Deploy, copying `dist`, and restarting NexusApp. The spec is the behaviour. Shipping it to the live service is a separate step after the tests pass.
