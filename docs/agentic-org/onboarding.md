# Onboarding — Strata agentic org

How to initialise an agent for a session on Nexus.

## Every session

1. Read [CLAUDE.md](./CLAUDE.md).
2. Read [corporate_structure.md](./corporate_structure.md) sections 5–7 (gates, escalation, hard stops).
3. Open your spec in `agents/`.
4. Confirm you are **not** Oliver, Nathan, ARES, or a Workforce chat persona.
5. If the task is not in the delegation matrix → escalate, do not guess.

## ORC-1

- State: `storage.listAgenticDeals()` and `tick()` due timers.
- Advance only along the stage rail in `shared/agenticWorkflow.ts`.
- Put Shaun items in `waiting_human` with a one-line `humanReason`.

## RES-2

- Hunt from Lead Finder pool + Gazette; never from invented companies.
- Apply `shared/salesOs.ts` and `server/services/strataFit.ts` before opening a file.
- Inbound: always open a file, then match Companies House.
- Harper (`harvest`) works every real SME file without an email, plus CSV uploads from Deal Files. Domain from the company website. SMTP must pass. No invented `info@`. CSV emails are not trusted until Harper grades them; Gmail/Hotmail stay personal.

## SLF-2

- Read `docs/agentic-org/agents/SLF-2.md` and `docs/superpowers/specs/2026-09-07-super-lead-finder-design.md`.
- Stream A only. Sales OS wins. Queue-first: look up the SME hopper before any `create`.
- Never outreach. Never Maps-as-finder. Never property (planning, EPC, high-street ageing).
- Unresolved names stay in quarantine. Auto-push is off.
- Nexus I/O only through `slfNexusAdapter` / `docs/superpowers/specs/2026-09-07-nexus-adapter-design.md`.

## LST-2

- Read `docs/agentic-org/agents/LST-2.md` and `docs/superpowers/specs/2026-09-07-super-list-finder-design.md`.
- Book-first: hopper rows missing a sendable mailbox, then operator CSV.
- Classify with `gradeMailbox`. Director is primary. Published role may attach. `role_guess: false`. Never invent `info@`.
- Never send. Never create a deal. Never ingest a dump (`list refuse`).
- Same adapter client as SLF-2.

## REF-2

- Read `docs/agentic-org/agents/REF-2.md`. Tom Brennan persona. Do not un-hibernate regional hunt.
- Accountants / turnaround only. Brokers are `not_an_introducer`.
- Only writer of `reachableCorporateContact`. Never send. Never enrol James.
- `npm run slf -- refer ingest 04440000 --fixture` then `refer accept 04440000`.

## SAL-1

- Read `docs/agentic-org/strata-inbound/CLAUDE.md`, then `answer-bank.md` and `inbox/log.md`.
- IMAP read + Drafts write only. No SMTP.
- Classify A–M. Draft from the answer bank. Packet in `inbox/queue/`. Never send.
- STOP: no draft. Confirm suppression with Rowan / Shaun.

## SAL-2

- Hunt desk is James Hale (`slf.outreach.v1`). Spec: `docs/superpowers/specs/2026-09-07-super-outreach-design.md`.
- Use OS templates in `shared/strataOutreach.ts` only. Do not invent copy. Playbooks: `shared/playbooks/`.
- Eligibility every tick (`shared/slfOutreach.ts`). SMTP mock/fail holds the file. Stream B needs Refer reachability.
- Confirm SMTP is live (mail log `status` is not `mock`) before treating outreach as done.
- LinkedIn: write the script onto the deal. Stop.
- Calls: write `callPlaybook` and queue. Stop.
- Live inbound replies: stop the cadence and hand to SAL-1.

## MKT-2

- Read `docs/agentic-org/agents/MKT-2.md`, then the studio licence `shared/craftManual.ts`. Recipes: `shared/craftHelp.ts`.
- Idea before board. Week copy pass is `islaDirector.craftWeek` — weekday playbook is injected. Do not dump the 67k persona into that JSON pass.
- Inspector adds a motion plate; right-click replaces. Overlays: `cinematic-hook-slam`, `viral-hook-drop`. Live cap 8.
- Never post. Never invent a number. Never name a client.

## FIN-2

- Ingest files, not the event log.
- Write SFP. Status COMPLETE or PARTIAL. Never COMPLETE with gaps.
- Credit memo is a recommendation. Wait for Shaun.
- Compile zip only when completeness gate passes.

## First-run checklist (human)

- [ ] `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` (or Gmail app password) set
- [ ] `MAIL_REPLY_TO` / shared inbox working
- [ ] Companies House API key live
- [ ] Google Places key live (contact enrichment)
- [ ] `BROKER_HANDOFF_EMAIL` points at David’s portal user
- [ ] Pack portal reachable from customer emails
- [ ] Completeness gate enabled (do not ship with send-allowed-while-missing)

Hibernated desks stay off. Do not initialise `accounts-monitor` or `capital-strategist` for launch.
