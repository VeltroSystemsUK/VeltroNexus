# Strata launch readiness — agentic pipeline

**Date:** 2026-08-27  
**Owner:** Shaun (Director)  
**Question this document answers:** How much of find → outreach → collect → ingest → numbers → enrich → Sterling report can actually run with Shaun only on escalations?

Related: [corporate_structure.md](./corporate_structure.md) · [agents.mmd](./agents.mmd) · [CLAUDE.md](./CLAUDE.md)

---

## 1. The contract (what “working 100%” means)

The agent company does the administrative machine. Shaun spends time with customers.

| Stage | Agent owns | Shaun owns |
|---|---|---|
| Find customers | Hunt, score, open a deal file | Ambiguous Companies House match |
| Reach out | Template email cadence with PECR stop line | Phone; any live reply that is not a pack upload |
| Collect information | Pack portal, chase emails, missing-doc list | Call when two chases fail |
| Ingest | Parse files into a Standard Financial Profile | Unreadable scans / conflicting figures |
| Run the numbers | Credit memo **recommendation** with workings | Approve or reject the memo |
| Enrich records | CH, Places, Creditsafe, CRM fields | Identity disputes |
| End product | Complete Sterling zip with **nothing missing** | Final send to David (and David’s lender recommendation) |

If a file can reach Sterling with blanks, invented figures, or “STILL-MISSING.txt”, this contract is failed.

---

## 2. Verdict

**About 70–80% of the *volume* of work is realistically automatable.** The remaining 20–30% is irreducible: phone, live conversation, credit sign-off, customers who will not send documents, and legal/vulnerability stops.

**Today the app does not meet that bar.** Origination and cadence are half-built and real. The “end product” is a zip that is allowed to be incomplete. Processing/underwriting on the Deal Files path is Gemini describing the *deal log*, not reading the pack.

Treat the Workforce roster (named people, Unsplash photos, 97% scores, always-Online) as costume. The operating system is `agenticWorkflow.ts` + Sales OS + Sterling pack. Chat “Interact” is not the pipeline.

A third split that matters at launch: **Deal Files does not walk the CRM kanban.** Agentic create always writes prospect stage `lead`. Underwriting submit / Sterling return move CRM stages. Approving a deal in Deal Files does not put it on David’s desk.

---

## 3. What exists today (facts)

### 3.1 Two products sharing one page

| Surface | Reality |
|---|---|
| Workforce roster / Interact / ARES theatre | Personas + Gemini roleplay. Skill scores hardcoded. “Online” hardcoded. ARES success rate defaults to 100% with no jobs. |
| Deal files | Real stage machine. Companies House, Places, cadence timers, pack upload token, pipeline leads. |
| Prospect → Credit Studio → Sterling portal | Parallel file factory. This is where the funding-proposal PDF and zip actually live. **Deal Files “approve Sterling” does not compile that zip.** |

### 3.2 Cadence (Sales OS `2026.1`) — designed well, executed with holes

| Stream | Auto email | Human |
|---|---|---|
| SME 14-day | Day 1, 8, 14 | LinkedIn day 4 (copy only); day 14 call queued |
| Introducer 10-day | Day 1, 10 | LinkedIn day 5 (copy only); day 10 call queued |
| Inbound | Ack + pack request; day-3 chase | Warm call queued after chase |

Emails send for real **only if SMTP/Gmail is configured**. Otherwise they log as `status: mock` and never leave the box. Outbound From is the shared inbox (`enquiries@stratafinance.co.uk` / `MAIL_REPLY_TO`), display name is the persona.

Further holes in the send path (confirmed in code):

- **SMTP failures are swallowed.** `applyCadenceStep` catches send errors and still advances the deal as if the email went.
- **PECR is not checked at send.** Lead Finder can flag personal Gmail as ineligible; `sendOutreach` never reads `pecrStatus`. If Contact Finder put a personal address on the file, it can be mailed.
- **LinkedIn does not gate the cadence.** Copy is staged, then the timer fires the next email whether Shaun posted or not.
- **Pack upload does not wake the file.** Documents sit until the chase timer. No OCR/iXBRL/Gemini on the files at upload.
- **Inbound mailbox does not accept attachments** (Cloudflare worker is text + opt-out only). Customers must use the portal.
- **Daily hunt cap is small:** 5 charge-scan files, 15 Gazette, 15 introducers (`DISTRESS_SCAN_LIMIT` / related limits). Lead Finder cron defaults **off** (`LEAD_FINDER_AUTO_ENABLED`).
- **“Gemini Google Search” for contacts is a stub** — tools are dropped; it is not live search.
- After a close/warm call with **no pack**, outbound files are parked `failed`. That is correct stop-the-cadence behaviour, not a silent success.
- **Inbound `call_done` always continues to processing**, even with **zero files**. That will produce an LLM “underwrite” of an empty pack.
- **Inbound skips the fit ≥ 70 gate.** Hunt does not. Correct for live enquiries; do not confuse the two.
- **BBB:** insolvency / SIC / caps can auto-fail. The rest of the nine questions wait for a human tick. That is a real Shaun (or later, inferred) gate, not costume.
- **SIG-04 (net-worth erosion) never fires on hunt** because accounts/iXBRL are not loaded at origination. Sales OS claims it; the engine does not.
- **Tom Brennan copy** (Northampton / Coventry / Peterborough / MK) does not match live CH hunt (**Leicester / Nottingham / Derby**).
- **Sole trader / small partnership is not an intake gate.** FCA perimeter text lives in email footers and a staff library. Hunt/inbound will still open the file.
- **No suppression list before send.** Opt-out works only if the Cloudflare inbound webhook sees `stop` / `unsubscribe` *after* a mail has gone.
- **CRM and Deal Files are two rails.** Completing agentic `human_review` does not create a Sterling handoff, zip, or email to David.

### 3.3 Pack collection — too thin for Sterling

Customer portal asks for **three** things: 6 months bank statements, 2 years accounts, funding reason.

Sterling completeness list is **fourteen** items (`ATTACHMENT_ITEMS`): accounts, management accounts, bank statements, 24-month cash flow, debt schedule, director ID, proof of address, Companies House search, signed application, SAL, use of funds, HMRC/TTP, insurance, business plan/CVs.

Fulfilment treats “any file on the deal” as pack received and jumps to processing.

### 3.4 Ingest and numbers — the hole

Deal Files `runProcessing` / `runUnderwriting` call Gemini with company name + last six event log lines. They **do not open the PDFs**.

Credit Studio *does* send bank PDFs / accounts to an LLM JSON extractor (`analyzeFinancials`, `analyzeAuditedAccounts`). Truncated, not source-tagged, failure → zeros. That is better than Deal Files and still not a Standard Financial Profile.

iXBRL parser exists (`ixbrlService`) and is not on the Deal Files path.

The broker-ingest / broker-underwrite skills (SFP → credit memo, no invented figures, DSCR/ICR/stress/refinance-trap) **are not wired into Nexus**.

### 3.5 Sterling “end product” today

`buildSterlingPackZip` produces:

- Funding proposal PDF (9 pages; forecasts always `null`)
- Blank lender application templates (not filled)
- Supporting files that could be loaded from disk
- `STILL-MISSING.txt` if attachments are missing — **and send still proceeds**
- Handover questionnaire HTML (can travel with 0/27 answered)
- Recommendation text (David writes this in the portal)

Gates on send: non-empty recommendation + a lender id. That is all.

BBB eligibility must pass to *create* an underwriting submission. It does not require a complete pack.

Deal Files `approve_sterling` sets the deal `complete`. It does not build the zip or notify David.

---

## 4. Realistic automation by stage

| Stage | Today | Realistic with Shaun-in-the-loop | Why not 100% |
|---|---|---|---|
| Hunt / score Stream A & B | ~60% if Lead Finder pool is fed | **90%** | CH rate limits; ambiguous names; Gazette lag |
| Open deal + CH match | ~70% auto-select | **85%** | Multi-match needs Shaun |
| Contact email/phone | ~50% (Places/scrape/officers) | **70%** | Many SMEs have no public email |
| Cold B2B template email | Designed; mock without SMTP | **95%** of *sends* | PECR opt-out, bounce, complaint |
| Live email conversation | 0% | **20%** FAQ/pack-chase only | Everything else is customer work (Shaun) |
| LinkedIn | Copy staged, never posted | **Draft 100% / post 0%** | Do not automate LinkedIn at launch |
| Phone | Queued with script | **0% dial** | This *is* Shaun helping customers |
| Pack request + email chase | Portal + 1 inbound chase | **90%** of chases | After 2 failures, call |
| Pack completeness | 3-item portal vs 14-item Sterling | **100% as a gate** | Customer still has to upload |
| Ingest → SFP | ~10% | **75–80%** | Bad scans, missing pages, handwritten |
| Run numbers / credit memo | ~15% (LLM waffle or truncated JSON) | **80% recommendation** | Final credit decision is never an agent |
| CRM enrich | Partial | **85%** | Conflicting identity |
| Compile Sterling zip | Zip exists; completeness not enforced | **95% compile** once SFP is FINAL | Lender forms still need a filler pass |
| Send to David | Manual portal download | **Shaun clicks send** | Hard gate |

**Volume implication:** if 100 files are opened in a week, Shaun should see on the order of 15–25 items (matches, calls, replies, memo approvals, send clicks) — not 100 files of admin.

---

## 5. What Shaun must always do (non-negotiable)

From the agentic-org governance rules, adapted for a CDFI distress-refinance broker (the ICP *is* distressed limited companies — that cannot mean “review every first email”):

1. **No agent makes a final credit or lending decision.** Recommendation only. Shaun (then David/Sterling) signs off.
2. **No file goes to Sterling with missing required documents or a PARTIAL SFP.** Completeness is a block, not a text file.
3. **Phone is Shaun.** Agents queue a scripted call; they do not dial.
4. **Once a human replies with anything other than documents**, Shaun owns the thread (agents may draft).
5. **Complaints, opt-out disputes, vulnerability, solicitors, ICO/FCA language — stop all comms, alert Shaun.**
6. **Sole traders / partnerships of 3 or fewer** — regulated-agreement hard stop. Do not originate on the unregulated track.
7. **Legal agreements, credentials, spending, changing agent scope** — Shaun only.
8. **Gazette HMRC petition (SIG-02 / P0)** — first template email may send; Shaun is notified the same hour. These are the customers who most need a human.

---

## 6. Launch blockers (must be true before Strata goes live)

1. SMTP live. Mock email is not outreach. Send failure must **not** advance the deal.
2. Pack portal requests the **Sterling 14**, not three items. Chase names the gaps. Upload must wake FIN-2 immediately, not wait for the chase timer.
2a. Refuse send to personal/consumer addresses (honour PECR at `sendOutreach`, not only as a Lead Finder score).
2b. LinkedIn: either wait for Shaun to mark “posted” or drop the touch from the auto-rail. Do not pretend the connection request happened.
2c. Raise the hunt cap or the factory starves (5/15/15 per day is not a launch volume).
3. Completeness gate: FIN-2 will not hand a zip to Shaun, and Shaun cannot send to David, while required items or SFP status is PARTIAL.
4. When documents land, ingest runs **on the files** and writes an SFP. Missing = listed, never guessed.
5. Deal Files processing/underwriting stops summarising the event log. It consumes the SFP or it waits.
6. `approve_sterling` compiles the real zip (funding proposal + supporting + filled-or-explicitly-absent lender forms) and opens the Sterling handoff. Marking a deal “complete” is not the end product.
7. Forecasts are either produced from the SFP or the file stays PARTIAL (today `forecastPl` is always null).
8. Workforce costume (fake scores, fake Online, chat-as-employee) is labelled demo or removed from the operating path so it cannot be mistaken for the factory.
9. Oliver (accounts) and Nathan (capital strategist) stay **hibernated**. They are not the path to a Sterling file.
10. One orchestrator (`ORC-1`) owns the stage machine. Personas are desks, not independent companies.
11. Deal Files `approve_sterling` must create the Sterling handoff (and compile the zip). Completing the agentic rail is not a second product.
12. Sole trader / ≤3 partner partnership is a **hard stop at intake**, not a footer.
13. Inbound call-done with no pack must chase or queue Shaun — not “underwrite” an empty file.

---

## 7. What is already good enough to keep

- Sales OS signal matrix, broker exclusion, sector exclusions, facility/turnover bands.
- Cadence table with `autoSend` / `queueCall` split.
- PECR stop line on cold email (keep; never strip).
- BBB eligibility gate before underwriting submit.
- Companies House + charges + Gazette hunt.
- Pack upload token + public portal (extend the checklist, do not rebuild).
- Sterling zip assembler and funding-proposal renderer (add gates and real ingest; do not replace the artefact).
- Named mailboxes as **display names** on the shared inbox.

---

## 8. Implemented in Nexus (2026-08-27)

Code now enforces the contract on the stage machine:

1. **SMTP** — mock/failed send no longer advances cadence. PECR blocks cold email to personal mailboxes. LinkedIn waits for Shaun to mark posted.
2. **Pack portal** — required Sterling items (statements, accounts, cash flow, debt schedule, ID, use of funds) plus optional extras. Upload wakes ingest.
3. **Completeness gate** — `evaluateSterlingCompleteness` blocks Deal Files approve and Sterling zip download. No `STILL-MISSING.txt` on a sendable zip.
4. **SFP** — ingest writes a Standard Financial Profile. COMPLETE only with required docs **and** source-tagged figures. Processing will not underwrite a PARTIAL file or the event log.
5. **approve_sterling** — opens the Sterling handoff; refuses incomplete files.
6. **Hunt caps** raised (25 / 40 / 40). Oliver and Nathan hibernated. Roster labelled as costume.

**Still true:** SMTP credentials must be set in env or every auto-email holds for retry. SFP stays PARTIAL until sourced figures exist (no invented OCR). Forecasts are a required customer cash-flow file, not an auto-built model.

---

## 9. Target org (launch only — 3 domain agents)

See [corporate_structure.md](./corporate_structure.md).

```
Shaun (T0)
  └── ORC-1 Orchestrator  = the stage machine
        ├── RES-2 Origination   (Daniel hunt, Maya inbound, Elena contact)
        ├── SAL-2 Communications (James outreach, Sophie chase)
        └── FIN-2 File factory   (Priya ingest + memo + compile)
```

No new departments. No ARES as a boss. No chat workforce as the operator.
