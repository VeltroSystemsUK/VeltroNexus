# System Architecture

This document provides an overview of FlowLoan's architecture and key system flows.

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (React)                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │   Kanban    │ │  Prospects  │ │    Forms    │ │  Reports  │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP/REST
┌──────────────────────────▼──────────────────────────────────────┐
│                     Express.js Backend                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │   Auth   │ │   CSRF   │ │Rate Limit│ │  Routes  │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└───────┬───────────────┬───────────────┬────────────────────────┘
        │               │               │
   ┌────▼────┐    ┌─────▼─────┐   ┌─────▼─────┐
   │PostgreSQL│    │   Redis   │   │  Object   │
   │ (Neon)  │    │Rate Limits│   │  Storage  │
   └─────────┘    └───────────┘   └───────────┘
```

## Request Flow

### Authenticated Request
1. Request arrives at Express server
2. Security headers middleware adds CSP, X-Frame-Options, etc.
3. Request ID generated and attached
4. Body parsed with size limits enforced
5. CSRF validation for state-changing requests
6. Session validated via `express-session`
7. Rate limit checked against Redis
8. Route handler processes request
9. Response logged and returned

### Webhook Request
1. Request arrives at `/api/webhooks/*`
2. API key extracted from `X-FlowLoan-Api-Key` header
3. Key hashed and compared to stored hash (timing-safe)
4. Rate limit checked per API key
5. Payload validated against schema
6. Prospect created with audit trail
7. Response returned

## Data Layer

### PostgreSQL (Neon Serverless)
Primary database for all application data.

**Key Tables:**
- `users` - User accounts and settings
- `sessions` - Session storage
- `companies` - Company records (linked to Companies House)
- `prospects` - Loan prospects with pipeline stages
- `activities` - Activity log (tasks, notes, calls, meetings)
- `due_diligence` - Due diligence assessments (JSONB)
- `underwriting_submissions` - Underwriting workflow
- `prospect_documents` - Document metadata
- `lenders` - Lender directory
- `webhook_api_keys` - Webhook authentication

**ORM:** Drizzle ORM with type-safe queries

### Redis
Used for rate limiting across multiple instances.

**Data Structures:**
- Sorted sets for sliding window rate limits
- Keys formatted: `ratelimit:{type}:{id}:{path}`

### Object Storage
Local filesystem storage (`server/localStorage.ts`, `LocalStorageClient`) for file uploads — no cloud/object storage provider.

**Structure:**
```
bucket/
├── branding/           # Public - logo uploads
│   └── {userId}/
└── .private/           # Private - requires auth
    └── {userId}/
        └── {prospectId}/
            └── {filename}
```

## Authentication

### Session-based Auth (`server/auth.ts`)
- `passport-local` + `express-session`, password hashing via `scrypt`
- Session stored in SQLite (same local database as the rest of the app)
- Session cookie: `__session`
- `SESSION_SECRET` is required in production — the server refuses to start without it

### Session Flow
1. User submits email/password to `/api/login`
2. `passport-local` verifies against the stored `scrypt` hash
3. Session created and persisted to the SQLite session store
4. Cookie set with session ID

## Key Subsystems

### Pipeline Management
- 7 stages: Lead → Contacted → Qualified → Proposal → Due Diligence → Approval → Final
- Drag-and-drop via `@hello-pangea/dnd`
- Priority ordering within stages
- User data isolation enforced

### Due Diligence
- JSONB storage for flexible tool data
- Tools: Checklist, Loan Calculator, DSCR, Affordability, Financial Ratios, Character Assessment
- AI-powered Credit Underwriting (Premium tier)

### Underwriting Workflow
- Brokers submit prospects for review
- Underwriters claim submissions from queue
- Conversation thread for communication
- Decisions: Approve, Decline, Query, Withdraw

### File Management
- Streaming uploads (no RAM buffering)
- Categorization and notes
- MIME type validation
- Size limits enforced at parser level

### AI Integration
- Gemini AI for credit underwriting
- Two-tier consent model
- PII redaction before processing
- Audit logging of all operations

## External Integrations

| Service | Purpose |
|---------|---------|
| Companies House | UK company data lookup |
| GoCardless | Open Banking integration |
| Resend | Transactional email |
| Gemini AI | Credit underwriting analysis |
| Tavily | Web search for research |

## Deployment

### Local-only
- Runs on the local machine only, by design — no cloud hosting, no external database
- `npm run dev` (Vite HMR) or `npm run build && npm start` (local production build)
- Environment variables via `.env.local`
- SQLite database and file storage are both local files

### Health Monitoring
- `/healthz` endpoint for liveness/readiness
- Checks: Database, Redis, Object Storage
- Returns latency metrics

## Security Layers

```
Request
   │
   ▼
┌─────────────────────┐
│  Security Headers   │  CSP, X-Frame-Options, HSTS
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│   Request Logging   │  Structured JSON, Request ID
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│   Body Size Limit   │  5MB default, per-route overrides
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  CSRF Validation    │  Origin/Referer check
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│   Authentication    │  Session validation
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│    Rate Limiting    │  Redis-backed sliding window
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Authorization      │  Role-based access control
└──────────┬──────────┘
           ▼
     Route Handler
```
