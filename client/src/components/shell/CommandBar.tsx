import { useLayout } from "@/context/LayoutContext";
import ThemeToggle from "@/components/ThemeToggle";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { Command as CommandIcon, Search } from "lucide-react";

interface CommandBarProps {
  onCommand: () => void;
}

export function CommandBar({ onCommand }: CommandBarProps) {
  const { pageTitle, pageDescription, headerActions } = useLayout();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-background/55 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-4 md:px-6 h-16">
        {/* Page context */}
        <div className="min-w-0 max-w-[40%]">
          <h1 className="text-lg md:text-xl font-semibold tracking-tight truncate leading-tight">
            {pageTitle || "Deck"}
          </h1>
          {pageDescription && (
            <p className="text-xs md:text-sm text-muted-foreground truncate -mt-0.5">
              {pageDescription}
            </p>
          )}
        </div>

        {/* Command trigger (primary surface) */}
        <button
          onClick={onCommand}
          className="ml-auto hidden md:flex items-center gap-2.5 h-9 px-3 rounded-xl glass-subtle text-sm text-muted-foreground hover:text-foreground transition-colors w-[300px]"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left truncate">Search, act, or ask Veltro…</span>
          <kbd className="text-[10px] font-mono tracking-wider border border-white/10 rounded px-1.5 py-0.5 leading-none">
            ⌘K
          </kbd>
        </button>

        {/* Mobile command trigger */}
        <button
          onClick={onCommand}
          aria-label="Open command palette"
          className="md:hidden ml-auto h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <CommandIcon className="h-5 w-5" />
        </button>

        {headerActions && (
          <div className="hidden md:flex items-center gap-2">{headerActions}</div>
        )}

        <div className="flex items-center gap-2 pl-3 border-l border-white/5">
          <ThemeToggle />
          <ProfileDropdown />
        </div>
      </div>
    </header>
  );
}
