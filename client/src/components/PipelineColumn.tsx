import { ReactNode } from "react";

interface PipelineColumnProps {
  title: string;
  count: number;
  totalValue?: string;
  isDraggingOver?: boolean;
  children: ReactNode;
}

export default function PipelineColumn({
  title,
  count,
  totalValue,
  isDraggingOver = false,
  children,
}: PipelineColumnProps) {
  return (
    <div
      className="flex flex-col"
      data-testid={`column-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="glass-subtle rounded-t-xl px-4 py-3 border-b border-white/5">
        <div className="flex items-center justify-between gap-2">
          <h3
            className="font-semibold text-sm tracking-tight"
            data-testid={`text-column-title-${title.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {title}
          </h3>
          <span
            className="text-xs font-medium tabular-nums px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20"
            data-testid={`badge-count-${title.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {count}
          </span>
        </div>
        {totalValue && (
          <p
            className="text-xs text-muted-foreground font-medium mt-1 tabular-nums"
            data-testid={`text-total-value-${title.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {totalValue}
          </p>
        )}
      </div>
      <div
        className={`flex-1 rounded-b-xl p-3 space-y-3 min-h-[240px] transition-colors ${
          isDraggingOver
            ? "bg-primary/[0.04] border border-dashed border-primary/50"
            : "bg-white/[0.015] border border-white/[0.04]"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
