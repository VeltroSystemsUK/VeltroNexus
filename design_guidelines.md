# Design Guidelines: FlowLoan Modern UI Theme

## Design Approach

**Selected Framework**: Modern SaaS Dashboard Pattern (Shadcn/UI-based)
- Deep blue/purple modern aesthetic inspired by modern fintech applications
- Uses Inter font for clean, professional typography
- Glass morphism and gradient surfaces for visual depth
- Function-first design optimized for daily workflow efficiency
- Clean, scannable information architecture with purposeful visual hierarchy

## Color System

### Light Mode
- Background: Soft blue-gray (#f7f8ff equivalent)
- Cards: Pure white with subtle borders
- Primary: Blue-purple (#6d7dff - HSL 234, 100%, 71%)
- Secondary: Purple (#a56dff - HSL 263, 100%, 71%)
- Destructive: Coral red (#ff4d6d - HSL 349, 100%, 65%)
- Success: Green (#22c55e - HSL 142, 71%, 45%)
- Warning: Amber (#fbbf24 - HSL 45, 93%, 47%)

### Dark Mode (Primary Theme)
- Background: Deep navy (#0b1020 - HSL 228, 49%, 8%)
- Card/Panel: Dark blue (#0f1730 - HSL 227, 52%, 12%)
- Panel Secondary: (#111b3a - HSL 225, 55%, 15%)
- Text: Light blue-white (#e8ecff - HSL 230, 100%, 96%)
- Borders: Subtle blue-gray (HSL 227, 40%, 18%)

## Core Design Elements

### A. Typography System

**Font Families**:
- Primary: Inter (imported from Google Fonts) for optimal screen readability
- Monospace: ui-monospace, SFMono-Regular, Menlo for company numbers and numerical data

**Hierarchy**:
- Page Titles: text-3xl, font-bold (Pipeline, Prospects, etc.)
- Section Headers: text-xl, font-semibold
- Card Titles: text-sm to text-base, font-medium
- Body/Labels: text-sm, regular weight
- Metadata/Secondary: text-xs, text-muted-foreground
- Large Numbers (Stats): text-2xl to text-3xl, font-bold

### B. Layout System

**Spacing Primitives**: Use Tailwind units of 2, 3, 4, 6, 8, 12
- Component padding: p-3, p-4, p-6
- Section spacing: space-y-4, space-y-6, space-y-8
- Container margins: mb-4, mb-6, mb-8
- Card internal spacing: p-3 for dense cards, p-4 for standard, p-6 for spacious

**Grid Systems**:
- Summary Stats: grid-cols-1 md:grid-cols-2 lg:grid-cols-4
- Kanban Columns: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6
- Content max-width: container mx-auto with generous px-4 to px-8

### C. Component Library

**Dashboard Header**:
- Page title with descriptive subtitle
- Action buttons aligned right (Add Prospect, Export, Filter)
- Breadcrumb navigation for deep pages

**Summary Cards**:
- Compact header with muted label text
- Prominent numerical display
- Optional trend indicators or comparison metrics
- Subtle border, minimal shadow

**Kanban Pipeline Board**:
- Column headers with stage name, count badge, and total value
- Minimum column height to maintain visual consistency
- Dragging state: subtle rotation (rotate-2), elevated shadow
- Drop zones: dashed border on hover, subtle background tint
- Drag handle: GripVertical icon, muted appearance

**Prospect Cards**:
- Company name (truncated with ellipsis)
- Company number in smaller, muted text
- Loan amount with currency icon
- Priority badge when applicable
- Actions menu (three-dot) in top-right
- Hover state: subtle shadow elevation
- Click target: entire card with pointer cursor

**Stage Badges**:
- Rounded badges with stage-specific semantic colors
- Lead: Slate/Gray (neutral)
- Contacted: Blue (engagement)
- Qualified: Cyan (progress)
- Proposal: Purple (negotiation)
- Due Diligence: Amber (caution/review)
- Approval: Orange (pending decision)
- Approved: Green (success)
- Declined: Red (negative outcome)
- Withdrawn: Gray (neutral closure)

**Data Tables** (for list views):
- Zebra striping for row readability
- Sortable column headers with icons
- Action column with compact buttons
- Sticky header on scroll
- Row hover state for interaction clarity

**Empty States**:
- Centered icon (Building2 or relevant)
- Clear message text
- Primary action button
- Optional secondary guidance

**Navigation**:
- Left sidebar or top navigation bar
- Active state highlighting
- Icon + label for primary nav items
- Consistent spacing between items

**Forms** (for adding/editing prospects):
- Clear field labels above inputs
- Helper text below fields when needed
- Validation states (error borders, success indicators)
- Grouped related fields with visual separation
- Submit actions in footer with clear hierarchy

**Detail Pages**:
- Split layout: main content area + sidebar for metadata
- Section cards with clear headers
- Timeline/activity feed for prospect history
- Related information modules (company data, documents, notes)

### D. Interactions

**Drag and Drop**:
- Smooth transitions during drag
- Visual feedback on valid drop zones
- Snap-back animation on invalid drops
- No animations on the drag handle itself for performance

**Hover States**:
- Cards: subtle shadow elevation
- Buttons: background opacity change
- Table rows: background tint
- Duration: 150-200ms for responsiveness

**Loading States**:
- Centered spinner with descriptive text
- Skeleton screens for data-heavy sections
- Progressive loading for large datasets

## Images

**No Hero Images Required**: This is a B2B dashboard application optimized for data display and workflow efficiency. Visual focus should be on clear data presentation, not marketing imagery.

**Functional Icons Only**:
- Use Lucide React icons throughout (Building2, PoundSterling, MoreVertical, GripVertical, ArrowRight)
- Icons should support comprehension, not decoration
- Consistent 16px (h-4 w-4) for inline icons, 20-24px (h-5 to h-6) for standalone

## Distinctive Features

**Pipeline Value Visualization**: Display cumulative value per stage prominently beneath stage headers to provide immediate business insight.

**Priority Indicators**: Color-coded priority badges (high/medium/low) to enable quick scanning and prioritization.

**Responsive Kanban**: Transform 6-column desktop view into accordion-style stacked sections on mobile, maintaining full functionality.

**Quick Actions**: Dropdown menu on each card for rapid stage changes without drag-and-drop on touch devices.

**Visual Stage Progression**: Consider subtle connecting arrows or progress indicators between active pipeline stages to reinforce flow.