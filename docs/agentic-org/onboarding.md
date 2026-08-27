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

## SAL-2

- Use OS templates in `shared/strataOutreach.ts` only. Do not invent copy.
- Confirm SMTP is live (mail log `status` is not `mock`) before treating outreach as done.
- LinkedIn: write the script onto the deal. Stop.
- Calls: write `callPlaybook` and queue. Stop.

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
