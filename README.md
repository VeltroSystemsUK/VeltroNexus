# Veltro

**Built for Speed. Bred for Business.**

AI-enhanced commercial lending workflow management platform for UK commercial finance brokers.

## Overview

Veltro is a secure, multi-user commercial lending pipeline management system designed for lending teams. The name is inspired by the Italian Greyhound, representing speed, agility, and elite pedigree. Veltro retrieves Companies House data instantly and converts it into elite loan proposals, streamlining the process from initial lead to final approval.

## Key Features

### Ares AI Workforce

- **Managed Autonomy**: Deploy specialized AI agents for lead enrichment, doc validation, and credit analysis.
- **Agent Roster**: Digital associates with specific roles (Lead Finder, Underwriter, Outreach Manager).
- **Mission Auditing**: Real-time tracking of agent activities and "deviation" logs for quality control.

### Lead & Broker Discovery

- **Lead Finder**: AI-powered discovery of UK companies based on sector, location, and financial triggers.
- **Broker Finder**: Specialized search for brokerages and potential partners.
- **Enrichment Engine**: Automatic data enrichment using Companies House, Apollo, and Exa.ai.

### Companies House & iXBRL Intelligence

- **Instant Search**: Search by company name, number, SIC code, postcode, or director.
- **Financial Analysis**: Deep dive into iXBRL filings for advanced credit assessment.
- **Officer Profiles**: Auto-sync and enrichment of director and shareholder data.

### Pipeline Management

- **Visual Kanban**: 7-stage workflow: Lead, Contacted, Qualified, Proposal, Due Diligence, Approval, and Final Status.
- **Multi-tenant Isolation**: Secure data separation for individual users and teams.
- **Bulk Import**: Lead ingest via CSV with automatic field mapping.

### Google Workspace Integration

- **Gmail CRM**: Sync emails, compose messages, and track outreach within the platform.
- **Drive Storage**: Automatic document organization and synchronization with Google Drive.
- **Docs/Sheets**: One-click generation of proposals and audit reports.

### Due Diligence & Underwriting

- **Advanced Calculators**: DSCR, affordability, financial ratios, and character assessment.
- **Secure Doc Portal**: Collaborative document collection with AI-powered requirement validation.
- **Underwriter Inbox**: Dedicated queue for credit review and approval workflows.

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Shadcn/UI
- **Backend**: Express.js, Node.js
- **Database**: SQLite (`better-sqlite3`), local file only — no external database or hosting
- **Authentication**: `passport-local` + `express-session`, session store backed by SQLite
- **AI Engine**: Google Gemini (Flash & Pro models)
- **Search & Data**: Apollo (Enrichment), Exa.ai (Web research), Companies House API, Google Places
- **Communications**: Gmail API, Resend
- **Infrastructure**: Local machine only — this app is not deployed to any cloud provider

## Getting Started

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables in `.env.local` (see Environment Variables section)
4. Start the server:

   ```bash
   npm run dev       # development, with Vite HMR
   npm run build && npm start   # production build, run locally
   ```

The application will be available at `http://localhost:5000`.

## Environment Variables

Set these in `.env.local`:

- `SESSION_SECRET` - Session encryption key (required — the server refuses to start in production without it)
- `COMPANIES_HOUSE_API_KEY` - UK Companies House API key
- `GOOGLE_PLACES_API_KEY` - Google Places API key (lead sourcing, address verification)
- `GEMINI_API_KEY` - Google Gemini AI API key
- `EXA_API_KEY` - Exa.ai search API key
- `APOLLO_API_KEY` - Apollo.io data enrichment key
- `ZERO_BOUNCE_API_KEY` - Email verification service key
- `RESEND_API_KEY` - Resend email API key
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Google OAuth (Gmail/Drive integration)

## Project Structure

```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # UI components (AgentForge, Charts, CRM)
│   │   ├── hooks/          # Custom query/auth hooks
│   │   ├── pages/          # Feature-driven pages (Workforce, Pipeline, Finders)
│   │   └── lib/            # Shared utilities
├── server/                 # Backend Express application
│   ├── routes/             # Modular API routes (God mode, CRM, Agents)
│   ├── services/           # Business logic (Ares, Enrichment, Outreach)
│   ├── utils/              # API Clients (Gemini, Exa, Apollo, Companies House)
│   ├── sqliteStorage.ts    # SQLite data access layer (local file, no hosting)
│   └── storage.ts          # Storage interface
├── shared/                 # Shared code between frontend/backend
│   ├── schema.ts           # Zod schemas and TypeScript types
│   └── agents.ts           # AI Agent definitions
└── scripts/                # One-off data scripts and seed utilities
```

## License

All rights reserved.
