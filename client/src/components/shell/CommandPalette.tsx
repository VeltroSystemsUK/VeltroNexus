import { useEffect } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import { Plus, Sparkles } from "lucide-react";
import { visibleDestinations } from "./navModel";
import { isNavLocked } from "@shared/navLocks";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: string;
}

export function CommandPalette({ open, onOpenChange, role }: CommandPaletteProps) {
  const [, navigate] = useLocation();

  // Global ⌘K / Ctrl+K toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const go = (path: string) => {
    if (isNavLocked(role, path)) return;
    onOpenChange(false);
    navigate(path);
  };

  const dests = visibleDestinations(role);
  const groups = Array.from(new Set(dests.map((d) => d.group)));

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search, jump to, or ask Veltro…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem
            value="new prospect add company"
            disabled={isNavLocked(role, "/search")}
            onSelect={() => go("/search")}
          >
            <Plus />
            New prospect
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="ask veltro copilot ai assistant"
            disabled={role === "sales_admin"}
            onSelect={() => onOpenChange(false)}
          >
            <Sparkles className="text-primary" />
            Ask Veltro…
            <CommandShortcut>AI</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {groups.map((group) => (
          <CommandGroup key={group} heading={group}>
            {dests
              .filter((d) => d.group === group)
              .map((d) => {
                const Icon = d.icon;
                return (
                  <CommandItem
                    key={d.path}
                    value={`${d.label} ${d.group} ${d.keywords || ""}`}
                    disabled={isNavLocked(role, d.path)}
                    onSelect={() => go(d.path)}
                  >
                    <Icon />
                    {d.label}
                  </CommandItem>
                );
              })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
