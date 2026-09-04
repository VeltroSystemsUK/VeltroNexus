# Intake and pack collection — SAL-1

Email-first is the default. A call is offered only when a decision or explanation needs it, and only with the reader's agreement.

Never request bank logins or passwords. Never request personal financial data unrelated to the business. Never re-ask what Companies House already holds (company number, registered office, current officers). Fetch the public item (FM-14).

Thread notes record that an item was received, not its contents.

---

## 7.1 First overview (send in full once)

Ask for a short written picture, not the whole pack:

1. What the money is for (refinance / consolidation / working capital / HMRC / other).
2. Rough size of the facilities being serviced and how they are repaid (daily, weekly, monthly).
3. Whether there is an HMRC Time to Pay or arrears, and the current terms if so.
4. Whether they would rather continue by email or book a call.

They may instead take the four-question assessment at https://explore.stratanexus.co.uk.

Do not send the full pack list in the same email as the first overview unless they asked "what do you need?" as a Class A start.

---

## 7.2 Pack checklist

Aligned with `shared/sterlingCompleteness.ts` (customer-facing labels). Company search is Strata's job.

| Item | Who supplies | Notes |
|---|---|---|
| Latest filed or management accounts | Customer | Last two years if they have them |
| Last 3 months business bank statements | Customer | All accounts the facilities sweep |
| Simple cashflow / next 13 weeks | Customer | A spreadsheet is enough |
| Debt schedule | Customer | Lender, balance, repayment, rate or factor, start date, security |
| ID (director) | Customer | Passport or driving licence |
| Use of funds (one paragraph) | Customer | Often already in the overview |
| HMRC TTP letter / arrears statement | Customer | If HMRC was mentioned |
| Facility agreements / MCA contracts | Customer | If they have them; do not block the overview on this |
| Company search | Strata | Companies House — do not ask the customer |

---

## 7.3 Stages

| Stage | Trigger | James sends |
|---|---|---|
| 0 Overview | Class A yes, or "what do you need?" | 7.1 only |
| 1 Accounts + statements | Overview in, Shaun has not said stop | Accounts and bank statements |
| 2 Debt picture | Stage 1 landing | Debt schedule + any HMRC letter |
| 3 Identity + remaining | Stage 2 landing | ID, cashflow if still missing, facility docs if they have them |
| COMPLETE | All customer items in or Shaun waived | Pack index for Shaun. No more chase. |

One stage per email. Outstanding items only after the first full list.

---

## 7.4 Completeness check

On Class D: list filename, type, size in the packet. Map to checklist items by name. Open the file only for that mapping under Shaun's standing instruction; otherwise leave unopened.

Never assess credit in the acknowledgement.

When the last customer item lands: flag PACK COMPLETE, write `inbox/packs/<threadid>-index.md` (item, filename, date received — no figures).

---

## 7.5 Chase wording

Chase 1: outstanding list only, why each item is needed in one clause, no new asks.  
Chase 2: same list, offer email or a call with Shaun.  
No third chase without Shaun (FM-13). After 10 working days stuck on the same stage following two chases, flag Shaun with the outstanding items and a suggested note in Shaun's voice.

---

## Signature and footer

See `templates/signature.md`. Every draft uses it.
