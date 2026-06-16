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
  CreditCard,
  Sparkles,
  ImageIcon,
  Mail,
  MessageSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface Destination {
  path: string;
  label: string;
  icon: LucideIcon;
  group: string;
  roles?: string[];
  keywords?: string;
}

// Role shorthands (mirrors the legacy sidebar)
const FULL = ["broker", "super_admin", "sales_admin"];
const FULL_UW = ["broker", "super_admin", "sales_admin", "underwriter"];
const WITH_TRIAL = ["broker", "super_admin", "sales_admin", "trial_broker"];

export const DESTINATIONS: Destination[] = [
  // Workspace
  { path: "/pipeline", label: "Deck", icon: LayoutDashboard, group: "Workspace", roles: WITH_TRIAL, keywords: "home dashboard overview pipeline" },
  { path: "/workforce", label: "Workforce", icon: Sparkles, group: "Workspace", roles: FULL, keywords: "agents ai" },
  { path: "/compliance", label: "Compliance", icon: Shield, group: "Workspace", roles: FULL },
  { path: "/admin", label: "Admin", icon: ShieldCheck, group: "Workspace", roles: ["super_admin", "sales_admin"] },
  { path: "/teams", label: "Teams", icon: Users, group: "Workspace", roles: ["super_admin", "sales_admin"] },

  // Sales
  { path: "/crm", label: "Clients", icon: Users, group: "Sales", roles: ["super_admin"], keywords: "crm prospects contacts" },
  { path: "/brokers", label: "Brokers", icon: Users, group: "Sales", roles: ["super_admin"], keywords: "introducers" },
  { path: "/lenders", label: "Lenders", icon: Building2, group: "Sales", roles: WITH_TRIAL, keywords: "lender data" },
  { path: "/gmail", label: "Gmail", icon: Mail, group: "Sales", roles: ["super_admin"], keywords: "email inbox" },
  { path: "/whatsapp", label: "WhatsApp", icon: MessageSquare, group: "Sales", roles: ["super_admin"] },

  // Marketing
  { path: "/email-templates", label: "Templates", icon: FileText, group: "Marketing", roles: FULL },
  { path: "/email-campaigns", label: "Campaigns", icon: Send, group: "Marketing", roles: FULL, keywords: "marketing email" },
  { path: "/media", label: "Media", icon: ImageIcon, group: "Marketing", roles: FULL, keywords: "gallery images" },

  // Accounts
  { path: "/invoicing", label: "Invoicing", icon: FileText, group: "Accounts", roles: FULL },
  { path: "/income", label: "Income", icon: PoundSterling, group: "Accounts", roles: FULL },
  { path: "/forecasts", label: "Forecasts", icon: TrendingUp, group: "Accounts", roles: FULL },
  { path: "/expenses", label: "Expenses", icon: Receipt, group: "Accounts", roles: FULL },
  { path: "/cashflow", label: "Cashflow", icon: Wallet, group: "Accounts", roles: FULL },

  // Underwriting
  { path: "/underwriting", label: "Underwriting", icon: Inbox, group: "Underwriting", roles: FULL_UW, keywords: "inbox decisions" },
  { path: "/credit-tools", label: "Credit", icon: Calculator, group: "Underwriting", roles: FULL_UW, keywords: "credit tools analysis" },
  { path: "/ai-studio", label: "AI Studio", icon: Brain, group: "Underwriting", roles: FULL_UW },

  // Settings
  { path: "/settings", label: "Settings", icon: Settings, group: "Settings", roles: WITH_TRIAL },
  { path: "/profile", label: "Profile", icon: User, group: "Settings", roles: WITH_TRIAL },
  { path: "/pricing", label: "Subscription", icon: CreditCard, group: "Settings" },
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

export function railLenses(role: string): Destination[] {
  const visible = visibleDestinations(role);
  return LENS_PATHS
    .map((p) => visible.find((d) => d.path === p))
    .filter((d): d is Destination => Boolean(d));
}
