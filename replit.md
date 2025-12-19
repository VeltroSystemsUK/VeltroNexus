# FlowLoan - Commercial Lending Workflow Management Platform

## Overview
FlowLoan is a secure, multi-user commercial lending pipeline management system for lending teams. It streamlines the commercial lending process by tracking and managing company loan prospects from initial lead to final approval/rejection. Key capabilities include user authentication, user-specific data isolation, a drag-and-drop Kanban board, detailed company and prospect management, and a modern SaaS dashboard design. The platform aims to enhance efficiency in commercial lending.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend uses React, TypeScript, Shadcn/UI (Radix UI), and Tailwind CSS, adhering to a "New York" style with dark mode support. It features a component-based, type-safe, responsive design with card-based UI elements, subtle shadows, and borders. Typography uses Inter and JetBrains Mono, with an HSL-based color system for semantic tokens. Mobile layouts are optimized for iOS and Android, including a bottom navigation bar, responsive components, minimum 44px touch targets, and compact headers. The visual pipeline stages are Lead, Contacted, Qualified, Proposal, Due Diligence, Approval, and final status (Approved/Declined/Withdrawn).

### Technical Implementations
The frontend is built with React, TypeScript, Vite, and Wouter for routing. TanStack Query manages server state. Client-side form validation uses `react-hook-form` and `zod`. The backend uses Express.js with TypeScript and Node.js, providing a RESTful API with custom Vite integration, request/response logging, Zod for schema validation, and robust error handling. Replit Auth handles authentication.

### Feature Specifications
- **Prospect Management**: Includes a drag-and-drop Kanban board, user-specific data isolation, editable priority system, editable referral source tracking, confirmation-dialog-protected delete, and color-coded pipeline cards. PDF report generation for comprehensive prospect data is also available. Excel pipeline export includes grouped stages (Enquiry Stage, Post Enquiry, In Flight, Pending Investment, Declined/Withdrawn), with SIC Code in Sector column, User Name in Adviser column, and Referral Source tracking.
- **Company & Contact Management**: Integration with Companies House (UK) allows searching and fetching company profiles to auto-populate data. Contacts from Companies House are auto-synced and editable, with options to add manual contacts.
- **Due Diligence Tools**: Seven interactive tools, including a Checklist, Loan Calculator, DSCR Calculator, Affordability Estimator, Financial Ratios Calculator, Character Assessment, and an optional AI-powered Credit Underwriting tool (Premium tier).
- **CRM Features**: Integrated Activity Calendar for managing tasks, events, meetings, calls, and notes, a ToDoList for task management, and Task Reminders for urgent tasks.
- **Leads Import System**: Bulk import leads from CSV files with intelligent column mapping, a dedicated Leads page for tracking, and Companies House integration for prospect creation.
- **Subscription System**: A tiered model (Free, Standard, Premium) with prospect count limits.
- **Add-Ons Marketplace**: Allows purchasing prospect packs and feature add-ons, managed by Super Admins.
- **Profile and Settings**: Account information, subscription management, appearance customization (dark mode, colors), regional settings, customizable pipeline stage names, PDF report layout customization, and CSV data import.
- **White Label Branding**: Upload custom logos and customize primary/accent theme colors.
- **Role-Based Access Control (RBAC)**: A 4-role permission system (Super Admin, Sales Admin, Broker User, Underwriter) with a team management page and role-based navigation.
- **Role-Based Credit Underwriting Workflow**: Brokers can submit prospects for underwriting with priority and comments. Underwriters use a dedicated inbox to claim, review, make decisions (Approve, Decline, Query, Withdraw), and communicate with brokers via a conversation thread.
- **Prospect Document Management**: Upload, categorize, add notes, filter, download, and delete files associated with prospects. Files are stored in object storage with metadata in the database.
- **Master Broker Lender Directory**: Comprehensive lender management with enhanced schema (lender type, product types, loan amounts, LTV ranges, rates, sectors, regions, turnaround times, panel status). Features include lender products table, interaction tracking with timeline, BDM contact details, search/filter functionality, grid/table views, and lender detail pages with full profile display.
- **Webhook Integration**: External prospect capture via POST /api/webhooks/prospects endpoint. API key authentication via X-FlowLoan-Api-Key header. Accepts comprehensive payload including company details, prospect info, up to 5 contacts, full due diligence data (loan calculator, DSCR, affordability, financial ratios, character assessment), and metadata with external IDs. Enforces prospect limits and creates audit trail.

### System Design Choices
The application uses Drizzle ORM with Neon serverless PostgreSQL. The schema includes `Users`, `Sessions`, `Companies`, `Prospects`, `Activities`, and `Due Diligence` tables, ensuring user-specific data isolation and efficient data retrieval. `Due Diligence` stores assessment data in a JSONB column.

## External Dependencies

### UI Libraries
- **@radix-ui/**: Accessible UI primitives.
- **@hello-pangea/dnd**: Drag-and-drop.
- **lucide-react**: Icon library.
- **sonner**: Toast notifications.
- **tailwindcss**: CSS framework.

### Database & ORM
- **@neondatabase/serverless**: Neon serverless PostgreSQL client.
- **drizzle-orm**: TypeScript ORM.
- **drizzle-kit**: Schema migration tool.

### Authentication & Security
- **openid-client**: OpenID Connect client.
- **passport**: Authentication middleware.
- **express-session**: Session management.

### Development & Utilities
- **@tanstack/react-query**: Server state management.
- **wouter**: Lightweight routing.
- **date-fns**: Date manipulation.
- **zod**: Schema validation.
- **pdfkit**: PDF document generation.
- **vite**: Frontend build tool.

## Security Practices

### Dependency Scanning
Run `npm audit` regularly to check for vulnerabilities in dependencies:
```bash
npm audit                    # Check for vulnerabilities
npm audit --fix             # Auto-fix where possible
npm audit --audit-level=high # Only report high+ severity
```

### Security Measures Implemented
- **CSRF Protection**: Session cookies use `sameSite=lax` and Origin/Referer validation on state-changing requests
- **Webhook API Key Security**: API keys are stored as HMAC-SHA256 hashes, not plaintext
- **Request Size Limits**: Global 5MB limit with per-route enforcement for high-cost operations
- **Public Object Access Control**: Only allowlisted prefixes (branding/) can be served publicly
- **AI Governance Framework**: Two-tier consent model - user-level consent in Settings (aiDataConsent field) PLUS per-request consentToAiProcessing flag. All AI operations are audit logged with structured JSON (type, operation, userId, prospectId, dataSizeBytes, timestamp). Consent timestamp tracked in aiDataConsentAt field.
- **Role-Based Authorization**: Underwriting uploads require submission ownership verification
- **Rate Limiting**: Per-endpoint limits to prevent DoS and cost abuse:
  - Webhooks: 60 req/min per API key
  - PDF parsing: 30 req/min per user
  - AI endpoints: 20 req/min per user
  - Auth endpoints: 10 req/min per IP

### Observability
- **Structured Logging**: All API requests logged as JSON with type, timestamp, method, path, status, duration
- **Request IDs**: Unique UUID per request in X-Request-Id header for correlation
- **Error Logging**: Errors logged with request context and stack traces (dev only)
- **Rate Limit Logging**: Rate limit violations logged with key and path for monitoring

### Environment Variables (Security-Related)
- `WEBHOOK_KEY_SECRET`: 32+ character secret for HMAC key hashing (required in production)
- `SESSION_SECRET`: Secret for session encryption
- `DATABASE_URL`: PostgreSQL connection string (treat as sensitive)