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
- **Database**: Firebase Firestore (Highly scalable NoSQL)
- **Authentication**: Firebase Authentication (Google, Email/Password)
- **AI Engine**: Google Gemini (Flash & Pro models)
- **Search & Data**: Apollo (Enrichment), Exa.ai (Web research), Companies House API
- **Communications**: Gmail API, Resend
- **Infrastructure**: Vercel / Google Cloud Platform

## Getting Started

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables (see Environment Variables section)
4. Initialize Firebase:

   ```bash
   # Ensure you have the service account JSON configured
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5000`.

## Environment Variables

Required secrets:

- `FIREBASE_PROJECT_ID` - Firebase project identifier
- `FIREBASE_SERVICE_ACCOUNT_JSON` - Credentials for Firestore access
- `COMPANIES_HOUSE_API_KEY` - UK Companies House API key
- `GEMINI_API_KEY` - Google Gemini AI API key
- `EXA_API_KEY` - Exa.ai search API key
- `APOLLO_API_KEY` - Apollo.io data enrichment key
- `ZERO_BOUNCE_API_KEY` - Email verification service key
- `RESEND_API_KEY` - Resend email API key
- `SESSION_SECRET` - Session encryption key
- `GOOGLE_CLIENT_ID` - Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth Client Secret

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
│   ├── utils/              # API Clients (Gemini, Exa, Apollo)
│   └── storage.ts          # Firestore data access layer
├── shared/                 # Shared code between frontend/backend
│   ├── schema.ts           # Zod schemas and TypeScript types
│   └── agents.ts           # AI Agent definitions
└── scripts/                # Database migrations and seed utilities
```

## License

All rights reserved.
