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
import { GripVertical, MoreVertical, Ticket, Send, FileCheck, Lock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import SubmitApplicationDialog from "./SubmitApplicationDialog";

export type Priority = "high" | "medium" | "low";

export interface UnderwritingStatus {
  status: string;
  submittedAt: Date | string | null;
}

export interface ProspectCardData {
  id: number;
  companyName: string;
  companyNumber: string;
  loanAmount?: number;
  priority?: Priority;
  stage?: string;
  referralSource?: string | null;
}

export type DueDiligenceStatus = 'complete' | 'partial' | 'pending';

interface ProspectCardProps {
  prospect: ProspectCardData;
  onMove?: (stage: string) => void;
  onClick?: () => void;
  dragHandleProps?: any;
  isDragging?: boolean;
  availableStages?: { value: string; label: string }[];
  currentStage?: string;
  underwritingStatus?: UnderwritingStatus;
  dueDiligenceStatus?: DueDiligenceStatus;
  isOverLimit?: boolean;
  onLimitClick?: () => void;
  queuePosition?: number;
}

const priorityColors = {
  high: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 border-red-200 dark:border-red-800",
  medium:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border-amber-200 dark:border-amber-800",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border-blue-200 dark:border-blue-800",
};

const stageColors: Record<string, string> = {
  lead: "border-l-4 border-l-slate-400 dark:border-l-slate-500",
  contacted: "border-l-4 border-l-blue-400 dark:border-l-blue-500",
  qualified: "border-l-4 border-l-cyan-400 dark:border-l-cyan-500",
  proposal: "border-l-4 border-l-purple-400 dark:border-l-purple-500",
  packaging: "border-l-4 border-l-pink-400 dark:border-l-pink-500",
  "due-diligence": "border-l-4 border-l-amber-400 dark:border-l-amber-500",
  submission: "border-l-4 border-l-orange-400 dark:border-l-orange-500",
  "further-information": "border-l-4 border-l-orange-300 dark:border-l-orange-400",
  approved: "border-l-4 border-l-green-500 dark:border-l-green-600",
  declined: "border-l-4 border-l-red-500 dark:border-l-red-600",
  withdrawn: "border-l-4 border-l-gray-400 dark:border-l-gray-500",
};

// Underwriting status display labels and colors
const underwritingStatusConfig: Record<string, { label: string; className: string }> = {
  submitted: {
    label: "Submitted",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border-blue-200 dark:border-blue-800",
  },
  in_review: {
    label: "In Review",
    className:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200 border-purple-200 dark:border-purple-800",
  },
  queried: {
    label: "Queried",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border-amber-200 dark:border-amber-800",
  },
  approved: {
    label: "Approved",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 border-green-200 dark:border-green-800",
  },
  declined: {
    label: "Declined",
    className:
      "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 border-red-200 dark:border-red-800",
  },
  withdrawn: {
    label: "Withdrawn",
    className:
      "bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-200 border-gray-200 dark:border-gray-800",
  },
};

export default function ProspectCard({
  prospect,
  onMove,
  onClick,
  dragHandleProps,
  isDragging = false,
  availableStages = [],
  currentStage,
  underwritingStatus,
  dueDiligenceStatus,
  isOverLimit = false,
  onLimitClick,
  queuePosition,
}: ProspectCardProps) {
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  const handleCardClick = () => {
    if (isOverLimit) {
      onLimitClick?.();
    } else {
      onClick?.();
    }
  };

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
  const canSendToLender = ["packaging", "due-diligence", "submission"].includes(stage);

  return (
    <Card
      className={`cursor-pointer transition-all hover-elevate active-elevate-2 card-surface ${stageColorClass} ${isDragging ? "shadow-lg rotate-2" : ""
        } ${isOverLimit ? "opacity-75" : ""}`}
      onClick={handleCardClick}
      data-testid={`card-prospect-${prospect.id}`}
    >
      <CardContent className="p-3 relative">
        {isOverLimit && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-lg">
            <div className="flex flex-col items-center gap-2 text-center px-4">
              <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-sm font-medium">Upgrade to Access</span>
            </div>
          </div>
        )}
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="flex items-center gap-1 flex-shrink-0">
            {queuePosition !== undefined && (
              <div
                className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold"
                data-testid={`queue-position-${prospect.id}`}
              >
                {queuePosition}
              </div>
            )}
            <div
              {...dragHandleProps}
              className="cursor-grab active:cursor-grabbing p-1"
              onClick={(e) => e.stopPropagation()}
              data-testid={`drag-handle-${prospect.id}`}
            >
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4
                className="font-semibold text-base truncate leading-tight"
                data-testid={`text-company-name-${prospect.id}`}
              >
                {prospect.companyName}
              </h4>
              {(prospect.referralSource === "Strata" || prospect.referralSource === "Agent") && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 shrink-0">
                  {prospect.referralSource}
                </Badge>
              )}
              {stage === "due-diligence" && dueDiligenceStatus && (
                <div
                  className="flex-shrink-0"
                  data-testid={`dd-status-${prospect.id}`}
                  title={
                    dueDiligenceStatus === 'complete'
                      ? 'Due Diligence Complete'
                      : dueDiligenceStatus === 'partial'
                        ? 'Due Diligence In Progress'
                        : 'Due Diligence Pending'
                  }
                >
                  {dueDiligenceStatus === 'complete' && (
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  )}
                  {dueDiligenceStatus === 'partial' && (
                    <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                  )}
                  {dueDiligenceStatus === 'pending' && (
                    <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                  )}
                </div>
              )}
            </div>
            <p
              className="text-sm text-muted-foreground font-mono mt-1"
              data-testid={`text-company-number-${prospect.id}`}
            >
              {prospect.companyNumber}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -mr-1"
                data-testid={`button-menu-${prospect.id}`}
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onClick?.();
                }}
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
          <div
            className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3"
            data-testid={`text-loan-amount-${prospect.id}`}
          >
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

          {underwritingStatus && (
            <Badge
              variant="outline"
              className={`text-sm font-medium ${underwritingStatusConfig[underwritingStatus.status]?.className || underwritingStatusConfig.submitted.className}`}
              data-testid={`badge-underwriting-${prospect.id}`}
            >
              <FileCheck className="h-3 w-3 mr-1" />
              {underwritingStatusConfig[underwritingStatus.status]?.label || "Submitted"}
            </Badge>
          )}

          {canSendToLender && (
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
              Submit to Lender
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
