import { useState, useEffect, useRef, type TouchEvent as ReactTouchEvent } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Command as CommandIcon,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  ChevronDown,
} from "lucide-react";
import { railLenses, groupedDestinations, type Destination } from "./navModel";
import { isNavLocked } from "@shared/navLocks";

interface LensRailProps {
  role: string;
  onCommand: () => void;
}

const GROUP_COLORS: Record<string, string> = {
  Workspace: "text-indigo-400",
  Sales: "text-blue-400",
  Marketing: "text-amber-400",
  Accounts: "text-emerald-400",
  Underwriting: "text-violet-400",
  Settings: "text-rose-400",
};

function ExpandedNav({ role }: { role: string }) {
  const [location] = useLocation();
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const grouped = groupedDestinations(role);
  const groupNames = Object.keys(grouped);

  // Default: all groups open. Reset query filter independently.
  useEffect(() => {
    setOpenGroups((prev) => {
      const next: Record<string, boolean> = { ...prev };
      groupNames.forEach((g) => {
        if (!(g in next)) next[g] = true;
      });
      return next;
    });
  }, [role]);

  const q = query.trim().toLowerCase();
  const filtered: Record<string, Destination[]> = q
    ? groupNames.reduce<Record<string, Destination[]>>((acc, g) => {
        const matches = grouped[g].filter(
          (d) =>
            d.label.toLowerCase().includes(q) ||
            (d.description || "").toLowerCase().includes(q) ||
            (d.keywords || "").toLowerCase().includes(q) ||
            d.path.toLowerCase().includes(q)
        );
        if (matches.length > 0) acc[g] = matches;
        return acc;
      }, {})
    : grouped;

  const toggleGroup = (g: string) =>
    setOpenGroups((prev) => ({ ...prev, [g]: !prev[g] }));

  const isActive = (path: string) =>
    location === path || (path === "/pipeline" && location === "/");

  const totalCount = Object.values(grouped).reduce((acc, items) => acc + items.length, 0);
  const shownCount = Object.values(filtered).reduce(
    (acc, items) => acc + items.length,
    0
  );

  return (
    <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0">
      {/* Search */}
      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter features…"
          className="w-full h-9 pl-8 pr-2 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 focus:bg-white/[0.06] transition-colors"
        />
      </div>

      {/* Feature count */}
      <p className="text-[10px] uppercase tracking-[0.14em] text-white/25 px-1 mb-2">
        {q ? `${shownCount} of ${totalCount} features` : `${totalCount} features`}
      </p>

      {Object.keys(filtered).length === 0 && (
        <p className="text-xs text-white/40 px-1 py-4 text-center">No features match.</p>
      )}

      {Object.entries(filtered).map(([group, items]) => {
        const isOpen = openGroups[group] ?? true;
        return (
          <div key={group} className="mb-1">
            <button
              type="button"
              onClick={() => toggleGroup(group)}
              className="w-full flex items-center justify-between px-1 py-1.5 rounded-md hover:bg-white/[0.03] transition-colors group/header"
            >
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-[0.14em]",
                  GROUP_COLORS[group] || "text-white/40"
                )}
              >
                {group}
              </span>
              <ChevronDown
                className={cn(
                  "h-3 w-3 text-white/25 group-hover/header:text-white/50 transition-transform duration-200",
                  !isOpen && "-rotate-90"
                )}
              />
            </button>
            {isOpen && (
              <div className="space-y-0.5 pb-1">
                {items.map((d) => {
                  const Icon = d.icon;
                  const active = isActive(d.path);
                  const locked = isNavLocked(role, d.path);
                  const row = (
                      <div
                        className={cn(
                          "flex items-start gap-2.5 px-2 py-1.5 rounded-md transition-colors",
                          locked
                            ? "text-white/25 cursor-not-allowed"
                            : active
                              ? "bg-primary/10 text-white cursor-pointer"
                              : "text-muted-foreground hover:text-white hover:bg-white/[0.04] cursor-pointer"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0 mt-0.5",
                            active && !locked && "text-primary"
                          )}
                        />
                        <span className="min-w-0">
                          <span className="block text-[13px] leading-tight">
                            {d.label}
                          </span>
                          {d.description && (
                            <span className="block text-[11px] text-white/35 leading-snug mt-0.5 truncate">
                              {locked ? "Preview only" : d.description}
                            </span>
                          )}
                        </span>
                      </div>
                  );
                  if (locked) {
                    return (
                      <div key={d.path} title="Not available on this preview">
                        {row}
                      </div>
                    );
                  }
                  return (
                    <Link key={d.path} href={d.path}>
                      {row}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function LensRail({ role, onCommand }: LensRailProps) {
  const [location] = useLocation();
  const lenses = railLenses(role);
  const [expanded, setExpanded] = useState(
    () => localStorage.getItem("lensrail-expanded") === "1"
  );
  const touchStartRef = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem("lensrail-expanded", expanded ? "1" : "0");
  }, [expanded]);

  const isActive = (path: string) =>
    location === path || (path === "/pipeline" && location === "/");

  const onTouchStart = (e: ReactTouchEvent) => {
    touchStartRef.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: ReactTouchEvent) => {
    if (touchStartRef.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current;
    if (dx > 60 && !expanded) setExpanded(true);
    if (dx < -60 && expanded) setExpanded(false);
    touchStartRef.current = null;
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={cn(
          "relative z-10 hidden md:flex shrink-0 flex-col py-4 bg-sidebar/80 backdrop-blur-xl border-r border-white/5 transition-[width] duration-300 ease-out",
          expanded ? "w-64" : "w-[68px]"
        )}
      >
        {/* Logo + toggle */}
        <div className="flex items-center gap-2 px-2 mb-4">
          <Link
            href="/pipeline"
            className={cn(
              "shrink-0 rounded-xl flex items-center justify-center transition-colors cursor-pointer",
              expanded ? "h-10 w-10" : "h-8 w-8 ml-[18px]"
            )}
          >
            <img src="/favicon.png" alt="Veltro" className="h-full w-full object-contain" />
          </Link>

          {expanded && (
            <button
              onClick={() => setExpanded(false)}
              aria-label="Collapse sidebar"
              className="ml-auto h-7 w-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Collapsed: expand trigger */}
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            aria-label="Expand sidebar"
            className="mx-auto mb-3 h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        {/* Command trigger */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onCommand}
              aria-label="Open command palette"
              className={cn(
                "rounded-xl flex items-center gap-2.5 text-white/55 hover:text-white glass-subtle mb-3 transition-colors",
                expanded ? "h-10 w-full px-3 text-xs justify-start" : "h-11 w-11 mx-auto justify-center"
              )}
            >
              <CommandIcon className="h-5 w-5 shrink-0" />
              {expanded && (
                <span className="flex-1 text-left truncate text-[13px]">Commands</span>
              )}
              {expanded && (
                <kbd className="text-[10px] font-mono tracking-wider border border-white/10 rounded px-1.5 py-0.5 leading-none">
                  ⌘K
                </kbd>
              )}
            </button>
          </TooltipTrigger>
          {!expanded && (
            <TooltipContent side="right">
              Command <span className="ml-1 opacity-60">⌘K</span>
            </TooltipContent>
          )}
        </Tooltip>

        {expanded && (
          <div className="px-2 mb-3">
            {isNavLocked(role, "/search") ? (
              <button
                type="button"
                disabled
                className="w-full h-9 rounded-lg bg-white/5 text-white/30 flex items-center justify-center gap-1.5 text-xs font-medium cursor-not-allowed"
              >
                <Plus className="h-4 w-4" />
                New Prospect
              </button>
            ) : (
              <Link href="/search">
                <button className="w-full h-9 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-1.5 text-xs font-medium transition-colors">
                  <Plus className="h-4 w-4" />
                  New Prospect
                </button>
              </Link>
            )}
          </div>
        )}

        {expanded ? (
          <ExpandedNav role={role} />
        ) : (
          /* Slim icon rail */
          <nav className="flex flex-col items-center gap-1.5">
            {lenses.map((lens) => {
              const Icon = lens.icon;
              const active = isActive(lens.path);
              const locked = isNavLocked(role, lens.path);
              const icon = (
                      <div
                        className={cn(
                          "relative h-11 w-11 rounded-xl flex items-center justify-center transition-all",
                          locked
                            ? "text-white/20 cursor-not-allowed border border-transparent"
                            : active
                              ? "text-primary bg-primary/10 border border-primary/25 cursor-pointer"
                              : "text-white/50 hover:text-white hover:bg-white/[0.05] border border-transparent cursor-pointer"
                        )}
                      >
                        {active && !locked && (
                          <span className="absolute -left-[10px] top-1/2 -translate-y-1/2 h-5 w-1 rounded-full bg-primary shadow-[0_0_10px_2px_hsl(var(--primary)/0.5)]" />
                        )}
                        <Icon className="h-5 w-5" />
                      </div>
              );
              return (
                <Tooltip key={lens.path}>
                  <TooltipTrigger asChild>
                    {locked ? (
                      <div>{icon}</div>
                    ) : (
                      <Link href={lens.path}>{icon}</Link>
                    )}
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {locked ? `${lens.label} (preview only)` : lens.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>
        )}
      </aside>
    </TooltipProvider>
  );
}
