import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GripVertical, MoreVertical, PoundSterling } from "lucide-react";

export type Priority = "high" | "medium" | "low";

export interface ProspectCardData {
  id: number;
  companyName: string;
  companyNumber: string;
  loanAmount?: number;
  priority?: Priority;
  stage?: string;
}

interface ProspectCardProps {
  prospect: ProspectCardData;
  onMove?: (stage: string) => void;
  onClick?: () => void;
  dragHandleProps?: any;
  isDragging?: boolean;
  availableStages?: { value: string; label: string }[];
  currentStage?: string;
}

const priorityColors = {
  high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

const stageColors: Record<string, string> = {
  "lead": "border-l-4 border-l-slate-400 dark:border-l-slate-500",
  "contacted": "border-l-4 border-l-blue-400 dark:border-l-blue-500",
  "qualified": "border-l-4 border-l-cyan-400 dark:border-l-cyan-500",
  "proposal": "border-l-4 border-l-purple-400 dark:border-l-purple-500",
  "due-diligence": "border-l-4 border-l-amber-400 dark:border-l-amber-500",
  "approval": "border-l-4 border-l-orange-400 dark:border-l-orange-500",
  "approved": "border-l-4 border-l-green-500 dark:border-l-green-600",
  "declined": "border-l-4 border-l-red-500 dark:border-l-red-600",
  "withdrawn": "border-l-4 border-l-gray-400 dark:border-l-gray-500",
};

export default function ProspectCard({
  prospect,
  onMove,
  onClick,
  dragHandleProps,
  isDragging = false,
  availableStages = [],
  currentStage,
}: ProspectCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / 100);
  };

  const stage = currentStage || prospect.stage || "lead";
  const stageColorClass = stageColors[stage] || stageColors["lead"];

  return (
    <Card
      className={`cursor-pointer transition-all hover-elevate active-elevate-2 ${stageColorClass} ${
        isDragging ? "shadow-lg rotate-2" : ""
      }`}
      onClick={onClick}
      data-testid={`card-prospect-${prospect.id}`}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div
            {...dragHandleProps}
            className="flex-shrink-0 mr-2 cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
            data-testid={`drag-handle-${prospect.id}`}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate" data-testid={`text-company-name-${prospect.id}`}>
              {prospect.companyName}
            </h4>
            <p className="text-xs text-muted-foreground font-mono" data-testid={`text-company-number-${prospect.id}`}>
              {prospect.companyNumber}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" data-testid={`button-menu-${prospect.id}`}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick?.(); }} data-testid={`menu-view-${prospect.id}`}>
                View Details
              </DropdownMenuItem>
              {availableStages
                .filter((s) => s.value !== currentStage)
                .map((s) => (
                  <DropdownMenuItem
                    key={s.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove?.(s.value);
                    }}
                    data-testid={`menu-move-${s.value}-${prospect.id}`}
                  >
                    Move to {s.label}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {prospect.loanAmount && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2" data-testid={`text-loan-amount-${prospect.id}`}>
            <PoundSterling className="h-3 w-3" />
            {formatCurrency(prospect.loanAmount)}
          </div>
        )}

        {prospect.priority && (
          <Badge
            variant="outline"
            className={`text-xs ${priorityColors[prospect.priority]}`}
            data-testid={`badge-priority-${prospect.id}`}
          >
            {prospect.priority.charAt(0).toUpperCase() + prospect.priority.slice(1)} Priority
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
