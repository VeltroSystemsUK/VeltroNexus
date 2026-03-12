import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";

/** Resolve "system" to actual light/dark based on OS preference */
function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

/** Apply the resolved theme to the DOM */
export function applyTheme(mode: ThemeMode) {
  const resolved = resolveTheme(mode);
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem("theme") as ThemeMode) || "dark";
  });

  // Apply theme on mount and when mode changes
  useEffect(() => {
    applyTheme(mode);
    localStorage.setItem("theme", mode);
  }, [mode]);

  // Listen for OS theme changes when in "system" mode
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  const cycle = () => {
    setMode((prev) => {
      if (prev === "light") return "dark";
      if (prev === "dark") return "system";
      return "light";
    });
  };

  const icon =
    mode === "light" ? <Sun className="h-5 w-5" /> :
    mode === "dark" ? <Moon className="h-5 w-5" /> :
    <Monitor className="h-5 w-5" />;

  const label =
    mode === "light" ? "Light mode" :
    mode === "dark" ? "Dark mode" :
    "System theme";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycle}
      data-testid="button-theme-toggle"
      aria-label={label}
      title={label}
    >
      {icon}
    </Button>
  );
}
