# LoanFlow - Commercial Lending Workflow Management Platform

## Overview

LoanFlow is a secure, multi-user commercial lending pipeline management system designed for lending teams. It enables tracking and managing company loan prospects from initial lead to final approval/rejection. Key features include user authentication, user-specific data isolation, a visual drag-and-drop Kanban board, detailed company and prospect management, and a modern SaaS dashboard design. The platform aims to streamline the commercial lending process.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is built with React and TypeScript, using Vite for bundling and Wouter for routing. State management is handled by TanStack Query for server state. The UI leverages Shadcn/UI (built on Radix UI) and Tailwind CSS, following a "New York" style preset. It features a component-based architecture, type-safe development, responsive design, and dark mode support. Core features include secure user authentication (Replit Auth), a professional landing page, user-specific data isolation, a drag-and-drop Kanban board (`@hello-pangea/dnd`), client-side form validation (`react-hook-form` with `zod`), and toast notifications (Sonner). The visual pipeline stages include Lead, Contacted, Qualified, Proposal, Due Diligence, Approval, and final status (Approved/Declined/Withdrawn).

### Backend

The backend uses Express.js with TypeScript and Node.js. It provides a RESTful API with a clear separation of concerns between routing and storage. Key architectural decisions include custom Vite integration for seamless development, request/response logging, Zod for schema validation before database operations, and robust error handling. Authentication endpoints manage OpenID Connect login/logout, while protected API endpoints handle CRUD operations for prospects and companies, including specific endpoints for due diligence data and integrations.

### Database

The application utilizes Drizzle ORM with a PostgreSQL dialect, specifically Neon serverless PostgreSQL for database hosting. Drizzle Kit is used for schema management. The schema includes `Users`, `Sessions`, `Companies`, `Prospects`, and `Due Diligence` tables. `Users` and `Sessions` support Replit Auth, while `Companies` stores company details and `Prospects` links users to companies and tracks loan stages. The `Due Diligence` table stores assessment tool data in a JSONB column. Relationships are defined to ensure user-specific data isolation and efficient data retrieval through joins.

### Design System

A comprehensive design system dictates typography (Inter, JetBrains Mono), a HSL-based color system for light/dark modes with semantic tokens, and a consistent layout system with defined spacing and responsive grid layouts. The UI elements are card-based with subtle shadows and borders.

### Companies House Integration

A full integration with the UK Companies House API allows for searching companies (`/api/companies-house/search`) and fetching complete company profiles (`/api/companies-house/company/:companyNumber`). This enables auto-population of company data during prospect creation and detailed company information display within the prospect's details. The integration requires a `COMPANIES_HOUSE_API_KEY` and handles various company data fields, including financial, address, and status information.

### Due Diligence Tools

The platform includes six interactive due diligence tools, with data stored in a JSONB column in the `due_diligence` table. These tools are accessible via dedicated API routes and include:
1.  **Due Diligence Checklist**: A comprehensive 37-item checklist across 10 sections with progress tracking.
2.  **Loan Calculator**: Computes monthly payments and total interest based on loan amount, interest rate, and term.
3.  **DSCR Calculator**: Calculates Debt Service Coverage Ratio and performs sensitivity analysis with visual pass/warning/fail indicators.
4.  **Affordability Estimator**: Assesses loan affordability based on personal income, commitments, and proposed loan payment.
5.  **Financial Ratios Calculator**: Calculates key financial ratios (Profit Margin, Current Ratio, Debt-to-Equity, ROE, Asset Turnover) from input financial data.
6.  **Character Assessment Tool**: Provides a qualitative assessment using a 1-5 rating scale across categories like Management Experience and Credit History.
All tools feature real-time calculations, data persistence, and client-side validation.

## External Dependencies

### UI Libraries
-   **@radix-ui/**: Accessible UI primitives.
-   **@hello-pangea/dnd**: Drag-and-drop functionality.
-   **lucide-react**: Icon library.
-   **sonner**: Toast notifications.
-   **class-variance-authority**: Component variant management.
-   **tailwind-merge**: Tailwind CSS utility.

### Database & ORM
-   **@neondatabase/serverless**: Neon serverless PostgreSQL client.
-   **drizzle-orm**: TypeScript ORM.
-   **drizzle-kit**: Schema migration tool.
-   **ws**: WebSocket library.

### Authentication & Security
-   **openid-client**: OpenID Connect client.
-   **passport**: Authentication middleware.
-   **express-session**: Session management.
-   **connect-pg-simple**: PostgreSQL session store.
-   **memoizee**: Function memoization.

### Development & Utilities
-   **@tanstack/react-query**: Server state management.
-   **wouter**: Lightweight routing.
-   **date-fns**: Date manipulation.
-   **zod**: Schema validation.
-   **tsx**: TypeScript execution.

### Build Tools
-   **vite**: Frontend build tool.
-   **@vitejs/plugin-react**: React support for Vite.
-   **esbuild**: JavaScript bundler.
-   **tailwindcss**: CSS framework.
-   **autoprefixer**: PostCSS plugin.

### Replit Specific Tools
-   **@replit/vite-plugin-runtime-error-modal**: Error overlay.
-   **@replit/vite-plugin-cartographer**: Code navigation.
-   **@replit/vite-plugin-dev-banner**: Development banner.