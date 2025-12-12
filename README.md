# FlowLoan

AI-enhanced commercial lending workflow management platform for UK commercial finance brokers.

## Overview

FlowLoan is a secure, multi-user commercial lending pipeline management system designed for lending teams. It streamlines the commercial lending process by tracking and managing company loan prospects from initial lead to final approval or rejection.

## Key Features

### Pipeline Management
- Drag-and-drop Kanban board with 7 visual stages: Lead, Contacted, Qualified, Proposal, Due Diligence, Approval, and Final Status
- User-specific data isolation
- Editable priority system with color-coded cards
- Bulk import leads from CSV files

### Companies House Integration
- Search by company name, number, SIC code, postcode, or director
- Auto-populate company data instantly
- Auto-sync officers as contacts with enriched profiles

### Due Diligence Tools
- Interactive Checklist
- Loan Calculator
- DSCR Calculator
- Affordability Estimator
- Financial Ratios Calculator
- Character Assessment
- AI-powered Credit Underwriting (Premium tier)

### CRM Features
- Activity Calendar for tasks, events, meetings, calls, and notes
- To-Do List for task management
- Task Reminders for urgent items

### Master Broker Lender Directory
- Comprehensive lender database with 250+ UK lenders
- Favorite lenders with auto-sort to top
- Introducer agreement tracking
- Grid and table views with search and filters
- Lender detail pages with products, BDM contacts, and interaction history

### Document Management
- Upload, categorize, and organize files by prospect
- Financial statements, ID documents, property files, and more
- Secure cloud storage with metadata tracking

### Role-Based Access Control
- Super Admin: Full platform access
- Sales Admin: Team and sales management
- Broker User: Prospect and pipeline management
- Underwriter: Dedicated inbox for credit review

### Subscription Management
- Tiered plans: Free (10 prospects), Standard (50 prospects), Premium (unlimited + AI)
- GoCardless Direct Debit integration
- Add-ons marketplace for prospect packs and features

### White Label Branding
- Custom logo upload
- Customizable primary and accent theme colors

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Shadcn/UI
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM
- **Authentication**: Replit Auth (OpenID Connect)
- **Payments**: GoCardless
- **Email**: Resend
- **AI**: Google Gemini
- **File Storage**: Replit Object Storage

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables (see Environment Variables section)
4. Push database schema:
   ```bash
   npm run db:push
   ```
5. Start the development server:
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5000`.

## Environment Variables

Required secrets:
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `COMPANIES_HOUSE_API_KEY` - UK Companies House API key
- `GOCARDLESS_ACCESS_TOKEN` - GoCardless API token
- `GOCARDLESS_ENVIRONMENT` - GoCardless environment (sandbox/live)
- `RESEND_API_KEY` - Resend email API key
- `RESEND_FROM_EMAIL` - Sender email address

## Project Structure

```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utility functions
│   │   └── pages/          # Page components
├── server/                 # Backend Express application
│   ├── routes.ts           # API route definitions
│   ├── storage.ts          # Database operations
│   └── auth.ts             # Authentication logic
├── shared/                 # Shared code between frontend/backend
│   └── schema.ts           # Database schema and types
└── design_guidelines.md    # UI/UX design specifications
```

## License

All rights reserved.
