# FlowLoan - Commercial Lending Workflow Management Platform

## Overview
FlowLoan is a secure, multi-user commercial lending pipeline management system designed for lending teams. Its purpose is to track and manage company loan prospects from initial lead to final approval/rejection, streamlining the commercial lending process. Key capabilities include user authentication, user-specific data isolation, a drag-and-drop Kanban board, detailed company and prospect management, and a modern SaaS dashboard design.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend is built with React and TypeScript, utilizing Vite for bundling and Wouter for routing. TanStack Query manages server state. The UI uses Shadcn/UI (Radix UI) and Tailwind CSS, adhering to a "New York" style. It features a component-based, type-safe, responsive design with dark mode support. Core features include Replit Auth, a professional landing page, user-specific data isolation, a drag-and-drop Kanban board, client-side form validation with `react-hook-form` and `zod`, and Sonner toast notifications. The visual pipeline stages are Lead, Contacted, Qualified, Proposal, Due Diligence, Approval, and final status (Approved/Declined/Withdrawn).

### Backend
The backend uses Express.js with TypeScript and Node.js, providing a RESTful API. It features custom Vite integration, request/response logging, Zod for schema validation, and robust error handling. Authentication endpoints handle OpenID Connect login/logout, while protected API endpoints manage CRUD operations for prospects, companies, due diligence data, and integrations.

### Database
The application uses Drizzle ORM with Neon serverless PostgreSQL. Drizzle Kit is used for schema management. The schema includes `Users`, `Sessions`, `Companies`, `Prospects`, `Activities`, and `Due Diligence` tables. `Users` and `Sessions` support Replit Auth, `Companies` stores company details, `Prospects` tracks loan stages, `Activities` stores user tasks/events/meetings/calls/notes with optional prospect association, and `Due Diligence` stores assessment tool data in a JSONB column. Relationships ensure user-specific data isolation and efficient data retrieval.

### Design System
A comprehensive design system defines typography (Inter, JetBrains Mono), an HSL-based color system for light/dark modes with semantic tokens, and a consistent layout with defined spacing and responsive grids. UI elements are card-based with subtle shadows and borders.

### Mobile Layout
The application features optimized mobile layouts for iOS and Android smartphones:
- **MobileNav**: Bottom navigation bar (hidden on desktop md+) with 5 icons: Pipeline, Search, Lenders, Submissions, Profile. Uses safe-area-inset-bottom padding for iOS home indicator.
- **Responsive Components**: All major components (PipelineStats, TaskReminders, Pipeline tabs, stage summary cards) use responsive Tailwind classes with md: breakpoints for tablet/desktop.
- **Touch Targets**: Minimum 44px touch targets for mobile usability.
- **Mobile CSS Utilities**: Custom CSS classes in index.css including `.safe-area-bottom`, `.safe-area-top`, `.mobile-content-padding`, `.touch-target`, `.mobile-scroll-x`, `.mobile-hidden`, `.desktop-hidden`.
- **Compact Headers**: Headers and buttons adapt with smaller sizing on mobile (h-9 icons vs h-11 on desktop).

### Feature Specifications
- **Companies House Integration**: Allows searching and fetching UK Companies House company profiles to auto-populate data and display detailed company information, including officers, persons with significant control, and charges.
- **Due Diligence Tools**: Seven interactive tools with data stored in a JSONB column:
  - Standard tier (6 tools): Checklist, Loan Calculator, DSCR Calculator, Affordability Estimator, Financial Ratios Calculator, Character Assessment
  - Premium tier (7th tool): **Credit Underwriting** - AI-powered comprehensive credit assessment with 6 substeps:
    1. Eligibility Check (11 policy questions for lending criteria)
    2. Bank Statement Upload (CSV file upload for financial analysis)
    3. Financial Analysis (Gemini AI-powered bank statement analysis with P&L, monthly breakdown, risk flags)
    4. Due Diligence Checks (Companies House data + Tavily-powered adverse media search)
    5. Results Summary (Risk grade A-E based on DSCR threshold 1.25, red flags, and due diligence findings)
    6. Adviser Summary (CAMPARI framework assessment for final credit recommendation)
- **Subscription System**: A tiered model (Free, Standard, Premium) limits prospect count per user, with server-side enforcement and a pricing page. Paid tiers unlock Due Diligence tools. Integrates with GoCardless for Direct Debit payments.
- **Prospect Management**: Includes an editable priority system with color-coded indicators, a confirmation-dialog-protected delete functionality with cascading deletions, color-coded pipeline cards that change based on stage (9 distinct colors from Lead to Withdrawn), and PDF report generation for comprehensive prospect data, including integrated Companies House details.
- **Profile and Settings Pages**: The Profile page displays account info, subscription status, upgrade options, and GoCardless integration for subscription management. The Settings page allows customization of appearance, regional settings (currency, timezone, date format), customizable pipeline stage names, and PDF report layout customization with drag-and-drop section reordering and toggle controls.
- **CRM Features**: Integrated CRM tools on the Pipeline Dashboard include: 
  - **ActivityCalendar**: Month-by-month calendar view showing all user activities with navigation controls. Click any calendar date to create new activities (tasks, events, meetings, calls, or notes) with optional prospect association. Activities display with type-specific icons: Task (ListTodo), Event (Calendar), Meeting (Video), Call (Phone), Note (FileText).
  - **ToDoList**: Comprehensive task management with create/complete/delete functionality, form validation, and activity type badges showing type-specific icons.
  - **TaskReminders**: Widget displaying 3 most urgent incomplete tasks sorted by due date with color-coded priority badges for overdue, due today, and upcoming tasks.
  
  Activities are stored in the database with userId (required) and prospectId (optional), enabling both prospect-specific and general user activities. All three CRM components share the same data source and display consistent type icons across the interface.

## External Dependencies

### UI Libraries
- **@radix-ui/**: Accessible UI primitives.
- **@hello-pangea/dnd**: Drag-and-drop.
- **lucide-react**: Icon library.
- **sonner**: Toast notifications.

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
- **gocardless-nodejs**: GoCardless SDK.

### Build Tools
- **vite**: Frontend build tool.
- **tailwindcss**: CSS framework.