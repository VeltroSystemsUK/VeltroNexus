import { cn } from "@/lib/utils";

export function HotClickDot({ className }: { className?: string }) {
  return (
    <span
      data-testid="dot-hot-clicks"
      title="Clicked more than twice"
      aria-label="Clicked more than twice"
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_3px_rgba(52,211,153,0.75)] animate-hot-click-glow shrink-0",
        className
      )}
    />
  );
}
