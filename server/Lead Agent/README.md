# Super Lead Finder (Stream A)

UK SME **signal** desk for Strata Finance inside Nexus. Agent ID `slf.agent.v1` / SLF-2.

Watches the existing Stream A hopper plus Companies House charges and Gazette HMRC petitions. Scores with Sales OS. Queues Book moved / New names for Shaun. Never outreach. Never a property agent.

Spec: `docs/superpowers/specs/2026-09-07-super-lead-finder-design.md`  
Org: `docs/agentic-org/agents/SLF-2.md`

Google Maps is **not** the finder. Places/Firecrawl remain attach tools on RES-2 after accept.

List factory (LST-2 / `slf.list.v1`): lawful mailboxes for the Stream A book. Director primary. Never guess `info@`. Never send. Adapter spec: `docs/superpowers/specs/2026-09-07-nexus-adapter-design.md`.

---

## Architecture

```
Stream A hopper (Nexus) + CH REST + Gazette
        │
        ▼
Super Lead Finder  (src/agent.ts)  slf.agent.v1
        │  look up book → resolve → score Sales OS → queue
        ▼
lead_finder.db   signals / aliases / suppressions  (not a rival pipeline)
        │  Shaun accept
        ▼
slfNexusAdapter  promote | enrich | intelligence_only | create
```

Maps CLI commands below are legacy attach helpers. They must not invent companies.

---

## Setup

```bash
# Install dependencies
npm install

# Install Playwright browser
npx playwright install chromium

# Configure environment
cp .env.example .env
# Add your ANTHROPIC_API_KEY

# Initialise database
npm run dev init
```

---

## Usage

### Via Agent (recommended)

From the Nexus repo root:

```bash
npm run slf -- ingest 01234567 --fixture
npm run slf -- ingest 09876543 --fixture
npm run slf -- queue
npm run slf -- accept 01234567   # promote existing SME deal, no second file
npm run slf -- accept 09876543   # create hopper:gated Stream A deal in Deal Files
npm run slf -- list-ingest ./contacts.csv
npm run slf -- list-refuse ./uk_emails_10m.csv
```

Gold fixtures: `01234567` warm MCA, `09876543` hot HMRC petition, `07777777` stacked debt.

Live Companies House ingest (needs `COMPANIES_HOUSE_API_KEY`):

```bash
npm run slf -- ingest <company_number>
```

### Via CLI

```bash
# Scrape Google Maps
npm run dev search "HVAC companies in Manchester" --max-results 50

# Enrich with emails
npm run dev enrich --batch-size 10

# Check status
npm run dev status

# Export quality leads
npm run dev export --min-rating 4.0 --output leeds_brokers.csv
```

### Via TypeScript (agent architecture integration)

```typescript
import { LeadFinderAPI, LEAD_FINDER_TOOLS } from './src/api.js';
import { LeadFinderAgent } from './src/agent.js';

// Direct API
const api = new LeadFinderAPI();
const result = await api.search({ query: 'commercial finance brokers in Leeds' });
const { summary, highQuality } = result;

// Agent
const agent = new LeadFinderAgent();
const result = await agent.run('Find commercial finance brokers in Leeds');
```

---

## Lead Score

Sales OS is the gate (`shared/salesOs.ts`). Display rank is 0–100 from config weights:

| Signal | Band |
|---|---|
| HMRC petition, still trading | Hot `hmrc_distress` |
| 3+ live non-bank charges | Hot `stacked_debt` |
| 1–2 live non-bank charges | Warm `high_cost_refi` |
| High-street-only charge | Not a lead |
| No timing signal | Noise — do not queue |

---

## PECR Status

| Status | Meaning |
|---|---|
| `ELIGIBLE` | Business email, role-based prefix (info@, sales@, etc.) |
| `UNCERTAIN` | Named individual — check before outreach |
| `INELIGIBLE` | Personal domain (Gmail, Hotmail, etc.) |
| `NOT_ASSESSED` | No email found yet |

---

## Agent Boundaries

| ✅ Does | ❌ Does NOT |
|---|---|
| Ingest CH / Gazette timing signals | Send email, call, or InMail |
| Score Stream A with Sales OS | Treat high-street-only ageing as a lead |
| Queue Book moved / New names | Open a second deal for a name already on the hopper |
| Hand `slf.lead_package.v1` to Nexus after accept | Hunt Stream B, property, brokers, or consumers |
