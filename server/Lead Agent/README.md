# Lead Finder

Local business lead discovery and email enrichment for Veltro's commercial finance brokerage.

Part of the **Lead Finder Agent** — runs in parallel with the Prospecting Agent, reports to the Strategy Agent.

---

## Architecture

```
You (manual trigger)
        │
        ▼
Lead Finder Agent  (src/agent.ts)
        │  Claude reasoning layer — interprets instructions,
        │  decides tool sequence, widens searches if needed
        ▼
LeadFinderAPI      (src/api.ts)
        │
        ├── scrapeGoogleMaps()       →  Google Maps → Business[]
        ├── findEmail()              →  Multi-strategy email extraction
        ├── validateEmail()          →  MX record validation
        └── assessPecrEligibility() →  UK PECR compliance flag
        │
        ▼
SQLite  (lead_finder.db)
```

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

```bash
npm run agent "Find commercial finance brokers in Leeds, minimum 4 stars"
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

Each lead gets a `leadScore` (0.0–1.0) from:

| Signal | Weight |
|---|---|
| Rating (÷5) | 35% |
| Review count (log-scaled, cap 100) | 20% |
| Has website | 15% |
| Has email | 20% |
| Email confidence HIGH/MEDIUM | 5% |
| PECR eligible | 5% |

**High quality = score ≥ 0.7**

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
| Find and enrich leads | Qualify leads for product fit |
| Score and filter results | Contact or message leads |
| Report to Strategy Agent | Run unsolicited large searches |
