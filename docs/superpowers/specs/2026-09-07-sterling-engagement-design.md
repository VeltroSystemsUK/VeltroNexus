# Sterling engagement, accounts-prep, and no office number

Date: 2026-09-07  
Status: draft for review  
Repo: Nexus  
Owner: Shaun Tuhey  
Source: meeting with David Griffiths, Sterling Commercial Finance

## Goal

Stop sending David’s Nottingham office number to customers. After the file is collected, ask who will produce missing cashflow forecasts and/or management accounts. Before any pack goes to David, the customer e-signs a Sterling Engagement Letter. Public Learn copy matches: Strata’s packaging is free; Sterling’s work requires signed terms.

## Locked decisions

- **0115 984 9800 is never printed on agent outbound email.** No fallback to that number. Telnyx, when live, is an env-var drop-in (`STRATA_PHONE` or `STRATA_CALLBACK_NUMBER`). Until then the signature has email, address, and site only.
- Pack-upload (customer-facing, not email) also loses the 0115 number. Contact is email-only until Telnyx exists.
- Internal call playbooks may use the env var if set. They must not default to 0115. If the env var is empty, voicemail does not invent a number.
- **Strata packaging is free.** Assessment, pack collection, and building the file are not billed by Strata.
- **Sterling invoices** taking the case forward, and any cashflow / management-accounts production, **inside the Engagement Letter**.
- Missing **cashflow forecast, management accounts, or business plan** after collection triggers one accounts-prep email. The choice offered is: Sterling prepares cashflow and/or management accounts, or the client’s accountant will. We do **not** offer to write the business plan.
- Production is chargeable. A **quotation is given on request**, scaled to the funding amount sought. No invented pounds. No fee table in this pass.
- If they elect Sterling to prepare, **do not start that work until the Engagement Letter is signed**.
- **Every case going to David** needs a signed Engagement Letter, not only missing-docs cases.
- E-sign is **native**: tokenised public page on the same `uploadToken` as pack upload. Typed name + “I have read and agree”. No DocuSign.
- Letter content in this pass is **placeholder-v1**. Real fees and legal wording wait on David. A later version bump voids prior signatures; the customer re-signs.
- Workforce Strategy (factory graph) gains two nodes on the path to David: `accounts-prep` then, after the credit memo, `engagement`.
- Learn, James’s answer bank, and SAL-1 intake copy all state the free / signed-terms split.

## Non-goals

- Telnyx number on the signature or pack-upload page.
- DocuSign, Dropbox Sign, or any third-party signing vendor.
- Inventing Sterling’s fee table or final legal wording.
- Writing business plans for the client.
- Rewriting the Introduction Portal 1% / 1% engagement copy (stale surface, out of this pass).
- Making business plan a hard item on `REQUIRED_FOR_STERLING_SEND`. It triggers the ask; it does not newly block the zip.
- Auto-quoting a production fee from loan amount.
- Changing who sends inbound drafts (still Shaun).

## House line (verbatim in customer copy)

Use this split, not a single “we may charge later” hedge:

> Strata’s packaging is free. Sterling taking the case forward requires signed terms. Optional cashflow or management-accounts production is a Sterling charge, quoted on request against the amount of funding sought, and invoiced under the Engagement Letter. Nothing starts with Sterling until that letter is signed.

James may shorten for email. He may not invent pounds, imply Strata is free end-to-end, or imply Sterling works without signed terms.

## Process

Current factory path after files land: ingest → SFP complete → credit memo → Sterling zip → David.

New path:

```
collect pack
    → ingest
    → if cashflow OR management accounts OR business plan missing
          → accounts-prep email (one send)
          → sterling: wait for signed Engagement Letter, then production
          → accountant: chase until papers land
    → SFP / credit memo (Shaun)
    → Engagement Letter e-sign (every case to David)
    → Sterling zip (blocked until signed + required papers on file)
    → David
```

### Factory nodes

Add to `FACTORY_NODES` / `FACTORY_EDGES` in `shared/factoryGraph.ts`:

| id | label | desk | kind | detail |
|---|---|---|---|---|
| `accounts-prep` | Accounts prep | James | gate | Sterling to prepare CF/MA, or their accountant? |
| `engagement` | Engagement letter | Customer | human | E-sign Sterling terms before the pack leaves |

Edges:

- `ingest` → `accounts-prep` (missing CF / MA / BP)
- `partial` → `accounts-prep` (same missing set, not yet decided)
- `accounts-prep` → `fulfil` (accountant path / still waiting)
- `accounts-prep` → `engagement` (Sterling-prepares, letter not signed)
- `complete` (SFP) → `credit` unchanged
- **replace** `credit` → `sterling` with `credit` → `engagement` → `sterling` → `david`
- `engagement` → `sterling` only when `engagement.status === "signed"` on the live version

`nodeForDeal`:

- Missing CF/MA/BP, `accountsPrep.status` is unset or `asked` → `accounts-prep`
- `accountsPrep.status === "accountant"` and those items still missing → `fulfil` (chase)
- `accountsPrep.status === "sterling"` and letter not signed → `engagement`
- Stage `human_review` or `complete` without a live signed letter → `engagement` (not `sterling`)
- Signed, no `sterlingHandoffId` → `sterling`
- Signed with handoff → `david`

Introducer stream is unchanged. It does not gain these nodes.

### SAL-1 intake stages

Extend `docs/agentic-org/strata-inbound/intake.md` after stage 3:

| Stage | Trigger | James sends |
|---|---|---|
| 4 Accounts prep | Overview and core pack in; cashflow, management accounts, or business plan still missing | Choice: Sterling prepares CF and/or MA (chargeable, quoted on request, invoiced under the Engagement Letter) or their accountant will. Business plan is not offered as a Sterling product. |
| 5 Engagement | File otherwise ready for David, or they chose Sterling to prepare | Tokenised `/sign/:token` link. Placeholder letter until David confirms wording. |
| COMPLETE | Letter signed on the live version; required papers on file (Sterling-produced CF/MA count once uploaded) | Pack index for Shaun. No more chase. |

One accounts-prep email per file unless Shaun resets it. Same chase cap as pack chases: two, then Shaun (FM-13).

## Accounts-prep

### Trigger

After ingest, once per deal, if any of these are absent from `packDocuments` / completeness:

- `cashflow`
- `management-accounts`
- `business-plan`

Filed accounts already on file do **not** skip the management-accounts ask when latest management accounts are still missing. A business plan missing still fires the email even though we will not write one.

### Email (James)

State:

1. Which of the three are missing.
2. Two choices: Sterling prepares cashflow and/or management accounts, **or** their accountant will.
3. We do not prepare the business plan. If that is missing, the accountant or the client supplies it.
4. Production is a Sterling fee, quoted on request against the funding amount, invoiced under the Engagement Letter.
5. Strata’s packaging remains free.
6. If they choose Sterling, the next step is to e-sign the Engagement Letter. Production does not start before that.

Replies we recognise (store `accountsPrep.status`):

- Sterling / “you do it” / “please quote” → `sterling`
- Accountant / “we will send” / named accountant → `accountant`

Anything else: one clarifying draft, then Shaun.

`not_needed` is set automatically when all three items are already on the file, so the node is skipped.

### Completeness while Sterling is producing

`REQUIRED_FOR_STERLING_SEND` is unchanged (cashflow stays required for the zip; management accounts and business plan do not newly become zip-blockers).

While `accountsPrep.status === "sterling"`:

- Do not chase the client for cashflow or management accounts.
- Do not treat those as client-missing on fulfilment.
- Still require the produced files to land on the deal before `buildSterlingPackZip` succeeds, if they are in `REQUIRED_FOR_STERLING_SEND` (cashflow).
- Business plan remains optional for the zip.

Accountant path: keep chasing the missing items as today.

## Engagement letter

### Public page

- Route: `/sign/:token` (React, unauthenticated, same host rules as `/pack/:token`).
- API: `GET /api/sign/:token` (company name, contact first name, letter version, already-signed flag) and `POST /api/sign/:token` `{ name, accepted: true }`.
- Token: existing deal `uploadToken`. Invalid token → pack-upload tone, **no phone number**. Email `enquiries@stratafinance.co.uk` only.
- UI: letter text, typed name, optional title, required “I have read and agree” tick, submit.
- Empty name or no tick → stay on the page; nothing stored as signed.
- Already signed on this version → confirmation, not a second signature.

### Letter body (`placeholder-v1`)

Hosted as a versioned string in shared code (not a PDF vendor). Must include:

- Parties: the customer company and **Sterling Commercial Finance**.
- Strata Finance packages the file and does not lend. Strata’s packaging is free.
- Sterling takes the case forward only after this letter is signed.
- Fees for Sterling’s work, including optional production of cashflow forecasts and/or management accounts, will be set out in pounds in a later version of this letter / a written quotation. This placeholder does not create a specific fee.
- Signature is agreement to proceed with Sterling under terms to be confirmed in writing before any fee is payable.
- No 0115 number. No 1% figures from the Introduction Portal.

Live letter id is the constant `ENGAGEMENT_LETTER_VERSION` in `shared/engagementLetter.ts`, first value `placeholder-v1`. Changing that constant is a version bump: existing signatures whose `engagement.version` no longer matches are `void` and must re-sign.

### Persistence

On `AgenticDealFile`:

```ts
accountsPrep?: {
  status: "not_needed" | "asked" | "sterling" | "accountant" | "received";
  askedAt?: string;
  decidedAt?: string;
  missing: Array<"cashflow" | "management-accounts" | "business-plan">;
};

engagement?: {
  status: "not_sent" | "sent" | "signed" | "void";
  version: string; // "placeholder-v1"
  sentAt?: string;
  signedAt?: string;
  signedName?: string;
  signedIp?: string;
};
```

`received` = the missing CF/MA/BP have since landed (accountant or Sterling production uploaded).

Sending the sign link sets `engagement.status = "sent"` and `sentAt`. Successful POST sets `signed`, `signedAt` (ISO), `signedName`, `signedIp`. Changing the live letter version sets existing signatures on that deal to `void`.

### Zip gate

`buildSterlingPackZip` (and any Deal Files path that creates a Sterling handoff) fails with 400 unless:

1. Existing completeness gate still passes, **and**
2. `engagement.status === "signed"` **and** `engagement.version` equals the live letter id.

Error family matches today’s completeness message: the file is not ready for Sterling, name the gap (`Engagement Letter not signed`).

Shaun’s credit-memo checkpoint stays. The letter is an additional gate, not a replacement.

## Phone number

### Agent email signature

`shared/strataOutreach.ts`:

```ts
const PHONE = process.env.STRATA_PHONE || process.env.STRATA_CALLBACK_NUMBER || "";
```

`signatureText` / `signatureHtml` omit the phone line when `PHONE` is empty. Tests that expect `0115 984 9800` in HTML must expect its **absence**. Address and site stay.

`server/routes/agentMail.ts` uses `signatureHtml`; it follows automatically.

James inbound `templates/signature.md` already has no phone. Leave it.

### Pack upload

`client/src/pages/PackUpload.tsx`: remove `0115 984 9800` from the invalid-link copy and the footer. Invalid link: ask Maya to resend the email, or write to `enquiries@stratafinance.co.uk`. Footer: address only, or address + email. No office number.

### Call playbooks

`renderSmeCall` / `renderIntroducerCall` currently default `callback` to `PHONE`. If `PHONE` is empty, voicemail is “I’ll try you again” with no number. `renderWarmCall` already falls back to “the number on your enquiry email”; keep that. `agenticWorkflow` may still pass `process.env.STRATA_PHONE || process.env.STRATA_CALLBACK_NUMBER` through; passing undefined/empty is fine.

Do not hard-code 0115 anywhere customer-facing. Lender data (`0115 942 3772`) and Telnyx test CLI (`0115 661 1616`) are unrelated; leave them.

## Learn and public copy

### Line on the page

`PackagerLine` on Learn home and shared chrome becomes two facts: Strata packages and does not lend; **Strata’s packaging is free; Sterling requires signed terms.** Keep it short. Do not put fee pounds on the home page.

Home description / meta may mention the split. Explore CTA unchanged.

### Handbook

`DIRECTORS_HANDBOOK_SLUGS` gains `how-strata-and-sterling-work`, inserted after `hidden-commissions`:

1. `if-the-business-is-in-trouble`
2. `warehouse-brokers`
3. `hidden-commissions`
4. **`how-strata-and-sterling-work`** (new)
5. `hmrc-time-to-pay`
6. `terms-that-should-stop-the-pen`
7. `products-that-finish-companies`
8. `directors-in-the-danger-zone`
9. `help-that-is-actually-there`
10. `stacked-debt`

New markdown: `scripts/learn_courses/10-how-strata-and-sterling-work.md` with slug `how-strata-and-sterling-work`. Do not renumber 04–09. Handbook **order** is the slug array, not the filename number.

Lesson content:

- Strata packages. Does not lend. Packaging is free.
- Sterling takes the case to lenders. That needs an Engagement Letter, signed, before the pack is sent.
- If cashflow or management accounts are missing: Sterling can prepare them (quoted, invoiced under that letter) or the company’s accountant can.
- Business plan stays with the company / accountant.
- Contrast with warehouse “commitment fee on a card before anyone has seen the file”.
- No rates, no eligibility, no pounds until David writes them.

Quizzes: at least two. One on “Strata packaging is free / Sterling needs signed terms”. One on “who prepares missing forecasts”.

### Existing lessons to patch

- `01-if-the-business-is-in-trouble.md` — handbook index lists the new lesson. “Where Strata sits” / packager close mentions free packaging vs signed Sterling terms.
- `02-warehouse-brokers.md` — contrast: a packager who is doing the job does not take a commitment fee to look; Strata’s packaging is free; Sterling’s terms come later, in writing, signed.
- `03-hidden-commissions.md` — legitimate Sterling fees in writing and signed vs secret commissions. Do not recant *Wood* / *Hopcraft*.
- `08-help-that-is-actually-there.md` — “Where Strata sits” uses the house line.

Compliance: `reviewLearnCopy` still requires packager identity. The new lesson must say Strata packages and does not lend.

### Librarian

`LEARN_LIBRARIAN_SYSTEM` adds: Strata packaging is free; Sterling requires a signed Engagement Letter; do not quote fees in pounds; production of forecasts/accounts is Sterling, quoted on request. Questions about “what will I pay” remain a **handoff** (Explore / 10-minute review), not a made-up quote.

Add a desk prompt: “Is Strata’s packaging free?” → slug `how-strata-and-sterling-work`.

### Publish

Learn serves **live snapshots**, not the markdown on disk. After source edits: publish the new lesson and re-publish patched handbook articles through the existing Learn desk gates (or the existing publish script if that is how the handbook is loaded). Do not claim the public host is updated until snapshots exist.

## Answer bank and agent docs

`docs/agentic-org/strata-inbound/answer-bank.md` — **What does it cost?** leaves `[SHAUN TO CONFIRM]` for pounds, and James may now say the house line in full. Until David’s fee table exists: no charge for Strata’s packaging; Sterling’s terms (including any production of cashflow/management accounts) are in the Engagement Letter; a quotation is given on request; nothing starts with Sterling until that letter is signed.

`docs/agentic-org/corporate_structure.md` — complete Sterling file additionally requires a signed Engagement Letter on the live version.

`docs/agentic-org/CLAUDE.md` — never send a Sterling pack without the signed letter.

`docs/agentic-org/agents/SAL-1.md` — owns accounts-prep drafts and the e-sign send; still does not SMTP-send.

`docs/agentic-org/launch_readiness.md` — pack collection is no longer “three things then jump”; note the prep fork and engagement gate.

## Error handling

| Case | Behaviour |
|---|---|
| Bad sign token | 404-style page, no phone, email enquiries@ |
| POST without name or tick | 400, not signed |
| POST when already signed on this version | 200, idempotent confirmation |
| POST when status is `void` or version mismatch | 409, show the live letter, must sign again |
| Accounts-prep already `asked` / decided | do not send a second unsolicited prep email |
| Zip without signed live letter | 400, name the gap |
| Zip with signed letter but cashflow still missing | 400, existing completeness (cashflow still required) |
| Env phone unset | signatures and customer pages print no number |

## Tests

- `strataOutreach.test.ts`: agent HTML and text do **not** match `0115 984 9800`. Address and FCA line still present. With `STRATA_PHONE` set in the test env, the signature **does** include that value (Telnyx drop-in).
- Call playbook: empty phone → voicemail has no 0115 and no dangling “call me on”.
- Factory graph: `engagement` is on the path `credit` → `engagement` → `sterling` → `david`. `accounts-prep` exists. `nodeForDeal` maps the states above.
- Completeness helper: `accountsPrep.status === "sterling"` removes cashflow/management-accounts from **client chase** lists; cashflow still fails `evaluateSterlingCompleteness` until the file exists.
- E-sign: unsigned cannot zip; signed `placeholder-v1` can (given other completeness); version bump voids and zip fails again.
- Learn: new slug is in `DIRECTORS_HANDBOOK_SLUGS`; `reviewLearnCopy` passes on the new lesson; patched lessons contain the house split and still say Strata does not lend.
- Answer-bank / intake markdown is documentation; factory + outreach + sign tests are the executable contract.

## Files (implementation map, not a plan)

- `shared/strataOutreach.ts` — signature phone
- `shared/agenticWorkflow.ts` — `accountsPrep`, `engagement` on the deal file
- `shared/factoryGraph.ts` — nodes, edges, `nodeForDeal`
- `shared/sterlingCompleteness.ts` — add `clientChaseGaps(...)` that omits cashflow and management-accounts when `accountsPrep.status === "sterling"`; `evaluateSterlingCompleteness` for the zip is unchanged
- `shared/learn.ts` — handbook slug list
- `shared/learnLibrarian.ts` — system prompt + desk prompt
- `client/src/pages/PackUpload.tsx` — no 0115
- `client/src/pages/learn/LearnHome.tsx` — packager line
- `client/src/App.tsx` — `/sign/:token`
- New: `client/src/pages/SignEngagement.tsx`, `server/routes/signEngagement.ts`, `shared/engagementLetter.ts` (placeholder text + version id + sign payload checks)
- `server/services/sterlingPack.ts` — zip gate
- `server/services/agenticWorkflow.ts` — send prep email + sign link; stop CF/MA chase on sterling path
- `docs/agentic-org/**` and `scripts/learn_courses/**` as above
- Tests beside the modules they prove

## Success

1. A live agent email in CI has no 0115 number.
2. A deal missing a cashflow forecast is on `accounts-prep`, not silently in credit memo.
3. Choosing Sterling to prepare does not start production and does not open the zip.
4. `/sign/:token` records a signature; only then can the zip build (other papers permitting).
5. Learn handbook teaches the free / signed-terms split; the librarian will not contradict it.
)
