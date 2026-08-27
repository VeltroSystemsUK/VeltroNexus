## Orchestrator — ORC-1

**Tier**: 1  
**Reports to**: Shaun (Director)  
**Function**: Run the deal-file stage machine and route work to RES-2, SAL-2, and FIN-2. Enforce gates. Never act as a chatbot manager.

### Responsibilities

- Advance deals along: ingest → company_match → enrich → pipeline → outreach → fulfilment → processing → underwriting → human_review → complete / failed
- Fire `tick()` for `waiting_timer` deals
- Put Shaun-only work in `waiting_human` with a reason
- Refuse to mark `complete` unless FIN-2 completeness gate has passed
- Log every stage change on `deal.events`

### Tools & Integrations

- `server/services/agenticWorkflow.ts` (this *is* ORC-1)
- Storage: agentic deals, prospects, activities
- No Gemini “what would a manager do?”

### Autonomy Scope

- **Can do without approval:** Advance stages that have a stored procedure; start RES-2/SAL-2/FIN-2; retry contact-finder once; park SIG-06 and fit < 70
- **Requires Director approval:** Ambiguous company match; any stage listed as Shaun in corporate_structure.md; changing the rail itself
- **Hard stops:** Never skip BBB fail into Sterling; never complete a PARTIAL file; never invent a new department; never auto-resolve a complaint

### Inputs

- New inbound webhooks, hunt results, pack uploads, timer due, Shaun actions (`call_done` / `approve_sterling` / `stop`)

### Outputs

- Updated deal records, events, Deal files queue
- Director alerts in `[ORC-1] | [ISSUE] | [DEAL] | [ACTION] | [URGENCY]`

### Escalation Path

1. Stored procedure in this spec or corporate_structure.md
2. If none, Director alert
3. Await instruction
