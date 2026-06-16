import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Command as CommandIcon } from "lucide-react";
import logoChrome from "@assets/logo-chrome.png";
import { railLenses } from "./navModel";

interface LensRailProps {
  role: string;
  onCommand: () => void;
}

export function LensRail({ role, onCommand }: LensRailProps) {
  const [location] = useLocation();
  const lenses = railLenses(role);

  const isActive = (path: string) =>
    location === path || (path === "/pipeline" && location === "/");

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="relative z-10 hidden md:flex w-[68px] shrink-0 flex-col items-center py-4 bg-sidebar/80 backdrop-blur-xl border-r border-white/5">
        <Link href="/pipeline">
          <img src={logoChrome} alt="Veltro" className="h-8 w-8 object-contain mb-4 cursor-pointer" />
        </Link>

        {/* Command trigger */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onCommand}
              aria-label="Open command palette"
              className="h-11 w-11 rounded-xl flex items-center justify-center text-white/55 hover:text-white glass-subtle mb-3 transition-colors"
            >
              <CommandIcon className="h-5 w-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            Command <span className="ml-1 opacity-60">⌘K</span>
          </TooltipContent>
        </Tooltip>

        <nav className="flex flex-col items-center gap-1.5">
          {lenses.map((lens) => {
            const Icon = lens.icon;
            const active = isActive(lens.path);
            return (
              <Tooltip key={lens.path}>
                <TooltipTrigger asChild>
                  <Link href={lens.path}>
                    <div
                      className={cn(
                        "relative h-11 w-11 rounded-xl flex items-center justify-center transition-all cursor-pointer",
                        active
                          ? "text-primary bg-primary/10 border border-primary/25"
                          : "text-white/50 hover:text-white hover:bg-white/[0.05] border border-transparent"
                      )}
                    >
                      {active && (
                        <span className="absolute -left-[10px] top-1/2 -translate-y-1/2 h-5 w-1 rounded-full bg-primary shadow-[0_0_10px_2px_hsl(var(--primary)/0.5)]" />
                      )}
                      <Icon className="h-5 w-5" />
                    </div>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{lens.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
      </aside>
    </TooltipProvider>
  );
}
