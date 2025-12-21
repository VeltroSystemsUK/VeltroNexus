# FlowLoan - Commercial Lending Workflow Management Platform

## Overview
FlowLoan is a secure, multi-user commercial lending pipeline management system designed for lending teams. Its primary purpose is to streamline the commercial lending process by tracking and managing company loan prospects from the initial lead stage through to final approval or rejection. The platform offers key capabilities such as robust user authentication, user-specific data isolation, an intuitive drag-and-drop Kanban board, comprehensive company and prospect management tools, and a modern SaaS dashboard interface. The overarching goal is to significantly enhance efficiency within the commercial lending sector.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend is built using React, TypeScript, Shadcn/UI (Radix UI), and Tailwind CSS, following a "New York" aesthetic with dark mode support. It features a component-based, type-safe, and responsive design, utilizing card-based UI elements, subtle shadows, and borders. Typography is based on Inter and JetBrains Mono, with an HSL-based color system for semantic tokens. Mobile layouts are optimized for iOS and Android, incorporating a bottom navigation bar, responsive components, minimum 44px touch targets, and compact headers. The visual pipeline stages include Lead, Contacted, Qualified, Proposal, Due Diligence, Approval, and final statuses such as Approved, Declined, or Withdrawn.

### Technical Implementations
The frontend leverages React, TypeScript, Vite, and Wouter for routing, with TanStack Query managing server state. Client-side form validation is handled by `react-hook-form` and `zod`. The backend is developed with Express.js, TypeScript, and Node.js, providing a RESTful API. It includes custom Vite integration, request/response logging, Zod for schema validation, and comprehensive error handling. Replit Auth manages user authentication.

### Feature Specifications
- **Prospect Management**: Features a drag-and-drop Kanban board, user-specific data isolation, editable priority and referral source tracking, and confirmation-dialog-protected deletion. It also includes color-coded pipeline cards, PDF report generation, and Excel export with grouped stages and detailed prospect data.
- **Company & Contact Management**: Integrates with Companies House (UK) for automated company profile fetching and contact syncing, with options for manual contact addition.
- **Due Diligence Tools**: Offers seven interactive tools: Checklist, Loan Calculator, DSCR Calculator, Affordability Estimator, Financial Ratios Calculator, Character Assessment, and an optional AI-powered Credit Underwriting tool (Premium tier).
- **CRM Features**: Includes an integrated Activity Calendar, ToDoList, and Task Reminders.
- **Leads Import System**: Supports bulk CSV lead import with intelligent column mapping and Companies House integration for prospect creation.
- **Subscription System**: A tiered model (Free, Standard, Premium) with prospect count limits.
- **Add-Ons Marketplace**: Allows purchasing prospect packs and feature add-ons, managed by Super Admins.
- **Profile and Settings**: Manages account info, subscriptions, appearance, regional settings, customizable pipeline stage names, PDF report layout, and CSV data import.
- **White Label Branding**: Enables custom logo uploads and theme color customization.
- **Role-Based Access Control (RBAC)**: A 4-role permission system (Super Admin, Sales Admin, Broker User, Underwriter) with team management and role-based navigation.
- **Role-Based Credit Underwriting Workflow**: Facilitates broker submission, underwriter review (claim, approve, decline, query, withdraw), and communication via conversation threads.
- **Prospect Document Management**: Allows uploading, categorizing, noting, filtering, downloading, and deleting files associated with prospects, stored in object storage with database metadata.
- **Master Broker Lender Directory**: Comprehensive lender management with detailed schema, products table, interaction tracking, BDM contacts, search/filter, and detailed lender profile pages.
- **Webhook Integration**: Supports external prospect capture via a POST endpoint with API key authentication, accepting comprehensive payloads including company, prospect, contacts, due diligence data, and metadata.

### System Design Choices
The application utilizes Drizzle ORM with Neon serverless PostgreSQL. The database schema includes tables for `Users`, `Sessions`, `Companies`, `Prospects`, `Activities`, and `Due Diligence`, ensuring user-specific data isolation and efficient retrieval. The `Due Diligence` table stores assessment data in a JSONB column.

### Security & Quality
- **Standardized Error Handling**: Uses `handleApiError()` utility for consistent, safe error responses that log structured JSON server-side while returning sanitized messages to clients.
- **Underwriting Audit Logging**: Structured logging of all underwriting actions (claim, withdraw, approve, decline, query) with userId, role, status transitions, and source IP.
- **CI Pipeline**: Located at `scripts/ci.sh`, enforces:
  - Dependency vulnerability audits
  - ESLint with configurable warning threshold
  - Prettier formatting checks
  - Test coverage thresholds (3% minimum, 10% for security utils)
  - 'any' type usage baseline tracking
  - Raw error.message exposure detection
- **Technical Debt**: See `TECH_DEBT.md` for known TypeScript strict mode issues.

## External Dependencies

### UI Libraries
- **@radix-ui/**: Accessible UI primitives.
- **@hello-pangea/dnd**: Drag-and-drop functionality.
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