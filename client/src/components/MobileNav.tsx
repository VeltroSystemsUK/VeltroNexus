import { useLocation } from "wouter";
import { Home, Search, User, Settings, Send, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  path: string;
  label: string;
  icon: typeof Home;
}

const navItems: NavItem[] = [
  { path: "/", label: "Pipeline", icon: Home },
  { path: "/search", label: "Search", icon: Search },
  { path: "/lenders", label: "Lenders", icon: Building2 },
  { path: "/submissions", label: "Submissions", icon: Send },
  { path: "/profile", label: "Profile", icon: User },
];

export default function MobileNav() {
  const [location, navigate] = useLocation();

  const isActive = (path: string) => {
    if (path === "/" && location === "/pipeline") return true;
    if (path === "/" && location === "/") return true;
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
