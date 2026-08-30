import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Home,
  Search,
  User,
  Settings,
  Inbox,
  Users,
  Shield,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isNavLocked } from "@shared/navLocks";

interface NavItem {
  path: string;
  label: string;
  icon: typeof Home;
  roles?: string[];
}

// Simplified mobile nav — key items from each section
const mobileNavItems: NavItem[] = [
  { path: "/pipeline", label: "Dashboard", icon: LayoutDashboard },
  { path: "/underwriting", label: "Inbox", icon: Inbox },
  { path: "/teams", label: "Teams", icon: Users, roles: ["super_admin", "sales_admin"] },
  { path: "/admin", label: "Admin", icon: Shield, roles: ["super_admin", "sales_admin"] },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function MobileNav() {
  const [location, navigate] = useLocation();
  const { data: roleData } = useQuery<{ role: string }>({
    queryKey: ["/api/auth/role"],
  });

  const role = roleData?.role || "broker";

  const navItems = mobileNavItems.filter(
    (item) => !item.roles || item.roles.includes(role)
  );

  const isActive = (path: string) => {
    if (path === "/" && location === "/pipeline") return true;
    if (path === "/pipeline" && location === "/") return true;
    return location === path;
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t shadow-lg safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          const locked = isNavLocked(role, item.path);
          return (
            <button
              key={item.path}
              onClick={() => {
                if (!locked) navigate(item.path);
              }}
              disabled={locked}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full min-w-0 py-2 px-1 transition-colors",
                locked
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
              )}
              data-testid={`mobile-nav-${item.label.toLowerCase()}`}
            >
              <div className="relative">
                <Icon className={cn("h-5 w-5 mb-1", active && "stroke-[2.5px]")} />
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium truncate max-w-full",
                  active && "font-semibold"
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
