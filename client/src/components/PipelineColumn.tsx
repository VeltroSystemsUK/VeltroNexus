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
    <div className="flex flex-col" data-testid={`column-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="bg-muted rounded-t-md p-3 border-b">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-sm" data-testid={`text-column-title-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            {title}
          </h3>
          <Badge variant="secondary" className="text-xs" data-testid={`badge-count-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            {count}
          </Badge>
        </div>
        {totalValue && (
          <p className="text-xs text-muted-foreground" data-testid={`text-total-value-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            {totalValue}
          </p>
        )}
      </div>
      <div
        className={`flex-1 rounded-b-md p-2 space-y-2 min-h-[200px] transition-colors ${
          isDraggingOver
            ? "bg-muted/50 border-2 border-dashed border-primary"
            : "bg-muted/30"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
