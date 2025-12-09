import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GripVertical, MoreVertical, Ticket, Send } from "lucide-react";
import SubmitApplicationDialog from "./SubmitApplicationDialog";

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
  high: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 border-red-200 dark:border-red-800",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border-amber-200 dark:border-amber-800",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border-blue-200 dark:border-blue-800",
};

const stageColors: Record<string, string> = {
  "lead": "border-l-4 border-l-slate-400 dark:border-l-slate-500",
  "contacted": "border-l-4 border-l-blue-400 dark:border-l-blue-500",
  "qualified": "border-l-4 border-l-cyan-400 dark:border-l-cyan-500",
  "proposal": "border-l-4 border-l-purple-400 dark:border-l-purple-500",
  "due-diligence": "border-l-4 border-l-amber-400 dark:border-l-amber-500",
  "submission": "border-l-4 border-l-orange-400 dark:border-l-orange-500",
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
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  
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
  const isSubmissionStage = stage === "submission";

  return (
    <Card
      className={`cursor-pointer transition-all hover-elevate active-elevate-2 ${stageColorClass} ${
        isDragging ? "shadow-lg rotate-2" : ""
      }`}
      onClick={onClick}
      data-testid={`card-prospect-${prospect.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3 gap-2">
          <div
            {...dragHandleProps}
            className="flex-shrink-0 mr-2 cursor-grab active:cursor-grabbing p-1 -ml-1"
            onClick={(e) => e.stopPropagation()}
            data-testid={`drag-handle-${prospect.id}`}
          >
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-base truncate leading-tight" data-testid={`text-company-name-${prospect.id}`}>
              {prospect.companyName}
            </h4>
            <p className="text-sm text-muted-foreground font-mono mt-1" data-testid={`text-company-number-${prospect.id}`}>
              {prospect.companyNumber}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 -mr-1" data-testid={`button-menu-${prospect.id}`}>
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); onClick?.(); }} 
                className="py-2.5 text-base"
                data-testid={`menu-view-${prospect.id}`}
              >
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
                    className="py-2.5 text-base"
                    data-testid={`menu-move-${s.value}-${prospect.id}`}
                  >
                    Move to {s.label}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {prospect.loanAmount && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3" data-testid={`text-loan-amount-${prospect.id}`}>
            <Ticket className="h-4 w-4" />
            <span className="font-medium">{formatCurrency(prospect.loanAmount)}</span>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {prospect.priority && (
            <Badge
              variant="outline"
              className={`text-sm font-medium ${priorityColors[prospect.priority]}`}
              data-testid={`badge-priority-${prospect.id}`}
            >
              {prospect.priority.charAt(0).toUpperCase() + prospect.priority.slice(1)}
            </Badge>
          )}
          
          {isSubmissionStage && (
            <Button
              size="sm"
              variant="default"
              onClick={(e) => {
                e.stopPropagation();
                setSubmitDialogOpen(true);
              }}
              data-testid={`button-submit-application-${prospect.id}`}
            >
              <Send className="h-4 w-4 mr-1.5" />
              Submit
            </Button>
          )}
        </div>
      </CardContent>
      
      <SubmitApplicationDialog
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
        prospectId={prospect.id}
        companyName={prospect.companyName}
      />
    </Card>
  );
}
