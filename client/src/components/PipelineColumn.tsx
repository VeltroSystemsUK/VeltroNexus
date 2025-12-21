import { Badge } from "@/components/ui/badge";
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
      <div className="bg-muted rounded-t-lg p-4 border-b">
        <div className="flex items-center justify-between mb-1.5 gap-2">
          <h3
            className="font-semibold text-base"
            data-testid={`text-column-title-${title.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {title}
          </h3>
          <Badge
            variant="secondary"
            className="text-sm font-medium px-2.5 py-0.5"
            data-testid={`badge-count-${title.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {count}
          </Badge>
        </div>
        {totalValue && (
          <p
            className="text-sm text-muted-foreground font-medium"
            data-testid={`text-total-value-${title.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {totalValue}
          </p>
        )}
      </div>
      <div
        className={`flex-1 rounded-b-lg p-3 space-y-3 min-h-[240px] transition-colors ${
          isDraggingOver ? "bg-muted/50 border-2 border-dashed border-primary" : "bg-muted/30"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
