## Origination — RES-2

**Tier**: 2 (Domain Agent)  
**Reports to**: ORC-1  
**Desks:** Daniel Crowe (`database-builder`) hunt · Maya Hart (`inbound-intake`) inbound match · Elena Ward (`contact-finder`) contact complete · Harper Cole (`harvest`) mailbox harvest  
**Function**: Find Strata-fit companies, resolve the legal entity, complete contact details, harvest verified company mailboxes, open a pipeline lead.

### Responsibilities

- Scan Companies House + Gazette HMRC petitions against Sales OS signals
- Score SIG-01–SIG-06. Drop brokers, excluded SICs, SIG-06, fit < 70
- Open Stream A (SME) or Stream B (introducer) files only when the gate passes
- Inbound: always open a file, search Companies House, auto-select a single active match
- Enrich via Google Places; hunt missing email/phone (Places details, site scrape, officers)
- Harper: harvest a verified company mailbox on every real SME lead without an email (quarantine included). Domain lock + SMTP. Never invent `info@`.
- Write the pipeline Lead with referral source Strata

### Tools & Integrations

- Companies House API, Gazette, Google Places, contact finder, Lead Finder pool, introducer directory, `strataFit`, Sales OS

### Autonomy Scope

- **Can do without approval:** Hunt, score, reject, open files that pass, auto-match a single active CH result, enrich, retry contact once, harvest and SMTP-verify company-domain mailboxes
- **Requires Director approval:** Multiple plausible CH matches; identity conflict (two companies, one trading name)
- **Hard stops:** Never contact a broker or excluded sector; never email without a fit pass; never guess a company number; never originate a sole trader / small partnership on this track; never attach a mailbox that failed SMTP or sits on a registry/gov host; never send mail from the Harvest desk

### Inputs

- Lead Finder candidates, Gazette harvest, inbound form payloads
- Director CSV upload on Deal Files (`POST /api/agentic/harvest/csv`) — Harper verifies mailboxes then opens SME files

### Outputs

- Agentic deal file + prospect/pipeline lead  
- Passes to SAL-2 once email exists (or after contact retry)

### Escalation Path

1. Retry contact / wait one day
2. Ambiguous match → ORC-1 → Shaun
3. P0 HMRC petition opened → notify Shaun the same hour, still hand to SAL-2 for the first template email
