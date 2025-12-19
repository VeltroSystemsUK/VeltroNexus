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
Replit Object Storage for file uploads.

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

### Replit Auth (OIDC)
- Uses OpenID Connect protocol
- Session stored in PostgreSQL
- Session cookie: `connect.sid`

### Session Flow
1. User clicks "Login with Replit"
2. Redirected to Replit OIDC provider
3. User authenticates
4. Callback receives tokens
5. Session created and stored in PostgreSQL
6. Cookie set with session ID

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

### Replit Deployment
- Single container deployment
- Auto-scaling handled by platform
- Environment variables via Secrets
- Object storage via Replit integration

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
