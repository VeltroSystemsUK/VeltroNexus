import {
  LayoutDashboard,
  Users,
  Building2,
  Calculator,
  Send,
  FileText,
  PoundSterling,
  TrendingUp,
  Receipt,
  Wallet,
  Shield,
  ShieldCheck,
  Inbox,
  Brain,
  Settings,
  User,
  Sparkles,
  ImageIcon,
  Palette,
  Newspaper,
  Mail,
  MessageSquare,
  Target,
  ClipboardList,
  ClipboardCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface Destination {
  path: string;
  label: string;
  icon: LucideIcon;
  group: string;
  roles?: string[];
  keywords?: string;
  description?: string;
}

// Role shorthands (mirrors the legacy sidebar)
const FULL = ["broker", "super_admin", "sales_admin"];
const FULL_UW = ["broker", "super_admin", "sales_admin", "underwriter"];
const WITH_TRIAL = ["broker", "super_admin", "sales_admin", "trial_broker"];

export const DESTINATIONS: Destination[] = [
  // Workspace
  { path: "/pipeline", label: "Deck", icon: LayoutDashboard, group: "Workspace", roles: WITH_TRIAL, keywords: "home dashboard overview pipeline", description: "Commercial lending pipeline dashboard" },
  { path: "/workforce", label: "Workforce", icon: Sparkles, group: "Workspace", roles: FULL, keywords: "agents ai deals", description: "Deal files and desk results" },
  { path: "/compliance", label: "Compliance", icon: Shield, group: "Workspace", roles: FULL, keywords: "regulation fca risk", description: "Regulatory and compliance hub" },
  { path: "/admin", label: "Admin", icon: ShieldCheck, group: "Workspace", roles: ["super_admin", "sales_admin"], keywords: "users platform settings", description: "Manage users, platform settings and SLAs" },
  { path: "/teams", label: "Teams", icon: Users, group: "Workspace", roles: ["super_admin", "sales_admin"], keywords: "users groups", description: "Create and manage teams" },
  { path: "/reporting", label: "Reporting", icon: ClipboardCheck, group: "Workspace", roles: FULL, keywords: "tasks worksheet progress report weekly", description: "Task board and automated weekly reports" },

  // Sales
  { path: "/crm", label: "Clients", icon: Users, group: "Sales", roles: ["super_admin"], keywords: "crm prospects contacts", description: "Prospects and client database" },
  { path: "/brokers", label: "Introducers", icon: Users, group: "Sales", roles: ["super_admin"], keywords: "brokers inbound review", description: "Review inbound introducer leads" },
  { path: "/lenders", label: "Lenders", icon: Building2, group: "Sales", roles: WITH_TRIAL, keywords: "lender data", description: "Lender network and market data" },
  { path: "/agent-mail", label: "Agent mail", icon: Mail, group: "Sales", roles: ["super_admin"], keywords: "email inbox agents monitor", description: "Monitor agent inbound and outbound email" },
  { path: "/gmail", label: "Gmail", icon: Mail, group: "Sales", roles: ["super_admin"], keywords: "email inbox", description: "Email management" },
  { path: "/whatsapp", label: "WhatsApp", icon: MessageSquare, group: "Sales", roles: ["super_admin"], keywords: "messages notifications", description: "Send messages via WhatsApp" },
  { path: "/leads", label: "Leads", icon: Target, group: "Sales", roles: WITH_TRIAL, keywords: "lead generation find prospects", description: "Track and manage generated leads" },

  // Marketing
  { path: "/email-templates", label: "Templates", icon: FileText, group: "Marketing", roles: FULL, keywords: "email html", description: "Reusable email templates" },
  { path: "/email-campaigns", label: "Campaigns", icon: Send, group: "Marketing", roles: FULL, keywords: "marketing email", description: "Send and track email campaigns" },
  { path: "/editorial", label: "Editorial", icon: Newspaper, group: "Marketing", roles: FULL, keywords: "blog press release article news casey isla", description: "Blogs and press releases — draft desk, never auto-publish" },
  { path: "/media", label: "Media", icon: ImageIcon, group: "Marketing", roles: FULL, keywords: "gallery images", description: "Media gallery for campaigns" },
  { path: "/craft", label: "Craft", icon: Palette, group: "Marketing", roles: FULL, keywords: "social posts graphics linkedin instagram facebook tiktok mkt craft", description: "MKT-2 social queue and compositor" },

  // Accounts
  { path: "/invoicing", label: "Invoicing", icon: FileText, group: "Accounts", roles: FULL, keywords: "bills", description: "Create and manage invoices" },
  { path: "/income", label: "Income", icon: PoundSterling, group: "Accounts", roles: FULL, keywords: "revenue payments", description: "Track revenue from invoices" },
  { path: "/forecasts", label: "Forecasts", icon: TrendingUp, group: "Accounts", roles: FULL, keywords: "commission pipeline", description: "Commission forecasting" },
  { path: "/expenses", label: "Expenses", icon: Receipt, group: "Accounts", roles: FULL, keywords: "costs", description: "Track business expenses" },
  { path: "/cashflow", label: "Cashflow", icon: Wallet, group: "Accounts", roles: FULL, keywords: "bank balance analytics", description: "Bank balance and cash flow analytics" },

  // Underwriting
  { path: "/underwriting", label: "Inbox", icon: Inbox, group: "Underwriting", roles: FULL_UW, keywords: "inbox decisions", description: "Review and process loan applications" },
  { path: "/broker-portal", label: "Sterling portal", icon: ShieldCheck, group: "Underwriting", roles: ["super_admin", "sales_admin"], keywords: "sterling david oversight files", description: "Oversight of the Sterling Commercial Finance portal" },
  { path: "/credit-tools", label: "Credit Tools", icon: Calculator, group: "Underwriting", roles: FULL_UW, keywords: "credit tools analysis", description: "Utility calculators for credit analysis" },
  { path: "/ai-studio", label: "AI Studio", icon: Brain, group: "Underwriting", roles: FULL_UW, keywords: "ai underwriting", description: "AI-powered underwriting workspace" },
  { path: "/submissions", label: "Submissions", icon: ClipboardList, group: "Underwriting", roles: FULL_UW, keywords: "deal submissions", description: "Create and manage deal submissions" },
  { path: "/leads", label: "Leads", icon: Target, group: "Underwriting", roles: FULL_UW, keywords: "lead generation", description: "Track and manage generated leads" },

  // Settings
  { path: "/settings", label: "Settings", icon: Settings, group: "Settings", roles: WITH_TRIAL, keywords: "preferences", description: "Customise your Veltro experience" },
  { path: "/profile", label: "Profile", icon: User, group: "Settings", roles: WITH_TRIAL, keywords: "account", description: "Your account and profile details" },
];

// Curated primary "lenses" for the slim rail (order matters)
const LENS_PATHS = [
  "/pipeline",
  "/crm",
  "/lenders",
  "/credit-tools",
  "/email-campaigns",
  "/invoicing",
  "/compliance",
  "/workforce",
];

export function visibleDestinations(role: string): Destination[] {
  return DESTINATIONS.filter((d) => !d.roles || d.roles.includes(role));
}

export function groupedDestinations(role: string): Record<string, Destination[]> {
  const visible = visibleDestinations(role);
  const order = ["Workspace", "Sales", "Marketing", "Accounts", "Underwriting", "Settings"];
  const grouped: Record<string, Destination[]> = {};
  for (const group of order) grouped[group] = [];
  for (const d of visible) {
    if (!grouped[d.group]) grouped[d.group] = [];
    grouped[d.group].push(d);
  }
  return grouped;
}

export function railLenses(role: string): Destination[] {
  const visible = visibleDestinations(role);
  return LENS_PATHS
    .map((p) => visible.find((d) => d.path === p))
    .filter((d): d is Destination => Boolean(d));
}
