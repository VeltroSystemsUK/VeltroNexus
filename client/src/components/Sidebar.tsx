import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Settings,
  Building2,
  Inbox,
  Users,
  Shield,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Sparkles,
  LayoutDashboard,
  Clock,
  Calculator,
  Mail,
  Brain,
  User,
  CreditCard,
  TrendingUp,
  Receipt,
  Wallet,
  ShieldCheck,
  FileText,
  PoundSterling,
  Send,
  Newspaper,
  GraduationCap,
  ImageIcon,
  Palette,
  MessageSquare,
} from "lucide-react";
import logoChrome from "@assets/logo-chrome.png";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";

interface NavItem {
  path: string;
  label: string;
  icon: any;
  roles?: string[]; // if omitted, visible to all roles
}

interface NavGroup {
  label: string;
  color: string; // tailwind text color for the section label
  items: NavItem[];
}

// Roles shorthand
const FULL = ["broker", "super_admin", "sales_admin"];
const FULL_UW = ["broker", "super_admin", "sales_admin", "underwriter"];
const WITH_TRIAL = ["broker", "super_admin", "sales_admin", "trial_broker"];

const navGroups: NavGroup[] = [
  {
    label: "Workplace",
    color: "text-indigo-400",
    items: [
      { path: "/workforce", label: "Workforce", icon: Sparkles, roles: FULL },
      { path: "/admin", label: "Admin", icon: ShieldCheck, roles: ["super_admin", "sales_admin"] },
      { path: "/teams", label: "Teams", icon: Users, roles: ["super_admin", "sales_admin"] },
      { path: "/compliance", label: "Compliance", icon: Shield, roles: FULL },
    ],
  },
  {
    label: "Sales",
    color: "text-blue-400",
    items: [
      { path: "/pipeline", label: "Dashboard", icon: LayoutDashboard, roles: WITH_TRIAL },
      { path: "/clients", label: "Clients", icon: Users, roles: ["super_admin"] },
      { path: "/brokers", label: "Brokers", icon: Users, roles: ["super_admin"] },
      { path: "/lenders", label: "Lenders", icon: Building2, roles: WITH_TRIAL },
      { path: "/agent-mail", label: "Agent mail", icon: Mail, roles: ["super_admin"] },
      { path: "/gmail", label: "Gmail", icon: Mail, roles: ["super_admin"] },
      { path: "/whatsapp", label: "WhatsApp", icon: MessageSquare, roles: ["super_admin"] },
    ],
  },
  {
    label: "Marketing",
    color: "text-amber-400",
    items: [
      { path: "/email-templates", label: "Templates", icon: FileText, roles: FULL },
      { path: "/email-campaigns", label: "Campaigns", icon: Send, roles: FULL },
      { path: "/editorial", label: "Editorial", icon: Newspaper, roles: FULL },
      { path: "/learn-desk", label: "Learn", icon: GraduationCap, roles: FULL },
      { path: "/media", label: "Media", icon: ImageIcon, roles: FULL },
      { path: "/craft", label: "Craft", icon: Palette, roles: FULL },
    ],
  },
  {
    label: "Accounts",
    color: "text-emerald-400",
    items: [
      { path: "/invoicing", label: "Invoicing", icon: FileText, roles: FULL },
      { path: "/income", label: "Income", icon: PoundSterling, roles: FULL },
      { path: "/forecasts", label: "Forecasts", icon: TrendingUp, roles: FULL },
      { path: "/expenses", label: "Expenses", icon: Receipt, roles: FULL },
      { path: "/cashflow", label: "Cashflow", icon: Wallet, roles: FULL },
    ],
  },
  {
    label: "Underwriting",
    color: "text-violet-400",
    items: [
      { path: "/underwriting", label: "Inbox", icon: Inbox, roles: FULL_UW },
      { path: "/broker-portal", label: "Sterling portal", icon: ShieldCheck, roles: ["super_admin", "sales_admin"] },
      { path: "/credit-tools", label: "Credit Tools", icon: Calculator, roles: FULL_UW },
      { path: "/ai-studio", label: "AI Studio", icon: Brain, roles: FULL_UW },
    ],
  },
  {
    label: "Settings",
    color: "text-rose-400",
    items: [
      { path: "/settings", label: "Settings", icon: Settings, roles: WITH_TRIAL },
      { path: "/profile", label: "Profile", icon: User, roles: WITH_TRIAL },
      { path: "/pricing", label: "Subscription", icon: CreditCard },
    ],
  },
];

// Animated accordion panel using height transition
function AccordionPanel({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(isOpen ? undefined : 0);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    if (isOpen) {
      const scrollHeight = el.scrollHeight;
      setHeight(scrollHeight);
      // After transition completes, set to auto so content can resize naturally
      const timer = setTimeout(() => setHeight(undefined), 200);
      return () => clearTimeout(timer);
    } else {
      // First set explicit height so we can transition from it
      setHeight(el.scrollHeight);
      // Force reflow then collapse
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setHeight(0));
      });
    }
  }, [isOpen]);

  return (
    <div
      ref={contentRef}
      className="overflow-hidden transition-[height] duration-200 ease-in-out"
      style={{ height: height === undefined ? "auto" : height }}
    >
      {children}
    </div>
  );
}

function getVisibleGroups(role: string): NavGroup[] {
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.roles || item.roles.includes(role)),
    }))
    .filter((group) => group.items.length > 0);
}

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { data: roleData } = useQuery<{ role: string }>({
    queryKey: ["/api/auth/role"],
  });

  // Query prospect count
  const { data: prospectData } = useQuery<{ count: number }>({
    queryKey: ["/api/prospects/count"],
    enabled: !!user,
  });

  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  const role = roleData?.role || "broker";

  // Calculate trial days remaining
  const trialDaysRemaining = user?.trialEndsAt
    ? Math.max(
      0,
      Math.ceil((new Date(user.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    )
    : 0;

  const prospectCount = prospectData?.count || 0;

  const visibleGroups = getVisibleGroups(role);

  const isActive = (path: string) => {
    if (path === "/" && location === "/pipeline") return true;
    if (path === "/pipeline" && location === "/") return true;
    return location === path;
  };

  // Accordion state — auto-expand the section containing the active route
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem("sidebar-sections");
    if (saved) return JSON.parse(saved);
    // Default: all sections collapsed
    const defaults: Record<string, boolean> = {};
    navGroups.forEach((g) => { defaults[g.label] = false; });
    return defaults;
  });

  // Auto-expand the section that contains the current route
  useEffect(() => {
    const activeGroup = visibleGroups.find((g) =>
      g.items.some((item) => isActive(item.path))
    );
    if (activeGroup && !expandedSections[activeGroup.label]) {
      setExpandedSections((prev) => ({ ...prev, [activeGroup.label]: true }));
    }
  }, [location]);

  // Persist expanded state
  useEffect(() => {
    localStorage.setItem("sidebar-sections", JSON.stringify(expandedSections));
  }, [expandedSections]);

  const toggleSection = useCallback((label: string) => {
    setExpandedSections((prev) => ({ ...prev, [label]: !prev[label] }));
  }, []);

  return (
    <div
      className={cn(
        "flex flex-col h-screen bg-sidebar/85 backdrop-blur-xl border-r border-white/5 text-white transition-all duration-300 relative",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-6 h-6 w-6 rounded-full border border-border bg-secondary text-muted-foreground hover:text-white p-0 shadow-md hover:bg-accent z-50"
        onClick={toggleSidebar}
      >
        {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </Button>

      {/* Logo Section */}
      <div className={cn("p-4 flex items-center h-24 border-b border-sidebar-border justify-center")}>
        {!isCollapsed ? (
          <div className="flex items-center justify-center w-full h-full">
            {user?.brandingLogoUrl ? (
              <img
                src={user.brandingLogoUrl}
                alt="Veltro"
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <img src={logoChrome} alt="Veltro" className="h-full w-auto object-contain" />
            )}
          </div>
        ) : (
          <img src={logoChrome} alt="Veltro" className="h-8 w-8 object-contain" />
        )}
      </div>

      <Separator className="bg-white/10" />

      {/* Quick Actions */}
      <div className="p-3">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/search">
                <Button
                  className={cn(
                    "w-full bg-primary hover:bg-primary/90 text-primary-foreground transition-all",
                    isCollapsed ? "px-0 justify-center h-10 w-10" : "justify-start gap-2"
                  )}
                >
                  <Plus className="h-5 w-5" />
                  {!isCollapsed && <span>New Prospect</span>}
                </Button>
              </Link>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right">
                <p>New Prospect</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Search Bar */}
      {!isCollapsed && (
        <div className="px-3 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search database..."
              className="pl-9 bg-white/[0.04] border-border text-white placeholder:text-muted-foreground focus:bg-white/[0.06] focus:border-primary"
            />
          </div>
        </div>
      )}

      {/* Grouped Navigation — Accordion */}
      <div className="flex-1 overflow-y-auto py-2 px-3">
        {visibleGroups.map((group, groupIndex) => {
          const isExpanded = expandedSections[group.label] ?? true;

          return (
            <div key={group.label}>
              {groupIndex > 0 && <Separator className="bg-white/[0.06] my-1" />}

              {/* Accordion Header */}
              {!isCollapsed ? (
                <button
                  type="button"
                  onClick={() => toggleSection(group.label)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 pt-2 pb-1.5 group/header hover:bg-white/[0.03] rounded-md transition-colors"
                  )}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
                    {group.label}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 text-white/25 group-hover/header:text-white/50 transition-transform duration-200",
                      !isExpanded && "-rotate-90"
                    )}
                  />
                </button>
              ) : (
                /* Collapsed: thin color indicator line */
                <div className="flex justify-center py-1.5">
                  <div className="w-4 h-px bg-white/20" />
                </div>
              )}

              {/* Accordion Content */}
              <AccordionPanel isOpen={isExpanded && !isCollapsed}>
                <div className="space-y-0.5 pb-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);

                    return (
                      <Link key={item.path} href={item.path}>
                        <div
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm transition-colors cursor-pointer",
                            active
                              ? "border-l-2 border-primary bg-primary/5 text-white font-medium"
                              : "border-l-2 border-transparent text-muted-foreground hover:text-white hover:bg-white/[0.04]"
                          )}
                        >
                          <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                          <span className="text-[13px]">{item.label}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </AccordionPanel>

              {/* Collapsed: show icons only with tooltips */}
              {isCollapsed && (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);

                    return (
                      <TooltipProvider key={item.path} delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link href={item.path}>
                              <Button
                                variant="ghost"
                                className={cn(
                                  "w-full px-0 justify-center h-10 w-10 text-muted-foreground hover:text-white hover:bg-white/[0.04]",
                                  active && "bg-primary/5 text-white font-medium"
                                )}
                              >
                                <Icon className={cn("h-4 w-4", active && "text-primary")} />
                              </Button>
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p>{item.label}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Prospect Quota Status */}
      {!isCollapsed && (
        <div className="px-3 pb-3">
          <div className="bg-white/[0.03] rounded-md p-3 border border-border/40">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-400">Prospect Quota</p>
              <p className="text-xs font-bold text-white">
                {prospectCount} / {user?.prospectLimit || 0}
              </p>
            </div>
            <Progress value={(prospectCount / (user?.prospectLimit || 1)) * 100} className="h-2" />
            <p className="text-xs text-gray-500 mt-2">
              {(user?.prospectLimit || 0) - prospectCount} prospects remaining
            </p>
          </div>
        </div>
      )}

      {/* Trial Status */}
      {!isCollapsed && user?.subscriptionTier === "trial" && (
        <div className="px-3 pb-3">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <p className="text-xs font-semibold text-amber-400">Free Trial</p>
            </div>
            <p className="text-xs text-gray-300">{trialDaysRemaining} days remaining</p>
            <Link href="/pricing">
              <Button
                size="sm"
                className="w-full mt-2 bg-primary hover:bg-primary/90 text-white text-xs h-7"
              >
                Upgrade Now
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Permanent Upgrade Button for Free/Trial users */}
      {!isCollapsed &&
        (user?.subscriptionTier === "free" || user?.subscriptionTier === "trial") && (
          <div className="px-3 pb-3">
            <Link href="/pricing">
              <Button className="w-full bg-primary text-primary-foreground border-0 accent-glow hover:brightness-110 transition-all">
                <Sparkles className="mr-2 h-4 w-4" />
                Upgrade Plan
              </Button>
            </Link>
          </div>
        )}
    </div>
  );
}
