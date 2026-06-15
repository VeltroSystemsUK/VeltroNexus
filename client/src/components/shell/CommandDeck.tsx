import { useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { LensRail } from "./LensRail";
import { CommandBar } from "./CommandBar";
import { CommandPalette } from "./CommandPalette";
import { CopilotRail } from "./CopilotRail";

/**
 * The Command Deck — the signed-in shell.
 * Slim lens rail + ⌘K command bar over a living graphite atmosphere.
 * Replaces the legacy accordion Sidebar + UnifiedHeader.
 */
export function CommandDeck({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [copilotCollapsed, setCopilotCollapsed] = useState(
    () => localStorage.getItem("copilot-collapsed") === "1"
  );
  const { data: roleData } = useQuery<{ role: string }>({
    queryKey: ["/api/auth/role"],
  });
  const role = roleData?.role || "broker";

  const openPalette = () => setPaletteOpen(true);

  useEffect(() => {
    localStorage.setItem("copilot-collapsed", copilotCollapsed ? "1" : "0");
  }, [copilotCollapsed]);

  return (
    <div className="flex app-atmosphere h-screen overflow-hidden">
      {/* Ambient aurora behind everything */}
      <div className="aurora-field">
        <div className="aurora-blob b1" />
        <div className="aurora-blob b2" />
        <div className="aurora-blob b3" />
      </div>

      <LensRail role={role} onCommand={openPalette} />

      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        <CommandBar onCommand={openPalette} />
        {children}
      </div>

      <CopilotRail
        collapsed={copilotCollapsed}
        onToggle={() => setCopilotCollapsed((v) => !v)}
      />

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} role={role} />
    </div>
  );
}
