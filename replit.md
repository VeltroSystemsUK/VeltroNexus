# Lending Pipeline Management System

## Overview

A web-based lending pipeline management system that enables users to track and manage company loan prospects through various stages from initial lead to final approval/rejection. The application features a visual drag-and-drop Kanban board interface for moving prospects through pipeline stages, detailed company and prospect management, and a modern SaaS dashboard design.

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
- Drag-and-drop pipeline management using `@hello-pangea/dnd`
- Form validation with `react-hook-form` and `zod`
- Toast notifications using Sonner
- Visual pipeline stages: Lead → Contacted → Qualified → Proposal → Due Diligence → Approval → (Approved/Declined/Withdrawn)

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

**API Endpoints**:
- `GET /api/prospects` - List all prospects with company details
- `GET /api/prospects/:id` - Get specific prospect
- `POST /api/prospects` - Create new prospect
- `PATCH /api/prospects/:id/stage` - Update prospect stage
- `PATCH /api/prospects/:id` - Update prospect details
- `GET /api/companies/:number` - Get company by number
- `POST /api/companies` - Create new company

### Database Architecture

**ORM**: Drizzle ORM with PostgreSQL dialect
- **Database Provider**: Neon serverless PostgreSQL with WebSocket connections
- **Migration Tool**: Drizzle Kit for schema management

**Schema Design**:

**Companies Table**:
- `id` (auto-increment primary key)
- `companyName`, `companyNumber` (unique), `registeredAddress`
- `incorporationDate`, `companyStatus`, `companyType`
- `createdAt` timestamp

**Prospects Table**:
- `id` (auto-increment primary key)
- `companyId` (foreign key to companies)
- `stage` (pipeline stage: lead, contacted, qualified, etc.)
- `loanAmount`, `priority`, `notes`
- `createdAt`, `updatedAt` timestamps

**Relationships**:
- One-to-many relationship between companies and prospects
- Prospects are linked to companies via `companyId` foreign key
- Join queries return `ProspectWithCompany` type combining both tables

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