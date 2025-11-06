# LoanFlow - Commercial Lending Workflow Management Platform

## Overview

LoanFlow is a secure, multi-user commercial lending pipeline management system that enables lending teams to track and manage company loan prospects through various stages from initial lead to final approval/rejection. The application features user authentication, user-specific data isolation, a visual drag-and-drop Kanban board interface for moving prospects through pipeline stages, detailed company and prospect management, and a modern SaaS dashboard design.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management and caching
- **UI Framework**: Shadcn/UI component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system based on "New York" style preset

**Key Design Decisions**:
- Component-based architecture with reusable UI components in `/client/src/components/ui`
- Type-safe development with strict TypeScript configuration
- Path aliases (`@/`, `@shared/`, `@assets/`) for clean imports
- Responsive design with mobile-first breakpoints
- Dark mode support with theme toggle functionality

**Core Features**:
- **User Authentication**: Secure authentication using Replit Auth with support for Google, GitHub, X (Twitter), Apple, and email/password login
- **Landing Page**: Professional landing page for non-authenticated users with product features and CTA
- **User Profile**: Avatar-based user menu with sign-out functionality
- **Data Isolation**: Each user sees only their own prospects with userId-based filtering
- **Drag-and-drop Pipeline**: Visual Kanban board using `@hello-pangea/dnd`
- **Form Validation**: Client and server-side validation with `react-hook-form` and `zod`
- **Toast Notifications**: User feedback using Sonner
- **Visual Pipeline Stages**: Lead → Contacted → Qualified → Proposal → Due Diligence → Approval → (Approved/Declined/Withdrawn)
- **Professional Branding**: "LoanFlow" branding with TrendingUp icon and consistent design

### Backend Architecture

**Framework**: Express.js with TypeScript
- **Runtime**: Node.js with ES modules
- **API Pattern**: RESTful API endpoints under `/api/*` prefix
- **Request Handling**: Express middleware for JSON parsing, URL encoding, and request logging

**Key Design Decisions**:
- Separation of concerns with dedicated routing (`routes.ts`) and storage (`storage.ts`) layers
- Custom Vite integration for seamless development with HMR
- Request/response logging middleware for debugging
- Schema validation using Zod before database operations
- Error handling with appropriate HTTP status codes

**Authentication Endpoints**:
- `GET /api/login` - Initiate OpenID Connect login flow
- `GET /api/callback` - OAuth callback handler
- `GET /api/logout` - Sign out and clear session
- `GET /api/auth/user` - Get current authenticated user (protected)

**API Endpoints** (All Protected):
- `GET /api/prospects` - List user's prospects with company details
- `GET /api/prospects/:id` - Get specific prospect (user-scoped)
- `POST /api/prospects` - Create new prospect for current user
- `PATCH /api/prospects/:id/stage` - Update prospect stage (user-scoped)
- `PATCH /api/prospects/:id` - Update prospect details (user-scoped)
- `GET /api/companies/:number` - Get company by number
- `POST /api/companies` - Create new company

### Database Architecture

**ORM**: Drizzle ORM with PostgreSQL dialect
- **Database Provider**: Neon serverless PostgreSQL with WebSocket connections
- **Migration Tool**: Drizzle Kit for schema management

**Schema Design**:

**Users Table** (Required for Replit Auth):
- `id` (varchar primary key with UUID default)
- `email` (unique), `firstName`, `lastName`, `profileImageUrl`
- `createdAt`, `updatedAt` timestamps

**Sessions Table** (Required for Replit Auth):
- `sid` (varchar primary key)
- `sess` (jsonb session data)
- `expire` (timestamp with index)

**Companies Table**:
- `id` (auto-increment primary key)
- `companyName`, `companyNumber` (unique), `registeredAddress`
- `incorporationDate`, `companyStatus`, `companyType`
- `createdAt` timestamp

**Prospects Table**:
- `id` (auto-increment primary key)
- `userId` (varchar foreign key to users - for data isolation)
- `companyId` (integer foreign key to companies)
- `stage` (pipeline stage: lead, contacted, qualified, etc.)
- `loanAmount`, `priority`, `notes`
- `createdAt`, `updatedAt` timestamps

**Relationships**:
- One-to-many relationship between users and prospects (user data isolation)
- One-to-many relationship between companies and prospects
- Prospects belong to both a user and a company
- Join queries return `ProspectWithCompany` type combining prospects and companies

**Key Design Decisions**:
- Normalized design with separate companies and prospects tables to avoid data duplication
- Use of Drizzle relations for type-safe joins
- Schema validation using `drizzle-zod` for runtime type checking
- Timestamps for audit trail
- Stage stored as text for flexibility in pipeline configuration

### Design System

**Typography**:
- Primary font: Inter for UI
- Monospace font: JetBrains Mono for company numbers
- Hierarchical font sizing (text-xs to text-3xl)

**Color System**:
- HSL-based color variables for light/dark mode compatibility
- Semantic color tokens (primary, secondary, muted, destructive, accent)
- Stage-specific colors for pipeline visualization
- Priority-based badge colors (high/medium/low)

**Layout System**:
- Consistent spacing scale (2, 3, 4, 6, 8, 12)
- Responsive grid layouts for stats and Kanban columns
- Card-based component design with subtle shadows and borders

## Companies House Integration

**Purpose**: Integration with UK Companies House API to search and auto-populate company information

**Implementation**:
- Backend route: `GET /api/companies-house/search?q=QUERY`
- Uses Companies House Public Data API: `https://api.company-information.service.gov.uk/search/companies`
- Authentication: Basic Auth with API key as username, empty password
- Returns company search results with name, number, address, status

**Frontend Features**:
- Search box on `/search` page to query Companies House
- Results displayed as clickable cards
- Clicking a company auto-populates: company name, company number, and registered address
- User can then add loan details and create prospect

**Configuration**:
- Requires `COMPANIES_HOUSE_API_KEY` environment variable
- API key should be UUID format (e.g., `c84dd740-b31f-495b-8b28-a16980bcb1f6`)
- Get free API key from: https://developer.company-information.service.gov.uk/

**Technical Details**:
- Frontend uses React Query with custom queryFn to handle search
- Backend validates query parameter and returns formatted results
- Error handling for API failures with user-friendly messages
- Auto-population extracts address from `address` object or `address_snippet`

## External Dependencies

### Third-Party UI Libraries
- **@radix-ui/**: Comprehensive suite of accessible UI primitives (accordion, dialog, dropdown, popover, select, etc.)
- **@hello-pangea/dnd**: Drag-and-drop functionality for Kanban board
- **lucide-react**: Icon library for consistent iconography
- **sonner**: Toast notification system
- **class-variance-authority**: Utility for managing component variants
- **tailwind-merge**: Intelligent Tailwind class merging

### Database & ORM
- **@neondatabase/serverless**: Serverless PostgreSQL client for Neon database
- **drizzle-orm**: TypeScript ORM with type-safe queries
- **drizzle-kit**: Schema migration and management tool
- **ws**: WebSocket library for Neon serverless connections

### Authentication & Security
- **openid-client**: OpenID Connect client for Replit Auth
- **passport**: Authentication middleware for Express
- **express-session**: Session management with PostgreSQL storage
- **connect-pg-simple**: PostgreSQL session store adapter
- **memoizee**: Function memoization for OIDC config caching

### Development Tools
- **@tanstack/react-query**: Server state management and caching
- **wouter**: Lightweight routing library
- **date-fns**: Date formatting and manipulation
- **zod**: Schema validation
- **tsx**: TypeScript execution for development

### Build Tools
- **vite**: Frontend build tool and dev server
- **@vitejs/plugin-react**: React support for Vite
- **esbuild**: JavaScript bundler for backend build
- **tailwindcss**: Utility-first CSS framework
- **autoprefixer**: PostCSS plugin for vendor prefixes

### Replit-Specific
- **@replit/vite-plugin-runtime-error-modal**: Development error overlay
- **@replit/vite-plugin-cartographer**: Code navigation tool
- **@replit/vite-plugin-dev-banner**: Development environment banner