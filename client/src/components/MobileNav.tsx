import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Home, Search, User, Settings, Send, Building2, FileSpreadsheet, Inbox, Users, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  path: string;
  label: string;
  icon: typeof Home;
}

const brokerNavItems: NavItem[] = [
  { path: "/", label: "Pipeline", icon: Home },
  { path: "/search", label: "Search", icon: Search },
  { path: "/leads", label: "Leads", icon: FileSpreadsheet },
  { path: "/submissions", label: "Submissions", icon: Send },
  { path: "/profile", label: "Profile", icon: User },
];

const underwriterNavItems: NavItem[] = [
  { path: "/underwriting", label: "Inbox", icon: Inbox },
  { path: "/pipeline", label: "Pipeline", icon: Home },
  { path: "/search", label: "Search", icon: Search },
  { path: "/profile", label: "Profile", icon: User },
];

const salesAdminNavItems: NavItem[] = [
  { path: "/", label: "Pipeline", icon: Home },
  { path: "/search", label: "Search", icon: Search },
  { path: "/teams", label: "Teams", icon: Users },
  { path: "/leads", label: "Leads", icon: FileSpreadsheet },
  { path: "/profile", label: "Profile", icon: User },
];

const superAdminNavItems: NavItem[] = [
  { path: "/", label: "Pipeline", icon: Home },
  { path: "/admin", label: "Admin", icon: Shield },
  { path: "/teams", label: "Teams", icon: Users },
  { path: "/settings", label: "Settings", icon: Settings },
  { path: "/profile", label: "Profile", icon: User },
];

export default function MobileNav() {
  const [location, navigate] = useLocation();
  const { data: roleData } = useQuery<{ role: string }>({
    queryKey: ["/api/auth/role"],
  });

  const role = roleData?.role || "broker";
  
  const getNavItems = () => {
    switch (role) {
      case "super_admin":
        return superAdminNavItems;
      case "sales_admin":
        return salesAdminNavItems;
      case "underwriter":
        return underwriterNavItems;
      default:
        return brokerNavItems;
    }
  };
  
  const navItems = getNavItems();

  const isActive = (path: string) => {
    if (path === "/" && location === "/pipeline") return true;
    if (path === "/" && location === "/") return true;
    if (path === "/underwriting" && location === "/" && role === "underwriter") return true;
    return location === path;
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t shadow-lg safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full min-w-0 py-2 px-1 transition-colors",
                active 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid={`mobile-nav-${item.label.toLowerCase()}`}
            >
              <Icon className={cn("h-5 w-5 mb-1", active && "stroke-[2.5px]")} />
              <span className={cn(
                "text-[10px] font-medium truncate max-w-full",
                active && "font-semibold"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
